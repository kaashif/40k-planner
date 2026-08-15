'use client';

import { useEffect, useRef } from 'react';
import { retainLargeConnectedComponents, squaredDistanceFromMask } from './deployment-distance';

type Side = 'blue' | 'red';

export default function InfiltrateOverlay({ mapUrl, playerSide }: { mapUrl: string; playerSide: Side }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const opponent = playerSide === 'blue' ? 'red' : 'blue';
      const mask = new Uint8Array(canvas.width * canvas.height);
      for (let pixel = 0; pixel < mask.length; pixel += 1) {
        const index = pixel * 4;
        const red = pixels.data[index];
        const green = pixels.data[index + 1];
        const blue = pixels.data[index + 2];
        const redZone = red > 70 && red > green * 1.55 && red > blue * 1.28;
        const blueZone = blue > 45 && blue > red * 1.35 && blue > green * 1.1;
        mask[pixel] = Number(opponent === 'red' ? redZone : blueZone);
      }

      const deploymentZone = retainLargeConnectedComponents(mask, canvas.width, canvas.height, 500);
      const distances = squaredDistanceFromMask(deploymentZone, canvas.width, canvas.height, 44, 60);
      const overlay = context.createImageData(canvas.width, canvas.height);
      for (let pixel = 0; pixel < mask.length; pixel += 1) {
        if (distances[pixel] > 64) continue;
        const index = pixel * 4;
        overlay.data[index] = opponent === 'red' ? 255 : 45;
        overlay.data[index + 1] = opponent === 'red' ? 55 : 155;
        overlay.data[index + 2] = opponent === 'red' ? 65 : 255;
        overlay.data[index + 3] = deploymentZone[pixel] ? 92 : 62;
      }
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.putImageData(overlay, 0, 0);
    };
    image.src = mapUrl;
    return () => { cancelled = true; };
  }, [mapUrl, playerSide]);

  const opponent = playerSide === 'blue' ? 'red' : 'blue';
  return <div className={`infiltrate-overlay ${opponent}`} aria-label={`Area within 8 inches of the opponent's ${opponent} deployment zone`}>
    <canvas ref={canvasRef} />
    <span>No infiltrate · within 8″ of {opponent} deployment</span>
  </div>;
}
