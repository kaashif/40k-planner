'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  calculateResults,
  parseKeywords,
  parseStatValue,
  AttackerInput,
  DefenderInput,
  ModifierToggles,
  CombatResult,
} from '../utils/combatSimulator';

interface Faction {
  slug: string;
  name: string;
}

interface UnitStats {
  name: string;
  M: string;
  T: string;
  SV: string;
  W: string;
  LD: string;
  OC: string;
}

interface Weapon {
  name: string;
  range: string;
  A: string;
  BS?: string;
  WS?: string;
  S: string;
  AP: string;
  D: string;
  keywords: string;
}

interface Unit {
  name: string;
  points: number;
  keywords: string[];
  stats: UnitStats[];
  rangedWeapons: Weapon[];
  meleeWeapons: Weapon[];
}

interface CatalogueData {
  name: string;
  units: Unit[];
}

const selectClass = "px-3 py-2 bg-[#0a0a14] text-gray-200 border-2 border-[#3a3a5e] rounded-lg focus:border-[#C5A33E] focus:outline-none w-full";
const inputClass = "px-3 py-2 bg-[#0a0a14] text-gray-200 border-2 border-[#3a3a5e] rounded-lg focus:border-[#C5A33E] focus:outline-none w-20 text-center";
const labelClass = "text-sm text-gray-300";

