'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  calculateResults,
  calculateDistribution,
  combineCombatResults,
  combineDistributions,
  parseKeywords,
  parseStatValue,
  AttackerInput,
  DefenderInput,
  ModifierToggles,
  CombatResult,
  DistributionResult,
} from '../utils/combatSimulator';

interface GlobalUnit {
  name: string;
  factionSlug: string;
  factionName: string;
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

interface Ability {
  name: string;
  description: string;
}

interface Unit {
  name: string;
  points: number;
  keywords: string[];
  stats: UnitStats[];
  rangedWeapons: Weapon[];
  meleeWeapons: Weapon[];
  abilities: Ability[];
  invulnSave: string | null;
  fnp: string | null;
}

interface CatalogueData {
  name: string;
  units: Unit[];
}

const selectClass = "px-3 py-2 bg-[#0a0a14] text-gray-200 border-2 border-[#3a3a5e] rounded-lg focus:border-[#C5A33E] focus:outline-none w-full";
const inputClass = "px-3 py-2 bg-[#0a0a14] text-gray-200 border-2 border-[#3a3a5e] rounded-lg focus:border-[#C5A33E] focus:outline-none w-20 text-center";
const labelClass = "text-sm text-gray-300";

type SimMode = 'single' | 'squad' | 'compare';

interface AttackerModifiers {
  rerollOnesHit: boolean;
  rerollAllHit: boolean;
  rerollOnesWound: boolean;
  rerollAllWound: boolean;
  plusOneToWound: boolean;
  apBonus1: boolean;
  apBonus2: boolean;
}
const defaultAttackerMods: AttackerModifiers = {
  rerollOnesHit: false, rerollAllHit: false,
  rerollOnesWound: false, rerollAllWound: false,
  plusOneToWound: false, apBonus1: false, apBonus2: false,
};

// Shared computation: build attacker/defender inputs and compute results + distribution
function computeForWeapon(
  weapon: Weapon,
  isMelee: boolean,
  modelCount: number,
  defenderUnit: Unit,
  defenderModels: number,
  defenderInvuln: string,
  defenderFnp: string,
  modifiers: ModifierToggles,
): { result: CombatResult; distribution: DistributionResult } | null {
  const defStats = defenderUnit.stats[0];
  if (!defStats) return null;

  const skill = parseStatValue(isMelee ? (weapon.WS || '4+') : (weapon.BS || '4+'));
  const weaponKw = parseKeywords(weapon.keywords);

  const attacker: AttackerInput = {
    attacks: weapon.A,
    skill,
    strength: parseStatValue(weapon.S),
    ap: Math.abs(parseStatValue(weapon.AP)),
    damage: weapon.D,
    keywords: weaponKw,
    modelCount,
  };

  const defender: DefenderInput = {
    toughness: parseStatValue(defStats.T),
    save: parseStatValue(defStats.SV),
    invuln: defenderInvuln ? parseInt(defenderInvuln) : null,
    wounds: parseStatValue(defStats.W),
    modelCount: defenderModels,
    fnp: defenderFnp ? parseInt(defenderFnp) : null,
    keywords: defenderUnit.keywords,
  };

  const result = calculateResults(attacker, defender, modifiers);
  const distribution = calculateDistribution(attacker, defender, modifiers, result);
  return { result, distribution };
}

export default function FightSimulator() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Global unit index
  const [allGlobalUnits, setAllGlobalUnits] = useState<GlobalUnit[]>([]);
  const [globalUnitsLoading, setGlobalUnitsLoading] = useState(true);

  // Mode
  const urlMode = searchParams.get('mode') as SimMode | null;
  const [mode, setMode] = useState<SimMode>(
    urlMode && ['single', 'squad', 'compare'].includes(urlMode) ? urlMode : 'single'
  );

  // Read initial state from URL params
  const urlAtk = searchParams.get('atk') || '';
  const urlDef = searchParams.get('def') || '';
  const urlWep = searchParams.get('wep') || '';
  const urlAtkModels = searchParams.get('atkn') || '';
  const urlDefModels = searchParams.get('defn') || '';

  // Attacker state (Single + Squad modes share this)
  const [attackerUnitKey, setAttackerUnitKey] = useState(urlAtk);
  const [attackerCatalogue, setAttackerCatalogue] = useState<CatalogueData | null>(null);
  const [attackerWeapon, setAttackerWeapon] = useState(urlWep);
  const [attackerModels, setAttackerModels] = useState(urlAtkModels ? parseInt(urlAtkModels) || 1 : 1);
  const [loadingAttacker, setLoadingAttacker] = useState(false);

  // Squad mode: weapon entries with model counts
  const [squadWeapons, setSquadWeapons] = useState<Map<string, number>>(new Map());

  // Compare mode: multiple attacker entries
  interface CompareEntry {
    id: string;
    unitKey: string;
    catalogue: CatalogueData | null;
    weaponName: string;
    modelCount: number;
    loading: boolean;
    mods: AttackerModifiers;
  }
  const [compareEntries, setCompareEntries] = useState<CompareEntry[]>([
    { id: '1', unitKey: '', catalogue: null, weaponName: '', modelCount: 1, loading: false, mods: { ...defaultAttackerMods } },
  ]);

  // Defender state (shared across all modes)
  const [defenderUnitKey, setDefenderUnitKey] = useState(urlDef);
  const [defenderCatalogue, setDefenderCatalogue] = useState<CatalogueData | null>(null);
  const [defenderModels, setDefenderModels] = useState(urlDefModels ? parseInt(urlDefModels) || 1 : 1);
  const [defenderInvuln, setDefenderInvuln] = useState('');
  const [defenderFnp, setDefenderFnp] = useState('');
  const [loadingDefender, setLoadingDefender] = useState(false);

  // Modifier toggles
  const [stationary, setStationary] = useState(false);
  const [charged, setCharged] = useState(false);
  const [halfRange, setHalfRange] = useState(false);
  const [cover, setCover] = useState(false);
  const [rapidFire, setRapidFire] = useState(false);
  const [minusOneToWound, setMinusOneToWound] = useState(false);
  const [minusOneToWoundIfStrGtT, setMinusOneToWoundIfStrGtT] = useState(false);
  const [rerollOnesHit, setRerollOnesHit] = useState(false);
  const [rerollAllHit, setRerollAllHit] = useState(false);
  const [rerollOnesWound, setRerollOnesWound] = useState(false);
  const [rerollAllWound, setRerollAllWound] = useState(false);
  const [apBonus1, setApBonus1] = useState(false);
  const [apBonus2, setApBonus2] = useState(false);
  const [plusOneToWound, setPlusOneToWound] = useState(false);

  const modifiers: ModifierToggles = useMemo(() => ({
    stationary, charged, halfRange, cover, rapidFire,
    minusOneToWound, minusOneToWoundIfStrGtT,
    rerollOnesHit, rerollAllHit, rerollOnesWound, rerollAllWound,
    apBonus1, apBonus2, plusOneToWound,
  }), [stationary, charged, halfRange, cover, rapidFire,
    minusOneToWound, minusOneToWoundIfStrGtT,
    rerollOnesHit, rerollAllHit, rerollOnesWound, rerollAllWound,
    apBonus1, apBonus2, plusOneToWound]);

  // Catalogue cache
  const catalogueCacheRef = useRef<Map<string, CatalogueData>>(new Map());

