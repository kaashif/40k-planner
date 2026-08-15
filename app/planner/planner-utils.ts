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
