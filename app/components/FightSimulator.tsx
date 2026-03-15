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

  // Auto-populate invuln/FNP from datasheet when defender unit changes
  const handleDefenderUnitChange = useCallback((unitName: string) => {
    setDefenderUnit(unitName);
    const unit = defenderCatalogue?.units.find(u => u.name === unitName);
    if (unit) {
      setDefenderInvuln(unit.invulnSave ? unit.invulnSave.replace('+', '') : '');
      setDefenderFnp(unit.fnp ? unit.fnp.replace('+', '') : '');
    } else {
      setDefenderInvuln('');
      setDefenderFnp('');
    }
  }, [defenderCatalogue]);

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

          {selectedAttackerUnit && (
            <UnitDatasheet unit={selectedAttackerUnit} />
          )}

          {availableWeapons.length > 0 && (
            <div className="space-y-2">
              <label className={labelClass}>Weapon</label>
              <WeaponTable
                weapons={availableWeapons}
                selectedWeapon={attackerWeapon}
                onSelect={setAttackerWeapon}
                isMelee={combatMode === 'melee'}
              />
            </div>
          )}
          {selectedAttackerUnit && availableWeapons.length === 0 && (
            <div className="text-sm text-gray-500">No {combatMode} weapons</div>
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
              onChange={handleDefenderUnitChange}
              placeholder={loadingDefender ? 'Loading...' : 'Type to search units...'}
              disabled={loadingDefender || !defenderCatalogue}
            />
          </div>

          {selectedDefenderUnit && (
            <UnitDatasheet unit={selectedDefenderUnit} />
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
      {result && selectedWeapon && (
        <div className="bg-[#14142a] border border-[#C5A33E] rounded-lg p-5 space-y-4">
          <h3 className="text-lg font-bold text-[#C5A33E]">Attack Breakdown</h3>

          {/* Weapon profile reminder */}
          <div className="bg-[#0a0a14] rounded-lg border border-[#1a1a2e] p-3">
            <div className="text-sm font-semibold text-gray-200 mb-1">{selectedWeapon.name}</div>
            <div className="flex gap-4 text-sm text-gray-400">
              <span>A: {selectedWeapon.A}</span>
              <span>{combatMode === 'shooting' ? 'BS' : 'WS'}: {combatMode === 'shooting' ? selectedWeapon.BS : selectedWeapon.WS}</span>
              <span>S: {selectedWeapon.S}</span>
              <span>AP: {selectedWeapon.AP}</span>
              <span>D: {selectedWeapon.D}</span>
            </div>
            {selectedWeapon.keywords && selectedWeapon.keywords !== '-' && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {parseKeywords(selectedWeapon.keywords).map(kw => (
                  <span key={kw} className="px-1.5 py-0.5 text-xs bg-[#4a3a0f] text-[#C5A33E] rounded">{kw}</span>
                ))}
              </div>
            )}
          </div>

          {/* Pipeline steps */}
          <div className="space-y-3">
            <PipelineStep
              step="1. Attacks"
              result={fmt(result.expectedAttacks)}
              detail={`${attackerModels} model${attackerModels > 1 ? 's' : ''} x ${selectedWeapon.A} attacks`}
              notes={[
                ...(result.expectedAttacks !== attackerModels * parseStatValue(selectedWeapon.A) ?
                  [`Modified to ${fmt(result.expectedAttacks)} total`] : []),
              ]}
            />
            <PipelineStep
              step="2. Hit Roll"
              result={`${fmt(result.expectedHits)} hits`}
              detail={result.hitRollNeeded === null
                ? 'Auto-hit (Torrent)'
                : `${result.hitRollNeeded}+ needed (${frac(result.hitProbability)})`}
              notes={result.hitNotes}
            />
            <PipelineStep
              step="3. Wound Roll"
              result={`${fmt(result.expectedWounds)} wounds`}
              detail={`${result.woundRollNeeded}+ needed (${frac(result.woundProbability)})`}
              notes={result.woundNotes}
            />
            <PipelineStep
              step="4. Save Roll"
              result={`${fmt(result.expectedUnsavedWounds)} unsaved`}
              detail={result.saveRollNeeded <= 7
                ? `Defender needs ${result.saveRollNeeded}+ to save (${frac(1 - result.saveFailProbability)} chance), fails ${(result.saveFailProbability * 100).toFixed(0)}%`
                : 'No save possible'}
              notes={result.saveNotes}
            />
            <PipelineStep
              step="5. Damage"
              result={`${fmt(result.expectedDamage)} total damage`}
              detail={`${fmt(result.expectedUnsavedWounds)} unsaved wounds x ${fmt(result.expectedDamagePerWound)} avg damage`}
              notes={result.damageNotes}
              highlight
            />
          </div>

          {/* Final summary */}
          <div className="border-t border-[#C5A33E] pt-3 flex items-center justify-between">
            <div>
              <span className="text-2xl font-bold text-[#C5A33E]">{fmt(result.expectedDamage)}</span>
              <span className="text-gray-400 ml-2">expected damage</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-[#C5A33E]">{result.expectedModelsKilled}</span>
              <span className="text-gray-400 ml-2">models killed</span>
              {selectedDefenderUnit && selectedDefenderUnit.stats[0] && (
                <span className="text-gray-500 text-sm ml-1">({selectedDefenderUnit.stats[0].W}W each)</span>
              )}
            </div>
          </div>

          {result.expectedSelfMortals > 0 && (
            <div className="text-sm text-yellow-400">
              Hazardous: ~{fmt(result.expectedSelfMortals)} expected mortal wounds to self
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

/** Format a number: integers as-is, decimals to 2 places */
function fmt(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}

/** Format a probability as a fraction like "4/6" */
function frac(p: number): string {
  // Find the closest N/6
  const sixths = Math.round(p * 6);
  if (sixths === 6) return '6/6';
  if (sixths === 0) return '0/6';
  return `${sixths}/6`;
}

function PipelineStep({ step, result, detail, notes, highlight }: {
  step: string;
  result: string;
  detail: string;
  notes: string[];
  highlight?: boolean;
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
          {notes.map((note, i) => (
            <div key={i} className="text-xs text-gray-500">
              {note}
            </div>
          ))}
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

function UnitDatasheet({ unit }: { unit: Unit }) {
  return (
    <div className="bg-[#0a0a14] rounded-lg border border-[#1a1a2e] p-3 space-y-3">
      {/* Unit Stats */}
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

      {/* Invuln / FNP badges */}
      {(unit.invulnSave || unit.fnp) && (
        <div className="flex gap-2">
          {unit.invulnSave && (
            <span className="px-2 py-0.5 text-xs font-semibold bg-purple-900 text-purple-200 rounded">
              Invuln {unit.invulnSave}
            </span>
          )}
          {unit.fnp && (
            <span className="px-2 py-0.5 text-xs font-semibold bg-green-900 text-green-200 rounded">
              FNP {unit.fnp}
            </span>
          )}
        </div>
      )}

      {/* Keywords */}
      {unit.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {unit.keywords.map(kw => (
            <span key={kw} className="px-1.5 py-0.5 text-xs bg-[#1a1a2e] text-gray-400 rounded">{kw}</span>
          ))}
        </div>
      )}

      {/* Abilities */}
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

function WeaponTable({ weapons, selectedWeapon, onSelect, isMelee }: {
  weapons: Weapon[];
  selectedWeapon: string;
  onSelect: (name: string) => void;
  isMelee: boolean;
}) {
  const skillLabel = isMelee ? 'WS' : 'BS';
  return (
    <div className="overflow-x-auto rounded-lg border-2 border-[#3a3a5e]">
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
              <tr
                key={w.name}
                onClick={() => onSelect(w.name)}
                className={`cursor-pointer border-b border-[#1a1a2e] transition-colors ${
                  isSelected
                    ? 'bg-[#4a3a0f] text-[#C5A33E]'
                    : 'bg-[#0a0a14] text-gray-300 hover:bg-[#1e1e3a]'
                }`}
              >
                <td className="px-2 py-1.5 font-medium whitespace-nowrap">{w.name}</td>
                <td className="text-center px-2 py-1.5">{w.A}</td>
                <td className="text-center px-2 py-1.5">{isMelee ? w.WS : w.BS}</td>
                <td className="text-center px-2 py-1.5">{w.S}</td>
                <td className="text-center px-2 py-1.5">{w.AP}</td>
                <td className="text-center px-2 py-1.5">{w.D}</td>
                <td className="px-2 py-1.5 text-xs">
                  {w.keywords && w.keywords !== '-' && (
                    <span className={isSelected ? 'text-[#C5A33E] opacity-80' : 'text-gray-500'}>
                      {w.keywords}
                    </span>
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
