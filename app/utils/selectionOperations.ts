import { SpawnedGroup, SelectedModel } from '../types';

export interface SelectionOperation {
  name: string;
  execute: (groups: SpawnedGroup[], selected: SelectedModel[]) => SpawnedGroup[];
  canExecute: (selected: SelectedModel[]) => boolean;
}

export const deleteSelectedOperation: SelectionOperation = {
  name: 'Delete Selected',
  execute: (groups, selected) => {
    return groups.map(group => ({
      ...group,
      models: group.models.filter(model =>
        !selected.some(sel => sel.groupId === group.unitId && sel.modelId === model.id)
      )
    })).filter(group => group.models.length > 0); // Remove empty groups
  },
  canExecute: (selected) => selected.length > 0
};
