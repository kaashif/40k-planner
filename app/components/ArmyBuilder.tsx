'use client';

import { useState, useEffect, useCallback } from 'react';

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

interface SavedArmy {
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

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data: SavedArmy = JSON.parse(saved);
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

  // Save to localStorage whenever army or faction changes
  const saveArmy = useCallback((entries: ArmyEntry[], faction: string, name: string) => {
    try {
      const data: SavedArmy = { faction, factionName: name, entries };
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
      saveArmy([], '', '');
      return;
    }
    const name = await loadCatalogue(slug);
    // Clear army when switching factions
    setArmy([]);
    setFactionName(name || slug);
    saveArmy([], slug, name || slug);
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
    saveArmy(newArmy, selectedFaction, factionName);
  };

  const removeUnit = (id: string) => {
    const newArmy = army.filter(e => e.id !== id);
    setArmy(newArmy);
    saveArmy(newArmy, selectedFaction, factionName);
  };

  const clearArmy = () => {
    setArmy([]);
    saveArmy([], selectedFaction, factionName);
  };

  const availableUnits = catalogue?.units.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) &&
    (!hideLegends || !u.name.includes('[Legends]')) &&
    u.points > 0
  ) || [];

  // Group army entries by name for display
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

      {!loading && catalogue && (
        <div className="flex gap-6">
          {/* Left: Available units */}
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

          {/* Right: Current army */}
          <div className="w-80 flex-shrink-0">
            <div className="sticky top-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-[#C5A33E]">Your Army</h3>
                {army.length > 0 && (
                  <button
                    onClick={clearArmy}
                    className="px-2 py-1 text-xs bg-red-900 hover:bg-red-700 text-white rounded transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

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
                        {group.ids.length > 1 && (
                          <button
                            onClick={() => addUnit({ name: group.name, points: group.points, keywords: group.keywords })}
                            className="px-1.5 py-0.5 text-xs bg-[#4a3a0f] hover:bg-[#C5A33E] hover:text-black text-[#C5A33E] rounded transition-colors"
                          >
                            +
                          </button>
                        )}
                        {group.ids.length === 1 && (
                          <button
                            onClick={() => addUnit({ name: group.name, points: group.points, keywords: group.keywords })}
                            className="px-1.5 py-0.5 text-xs bg-[#4a3a0f] hover:bg-[#C5A33E] hover:text-black text-[#C5A33E] rounded transition-colors"
                          >
                            +
                          </button>
                        )}
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
        </div>
      )}

      {!selectedFaction && !loading && (
        <div className="bg-[#14142a] border border-[#1a1a2e] rounded-lg p-8 text-center">
          <p className="text-gray-400">Select a faction to start building your army.</p>
        </div>
      )}
    </div>
  );
}
