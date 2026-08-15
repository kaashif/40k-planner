const INFINITY = Number.POSITIVE_INFINITY;

export function retainLargeConnectedComponents(mask: Uint8Array, width: number, height: number, minimumArea: number) {
  const retained = new Uint8Array(mask.length);
  const visited = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    let head = 0;
    let length = 1;
    queue[0] = start;
    visited[start] = 1;
    while (head < length) {
      const pixel = queue[head++];
      const x = pixel % width;
      const neighbours = [pixel - width, pixel + width, pixel - 1, pixel + 1];
      for (let direction = 0; direction < neighbours.length; direction += 1) {
        const neighbour = neighbours[direction];
        if (neighbour < 0 || neighbour >= mask.length || visited[neighbour] || !mask[neighbour]) continue;
        if ((direction === 2 && x === 0) || (direction === 3 && x === width - 1)) continue;
        visited[neighbour] = 1;
        queue[length++] = neighbour;
      }
    }
    if (length >= minimumArea) {
      for (let index = 0; index < length; index += 1) retained[queue[index]] = 1;
    }
  }
  return retained;
}

function distanceTransform1d(values: Float64Array, scaleSquared: number) {
  const finite = Array.from(values.keys()).filter((index) => Number.isFinite(values[index]));
  const result = new Float64Array(values.length);
  if (finite.length === 0) {
    result.fill(INFINITY);
    return result;
  }

  const vertices = new Int32Array(finite.length);
  const boundaries = new Float64Array(finite.length + 1);
  let envelopeEnd = 0;
  vertices[0] = finite[0];
  boundaries[0] = -INFINITY;
  boundaries[1] = INFINITY;

  for (let index = 1; index < finite.length; index += 1) {
    const candidate = finite[index];
    let current = vertices[envelopeEnd];
    let intersection = ((values[candidate] + scaleSquared * candidate * candidate)
      - (values[current] + scaleSquared * current * current)) / (2 * scaleSquared * (candidate - current));
    while (envelopeEnd > 0 && intersection <= boundaries[envelopeEnd]) {
      envelopeEnd -= 1;
      current = vertices[envelopeEnd];
      intersection = ((values[candidate] + scaleSquared * candidate * candidate)
        - (values[current] + scaleSquared * current * current)) / (2 * scaleSquared * (candidate - current));
    }
    envelopeEnd += 1;
    vertices[envelopeEnd] = candidate;
    boundaries[envelopeEnd] = intersection;
    boundaries[envelopeEnd + 1] = INFINITY;
  }

  let envelopeIndex = 0;
  for (let position = 0; position < values.length; position += 1) {
    while (boundaries[envelopeIndex + 1] < position) envelopeIndex += 1;
    const source = vertices[envelopeIndex];
    result[position] = values[source] + scaleSquared * (position - source) ** 2;
  }
  return result;
}

export function squaredDistanceFromMask(mask: Uint8Array, width: number, height: number, boardWidth: number, boardHeight: number) {
  const horizontal = new Float64Array(mask.length);
  const row = new Float64Array(width);
  const horizontalScale = (boardWidth / width) ** 2;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) row[x] = mask[y * width + x] ? 0 : INFINITY;
    horizontal.set(distanceTransform1d(row, horizontalScale), y * width);
  }

  const result = new Float64Array(mask.length);
  const column = new Float64Array(height);
  const verticalScale = (boardHeight / height) ** 2;
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) column[y] = horizontal[y * width + x];
    const transformed = distanceTransform1d(column, verticalScale);
    for (let y = 0; y < height; y += 1) result[y * width + x] = transformed[y];
  }
  return result;
}
