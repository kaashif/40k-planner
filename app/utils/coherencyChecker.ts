import { SpawnedGroup, Model } from '../types';

const COHERENCY_DISTANCE_MM = 50.8; // 2 inches in mm
const MM_PER_INCH = 25.4;

interface CoherencyResult {
  isInCoherency: boolean;
  outOfCoherencyModels: Set<string>; // Model IDs that violate coherency
}

export interface NearestModel {
  model: Model;
  group: SpawnedGroup; // The group containing this model
  distanceMm: number;
  distanceInches: number; // Rounded up to 2 decimal places
}

/**
 * Calculate edge-to-edge distance between two models in mm
 */
export function calculateEdgeDistance(
  model1: Model,
  model2: Model,
  group: SpawnedGroup
): number {
  // Calculate base size to find center offset
  const size = group.isRectangular && group.width && group.length
    ? Math.max(group.width, group.length)
    : (group.baseSize || 25);

  // Model x,y are top-left corner positions, add half size to get center
  const centerX1 = model1.x + size / 2;
  const centerY1 = model1.y + size / 2;
  const centerX2 = model2.x + size / 2;
  const centerY2 = model2.y + size / 2;

  // Calculate center-to-center distance
  const centerDistance = Math.sqrt(
    Math.pow(centerX2 - centerX1, 2) + Math.pow(centerY2 - centerY1, 2)
  );

  if (group.isRectangular && group.width && group.length) {
    // For rectangular bases, use the larger dimension as approximation
    const halfSize = Math.max(group.width, group.length) / 2;
    return Math.max(0, centerDistance - (2 * halfSize));
  } else if (group.baseSize) {
    // For circular bases
    const radius = group.baseSize / 2;
    return Math.max(0, centerDistance - (2 * radius));
  }

  // Fallback to center distance if no base size
  return centerDistance;
}

/**
 * Check if all models form a single connected component using DFS
 */
function isConnectedComponent(
  models: Model[],
  adjacencyMap: Map<string, Set<string>>
): boolean {
  if (models.length <= 1) return true;

  const visited = new Set<string>();
  const stack = [models[0].id];

  // DFS from first model
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current)) continue;

    visited.add(current);
    const neighbors = adjacencyMap.get(current);
    if (neighbors) {
      neighbors.forEach(neighbor => {
        if (!visited.has(neighbor)) {
          stack.push(neighbor);
        }
      });
    }
  }

  // All models should be reachable from the first model
  return visited.size === models.length;
}

/**
 * Check if a unit is in coherency according to 40k rules
 * - Units with 6 or fewer models: each model within 2" of at least 1 other model
 * - Units with 7+ models: each model within 2" of at least 2 other models
 * - All models must form a single connected group
 */
export function checkCoherency(group: SpawnedGroup): CoherencyResult {
  const modelCount = group.models.length;

  // Single model is always in coherency
  if (modelCount === 1) {
    return {
      isInCoherency: true,
      outOfCoherencyModels: new Set()
    };
  }

  const requiredConnections = modelCount <= 6 ? 1 : 2;
  const outOfCoherencyModels = new Set<string>();

  // Build adjacency map for connectivity check
  const adjacencyMap = new Map<string, Set<string>>();
  group.models.forEach(model => {
    adjacencyMap.set(model.id, new Set());
  });

  // Check each model
  for (let i = 0; i < group.models.length; i++) {
    const model = group.models[i];
    let connectionsCount = 0;

    // Count how many other models are within coherency distance
    for (let j = 0; j < group.models.length; j++) {
      if (i === j) continue;

      const otherModel = group.models[j];
      const distance = calculateEdgeDistance(model, otherModel, group);

      if (distance <= COHERENCY_DISTANCE_MM) {
        connectionsCount++;
        // Build adjacency map for connectivity check
        adjacencyMap.get(model.id)!.add(otherModel.id);
      }
    }

    // Check if this model meets coherency requirements
    if (connectionsCount < requiredConnections) {
      outOfCoherencyModels.add(model.id);
    }
  }

  // Check if all models form a single connected component
  const isConnected = isConnectedComponent(group.models, adjacencyMap);

  // If not connected, all models are out of coherency
  if (!isConnected) {
    group.models.forEach(model => outOfCoherencyModels.add(model.id));
  }

  return {
    isInCoherency: outOfCoherencyModels.size === 0,
    outOfCoherencyModels
  };
}

/**
 * Check coherency across multiple groups that belong to the same parent unit
 * Used for units like "The Silent King" where different model types must all be in coherency
 */
