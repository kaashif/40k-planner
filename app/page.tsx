'use client';

import { Suspense, useState, useEffect } from 'react';
import ArmySidebar from './components/ArmySidebar';
import DeploymentPlanner from './components/DeploymentPlanner';
import ExportPDFButton from './components/ExportPDFButton';
import { Model, SpawnedGroup, SpawnedUnit, SelectedModel } from './types';

function MainContent() {
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
        />

        {/* Main Content */}
        <div className="flex-1 p-8">
          <header className="mb-8 flex items-center justify-between">
            <h1 className="text-4xl font-bold text-[#39FF14] mb-2">
              Warhammer 40k Tournament Planner
            </h1>
            <div className="flex gap-3">
              <ExportPDFButton spawnedGroupsByRound={spawnedGroupsByRound} />
              <button
                onClick={handleClearLocalStorage}
                className="px-4 py-2 bg-red-900 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
              >
                Clear Saved Data
              </button>
            </div>
          </header>

          <main className="bg-[#0f0f0f] border border-[#1a2a1a] rounded-lg p-6">
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
