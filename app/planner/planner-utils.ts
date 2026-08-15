export const TABLE_WIDTH = 44;
export const TABLE_HEIGHT = 60;
export const MM_PER_INCH = 25.4;

export type PlannerMarker = {
  id: number;
  x: number;
  y: number;
  widthMm: number;
  heightMm: number;
  label: string;
  side: 'blue' | 'red';
  unitId?: string;
  moveInches?: number;
};

function directionalRadius(marker: PlannerMarker, dx: number, dy: number) {
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return 0;
  const ux = dx / distance;
  const uy = dy / distance;
  const radiusX = marker.widthMm / MM_PER_INCH / 2;
  const radiusY = marker.heightMm / MM_PER_INCH / 2;
  return 1 / Math.sqrt((ux * ux) / (radiusX * radiusX) + (uy * uy) / (radiusY * radiusY));
}

/** Shortest horizontal distance between the two base edges, in inches. */
export function baseEdgeDistance(left: PlannerMarker, right: PlannerMarker) {
  const dx = (right.x - left.x) * TABLE_WIDTH;
  const dy = (right.y - left.y) * TABLE_HEIGHT;
  const centreDistance = Math.hypot(dx, dy);
  if (centreDistance === 0) return 0;
  return Math.max(0, centreDistance - directionalRadius(left, dx, dy) - directionalRadius(right, -dx, -dy));
}

/**
 * A unit is coherent when every model is within 2 inches of another model and
 * no pair of models is more than 9 inches apart. Both rules measure base edge
 * to base edge, rather than requiring a base to be wholly within either range.
 */
export function coherencyIssues(markers: PlannerMarker[]) {
  const groups = new Map<string, PlannerMarker[]>();
  for (const marker of markers) {
    const key = `${marker.side}:${marker.unitId || `single-${marker.id}`}`;
    groups.set(key, [...(groups.get(key) ?? []), marker]);
  }

  const issues = new Map<number, string[]>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const marker of group) {
      const distances = group.filter(({ id }) => id !== marker.id).map((other) => baseEdgeDistance(marker, other));
      const markerIssues = [];
      if (Math.min(...distances) > 2 + 1e-6) markerIssues.push('not within 2″ of another model in its unit');
      if (Math.max(...distances) > 9 + 1e-6) markerIssues.push('more than 9″ from another model in its unit');
      if (markerIssues.length) issues.set(marker.id, markerIssues);
    }
  }
  return issues;
}

export type CoherencyMeasurement = {
  key: string;
  from: PlannerMarker;
  to: PlannerMarker;
  distance: number;
  limit: 2 | 9;
};

/** Lines that explain each failed coherency test without duplicating pairs. */
export function coherencyMeasurements(markers: PlannerMarker[]) {
  const groups = new Map<string, PlannerMarker[]>();
  for (const marker of markers) {
    const key = `${marker.side}:${marker.unitId || `single-${marker.id}`}`;
    groups.set(key, [...(groups.get(key) ?? []), marker]);
  }

  const measurements = new Map<string, CoherencyMeasurement>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const marker of group) {
      const neighbours = group
        .filter(({ id }) => id !== marker.id)
        .map((other) => ({ other, distance: baseEdgeDistance(marker, other) }))
        .sort((left, right) => left.distance - right.distance);
      if (neighbours[0].distance > 2 + 1e-6) {
        const other = neighbours[0].other;
        const pair = [marker.id, other.id].sort((a, b) => a - b).join('-');
        measurements.set(`2-${pair}`, { key: `2-${pair}`, from: marker, to: other, distance: neighbours[0].distance, limit: 2 });
      }
      for (const { other, distance } of neighbours) {
        if (distance <= 9 + 1e-6) continue;
        const pair = [marker.id, other.id].sort((a, b) => a - b).join('-');
        measurements.set(`9-${pair}`, { key: `9-${pair}`, from: marker, to: other, distance, limit: 9 });
      }
    }
  }
  return [...measurements.values()];
}

type Rect = { left: number; right: number; top: number; bottom: number };
export type UnitLabelPlacement = {
  key: string;
  label: string;
  markerIds: number[];
  x: number;
  y: number;
  side: 'top' | 'right' | 'bottom' | 'left';
};