export function checkParentUnitCoherency(groups: SpawnedGroup[]): CoherencyResult {
  if (groups.length === 0) {
    return {
      isInCoherency: true,
      outOfCoherencyModels: new Set()
    };
  }

  // Count total models across all groups
  const totalModelCount = groups.reduce((sum, g) => sum + g.models.length, 0);

  // Single model is always in coherency
  if (totalModelCount === 1) {
    return {
      isInCoherency: true,
      outOfCoherencyModels: new Set()
    };
  }

  const requiredConnections = totalModelCount <= 6 ? 1 : 2;
  const outOfCoherencyModels = new Set<string>();

  // Build adjacency map for connectivity check across all groups
  const adjacencyMap = new Map<string, Set<string>>();
  const allModelKeys: string[] = [];

  // Initialize adjacency map with all models
  for (const group of groups) {
    for (const model of group.models) {
      const key = `${group.unitId}-${model.id}`;
      adjacencyMap.set(key, new Set());
      allModelKeys.push(key);
    }
  }

  // Check each model in each group
  for (const currentGroup of groups) {
    for (const model of currentGroup.models) {
      const currentKey = `${currentGroup.unitId}-${model.id}`;
      let connectionsCount = 0;

      // Check distance to all other models in all groups
      for (const otherGroup of groups) {
        for (const otherModel of otherGroup.models) {
          // Skip same model
          if (currentGroup.unitId === otherGroup.unitId && model.id === otherModel.id) {
            continue;
          }

          // Calculate distance accounting for different group positions and base sizes
          const distance = calculateEdgeDistanceBetweenGroups(
            model, currentGroup,
            otherModel, otherGroup
          );

          if (distance <= COHERENCY_DISTANCE_MM) {
            connectionsCount++;
            // Build adjacency for connectivity check
            const otherKey = `${otherGroup.unitId}-${otherModel.id}`;
            adjacencyMap.get(currentKey)!.add(otherKey);
          }
        }
      }

      // Check if this model meets coherency requirements
      if (connectionsCount < requiredConnections) {
        outOfCoherencyModels.add(`${currentGroup.unitId}-${model.id}`);
      }
    }
  }

  // Check if all models form a single connected component
  // Create a simple models array for connectivity check
  const simpleModels = allModelKeys.map(key => ({ id: key, x: 0, y: 0 }));
  const isConnected = isConnectedComponent(simpleModels, adjacencyMap);

  // If not connected, all models are out of coherency
  if (!isConnected) {
    allModelKeys.forEach(key => outOfCoherencyModels.add(key));
  }

  return {
    isInCoherency: outOfCoherencyModels.size === 0,
    outOfCoherencyModels
  };
}

/**
 * Calculate edge-to-edge distance between models in different groups
 */
function calculateEdgeDistanceBetweenGroups(
  model1: Model,
  group1: SpawnedGroup,
  model2: Model,
  group2: SpawnedGroup
): number {
  // Calculate base sizes
  const size1 = group1.isRectangular && group1.width && group1.length
    ? Math.max(group1.width, group1.length)
    : (group1.baseSize || 25);
  const size2 = group2.isRectangular && group2.width && group2.length
    ? Math.max(group2.width, group2.length)
    : (group2.baseSize || 25);

  // Calculate absolute center positions
  // Model x,y are top-left corner positions, add half size to get center
  const centerX1 = group1.groupX + model1.x + size1 / 2;
  const centerY1 = group1.groupY + model1.y + size1 / 2;
  const centerX2 = group2.groupX + model2.x + size2 / 2;
  const centerY2 = group2.groupY + model2.y + size2 / 2;

  // Calculate center-to-center distance
  const centerDistance = Math.sqrt(
    Math.pow(centerX2 - centerX1, 2) + Math.pow(centerY2 - centerY1, 2)
  );

  // Calculate radii for both models
  let radius1: number;
  if (group1.isRectangular && group1.width && group1.length) {
    radius1 = Math.max(group1.width, group1.length) / 2;
  } else if (group1.baseSize) {
    radius1 = group1.baseSize / 2;
  } else {
    radius1 = 0;
  }

  let radius2: number;
  if (group2.isRectangular && group2.width && group2.length) {
    radius2 = Math.max(group2.width, group2.length) / 2;
  } else if (group2.baseSize) {
    radius2 = group2.baseSize / 2;
  } else {
    radius2 = 0;
  }

  return Math.max(0, centerDistance - radius1 - radius2);
}

/**
 * Find the nearest models to a given model
 * Returns 1 nearest model for units with 6 or fewer models
 * Returns 2 nearest models for units with 7+ models
 *
 * @param targetModel - The model to measure from
 * @param targetGroup - The group containing the target model
 * @param allGroups - All groups to search (for parent units, pass all groups with same parentUnitId)
 */
export function findNearestModels(
  targetModel: Model,
  targetGroup: SpawnedGroup,
  allGroups?: SpawnedGroup[]
): NearestModel[] {
  // If no allGroups provided, default to just the target group
  const groupsToSearch = allGroups || [targetGroup];

  // Count total models across all groups
  const totalModelCount = groupsToSearch.reduce((sum, g) => sum + g.models.length, 0);

  // Single model has no neighbors
  if (totalModelCount === 1) {
    return [];
  }

  const requiredNeighbors = totalModelCount <= 6 ? 1 : 2;

  // Calculate distances to all other models in all groups
  const distances: NearestModel[] = [];

  for (const group of groupsToSearch) {
    for (const model of group.models) {
      // Skip the target model itself
      if (group.unitId === targetGroup.unitId && model.id === targetModel.id) {
        continue;
      }

      // Calculate distance
      const distanceMm = group.unitId === targetGroup.unitId
        ? calculateEdgeDistance(targetModel, model, targetGroup)
        : calculateEdgeDistanceBetweenGroups(targetModel, targetGroup, model, group);

      const distanceInches = Math.ceil(distanceMm / MM_PER_INCH * 100) / 100; // Round up to 2 decimal places

      distances.push({
        model,
        group, // Include the group containing this model
        distanceMm,
        distanceInches
      });
    }
  }

  // Sort by distance and return the nearest 1 or 2 models
  distances.sort((a, b) => a.distanceMm - b.distanceMm);
  return distances.slice(0, requiredNeighbors);
}
