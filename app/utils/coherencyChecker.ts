import { SpawnedGroup, Model } from '../types';

const COHERENCY_DISTANCE_MM = 50.8; // 2 inches in mm

interface CoherencyResult {
  isInCoherency: boolean;
  outOfCoherencyModels: Set<string>; // Model IDs that violate coherency
}

/**
 * Calculate edge-to-edge distance between two models in mm
 */
function calculateEdgeDistance(
  model1: Model,
  model2: Model,
  group: SpawnedGroup
): number {
  const centerX1 = model1.x;
  const centerY1 = model1.y;
  const centerX2 = model2.x;
  const centerY2 = model2.y;

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
 * Check if a unit is in coherency according to 40k rules
 * - Units with 6 or fewer models: each model within 2" of at least 1 other model
 * - Units with 7+ models: each model within 2" of at least 2 other models
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
      }
    }

    // Check if this model meets coherency requirements
    if (connectionsCount < requiredConnections) {
      outOfCoherencyModels.add(model.id);
    }
  }

  return {
    isInCoherency: outOfCoherencyModels.size === 0,
    outOfCoherencyModels
  };
}
