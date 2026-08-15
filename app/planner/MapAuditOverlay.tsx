'use client';

import { useEffect, useRef } from 'react';

type Props = {
  mapUrl: string;
  terrainMaskUrl: string;
};

export default function MapAuditOverlay({ mapUrl, terrainMaskUrl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const image = new Image();
    image.src = mapUrl;
    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      for (let index = 0; index < pixels.data.length; index += 4) {
        const red = pixels.data[index];
        const green = pixels.data[index + 1];
        const blue = pixels.data[index + 2];
        const redZone = red > 70 && red > green * 1.55 && red > blue * 1.28;
        const blueZone = blue > 45 && blue > red * 1.35 && blue > green * 1.1;
        if (redZone) {
          pixels.data[index] = 255;
          pixels.data[index + 1] = 42;
          pixels.data[index + 2] = 56;
          pixels.data[index + 3] = 150;
        } else if (blueZone) {
          pixels.data[index] = 34;
          pixels.data[index + 1] = 157;
          pixels.data[index + 2] = 255;
          pixels.data[index + 3] = 150;
        } else {
          pixels.data[index + 3] = 0;
        }
      }
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.putImageData(pixels, 0, 0);
    };
  }, [mapUrl]);

  return (
    <div className="map-audit-overlay" aria-label="Planner map interpretation">
      <canvas ref={canvasRef} />
      <div className="terrain-audit-mask" style={{ WebkitMaskImage: `url(${terrainMaskUrl})`, maskImage: `url(${terrainMaskUrl})` }} />
      <div className="map-audit-legend">
        <strong>Planner interpretation</strong>
        <span><i className="red-zone" /> red deployment zone</span>
        <span><i className="blue-zone" /> blue deployment zone</span>
        <span><i className="terrain-zone" /> sight-blocking terrain footprint</span>
        <small>Line of sight is blocked when a ray enters a green footprint after leaving its starting footprint. Deployment colours are read from the current GDM/Battlemaster map.</small>
      </div>
    </div>
  );
}
