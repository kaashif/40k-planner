'use client';

import React, { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ArmySidebar from './components/ArmySidebar';
import DeploymentPlanner from './components/DeploymentPlanner';
import ExportPDFButton from './components/ExportPDFButton';
import { Model, SpawnedGroup, SpawnedUnit, SelectedModel } from './types';

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
}

function MainContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Tab state from URL
  const tabParam = searchParams.get('tab');
  const activeTab = (tabParam === 'stats' ? 'stats' : 'deployment') as 'deployment' | 'stats';

  const setActiveTab = useCallback((tab: 'deployment' | 'stats') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.push(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  // Army data state
  const [armyUnits, setArmyUnits] = useState<ArmyUnit[]>([]);

  // Per-round state
  const [currentRound, setCurrentRound] = useState<string>('terraform');
  const [spawnedGroupsByRound, setSpawnedGroupsByRound] = useState<{ [roundId: string]: SpawnedGroup[] }>({
    terraform: [],
    purge: [],
    supplies: [],
    linchpin: [],
    take: []
  });
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

    for (let i = 0; i < unit.modelCount; i++) {
      const row = Math.floor(i / modelsPerRow);
      const col = i % modelsPerRow;
      const modelSize = unit.isRectangular
        ? Math.max(unit.width || 25, unit.length || 25)
        : (unit.baseSize || 25);

      models.push({
        id: `model-${i}`,
        x: col * (modelSize + spacing), // Store in mm
        y: row * (modelSize + spacing)  // Store in mm
      });
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
      groupX: 50, // Default starting position
      groupY: 50
    };

    setSpawnedGroupsByRound(prev => ({
      ...prev,
      [currentRound]: [...(prev[currentRound] || []), newGroup]
    }));
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
              />
            )}

            {activeTab === 'stats' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-[#39FF14]">Army Statistics</h2>

                {armyUnits.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-[#1a1a1a] border-b-2 border-[#39FF14]">
                          <th className="text-left p-3 text-gray-200 font-bold">Unit</th>
                          <th className="text-center p-3 text-gray-200 font-bold">M</th>
                          <th className="text-center p-3 text-gray-200 font-bold">T</th>
                          <th className="text-center p-3 text-gray-200 font-bold">SV</th>
                          <th className="text-center p-3 text-gray-200 font-bold">Invuln</th>
                          <th className="text-center p-3 text-gray-200 font-bold">W</th>
                          <th className="text-center p-3 text-gray-200 font-bold">LD</th>
                          <th className="text-center p-3 text-gray-200 font-bold">OC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // Group units by parent unit name
                          const groupedUnits = new Map<string | undefined, ArmyUnit[]>();

                          armyUnits.forEach(unit => {
                            const key = unit.parentUnitName || unit.name;
                            if (!groupedUnits.has(key)) {
                              groupedUnits.set(key, []);
                            }
                            groupedUnits.get(key)!.push(unit);
                          });

                          let rowIndex = 0;
                          return Array.from(groupedUnits.entries()).map(([groupKey, units]) => {
                            const hasParent = units.some(u => u.parentUnitName);
                            const parentName = units[0].parentUnitName;

                            return (
                              <React.Fragment key={groupKey}>
                                {/* Group Header */}
                                <tr className="bg-[#0f4d0f] border-t-2 border-[#39FF14]">
                                  <td colSpan={8} className="p-2 text-[#39FF14] font-bold text-sm">
                                    {hasParent ? parentName : units[0].name}
                                  </td>
                                </tr>
                                {/* Units in this group */}
                                {units.map((unit, idx) => {
                                  const isEven = rowIndex % 2 === 0;
                                  rowIndex++;
                                  return (
                                    <tr
                                      key={`${groupKey}-${idx}`}
                                      className={`border-b border-[#1a2a1a] hover:bg-[#2a2a2a] transition-colors ${
                                        isEven ? 'bg-[#0f0f0f]' : 'bg-[#1a1a1a]'
                                      }`}
                                    >
                                      <td className="p-3 text-gray-200 font-semibold">{unit.name}</td>
                                      <td className="p-3 text-center text-gray-300">{unit.stats?.M || '-'}</td>
                                      <td className="p-3 text-center text-gray-300">{unit.stats?.T || '-'}</td>
                                      <td className="p-3 text-center text-gray-300">{unit.stats?.SV || '-'}</td>
                                      <td className="p-3 text-center text-[#39FF14] font-semibold">{unit.invulnSave || '-'}</td>
                                      <td className="p-3 text-center text-gray-300">{unit.stats?.W || '-'}</td>
                                      <td className="p-3 text-center text-gray-300">{unit.stats?.LD || '-'}</td>
                                      <td className="p-3 text-center text-gray-300">{unit.stats?.OC || '-'}</td>
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
