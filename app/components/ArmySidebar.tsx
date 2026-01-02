'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { SpawnedGroup, SpawnedUnit } from '../types';
import { checkCoherency, checkParentUnitCoherency } from '../utils/coherencyChecker';

interface Unit {
  name: string;
  type: string;
  number: number;
}

interface UnitWithBase extends Unit {
  baseSize?: string;
  id: string;
  width?: string;
  length?: string;
  parentUnitId?: string; // Track parent unit's unique ID
  parentUnitName?: string; // Track parent unit's name for display
}

interface Weapon {
  name: string;
  type: 'Melee' | 'Ranged';
  range: string;
  attacks: string;
  skill: string;
  strength: string;
  ap: string;
  damage: string;
  keywords: string;
}

interface ArmyUnit {
  name: string;
  parentUnitName?: string;
  stats?: {
    M: string;
    T: string;
    SV: string;
    W: string;
    LD: string;
    OC: string;
  };
  invulnSave?: string;
  invulnFromLeader?: string;
  fnp?: string;
  fnpFromLeader?: string;
  // For leaders - what buffs they grant
  grantsInvuln?: string;
  grantsFnp?: string;
  weapons?: Weapon[];
}

interface ArmySidebarProps {
  onSpawn: (unit: SpawnedUnit) => void;
  onDelete: (unitId: string) => void;
  spawnedUnits: Set<string>;
  spawnedGroups: SpawnedGroup[];
  onSelectAll: (models: { groupId: string; modelId: string }[]) => void;
  onArmyDataUpdate: (units: ArmyUnit[]) => void;
  reserveUnits: Set<string>;
  onReserveChange: (unitId: string, isReserve: boolean) => void;
  onUnitIdsUpdate: (unitIds: string[]) => void;
}

