'use client';

import { useEffect, useRef } from 'react';

const CORNER_EPSILON = 0.00012;

type TerrainMask = {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  corners: Array<[number, number]>;
};

const maskCache = new Map<string, Promise<TerrainMask>>();

function loadTerrainMask(url: string) {
  const cached = maskCache.get(url);
  if (cached) return cached;

  const request = new Promise<TerrainMask>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) {
        reject(new Error('Could not read terrain mask.'));
        return;
      }
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const blocked = (x: number, y: number) => pixels[(y * canvas.width + x) * 4] > 127;
      const corners: Array<[number, number]> = [
        [0, 0],
        [canvas.width, 0],
        [canvas.width, canvas.height],
        [0, canvas.height],
      ];

      // A 2×2 cell containing one or three blocked pixels is a turn in the
      // blocker outline. These are the vertices that define visibility cones.
      for (let y = 0; y < canvas.height - 1; y += 1) {
        for (let x = 0; x < canvas.width - 1; x += 1) {
          const count = Number(blocked(x, y))
            + Number(blocked(x + 1, y))
            + Number(blocked(x, y + 1))
            + Number(blocked(x + 1, y + 1));
          if (count === 1 || count === 3) corners.push([x + .5, y + .5]);
        }
      }
      resolve({ width: canvas.width, height: canvas.height, pixels, corners });
    };
    image.onerror = () => reject(new Error(`Could not load terrain mask: ${url}`));
    image.src = url;
  });
  maskCache.set(url, request);
  return request;
}

export default function TerrainVisibility({
  enabled,
  maskUrl,
  x,
  y,
}: {
  enabled: boolean;
  maskUrl: string;
  x: number;
  y: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!enabled) return;

    let cancelled = false;
    const renderTimer = window.setTimeout(async () => {
      const mask = await loadTerrainMask(maskUrl);
      if (cancelled) return;
      const originX = x * mask.width;
      const originY = y * mask.height;
      const maxDistance = Math.hypot(mask.width, mask.height);
      const isBlocked = (sampleX: number, sampleY: number) => {
        const pixelX = Math.max(0, Math.min(mask.width - 1, Math.floor(sampleX)));
        const pixelY = Math.max(0, Math.min(mask.height - 1, Math.floor(sampleY)));
        return mask.pixels[(pixelY * mask.width + pixelX) * 4] > 127;
      };
      const startsInTerrain = isBlocked(originX, originY);
      const angles = mask.corners.flatMap(([cornerX, cornerY]) => {
        const angle = Math.atan2(cornerY - originY, cornerX - originX);
        return [angle - CORNER_EPSILON, angle, angle + CORNER_EPSILON];
      }).sort((left, right) => left - right);
      const uniqueAngles = angles.filter((angle, index) => index === 0 || Math.abs(angle - angles[index - 1]) > 0.000001);
      const points: Array<[number, number]> = [];

      for (const angle of uniqueAngles) {
        const directionX = Math.cos(angle);
        const directionY = Math.sin(angle);
        let endpointX = originX;
        let endpointY = originY;
        let leftStartingTerrain = !startsInTerrain;

        for (let distance = .5; distance < maxDistance; distance += .5) {
          const sampleX = originX + directionX * distance;
          const sampleY = originY + directionY * distance;
          if (sampleX < 0 || sampleX >= mask.width || sampleY < 0 || sampleY >= mask.height) break;
          const blocked = isBlocked(sampleX, sampleY);
          if (!leftStartingTerrain) {
            if (!blocked) leftStartingTerrain = true;
          } else if (blocked) {
            break;
          }
          endpointX = sampleX;
          endpointY = sampleY;
        }
        points.push([endpointX, endpointY]);
      }

      context.clearRect(0, 0, canvas.width, canvas.height);
      if (points.length < 3) return;
      context.beginPath();
      context.moveTo(points[0][0], points[0][1]);
      for (let index = 1; index < points.length; index += 1) context.lineTo(points[index][0], points[index][1]);
      context.closePath();
      context.fillStyle = 'rgba(235, 35, 53, .30)';
      context.fill();
      context.strokeStyle = 'rgba(255, 72, 84, .9)';
      context.lineWidth = 1.25;
      context.stroke();
    }, 35);

    return () => {
      cancelled = true;
      window.clearTimeout(renderTimer);
    };
  }, [enabled, maskUrl, x, y]);

  return <canvas ref={canvasRef} className="visibility-overlay" width={522} height={708} aria-hidden="true" />;
}
