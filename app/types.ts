// Centralized type definitions for the 40k Tournament Planner

export interface Model {
  id: string;
  x: number;
  y: number;
}

export interface SpawnedGroup {
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

export interface SelectedModel {
  groupId: string;
  modelId: string;
}

export interface SpawnedUnit {
  unitId: string;
  unitName: string;
  isRectangular: boolean;
  baseSize?: number;
  width?: number;
  length?: number;
  modelCount: number;
}
