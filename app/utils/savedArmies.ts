export interface SavedArmyEntry {
  name: string;
  points: number;
  keywords: string[];
}

export interface SavedArmyList {
  id: string;
  listName: string;
  faction: string;
  factionName: string;
  entries: SavedArmyEntry[];
  totalPoints: number;
  savedAt: string;
}

const STORAGE_KEY = 'savedArmyLists';

export function loadSavedLists(): SavedArmyList[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLists(lists: SavedArmyList[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
}

export function addList(list: Omit<SavedArmyList, 'id' | 'savedAt'>): SavedArmyList {
  const lists = loadSavedLists();
  const newList: SavedArmyList = {
    ...list,
    id: `list-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    savedAt: new Date().toISOString(),
  };
  lists.push(newList);
  saveLists(lists);
  return newList;
}

export function deleteList(id: string) {
  const lists = loadSavedLists().filter(l => l.id !== id);
  saveLists(lists);
}

export function exportListAsJson(list: SavedArmyList): string {
  return JSON.stringify(list, null, 2);
}

export function downloadJson(list: SavedArmyList) {
  const json = exportListAsJson(list);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${list.listName.replace(/[^a-z0-9]/gi, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importListFromJson(json: string): SavedArmyList | null {
  try {
    const data = JSON.parse(json);
    if (!data.listName || !data.entries || !Array.isArray(data.entries)) return null;
    return addList({
      listName: data.listName,
      faction: data.faction || '',
      factionName: data.factionName || '',
      entries: data.entries,
      totalPoints: data.totalPoints || data.entries.reduce((s: number, e: SavedArmyEntry) => s + e.points, 0),
    });
  } catch {
    return null;
  }
}
