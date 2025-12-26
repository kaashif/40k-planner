// Centralized type definitions for the 40k Tournament Planner

export interface Model {
  id: string;
  x: number;
  y: number;
}

export interface SpawnedGroup {
  unitId: string;
  unitName: string;
  parentUnitId?: string; // ID of parent unit for multi-model units like "The Silent King"
  parentUnitName?: string; // Name of parent unit
  isRectangular: boolean;
  baseSize?: number;
  width?: number;
  length?: number;
  models: Model[];
  groupX: number;
  groupY: number;
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