  // URL sync
  const updateUrl = useCallback((overrides: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'simulator');
    for (const [key, value] of Object.entries(overrides)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.replace(`/?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  // Fetch global unit index
  useEffect(() => {
    fetch('/api/datasheets/all-units')
      .then(r => r.json())
      .then(async (units: GlobalUnit[]) => {
        setAllGlobalUnits(units);
        setGlobalUnitsLoading(false);
        if (urlAtk) {
          const [, atkFaction] = urlAtk.split('||');
          if (atkFaction) {
            setLoadingAttacker(true);
            const data = await fetchCatalogue(atkFaction);
            setAttackerCatalogue(data);
            setLoadingAttacker(false);
          }
        }
        if (urlDef) {
          const [defName, defFaction] = urlDef.split('||');
          if (defFaction) {
            setLoadingDefender(true);
            const data = await fetchCatalogue(defFaction);
            setDefenderCatalogue(data);
            setLoadingDefender(false);
            const unit = data?.units.find(u => u.name === defName);
            if (unit) {
              setDefenderInvuln(unit.invulnSave ? unit.invulnSave.replace('+', '') : '');
              setDefenderFnp(unit.fnp ? unit.fnp.replace('+', '') : '');
            }
          }
        }
      })
      .catch(() => setGlobalUnitsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const globalUnitOptions = useMemo(() =>
    allGlobalUnits.map(u => ({
      value: `${u.name}||${u.factionSlug}`,
      label: u.name,
      detail: u.factionName.replace(/^(Chaos|Imperium|Aeldari|Xenos) - /, ''),
    })),
    [allGlobalUnits]
  );

  const fetchCatalogue = useCallback(async (factionSlug: string): Promise<CatalogueData | null> => {
    const cached = catalogueCacheRef.current.get(factionSlug);
    if (cached) return cached;
    try {
      const r = await fetch(`/api/datasheets/${factionSlug}`);
      const data = await r.json();
      catalogueCacheRef.current.set(factionSlug, data);
      return data;
    } catch {
      return null;
    }
  }, []);

  const handleModeChange = useCallback((m: SimMode) => {
    setMode(m);
    updateUrl({ mode: m === 'single' ? '' : m });
  }, [updateUrl]);

  // --- Attacker handlers (Single + Squad) ---
  const handleAttackerUnitChange = useCallback(async (key: string) => {
    setAttackerUnitKey(key);
    setAttackerWeapon('');
    setSquadWeapons(new Map());
    updateUrl({ atk: key, wep: '' });
    if (!key) { setAttackerCatalogue(null); return; }
    const [, factionSlug] = key.split('||');
    setLoadingAttacker(true);
    const data = await fetchCatalogue(factionSlug);
    setAttackerCatalogue(data);
    setLoadingAttacker(false);
  }, [fetchCatalogue, updateUrl]);

  const handleWeaponSelect = useCallback((name: string) => {
    setAttackerWeapon(name);
    updateUrl({ wep: name });
  }, [updateUrl]);

  // --- Defender handlers (shared) ---
  const handleDefenderUnitChange = useCallback(async (key: string) => {
    setDefenderUnitKey(key);
    updateUrl({ def: key });
    if (!key) { setDefenderCatalogue(null); setDefenderInvuln(''); setDefenderFnp(''); return; }
    const [unitName, factionSlug] = key.split('||');
    setLoadingDefender(true);
    const data = await fetchCatalogue(factionSlug);
    setDefenderCatalogue(data);
    setLoadingDefender(false);
    const unit = data?.units.find(u => u.name === unitName);
    if (unit) {
      setDefenderInvuln(unit.invulnSave ? unit.invulnSave.replace('+', '') : '');
      setDefenderFnp(unit.fnp ? unit.fnp.replace('+', '') : '');
    }
  }, [fetchCatalogue, updateUrl]);

  const handleAttackerModelsChange = useCallback((n: number) => {
    setAttackerModels(n);
    updateUrl({ atkn: n > 1 ? n.toString() : '' });
  }, [updateUrl]);

  const handleDefenderModelsChange = useCallback((n: number) => {
    setDefenderModels(n);
    updateUrl({ defn: n > 1 ? n.toString() : '' });
  }, [updateUrl]);

  // --- Compare mode handlers ---
  const nextIdRef = useRef(2);
  const handleAddCompareEntry = useCallback(() => {
    setCompareEntries(prev => [...prev, {
      id: String(nextIdRef.current++),
      unitKey: '', catalogue: null, weaponName: '', modelCount: 1, loading: false, mods: { ...defaultAttackerMods },
    }]);
  }, []);

  const handleRemoveCompareEntry = useCallback((id: string) => {
    setCompareEntries(prev => prev.length > 1 ? prev.filter(e => e.id !== id) : prev);
  }, []);

  const handleCompareUnitChange = useCallback(async (id: string, key: string) => {
    setCompareEntries(prev => prev.map(e =>
      e.id === id ? { ...e, unitKey: key, weaponName: '', loading: !!key } : e
    ));
    if (!key) {
      setCompareEntries(prev => prev.map(e =>
        e.id === id ? { ...e, catalogue: null, loading: false } : e
      ));
      return;
    }
    const [, factionSlug] = key.split('||');
    const data = await fetchCatalogue(factionSlug);
    setCompareEntries(prev => prev.map(e =>
      e.id === id ? { ...e, catalogue: data, loading: false } : e
    ));
  }, [fetchCatalogue]);

  const handleCompareWeaponChange = useCallback((id: string, weaponName: string) => {
    setCompareEntries(prev => prev.map(e =>
      e.id === id ? { ...e, weaponName } : e
    ));
  }, []);

  const handleCompareModelsChange = useCallback((id: string, n: number) => {
    setCompareEntries(prev => prev.map(e =>
      e.id === id ? { ...e, modelCount: n } : e
    ));
  }, []);

  const handleCompareModsChange = useCallback((id: string, mods: AttackerModifiers) => {
    setCompareEntries(prev => prev.map(e =>
      e.id === id ? { ...e, mods } : e
    ));
  }, []);

  // --- Resolve units ---
  const attackerUnitName = attackerUnitKey.split('||')[0] || '';
  const defenderUnitName = defenderUnitKey.split('||')[0] || '';

  const selectedAttackerUnit = useMemo(
    () => attackerCatalogue?.units.find(u => u.name === attackerUnitName) ?? null,
    [attackerCatalogue, attackerUnitName]
  );

  const selectedDefenderUnit = useMemo(
    () => defenderCatalogue?.units.find(u => u.name === defenderUnitName) ?? null,
    [defenderCatalogue, defenderUnitName]
  );

  const allWeapons = useMemo(() => {
    if (!selectedAttackerUnit) return { ranged: [] as Weapon[], melee: [] as Weapon[] };
    return { ranged: selectedAttackerUnit.rangedWeapons, melee: selectedAttackerUnit.meleeWeapons };
  }, [selectedAttackerUnit]);

  const selectedWeapon = useMemo(
    () => allWeapons.ranged.find(w => w.name === attackerWeapon)
      ?? allWeapons.melee.find(w => w.name === attackerWeapon)
      ?? null,
    [allWeapons, attackerWeapon]
  );

  const isMeleeWeapon = useMemo(
    () => allWeapons.melee.some(w => w.name === attackerWeapon),
    [allWeapons.melee, attackerWeapon]
  );

  // --- Single mode results ---
  const singleResult = useMemo(() => {
    if (mode !== 'single' || !selectedWeapon || !selectedDefenderUnit) return null;
    return computeForWeapon(selectedWeapon, isMeleeWeapon, attackerModels,
      selectedDefenderUnit, defenderModels, defenderInvuln, defenderFnp, modifiers);
  }, [mode, selectedWeapon, selectedDefenderUnit, attackerModels, defenderModels,
      defenderInvuln, defenderFnp, modifiers, isMeleeWeapon]);

  // --- Squad mode results ---
  const squadResults = useMemo(() => {
    if (mode !== 'squad' || !selectedDefenderUnit || squadWeapons.size === 0) return null;
    const allWeps = [...allWeapons.ranged, ...allWeapons.melee];
    const perWeapon: { weapon: Weapon; isMelee: boolean; models: number; result: CombatResult; distribution: DistributionResult }[] = [];

    for (const [wepName, models] of squadWeapons) {
      if (models <= 0) continue;
      const weapon = allWeps.find(w => w.name === wepName);
      if (!weapon) continue;
      const isMelee = allWeapons.melee.some(w => w.name === wepName);
      const computed = computeForWeapon(weapon, isMelee, models,
        selectedDefenderUnit, defenderModels, defenderInvuln, defenderFnp, modifiers);
      if (computed) perWeapon.push({ weapon, isMelee, models, ...computed });
    }

    if (perWeapon.length === 0) return null;

    const combinedResult = combineCombatResults(perWeapon.map(p => p.result));
    const defStats = selectedDefenderUnit.stats[0];
    const combinedDist = combineDistributions(
      perWeapon.map(p => p.distribution),
      parseStatValue(defStats?.W || '1'),
      defenderModels,
    );

    return { perWeapon, combinedResult, combinedDist };
  }, [mode, selectedDefenderUnit, squadWeapons, allWeapons, defenderModels,
      defenderInvuln, defenderFnp, modifiers]);

  // --- Compare mode results ---
  const compareResults = useMemo(() => {
    if (mode !== 'compare' || !selectedDefenderUnit) return null;
    return compareEntries.map(entry => {
      const unitName = entry.unitKey.split('||')[0] || '';
      const unit = entry.catalogue?.units.find(u => u.name === unitName);
      if (!unit || !entry.weaponName) return { entry, computed: null, weapon: null, isMelee: false };
      const weapon = [...unit.rangedWeapons, ...unit.meleeWeapons].find(w => w.name === entry.weaponName);
      if (!weapon) return { entry, computed: null, weapon: null, isMelee: false };
      const isMelee = unit.meleeWeapons.some(w => w.name === entry.weaponName);
      // Merge shared modifiers with per-entry attacker modifiers
      const entryModifiers: ModifierToggles = {
        ...modifiers,
        ...entry.mods,
      };
      const computed = computeForWeapon(weapon, isMelee, entry.modelCount,
        selectedDefenderUnit, defenderModels, defenderInvuln, defenderFnp, entryModifiers);
      return { entry, computed, weapon, isMelee };
    });
  }, [mode, compareEntries, selectedDefenderUnit, defenderModels,
      defenderInvuln, defenderFnp, modifiers]);

  // Modifier toggle visibility (based on selected weapons in current mode)
  const activeKeywords = useMemo(() => {
    if (mode === 'single' && selectedWeapon) return parseKeywords(selectedWeapon.keywords);
    if (mode === 'squad') {
      const allWeps = [...allWeapons.ranged, ...allWeapons.melee];
      const kws: string[] = [];
      for (const [wepName] of squadWeapons) {
        const w = allWeps.find(wp => wp.name === wepName);
        if (w) kws.push(...parseKeywords(w.keywords));
      }
      return kws;
    }
    return [];
  }, [mode, selectedWeapon, squadWeapons, allWeapons]);

  const showHeavy = activeKeywords.some(k => k.toLowerCase() === 'heavy');
  const showLance = activeKeywords.some(k => k.toLowerCase() === 'lance');
  const showMelta = activeKeywords.some(k => k.toLowerCase().startsWith('melta'));
  const showRapidFire = activeKeywords.some(k => k.toLowerCase().startsWith('rapid fire'));

  const comboboxPlaceholder = globalUnitsLoading ? 'Loading units...' : 'Type to search all units...';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#C5A33E]">Fight Simulator</h2>
        <div className="flex bg-[#14142a] rounded-lg border border-[#1a1a2e] overflow-hidden">
          {(['single', 'squad', 'compare'] as const).map(m => (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className={`px-4 py-2 text-sm font-semibold transition-colors ${
                mode === m ? 'bg-[#4a3a0f] text-[#C5A33E]' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {m === 'single' ? 'Single' : m === 'squad' ? 'Squad' : 'Compare'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attacker Panel (Single + Squad modes) */}
        {mode !== 'compare' && (
          <div className="bg-[#14142a] border border-[#1a1a2e] rounded-lg p-4 space-y-3">
            <h3 className="text-lg font-bold text-red-400">Attacker</h3>
            <div className="space-y-2">
              <label className={labelClass}>Unit</label>
              <Combobox
                options={globalUnitOptions}
                value={attackerUnitKey}
                onChange={handleAttackerUnitChange}
                placeholder={comboboxPlaceholder}
                disabled={globalUnitsLoading}
              />
              {loadingAttacker && <div className="text-xs text-gray-500">Loading datasheet...</div>}
            </div>

            {selectedAttackerUnit && <UnitDatasheet unit={selectedAttackerUnit} />}

            {(allWeapons.ranged.length > 0 || allWeapons.melee.length > 0) && (
              <div className="space-y-2">
                <label className={labelClass}>
                  {mode === 'single' ? 'Weapon' : 'Weapons (set models per weapon)'}
                </label>
                {mode === 'single' ? (
                  <>
                    {allWeapons.ranged.length > 0 && (
                      <WeaponTable weapons={allWeapons.ranged} selectedWeapon={attackerWeapon}
                        onSelect={handleWeaponSelect} isMelee={false} label="Ranged" />
                    )}
                    {allWeapons.melee.length > 0 && (
                      <WeaponTable weapons={allWeapons.melee} selectedWeapon={attackerWeapon}
                        onSelect={handleWeaponSelect} isMelee={true} label="Melee" />
                    )}
                  </>
                ) : (
                  <>
                    {allWeapons.ranged.length > 0 && (
                      <SquadWeaponTable weapons={allWeapons.ranged} squadWeapons={squadWeapons}
                        onToggle={(name, count) => {
                          setSquadWeapons(prev => {
                            const next = new Map(prev);
                            if (count <= 0) next.delete(name);
                            else next.set(name, count);
                            return next;
                          });
                        }}
                        isMelee={false} label="Ranged" />
                    )}
                    {allWeapons.melee.length > 0 && (
                      <SquadWeaponTable weapons={allWeapons.melee} squadWeapons={squadWeapons}
                        onToggle={(name, count) => {
                          setSquadWeapons(prev => {
                            const next = new Map(prev);
                            if (count <= 0) next.delete(name);
                            else next.set(name, count);
                            return next;
                          });
                        }}
                        isMelee={true} label="Melee" />
                    )}
                  </>
                )}
              </div>
            )}

            {mode === 'single' && (
              <div className="space-y-2">
                <label className={labelClass}>Number of models attacking</label>
                <input type="number" min={1} max={30} value={attackerModels}
                  onChange={e => handleAttackerModelsChange(Math.max(1, parseInt(e.target.value) || 1))}
                  className={inputClass} />
              </div>
            )}
            {mode === 'squad' && squadWeapons.size > 0 && (
              <div className="text-sm text-gray-400">
                Total models: {Array.from(squadWeapons.values()).reduce((a, b) => a + b, 0)}
              </div>
            )}
            <div className="flex flex-wrap gap-3 pt-1">
              <Toggle label="Reroll 1s to hit" checked={rerollOnesHit} onChange={v => { setRerollOnesHit(v); if (v) setRerollAllHit(false); }} />
              <Toggle label="Reroll all hits" checked={rerollAllHit} onChange={v => { setRerollAllHit(v); if (v) setRerollOnesHit(false); }} />
              <Toggle label="Reroll 1s to wound" checked={rerollOnesWound} onChange={v => { setRerollOnesWound(v); if (v) setRerollAllWound(false); }} />
              <Toggle label="Reroll all wounds" checked={rerollAllWound} onChange={v => { setRerollAllWound(v); if (v) setRerollOnesWound(false); }} />
              <Toggle label="+1 to wound" checked={plusOneToWound} onChange={setPlusOneToWound} />
              <Toggle label="AP +1" checked={apBonus1} onChange={setApBonus1} />
              <Toggle label="AP +2" checked={apBonus2} onChange={setApBonus2} />
            </div>
          </div>
        )}

        {/* Compare mode: multiple attacker cards */}
        {mode === 'compare' && (
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-red-400">Attackers</h3>
            {compareEntries.map((entry) => (
              <CompareAttackerCard
                key={entry.id}
                entry={entry}
                globalUnitOptions={globalUnitOptions}
                comboboxPlaceholder={comboboxPlaceholder}
                globalUnitsLoading={globalUnitsLoading}
                onUnitChange={(key) => handleCompareUnitChange(entry.id, key)}
                onWeaponChange={(name) => handleCompareWeaponChange(entry.id, name)}
                onModelsChange={(n) => handleCompareModelsChange(entry.id, n)}
                onModsChange={(mods) => handleCompareModsChange(entry.id, mods)}
                onRemove={() => handleRemoveCompareEntry(entry.id)}
                canRemove={compareEntries.length > 1}
              />
            ))}
            {compareEntries.length < 6 && (
              <button onClick={handleAddCompareEntry}
                className="w-full py-2 text-sm font-semibold text-gray-400 border-2 border-dashed border-[#3a3a5e] rounded-lg hover:border-[#C5A33E] hover:text-[#C5A33E] transition-colors">
                + Add Attacker
              </button>
            )}
          </div>
        )}

        {/* Defender Panel (all modes) */}
        <div className="bg-[#14142a] border border-[#1a1a2e] rounded-lg p-4 space-y-3">
          <h3 className="text-lg font-bold text-blue-400">Defender</h3>
          <div className="space-y-2">
            <label className={labelClass}>Unit</label>
            <Combobox options={globalUnitOptions} value={defenderUnitKey}
              onChange={handleDefenderUnitChange} placeholder={comboboxPlaceholder}
              disabled={globalUnitsLoading} />
            {loadingDefender && <div className="text-xs text-gray-500">Loading datasheet...</div>}
          </div>
          {selectedDefenderUnit && <UnitDatasheet unit={selectedDefenderUnit} />}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <label className={labelClass}>Models</label>
              <input type="number" min={1} max={30} value={defenderModels}
                onChange={e => handleDefenderModelsChange(Math.max(1, parseInt(e.target.value) || 1))}
                className={inputClass} />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Invuln</label>
              <select value={defenderInvuln} onChange={e => setDefenderInvuln(e.target.value)}
                className={selectClass + ' !w-20'}>
                <option value="">None</option>
                <option value="3">3+</option><option value="4">4+</option>
                <option value="5">5+</option><option value="6">6+</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className={labelClass}>FNP</label>
              <select value={defenderFnp} onChange={e => setDefenderFnp(e.target.value)}
                className={selectClass + ' !w-20'}>
                <option value="">None</option>
                <option value="4">4+</option><option value="5">5+</option><option value="6">6+</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            <Toggle label="-1 to wound" checked={minusOneToWound} onChange={setMinusOneToWound} />
            <Toggle label="-1 to wound (if S &gt; T)" checked={minusOneToWoundIfStrGtT} onChange={setMinusOneToWoundIfStrGtT} />
          </div>
        </div>
      </div>

      {/* Modifier Toggles */}
      <div className="flex flex-wrap gap-3">
        {showHeavy && <Toggle label="Stationary (Heavy)" checked={stationary} onChange={setStationary} />}
        {showLance && <Toggle label="Charged (Lance)" checked={charged} onChange={setCharged} />}
        {showMelta && <Toggle label="Half Range (Melta)" checked={halfRange} onChange={setHalfRange} />}
        {showRapidFire && <Toggle label="Rapid Fire" checked={rapidFire} onChange={setRapidFire} />}
        <Toggle label="Target in Cover" checked={cover} onChange={setCover} />
      </div>

      {/* ===== SINGLE MODE RESULTS ===== */}
      {mode === 'single' && singleResult && selectedWeapon && selectedDefenderUnit && (
        <ResultsSection
          result={singleResult.result}
          distribution={singleResult.distribution}
          weapon={selectedWeapon}
          isMelee={isMeleeWeapon}
          modelCount={attackerModels}
          defenderUnit={selectedDefenderUnit}
        />
      )}

      {/* ===== SQUAD MODE RESULTS ===== */}
      {mode === 'squad' && squadResults && selectedDefenderUnit && (
        <div className="space-y-6">
          {/* Per-weapon summaries */}
          <div className="bg-[#14142a] border border-[#1a1a2e] rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-bold text-gray-300">Per-Weapon Breakdown</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#3a3a5e]">
                  <th className="text-left py-1 text-gray-400">Weapon</th>
                  <th className="text-center py-1 text-gray-400 px-2">Models</th>
                  <th className="text-center py-1 text-gray-400 px-2">Avg Damage</th>
                  <th className="text-center py-1 text-gray-400 px-2">Avg Kills</th>
                </tr>
              </thead>
              <tbody>
                {squadResults.perWeapon.map(pw => (
                  <tr key={pw.weapon.name} className="border-b border-[#1a1a2e]">
                    <td className="py-1 text-gray-200">{pw.weapon.name}</td>
                    <td className="text-center py-1 text-gray-400 px-2">{pw.models}</td>
                    <td className="text-center py-1 text-[#C5A33E] font-bold px-2">{fmt(pw.result.expectedDamage)}</td>
                    <td className="text-center py-1 text-gray-200 px-2">{pw.result.expectedModelsKilled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Combined stats table */}
          <div className="bg-[#14142a] border border-[#C5A33E] rounded-lg p-5 space-y-4">
            <h3 className="text-lg font-bold text-[#C5A33E]">Combined Results</h3>
            <StatsTable distribution={squadResults.combinedDist} defenderUnit={selectedDefenderUnit} />

            {squadResults.combinedResult.expectedSelfMortals > 0 && (
              <div className="text-sm text-yellow-400">
                Hazardous: ~{fmt(squadResults.combinedResult.expectedSelfMortals)} expected mortal wounds to self
              </div>
            )}
          </div>

          {/* Combined distribution charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DamageDistChart dist={squadResults.combinedDist.damageDist}
              expectedValue={distMean(squadResults.combinedDist.damageDist)}
              woundsPerModel={parseStatValue(selectedDefenderUnit.stats[0]?.W || '1')}
              label="Combined Damage Distribution" />
            <ModelsKilledChart dist={squadResults.combinedDist.modelsKilledDist}
              expectedValue={Math.round(distMean(squadResults.combinedDist.modelsKilledDist))}
              label="Models Killed Distribution" />
          </div>
        </div>
      )}

      {/* ===== COMPARE MODE RESULTS ===== */}
      {mode === 'compare' && compareResults && selectedDefenderUnit && (
        <div className="space-y-6">
          {/* Pairwise comparison stats tables */}
          {compareResults.filter(r => r.computed).length === 1 && (
            <div className="bg-[#14142a] border border-[#1a1a2e] rounded-lg p-5 text-sm text-gray-400">
              Add a second attacker to see a comparison.
            </div>
          )}
          {(() => {
            const computed = compareResults.filter(r => r.computed);
            if (computed.length < 2) return null;
            const pairs: [number, number][] = [];
            for (let i = 0; i < computed.length - 1; i++) pairs.push([i, i + 1]);
            return pairs.map(([li, ri]) => {
              const left = computed[li];
              const right = computed[ri];
              const leftUnit = left.entry.unitKey.split('||')[0] || '';
              const rightUnit = right.entry.unitKey.split('||')[0] || '';
              const sameUnit = leftUnit && leftUnit === rightUnit;
              const leftName = left.weapon ? (sameUnit ? left.weapon.name : `${leftUnit} - ${left.weapon.name}`) : `Attacker ${li + 1}`;
              const rightName = right.weapon ? (sameUnit ? right.weapon.name : `${rightUnit} - ${right.weapon.name}`) : `Attacker ${ri + 1}`;
              return (
                <CompareStatsTable
                  key={`stats-${left.entry.id}-${right.entry.id}`}
                  left={left.computed!.distribution}
                  right={right.computed!.distribution}
                  leftLabel={leftName}
                  rightLabel={rightName}
                  leftColor={COMPARE_COLORS[li % COMPARE_COLORS.length]}
                  rightColor={COMPARE_COLORS[ri % COMPARE_COLORS.length]}
                  defenderUnit={selectedDefenderUnit}
                />
              );
            });
          })()}

          {/* Per-entry charts */}
          <div className={`grid gap-6 ${compareResults.filter(r => r.computed).length > 1 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
            {compareResults.map((r, i) => {
              if (!r.computed || !r.weapon) return null;
              const color = COMPARE_COLORS[i % COMPARE_COLORS.length];
              const unitName = r.entry.unitKey.split('||')[0] || '';
              return (
                <div key={r.entry.id} className="space-y-3">
                  <div className="text-sm font-bold" style={{ color }}>
                    {unitName} - {r.weapon.name} x{r.entry.modelCount}
                  </div>
                  <DamageDistChart dist={r.computed.distribution.damageDist}
                    expectedValue={r.computed.result.expectedDamage}
                    woundsPerModel={parseStatValue(selectedDefenderUnit.stats[0]?.W || '1')}
                    label="Damage" />
                  <ModelsKilledChart dist={r.computed.distribution.modelsKilledDist}
                    expectedValue={r.computed.result.expectedModelsKilled}
                    label="Models Killed" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {mode === 'single' && !singleResult && (
        <div className="text-gray-500 text-center py-8">
          Select an attacker weapon and defender unit to see expected results.
        </div>
      )}
      {mode === 'squad' && !squadResults && selectedAttackerUnit && selectedDefenderUnit && (
        <div className="text-gray-500 text-center py-8">
          Check weapons and set model counts to see combined results.
        </div>
      )}
    </div>
  );
}

const COMPARE_COLORS = ['#C5A33E', '#ef4444', '#60a5fa', '#34d399', '#a78bfa', '#f472b6'];

// ============================================================
// Results section (used by Single mode)
// ============================================================

function ResultsSection({ result, distribution, weapon, isMelee, modelCount, defenderUnit }: {
  result: CombatResult;
  distribution: DistributionResult;
  weapon: Weapon;
  isMelee: boolean;
  modelCount: number;
  defenderUnit: Unit;
}) {
  return (
    <>
      <div className="bg-[#14142a] border border-[#C5A33E] rounded-lg p-5 space-y-4">
        <h3 className="text-lg font-bold text-[#C5A33E]">Attack Breakdown</h3>

        <div className="bg-[#0a0a14] rounded-lg border border-[#1a1a2e] p-3">
          <div className="text-sm font-semibold text-gray-200 mb-1">{weapon.name}</div>
          <div className="flex gap-4 text-sm text-gray-400">
            <span>A: {weapon.A}</span>
            <span>{isMelee ? 'WS' : 'BS'}: {isMelee ? weapon.WS : weapon.BS}</span>
            <span>S: {weapon.S}</span>
            <span>AP: {weapon.AP}</span>
            <span>D: {weapon.D}</span>
          </div>
          {weapon.keywords && weapon.keywords !== '-' && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {parseKeywords(weapon.keywords).map(kw => (
                <span key={kw} className="px-1.5 py-0.5 text-xs bg-[#4a3a0f] text-[#C5A33E] rounded">{kw}</span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <PipelineStep step="1. Attacks" result={fmt(result.expectedAttacks)}
            detail={`${modelCount} model${modelCount > 1 ? 's' : ''} x ${weapon.A} attacks`}
            notes={result.expectedAttacks !== modelCount * parseStatValue(weapon.A)
              ? [`Modified to ${fmt(result.expectedAttacks)} total`] : []} />
          <PipelineStep step="2. Hit Roll" result={`${fmt(result.expectedHits)} hits`}
            detail={result.hitRollNeeded === null ? 'Auto-hit (Torrent)'
              : `${result.hitRollNeeded}+ needed (${frac(result.hitProbability)})`}
            notes={result.hitNotes} />
          <PipelineStep step="3. Wound Roll" result={`${fmt(result.expectedWounds)} wounds`}
            detail={`${result.woundRollNeeded}+ needed (${frac(result.woundProbability)})`}
            notes={result.woundNotes} />
          <PipelineStep step="4. Save Roll" result={`${fmt(result.expectedUnsavedWounds)} unsaved`}
            detail={result.saveRollNeeded <= 7
              ? `Defender needs ${result.saveRollNeeded}+ to save (${frac(1 - result.saveFailProbability)} chance), fails ${(result.saveFailProbability * 100).toFixed(0)}%`
              : 'No save possible'}
            notes={result.saveNotes} />
          <PipelineStep step="5. Damage" result={`${fmt(result.expectedDamage)} total damage`}
            detail={`${fmt(result.expectedUnsavedWounds)} unsaved wounds x ${fmt(result.expectedDamagePerWound)} avg damage`}
            notes={result.damageNotes} highlight />
        </div>

        <StatsTable distribution={distribution} defenderUnit={defenderUnit} />

        {result.expectedSelfMortals > 0 && (
          <div className="text-sm text-yellow-400">
            Hazardous: ~{fmt(result.expectedSelfMortals)} expected mortal wounds to self
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DamageDistChart dist={distribution.damageDist} expectedValue={result.expectedDamage}
          woundsPerModel={parseStatValue(defenderUnit.stats[0]?.W || '1')} label="Damage Distribution" />
        <ModelsKilledChart dist={distribution.modelsKilledDist} expectedValue={result.expectedModelsKilled}
          label="Models Killed Distribution" />
      </div>
    </>
  );
}

// ============================================================
// Stats table (reused in all modes)
// ============================================================

function StatsTable({ distribution, defenderUnit }: {
  distribution: DistributionResult;
  defenderUnit: Unit;
}) {
  return (
    <div className="border-t border-[#C5A33E] pt-3">
      <table className="text-sm border-collapse">
        <thead>
          <tr className="border-b border-[#3a3a5e]">
            <th className="text-left py-1 text-gray-400 font-normal pr-3"></th>
            <th className="text-left py-1 text-gray-300 font-semibold pr-3">Mean</th>
            <th className="text-left py-1 text-gray-300 font-semibold pr-3">Median</th>
            <th className="text-left py-1 text-gray-300 font-semibold pr-3">75th %ile</th>
            <th className="text-left py-1 text-gray-300 font-semibold">Max</th>
          </tr>
        </thead>
        <tbody>
          <StatsRow label="Attacks" dist={distribution.attacksDist} />
          <StatsRow label="Hits" dist={distribution.hitsDist} />
          <StatsRow label="Wounds" dist={distribution.woundsDist} />
          <StatsRow label="Unsaved wounds" dist={distribution.unsavedWoundsDist} />
          <StatsRow label="Damage" dist={distribution.damageDist} highlight />
          <StatsRow
            label={<>Models killed{defenderUnit.stats[0] && <span className="text-gray-500 text-xs ml-1">({defenderUnit.stats[0].W}W)</span>}</>}
            dist={distribution.modelsKilledDist} highlight />
        </tbody>
      </table>
    </div>
  );
}

function CompareStatsTable({ left, right, leftLabel, rightLabel, leftColor, rightColor, defenderUnit }: {
  left: DistributionResult;
  right: DistributionResult;
  leftLabel: string;
  rightLabel: string;
  leftColor: string;
  rightColor: string;
  defenderUnit: Unit;
}) {
  const rows: { label: React.ReactNode; leftDist: number[]; rightDist: number[] }[] = [
    { label: 'Attacks', leftDist: left.attacksDist, rightDist: right.attacksDist },
    { label: 'Hits', leftDist: left.hitsDist, rightDist: right.hitsDist },
    { label: 'Wounds', leftDist: left.woundsDist, rightDist: right.woundsDist },
    { label: 'Unsaved wounds', leftDist: left.unsavedWoundsDist, rightDist: right.unsavedWoundsDist },
    { label: 'Damage', leftDist: left.damageDist, rightDist: right.damageDist },
    {
      label: <>Models killed{defenderUnit.stats[0] && <span className="text-gray-500 text-xs ml-1">({defenderUnit.stats[0].W}W)</span>}</>,
      leftDist: left.modelsKilledDist,
      rightDist: right.modelsKilledDist,
    },
  ];
  const statCols: { label: string; fn: (dist: number[]) => number }[] = [
    { label: 'Mean', fn: d => distMean(d) },
    { label: 'Median', fn: d => percentile(d, 0.5) },
    { label: '75th', fn: d => percentile(d, 0.75) },
    { label: 'Max', fn: d => distMax(d) },
  ];

  return (
    <div className="border-t border-[#C5A33E] pt-3 overflow-x-auto">
      <table className="text-sm border-collapse">
        <thead>
          <tr className="border-b border-[#3a3a5e]">
            <th className="text-left py-1 text-gray-400 font-normal pr-3"></th>
            {statCols.map(col => (
              <th key={col.label} colSpan={3} className="text-left py-1 text-gray-300 font-semibold pr-4">{col.label}</th>
            ))}
          </tr>
          <tr className="border-b border-[#3a3a5e]">
            <th className="py-0.5 pr-3"></th>
            {statCols.map(col => (
              <React.Fragment key={col.label}>
                <th className="text-left py-0.5 pr-1 text-xs font-normal truncate max-w-[60px]" style={{ color: leftColor }}>{leftLabel}</th>
                <th className="text-left py-0.5 pr-1 text-xs font-normal truncate max-w-[60px]" style={{ color: rightColor }}>{rightLabel}</th>
                <th className="text-left py-0.5 pr-4 text-xs font-normal text-gray-500">+/-</th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const isHighlight = ri >= 4;
            const rowCls = `border-b border-[#1a1a2e] ${isHighlight ? 'bg-[#1a1506]' : ''}`;
            const labelCls = `py-1 pr-3 font-semibold ${isHighlight ? 'text-[#C5A33E]' : 'text-gray-300'}`;
            return (
              <tr key={ri} className={rowCls}>
                <td className={labelCls}>{row.label}</td>
                {statCols.map(col => {
                  const lv = col.fn(row.leftDist);
                  const rv = col.fn(row.rightDist);
                  const diff = rv - lv;
                  const diffColor = Math.abs(diff) < 0.005 ? 'text-gray-600' : diff > 0 ? 'text-green-400' : 'text-red-400';
                  return (
                    <React.Fragment key={col.label}>
                      <td className={`py-1 pr-1 ${isHighlight ? 'text-[#C5A33E] font-bold' : 'text-gray-200'}`}>{fmt(lv)}</td>
                      <td className={`py-1 pr-1 ${isHighlight ? 'text-[#C5A33E] font-bold' : 'text-gray-200'}`}>{fmt(rv)}</td>
                      <td className={`py-1 pr-4 font-bold ${diffColor}`}>{diff >= 0 ? '+' : ''}{fmt(diff)}</td>
                    </React.Fragment>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// Compare mode attacker card
// ============================================================

function CompareAttackerCard({ entry, globalUnitOptions, comboboxPlaceholder, globalUnitsLoading,
  onUnitChange, onWeaponChange, onModelsChange, onModsChange, onRemove, canRemove }: {
  entry: { id: string; unitKey: string; catalogue: CatalogueData | null; weaponName: string; modelCount: number; loading: boolean; mods: { rerollOnesHit: boolean; rerollAllHit: boolean; rerollOnesWound: boolean; rerollAllWound: boolean; plusOneToWound: boolean; apBonus1: boolean; apBonus2: boolean } };
  globalUnitOptions: { value: string; label: string; detail?: string }[];
  comboboxPlaceholder: string;
  globalUnitsLoading: boolean;
  onUnitChange: (key: string) => void;
  onWeaponChange: (name: string) => void;
  onModelsChange: (n: number) => void;
  onModsChange: (mods: { rerollOnesHit: boolean; rerollAllHit: boolean; rerollOnesWound: boolean; rerollAllWound: boolean; plusOneToWound: boolean; apBonus1: boolean; apBonus2: boolean }) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const unitName = entry.unitKey.split('||')[0] || '';
  const unit = entry.catalogue?.units.find(u => u.name === unitName) ?? null;
  const ranged = unit?.rangedWeapons || [];
  const melee = unit?.meleeWeapons || [];
  const mods = entry.mods;
  const setMod = (key: string, val: boolean) => {
    const next = { ...mods, [key]: val };
    // Mutual exclusivity for rerolls
    if (key === 'rerollOnesHit' && val) next.rerollAllHit = false;
    if (key === 'rerollAllHit' && val) next.rerollOnesHit = false;
    if (key === 'rerollOnesWound' && val) next.rerollAllWound = false;
    if (key === 'rerollAllWound' && val) next.rerollOnesWound = false;
    onModsChange(next);
  };

  return (
    <div className="bg-[#14142a] border border-[#1a1a2e] rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Combobox options={globalUnitOptions} value={entry.unitKey} onChange={onUnitChange}
          placeholder={comboboxPlaceholder} disabled={globalUnitsLoading} />
        {canRemove && (
          <button onClick={onRemove} className="ml-2 text-gray-500 hover:text-red-400 text-lg font-bold px-2">x</button>
        )}
      </div>
      {entry.loading && <div className="text-xs text-gray-500">Loading...</div>}
      {unit && (ranged.length > 0 || melee.length > 0) && (
        <>
          {ranged.length > 0 && <WeaponTable weapons={ranged} selectedWeapon={entry.weaponName}
            onSelect={onWeaponChange} isMelee={false} label="Ranged" />}
          {melee.length > 0 && <WeaponTable weapons={melee} selectedWeapon={entry.weaponName}
            onSelect={onWeaponChange} isMelee={true} label="Melee" />}
        </>
      )}
      <div className="flex items-center gap-2">
        <label className={labelClass}>Models:</label>
        <input type="number" min={1} max={30} value={entry.modelCount}
          onChange={e => onModelsChange(Math.max(1, parseInt(e.target.value) || 1))}
          className={inputClass} />
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <Toggle label="Reroll 1s hit" checked={mods.rerollOnesHit} onChange={v => setMod('rerollOnesHit', v)} />
        <Toggle label="Reroll all hits" checked={mods.rerollAllHit} onChange={v => setMod('rerollAllHit', v)} />
        <Toggle label="Reroll 1s wound" checked={mods.rerollOnesWound} onChange={v => setMod('rerollOnesWound', v)} />
        <Toggle label="Reroll all wounds" checked={mods.rerollAllWound} onChange={v => setMod('rerollAllWound', v)} />
        <Toggle label="+1 to wound" checked={mods.plusOneToWound} onChange={v => setMod('plusOneToWound', v)} />
        <Toggle label="AP +1" checked={mods.apBonus1} onChange={v => setMod('apBonus1', v)} />
        <Toggle label="AP +2" checked={mods.apBonus2} onChange={v => setMod('apBonus2', v)} />
      </div>
    </div>
  );
}

// ============================================================
// Helper functions
// ============================================================

function fmtPct(p: number): string {
  const pct = p * 100;
  if (pct === 0) return '0';
  if (pct >= 1) return pct.toFixed(1);
  const digits = Math.max(1, Math.ceil(-Math.log10(pct)) + 1);
  return pct.toFixed(digits);
}

function fmt(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}

function percentile(dist: number[], p: number): number {
  let cumulative = 0;
  for (let i = 0; i < dist.length; i++) {
    cumulative += dist[i];
    if (cumulative >= p - 1e-9) return i;
  }
  return dist.length - 1;
}

function distMax(dist: number[]): number {
  for (let i = dist.length - 1; i >= 0; i--) {
    if (dist[i] > 1e-9) return i;
  }
  return 0;
}

function distMean(dist: number[]): number {
  let sum = 0;
  for (let i = 0; i < dist.length; i++) sum += i * dist[i];
  return sum;
}

function StatsRow({ label, dist, highlight }: {
  label: React.ReactNode;
  dist: number[];
  highlight?: boolean;
}) {
  return (
    <tr className={`border-b border-[#1a1a2e] ${highlight ? 'bg-[#1a1506]' : ''}`}>
      <td className={`py-1 pr-3 font-semibold ${highlight ? 'text-[#C5A33E]' : 'text-gray-300'}`}>{label}</td>
      <td className={`text-left py-1 pr-3 font-bold ${highlight ? 'text-[#C5A33E]' : 'text-gray-200'}`}>{distMean(dist).toFixed(2)}</td>
      <td className="text-left py-1 pr-3 text-gray-200">{percentile(dist, 0.5).toFixed(2)}</td>
      <td className="text-left py-1 pr-3 text-gray-200">{percentile(dist, 0.75).toFixed(2)}</td>
      <td className="text-left py-1 text-gray-200">{distMax(dist).toFixed(2)}</td>
    </tr>
  );
}

function frac(p: number): string {
  const sixths = Math.round(p * 6);
  if (sixths === 6) return '6/6';
  if (sixths === 0) return '0/6';
  return `${sixths}/6`;
}

function PipelineStep({ step, result, detail, notes, highlight }: {
  step: string; result: string; detail: string; notes: string[]; highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg p-3 ${highlight ? 'bg-[#1a1506] border border-[#4a3a0f]' : 'bg-[#0a0a14] border border-[#1a1a2e]'}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`text-sm font-semibold ${highlight ? 'text-[#C5A33E]' : 'text-gray-300'}`}>{step}</span>
        <span className={`text-sm font-bold ${highlight ? 'text-[#C5A33E]' : 'text-gray-200'}`}>{result}</span>
      </div>
      <div className="text-xs text-gray-400 mt-0.5">{detail}</div>
      {notes.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {notes.map((note, i) => <div key={i} className="text-xs text-gray-500">{note}</div>)}
        </div>
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none bg-[#14142a] border border-[#1a1a2e] rounded-lg px-3 py-2 hover:border-[#C5A33E] transition-colors">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="accent-[#C5A33E]" />
      {label}
    </label>
  );
}

// ============================================================
// Unit datasheet
// ============================================================

function UnitDatasheet({ unit }: { unit: Unit }) {
  return (
    <div className="bg-[#0a0a14] rounded-lg border border-[#1a1a2e] p-3 space-y-3">
      {unit.stats.length > 0 && (
        <div className="overflow-x-auto">
          <table className="border-collapse w-full text-sm">
            <thead>
              <tr className="border-b border-[#C5A33E]">
                <th className="text-left pr-3 py-1 text-gray-200 font-bold">Model</th>
                <th className="text-center px-2 py-1 text-gray-200 font-bold">M</th>
                <th className="text-center px-2 py-1 text-gray-200 font-bold">T</th>
                <th className="text-center px-2 py-1 text-gray-200 font-bold">SV</th>
                <th className="text-center px-2 py-1 text-gray-200 font-bold">W</th>
                <th className="text-center px-2 py-1 text-gray-200 font-bold">LD</th>
                <th className="text-center px-2 py-1 text-gray-200 font-bold">OC</th>
              </tr>
            </thead>
            <tbody>
              {unit.stats.map((s, i) => (
                <tr key={i} className="border-b border-[#1a1a2e]">
                  <td className="pr-3 py-1 text-gray-300">{s.name}</td>
                  <td className="text-center px-2 py-1 text-gray-400">{s.M}</td>
                  <td className="text-center px-2 py-1 text-gray-400">{s.T}</td>
                  <td className="text-center px-2 py-1 text-gray-400">{s.SV}</td>
                  <td className="text-center px-2 py-1 text-gray-400">{s.W}</td>
                  <td className="text-center px-2 py-1 text-gray-400">{s.LD}</td>
                  <td className="text-center px-2 py-1 text-gray-400">{s.OC}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(unit.invulnSave || unit.fnp) && (
        <div className="flex gap-2">
          {unit.invulnSave && <span className="px-2 py-0.5 text-xs font-semibold bg-purple-900 text-purple-200 rounded">Invuln {unit.invulnSave}</span>}
          {unit.fnp && <span className="px-2 py-0.5 text-xs font-semibold bg-green-900 text-green-200 rounded">FNP {unit.fnp}</span>}
        </div>
      )}
      {unit.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {unit.keywords.map(kw => <span key={kw} className="px-1.5 py-0.5 text-xs bg-[#1a1a2e] text-gray-400 rounded">{kw}</span>)}
        </div>
      )}
      {unit.abilities.length > 0 && (
        <div className="space-y-1">
          {unit.abilities.filter(a => a.name !== 'Invulnerable Save').map((a, i) => (
            <div key={i} className="text-xs">
              <span className="text-gray-300 font-semibold">{a.name}: </span>
              <span className="text-gray-500">{a.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Weapon tables
// ============================================================

function WeaponTable({ weapons, selectedWeapon, onSelect, isMelee, label }: {
  weapons: Weapon[]; selectedWeapon: string; onSelect: (name: string) => void;
  isMelee: boolean; label?: string;
}) {
  const skillLabel = isMelee ? 'WS' : 'BS';
  return (
    <div className="overflow-x-auto rounded-lg border-2 border-[#3a3a5e]">
      {label && <div className="bg-[#0a0a14] px-2 py-1 text-xs font-semibold text-gray-400 border-b border-[#3a3a5e]">{label}</div>}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[#0a0a14] border-b-2 border-[#3a3a5e]">
            <th className="text-left px-2 py-1.5 text-gray-300 font-semibold">Weapon</th>
            <th className="text-center px-2 py-1.5 text-gray-300 font-semibold">A</th>
            <th className="text-center px-2 py-1.5 text-gray-300 font-semibold">{skillLabel}</th>
            <th className="text-center px-2 py-1.5 text-gray-300 font-semibold">S</th>
            <th className="text-center px-2 py-1.5 text-gray-300 font-semibold">AP</th>
            <th className="text-center px-2 py-1.5 text-gray-300 font-semibold">D</th>
            <th className="text-left px-2 py-1.5 text-gray-300 font-semibold">Keywords</th>
          </tr>
        </thead>
        <tbody>
          {weapons.map((w) => {
            const isSelected = w.name === selectedWeapon;
            return (
              <tr key={w.name} onClick={() => onSelect(w.name)}
                className={`cursor-pointer border-b border-[#1a1a2e] transition-colors ${
                  isSelected ? 'bg-[#4a3a0f] text-[#C5A33E]' : 'bg-[#0a0a14] text-gray-300 hover:bg-[#1e1e3a]'
                }`}>
                <td className="px-2 py-1.5 font-medium whitespace-nowrap">{w.name}</td>
                <td className="text-center px-2 py-1.5">{w.A}</td>
                <td className="text-center px-2 py-1.5">{isMelee ? w.WS : w.BS}</td>
                <td className="text-center px-2 py-1.5">{w.S}</td>
                <td className="text-center px-2 py-1.5">{w.AP}</td>
                <td className="text-center px-2 py-1.5">{w.D}</td>
                <td className="px-2 py-1.5 text-xs">
                  {w.keywords && w.keywords !== '-' && (
                    <span className={isSelected ? 'text-[#C5A33E] opacity-80' : 'text-gray-500'}>{w.keywords}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SquadWeaponTable({ weapons, squadWeapons, onToggle, isMelee, label }: {
  weapons: Weapon[];
  squadWeapons: Map<string, number>;
  onToggle: (name: string, count: number) => void;
  isMelee: boolean;
  label?: string;
}) {
  const skillLabel = isMelee ? 'WS' : 'BS';
  return (
    <div className="overflow-x-auto rounded-lg border-2 border-[#3a3a5e]">
      {label && <div className="bg-[#0a0a14] px-2 py-1 text-xs font-semibold text-gray-400 border-b border-[#3a3a5e]">{label}</div>}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[#0a0a14] border-b-2 border-[#3a3a5e]">
            <th className="text-center px-2 py-1.5 text-gray-300 font-semibold w-8"></th>
            <th className="text-left px-2 py-1.5 text-gray-300 font-semibold">Weapon</th>
            <th className="text-center px-2 py-1.5 text-gray-300 font-semibold">A</th>
            <th className="text-center px-2 py-1.5 text-gray-300 font-semibold">{skillLabel}</th>
            <th className="text-center px-2 py-1.5 text-gray-300 font-semibold">S</th>
            <th className="text-center px-2 py-1.5 text-gray-300 font-semibold">AP</th>
            <th className="text-center px-2 py-1.5 text-gray-300 font-semibold">D</th>
            <th className="text-center px-2 py-1.5 text-gray-300 font-semibold">Models</th>
          </tr>
        </thead>
        <tbody>
          {weapons.map((w) => {
            const count = squadWeapons.get(w.name) || 0;
            const isActive = count > 0;
            return (
              <tr key={w.name}
                className={`border-b border-[#1a1a2e] transition-colors ${
                  isActive ? 'bg-[#4a3a0f] text-[#C5A33E]' : 'bg-[#0a0a14] text-gray-300'
                }`}>
                <td className="text-center px-2 py-1.5">
                  <input type="checkbox" checked={isActive}
                    onChange={e => onToggle(w.name, e.target.checked ? 1 : 0)}
                    className="accent-[#C5A33E]" />
                </td>
                <td className="px-2 py-1.5 font-medium whitespace-nowrap cursor-pointer"
                  onClick={() => onToggle(w.name, isActive ? 0 : 1)}>
                  {w.name}
                </td>
                <td className="text-center px-2 py-1.5">{w.A}</td>
                <td className="text-center px-2 py-1.5">{isMelee ? w.WS : w.BS}</td>
                <td className="text-center px-2 py-1.5">{w.S}</td>
                <td className="text-center px-2 py-1.5">{w.AP}</td>
                <td className="text-center px-2 py-1.5">{w.D}</td>
                <td className="text-center px-2 py-1.5">
                  {isActive && (
                    <input type="number" min={1} max={30} value={count}
                      onChange={e => onToggle(w.name, Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-14 px-1 py-0.5 text-center bg-[#0a0a14] border border-[#3a3a5e] rounded text-[#C5A33E] text-sm"
                      onClick={e => e.stopPropagation()} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// Distribution charts
// ============================================================

function DamageDistChart({ dist, expectedValue, woundsPerModel, label }: {
  dist: number[]; expectedValue: number; woundsPerModel: number; label: string;
}) {
  const trimmed = [...dist];
  while (trimmed.length > 1 && trimmed[trimmed.length - 1] < 1e-6) trimmed.pop();

  const MAX_BARS = 30;
  let bucketSize = 1;
  let bucketLabels: string[] = [];
  let bucketProbs: number[] = [];

  if (trimmed.length > MAX_BARS) {
    bucketSize = Math.ceil(trimmed.length / MAX_BARS);
    for (let i = 0; i < trimmed.length; i += bucketSize) {
      let sum = 0;
      const end = Math.min(i + bucketSize, trimmed.length);
      for (let j = i; j < end; j++) sum += trimmed[j];
      bucketProbs.push(sum);
      bucketLabels.push(bucketSize === 1 ? `${i}` : `${i}-${end - 1}`);
    }
  } else {
    bucketProbs = trimmed;
    bucketLabels = trimmed.map((_, i) => `${i}`);
  }

  const maxProb = Math.max(...bucketProbs, 0.01);

  let cumulative = 0;
  const cumulativeAtLeast: number[] = [];
  for (let i = bucketProbs.length - 1; i >= 0; i--) {
    cumulative += bucketProbs[i];
    cumulativeAtLeast[i] = cumulative;
  }

  const expectedBucket = bucketSize === 1 ? Math.round(expectedValue) : Math.floor(expectedValue / bucketSize);

  const killThresholds: number[] = [];
  for (let k = 1; k <= 5; k++) {
    const dmgNeeded = k * woundsPerModel;
    const bucket = bucketSize === 1 ? dmgNeeded : Math.floor(dmgNeeded / bucketSize);
    if (bucket > 0 && bucket < bucketProbs.length && !killThresholds.includes(bucket)) {
      killThresholds.push(bucket);
    }
  }

  return (
    <div className="bg-[#14142a] border border-[#1a1a2e] rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-bold text-[#C5A33E]">{label}</h4>
      <div className="flex items-end gap-px h-40">
        {bucketProbs.map((p, i) => {
          const height = maxProb > 0 ? (p / maxProb) * 100 : 0;
          const isExpected = i === expectedBucket;
          const isKillThreshold = killThresholds.includes(i);
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
              <div className={`w-full rounded-t transition-all ${
                isExpected ? 'bg-[#C5A33E]' : isKillThreshold ? 'bg-red-500' : 'bg-[#4a3a7f]'
              } group-hover:opacity-80`} style={{ height: `${Math.max(height, 0.5)}%` }} />
              <div className="absolute bottom-full mb-1 hidden group-hover:block z-10 bg-[#0a0a14] border border-[#3a3a5e] rounded px-2 py-1 text-xs whitespace-nowrap pointer-events-none">
                <div className="text-gray-200">{bucketLabels[i]} damage</div>
                <div className="text-[#C5A33E]">{fmtPct(p)}% chance</div>
                <div className="text-gray-400">{fmtPct(cumulativeAtLeast[i])}% chance of {bucketLabels[i]}+</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-px text-xs text-gray-500 overflow-hidden">
        {bucketProbs.map((_, i) => (
          <div key={i} className="flex-1 text-center truncate">{bucketLabels[i]}</div>
        ))}
      </div>
      <div className="flex gap-3 text-xs text-gray-400">
        <span><span className="inline-block w-2 h-2 rounded-sm bg-[#C5A33E] mr-1" />Expected ({fmt(expectedValue)})</span>
        {killThresholds.length > 0 && (
          <span><span className="inline-block w-2 h-2 rounded-sm bg-red-500 mr-1" />Model kill threshold</span>
        )}
      </div>
    </div>
  );
}

function ModelsKilledChart({ dist, expectedValue, label }: {
  dist: number[]; expectedValue: number; label: string;
}) {
  const maxProb = Math.max(...dist, 0.01);
  let cumulative = 0;
  const cumulativeAtLeast: number[] = [];
  for (let i = dist.length - 1; i >= 0; i--) {
    cumulative += dist[i];
    cumulativeAtLeast[i] = cumulative;
  }

  return (
    <div className="bg-[#14142a] border border-[#1a1a2e] rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-bold text-[#C5A33E]">{label}</h4>
      <div className="flex items-end gap-1 h-40">
        {dist.map((p, i) => {
          const height = maxProb > 0 ? (p / maxProb) * 100 : 0;
          const isExpected = i === expectedValue;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
              <div className="text-xs text-gray-400 mb-1 opacity-0 group-hover:opacity-100">{fmtPct(p)}%</div>
              <div className={`w-full rounded-t transition-all ${isExpected ? 'bg-[#C5A33E]' : 'bg-red-700'} group-hover:opacity-80`}
                style={{ height: `${Math.max(height, 1)}%` }} />
              <div className="absolute bottom-full mb-6 hidden group-hover:block z-10 bg-[#0a0a14] border border-[#3a3a5e] rounded px-2 py-1 text-xs whitespace-nowrap pointer-events-none">
                <div className="text-gray-200">{i} model{i !== 1 ? 's' : ''} killed</div>
                <div className="text-[#C5A33E]">{fmtPct(p)}% chance exactly</div>
                <div className="text-gray-400">{fmtPct(cumulativeAtLeast[i])}% chance of {i}+</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 text-xs text-gray-400">
        {dist.map((_, i) => <div key={i} className="flex-1 text-center">{i}</div>)}
      </div>
      <div className="text-xs text-gray-400">
        <span className="inline-block w-2 h-2 rounded-sm bg-[#C5A33E] mr-1" />Expected ({expectedValue})
      </div>
    </div>
  );
}

// ============================================================
// Combobox
// ============================================================

interface ComboboxOption {
  value: string;
  label: string;
  detail?: string;
}

function Combobox({ options, value, onChange, placeholder, disabled }: {
  options: ComboboxOption[]; value: string; onChange: (value: string) => void;
  placeholder?: string; disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = options.find(o => o.value === value);
  const selectedLabel = selectedOption ? (selectedOption.detail ? `${selectedOption.label} (${selectedOption.detail})` : selectedOption.label) : '';

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q) || (o.detail && o.detail.toLowerCase().includes(q)));
  }, [options, query]);

  const clampedHighlight = filtered.length > 0 ? Math.min(highlightIndex, filtered.length - 1) : 0;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false); setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.children[clampedHighlight] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [clampedHighlight, open]);

  const handleSelect = (val: string) => { onChange(val); setOpen(false); setQuery(''); inputRef.current?.blur(); };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') { setOpen(true); e.preventDefault(); }
      return;
    }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setHighlightIndex(i => Math.min(i + 1, filtered.length - 1)); break;
      case 'ArrowUp': e.preventDefault(); setHighlightIndex(i => Math.max(i - 1, 0)); break;
      case 'Enter': e.preventDefault(); if (filtered[clampedHighlight]) handleSelect(filtered[clampedHighlight].value); break;
      case 'Escape': setOpen(false); setQuery(''); break;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <input ref={inputRef} type="text" className={selectClass}
        placeholder={disabled ? placeholder : (value ? selectedLabel : placeholder)}
        value={open ? query : (value ? selectedLabel : '')}
        disabled={disabled}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onKeyDown={handleKeyDown} />
      {open && filtered.length > 0 && (
        <ul ref={listRef} className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-[#14142a] border-2 border-[#3a3a5e] rounded-lg shadow-lg">
          {filtered.map((opt, i) => (
            <li key={opt.value}
              className={`px-3 py-2 cursor-pointer text-sm ${i === clampedHighlight ? 'bg-[#4a3a0f] text-[#C5A33E]' : 'text-gray-200 hover:bg-[#1e1e3a]'}`}
              onMouseEnter={() => setHighlightIndex(i)}
              onMouseDown={e => { e.preventDefault(); handleSelect(opt.value); }}>
              <span>{opt.label}</span>
              {opt.detail && <span className="ml-2 text-xs text-gray-500">{opt.detail}</span>}
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && query && (
        <div className="absolute z-50 w-full mt-1 px-3 py-2 bg-[#14142a] border-2 border-[#3a3a5e] rounded-lg text-sm text-gray-500">No matches</div>
      )}
    </div>
  );
}