export default function FightSimulator() {
  const [factions, setFactions] = useState<Faction[]>([]);

  // Attacker state
  const [attackerFaction, setAttackerFaction] = useState('chaos-thousand-sons');
  const [attackerCatalogue, setAttackerCatalogue] = useState<CatalogueData | null>(null);
  const [attackerUnit, setAttackerUnit] = useState('');
  const [attackerWeapon, setAttackerWeapon] = useState('');
  const [attackerModels, setAttackerModels] = useState(1);
  const [combatMode, setCombatMode] = useState<'shooting' | 'melee'>('shooting');

  // Defender state
  const [defenderFaction, setDefenderFaction] = useState('chaos-thousand-sons');
  const [defenderCatalogue, setDefenderCatalogue] = useState<CatalogueData | null>(null);
  const [defenderUnit, setDefenderUnit] = useState('');
  const [defenderModels, setDefenderModels] = useState(1);
  const [defenderInvuln, setDefenderInvuln] = useState('');
  const [defenderFnp, setDefenderFnp] = useState('');

  // Modifier toggles
  const [stationary, setStationary] = useState(false);
  const [charged, setCharged] = useState(false);
  const [halfRange, setHalfRange] = useState(false);
  const [cover, setCover] = useState(false);
  const [rapidFire, setRapidFire] = useState(false);

  // Loading states
  const [loadingAttacker, setLoadingAttacker] = useState(false);
  const [loadingDefender, setLoadingDefender] = useState(false);

  // Fetch attacker catalogue
  const fetchAttacker = useCallback(async (faction: string) => {
    if (!faction) { setAttackerCatalogue(null); return; }
    setLoadingAttacker(true);
    setAttackerUnit('');
    setAttackerWeapon('');
    try {
      const r = await fetch(`/api/datasheets/${faction}`);
      const data = await r.json();
      setAttackerCatalogue(data);
    } catch {
      setAttackerCatalogue(null);
    } finally {
      setLoadingAttacker(false);
    }
  }, []);

  // Fetch defender catalogue
  const fetchDefender = useCallback(async (faction: string) => {
    if (!faction) { setDefenderCatalogue(null); return; }
    setLoadingDefender(true);
    setDefenderUnit('');
    try {
      const r = await fetch(`/api/datasheets/${faction}`);
      const data = await r.json();
      setDefenderCatalogue(data);
    } catch {
      setDefenderCatalogue(null);
    } finally {
      setLoadingDefender(false);
    }
  }, []);

  // Fetch faction list and initial catalogues
  useEffect(() => {
    fetch('/api/datasheets')
      .then(r => r.json())
      .then(setFactions)
      .catch(console.error);
    fetchAttacker('chaos-thousand-sons');
    fetchDefender('chaos-thousand-sons');
  }, [fetchAttacker, fetchDefender]);

  // Resolve selected units
  const selectedAttackerUnit = useMemo(
    () => attackerCatalogue?.units.find(u => u.name === attackerUnit) ?? null,
    [attackerCatalogue, attackerUnit]
  );

  const selectedDefenderUnit = useMemo(
    () => defenderCatalogue?.units.find(u => u.name === defenderUnit) ?? null,
    [defenderCatalogue, defenderUnit]
  );

  // Get available weapons based on combat mode
  const availableWeapons = useMemo(() => {
    if (!selectedAttackerUnit) return [];
    return combatMode === 'shooting'
      ? selectedAttackerUnit.rangedWeapons
      : selectedAttackerUnit.meleeWeapons;
  }, [selectedAttackerUnit, combatMode]);

  const selectedWeapon = useMemo(
    () => availableWeapons.find(w => w.name === attackerWeapon) ?? null,
    [availableWeapons, attackerWeapon]
  );

  // Compute results
  const result: CombatResult | null = useMemo(() => {
    if (!selectedWeapon || !selectedDefenderUnit) return null;

    const defStats = selectedDefenderUnit.stats[0];
    if (!defStats) return null;

    const skill = parseStatValue(combatMode === 'shooting' ? (selectedWeapon.BS || '4+') : (selectedWeapon.WS || '4+'));
    const weaponKeywords = parseKeywords(selectedWeapon.keywords);

    const attacker: AttackerInput = {
      attacks: selectedWeapon.A,
      skill,
      strength: parseStatValue(selectedWeapon.S),
      ap: Math.abs(parseStatValue(selectedWeapon.AP)),
      damage: selectedWeapon.D,
      keywords: weaponKeywords,
      modelCount: attackerModels,
    };

    const defender: DefenderInput = {
      toughness: parseStatValue(defStats.T),
      save: parseStatValue(defStats.SV),
      invuln: defenderInvuln ? parseInt(defenderInvuln) : null,
      wounds: parseStatValue(defStats.W),
      modelCount: defenderModels,
      fnp: defenderFnp ? parseInt(defenderFnp) : null,
      keywords: selectedDefenderUnit.keywords,
    };

    const modifiers: ModifierToggles = {
      stationary,
      charged,
      halfRange,
      cover,
      rapidFire,
    };

    return calculateResults(attacker, defender, modifiers);
  }, [selectedWeapon, selectedDefenderUnit, attackerModels, defenderModels,
      defenderInvuln, defenderFnp, stationary, charged, halfRange, cover,
      rapidFire, combatMode]);

  // Check which modifier toggles are relevant
  const weaponKeywords = selectedWeapon ? parseKeywords(selectedWeapon.keywords) : [];
  const showHeavy = weaponKeywords.some(k => k.toLowerCase() === 'heavy');
  const showLance = weaponKeywords.some(k => k.toLowerCase() === 'lance');
  const showMelta = weaponKeywords.some(k => k.toLowerCase().startsWith('melta'));
  const showRapidFire = weaponKeywords.some(k => k.toLowerCase().startsWith('rapid fire'));

  const attackerUnits = attackerCatalogue?.units.filter(u => !u.name.includes('[Legends]')) ?? [];
  const defenderUnits = defenderCatalogue?.units.filter(u => !u.name.includes('[Legends]')) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#C5A33E]">Fight Simulator</h2>
        <div className="flex bg-[#14142a] rounded-lg border border-[#1a1a2e] overflow-hidden">
          <button
            onClick={() => setCombatMode('shooting')}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${
              combatMode === 'shooting'
                ? 'bg-[#4a3a0f] text-[#C5A33E]'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Shooting
          </button>
          <button
            onClick={() => setCombatMode('melee')}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${
              combatMode === 'melee'
                ? 'bg-[#4a3a0f] text-[#C5A33E]'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Melee
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attacker Panel */}
        <div className="bg-[#14142a] border border-[#1a1a2e] rounded-lg p-4 space-y-3">
          <h3 className="text-lg font-bold text-red-400">Attacker</h3>

          <div className="space-y-2">
            <label className={labelClass}>Faction</label>
            <select value={attackerFaction} onChange={e => { setAttackerFaction(e.target.value); fetchAttacker(e.target.value); }} className={selectClass}>
              <option value="">Select faction...</option>
              {factions.map(f => <option key={f.slug} value={f.slug}>{f.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className={labelClass}>Unit</label>
            <Combobox
              options={attackerUnits.map(u => ({ value: u.name, label: u.name }))}
              value={attackerUnit}
              onChange={v => { setAttackerUnit(v); setAttackerWeapon(''); }}
              placeholder={loadingAttacker ? 'Loading...' : 'Type to search units...'}
              disabled={loadingAttacker || !attackerCatalogue}
            />
          </div>

          <div className="space-y-2">
            <label className={labelClass}>Weapon</label>
            <Combobox
              options={availableWeapons.map(w => ({
                value: w.name,
                label: w.name,
                detail: `A:${w.A} S:${w.S} AP:${w.AP} D:${w.D}`,
              }))}
              value={attackerWeapon}
              onChange={setAttackerWeapon}
              placeholder={
                !selectedAttackerUnit ? 'Select a unit first...' :
                availableWeapons.length === 0 ? `No ${combatMode} weapons` :
                'Type to search weapons...'
              }
              disabled={!selectedAttackerUnit || availableWeapons.length === 0}
            />
          </div>

          {selectedWeapon && (
            <div className="bg-[#0a0a14] rounded p-3 space-y-1">
              <div className="text-sm font-semibold text-gray-200">{selectedWeapon.name}</div>
              <div className="flex gap-4 text-xs text-gray-400">
                <span>A: {selectedWeapon.A}</span>
                <span>{combatMode === 'shooting' ? 'BS' : 'WS'}: {combatMode === 'shooting' ? selectedWeapon.BS : selectedWeapon.WS}</span>
                <span>S: {selectedWeapon.S}</span>
                <span>AP: {selectedWeapon.AP}</span>
                <span>D: {selectedWeapon.D}</span>
              </div>
              {selectedWeapon.keywords && selectedWeapon.keywords !== '-' && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {parseKeywords(selectedWeapon.keywords).map(kw => (
                    <span key={kw} className="px-1.5 py-0.5 text-xs bg-[#4a3a0f] text-[#C5A33E] rounded">{kw}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <label className={labelClass}>Number of models shooting</label>
            <input
              type="number"
              min={1}
              max={30}
              value={attackerModels}
              onChange={e => setAttackerModels(Math.max(1, parseInt(e.target.value) || 1))}
              className={inputClass}
            />
          </div>
        </div>

        {/* Defender Panel */}
        <div className="bg-[#14142a] border border-[#1a1a2e] rounded-lg p-4 space-y-3">
          <h3 className="text-lg font-bold text-blue-400">Defender</h3>

          <div className="space-y-2">
            <label className={labelClass}>Faction</label>
            <select value={defenderFaction} onChange={e => { setDefenderFaction(e.target.value); fetchDefender(e.target.value); }} className={selectClass}>
              <option value="">Select faction...</option>
              {factions.map(f => <option key={f.slug} value={f.slug}>{f.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className={labelClass}>Unit</label>
            <Combobox
              options={defenderUnits.map(u => ({ value: u.name, label: u.name }))}
              value={defenderUnit}
              onChange={setDefenderUnit}
              placeholder={loadingDefender ? 'Loading...' : 'Type to search units...'}
              disabled={loadingDefender || !defenderCatalogue}
            />
          </div>

          {selectedDefenderUnit && selectedDefenderUnit.stats[0] && (
            <div className="bg-[#0a0a14] rounded p-3 space-y-1">
              <div className="text-sm font-semibold text-gray-200">{selectedDefenderUnit.stats[0].name}</div>
              <div className="flex gap-4 text-xs text-gray-400">
                <span>T: {selectedDefenderUnit.stats[0].T}</span>
                <span>SV: {selectedDefenderUnit.stats[0].SV}</span>
                <span>W: {selectedDefenderUnit.stats[0].W}</span>
              </div>
              {selectedDefenderUnit.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedDefenderUnit.keywords.slice(0, 8).map(kw => (
                    <span key={kw} className="px-1.5 py-0.5 text-xs bg-[#1a1a2e] text-gray-400 rounded">{kw}</span>
                  ))}
                  {selectedDefenderUnit.keywords.length > 8 && (
                    <span className="text-xs text-gray-500">+{selectedDefenderUnit.keywords.length - 8} more</span>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <label className={labelClass}>Models</label>
              <input
                type="number"
                min={1}
                max={30}
                value={defenderModels}
                onChange={e => setDefenderModels(Math.max(1, parseInt(e.target.value) || 1))}
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Invuln</label>
              <select
                value={defenderInvuln}
                onChange={e => setDefenderInvuln(e.target.value)}
                className={selectClass + ' !w-20'}
              >
                <option value="">None</option>
                <option value="3">3+</option>
                <option value="4">4+</option>
                <option value="5">5+</option>
                <option value="6">6+</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className={labelClass}>FNP</label>
              <select
                value={defenderFnp}
                onChange={e => setDefenderFnp(e.target.value)}
                className={selectClass + ' !w-20'}
              >
                <option value="">None</option>
                <option value="4">4+</option>
                <option value="5">5+</option>
                <option value="6">6+</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Modifier Toggles */}
      <div className="flex flex-wrap gap-3">
        {showHeavy && (
          <Toggle label="Stationary (Heavy)" checked={stationary} onChange={setStationary} />
        )}
        {showLance && (
          <Toggle label="Charged (Lance)" checked={charged} onChange={setCharged} />
        )}
        {showMelta && (
          <Toggle label="Half Range (Melta)" checked={halfRange} onChange={setHalfRange} />
        )}
        {showRapidFire && (
          <Toggle label="Rapid Fire" checked={rapidFire} onChange={setRapidFire} />
        )}
        <Toggle label="Target in Cover" checked={cover} onChange={setCover} />
      </div>

      {/* Results */}
      {result && (
        <div className="bg-[#14142a] border border-[#C5A33E] rounded-lg p-5">
          <h3 className="text-lg font-bold text-[#C5A33E] mb-4">Expected Results</h3>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <ResultCard label="Attacks" value={result.expectedAttacks} />
            <ResultCard label="Hits" value={result.expectedHits} sub={`${(result.hitProbability * 100).toFixed(0)}% to hit`} />
            <ResultCard label="Wounds" value={result.expectedWounds} sub={`${(result.woundProbability * 100).toFixed(0)}% to wound`} />
            <ResultCard label="Unsaved" value={result.expectedUnsavedWounds} sub={`${(result.saveFailProbability * 100).toFixed(0)}% fail save`} />
            <ResultCard label="Damage" value={result.expectedDamage} highlight />
            <ResultCard label="Models Killed" value={result.expectedModelsKilled} highlight />
          </div>

          {result.expectedSelfMortals > 0 && (
            <div className="mt-3 text-sm text-yellow-400">
              Hazardous: ~{result.expectedSelfMortals.toFixed(1)} expected mortal wounds to self
            </div>
          )}

          {result.mortalWoundDamage > 0 && (
            <div className="mt-1 text-sm text-purple-400">
              Devastating Wounds: ~{result.mortalWoundDamage.toFixed(1)} damage bypassing saves
            </div>
          )}
        </div>
      )}

      {!result && selectedWeapon && selectedDefenderUnit && (
        <div className="text-gray-500 text-center py-4">
          Unable to calculate — missing defender stats.
        </div>
      )}

      {!selectedWeapon && (
        <div className="text-gray-500 text-center py-8">
          Select an attacker weapon and defender unit to see expected results.
        </div>
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none bg-[#14142a] border border-[#1a1a2e] rounded-lg px-3 py-2 hover:border-[#C5A33E] transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="accent-[#C5A33E]"
      />
      {label}
    </label>
  );
}

function ResultCard({ label, value, sub, highlight }: { label: string; value: number; sub?: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${highlight ? 'text-[#C5A33E]' : 'text-gray-200'}`}>
        {Number.isInteger(value) ? value : value.toFixed(2)}
      </div>
      <div className="text-xs text-gray-400">{label}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

interface ComboboxOption {
  value: string;
  label: string;
  detail?: string;
}

function Combobox({ options, value, onChange, placeholder, disabled }: {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedLabel = options.find(o => o.value === value)?.label ?? '';

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  // Clamp highlight index to filtered list bounds
  const clampedHighlight = filtered.length > 0 ? Math.min(highlightIndex, filtered.length - 1) : 0;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.children[clampedHighlight] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [clampedHighlight, open]);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex(i => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[clampedHighlight]) handleSelect(filtered[clampedHighlight].value);
        break;
      case 'Escape':
        setOpen(false);
        setQuery('');
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        className={selectClass}
        placeholder={disabled ? placeholder : (value ? selectedLabel : placeholder)}
        value={open ? query : (value ? selectedLabel : '')}
        disabled={disabled}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onKeyDown={handleKeyDown}
      />
      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-[#14142a] border-2 border-[#3a3a5e] rounded-lg shadow-lg"
        >
          {filtered.map((opt, i) => (
            <li
              key={opt.value}
              className={`px-3 py-2 cursor-pointer text-sm ${
                i === clampedHighlight
                  ? 'bg-[#4a3a0f] text-[#C5A33E]'
                  : 'text-gray-200 hover:bg-[#1e1e3a]'
              }`}
              onMouseEnter={() => setHighlightIndex(i)}
              onMouseDown={e => { e.preventDefault(); handleSelect(opt.value); }}
            >
              <span>{opt.label}</span>
              {opt.detail && <span className="ml-2 text-xs text-gray-500">{opt.detail}</span>}
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && query && (
        <div className="absolute z-50 w-full mt-1 px-3 py-2 bg-[#14142a] border-2 border-[#3a3a5e] rounded-lg text-sm text-gray-500">
          No matches
        </div>
      )}
    </div>
  );
}
