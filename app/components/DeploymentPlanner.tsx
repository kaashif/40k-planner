'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { SpawnedGroup, SelectedModel } from '../types';
import { deleteSelectedOperation } from '../utils/selectionOperations';
import { checkCoherency } from '../utils/coherencyChecker';

interface Layout {
  id: string;
  title: string;
  image: string;
}

interface DeploymentPlannerProps {
  spawnedGroups: SpawnedGroup[];
  onUpdateGroups: (groups: SpawnedGroup[]) => void;
  selectedModels: SelectedModel[];
  onSelectionChange: (models: SelectedModel[]) => void;
  isBoxSelecting: boolean;
  setIsBoxSelecting: (selecting: boolean) => void;
  boxSelectStart: { x: number; y: number } | null;
  setBoxSelectStart: (pos: { x: number; y: number } | null) => void;
  boxSelectEnd: { x: number; y: number } | null;
  setBoxSelectEnd: (pos: { x: number; y: number } | null) => void;
  onRoundChange: (roundId: string) => void;
}

const layouts: Layout[] = [
  { id: 'terraform', title: 'Round 1: Terraform', image: '/round1_terraform.png' },
  { id: 'purge', title: 'Round 2: Purge the Foe', image: '/round2_purge.png' },
  { id: 'supplies', title: 'Round 3: Hidden Supplies', image: '/round3_hidden_supplies.png' },
  { id: 'linchpin', title: 'Round 4: Linchpin', image: '/round4_linchpin.png' },
  { id: 'take', title: 'Round 5: Take and Hold', image: '/round5_take.png' },
];

