'use client';

import React, { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ArmySidebar from './components/ArmySidebar';
import DeploymentPlanner from './components/DeploymentPlanner';
import ExportPDFButton from './components/ExportPDFButton';
import { Model, SpawnedGroup, SpawnedUnit, SelectedModel } from './types';

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

function MainContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Tab state from URL
  const tabParam = searchParams.get('tab');
  const activeTab = (tabParam === 'stats' ? 'stats' : 'deployment') as 'deployment' | 'stats';
  const subTabParam = searchParams.get('subtab');
  const activeSubTab = (subTabParam === 'weapons' ? 'weapons' : 'stats') as 'stats' | 'weapons';

  const setActiveTab = useCallback((tab: 'deployment' | 'stats') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.push(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const setActiveSubTab = useCallback((subtab: 'stats' | 'weapons') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('subtab', subtab);
    router.push(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  // Army data state
  const [armyUnits, setArmyUnits] = useState<ArmyUnit[]>([]);
  const [leaderAssignments, setLeaderAssignments] = useState<{ [leaderName: string]: string }>({});

  // Load leaders configuration on mount
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

  // Per-round state
  const [currentRound, setCurrentRound] = useState<string>('terraform');
  const [spawnedGroupsByRound, setSpawnedGroupsByRound] = useState<{ [roundId: string]: SpawnedGroup[] }>({
    terraform: [],
    purge: [],
    supplies: [],
    linchpin: [],
    take: []
  });
  const [reserveUnits, setReserveUnits] = useState<Set<string>>(new Set());
  const [allUnitIds, setAllUnitIds] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Selection state (per-round)
  const [selectedModelsByRound, setSelectedModelsByRound] = useState<{ [roundId: string]: SelectedModel[] }>({
    terraform: [],
    purge: [],
    supplies: [],
    linchpin: [],
    take: []
  });
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [boxSelectStart, setBoxSelectStart] = useState<{ x: number; y: number } | null>(null);
  const [boxSelectEnd, setBoxSelectEnd] = useState<{ x: number; y: number } | null>(null);

  // Derived state for current round
  const spawnedGroups = spawnedGroupsByRound[currentRound] || [];
  const spawnedUnitIds = new Set(spawnedGroups.map(g => g.unitId));
  const selectedModels = selectedModelsByRound[currentRound] || [];

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const savedGroupsByRound = localStorage.getItem('spawnedGroupsByRound');
      if (savedGroupsByRound) {
        const groupsByRound = JSON.parse(savedGroupsByRound);
        setSpawnedGroupsByRound(groupsByRound);
      }
    } catch (error) {
      console.error('Error loading spawned groups from localStorage:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save state to localStorage whenever spawnedGroupsByRound changes
  useEffect(() => {
    if (!isLoaded) return; // Don't save on initial load

    try {
      localStorage.setItem('spawnedGroupsByRound', JSON.stringify(spawnedGroupsByRound));
    } catch (error) {
      console.error('Error saving spawned groups to localStorage:', error);
    }
  }, [spawnedGroupsByRound, isLoaded]);

  const handleSpawn = (unit: SpawnedUnit) => {
    // Create models in a grid formation
    // Note: We'll scale these in the DeploymentPlanner component
    const models: Model[] = [];
    const spacing = 5; // spacing in mm between models
    const modelsPerRow = Math.ceil(Math.sqrt(unit.modelCount));
    const modelSize = unit.isRectangular
      ? Math.max(unit.width || 25, unit.length || 25)
      : (unit.baseSize || 25);

    for (let i = 0; i < unit.modelCount; i++) {
      const row = Math.floor(i / modelsPerRow);
      const col = i % modelsPerRow;

      models.push({
        id: `model-${i}`,
        x: col * (modelSize + spacing), // Store in mm
        y: row * (modelSize + spacing)  // Store in mm
      });
    }

    setSpawnedGroupsByRound(prev => {
      const currentGroups = prev[currentRound] || [];

      // Calculate spawn position based on existing groups
      let groupX = 50; // Default starting position in mm
      const groupY = 50;

      if (currentGroups.length > 0) {
        let maxRight = 0;
        for (const group of currentGroups) {
          const groupSize = group.isRectangular
            ? Math.max(group.width || 25, group.length || 25)
            : (group.baseSize || 25);
          const groupModelsPerRow = Math.ceil(Math.sqrt(group.models.length));
          const groupWidth = groupModelsPerRow * (groupSize + spacing);
          const rightEdge = group.groupX + groupWidth;
          if (rightEdge > maxRight) {
            maxRight = rightEdge;
          }
        }
        groupX = maxRight + 20; // 20mm gap between groups
      }

      const newGroup: SpawnedGroup = {
        unitId: unit.unitId,
        unitName: unit.unitName,
        parentUnitId: unit.parentUnitId,
        parentUnitName: unit.parentUnitName,
        isRectangular: unit.isRectangular,
        baseSize: unit.baseSize,
        width: unit.width,
        length: unit.length,
        models,
        groupX,
        groupY
      };

      return {
        ...prev,
        [currentRound]: [...currentGroups, newGroup]
      };
    });
  };

  const handleDelete = (unitId: string) => {
    setSpawnedGroupsByRound(prev => ({
      ...prev,
      [currentRound]: (prev[currentRound] || []).filter(group => group.unitId !== unitId)
    }));

    // Remove deleted models from selection
    setSelectedModelsByRound(prev => ({
      ...prev,
      [currentRound]: (prev[currentRound] || []).filter(sel => sel.groupId !== unitId)
    }));
  };

  const handleUpdateGroups = (groups: SpawnedGroup[]) => {
    setSpawnedGroupsByRound(prev => ({
      ...prev,
      [currentRound]: groups
    }));
  };

  const handleSelectionChange = (models: SelectedModel[]) => {
    setSelectedModelsByRound(prev => ({
      ...prev,
      [currentRound]: models
    }));
  };

  const handleReserveChange = (unitId: string, isReserve: boolean) => {
    setReserveUnits(prev => {
      const next = new Set(prev);
      if (isReserve) {
        next.add(unitId);
      } else {
        next.delete(unitId);
      }
      return next;
    });
  };

  const handleUnitIdsUpdate = useCallback((unitIds: string[]) => {
    setAllUnitIds(unitIds);
  }, []);

  const handleClearLocalStorage = () => {
    if (confirm('Are you sure you want to clear all saved data? This will reset spawned models and base size overrides.')) {
      localStorage.removeItem('spawnedGroupsByRound');
      localStorage.removeItem('baseSizeOverrides');
      window.location.reload();
    }
  };

  const handleExportData = () => {
    try {
      const exportData = {
        spawnedGroupsByRound: JSON.parse(localStorage.getItem('spawnedGroupsByRound') || '{}'),
        baseSizeOverrides: JSON.parse(localStorage.getItem('baseSizeOverrides') || '{}'),
        exportDate: new Date().toISOString()
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `40k-planner-export-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Failed to export data. See console for details.');
    }
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importData = JSON.parse(text);

        if (importData.spawnedGroupsByRound) {
          localStorage.setItem('spawnedGroupsByRound', JSON.stringify(importData.spawnedGroupsByRound));
        }
        if (importData.baseSizeOverrides) {
          localStorage.setItem('baseSizeOverrides', JSON.stringify(importData.baseSizeOverrides));
        }

        alert('Data imported successfully! The page will now reload.');
        window.location.reload();
      } catch (error) {
        console.error('Error importing data:', error);
        alert('Failed to import data. Please ensure the file is a valid export file.');
      }
    };
    input.click();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="flex">
        {/* Army Sidebar */}
        <ArmySidebar
          onSpawn={handleSpawn}
          onDelete={handleDelete}
          spawnedUnits={spawnedUnitIds}
          spawnedGroups={spawnedGroups}
          onSelectAll={handleSelectionChange}
          onArmyDataUpdate={setArmyUnits}
          reserveUnits={reserveUnits}
          onReserveChange={handleReserveChange}
          onUnitIdsUpdate={handleUnitIdsUpdate}
        />

        {/* Main Content */}
        <div className="flex-1 p-8">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-[#39FF14] mb-4">
              Warhammer 40k Tournament Planner
            </h1>
            <div className="flex gap-3">
              <ExportPDFButton spawnedGroupsByRound={spawnedGroupsByRound} />
              <button
                onClick={handleImportData}
                className="px-4 py-2 bg-[#0f4d0f] hover:bg-[#39FF14] hover:text-black text-white font-semibold rounded-lg transition-colors"
              >
                Load Saved Data
              </button>
              <button
                onClick={handleExportData}
                className="px-4 py-2 bg-[#0f4d0f] hover:bg-[#39FF14] hover:text-black text-white font-semibold rounded-lg transition-colors"
              >
                Export Saved Data
              </button>
              <button
                onClick={handleClearLocalStorage}
                className="px-4 py-2 bg-red-900 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
              >
                Clear Saved Data
              </button>
            </div>
          </header>

          {/* Tab Navigation */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setActiveTab('deployment')}
              className={`px-6 py-3 font-semibold rounded-lg transition-colors ${
                activeTab === 'deployment'
                  ? 'bg-[#0f4d0f] text-[#39FF14] border-2 border-[#39FF14]'
                  : 'bg-[#1a1a1a] text-gray-400 border-2 border-[#1a2a1a] hover:border-[#39FF14] hover:text-gray-200'
              }`}
            >
              Deployment
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-6 py-3 font-semibold rounded-lg transition-colors ${
                activeTab === 'stats'
                  ? 'bg-[#0f4d0f] text-[#39FF14] border-2 border-[#39FF14]'
                  : 'bg-[#1a1a1a] text-gray-400 border-2 border-[#1a2a1a] hover:border-[#39FF14] hover:text-gray-200'
              }`}
            >
              Army Stats
            </button>
          </div>

          <main className="bg-[#0f0f0f] border border-[#1a2a1a] rounded-lg p-6">
            {activeTab === 'deployment' && (
              <DeploymentPlanner
                spawnedGroups={spawnedGroups}
                onUpdateGroups={handleUpdateGroups}
                selectedModels={selectedModels}
                onSelectionChange={handleSelectionChange}
                isBoxSelecting={isBoxSelecting}
                setIsBoxSelecting={setIsBoxSelecting}
                boxSelectStart={boxSelectStart}
                setBoxSelectStart={setBoxSelectStart}
                boxSelectEnd={boxSelectEnd}
                setBoxSelectEnd={setBoxSelectEnd}
                onRoundChange={setCurrentRound}
                allUnitIds={allUnitIds}
                reserveUnits={reserveUnits}
              />
            )}

            {activeTab === 'stats' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-[#39FF14]">Army Statistics</h2>

                {/* Subtabs */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveSubTab('stats')}
                    className={`px-4 py-2 text-sm font-semibold rounded transition-colors ${
                      activeSubTab === 'stats'
                        ? 'bg-[#0f4d0f] text-[#39FF14] border border-[#39FF14]'
                        : 'bg-[#1a1a1a] text-gray-400 border border-[#1a2a1a] hover:border-[#39FF14] hover:text-gray-200'
                    }`}
                  >
                    Unit Stats
                  </button>
                  <button
                    onClick={() => setActiveSubTab('weapons')}
                    className={`px-4 py-2 text-sm font-semibold rounded transition-colors ${
                      activeSubTab === 'weapons'
                        ? 'bg-[#0f4d0f] text-[#39FF14] border border-[#39FF14]'
                        : 'bg-[#1a1a1a] text-gray-400 border border-[#1a2a1a] hover:border-[#39FF14] hover:text-gray-200'
                    }`}
                  >
                    Weapons
                  </button>
                </div>

                {activeSubTab === 'stats' && (
                  armyUnits.length > 0 ? (
                  <div>
                    <table className="border-collapse">
                      <thead>
                        <tr className="bg-[#1a1a1a] border-b-2 border-[#39FF14]">
                          <th className="text-left pr-4 py-1 text-gray-200 font-bold">Unit</th>
                          <th className="text-left pr-3 py-1 text-gray-200 font-bold">M</th>
                          <th className="text-left pr-3 py-1 text-gray-200 font-bold">T</th>
                          <th className="text-left pr-3 py-1 text-gray-200 font-bold">SV</th>
                          <th className="text-left pr-3 py-1 text-gray-200 font-bold">Inv</th>
                          <th className="text-left pr-3 py-1 text-gray-200 font-bold">FNP</th>
                          <th className="text-left pr-3 py-1 text-gray-200 font-bold">W</th>
                          <th className="text-left pr-3 py-1 text-gray-200 font-bold">LD</th>
                          <th className="text-left py-1 text-gray-200 font-bold">OC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // Deduplicate units by name (keep first occurrence)
                          const seenNames = new Set<string>();
                          const dedupedUnits = armyUnits.filter(u => {
                            if (seenNames.has(u.name)) return false;
                            seenNames.add(u.name);
                            return true;
                          });

                          // Create a map of unit name to unit data
                          const unitMap = new Map(dedupedUnits.map(u => [u.name, u]));

                          // Track which units have been displayed
                          const displayedUnits = new Set<string>();

                          // Build groups: bodyguard units with their leaders
                          const groups: { groupName: string; units: ArmyUnit[] }[] = [];

                          // First, create groups based on leader assignments (grouped by bodyguard unit)
                          const bodyguardToLeaders = new Map<string, string[]>();
                          Object.entries(leaderAssignments).forEach(([leader, bodyguard]) => {
                            if (!bodyguardToLeaders.has(bodyguard)) {
                              bodyguardToLeaders.set(bodyguard, []);
                            }
                            bodyguardToLeaders.get(bodyguard)!.push(leader);
                          });

                          // Create groups for bodyguard units with their leaders
                          bodyguardToLeaders.forEach((leaders, bodyguardName) => {
                            const groupUnits: ArmyUnit[] = [];

                            // Add leaders first
                            leaders.forEach(leaderName => {
                              const leader = unitMap.get(leaderName);
                              if (leader) {
                                groupUnits.push(leader);
                                displayedUnits.add(leaderName);
                              }
                            });

                            // Add bodyguard unit
                            const bodyguard = unitMap.get(bodyguardName);
                            if (bodyguard) {
                              groupUnits.push(bodyguard);
                              displayedUnits.add(bodyguardName);
                            }

                            if (groupUnits.length > 0) {
                              groups.push({ groupName: bodyguardName, units: groupUnits });
                            }
                          });

                          // Add remaining units grouped by their parentUnitName
                          const remainingUnits = dedupedUnits.filter(u => !displayedUnits.has(u.name));
                          const remainingGroups = new Map<string, ArmyUnit[]>();

                          remainingUnits.forEach(unit => {
                            const key = unit.parentUnitName || unit.name;
                            if (!remainingGroups.has(key)) {
                              remainingGroups.set(key, []);
                            }
                            remainingGroups.get(key)!.push(unit);
                          });

                          remainingGroups.forEach((units, groupName) => {
                            groups.push({ groupName, units });
                          });

                          let rowIndex = 0;
                          return groups.map((group, groupIdx) => {
                            // Don't show header if only one unit in the group
                            const showHeader = group.units.length > 1;

                            return (
                              <React.Fragment key={groupIdx}>
                                {/* Group Header - only show if multiple units or name differs */}
                                {showHeader && (
                                  <tr className="bg-[#0f4d0f] border-t border-[#39FF14]">
                                    <td colSpan={9} className="py-1 text-[#39FF14] font-bold text-sm">
                                      {group.groupName}
                                    </td>
                                  </tr>
                                )}
                                {/* Units in this group */}
                                {group.units.map((unit, idx) => {
                                  const isEven = rowIndex % 2 === 0;
                                  rowIndex++;

                                  // Determine invuln and FNP values (inherent or from leader)
                                  let invulnDisplay = unit.invulnSave || '-';
                                  let fnpDisplay = unit.fnp || '-';

                                  // Find leaders in this group that grant buffs (buffs apply to the whole unit including the leader)
                                  const leadersInGroup = group.units.filter(u =>
                                    Object.keys(leaderAssignments).includes(u.name) &&
                                    leaderAssignments[u.name] === group.groupName
                                  );

                                  for (const leader of leadersInGroup) {
                                    if (leader.grantsInvuln && invulnDisplay === '-') {
                                      invulnDisplay = `${leader.grantsInvuln}(L)`;
                                    }
                                    if (leader.grantsFnp && fnpDisplay === '-') {
                                      fnpDisplay = `${leader.grantsFnp}(L)`;
                                    }
                                  }

                                  return (
                                    <tr
                                      key={`${groupIdx}-${idx}`}
                                      className={`border-b border-[#1a2a1a] hover:bg-[#2a2a2a] transition-colors ${
                                        isEven ? 'bg-[#0f0f0f]' : 'bg-[#1a1a1a]'
                                      }`}
                                    >
                                      <td className={`pr-4 py-1 text-gray-200 font-semibold ${showHeader ? 'pl-3' : ''}`}>{unit.name}</td>
                                      <td className="pr-3 py-1 text-gray-300">{unit.stats?.M || '-'}</td>
                                      <td className="pr-3 py-1 text-gray-300">{unit.stats?.T || '-'}</td>
                                      <td className="pr-3 py-1 text-gray-300">{unit.stats?.SV || '-'}</td>
                                      <td className="pr-3 py-1 text-gray-300">{invulnDisplay}</td>
                                      <td className="pr-3 py-1 text-gray-300">{fnpDisplay}</td>
                                      <td className="pr-3 py-1 text-gray-300">{unit.stats?.W || '-'}</td>
                                      <td className="pr-3 py-1 text-gray-300">{unit.stats?.LD || '-'}</td>
                                      <td className="py-1 text-gray-300">{unit.stats?.OC || '-'}</td>
                                    </tr>
                                  );
                                })}
                              </React.Fragment>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                  ) : (
                    <div className="bg-[#1a1a1a] border border-[#1a2a1a] rounded-lg p-8 text-center">
                      <p className="text-gray-400">No army data loaded. Import an army list to see statistics.</p>
                    </div>
                  )
                )}

                {activeSubTab === 'weapons' && (
                  armyUnits.length > 0 ? (
                  <div>
                    <table className="border-collapse">
                      <thead>
                        <tr className="bg-[#1a1a1a] border-b-2 border-[#39FF14]">
                          <th className="text-left pr-4 py-1 text-gray-200 font-bold">Unit</th>
                          <th className="text-left pr-4 py-1 text-gray-200 font-bold">Weapon</th>
                          <th className="text-left pr-3 py-1 text-gray-200 font-bold">Type</th>
                          <th className="text-left pr-3 py-1 text-gray-200 font-bold">Range</th>
                          <th className="text-left pr-3 py-1 text-gray-200 font-bold">A</th>
                          <th className="text-left pr-3 py-1 text-gray-200 font-bold">BS/WS</th>
                          <th className="text-left pr-3 py-1 text-gray-200 font-bold">S</th>
                          <th className="text-left pr-3 py-1 text-gray-200 font-bold">AP</th>
                          <th className="text-left pr-3 py-1 text-gray-200 font-bold">D</th>
                          <th className="text-left py-1 text-gray-200 font-bold">Keywords</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // Deduplicate units by name
                          const seenNames = new Set<string>();
                          const dedupedUnits = armyUnits.filter(u => {
                            if (seenNames.has(u.name)) return false;
                            seenNames.add(u.name);
                            return true;
                          });

                          let rowIndex = 0;
                          return dedupedUnits.flatMap((unit) => {
                            if (!unit.weapons || unit.weapons.length === 0) return [];

                            return unit.weapons.map((weapon, weaponIdx) => {
                              const isEven = rowIndex % 2 === 0;
                              rowIndex++;
                              return (
                                <tr
                                  key={`${unit.name}-${weaponIdx}`}
                                  className={`border-b border-[#1a2a1a] hover:bg-[#2a2a2a] transition-colors ${
                                    isEven ? 'bg-[#0f0f0f]' : 'bg-[#1a1a1a]'
                                  }`}
                                >
                                  <td className="pr-4 py-1 text-gray-200 font-semibold">{weaponIdx === 0 ? unit.name : ''}</td>
                                  <td className="pr-4 py-1 text-gray-300">{weapon.name}</td>
                                  <td className="pr-3 py-1 text-gray-300">{weapon.type}</td>
                                  <td className="pr-3 py-1 text-gray-300">{weapon.range}</td>
                                  <td className="pr-3 py-1 text-gray-300">{weapon.attacks}</td>
                                  <td className="pr-3 py-1 text-gray-300">{weapon.skill}</td>
                                  <td className="pr-3 py-1 text-gray-300">{weapon.strength}</td>
                                  <td className="pr-3 py-1 text-gray-300">{weapon.ap}</td>
                                  <td className="pr-3 py-1 text-gray-300">{weapon.damage}</td>
                                  <td className="py-1 text-gray-300">{weapon.keywords}</td>
                                </tr>
                              );
                            });
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                  ) : (
                    <div className="bg-[#1a1a1a] border border-[#1a2a1a] rounded-lg p-8 text-center">
                      <p className="text-gray-400">No army data loaded. Import an army list to see weapons.</p>
                    </div>
                  )
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <MainContent />
    </Suspense>
  );
}