export function constrainMove(
  origin: { x: number; y: number },
  destination: { x: number; y: number },
  maximumInches: number,
) {
  const dx = (destination.x - origin.x) * TABLE_WIDTH;
  const dy = (destination.y - origin.y) * TABLE_HEIGHT;
  const requestedDistance = Math.hypot(dx, dy);
  if (requestedDistance <= maximumInches || requestedDistance === 0) return destination;
  const scale = maximumInches / requestedDistance;
  return { x: origin.x + dx * scale / TABLE_WIDTH, y: origin.y + dy * scale / TABLE_HEIGHT };
}

function overlapArea(left: Rect, right: Rect) {
  return Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left))
    * Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
}

/** Place one label per unit on whichever side collides least with bases and labels. */
export function placeUnitLabels(markers: PlannerMarker[]): UnitLabelPlacement[] {
  const groups = new Map<string, PlannerMarker[]>();
  for (const marker of markers) {
    const key = `${marker.side}:${marker.unitId || `single-${marker.id}`}`;
    groups.set(key, [...(groups.get(key) ?? []), marker]);
  }

  const baseRects = markers.map((marker): Rect => {
    const halfWidth = marker.widthMm / MM_PER_INCH / TABLE_WIDTH / 2;
    const halfHeight = marker.heightMm / MM_PER_INCH / TABLE_HEIGHT / 2;
    return { left: marker.x - halfWidth, right: marker.x + halfWidth, top: marker.y - halfHeight, bottom: marker.y + halfHeight };
  });
  const placedRects: Rect[] = [];
  const placements: UnitLabelPlacement[] = [];
  const orderedGroups = [...groups.entries()].sort((left, right) => right[1].length - left[1].length);

  for (const [key, group] of orderedGroups) {
    const bounds = group.reduce((rect, marker) => {
      const halfWidth = marker.widthMm / MM_PER_INCH / TABLE_WIDTH / 2;
      const halfHeight = marker.heightMm / MM_PER_INCH / TABLE_HEIGHT / 2;
      return {
        left: Math.min(rect.left, marker.x - halfWidth), right: Math.max(rect.right, marker.x + halfWidth),
        top: Math.min(rect.top, marker.y - halfHeight), bottom: Math.max(rect.bottom, marker.y + halfHeight),
      };
    }, { left: 1, right: 0, top: 1, bottom: 0 });
    const label = group[0].label;
    const width = Math.min(.28, Math.max(.1, label.length * .0062));
    const height = .026;
    const gap = .007;
    const centreX = (bounds.left + bounds.right) / 2;
    const centreY = (bounds.top + bounds.bottom) / 2;
    const candidates = [
      { side: 'top' as const, x: centreX, y: bounds.top - gap, rect: { left: centreX - width / 2, right: centreX + width / 2, top: bounds.top - gap - height, bottom: bounds.top - gap } },
      { side: 'right' as const, x: bounds.right + gap, y: centreY, rect: { left: bounds.right + gap, right: bounds.right + gap + width, top: centreY - height / 2, bottom: centreY + height / 2 } },
      { side: 'bottom' as const, x: centreX, y: bounds.bottom + gap, rect: { left: centreX - width / 2, right: centreX + width / 2, top: bounds.bottom + gap, bottom: bounds.bottom + gap + height } },
      { side: 'left' as const, x: bounds.left - gap, y: centreY, rect: { left: bounds.left - gap - width, right: bounds.left - gap, top: centreY - height / 2, bottom: centreY + height / 2 } },
    ];
    const score = (rect: Rect) => {
      const outside = Math.max(0, -rect.left) + Math.max(0, rect.right - 1) + Math.max(0, -rect.top) + Math.max(0, rect.bottom - 1);
      const baseOverlap = baseRects.reduce((total, base) => total + overlapArea(rect, base), 0);
      const labelOverlap = placedRects.reduce((total, placed) => total + overlapArea(rect, placed), 0);
      return outside * 1_000_000 + baseOverlap * 10_000 + labelOverlap * 15_000;
    };
    const chosen = candidates.reduce((best, candidate) => score(candidate.rect) < score(best.rect) ? candidate : best);
    placedRects.push(chosen.rect);
    placements.push({ key, label, markerIds: group.map(({ id }) => id), x: chosen.x, y: chosen.y, side: chosen.side });
  }
  return placements;
}
