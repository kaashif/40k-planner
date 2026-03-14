'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  SavedArmyList,
  loadSavedLists,
  addList,
  deleteList,
  downloadJson,
  importListFromJson,
} from '../utils/savedArmies';

interface Faction {
  slug: string;
  name: string;
}

interface Unit {
  name: string;
  points: number;
  keywords: string[];
}

interface CatalogueData {
  name: string;
  library: boolean;
  unitCount: number;
  units: Unit[];
}

interface ArmyEntry {
  id: string;
  name: string;
  points: number;
  keywords: string[];
}

interface SavedWorkingArmy {
  faction: string;
  factionName: string;
  entries: ArmyEntry[];
}

const POINTS_LIMIT = 2000;
const STORAGE_KEY = 'armyBuilder';

export default function ArmyBuilder() {
  const [factions, setFactions] = useState<Faction[]>([]);
  const [selectedFaction, setSelectedFaction] = useState<string>('');
  const [catalogue, setCatalogue] = useState<CatalogueData | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [hideLegends, setHideLegends] = useState(true);
  const [army, setArmy] = useState<ArmyEntry[]>([]);
  const [factionName, setFactionName] = useState('');
  const [savedLists, setSavedLists] = useState<SavedArmyList[]>([]);
  const [saveNameInput, setSaveNameInput] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  // Load saved lists
  useEffect(() => {
    setSavedLists(loadSavedLists());
  }, []);

  // Load working army from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data: SavedWorkingArmy = JSON.parse(saved);
        setArmy(data.entries);
        setSelectedFaction(data.faction);
        setFactionName(data.factionName);
        if (data.faction) {
          loadCatalogue(data.faction);
        }
      }
    } catch (e) {
      console.error('Error loading army from localStorage:', e);
    }
  }, []);

  const saveWorkingArmy = useCallback((entries: ArmyEntry[], faction: string, name: string) => {
    try {
      const data: SavedWorkingArmy = { faction, factionName: name, entries };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Error saving army:', e);
    }
  }, []);

  useEffect(() => {
    fetch('/api/datasheets')
      .then(r => r.json())
      .then(setFactions)
      .catch(console.error);
  }, []);

  const loadCatalogue = async (slug: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/datasheets/${slug}`);
      const data = await r.json();
      setCatalogue(data);
      return data.name;
    } catch (err) {
      console.error(err);
      setCatalogue(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFactionChange = async (slug: string) => {
    setSelectedFaction(slug);
    setSearch('');
    if (!slug) {
      setCatalogue(null);
      setArmy([]);
      setFactionName('');
      saveWorkingArmy([], '', '');
      return;
    }
    const name = await loadCatalogue(slug);
    setArmy([]);
    setFactionName(name || slug);
    saveWorkingArmy([], slug, name || slug);
  };

  const totalPoints = army.reduce((sum, e) => sum + e.points, 0);

  const addUnit = (unit: Unit) => {
    const entry: ArmyEntry = {
      id: `${unit.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: unit.name,
      points: unit.points,
      keywords: unit.keywords,
    };
    const newArmy = [...army, entry];
    setArmy(newArmy);
    saveWorkingArmy(newArmy, selectedFaction, factionName);
  };

  const removeUnit = (id: string) => {
    const newArmy = army.filter(e => e.id !== id);
    setArmy(newArmy);
    saveWorkingArmy(newArmy, selectedFaction, factionName);
  };

  const clearArmy = () => {
    setArmy([]);
    saveWorkingArmy([], selectedFaction, factionName);
  };

  const handleSaveList = () => {
    if (!saveNameInput.trim() || army.length === 0) return;
    addList({
      listName: saveNameInput.trim(),
      faction: selectedFaction,
      factionName,
      entries: army.map(e => ({ name: e.name, points: e.points, keywords: e.keywords })),
      totalPoints,
    });
    setSavedLists(loadSavedLists());
    setSaveNameInput('');
    setShowSaveInput(false);
  };

  const handleDeleteList = (id: string) => {
    deleteList(id);
    setSavedLists(loadSavedLists());
  };

  const handleLoadList = async (list: SavedArmyList) => {
    if (list.faction && list.faction !== selectedFaction) {
      setSelectedFaction(list.faction);
      setFactionName(list.factionName);
      await loadCatalogue(list.faction);
    }
    const loaded: ArmyEntry[] = list.entries.map(e => ({
      ...e,
      id: `${e.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    }));
    setArmy(loaded);
    saveWorkingArmy(loaded, list.faction, list.factionName);
  };

  const handleImportJson = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const imported = importListFromJson(text);
      if (imported) {
        setSavedLists(loadSavedLists());
      } else {
        alert('Invalid army list file.');
      }
    };
    input.click();
  };

  const availableUnits = catalogue?.units.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) &&
    (!hideLegends || !u.name.includes('[Legends]')) &&
    u.points > 0
  ) || [];

  const armyGroups = army.reduce<{ name: string; points: number; keywords: string[]; ids: string[] }[]>((groups, entry) => {
    const existing = groups.find(g => g.name === entry.name);
    if (existing) {
      existing.ids.push(entry.id);
    } else {
      groups.push({ name: entry.name, points: entry.points, keywords: entry.keywords, ids: [entry.id] });
    }
    return groups;
  }, []);

  const pointsColor = totalPoints > POINTS_LIMIT ? 'text-red-400' : totalPoints === POINTS_LIMIT ? 'text-green-400' : 'text-[#C5A33E]';

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-[#C5A33E]">Army Builder</h2>

      <div className="flex gap-4 items-center flex-wrap">
        <select
          value={selectedFaction}
          onChange={e => handleFactionChange(e.target.value)}
          className="px-3 py-2 bg-[#14142a] text-gray-200 border border-[#1a1a2e] rounded-lg focus:border-[#C5A33E] focus:outline-none"
        >
          <option value="">Select a faction...</option>
          {factions.map(f => (
            <option key={f.slug} value={f.slug}>{f.name}</option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={hideLegends}
            onChange={e => setHideLegends(e.target.checked)}
            className="accent-[#C5A33E]"
          />
          Hide Legends
        </label>
      </div>

      {loading && (
        <div className="text-gray-400 py-8 text-center">Loading catalogue...</div>
      )}

      <div className="flex gap-6">
        {/* Left: Available units */}
        {!loading && catalogue && (
          <div className="flex-1 min-w-0">
            <div className="mb-3">
              <input
                type="text"
                placeholder="Search units..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full px-3 py-2 bg-[#14142a] text-gray-200 border border-[#1a1a2e] rounded-lg focus:border-[#C5A33E] focus:outline-none"
              />
            </div>
            <div className="text-sm text-gray-400 mb-2">{availableUnits.length} units available</div>
            <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1">
              {availableUnits.map(unit => (
                <button
                  key={unit.name}
                  onClick={() => addUnit(unit)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-[#14142a] hover:bg-[#1e1e3a] border border-[#1a1a2e] rounded transition-colors text-left"
                >
                  <span className="text-gray-200 text-sm">{unit.name}</span>
                  <span className="text-[#C5A33E] text-sm font-semibold ml-2 whitespace-nowrap">{unit.points}pts</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!selectedFaction && !loading && (
          <div className="flex-1 bg-[#14142a] border border-[#1a1a2e] rounded-lg p-8 text-center self-start">
            <p className="text-gray-400">Select a faction to start building your army.</p>
          </div>
        )}

        {/* Center: Current army */}
        <div className="w-80 flex-shrink-0">
          <div className="sticky top-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-[#C5A33E]">Your Army</h3>
              <div className="flex gap-1">
                {army.length > 0 && (
                  <>
                    <button
                      onClick={() => { setShowSaveInput(true); setSaveNameInput(''); }}
                      className="px-2 py-1 text-xs bg-[#4a3a0f] hover:bg-[#C5A33E] hover:text-black text-[#C5A33E] rounded transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={clearArmy}
                      className="px-2 py-1 text-xs bg-red-900 hover:bg-red-700 text-white rounded transition-colors"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Save name input */}
            {showSaveInput && (
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="List name..."
                  value={saveNameInput}
                  onChange={e => setSaveNameInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveList()}
                  autoFocus
                  className="flex-1 px-2 py-1 text-sm bg-[#14142a] text-gray-200 border border-[#1a1a2e] rounded focus:border-[#C5A33E] focus:outline-none"
                />
                <button
                  onClick={handleSaveList}
                  className="px-2 py-1 text-xs bg-[#4a3a0f] hover:bg-[#C5A33E] hover:text-black text-[#C5A33E] rounded transition-colors"
                >
                  OK
                </button>
                <button
                  onClick={() => setShowSaveInput(false)}
                  className="px-2 py-1 text-xs bg-[#14142a] text-gray-400 rounded hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Points bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className={`font-bold ${pointsColor}`}>{totalPoints} / {POINTS_LIMIT} pts</span>
                <span className="text-gray-400">{army.length} unit{army.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="w-full h-3 bg-[#14142a] rounded-full border border-[#1a1a2e] overflow-hidden">
                <div
                  className={`h-full transition-all rounded-full ${
                    totalPoints > POINTS_LIMIT ? 'bg-red-500' : totalPoints === POINTS_LIMIT ? 'bg-green-500' : 'bg-[#C5A33E]'
                  }`}
                  style={{ width: `${Math.min((totalPoints / POINTS_LIMIT) * 100, 100)}%` }}
                />
              </div>
            </div>

            {army.length === 0 ? (
              <div className="text-gray-500 text-sm text-center py-4">
                Click units on the left to add them.
              </div>
            ) : (
              <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
                {armyGroups.map(group => (
                  <div
                    key={group.name}
                    className="flex items-center justify-between px-3 py-2 bg-[#14142a] border border-[#1a1a2e] rounded"
                  >
                    <div className="min-w-0">
                      <span className="text-gray-200 text-sm">
                        {group.ids.length > 1 && (
                          <span className="text-[#C5A33E] font-bold mr-1">{group.ids.length}x</span>
                        )}
                        {group.name}
                      </span>
                      <span className="text-gray-500 text-xs ml-2">{group.points * group.ids.length}pts</span>
                    </div>
                    <div className="flex gap-1 ml-2 flex-shrink-0">
                      <button
                        onClick={() => addUnit({ name: group.name, points: group.points, keywords: group.keywords })}
                        className="px-1.5 py-0.5 text-xs bg-[#4a3a0f] hover:bg-[#C5A33E] hover:text-black text-[#C5A33E] rounded transition-colors"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeUnit(group.ids[group.ids.length - 1])}
                        className="px-1.5 py-0.5 text-xs bg-red-900/50 hover:bg-red-700 text-red-300 rounded transition-colors"
                      >
                        -
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: My Lists */}
        <div className="w-72 flex-shrink-0">
          <div className="sticky top-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-[#C5A33E]">My Lists</h3>
              <button
                onClick={handleImportJson}
                className="px-2 py-1 text-xs bg-[#4a3a0f] hover:bg-[#C5A33E] hover:text-black text-[#C5A33E] rounded transition-colors"
              >
                Import JSON
              </button>
            </div>

            {savedLists.length === 0 ? (
              <div className="text-gray-500 text-sm text-center py-4">
                No saved lists yet. Build an army and click Save.
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {savedLists.map(list => (
                  <div
                    key={list.id}
                    className="px-3 py-2 bg-[#14142a] border border-[#1a1a2e] rounded"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-200 text-sm font-semibold">{list.listName}</span>
                      <span className="text-[#C5A33E] text-xs font-semibold">{list.totalPoints}pts</span>
                    </div>
                    <div className="text-gray-500 text-xs mb-2">{list.factionName}</div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleLoadList(list)}
                        className="px-2 py-0.5 text-xs bg-[#4a3a0f] hover:bg-[#C5A33E] hover:text-black text-[#C5A33E] rounded transition-colors"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => downloadJson(list)}
                        className="px-2 py-0.5 text-xs bg-[#4a3a0f] hover:bg-[#C5A33E] hover:text-black text-[#C5A33E] rounded transition-colors"
                      >
                        Export
                      </button>
                      <button
                        onClick={() => handleDeleteList(list.id)}
                        className="px-2 py-0.5 text-xs bg-red-900/50 hover:bg-red-700 text-red-300 rounded transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
