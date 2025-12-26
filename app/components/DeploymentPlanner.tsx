'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

interface Layout {
  id: string;
  title: string;
  image: string;
}

interface Model {
  id: string;
  x: number;
  y: number;
}

interface SpawnedGroup {
  unitId: string;
  unitName: string;
  isRectangular: boolean;
  baseSize?: number;
  width?: number;
  length?: number;
  models: Model[];
  groupX: number;
  groupY: number;
}

interface DeploymentPlannerProps {
  spawnedGroups: SpawnedGroup[];
  onUpdateGroups: (groups: SpawnedGroup[]) => void;
}

const layouts: Layout[] = [
  { id: 'terraform', title: 'Round 1: Terraform', image: '/round1_terraform.png' },
  { id: 'purge', title: 'Round 2: Purge the Foe', image: '/round2_purge.png' },
  { id: 'supplies', title: 'Round 3: Hidden Supplies', image: '/round3_hidden_supplies.png' },
  { id: 'linchpin', title: 'Round 4: Linchpin', image: '/round4_linchpin.png' },
  { id: 'take', title: 'Round 5: Take and Hold', image: '/round5_take.png' },
];

export default function DeploymentPlanner({ spawnedGroups, onUpdateGroups }: DeploymentPlannerProps) {
  const [selectedLayout, setSelectedLayout] = useState(layouts[0]);
  const [draggedModel, setDraggedModel] = useState<{ groupId: string; modelId: string | null } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1); // pixels per mm
  const canvasRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Map dimensions in mm: 44" × 60" = 1117.6mm × 1524mm
  const MAP_HEIGHT_MM = 44 * 25.4; // 1117.6 mm
  const MAP_WIDTH_MM = 60 * 25.4; // 1524 mm

  // Calculate scale when image loads or container resizes
  useEffect(() => {
    const updateScale = () => {
      if (!canvasRef.current) return;

      const container = canvasRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      // Calculate which dimension is the limiting factor (aspect ratio 60:44)
      const containerAspectRatio = containerWidth / containerHeight;
      const mapAspectRatio = MAP_WIDTH_MM / MAP_HEIGHT_MM;

      let scale;
      if (containerAspectRatio > mapAspectRatio) {
        // Height is limiting factor
        scale = containerHeight / MAP_HEIGHT_MM;
      } else {
        // Width is limiting factor
        scale = containerWidth / MAP_WIDTH_MM;
      }

      setScale(scale);
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  const handleMouseDown = (e: React.MouseEvent, groupId: string, modelId: string | null) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const group = spawnedGroups.find(g => g.unitId === groupId);
    if (!group) return;

    if (modelId === null) {
      // Dragging the whole group
      setDragOffset({
        x: e.clientX - rect.left - group.groupX,
        y: e.clientY - rect.top - group.groupY
      });
    } else {
      // Dragging individual model
      const model = group.models.find(m => m.id === modelId);
      if (!model) return;
      setDragOffset({
        x: e.clientX - rect.left - (group.groupX + model.x * scale),
        y: e.clientY - rect.top - (group.groupY + model.y * scale)
      });
    }

    setDraggedModel({ groupId, modelId });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedModel || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffset.x;
    const y = e.clientY - rect.top - dragOffset.y;

    const updatedGroups = spawnedGroups.map(group => {
      if (group.unitId !== draggedModel.groupId) return group;

      if (draggedModel.modelId === null) {
        // Move entire group
        return { ...group, groupX: x, groupY: y };
      } else {
        // Move individual model
        return {
          ...group,
          models: group.models.map(model =>
            model.id === draggedModel.modelId
              ? { ...model, x: (x - group.groupX) / scale, y: (y - group.groupY) / scale }
              : model
          )
        };
      }
    });

    onUpdateGroups(updatedGroups);
  };

  const handleMouseUp = () => {
    setDraggedModel(null);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setDraggedModel(null);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <label className="block mb-2 font-semibold text-gray-200">
          Select Mission Layout
        </label>
        <select
          value={selectedLayout.id}
          onChange={(e) => {
            const layout = layouts.find(l => l.id === e.target.value);
            if (layout) setSelectedLayout(layout);
          }}
          className="w-full p-3 bg-[#1a1a1a] border border-[#1a2a1a] rounded-lg text-gray-200 focus:outline-none focus:border-[#39FF14] cursor-pointer"
        >
          {layouts.map((layout) => (
            <option key={layout.id} value={layout.id}>
              {layout.title}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-[#1a1a1a] border border-[#1a2a1a] rounded-lg p-6">
        <h3 className="text-xl font-bold mb-4 text-[#39FF14] text-center">
          {selectedLayout.title}
        </h3>
        <div
          ref={canvasRef}
          className="relative w-full h-[calc(100vh-400px)] cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <Image
            src={selectedLayout.image}
            alt={selectedLayout.title}
            fill
            className="object-contain pointer-events-none"
            priority
          />

          {/* Render spawned models */}
          {spawnedGroups.map(group => (
            <div key={group.unitId}>
              {/* Group background - for easier group dragging */}
              <div
                onMouseDown={(e) => handleMouseDown(e, group.unitId, null)}
                className="absolute cursor-move hover:opacity-80"
                style={{
                  left: group.groupX,
                  top: group.groupY,
                  width: 100 * scale,
                  height: 100 * scale,
                }}
                title={`${group.unitName} (drag group)`}
              />

              {/* Individual models */}
              {group.models.map(model => {
                // Convert mm to pixels using scale
                const size = group.isRectangular
                  ? {
                      width: (group.width || 25) * scale,
                      height: (group.length || 25) * scale
                    }
                  : {
                      width: (group.baseSize || 25) * scale,
                      height: (group.baseSize || 25) * scale
                    };

                return (
                  <div
                    key={model.id}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleMouseDown(e, group.unitId, model.id);
                    }}
                    className="absolute cursor-move border-2 border-[#39FF14] hover:border-[#FFFF00] transition-colors"
                    style={{
                      left: group.groupX + (model.x * scale),
                      top: group.groupY + (model.y * scale),
                      width: size.width,
                      height: size.height,
                      borderRadius: group.isRectangular ? '4px' : '50%',
                      backgroundColor: 'rgba(57, 255, 20, 0.2)',
                    }}
                    title={`${group.unitName} - Model ${model.id}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
