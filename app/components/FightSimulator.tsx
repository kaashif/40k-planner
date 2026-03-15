'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  calculateResults,
  calculateDistribution,
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

export default function FightSimulator() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Global unit index
  const [allGlobalUnits, setAllGlobalUnits] = useState<GlobalUnit[]>([]);
  const [globalUnitsLoading, setGlobalUnitsLoading] = useState(true);

  // Read initial state from URL params
  const urlAtk = searchParams.get('atk') || ''; // "unitName||factionSlug"
  const urlDef = searchParams.get('def') || '';
  const urlWep = searchParams.get('wep') || '';
  const urlAtkModels = searchParams.get('atkn') || '';
  const urlDefModels = searchParams.get('defn') || '';

  // Attacker state
  const [attackerUnitKey, setAttackerUnitKey] = useState(urlAtk);
  const [attackerCatalogue, setAttackerCatalogue] = useState<CatalogueData | null>(null);
  const [attackerWeapon, setAttackerWeapon] = useState(urlWep);
  const [attackerModels, setAttackerModels] = useState(urlAtkModels ? parseInt(urlAtkModels) || 1 : 1);
  const [loadingAttacker, setLoadingAttacker] = useState(false);

  // Defender state
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

  // Catalogue cache to avoid refetching
  const catalogueCacheRef = useRef<Map<string, CatalogueData>>(new Map());

  // Update URL with current selections
  const updateUrl = useCallback((overrides: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    // Always keep tab=simulator
    params.set('tab', 'simulator');
    for (const [key, value] of Object.entries(overrides)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    router.replace(`/?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  // Fetch global unit index, then load catalogues for URL-specified units
  useEffect(() => {
    fetch('/api/datasheets/all-units')
      .then(r => r.json())
      .then(async (units: GlobalUnit[]) => {
        setAllGlobalUnits(units);
        setGlobalUnitsLoading(false);

        // Load attacker catalogue from URL
        if (urlAtk) {
          const [, atkFaction] = urlAtk.split('||');
          if (atkFaction) {
            setLoadingAttacker(true);
            const data = await fetchCatalogue(atkFaction);
            setAttackerCatalogue(data);
            setLoadingAttacker(false);
          }
        }
        // Load defender catalogue from URL
        if (urlDef) {
          const [defName, defFaction] = urlDef.split('||');
          if (defFaction) {
            setLoadingDefender(true);
            const data = await fetchCatalogue(defFaction);
            setDefenderCatalogue(data);
            setLoadingDefender(false);
            // Auto-populate invuln/FNP
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

  // Build combobox options from global units
  const globalUnitOptions = useMemo(() =>
    allGlobalUnits.map(u => ({
      value: `${u.name}||${u.factionSlug}`,
      label: u.name,
      detail: u.factionName.replace(/^(Chaos|Imperium|Aeldari|Xenos) - /, ''),
    })),
    [allGlobalUnits]
  );

  // Fetch a catalogue (with caching)
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

  // Handle attacker unit selection
  const handleAttackerUnitChange = useCallback(async (key: string) => {
    setAttackerUnitKey(key);
    setAttackerWeapon('');
    updateUrl({ atk: key, wep: '' });
    if (!key) { setAttackerCatalogue(null); return; }
    const [, factionSlug] = key.split('||');
    setLoadingAttacker(true);
    const data = await fetchCatalogue(factionSlug);
    setAttackerCatalogue(data);
    setLoadingAttacker(false);
  }, [fetchCatalogue, updateUrl]);

  // Handle attacker weapon selection
  const handleWeaponSelect = useCallback((name: string) => {
    setAttackerWeapon(name);
    updateUrl({ wep: name });
  }, [updateUrl]);

  // Handle defender unit selection
  const handleDefenderUnitChange = useCallback(async (key: string) => {
    setDefenderUnitKey(key);
    updateUrl({ def: key });
    if (!key) { setDefenderCatalogue(null); setDefenderInvuln(''); setDefenderFnp(''); return; }
    const [unitName, factionSlug] = key.split('||');
    setLoadingDefender(true);
    const data = await fetchCatalogue(factionSlug);
    setDefenderCatalogue(data);
    setLoadingDefender(false);
    // Auto-populate invuln/FNP
    const unit = data?.units.find(u => u.name === unitName);
    if (unit) {
      setDefenderInvuln(unit.invulnSave ? unit.invulnSave.replace('+', '') : '');
      setDefenderFnp(unit.fnp ? unit.fnp.replace('+', '') : '');
    }
  }, [fetchCatalogue, updateUrl]);

  // Handle model count changes with URL sync
  const handleAttackerModelsChange = useCallback((n: number) => {
    setAttackerModels(n);
    updateUrl({ atkn: n > 1 ? n.toString() : '' });
  }, [updateUrl]);

  const handleDefenderModelsChange = useCallback((n: number) => {
    setDefenderModels(n);
    updateUrl({ defn: n > 1 ? n.toString() : '' });
  }, [updateUrl]);

  // Resolve selected units from catalogues
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

  // All weapons combined: ranged then melee
  const allWeapons = useMemo(() => {
    if (!selectedAttackerUnit) return { ranged: [] as Weapon[], melee: [] as Weapon[] };
    return {
      ranged: selectedAttackerUnit.rangedWeapons,
      melee: selectedAttackerUnit.meleeWeapons,
    };
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

  // Compute results
  const result: CombatResult | null = useMemo(() => {
    if (!selectedWeapon || !selectedDefenderUnit) return null;

    const defStats = selectedDefenderUnit.stats[0];
    if (!defStats) return null;

    const skill = parseStatValue(isMeleeWeapon ? (selectedWeapon.WS || '4+') : (selectedWeapon.BS || '4+'));
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
      rapidFire, isMeleeWeapon]);

  // Compute full probability distribution
  const distribution: DistributionResult | null = useMemo(() => {
    if (!selectedWeapon || !selectedDefenderUnit || !result) return null;

    const defStats = selectedDefenderUnit.stats[0];
    if (!defStats) return null;

    const skill = parseStatValue(isMeleeWeapon ? (selectedWeapon.WS || '4+') : (selectedWeapon.BS || '4+'));
    const weaponKw = parseKeywords(selectedWeapon.keywords);

    const attacker: AttackerInput = {
      attacks: selectedWeapon.A,
      skill,
      strength: parseStatValue(selectedWeapon.S),
      ap: Math.abs(parseStatValue(selectedWeapon.AP)),
      damage: selectedWeapon.D,
      keywords: weaponKw,
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

    const modifiers: ModifierToggles = { stationary, charged, halfRange, cover, rapidFire };

    return calculateDistribution(attacker, defender, modifiers, result);
  }, [selectedWeapon, selectedDefenderUnit, result, attackerModels, defenderModels,
      defenderInvuln, defenderFnp, stationary, charged, halfRange, cover,
      rapidFire, isMeleeWeapon]);

  // Check which modifier toggles are relevant
  const weaponKeywords = selectedWeapon ? parseKeywords(selectedWeapon.keywords) : [];
  const showHeavy = weaponKeywords.some(k => k.toLowerCase() === 'heavy');
  const showLance = weaponKeywords.some(k => k.toLowerCase() === 'lance');
  const showMelta = weaponKeywords.some(k => k.toLowerCase().startsWith('melta'));
  const showRapidFire = weaponKeywords.some(k => k.toLowerCase().startsWith('rapid fire'));

  const comboboxPlaceholder = globalUnitsLoading ? 'Loading units...' : 'Type to search all units...';

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-[#C5A33E]">Fight Simulator</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attacker Panel */}
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

          {selectedAttackerUnit && (
            <UnitDatasheet unit={selectedAttackerUnit} />
          )}

          {(allWeapons.ranged.length > 0 || allWeapons.melee.length > 0) && (
            <div className="space-y-2">
              <label className={labelClass}>Weapon</label>
              {allWeapons.ranged.length > 0 && (
                <WeaponTable
                  weapons={allWeapons.ranged}
                  selectedWeapon={attackerWeapon}
                  onSelect={handleWeaponSelect}
                  isMelee={false}
                  label="Ranged"
                />
              )}
              {allWeapons.melee.length > 0 && (
                <WeaponTable
                  weapons={allWeapons.melee}
                  selectedWeapon={attackerWeapon}
                  onSelect={handleWeaponSelect}
                  isMelee={true}
                  label="Melee"
                />
              )}
            </div>
          )}
          {selectedAttackerUnit && allWeapons.ranged.length === 0 && allWeapons.melee.length === 0 && (
            <div className="text-sm text-gray-500">No weapons</div>
          )}

          <div className="space-y-2">
            <label className={labelClass}>Number of models attacking</label>
            <input
              type="number"
              min={1}
              max={30}
              value={attackerModels}
              onChange={e => handleAttackerModelsChange(Math.max(1, parseInt(e.target.value) || 1))}
              className={inputClass}
            />
          </div>
        </div>

        {/* Defender Panel */}
        <div className="bg-[#14142a] border border-[#1a1a2e] rounded-lg p-4 space-y-3">
          <h3 className="text-lg font-bold text-blue-400">Defender</h3>

          <div className="space-y-2">
            <label className={labelClass}>Unit</label>
            <Combobox
              options={globalUnitOptions}
              value={defenderUnitKey}
              onChange={handleDefenderUnitChange}
              placeholder={comboboxPlaceholder}
              disabled={globalUnitsLoading}
            />
            {loadingDefender && <div className="text-xs text-gray-500">Loading datasheet...</div>}
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
                onChange={e => handleDefenderModelsChange(Math.max(1, parseInt(e.target.value) || 1))}
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
              <span>{isMeleeWeapon ? 'WS' : 'BS'}: {isMeleeWeapon ? selectedWeapon.WS : selectedWeapon.BS}</span>
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

          {/* Summary stats table */}
          {distribution && (
            <div className="border-t border-[#C5A33E] pt-3">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[#3a3a5e]">
                    <th className="text-left py-1.5 text-gray-400 font-normal"></th>
                    <th className="text-center py-1.5 text-gray-300 font-semibold px-3">Mean</th>
                    <th className="text-center py-1.5 text-gray-300 font-semibold px-3">Median</th>
                    <th className="text-center py-1.5 text-gray-300 font-semibold px-3">75th %ile</th>
                    <th className="text-center py-1.5 text-gray-300 font-semibold px-3">Max</th>
                  </tr>
                </thead>
                <tbody>
                  <StatsRow label="Attacks" dist={distribution.attacksDist} />
                  <StatsRow label="Hits" dist={distribution.hitsDist} />
                  <StatsRow label="Wounds" dist={distribution.woundsDist} />
                  <StatsRow label="Unsaved wounds" dist={distribution.unsavedWoundsDist} />
                  <StatsRow label="Damage" dist={distribution.damageDist} highlight />
                  <StatsRow
                    label={
                      <>
                        Models killed
                        {selectedDefenderUnit && selectedDefenderUnit.stats[0] && (
                          <span className="text-gray-500 text-xs ml-1">({selectedDefenderUnit.stats[0].W}W)</span>
                        )}
                      </>
                    }
                    dist={distribution.modelsKilledDist}
                    highlight
                  />
                </tbody>
              </table>
            </div>
          )}
          {!distribution && (
            <div className="border-t border-[#C5A33E] pt-3 flex items-center justify-between">
              <div>
                <span className="text-2xl font-bold text-[#C5A33E]">{fmt(result.expectedDamage)}</span>
                <span className="text-gray-400 ml-2">expected damage</span>
              </div>
              <div>
                <span className="text-2xl font-bold text-[#C5A33E]">{result.expectedModelsKilled}</span>
                <span className="text-gray-400 ml-2">models killed</span>
              </div>
            </div>
          )}

          {result.expectedSelfMortals > 0 && (
            <div className="text-sm text-yellow-400">
              Hazardous: ~{fmt(result.expectedSelfMortals)} expected mortal wounds to self
            </div>
          )}
        </div>
      )}

      {/* Distribution Charts */}
      {distribution && result && selectedDefenderUnit && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DamageDistChart
            dist={distribution.damageDist}
            expectedValue={result.expectedDamage}
            woundsPerModel={parseStatValue(selectedDefenderUnit.stats[0]?.W || '1')}
            label="Damage Distribution"
          />
          <ModelsKilledChart
            dist={distribution.modelsKilledDist}
            expectedValue={result.expectedModelsKilled}
            label="Models Killed Distribution"
          />
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

/** Format a percentage with enough decimals to show the first non-zero digit */
function fmtPct(p: number): string {
  const pct = p * 100;
  if (pct === 0) return '0';
  if (pct >= 1) return pct.toFixed(1);
  // Find how many decimals needed to show first non-zero digit
  const digits = Math.max(1, Math.ceil(-Math.log10(pct)) + 1);
  return pct.toFixed(digits);
}

/** Format a number: integers as-is, decimals to 2 places */
function fmt(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}

/** Compute percentile from a distribution: smallest k where CDF >= p */
function percentile(dist: number[], p: number): number {
  let cumulative = 0;
  for (let i = 0; i < dist.length; i++) {
    cumulative += dist[i];
    if (cumulative >= p - 1e-9) return i;
  }
  return dist.length - 1;
}

/** Get max non-zero value from distribution */
function distMax(dist: number[]): number {
  for (let i = dist.length - 1; i >= 0; i--) {
    if (dist[i] > 1e-9) return i;
  }
  return 0;
}

/** Compute mean of a distribution */
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
      <td className={`py-1.5 font-semibold ${highlight ? 'text-[#C5A33E]' : 'text-gray-300'}`}>{label}</td>
      <td className={`text-center py-1.5 px-3 font-bold ${highlight ? 'text-[#C5A33E]' : 'text-gray-200'}`}>{distMean(dist).toFixed(2)}</td>
      <td className="text-center py-1.5 text-gray-200 px-3">{percentile(dist, 0.5).toFixed(2)}</td>
      <td className="text-center py-1.5 text-gray-200 px-3">{percentile(dist, 0.75).toFixed(2)}</td>
      <td className="text-center py-1.5 text-gray-200 px-3">{distMax(dist).toFixed(2)}</td>
    </tr>
  );
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

function WeaponTable({ weapons, selectedWeapon, onSelect, isMelee, label }: {
  weapons: Weapon[];
  selectedWeapon: string;
  onSelect: (name: string) => void;
  isMelee: boolean;
  label?: string;
}) {
  const skillLabel = isMelee ? 'WS' : 'BS';
  return (
    <div className="overflow-x-auto rounded-lg border-2 border-[#3a3a5e]">
      {label && (
        <div className="bg-[#0a0a14] px-2 py-1 text-xs font-semibold text-gray-400 border-b border-[#3a3a5e]">{label}</div>
      )}
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

function DamageDistChart({ dist, expectedValue, woundsPerModel, label }: {
  dist: number[];
  expectedValue: number;
  woundsPerModel: number;
  label: string;
}) {
  // Trim trailing near-zero entries and bucket if too many bars
  const trimmed = [...dist];
  while (trimmed.length > 1 && trimmed[trimmed.length - 1] < 1e-6) trimmed.pop();

  // Bucket into groups if distribution is wide
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

  // Cumulative probabilities
  let cumulative = 0;
  const cumulativeAtLeast: number[] = [];
  for (let i = bucketProbs.length - 1; i >= 0; i--) {
    cumulative += bucketProbs[i];
    cumulativeAtLeast[i] = cumulative;
  }

  // Find which bucket the expected value falls in
  const expectedBucket = bucketSize === 1 ? Math.round(expectedValue) : Math.floor(expectedValue / bucketSize);

  // Model kill thresholds
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
              <div
                className={`w-full rounded-t transition-all ${
                  isExpected ? 'bg-[#C5A33E]' : isKillThreshold ? 'bg-red-500' : 'bg-[#4a3a7f]'
                } group-hover:opacity-80`}
                style={{ height: `${Math.max(height, 0.5)}%` }}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 hidden group-hover:block z-10 bg-[#0a0a14] border border-[#3a3a5e] rounded px-2 py-1 text-xs whitespace-nowrap pointer-events-none">
                <div className="text-gray-200">{bucketLabels[i]} damage</div>
                <div className="text-[#C5A33E]">{fmtPct(p)}% chance</div>
                <div className="text-gray-400">{fmtPct(cumulativeAtLeast[i])}% chance of {bucketLabels[i]}+</div>
              </div>
            </div>
          );
        })}
      </div>
      {/* X-axis labels */}
      <div className="flex gap-px text-xs text-gray-500 overflow-hidden">
        {bucketProbs.map((_, i) => (
          <div key={i} className="flex-1 text-center truncate">
            {bucketLabels[i]}
          </div>
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
  dist: number[];
  expectedValue: number;
  label: string;
}) {
  const maxProb = Math.max(...dist, 0.01);

  // Cumulative: P(killed >= k)
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
              <div
                className={`w-full rounded-t transition-all ${
                  isExpected ? 'bg-[#C5A33E]' : 'bg-red-700'
                } group-hover:opacity-80`}
                style={{ height: `${Math.max(height, 1)}%` }}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full mb-6 hidden group-hover:block z-10 bg-[#0a0a14] border border-[#3a3a5e] rounded px-2 py-1 text-xs whitespace-nowrap pointer-events-none">
                <div className="text-gray-200">{i} model{i !== 1 ? 's' : ''} killed</div>
                <div className="text-[#C5A33E]">{fmtPct(p)}% chance exactly</div>
                <div className="text-gray-400">{fmtPct(cumulativeAtLeast[i])}% chance of {i}+</div>
              </div>
            </div>
          );
        })}
      </div>
      {/* X-axis labels */}
      <div className="flex gap-1 text-xs text-gray-400">
        {dist.map((_, i) => (
          <div key={i} className="flex-1 text-center">{i}</div>
        ))}
      </div>
      <div className="text-xs text-gray-400">
        <span className="inline-block w-2 h-2 rounded-sm bg-[#C5A33E] mr-1" />Expected ({expectedValue})
      </div>
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

  const selectedOption = options.find(o => o.value === value);
  const selectedLabel = selectedOption ? (selectedOption.detail ? `${selectedOption.label} (${selectedOption.detail})` : selectedOption.label) : '';

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter(o =>
      o.label.toLowerCase().includes(q) ||
      (o.detail && o.detail.toLowerCase().includes(q))
    );
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