export default function DeploymentPlanner({
  spawnedGroups,
  onUpdateGroups,
  selectedModels,
  onSelectionChange,
  isBoxSelecting,
  setIsBoxSelecting,
  boxSelectStart,
  setBoxSelectStart,
  boxSelectEnd,
  setBoxSelectEnd,
  onRoundChange
}: DeploymentPlannerProps) {
  const [selectedLayout, setSelectedLayout] = useState(layouts[0]);
  const [draggedModel, setDraggedModel] = useState<{ groupId: string; modelId: string | null } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1); // pixels per mm
  const [mouseDownTime, setMouseDownTime] = useState<number | null>(null);
  const [mouseDownPos, setMouseDownPos] = useState<{ x: number; y: number } | null>(null);
  const [lastDragPos, setLastDragPos] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const justCompletedBoxSelection = useRef(false);
  const justCompletedModelInteraction = useRef(false);
  const imageRef = useRef<HTMLImageElement>(null);

  // Map dimensions in mm: 44" × 60" = 1117.6mm × 1524mm
  const MAP_HEIGHT_MM = 44 * 25.4; // 1117.6 mm
  const MAP_WIDTH_MM = 60 * 25.4; // 1524 mm

  // Notify parent of initial round on mount
  useEffect(() => {
    onRoundChange(selectedLayout.id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Handle model click for selection
  const handleModelClick = (e: React.MouseEvent, groupId: string, modelId: string) => {
    e.stopPropagation();

    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const clickedSelection = { groupId, modelId };
    const isAlreadySelected = selectedModels.some(
      sel => sel.groupId === groupId && sel.modelId === modelId
    );

    if (isCtrlOrCmd) {
      // Toggle selection
      if (isAlreadySelected) {
        onSelectionChange(selectedModels.filter(
          sel => !(sel.groupId === groupId && sel.modelId === modelId)
        ));
      } else {
        onSelectionChange([...selectedModels, clickedSelection]);
      }
    } else {
      // Replace selection
      onSelectionChange([clickedSelection]);
    }
  };

  // Calculate box intersection with models
  const calculateBoxIntersections = (
    start: { x: number; y: number } | null,
    end: { x: number; y: number } | null
  ): SelectedModel[] => {
    if (!start || !end) return [];

    const boxLeft = Math.min(start.x, end.x);
    const boxRight = Math.max(start.x, end.x);
    const boxTop = Math.min(start.y, end.y);
    const boxBottom = Math.max(start.y, end.y);

    const selections: SelectedModel[] = [];

    spawnedGroups.forEach(group => {
      group.models.forEach(model => {
        const modelLeft = group.groupX + (model.x * scale);
        const modelTop = group.groupY + (model.y * scale);
        const modelSize = group.isRectangular
          ? { width: (group.width || 25) * scale, height: (group.length || 25) * scale }
          : { width: (group.baseSize || 25) * scale, height: (group.baseSize || 25) * scale };
        const modelRight = modelLeft + modelSize.width;
        const modelBottom = modelTop + modelSize.height;

        // Check if box intersects with model bounds
        if (!(modelRight < boxLeft || modelLeft > boxRight ||
              modelBottom < boxTop || modelTop > boxBottom)) {
          selections.push({ groupId: group.unitId, modelId: model.id });
        }
      });
    });

    return selections;
  };

  // Handle canvas click to deselect (but not during box selection)
  const handleCanvasClick = (e: React.MouseEvent) => {
    // Don't deselect if we just finished a box selection
    if (justCompletedBoxSelection.current) {
      justCompletedBoxSelection.current = false;
      return;
    }

    // Don't deselect if we just finished interacting with a model
    if (justCompletedModelInteraction.current) {
      justCompletedModelInteraction.current = false;
      return;
    }

    if (!isBoxSelecting && !draggedModel) {
      onSelectionChange([]);
    }
  };

  const handleMouseDown = (e: React.MouseEvent, groupId: string, modelId: string | null) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Track time and position for click vs drag detection
    setMouseDownTime(Date.now());
    setMouseDownPos({ x: e.clientX, y: e.clientY });

    const group = spawnedGroups.find(g => g.unitId === groupId);
    if (!group) return;

    // Auto-select model if clicking on non-selected model
    if (modelId !== null) {
      const isSelected = selectedModels.some(
        sel => sel.groupId === groupId && sel.modelId === modelId
      );

      if (!isSelected && !e.ctrlKey && !e.metaKey) {
        onSelectionChange([{ groupId, modelId }]);
      }
    }

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
      setLastDragPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }

    setDraggedModel({ groupId, modelId });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Handle box selection
    if (isBoxSelecting && boxSelectStart && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setBoxSelectEnd({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      return;
    }

    if (!draggedModel || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffset.x;
    const y = e.clientY - rect.top - dragOffset.y;

    // Check if dragging a selected model with other models selected
    const isDraggingSelected = draggedModel.modelId !== null && selectedModels.some(
      sel => sel.groupId === draggedModel.groupId && sel.modelId === draggedModel.modelId
    );

    if (isDraggingSelected && selectedModels.length > 1 && lastDragPos) {
      // Multi-model drag: move all selected models together
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      const deltaX = (currentX - lastDragPos.x) / scale;
      const deltaY = (currentY - lastDragPos.y) / scale;

      const updatedGroups = spawnedGroups.map(group => ({
        ...group,
        models: group.models.map(model => {
          const isSelected = selectedModels.some(
            sel => sel.groupId === group.unitId && sel.modelId === model.id
          );
          return isSelected
            ? { ...model, x: model.x + deltaX, y: model.y + deltaY }
            : model;
        })
      }));

      onUpdateGroups(updatedGroups);
      setLastDragPos({ x: currentX, y: currentY });
    } else {
      // Single model/group drag
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
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    // Handle box selection end
    if (isBoxSelecting) {
      const selections = calculateBoxIntersections(boxSelectStart, boxSelectEnd);
      onSelectionChange(selections);
      setIsBoxSelecting(false);
      setBoxSelectStart(null);
      setBoxSelectEnd(null);
      justCompletedBoxSelection.current = true;
      return;
    }

    // Check if this was a click (not a drag)
    let wasClick = false;
    if (mouseDownPos && draggedModel && draggedModel.modelId !== null) {
      const dx = e.clientX - mouseDownPos.x;
      const dy = e.clientY - mouseDownPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const timeSinceDown = mouseDownTime ? Date.now() - mouseDownTime : Infinity;

      // Only treat as click if: quick (< 150ms) AND minimal movement (< 5px)
      if (timeSinceDown < 150 && distance < 5) {
        wasClick = true;
        // This was a click, not a drag - handle selection
        handleModelClick(e, draggedModel.groupId, draggedModel.modelId);
      }
    }

    // Mark that we just finished a model interaction (click or drag)
    if (draggedModel) {
      justCompletedModelInteraction.current = true;
    }

    // If we dragged (not clicked), keep the selection as-is
    setDraggedModel(null);
    setMouseDownTime(null);
    setMouseDownPos(null);
    setLastDragPos(null);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setDraggedModel(null);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSelectionChange([]);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        const allModels = spawnedGroups.flatMap(group =>
          group.models.map(model => ({ groupId: group.unitId, modelId: model.id }))
        );
        onSelectionChange(allModels);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedModels.length > 0) {
        e.preventDefault();
        if (deleteSelectedOperation.canExecute(selectedModels)) {
          const updatedGroups = deleteSelectedOperation.execute(spawnedGroups, selectedModels);
          onUpdateGroups(updatedGroups);
          onSelectionChange([]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedModels, spawnedGroups, onSelectionChange, onUpdateGroups]);

  // Handle canvas mousedown for box selection
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Allow box selection on canvas or image (but not on models - they stop propagation)
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsBoxSelecting(true);
    setBoxSelectStart({ x, y });
    setBoxSelectEnd({ x, y });
  };

  return (
    <div className="space-y-4">
      {/* Selection toolbar - always visible */}
      <div className="bg-[#1a1a1a] border border-[#1a2a1a] rounded-lg p-4 flex items-center gap-4">
        <span className={`font-semibold ${selectedModels.length > 0 ? 'text-gray-200' : 'text-gray-500'}`}>
          {selectedModels.length > 0
            ? `${selectedModels.length} model${selectedModels.length !== 1 ? 's' : ''} selected`
            : 'No models selected'
          }
        </span>
        {selectedModels.length > 0 && (
          <span className="text-sm text-gray-400">
            from {new Set(selectedModels.map(s => s.groupId)).size} unit(s)
          </span>
        )}
        <button
          onClick={() => onSelectionChange([])}
          disabled={selectedModels.length === 0}
          className={`px-3 py-1 font-semibold rounded transition-colors ${
            selectedModels.length > 0
              ? 'bg-[#0f4d0f] hover:bg-[#39FF14] hover:text-black text-white'
              : 'bg-gray-600 text-gray-500 cursor-not-allowed'
          }`}
        >
          Clear Selection
        </button>
        <button
          onClick={() => {
            if (deleteSelectedOperation.canExecute(selectedModels)) {
              const updatedGroups = deleteSelectedOperation.execute(spawnedGroups, selectedModels);
              onUpdateGroups(updatedGroups);
              onSelectionChange([]);
            }
          }}
          disabled={selectedModels.length === 0}
          className={`px-3 py-1 font-semibold rounded transition-colors ${
            selectedModels.length > 0
              ? 'bg-red-900 hover:bg-red-700 text-white'
              : 'bg-gray-600 text-gray-500 cursor-not-allowed'
          }`}
        >
          Delete Selected
        </button>

        {/* Coherency status */}
        <div className="ml-auto flex items-center gap-2">
          {spawnedGroups.length > 0 && (() => {
            const coherencyResults = spawnedGroups.map(group => ({
              group,
              result: checkCoherency(group)
            }));

            const outOfCoherencyCount = coherencyResults.filter(r => !r.result.isInCoherency).length;

            // Only show if some units are out of coherency
            if (outOfCoherencyCount === 0) return null;

            return (
              <div className="px-4 py-2 font-bold rounded bg-red-900 text-red-200">
                {outOfCoherencyCount} unit{outOfCoherencyCount !== 1 ? 's' : ''} not coherent
              </div>
            );
          })()}
        </div>
      </div>

      <div>
        <label className="block mb-2 font-semibold text-gray-200">
          Select Mission Layout
        </label>
        <select
          value={selectedLayout.id}
          onChange={(e) => {
            const layout = layouts.find(l => l.id === e.target.value);
            if (layout) {
              setSelectedLayout(layout);
              onRoundChange(layout.id);
            }
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
          className="relative w-full h-[calc(100vh-400px)] cursor-crosshair select-none"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseDown={handleCanvasMouseDown}
          onClick={handleCanvasClick}
        >
          <Image
            src={selectedLayout.image}
            alt={selectedLayout.title}
            fill
            className="object-contain pointer-events-none select-none"
            priority
          />

          {/* Render spawned models - bases first */}
          {spawnedGroups.map(group => {
            // Check coherency for this group
            const coherencyResult = checkCoherency(group);

            return (
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

                {/* Individual model bases */}
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

                  // Check if this model is selected
                  const isSelected = selectedModels.some(
                    sel => sel.groupId === group.unitId && sel.modelId === model.id
                  );

                  // Check if this model is out of coherency
                  const isOutOfCoherency = coherencyResult.outOfCoherencyModels.has(model.id);

                  return (
                    <div
                      key={model.id}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleMouseDown(e, group.unitId, model.id);
                      }}
                      className={`absolute cursor-move transition-colors ${
                        isSelected
                          ? 'border-[3px] border-[#FFFF00]'
                          : isOutOfCoherency
                          ? 'border-2 border-red-500 hover:border-[#FFFF00]'
                          : 'border-2 border-[#808080] hover:border-[#FFFF00]'
                      }`}
                      style={{
                        left: group.groupX + (model.x * scale),
                        top: group.groupY + (model.y * scale),
                        width: size.width,
                        height: size.height,
                        borderRadius: group.isRectangular ? '4px' : '50%',
                        backgroundColor: '#000000',
                      }}
                      title={`${group.unitName} - Model ${model.id}${isOutOfCoherency ? ' (Out of Coherency)' : ''}`}
                    />
                  );
                })}
              </div>
            );
          })}

          {/* Render model labels on top - one per unit at center-bottom */}
          {spawnedGroups.map(group => {
            if (group.models.length === 0) return null;

            // Calculate bounding box of all models in this group
            const size = group.isRectangular
              ? {
                  width: (group.width || 25) * scale,
                  height: (group.length || 25) * scale
                }
              : {
                  width: (group.baseSize || 25) * scale,
                  height: (group.baseSize || 25) * scale
                };

            let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
            group.models.forEach(model => {
              const modelLeft = group.groupX + (model.x * scale);
              const modelRight = modelLeft + size.width;
              const modelBottom = group.groupY + (model.y * scale) + size.height;

              minX = Math.min(minX, modelLeft);
              maxX = Math.max(maxX, modelRight);
              maxY = Math.max(maxY, modelBottom);
            });

            // Center horizontally, bottom of lowest model
            const centerX = (minX + maxX) / 2;
            const bottomY = maxY + 2;

            return (
              <div
                key={`label-${group.unitId}`}
                className="absolute pointer-events-none text-xs font-semibold whitespace-nowrap"
                style={{
                  left: centerX,
                  top: bottomY,
                  transform: 'translateX(-50%)',
                  color: '#ffffff',
                  textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
                }}
              >
                {group.unitName}
              </div>
            );
          })}

          {/* Box selection visual */}
          {isBoxSelecting && boxSelectStart && boxSelectEnd && (
            <div
              className="absolute border-2 border-dashed border-[#FFFF00] pointer-events-none z-50"
              style={{
                left: Math.min(boxSelectStart.x, boxSelectEnd.x),
                top: Math.min(boxSelectStart.y, boxSelectEnd.y),
                width: Math.abs(boxSelectEnd.x - boxSelectStart.x),
                height: Math.abs(boxSelectEnd.y - boxSelectStart.y),
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
