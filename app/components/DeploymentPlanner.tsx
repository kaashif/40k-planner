'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { SpawnedGroup, SelectedModel } from '../types';
import { deleteSelectedOperation } from '../utils/selectionOperations';
import { checkCoherency, findNearestModels, checkParentUnitCoherency } from '../utils/coherencyChecker';
import LosRenderer from './LosRenderer';

interface Layout {
  id: string;
  title: string;
  image: string;
  overlay?: string;
}

interface ArmyUnit {
  name: string;
  parentUnitName?: string;
  stats?: {
    M: string;
    T: string;
    SV: string;
    W: string;
    LD: string;
    OC: string;
  };
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
  allUnitIds: string[];
  reserveUnits: Set<string>;
  armyUnits: ArmyUnit[];
  auras: { [unitName: string]: number };
  currentTurn: string;
  onTurnChange: (turn: string) => void;
  onResetToDeployment: () => void;
}

const layouts: Layout[] = [
  { id: 'terraform', title: 'Round 1: Terraform', image: '/round1_terraform.png', overlay: '/round1_terraform_overlay.png' },
  { id: 'purge', title: 'Round 2: Purge the Foe', image: '/round2_purge.png', overlay: '/round2_purge_overlay.png' },
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
  onRoundChange,
  allUnitIds,
  reserveUnits,
  armyUnits,
  auras,
  currentTurn,
  onTurnChange,
  onResetToDeployment
}: DeploymentPlannerProps) {
  const [selectedLayout, setSelectedLayout] = useState(layouts[0]);
  const [toolMode, setToolMode] = useState<'selection' | 'ruler'>('selection');
  const [rulerPoints, setRulerPoints] = useState<{ x: number; y: number }[]>([]);
  const [showDeepStrikeZones, setShowDeepStrikeZones] = useState(false);
  const [showMovement, setShowMovement] = useState(false);
  const [showLos, setShowLos] = useState(false);
  const [showAuras, setShowAuras] = useState(false);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  const [draggedModel, setDraggedModel] = useState<{ groupId: string; modelId: string | null } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartPosMm, setDragStartPosMm] = useState<{ x: number; y: number } | null>(null);
  const [movementZonePositions, setMovementZonePositions] = useState<Map<string, { x: number; y: number }> | null>(null);
  const [scale, setScale] = useState(1); // pixels per mm
  const [mouseDownTime, setMouseDownTime] = useState<number | null>(null);
  const [mouseDownPos, setMouseDownPos] = useState<{ x: number; y: number } | null>(null);
  const [lastDragPos, setLastDragPos] = useState<{ x: number; y: number } | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [rotationCenter, setRotationCenter] = useState<{ x: number; y: number } | null>(null);
  const [lastRotationAngle, setLastRotationAngle] = useState<number>(0);
  const [currentRotationDelta, setCurrentRotationDelta] = useState<number>(0);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const justCompletedBoxSelection = useRef(false);
  const justCompletedModelInteraction = useRef(false);
  const imageRef = useRef<HTMLImageElement>(null);

  // Map dimensions in mm: 44" × 60" = 1117.6mm × 1524mm
  const MAP_HEIGHT_MM = 44 * 25.4; // 1117.6 mm
  const MAP_WIDTH_MM = 60 * 25.4; // 1524 mm

  // Check for overlapping bases - returns set of model keys that are overlapping
  const findOverlappingModels = (): Set<string> => {
    const overlapping = new Set<string>();

    // Collect all models with their absolute positions
    const allModels: Array<{
      key: string;
      centerX: number;
      centerY: number;
      radius: number;
      isRect: boolean;
      width: number;
      height: number;
    }> = [];

    spawnedGroups.forEach(group => {
      const baseSize = group.isRectangular
        ? Math.max(group.width || 25, group.length || 25)
        : (group.baseSize || 25);

      group.models.forEach(model => {
        const centerX = group.groupX + model.x + (group.isRectangular ? (group.width || 25) / 2 : baseSize / 2);
        const centerY = group.groupY + model.y + (group.isRectangular ? (group.length || 25) / 2 : baseSize / 2);

        allModels.push({
          key: `${group.unitId}-${model.id}`,
          centerX,
          centerY,
          radius: baseSize / 2,
          isRect: group.isRectangular || false,
          width: group.width || baseSize,
          height: group.length || baseSize
        });
      });
    });

    // Check each pair for overlap
    for (let i = 0; i < allModels.length; i++) {
      for (let j = i + 1; j < allModels.length; j++) {
        const a = allModels[i];
        const b = allModels[j];

        // Simple circle-circle overlap check (approximation for rectangular bases too)
        const dx = a.centerX - b.centerX;
        const dy = a.centerY - b.centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = a.radius + b.radius;

        // Allow tiny overlap (0.5mm) to account for floating point errors
        if (dist < minDist - 0.5) {
          overlapping.add(a.key);
          overlapping.add(b.key);
        }
      }
    }

    return overlapping;
  };

  const overlappingModels = findOverlappingModels();

  // Notify parent of initial round on mount
  useEffect(() => {
    onRoundChange(selectedLayout.id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Calculate scale and image offset when image loads or container resizes
  useEffect(() => {
    const updateScaleAndOffset = () => {
      if (!canvasRef.current) return;

      const container = canvasRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      // Calculate which dimension is the limiting factor (aspect ratio 60:44)
      const containerAspectRatio = containerWidth / containerHeight;
      const mapAspectRatio = MAP_WIDTH_MM / MAP_HEIGHT_MM;

      let newScale;
      let offsetX = 0;
      let offsetY = 0;

      if (containerAspectRatio > mapAspectRatio) {
        // Height is limiting factor - image fills height, centered horizontally
        newScale = containerHeight / MAP_HEIGHT_MM;
        const imageWidth = containerHeight * mapAspectRatio;
        offsetX = (containerWidth - imageWidth) / 2;
      } else {
        // Width is limiting factor - image fills width, centered vertically
        newScale = containerWidth / MAP_WIDTH_MM;
        const imageHeight = containerWidth / mapAspectRatio;
        offsetY = (containerHeight - imageHeight) / 2;
      }

      setScale(newScale);
      setImageOffset({ x: offsetX, y: offsetY });
      setCanvasDimensions({ width: containerWidth, height: containerHeight });
    };

    updateScaleAndOffset();
    window.addEventListener('resize', updateScaleAndOffset);
    return () => window.removeEventListener('resize', updateScaleAndOffset);
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

  // Handle rotation of selected models around group center
  const handleRotate = (degrees: number) => {
    // First, calculate the center of all selected models (in mm)
    let centerX = 0;
    let centerY = 0;
    let count = 0;

    selectedModels.forEach(sel => {
      const group = spawnedGroups.find(g => g.unitId === sel.groupId);
      if (!group) return;
      const model = group.models.find(m => m.id === sel.modelId);
      if (!model) return;

      const baseSize = group.isRectangular
        ? Math.max(group.width || 25, group.length || 25)
        : (group.baseSize || 25);

      // Absolute position of model center in mm
      centerX += group.groupX + model.x + baseSize / 2;
      centerY += group.groupY + model.y + baseSize / 2;
      count++;
    });

    if (count === 0) return;

    centerX /= count;
    centerY /= count;

    // Convert degrees to radians
    const radians = degrees * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    const updatedGroups = spawnedGroups.map(group => {
      // Check if any models in this group are selected
      const hasSelectedModels = selectedModels.some(sel => sel.groupId === group.unitId);
      if (!hasSelectedModels) return group;

      const baseSize = group.isRectangular
        ? Math.max(group.width || 25, group.length || 25)
        : (group.baseSize || 25);

      return {
        ...group,
        models: group.models.map(model => {
          const isSelected = selectedModels.some(
            sel => sel.groupId === group.unitId && sel.modelId === model.id
          );
          if (!isSelected) return model;

          // Get absolute model center position
          const modelCenterX = group.groupX + model.x + baseSize / 2;
          const modelCenterY = group.groupY + model.y + baseSize / 2;

          // Translate to origin (center of selection)
          const relX = modelCenterX - centerX;
          const relY = modelCenterY - centerY;

          // Rotate around origin
          const rotatedX = relX * cos - relY * sin;
          const rotatedY = relX * sin + relY * cos;

          // Translate back and convert to model position (top-left corner relative to group)
          const newModelCenterX = rotatedX + centerX;
          const newModelCenterY = rotatedY + centerY;
          const newX = newModelCenterX - baseSize / 2 - group.groupX;
          const newY = newModelCenterY - baseSize / 2 - group.groupY;

          const currentRotation = model.rotation || 0;
          return {
            ...model,
            x: newX,
            y: newY,
            rotation: (currentRotation + degrees + 360) % 360
          };
        })
      };
    });

    onUpdateGroups(updatedGroups);
  };

  // Arrange selected models in a horizontal line with 2" spacing
  const handleLineUp = () => {
    if (selectedModels.length === 0) return;

    const SPACING_MM = 2 * 25.4; // 2 inches in mm

    // Collect selected models with their current positions
    const modelsToArrange: Array<{
      groupId: string;
      modelId: string;
      baseWidth: number;
      baseHeight: number;
      currentCenterX: number;
      currentCenterY: number;
    }> = [];

    selectedModels.forEach(sel => {
      const group = spawnedGroups.find(g => g.unitId === sel.groupId);
      if (!group) return;
      const model = group.models.find(m => m.id === sel.modelId);
      if (!model) return;

      const baseWidth = group.isRectangular ? (group.width || 25) : (group.baseSize || 25);
      const baseHeight = group.isRectangular ? (group.length || 25) : (group.baseSize || 25);

      modelsToArrange.push({
        groupId: sel.groupId,
        modelId: sel.modelId,
        baseWidth,
        baseHeight,
        currentCenterX: group.groupX + model.x + baseWidth / 2,
        currentCenterY: group.groupY + model.y + baseHeight / 2
      });
    });

    if (modelsToArrange.length === 0) return;

    // Calculate current barycenter
    const currentBarycenter = {
      x: modelsToArrange.reduce((sum, m) => sum + m.currentCenterX, 0) / modelsToArrange.length,
      y: modelsToArrange.reduce((sum, m) => sum + m.currentCenterY, 0) / modelsToArrange.length
    };

    // Calculate total width of the line
    let totalWidth = 0;
    modelsToArrange.forEach((m, i) => {
      totalWidth += m.baseWidth;
      if (i < modelsToArrange.length - 1) {
        totalWidth += SPACING_MM;
      }
    });

    // Calculate new positions centered on barycenter
    let currentX = currentBarycenter.x - totalWidth / 2;

    // Create a map of new positions
    const newPositions = new Map<string, { x: number; y: number }>();
    modelsToArrange.forEach(m => {
      const newCenterX = currentX + m.baseWidth / 2;
      newPositions.set(`${m.groupId}-${m.modelId}`, {
        x: newCenterX,
        y: currentBarycenter.y
      });
      currentX += m.baseWidth + SPACING_MM;
    });

    const updatedGroups = spawnedGroups.map(group => {
      const modelsInGroup = modelsToArrange.filter(m => m.groupId === group.unitId);
      if (modelsInGroup.length === 0) return group;

      return {
        ...group,
        models: group.models.map(model => {
          const modelInfo = modelsInGroup.find(m => m.modelId === model.id);
          if (!modelInfo) return model;

          const newPos = newPositions.get(`${group.unitId}-${model.id}`);
          if (!newPos) return model;

          // Convert center position back to top-left relative to group
          const newX = newPos.x - modelInfo.baseWidth / 2 - group.groupX;
          const newY = newPos.y - modelInfo.baseHeight / 2 - group.groupY;

          return {
            ...model,
            x: newX,
            y: newY
          };
        })
      };
    });

    onUpdateGroups(updatedGroups);
  };

  // Start rotation drag
  const handleRotationMouseDown = (e: React.MouseEvent, centerX: number, centerY: number) => {
    e.stopPropagation();
    e.preventDefault();

    setIsRotating(true);
    setRotationCenter({ x: centerX, y: centerY });
    setCurrentRotationDelta(0); // Reset rotation delta

    // Calculate initial angle
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const angle = Math.atan2(mouseY - centerY, mouseX - centerX) * (180 / Math.PI);
    setLastRotationAngle(angle);

    // Mark that we're in rotation mode to prevent other interactions
    justCompletedModelInteraction.current = true;
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
        // groupX/Y are in mm, convert to pixels and add image offset
        const modelLeft = imageOffset.x + (group.groupX + model.x) * scale;
        const modelTop = imageOffset.y + (group.groupY + model.y) * scale;
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
    // Ruler mode - add measurement points
    if (toolMode === 'ruler') {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (rulerPoints.length === 0) {
        setRulerPoints([{ x, y }]);
      } else if (rulerPoints.length === 1) {
        setRulerPoints([rulerPoints[0], { x, y }]);
      } else {
        // Reset and start new measurement
        setRulerPoints([{ x, y }]);
      }
      return;
    }

    // Selection mode
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
    // Disable model interaction in ruler mode
    if (toolMode === 'ruler') return;

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
      // Dragging the whole group - groupX/Y are in mm, convert to pixels for offset
      setDragOffset({
        x: e.clientX - rect.left - imageOffset.x - group.groupX * scale,
        y: e.clientY - rect.top - imageOffset.y - group.groupY * scale
      });
    } else {
      // Dragging individual model - all positions in mm, convert to pixels
      const model = group.models.find(m => m.id === modelId);
      if (!model) return;
      setDragOffset({
        x: e.clientX - rect.left - imageOffset.x - (group.groupX + model.x) * scale,
        y: e.clientY - rect.top - imageOffset.y - (group.groupY + model.y) * scale
      });
      setLastDragPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });

      // Track start position in mm for movement ruler (center of base)
      const baseWidth = group.isRectangular ? (group.width || 25) : (group.baseSize || 25);
      const baseHeight = group.isRectangular ? (group.length || 25) : (group.baseSize || 25);
      setDragStartPosMm({
        x: group.groupX + model.x + baseWidth / 2,
        y: group.groupY + model.y + baseHeight / 2
      });

      // Capture positions of all selected models for movement zones
      const positions = new Map<string, { x: number; y: number }>();
      selectedModels.forEach(sel => {
        const selGroup = spawnedGroups.find(g => g.unitId === sel.groupId);
        if (!selGroup) return;
        const selModel = selGroup.models.find(m => m.id === sel.modelId);
        if (!selModel) return;

        const selBaseWidth = selGroup.isRectangular ? (selGroup.width || 25) : (selGroup.baseSize || 25);
        const selBaseHeight = selGroup.isRectangular ? (selGroup.length || 25) : (selGroup.baseSize || 25);

        positions.set(`${sel.groupId}-${sel.modelId}`, {
          x: selGroup.groupX + selModel.x + selBaseWidth / 2,
          y: selGroup.groupY + selModel.y + selBaseHeight / 2
        });
      });
      setMovementZonePositions(positions);
    }

    setDraggedModel({ groupId, modelId });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Handle rotation drag
    if (isRotating && rotationCenter && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Calculate current angle
      const currentAngle = Math.atan2(mouseY - rotationCenter.y, mouseX - rotationCenter.x) * (180 / Math.PI);

      // Calculate angle difference
      let angleDelta = currentAngle - lastRotationAngle;

      // Normalize angle delta to -180 to 180
      if (angleDelta > 180) angleDelta -= 360;
      if (angleDelta < -180) angleDelta += 360;

      // Apply rotation
      handleRotate(angleDelta);

      // Accumulate rotation delta for visual feedback
      setCurrentRotationDelta(prev => prev + angleDelta);

      // Update last angle
      setLastRotationAngle(currentAngle);
      return;
    }

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
    // x, y are pixel positions relative to canvas; subtract imageOffset for board-relative position
    const x = e.clientX - rect.left - dragOffset.x - imageOffset.x;
    const y = e.clientY - rect.top - dragOffset.y - imageOffset.y;

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
          // Move entire group - convert pixel position to mm
          return { ...group, groupX: x / scale, groupY: y / scale };
        } else {
          // Move individual model - convert pixel position to mm
          return {
            ...group,
            models: group.models.map(model =>
              model.id === draggedModel.modelId
                ? { ...model, x: x / scale - group.groupX, y: y / scale - group.groupY }
                : model
            )
          };
        }
      });

      onUpdateGroups(updatedGroups);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    // Handle rotation end
    if (isRotating) {
      setIsRotating(false);
      setRotationCenter(null);
      setLastRotationAngle(0);
      // Don't reset currentRotationDelta - let arrows stay in position
      // Keep selection after rotation
      setTimeout(() => {
        justCompletedModelInteraction.current = false;
      }, 0);
      return;
    }

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
    setDragStartPosMm(null);
    setMovementZonePositions(null);
    setMouseDownTime(null);
    setMouseDownPos(null);
    setLastDragPos(null);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setDraggedModel(null);
      setDragStartPosMm(null);
      setMovementZonePositions(null);
      setIsRotating(false);
      setRotationCenter(null);
      setLastRotationAngle(0);
      // Don't reset currentRotationDelta
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Update rotation delta when selection changes
  useEffect(() => {
    if (selectedModels.length === 0) {
      setCurrentRotationDelta(0);
    } else {
      // Calculate average rotation of selected models
      let totalRotation = 0;
      let count = 0;

      selectedModels.forEach(sel => {
        const group = spawnedGroups.find(g => g.unitId === sel.groupId);
        if (group) {
          const model = group.models.find(m => m.id === sel.modelId);
          if (model) {
            totalRotation += (model.rotation || 0);
            count++;
          }
        }
      });

      if (count > 0) {
        setCurrentRotationDelta(totalRotation / count);
      }
    }
  }, [selectedModels, spawnedGroups]);

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
    // Disable box selection in ruler mode
    if (toolMode === 'ruler') return;

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
      {/* Toolbar - always visible */}
      <div className="bg-[#1a1a1a] border border-[#1a2a1a] rounded-lg p-4 flex items-center gap-4">
        {/* Tool mode selector */}
        <div className="flex gap-2 mr-4 border-r border-[#2a2a2a] pr-4">
          <button
            onClick={() => {
              setToolMode('selection');
              setRulerPoints([]);
            }}
            className={`px-3 py-1 font-semibold rounded transition-colors ${
              toolMode === 'selection'
                ? 'bg-[#39FF14] text-black'
                : 'bg-[#0f4d0f] hover:bg-[#39FF14] hover:text-black text-white'
            }`}
          >
            Selection
          </button>
          <button
            onClick={() => {
              setToolMode('ruler');
            }}
            className={`px-3 py-1 font-semibold rounded transition-colors ${
              toolMode === 'ruler'
                ? 'bg-[#39FF14] text-black'
                : 'bg-[#0f4d0f] hover:bg-[#39FF14] hover:text-black text-white'
            }`}
          >
            Ruler
          </button>
        </div>

        {toolMode === 'selection' && (
          <>
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
            <button
              onClick={handleLineUp}
              disabled={selectedModels.length < 2}
              className={`px-3 py-1 font-semibold rounded transition-colors ${
                selectedModels.length >= 2
                  ? 'bg-blue-700 hover:bg-blue-600 text-white'
                  : 'bg-gray-600 text-gray-500 cursor-not-allowed'
              }`}
              title="Arrange selected models in a horizontal line with 2&quot; spacing"
            >
              Line Up
            </button>
          </>
        )}

        {toolMode === 'ruler' && (
          <>
            <span className="font-semibold text-gray-200">
              Click two points to measure distance
            </span>
            {rulerPoints.length > 0 && (
              <button
                onClick={() => setRulerPoints([])}
                className="px-3 py-1 font-semibold rounded transition-colors bg-[#0f4d0f] hover:bg-[#39FF14] hover:text-black text-white"
              >
                Clear Measurement
              </button>
            )}
          </>
        )}

        {/* View Toggles */}
        <div className="ml-auto flex items-center gap-2">
          {selectedLayout.overlay && (
            <button
              onClick={() => setShowLos(!showLos)}
              className={`px-3 py-1 font-semibold rounded transition-colors ${
                showLos
                  ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              {showLos ? '✓ ' : ''}Show LoS
            </button>
          )}
          <button
            onClick={() => setShowAuras(!showAuras)}
            className={`px-3 py-1 font-semibold rounded transition-colors ${
              showAuras
                ? 'bg-purple-600 hover:bg-purple-500 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            {showAuras ? '✓ ' : ''}Show Auras
          </button>
          <button
            onClick={() => setShowDeepStrikeZones(!showDeepStrikeZones)}
            className={`px-3 py-1 font-semibold rounded transition-colors ${
              showDeepStrikeZones
                ? 'bg-red-900 hover:bg-red-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            {showDeepStrikeZones ? '✓ ' : ''}Deep Strike Zones
          </button>
          <button
            onClick={() => setShowMovement(!showMovement)}
            className={`px-3 py-1 font-semibold rounded transition-colors ${
              showMovement
                ? 'bg-green-700 hover:bg-green-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            {showMovement ? '✓ ' : ''}Show Movement
          </button>
        </div>

        {/* Coherency status */}
        <div className="flex items-center gap-2">
          {spawnedGroups.length > 0 && (() => {
            // Group by parent unit to check coherency correctly
            const parentUnitMap = new Map<string | undefined, SpawnedGroup[]>();
            spawnedGroups.forEach(group => {
              const key = group.parentUnitId || group.unitId;
              if (!parentUnitMap.has(key)) {
                parentUnitMap.set(key, []);
              }
              parentUnitMap.get(key)!.push(group);
            });

            // Check coherency for each parent unit
            let outOfCoherencyCount = 0;
            parentUnitMap.forEach(groups => {
              const result = groups[0].parentUnitId
                ? checkParentUnitCoherency(groups)
                : checkCoherency(groups[0]);
              if (!result.isInCoherency) {
                outOfCoherencyCount++;
              }
            });

            // Only show if some units are out of coherency
            if (outOfCoherencyCount === 0) return null;

            return (
              <div className="px-4 py-2 font-bold rounded bg-red-900 text-red-200">
                {outOfCoherencyCount} unit{outOfCoherencyCount !== 1 ? 's' : ''} not coherent
              </div>
            );
          })()}

          {/* Overlap warning */}
          {overlappingModels.size > 0 && (
            <div className="px-4 py-2 font-bold rounded bg-orange-700 text-orange-100">
              {overlappingModels.size} base{overlappingModels.size !== 1 ? 's' : ''} overlapping
            </div>
          )}

          {/* Undeployed units warning */}
          {(() => {
            const spawnedUnitIds = new Set(spawnedGroups.map(g => g.unitId));
            const undeployedCount = allUnitIds.filter(
              id => !spawnedUnitIds.has(id) && !reserveUnits.has(id)
            ).length;

            if (undeployedCount === 0) return null;

            return (
              <div className="px-4 py-2 font-bold rounded bg-red-900 text-red-200">
                {undeployedCount} unit{undeployedCount !== 1 ? 's' : ''} not deployed
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

      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="block mb-2 font-semibold text-gray-200">
            Turn Planning
          </label>
          <select
            value={currentTurn}
            onChange={(e) => onTurnChange(e.target.value)}
            className="w-full p-3 bg-[#1a1a1a] border border-[#1a2a1a] rounded-lg text-gray-200 focus:outline-none focus:border-[#39FF14] cursor-pointer"
          >
            <option value="deployment">Deployment</option>
            <option value="turn1">Turn 1</option>
          </select>
        </div>
        {currentTurn !== 'deployment' && (
          <button
            onClick={onResetToDeployment}
            className="px-4 py-3 bg-orange-700 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors"
          >
            Reset to Deployment
          </button>
        )}
      </div>

      <div className="bg-[#1a1a1a] border border-[#1a2a1a] rounded-lg p-6">
        <h3 className="text-xl font-bold mb-4 text-[#39FF14] text-center">
          {selectedLayout.title}
        </h3>
        <div
          ref={canvasRef}
          className={`relative w-full h-[calc(100vh-400px)] select-none ${
            toolMode === 'ruler' ? 'cursor-crosshair' : 'cursor-crosshair'
          }`}
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

          {/* LoS Blockers Overlay */}
          {showLos && selectedLayout.overlay && (
            <Image
              src={selectedLayout.overlay}
              alt={`${selectedLayout.title} LoS Blockers`}
              fill
              className="object-contain pointer-events-none select-none"
              style={{ opacity: 0.5, zIndex: 4 }}
            />
          )}

          {/* LoS Visibility Renderer */}
          {showLos && selectedLayout.overlay && (
            <LosRenderer
              overlayUrl={selectedLayout.overlay}
              selectedModels={selectedModels.map(selected => {
                const group = spawnedGroups.find(g => g.unitId === selected.groupId);
                if (!group) return null;
                const model = group.models.find(m => m.id === selected.modelId);
                if (!model) return null;

                const baseSize = group.isRectangular
                  ? Math.max(group.width || 25, group.length || 25)
                  : (group.baseSize || 25);

                return {
                  centerX: imageOffset.x + (group.groupX + model.x + baseSize / 2) * scale,
                  centerY: imageOffset.y + (group.groupY + model.y + baseSize / 2) * scale,
                  baseRadius: (baseSize / 2) * scale
                };
              }).filter((p): p is { centerX: number; centerY: number; baseRadius: number } => p !== null)}
              width={canvasDimensions.width}
              height={canvasDimensions.height}
              enabled={showLos && selectedModels.length > 0}
              imageOffset={imageOffset}
              isDragging={draggedModel !== null || isRotating || isBoxSelecting}
            />
          )}

          {/* Render spawned models - bases first */}
          {spawnedGroups.map(group => {
            // Check coherency for this group (or parent unit if applicable)
            let coherencyResult;
            if (group.parentUnitId) {
              // Get all groups belonging to the same parent unit
              const parentUnitGroups = spawnedGroups.filter(g => g.parentUnitId === group.parentUnitId);
              coherencyResult = checkParentUnitCoherency(parentUnitGroups);
            } else {
              coherencyResult = checkCoherency(group);
            }

            return (
              <div key={group.unitId}>
                {/* Group background - for easier group dragging */}
                <div
                  onMouseDown={(e) => handleMouseDown(e, group.unitId, null)}
                  className="absolute cursor-move hover:opacity-80"
                  style={{
                    left: imageOffset.x + group.groupX * scale,
                    top: imageOffset.y + group.groupY * scale,
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
                  // For parent units, the ID is stored as "unitId-modelId"
                  const modelKey = group.parentUnitId ? `${group.unitId}-${model.id}` : model.id;
                  const isOutOfCoherency = coherencyResult.outOfCoherencyModels.has(modelKey);

                  // Check if this model is overlapping with another
                  const overlapKey = `${group.unitId}-${model.id}`;
                  const isOverlapping = overlappingModels.has(overlapKey);

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
                          : isOverlapping
                          ? 'border-2 border-orange-500 hover:border-[#FFFF00]'
                          : isOutOfCoherency
                          ? 'border-2 border-red-500 hover:border-[#FFFF00]'
                          : 'border-2 border-[#808080] hover:border-[#FFFF00]'
                      }`}
                      style={{
                        left: imageOffset.x + (group.groupX + model.x) * scale,
                        top: imageOffset.y + (group.groupY + model.y) * scale,
                        width: size.width,
                        height: size.height,
                        borderRadius: group.isRectangular ? '4px' : '50%',
                        backgroundColor: '#000000',
                        transform: model.rotation ? `rotate(${model.rotation}deg)` : undefined,
                        transformOrigin: 'center center',
                      }}
                      title={`${group.unitName} - Model ${model.id}${isOverlapping ? ' (Overlapping!)' : ''}${isOutOfCoherency ? ' (Out of Coherency)' : ''}`}
                    />
                  );
                })}
              </div>
            );
          })}

          {/* Render rotation controls for selected models */}
          {toolMode === 'selection' && selectedModels.length > 0 && (() => {
            // Calculate bounding box of all selected models
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

            selectedModels.forEach(selected => {
              const group = spawnedGroups.find(g => g.unitId === selected.groupId);
              if (!group) return;

              const model = group.models.find(m => m.id === selected.modelId);
              if (!model) return;

              const size = group.isRectangular
                ? {
                    width: (group.width || 25) * scale,
                    height: (group.length || 25) * scale
                  }
                : {
                    width: (group.baseSize || 25) * scale,
                    height: (group.baseSize || 25) * scale
                  };

              const modelLeft = imageOffset.x + (group.groupX + model.x) * scale;
              const modelTop = imageOffset.y + (group.groupY + model.y) * scale;
              const modelRight = modelLeft + size.width;
              const modelBottom = modelTop + size.height;

              minX = Math.min(minX, modelLeft);
              maxX = Math.max(maxX, modelRight);
              minY = Math.min(minY, modelTop);
              maxY = Math.max(maxY, modelBottom);
            });

            if (minX === Infinity) return null;

            // Center and radius of control circle
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            const width = maxX - minX;
            const height = maxY - minY;
            const radius = Math.max(width, height) / 2 + 30; // 30px padding around selection

            // Create SVG positioned absolutely to cover the canvas
            const arcLength = 20; // Length of the arc in degrees (shorter)

            // Helper to create arrow head pointing tangent to circle (clockwise)
            const createArrowHead = (angle: number) => {
              const endX = centerX + radius * Math.cos(angle * Math.PI/180);
              const endY = centerY + radius * Math.sin(angle * Math.PI/180);
              const tangentAngle = angle + 90; // Tangent direction (clockwise)
              const arrowSize = 16; // 2x bigger (was 8)

              // Create triangular arrow head
              const tip = { x: endX, y: endY };
              const base1X = endX - arrowSize * Math.cos(tangentAngle * Math.PI/180) - 8 * Math.cos((tangentAngle - 90) * Math.PI/180);
              const base1Y = endY - arrowSize * Math.sin(tangentAngle * Math.PI/180) - 8 * Math.sin((tangentAngle - 90) * Math.PI/180);
              const base2X = endX - arrowSize * Math.cos(tangentAngle * Math.PI/180) + 8 * Math.cos((tangentAngle - 90) * Math.PI/180);
              const base2Y = endY - arrowSize * Math.sin(tangentAngle * Math.PI/180) + 8 * Math.sin((tangentAngle - 90) * Math.PI/180);

              return `M ${tip.x} ${tip.y} L ${base1X} ${base1Y} L ${base2X} ${base2Y} Z`;
            };

            const angles = [0, 90, 180, 270];

            return (
              <>
                {/* SVG for drawing arrows (visual only) */}
                <svg
                  className="absolute pointer-events-none"
                  style={{
                    left: 0,
                    top: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 50
                  }}
                >
                  <g transform={`rotate(${currentRotationDelta} ${centerX} ${centerY})`}>
                    {angles.map(baseAngle => {
                      // Shorten the arc by 3 degrees at the end so it doesn't stick through the arrow head
                      const arcEndAngle = baseAngle + arcLength/2 - 3;

                      return (
                        <g key={baseAngle}>
                          {/* Arc path */}
                          <path
                            d={`M ${centerX + radius * Math.cos((baseAngle - arcLength/2) * Math.PI/180)} ${centerY + radius * Math.sin((baseAngle - arcLength/2) * Math.PI/180)} A ${radius} ${radius} 0 0 1 ${centerX + radius * Math.cos(arcEndAngle * Math.PI/180)} ${centerY + radius * Math.sin(arcEndAngle * Math.PI/180)}`}
                            fill="none"
                            stroke="#39FF14"
                            strokeWidth="6"
                            strokeLinecap="round"
                          />
                          {/* Arrow head */}
                          <path
                            d={createArrowHead(baseAngle + arcLength/2)}
                            fill="#39FF14"
                          />
                        </g>
                      );
                    })}
                  </g>
                </svg>

                {/* Invisible divs for drag handling */}
                {angles.map(baseAngle => {
                  // Apply rotation delta to the handle positions
                  const rotatedAngle = (baseAngle + currentRotationDelta) * Math.PI / 180;
                  const handleX = centerX + radius * Math.cos(rotatedAngle);
                  const handleY = centerY + radius * Math.sin(rotatedAngle);

                  return (
                    <div
                      key={`handle-${baseAngle}`}
                      className="absolute cursor-grab active:cursor-grabbing z-50"
                      style={{
                        left: handleX - 25,
                        top: handleY - 25,
                        width: 50,
                        height: 50,
                      }}
                      onMouseDown={(e) => handleRotationMouseDown(e, centerX, centerY)}
                      title="Drag to rotate"
                    />
                  );
                })}
              </>
            );
          })()}

          {/* Render measurement lines for selected models */}
          {selectedModels.map(selected => {
            const group = spawnedGroups.find(g => g.unitId === selected.groupId);
            if (!group) return null;

            const targetModel = group.models.find(m => m.id === selected.modelId);
            if (!targetModel) return null;

            // For parent units, find nearest models across all groups in the parent unit
            const groupsToSearch = group.parentUnitId
              ? spawnedGroups.filter(g => g.parentUnitId === group.parentUnitId)
              : undefined;

            const nearestModels = findNearestModels(targetModel, group, groupsToSearch);

            // Calculate model size in pixels
            const size = group.isRectangular
              ? {
                  width: (group.width || 25) * scale,
                  height: (group.length || 25) * scale
                }
              : {
                  width: (group.baseSize || 25) * scale,
                  height: (group.baseSize || 25) * scale
                };

            // Target model center - groupX/Y and model.x/y are in mm
            const targetCenterX = imageOffset.x + (group.groupX + targetModel.x) * scale + size.width / 2;
            const targetCenterY = imageOffset.y + (group.groupY + targetModel.y) * scale + size.height / 2;

            return nearestModels.map((nearest, idx) => {
              // Calculate nearest model's size
              const nearestSize = nearest.group.isRectangular
                ? {
                    width: (nearest.group.width || 25) * scale,
                    height: (nearest.group.length || 25) * scale
                  }
                : {
                    width: (nearest.group.baseSize || 25) * scale,
                    height: (nearest.group.baseSize || 25) * scale
                  };

              // Nearest model center (using its own group position) - positions in mm
              const nearestCenterX = imageOffset.x + (nearest.group.groupX + nearest.model.x) * scale + nearestSize.width / 2;
              const nearestCenterY = imageOffset.y + (nearest.group.groupY + nearest.model.y) * scale + nearestSize.height / 2;

              // Calculate angle between centers
              const dx = nearestCenterX - targetCenterX;
              const dy = nearestCenterY - targetCenterY;
              const angle = Math.atan2(dy, dx);

              // Calculate edge points based on base shape
              let targetEdgeX, targetEdgeY, nearestEdgeX, nearestEdgeY;

              // Target edge point
              if (group.isRectangular) {
                const halfSize = Math.max(size.width, size.height) / 2;
                targetEdgeX = targetCenterX + Math.cos(angle) * halfSize;
                targetEdgeY = targetCenterY + Math.sin(angle) * halfSize;
              } else {
                const radius = size.width / 2;
                targetEdgeX = targetCenterX + Math.cos(angle) * radius;
                targetEdgeY = targetCenterY + Math.sin(angle) * radius;
              }

              // Nearest edge point
              if (nearest.group.isRectangular) {
                const halfSize = Math.max(nearestSize.width, nearestSize.height) / 2;
                nearestEdgeX = nearestCenterX - Math.cos(angle) * halfSize;
                nearestEdgeY = nearestCenterY - Math.sin(angle) * halfSize;
              } else {
                const radius = nearestSize.width / 2;
                nearestEdgeX = nearestCenterX - Math.cos(angle) * radius;
                nearestEdgeY = nearestCenterY - Math.sin(angle) * radius;
              }

              // Line midpoint for label
              const midX = (targetEdgeX + nearestEdgeX) / 2;
              const midY = (targetEdgeY + nearestEdgeY) / 2;

              return (
                <React.Fragment key={`measurement-${selected.groupId}-${selected.modelId}-${idx}`}>
                  {/* Line */}
                  <svg
                    className="absolute pointer-events-none"
                    style={{
                      left: 0,
                      top: 0,
                      width: '100%',
                      height: '100%',
                      zIndex: 40
                    }}
                  >
                    <line
                      x1={targetEdgeX}
                      y1={targetEdgeY}
                      x2={nearestEdgeX}
                      y2={nearestEdgeY}
                      stroke="#ef4444"
                      strokeWidth="2"
                    />
                  </svg>

                  {/* Distance label */}
                  <div
                    className="absolute pointer-events-none text-xs font-bold"
                    style={{
                      left: midX,
                      top: midY,
                      transform: 'translate(-50%, -50%)',
                      color: '#ef4444',
                      textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
                      zIndex: 41
                    }}
                  >
                    {nearest.distanceInches.toFixed(2)}"
                  </div>
                </React.Fragment>
              );
            });
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
              const modelLeft = imageOffset.x + (group.groupX + model.x) * scale;
              const modelRight = modelLeft + size.width;
              const modelBottom = imageOffset.y + (group.groupY + model.y) * scale + size.height;

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

          {/* Ruler measurement visual */}
          {toolMode === 'ruler' && rulerPoints.length > 0 && (
            <>
              {/* First point marker */}
              <div
                className="absolute w-3 h-3 bg-[#39FF14] rounded-full border-2 border-black pointer-events-none z-50"
                style={{
                  left: rulerPoints[0].x - 6,
                  top: rulerPoints[0].y - 6,
                }}
              />

              {/* Line and second point if we have 2 points */}
              {rulerPoints.length === 2 && (() => {
                const dx = rulerPoints[1].x - rulerPoints[0].x;
                const dy = rulerPoints[1].y - rulerPoints[0].y;
                const distancePixels = Math.sqrt(dx * dx + dy * dy);
                const distanceMm = distancePixels / scale;
                const distanceInches = Math.ceil(distanceMm / 25.4 * 100) / 100;

                const midX = (rulerPoints[0].x + rulerPoints[1].x) / 2;
                const midY = (rulerPoints[0].y + rulerPoints[1].y) / 2;

                return (
                  <>
                    {/* Line */}
                    <svg
                      className="absolute pointer-events-none"
                      style={{
                        left: 0,
                        top: 0,
                        width: '100%',
                        height: '100%',
                        zIndex: 40
                      }}
                    >
                      <line
                        x1={rulerPoints[0].x}
                        y1={rulerPoints[0].y}
                        x2={rulerPoints[1].x}
                        y2={rulerPoints[1].y}
                        stroke="#39FF14"
                        strokeWidth="3"
                      />
                    </svg>

                    {/* Second point marker */}
                    <div
                      className="absolute w-3 h-3 bg-[#39FF14] rounded-full border-2 border-black pointer-events-none z-50"
                      style={{
                        left: rulerPoints[1].x - 6,
                        top: rulerPoints[1].y - 6,
                      }}
                    />

                    {/* Distance label */}
                    <div
                      className="absolute pointer-events-none text-sm font-bold"
                      style={{
                        left: midX,
                        top: midY,
                        transform: 'translate(-50%, -50%)',
                        color: '#39FF14',
                        textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
                        zIndex: 50
                      }}
                    >
                      {distanceInches.toFixed(2)}"
                    </div>
                  </>
                );
              })()}
            </>
          )}

          {/* Live Movement Ruler - shows distance while dragging */}
          {draggedModel && draggedModel.modelId && dragStartPosMm && (() => {
            const group = spawnedGroups.find(g => g.unitId === draggedModel.groupId);
            if (!group) return null;

            const model = group.models.find(m => m.id === draggedModel.modelId);
            if (!model) return null;

            const baseWidth = group.isRectangular ? (group.width || 25) : (group.baseSize || 25);
            const baseHeight = group.isRectangular ? (group.length || 25) : (group.baseSize || 25);

            // Current position in mm (center of base)
            const currentX = group.groupX + model.x + baseWidth / 2;
            const currentY = group.groupY + model.y + baseHeight / 2;

            // Calculate distance in mm then convert to inches
            const dx = currentX - dragStartPosMm.x;
            const dy = currentY - dragStartPosMm.y;
            const distanceMm = Math.sqrt(dx * dx + dy * dy);
            const distanceInches = distanceMm / 25.4;

            // Convert to pixels for rendering
            const startPixelX = imageOffset.x + dragStartPosMm.x * scale;
            const startPixelY = imageOffset.y + dragStartPosMm.y * scale;
            const currentPixelX = imageOffset.x + currentX * scale;
            const currentPixelY = imageOffset.y + currentY * scale;

            // Midpoint for label
            const midX = (startPixelX + currentPixelX) / 2;
            const midY = (startPixelY + currentPixelY) / 2;

            if (distanceMm < 1) return null; // Don't show for tiny movements

            return (
              <svg
                className="absolute pointer-events-none"
                style={{
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 100
                }}
              >
                {/* Line from start to current */}
                <line
                  x1={startPixelX}
                  y1={startPixelY}
                  x2={currentPixelX}
                  y2={currentPixelY}
                  stroke="#39FF14"
                  strokeWidth="3"
                  strokeDasharray="8,4"
                />
                {/* Start point marker */}
                <circle
                  cx={startPixelX}
                  cy={startPixelY}
                  r="6"
                  fill="#39FF14"
                  stroke="black"
                  strokeWidth="2"
                />
                {/* Distance label */}
                <text
                  x={midX}
                  y={midY - 8}
                  textAnchor="middle"
                  fill="#39FF14"
                  fontSize="11"
                  fontWeight="bold"
                  stroke="black"
                  strokeWidth="3"
                  paintOrder="stroke"
                >
                  {distanceInches.toFixed(1)}&quot;
                </text>
              </svg>
            );
          })()}

          {/* Movement Zones - green for normal move, blue for advance */}
          {showMovement && selectedModels.length > 0 && (() => {
            const movementZones: Array<{
              centerX: number;
              centerY: number;
              moveDistance: number; // in pixels
              advanceDistance: number; // in pixels (move + 6")
            }> = [];

            selectedModels.forEach(selected => {
              const group = spawnedGroups.find(g => g.unitId === selected.groupId);
              if (!group) return;

              const model = group.models.find(m => m.id === selected.modelId);
              if (!model) return;

              // Find the army unit stats for this model
              const armyUnit = armyUnits.find(u =>
                u.name === group.unitName ||
                u.parentUnitName === group.unitName ||
                group.unitName.includes(u.name)
              );

              // Parse movement stat (e.g., "6\"" or "10\"")
              let moveInches = 6; // default
              if (armyUnit?.stats?.M) {
                const match = armyUnit.stats.M.match(/(\d+)/);
                if (match) {
                  moveInches = parseInt(match[1], 10);
                }
              }

              const baseWidth = group.isRectangular ? (group.width || 25) : (group.baseSize || 25);
              const baseHeight = group.isRectangular ? (group.length || 25) : (group.baseSize || 25);

              // Use cached position if dragging, otherwise use current position
              const modelKey = `${selected.groupId}-${selected.modelId}`;
              const cachedPos = movementZonePositions?.get(modelKey);

              let centerX: number;
              let centerY: number;

              if (cachedPos && draggedModel) {
                // Use cached position during drag
                centerX = imageOffset.x + cachedPos.x * scale;
                centerY = imageOffset.y + cachedPos.y * scale;
              } else {
                // Use current position
                centerX = imageOffset.x + (group.groupX + model.x + baseWidth / 2) * scale;
                centerY = imageOffset.y + (group.groupY + model.y + baseHeight / 2) * scale;
              }

              // Convert inches to mm then to pixels
              const moveDistanceMm = moveInches * 25.4;
              const advanceDistanceMm = (moveInches + 6) * 25.4;

              movementZones.push({
                centerX,
                centerY,
                moveDistance: moveDistanceMm * scale,
                advanceDistance: advanceDistanceMm * scale
              });
            });

            if (movementZones.length === 0) return null;

            return (
              <svg
                className="absolute pointer-events-none"
                style={{
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 8,
                  opacity: 0.3
                }}
              >
                <g>
                  {/* Draw advance zones (blue) first - larger */}
                  {movementZones.map((zone, idx) => (
                    <circle
                      key={`advance-${idx}`}
                      cx={zone.centerX}
                      cy={zone.centerY}
                      r={zone.advanceDistance}
                      fill="blue"
                      stroke="darkblue"
                      strokeWidth="2"
                    />
                  ))}
                  {/* Draw movement zones (green) on top - smaller */}
                  {movementZones.map((zone, idx) => (
                    <circle
                      key={`move-${idx}`}
                      cx={zone.centerX}
                      cy={zone.centerY}
                      r={zone.moveDistance}
                      fill="green"
                      stroke="darkgreen"
                      strokeWidth="2"
                    />
                  ))}
                </g>
              </svg>
            );
          })()}

          {/* Aura Zones */}
          {showAuras && (() => {
            const auraZones: Array<{
              centerX: number;
              centerY: number;
              radius: number; // in pixels
            }> = [];

            spawnedGroups.forEach(group => {
              // Get the aura distance for this unit (in inches)
              const auraInches = auras[group.unitName] || 0;
              if (auraInches <= 0) return;

              const auraDistanceMm = auraInches * 25.4;

              group.models.forEach(model => {
                if (group.isRectangular) {
                  // For rectangular bases, use the larger dimension as the "radius"
                  const baseWidthMm = group.width || 25;
                  const baseLengthMm = group.length || 25;
                  const baseWidthPixels = baseWidthMm * scale;
                  const baseLengthPixels = baseLengthMm * scale;
                  const baseRadius = Math.max(baseWidthMm, baseLengthMm) / 2;

                  const centerX = imageOffset.x + (group.groupX + model.x) * scale + baseWidthPixels / 2;
                  const centerY = imageOffset.y + (group.groupY + model.y) * scale + baseLengthPixels / 2;

                  auraZones.push({
                    centerX,
                    centerY,
                    radius: (baseRadius + auraDistanceMm) * scale
                  });
                } else {
                  const baseDiameterMm = group.baseSize || 25;
                  const baseDiameterPixels = baseDiameterMm * scale;
                  const baseRadiusMm = baseDiameterMm / 2;

                  const centerX = imageOffset.x + (group.groupX + model.x) * scale + baseDiameterPixels / 2;
                  const centerY = imageOffset.y + (group.groupY + model.y) * scale + baseDiameterPixels / 2;

                  auraZones.push({
                    centerX,
                    centerY,
                    radius: (baseRadiusMm + auraDistanceMm) * scale
                  });
                }
              });
            });

            if (auraZones.length === 0) return null;

            return (
              <svg
                className="absolute pointer-events-none"
                style={{
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 7,
                  opacity: 0.3
                }}
              >
                <g>
                  {auraZones.map((zone, idx) => (
                    <circle
                      key={`aura-${idx}`}
                      cx={zone.centerX}
                      cy={zone.centerY}
                      r={zone.radius}
                      fill="purple"
                      stroke="darkmagenta"
                      strokeWidth="2"
                    />
                  ))}
                </g>
              </svg>
            );
          })()}

          {/* Deep Strike View - 9-inch exclusion zones */}
          {showDeepStrikeZones && (() => {
            // Collect all model positions and create a unified exclusion zone
            const exclusionZones: Array<{
              type: 'circle' | 'rect';
              centerX: number;
              centerY: number;
              radius?: number;
              width?: number;
              height?: number;
              rotation?: number;
            }> = [];

            spawnedGroups.forEach(group => {
              group.models.forEach(model => {
                // 9 inches = 228.6mm
                const exclusionDistanceMm = 9 * 25.4; // 228.6mm
                const exclusionDistancePixels = exclusionDistanceMm * scale;

                if (group.isRectangular) {
                  // Rectangular base - create rounded rectangle zone
                  const baseWidthMm = group.width || 25;
                  const baseLengthMm = group.length || 25;
                  const baseWidthPixels = baseWidthMm * scale;
                  const baseLengthPixels = baseLengthMm * scale;

                  // Zone dimensions = base + 2 * 9 inches (on all sides)
                  const zoneWidth = baseWidthPixels + 2 * exclusionDistancePixels;
                  const zoneHeight = baseLengthPixels + 2 * exclusionDistancePixels;

                  // Center of the base - positions in mm
                  const centerX = imageOffset.x + (group.groupX + model.x) * scale + baseWidthPixels / 2;
                  const centerY = imageOffset.y + (group.groupY + model.y) * scale + baseLengthPixels / 2;

                  exclusionZones.push({
                    type: 'rect',
                    centerX,
                    centerY,
                    width: zoneWidth,
                    height: zoneHeight,
                    rotation: model.rotation || 0
                  });
                } else {
                  // Circular base - create circular zone
                  const baseDiameterMm = group.baseSize || 25;
                  const baseDiameterPixels = baseDiameterMm * scale;
                  const baseRadiusMm = baseDiameterMm / 2;

                  // Zone radius = base radius + 9 inches
                  const zoneRadiusMm = baseRadiusMm + exclusionDistanceMm;
                  const zoneRadiusPixels = zoneRadiusMm * scale;

                  // Center of the base - positions in mm
                  const centerX = imageOffset.x + (group.groupX + model.x) * scale + baseDiameterPixels / 2;
                  const centerY = imageOffset.y + (group.groupY + model.y) * scale + baseDiameterPixels / 2;

                  exclusionZones.push({
                    type: 'circle',
                    centerX,
                    centerY,
                    radius: zoneRadiusPixels
                  });
                }
              });
            });

            return (
              <svg
                className="absolute pointer-events-none"
                style={{
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 10,
                  opacity: 0.2
                }}
              >
                <g>
                  {exclusionZones.map((zone, idx) => {
                    if (zone.type === 'circle') {
                      return (
                        <circle
                          key={`exclusion-${idx}`}
                          cx={zone.centerX}
                          cy={zone.centerY}
                          r={zone.radius}
                          fill="red"
                          stroke="darkred"
                          strokeWidth="3"
                        />
                      );
                    } else {
                      // Rounded rectangle
                      const cornerRadius = 9 * 25.4 * scale; // 9 inches in pixels
                      return (
                        <rect
                          key={`exclusion-${idx}`}
                          x={zone.centerX! - zone.width! / 2}
                          y={zone.centerY! - zone.height! / 2}
                          width={zone.width}
                          height={zone.height}
                          rx={cornerRadius}
                          ry={cornerRadius}
                          fill="red"
                          stroke="darkred"
                          strokeWidth="3"
                          transform={zone.rotation ? `rotate(${zone.rotation} ${zone.centerX} ${zone.centerY})` : undefined}
                        />
                      );
                    }
                  })}
                </g>
              </svg>
            );
          })()}
        </div>
      </div>

    </div>
  );
}
