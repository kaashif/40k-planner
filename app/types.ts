// Centralized type definitions for the 40k Tournament Planner

export interface Model {
  id: string;
  x: number; // in mm (relative to group origin)
  y: number; // in mm (relative to group origin)
  rotation?: number; // Rotation in degrees (0-360)
}

export interface SpawnedGroup {
  unitId: string;
  unitName: string;
  parentUnitId?: string; // ID of parent unit for multi-model units like "The Silent King"
  parentUnitName?: string; // Name of parent unit
  isRectangular: boolean;
  baseSize?: number; // in mm
  width?: number; // in mm
  length?: number; // in mm
  models: Model[];
  groupX: number; // in mm (relative to board origin)
  groupY: number; // in mm (relative to board origin)
}

export interface SelectedModel {
  groupId: string;
  modelId: string;
}

export interface SpawnedUnit {
  unitId: string;
  unitName: string;
  parentUnitId?: string;
  parentUnitName?: string;
  isRectangular: boolean;
  baseSize?: number;
  width?: number;
  length?: number;
  modelCount: number;
}