export default function ArmySidebar({ onSpawn, onDelete, spawnedUnits, spawnedGroups, onSelectAll, onArmyDataUpdate, reserveUnits, onReserveChange, onUnitIdsUpdate }: ArmySidebarProps) {
  const [units, setUnits] = useState<UnitWithBase[]>([]);
  const [baseSizes, setBaseSizes] = useState<{ [key: string]: string }>({});
  const [flyDimensions, setFlyDimensions] = useState<{ [key: string]: { width: string; length: string } }>({});
  const [isRectangular, setIsRectangular] = useState<{ [key: string]: boolean }>({});
  const [defaultBaseSizes, setDefaultBaseSizes] = useState<{ [key: string]: string | { width: string; length: string } }>({});
  const [overrideBaseSizes, setOverrideBaseSizes] = useState<{ [key: string]: string | { width: string; length: string } }>({});
  const [leaderAssignments, setLeaderAssignments] = useState<{ [leaderName: string]: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasLoadedExampleArmy = useRef(false);

  const extractStatsFromProfiles = (profiles: any[]): {
    stats?: ArmyUnit['stats'];
    invulnSave?: string;
    fnp?: string;
    grantsInvuln?: string;
    grantsFnp?: string;
  } => {
    // Find unit profile
    const unitProfile = profiles.find((p: any) => p.typeName === 'Unit');
    let stats;
    if (unitProfile && unitProfile.characteristics) {
      stats = {
        M: unitProfile.characteristics.find((c: any) => c.name === 'M')?.$text || '-',
        T: unitProfile.characteristics.find((c: any) => c.name === 'T')?.$text || '-',
        SV: unitProfile.characteristics.find((c: any) => c.name === 'SV')?.$text || '-',
        W: unitProfile.characteristics.find((c: any) => c.name === 'W')?.$text || '-',
        LD: unitProfile.characteristics.find((c: any) => c.name === 'LD')?.$text || '-',
        OC: unitProfile.characteristics.find((c: any) => c.name === 'OC')?.$text || '-',
      };
    }

    let invulnSave;
    let fnp;
    let grantsInvuln;
    let grantsFnp;

    // Search all abilities
    const abilities = profiles.filter((p: any) => p.typeName === 'Abilities');
    for (const ability of abilities) {
      const desc = ability.characteristics?.find((c: any) => c.name === 'Description')?.$text || '';

      // Check for inherent invulnerable save
      if (ability.name === 'Invulnerable Save') {
        const match = desc.match(/(\d\+)\s+invulnerable save/i);
        if (match) {
          invulnSave = match[1];
        }
      }

      // Check for inherent Feel No Pain
      if (desc.match(/has the Feel No Pain/i) && !desc.match(/leading a unit/i)) {
        const match = desc.match(/Feel No Pain\s+(\d\+)/i);
        if (match) {
          fnp = match[1];
        }
      }

      // Check for leader-granted invuln (while leading a unit)
      if (desc.match(/leading a unit/i) && desc.match(/invulnerable save/i)) {
        const match = desc.match(/(\d\+)\s+invulnerable save/i);
        if (match) {
          grantsInvuln = match[1];
        }
      }

      // Check for leader-granted FNP (while leading a unit)
      if (desc.match(/leading a unit/i) && desc.match(/Feel No Pain/i)) {
        const match = desc.match(/Feel No Pain\s+(\d\+)/i);
        if (match) {
          grantsFnp = match[1];
        }
      }
    }

    return { stats, invulnSave, fnp, grantsInvuln, grantsFnp };
  };

  const extractWeapons = (selections: any[]): Weapon[] => {
    const weapons: Weapon[] = [];
    const seenWeapons = new Set<string>();

    for (const sel of selections) {
      if (sel.profiles) {
        for (const profile of sel.profiles) {
          if (profile.typeName === 'Melee Weapons' || profile.typeName === 'Ranged Weapons') {
            const weaponKey = `${profile.name}-${profile.typeName}`;
            if (seenWeapons.has(weaponKey)) continue;
            seenWeapons.add(weaponKey);

            const chars = profile.characteristics || [];
            const isMelee = profile.typeName === 'Melee Weapons';

            weapons.push({
              name: profile.name,
              type: isMelee ? 'Melee' : 'Ranged',
              range: chars.find((c: any) => c.name === 'Range')?.$text || '-',
              attacks: chars.find((c: any) => c.name === 'A')?.$text || '-',
              skill: chars.find((c: any) => c.name === (isMelee ? 'WS' : 'BS'))?.$text || '-',
              strength: chars.find((c: any) => c.name === 'S')?.$text || '-',
              ap: chars.find((c: any) => c.name === 'AP')?.$text || '-',
              damage: chars.find((c: any) => c.name === 'D')?.$text || '-',
              keywords: chars.find((c: any) => c.name === 'Keywords')?.$text || '-',
            });
          }
        }
      }
    }

    return weapons;
  };

  const extractArmyUnits = (selections: any[]): ArmyUnit[] => {
    const armyUnits: ArmyUnit[] = [];

    for (const sel of selections) {
      // Skip non-model/non-unit selections
      if (sel.type !== 'model' && sel.type !== 'unit') continue;

      if (sel.type === 'unit' && sel.selections && sel.selections.length > 0) {
        // This is a unit with nested models
        const parentUnitName = sel.name;
        const nestedModels = sel.selections.filter(
          (nested: any) => nested.type === 'model'
        );

        // Check if nested models have their own profiles
        const nestedModelsWithProfiles = nestedModels.filter(
          (m: any) => m.profiles && m.profiles.some((p: any) => p.typeName === 'Unit')
        );

        if (nestedModelsWithProfiles.length > 0) {
          // Nested models have their own stats (e.g., The Silent King with Szarekh and Menhir)
          for (const model of nestedModelsWithProfiles) {
            const { stats, invulnSave, fnp, grantsInvuln, grantsFnp } = extractStatsFromProfiles(model.profiles || []);
            const weapons = extractWeapons(model.selections || []);
            if (stats || invulnSave || fnp) {
              armyUnits.push({
                name: model.name,
                parentUnitName,
                stats,
                invulnSave,
                fnp,
                grantsInvuln,
                grantsFnp,
                weapons
              });
            }
          }
        } else {
          // Nested models don't have stats - use parent unit stats (e.g., Necron Warriors)
          const { stats, invulnSave, fnp, grantsInvuln, grantsFnp } = extractStatsFromProfiles(sel.profiles || []);
          // Get weapons from all nested model selections
          const allWeapons: Weapon[] = [];
          for (const nested of nestedModels) {
            allWeapons.push(...extractWeapons(nested.selections || []));
          }
          if (stats || invulnSave || fnp) {
            armyUnits.push({
              name: parentUnitName,
              parentUnitName,
              stats,
              invulnSave,
              fnp,
              grantsInvuln,
              grantsFnp,
              weapons: allWeapons
            });
          }
        }
      } else if (sel.type === 'model') {
        // Standalone model
        const { stats, invulnSave, fnp, grantsInvuln, grantsFnp } = extractStatsFromProfiles(sel.profiles || []);
        const weapons = extractWeapons(sel.selections || []);
        if (stats || invulnSave || fnp) {
          armyUnits.push({
            name: sel.name,
            stats,
            invulnSave,
            fnp,
            grantsInvuln,
            grantsFnp,
            weapons
          });
        }
      }
    }

    return armyUnits;
  };

  const extractModels = (selections: any[]): UnitWithBase[] => {
    const models: UnitWithBase[] = [];
    let modelIndex = 0;

    for (const sel of selections) {
      // Skip non-model/non-unit selections
      if (sel.type !== 'model' && sel.type !== 'unit') continue;

      if (sel.type === 'unit' && sel.selections && sel.selections.length > 0) {
        // This is a unit with nested models
        const nestedModels = sel.selections.filter(
          (nested: any) => nested.type === 'model'
        );

        for (const model of nestedModels) {
          models.push({
            name: model.name,
            type: model.type,
            number: model.number || 1,
            id: `model-${modelIndex++}`,
            parentUnitId: sel.id, // Track the parent unit's unique ID
            parentUnitName: sel.name // Track the parent unit name for display
          });
        }
      } else if (sel.type === 'model') {
        // Standalone model without a parent unit
        models.push({
          name: sel.name,
          type: sel.type,
          number: sel.number || 1,
          id: `model-${modelIndex++}`,
          parentUnitId: undefined,
          parentUnitName: undefined
        });
      }
    }

    return models;
  };

  const applyLeaderAssignments = (models: UnitWithBase[]): UnitWithBase[] => {
    if (Object.keys(leaderAssignments).length === 0) return models;

    // Create a map of unit names to their IDs
    const unitMap = new Map<string, { id: string; name: string }>();
    models.forEach(model => {
      if (model.parentUnitId && model.parentUnitName) {
        unitMap.set(model.parentUnitName, {
          id: model.parentUnitId,
          name: model.parentUnitName
        });
      }
    });

    // Apply leader assignments
    return models.map(model => {
      // Check if this model is a leader
      const leadsUnitName = leaderAssignments[model.name];
      if (leadsUnitName) {
        // Find the unit this leader should join
        const ledUnit = unitMap.get(leadsUnitName);
        if (ledUnit) {
          return {
            ...model,
            parentUnitId: ledUnit.id,
            parentUnitName: ledUnit.name
          };
        }
      }
      return model;
    });
  };

  // Load leaders configuration and base sizes on mount
  useEffect(() => {
    const loadLeaders = async () => {
      try {
        const response = await fetch('/leaders.json');
        const data = await response.json();
        setLeaderAssignments(data.leaders || {});
      } catch (error) {
        console.error('Error loading leaders configuration:', error);
      }
    };

    loadLeaders();
  }, []);

  // Notify parent of all unit IDs when units change
  useEffect(() => {
    if (units.length > 0) {
      onUnitIdsUpdate(units.map(u => u.id));
    }
  }, [units, onUnitIdsUpdate]);

  // Load default base sizes from API and overrides from localStorage on mount
  useEffect(() => {
    const loadBaseSizes = async () => {
      try {
        // Load defaults from base_sizes.json
        const response = await fetch('/api/base-sizes');
        const defaults = await response.json();
        setDefaultBaseSizes(defaults);

        // Load overrides from localStorage
        const overrides = localStorage.getItem('baseSizeOverrides');
        if (overrides) {
          setOverrideBaseSizes(JSON.parse(overrides));
        }
      } catch (error) {
        console.error('Error loading base sizes:', error);
      }
    };

    loadBaseSizes();
  }, []);

  // Merge defaults and overrides
  const mergedBaseSizes = useMemo(
    () => ({ ...defaultBaseSizes, ...overrideBaseSizes }),
    [defaultBaseSizes, overrideBaseSizes]
  );

  // Load example army on mount
  useEffect(() => {
    const loadExampleArmy = async () => {
      try {
        const response = await fetch('/example.json');
        const data = await response.json();

        const selections = data.roster?.forces?.[0]?.selections || [];
        let models = extractModels(selections);
        models = applyLeaderAssignments(models);

        setUnits(models);

        // Extract and update army unit stats
        const armyUnits = extractArmyUnits(selections);
        onArmyDataUpdate(armyUnits);

        // Pre-populate base sizes from merged data (defaults + overrides)
        const initialBaseSizes: { [key: string]: string } = {};
        const initialFlyDimensions: { [key: string]: { width: string; length: string } } = {};
        const initialIsRectangular: { [key: string]: boolean } = {};

        models.forEach(model => {
          const saved = mergedBaseSizes[model.name];
          if (saved) {
            if (typeof saved === 'object' && 'width' in saved && 'length' in saved) {
              initialFlyDimensions[model.id] = saved as { width: string; length: string };
              initialIsRectangular[model.id] = true;
            } else if (typeof saved === 'string') {
              initialBaseSizes[model.id] = saved;
              initialIsRectangular[model.id] = false;
            }
          }
        });

        setBaseSizes(initialBaseSizes);
        setFlyDimensions(initialFlyDimensions);
        setIsRectangular(initialIsRectangular);
      } catch (error) {
        console.error('Error loading example army:', error);
      }
    };

    if (!hasLoadedExampleArmy.current &&
        Object.keys(mergedBaseSizes).length > 0 &&
        Object.keys(leaderAssignments).length > 0) {
      hasLoadedExampleArmy.current = true;
      loadExampleArmy();
    }
  }, [mergedBaseSizes, leaderAssignments]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleJsonImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Extract all selections from the force
        const selections = data.roster?.forces?.[0]?.selections || [];

        // Extract models from all selections (including nested)
        let models = extractModels(selections);
        models = applyLeaderAssignments(models);

        setUnits(models);

        // Extract and update army unit stats
        const armyUnits = extractArmyUnits(selections);
        onArmyDataUpdate(armyUnits);

        // Pre-populate base sizes from merged data (defaults + overrides)
        const initialBaseSizes: { [key: string]: string } = {};
        const initialFlyDimensions: { [key: string]: { width: string; length: string } } = {};
        const initialIsRectangular: { [key: string]: boolean } = {};

        models.forEach(model => {
          const saved = mergedBaseSizes[model.name];
          if (saved) {
            if (typeof saved === 'object' && 'width' in saved && 'length' in saved) {
              initialFlyDimensions[model.id] = saved as { width: string; length: string };
              initialIsRectangular[model.id] = true;
            } else if (typeof saved === 'string') {
              initialBaseSizes[model.id] = saved;
              initialIsRectangular[model.id] = false;
            }
          }
        });

        setBaseSizes(initialBaseSizes);
        setFlyDimensions(initialFlyDimensions);
        setIsRectangular(initialIsRectangular);
      } catch (error) {
        console.error('Error parsing JSON:', error);
        setUnits([{ name: 'Error parsing JSON', type: 'error', number: 1, id: 'error' }]);
      }
    }
  };

  // Save base sizes to localStorage as overrides
  const updateBaseSize = (unitId: string, unitName: string, value: string) => {
    setBaseSizes((prev) => ({
      ...prev,
      [unitId]: value
    }));

    // Update override base sizes by model name
    const newOverrides = {
      ...overrideBaseSizes,
      [unitName]: value
    };
    setOverrideBaseSizes(newOverrides);

    // Save to localStorage
    try {
      localStorage.setItem('baseSizeOverrides', JSON.stringify(newOverrides));
    } catch (error) {
      console.error('Error saving base size overrides to localStorage:', error);
    }
  };

  // Save fly dimensions to localStorage as overrides
  const updateFlyDimension = (unitId: string, unitName: string, dimension: 'width' | 'length', value: string) => {
    setFlyDimensions((prev) => ({
      ...prev,
      [unitId]: {
        width: dimension === 'width' ? value : (prev[unitId]?.width || ''),
        length: dimension === 'length' ? value : (prev[unitId]?.length || '')
      }
    }));

    const currentDims = flyDimensions[unitId] || { width: '', length: '' };
    const newDims = {
      width: dimension === 'width' ? value : currentDims.width,
      length: dimension === 'length' ? value : currentDims.length
    };

    // Update override base sizes by model name
    const newOverrides = {
      ...overrideBaseSizes,
      [unitName]: newDims
    };
    setOverrideBaseSizes(newOverrides);

    // Save to localStorage
    try {
      localStorage.setItem('baseSizeOverrides', JSON.stringify(newOverrides));
    } catch (error) {
      console.error('Error saving base size overrides to localStorage:', error);
    }
  };

  // Toggle between round and rectangular base
  const toggleBaseType = (unitId: string) => {
    setIsRectangular((prev) => ({
      ...prev,
      [unitId]: !prev[unitId]
    }));
  };

  return (
    <>
      <aside className="w-96 bg-[#0f0f0f] border-r border-[#1a2a1a] p-6 min-h-screen">
        <h2 className="text-2xl font-bold text-[#39FF14] mb-6">Army List</h2>

        <div className="mb-6">
          <button
            onClick={handleJsonImport}
            className="w-full px-4 py-3 bg-[#0f4d0f] hover:bg-[#39FF14] hover:text-black text-white font-semibold rounded-lg transition-colors"
          >
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelected}
            className="hidden"
          />
        </div>

        {units.length > 0 && (
          <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
            {/* Group models by parent unit */}
            {(() => {
              // Create groups: standalone models and models grouped by parent unit ID
              const groupedUnits = new Map<string | undefined, UnitWithBase[]>();
              units.forEach(unit => {
                const key = unit.parentUnitId || unit.id;
                if (!groupedUnits.has(key)) {
                  groupedUnits.set(key, []);
                }
                groupedUnits.get(key)!.push(unit);
              });

              return Array.from(groupedUnits.entries()).map(([groupKey, groupUnits]) => {
                const isGroupedUnit = groupUnits[0].parentUnitId !== undefined;
                const parentUnitName = groupUnits[0].parentUnitName;

                return (
                  <div
                    key={groupKey}
                    className={
                      isGroupedUnit
                        ? 'border rounded-lg transition-colors bg-[#0f0f0f] border-[#2a2a2a] p-3'
                        : ''
                    }
                  >
                    {/* Parent unit header if grouped */}
                    {isGroupedUnit && parentUnitName && (() => {
                      // Check if all models have base sizes and if any are spawned
                      const allHaveBaseSizes = groupUnits.every(unit => {
                        const isRect = isRectangular[unit.id];
                        return isRect
                          ? (flyDimensions[unit.id]?.width && flyDimensions[unit.id]?.length)
                          : baseSizes[unit.id];
                      });
                      const anySpawned = groupUnits.some(unit => spawnedUnits.has(unit.id));

                      return (
                        <div className="mb-3 pb-3 border-b border-[#2a2a2a]">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h3 className="font-bold text-[#39FF14]">{parentUnitName}</h3>
                              <span className="text-xs text-gray-400">
                                {groupUnits.reduce((sum, u) => sum + u.number, 0)} models total
                              </span>
                            </div>
                            {!anySpawned && (
                              <button
                                onClick={() => {
                                  // Spawn all models in this unit
                                  groupUnits.forEach(unit => {
                                    const isRect = isRectangular[unit.id];
                                    const spawnData: SpawnedUnit = {
                                      unitId: unit.id,
                                      unitName: unit.name,
                                      parentUnitId: unit.parentUnitId,
                                      parentUnitName: unit.parentUnitName,
                                      isRectangular: isRect,
                                      modelCount: unit.number,
                                      ...(isRect
                                        ? {
                                            width: parseFloat(flyDimensions[unit.id]?.width || '0'),
                                            length: parseFloat(flyDimensions[unit.id]?.length || '0')
                                          }
                                        : {
                                            baseSize: parseFloat(baseSizes[unit.id] || '0')
                                          })
                                    };
                                    onSpawn(spawnData);
                                  });
                                }}
                                disabled={!allHaveBaseSizes}
                                className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
                                  allHaveBaseSizes
                                    ? 'bg-[#0f4d0f] hover:bg-[#39FF14] hover:text-black text-white'
                                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                }`}
                              >
                                Spawn All
                              </button>
                            )}
                            {anySpawned && (
                              <button
                                onClick={() => {
                                  // Delete all models in this unit
                                  groupUnits.forEach(unit => {
                                    onDelete(unit.id);
                                  });
                                }}
                                className="px-4 py-2 text-sm font-bold bg-red-900 hover:bg-red-700 text-white rounded-lg transition-colors"
                              >
                                Delete All
                              </button>
                            )}
                          </div>
                          {anySpawned && (() => {
                            // For grouped units (with parentUnitId), check coherency across all model types
                            const parentId = groupUnits[0].parentUnitId;
                            if (parentId) {
                              // Get all spawned groups belonging to this parent unit
                              const parentUnitGroups = spawnedGroups.filter(g => g.parentUnitId === parentId);
                              if (parentUnitGroups.length > 0) {
                                const coherencyResult = checkParentUnitCoherency(parentUnitGroups);
                                if (!coherencyResult.isInCoherency) {
                                  return (
                                    <div className="text-center text-sm font-semibold py-1 rounded bg-red-900 text-red-200">
                                      Unit not coherent
                                    </div>
                                  );
                                }
                              }
                            }
                            return null;
                          })()}
                        </div>
                      );
                    })()}

                    {/* Individual models */}
                    <div className={isGroupedUnit ? "space-y-2" : ""}>
                      {groupUnits.map((unit) => {
              const isRect = isRectangular[unit.id];
              const hasBaseSize = isRect
                ? (flyDimensions[unit.id]?.width && flyDimensions[unit.id]?.length)
                : baseSizes[unit.id];
              const isSpawned = spawnedUnits.has(unit.id);
              const isRed = !hasBaseSize && !isSpawned;

              return (
                <div
                  key={unit.id}
                  className={`p-3 border rounded-lg transition-colors ${
                    isRed
                      ? 'bg-red-950 border-red-700 hover:border-red-600'
                      : 'bg-[#1a1a1a] border-[#1a2a1a] hover:border-[#39FF14]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-gray-200">{unit.name}</p>
                    <button
                      onClick={() => toggleBaseType(unit.id)}
                      className="px-2 py-0.5 text-xs bg-[#0a0a0a] border border-[#2a2a2a] rounded text-gray-400 hover:border-[#39FF14] hover:text-[#39FF14] transition-colors font-semibold whitespace-nowrap flex-shrink-0"
                      title={isRect ? "Switch to round base" : "Switch to rectangular base"}
                    >
                      {isRect ? '□ Rect' : '○ Round'}
                    </button>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400 whitespace-nowrap">{unit.number} models</span>

                      {isRect ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={flyDimensions[unit.id]?.width || ''}
                            onChange={(e) => updateFlyDimension(unit.id, unit.name, 'width', e.target.value)}
                            placeholder="W"
                            className="w-12 px-2 py-1 text-sm bg-[#0a0a0a] border border-[#2a2a2a] rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#39FF14] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="text-sm text-gray-400">×</span>
                          <input
                            type="number"
                            value={flyDimensions[unit.id]?.length || ''}
                            onChange={(e) => updateFlyDimension(unit.id, unit.name, 'length', e.target.value)}
                            placeholder="L"
                            className="w-12 px-2 py-1 text-sm bg-[#0a0a0a] border border-[#2a2a2a] rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#39FF14] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="text-sm text-gray-400">mm</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={baseSizes[unit.id] || ''}
                            onChange={(e) => updateBaseSize(unit.id, unit.name, e.target.value)}
                            placeholder="mm"
                            className="w-16 px-2 py-1 text-sm bg-[#0a0a0a] border border-[#2a2a2a] rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#39FF14] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="text-sm text-gray-400">mm</span>
                        </div>
                      )}
                    </div>

                    {isSpawned ? (
                      <>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const group = spawnedGroups.find(g => g.unitId === unit.id);
                              if (group) {
                                const unitModels = group.models.map((m: any) => ({
                                  groupId: unit.id,
                                  modelId: m.id
                                }));
                                onSelectAll(unitModels);
                              }
                            }}
                            className="flex-1 px-3 py-1 text-sm font-semibold bg-[#0f4d0f] hover:bg-[#39FF14] hover:text-black text-white rounded transition-colors"
                          >
                            Select All
                          </button>
                          <button
                            onClick={() => onDelete(unit.id)}
                            className="flex-1 px-3 py-1 text-sm font-semibold bg-red-900 hover:bg-red-700 text-white rounded transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <button
                          onClick={() => {
                            const spawnData: SpawnedUnit = {
                              unitId: unit.id,
                              unitName: unit.name,
                              parentUnitId: unit.parentUnitId,
                              parentUnitName: unit.parentUnitName,
                              isRectangular: isRect,
                              modelCount: unit.number,
                              ...(isRect
                                ? {
                                    width: parseFloat(flyDimensions[unit.id]?.width || '0'),
                                    length: parseFloat(flyDimensions[unit.id]?.length || '0')
                                  }
                                : {
                                    baseSize: parseFloat(baseSizes[unit.id] || '0')
                                  })
                            };
                            onSpawn(spawnData);
                          }}
                          disabled={!hasBaseSize || reserveUnits.has(unit.id)}
                          className={`w-full px-3 py-1 text-sm font-semibold rounded transition-colors ${
                            hasBaseSize && !reserveUnits.has(unit.id)
                              ? 'bg-[#0f4d0f] hover:bg-[#39FF14] hover:text-black text-white'
                              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          Spawn
                        </button>
                        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer hover:text-gray-200">
                          <input
                            type="checkbox"
                            checked={reserveUnits.has(unit.id)}
                            onChange={(e) => onReserveChange(unit.id, e.target.checked)}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-[#39FF14] focus:ring-[#39FF14] focus:ring-offset-0 cursor-pointer"
                          />
                          In Reserves
                        </label>
                      </div>
                    )}
                  </div>
                </div>
                      );
                    })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </aside>
    </>
  );
}
