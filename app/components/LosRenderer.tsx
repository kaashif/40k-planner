'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface LosRendererProps {
  overlayUrl: string;
  selectedModels: Array<{
    centerX: number;
    centerY: number;
    baseRadius: number;
  }>;
  width: number;
  height: number;
  enabled: boolean;
  imageOffset: { x: number; y: number };
  isDragging?: boolean;
}

// Number of rays to cast per source point
const NUM_RAYS = 360;
// Number of points around base to cast from
const BASE_POINTS = 8;

export default function LosRenderer({
  overlayUrl,
  selectedModels,
  width,
  height,
  enabled,
  imageOffset,
  isDragging = false
}: LosRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayDataRef = useRef<Uint8ClampedArray | null>(null);
  const overlayDimsRef = useRef<{ width: number; height: number } | null>(null);
  const lastOverlayRef = useRef<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  // Load overlay image
  const loadOverlay = useCallback(async (url: string) => {
    if (lastOverlayRef.current === url && overlayDataRef.current) return;

    return new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          overlayDataRef.current = imageData.data;
          overlayDimsRef.current = { width: img.width, height: img.height };
          overlayCanvasRef.current = canvas;
          lastOverlayRef.current = url;
        }
        resolve();
      };
      img.onerror = () => resolve();
      img.src = url;
    });
  }, []);

  // Check pixel type at overlay coordinates
  const getBlockerType = useCallback((ox: number, oy: number): 'none' | 'red' | 'blue' => {
    const data = overlayDataRef.current;
    const dims = overlayDimsRef.current;
    if (!data || !dims) return 'none';

    const px = Math.floor(ox);
    const py = Math.floor(oy);
    if (px < 0 || px >= dims.width || py < 0 || py >= dims.height) return 'none';

    const idx = (py * dims.width + px) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];

    if (a < 50) return 'none';
    if (r > 100 && r > b * 1.2) return 'red';
    if (b > 100 && b > r * 1.2) return 'blue';
    return 'none';
  }, []);

  // Cast a single ray and return distance to blockage
  const castRay = useCallback((
    startX: number, startY: number,
    angle: number,
    maxDist: number,
    scaleX: number, scaleY: number
  ): number => {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const step = 3; // Check every 3 pixels
    let passedBlue = false;

    for (let d = 0; d < maxDist; d += step) {
      const x = startX + dx * d;
      const y = startY + dy * d;

      // Convert to overlay coords
      const ox = (x - imageOffset.x) * scaleX;
      const oy = (y - imageOffset.y) * scaleY;

      const blocker = getBlockerType(ox, oy);

      if (blocker === 'red') return d;
      if (blocker === 'blue') {
        if (passedBlue) return d;
        passedBlue = true;
        // Skip through this blue region
        while (d < maxDist) {
          d += step;
          const nx = startX + dx * d;
          const ny = startY + dy * d;
          const nox = (nx - imageOffset.x) * scaleX;
          const noy = (ny - imageOffset.y) * scaleY;
          if (getBlockerType(nox, noy) !== 'blue') break;
        }
      }
    }
    return maxDist;
  }, [imageOffset, getBlockerType]);

  // Main render function
  const renderLoS = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled || selectedModels.length === 0 || width === 0 || height === 0) {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    setIsCalculating(true);
    await loadOverlay(overlayUrl);

    const dims = overlayDimsRef.current;
    if (!dims) {
      setIsCalculating(false);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsCalculating(false);
      return;
    }

    ctx.clearRect(0, 0, width, height);

    const mapWidth = width - imageOffset.x * 2;
    const mapHeight = height - imageOffset.y * 2;
    const scaleX = dims.width / mapWidth;
    const scaleY = dims.height / mapHeight;
    const maxDist = Math.sqrt(width * width + height * height);

    // For each selected model, draw visibility cone
    for (const model of selectedModels) {
      // Generate source points around base perimeter
      const sourcePoints: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < BASE_POINTS; i++) {
        const a = (i / BASE_POINTS) * Math.PI * 2;
        sourcePoints.push({
          x: model.centerX + Math.cos(a) * model.baseRadius,
          y: model.centerY + Math.sin(a) * model.baseRadius
        });
      }

      // For each source point, cast rays and build visibility polygon
      const visibilityPolygons: Array<Array<{ x: number; y: number }>> = [];

      for (const source of sourcePoints) {
        const points: Array<{ x: number; y: number }> = [{ x: source.x, y: source.y }];

        for (let i = 0; i < NUM_RAYS; i++) {
          const angle = (i / NUM_RAYS) * Math.PI * 2;
          const dist = castRay(source.x, source.y, angle, maxDist, scaleX, scaleY);
          points.push({
            x: source.x + Math.cos(angle) * dist,
            y: source.y + Math.sin(angle) * dist
          });
        }
        points.push(points[1]); // Close the polygon
        visibilityPolygons.push(points);
      }

      // Draw all polygons to offscreen canvas as solid, then composite with alpha
      const offscreen = document.createElement('canvas');
      offscreen.width = width;
      offscreen.height = height;
      const offCtx = offscreen.getContext('2d');
      if (offCtx) {
        offCtx.fillStyle = 'rgb(255, 0, 255)';
        for (const polygon of visibilityPolygons) {
          offCtx.beginPath();
          offCtx.moveTo(polygon[0].x, polygon[0].y);
          for (let i = 1; i < polygon.length; i++) {
            offCtx.lineTo(polygon[i].x, polygon[i].y);
          }
          offCtx.closePath();
          offCtx.fill();
        }
      }

      // Draw offscreen canvas with uniform alpha
      ctx.globalAlpha = 0.35;
      ctx.drawImage(offscreen, 0, 0);
      ctx.globalAlpha = 1.0;
    }

    setIsCalculating(false);
  }, [enabled, selectedModels, width, height, overlayUrl, imageOffset, loadOverlay, castRay]);

  // Debounced render
  useEffect(() => {
    if (!enabled || isDragging || width === 0 || height === 0) return;

    const timeoutId = setTimeout(() => {
      renderLoS();
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [enabled, isDragging, selectedModels, width, height, overlayUrl, renderLoS]);

  // Update canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && (canvas.width !== width || canvas.height !== height)) {
      canvas.width = width;
      canvas.height = height;
    }
  }, [width, height]);

  if (!enabled) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 5
        }}
      />
      {isCalculating && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            padding: '4px 8px',
            background: 'rgba(0,0,0,0.7)',
            color: '#39FF14',
            fontSize: '12px',
            borderRadius: '4px',
            zIndex: 100
          }}
        >
          Calculating...
        </div>
      )}
    </>
  );
}
