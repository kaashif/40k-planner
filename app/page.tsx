'use client';

import { Suspense, useState, useEffect } from 'react';
import ArmySidebar from './components/ArmySidebar';
import DeploymentPlanner from './components/DeploymentPlanner';

interface Model {
  id: string;
  x: number;
  y: number;
}

interface SpawnedGroup {
  unitId: string;
  unitName: string;
  isRectangular: boolean;
  baseSize?: number;
  width?: number;
  length?: number;
  models: Model[];
  groupX: number;
  groupY: number;
}

interface SpawnedUnit {
  unitId: string;
  unitName: string;
  isRectangular: boolean;
  baseSize?: number;
  width?: number;
  length?: number;
  modelCount: number;
}

function MainContent() {
  const [spawnedGroups, setSpawnedGroups] = useState<SpawnedGroup[]>([]);
  const [spawnedUnitIds, setSpawnedUnitIds] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const savedGroups = localStorage.getItem('spawnedGroups');
      if (savedGroups) {
        const groups = JSON.parse(savedGroups);
        setSpawnedGroups(groups);

        // Rebuild the spawnedUnitIds set from loaded groups
        const unitIds = new Set(groups.map((g: SpawnedGroup) => g.unitId));
        setSpawnedUnitIds(unitIds);
      }
    } catch (error) {
      console.error('Error loading spawned groups from localStorage:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save state to localStorage whenever spawnedGroups changes
  useEffect(() => {
    if (!isLoaded) return; // Don't save on initial load

    try {
      localStorage.setItem('spawnedGroups', JSON.stringify(spawnedGroups));
    } catch (error) {
      console.error('Error saving spawned groups to localStorage:', error);
    }
  }, [spawnedGroups, isLoaded]);

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
      isRectangular: unit.isRectangular,
      baseSize: unit.baseSize,
      width: unit.width,
      length: unit.length,
      models,
      groupX: 50, // Default starting position
      groupY: 50
    };

    setSpawnedGroups([...spawnedGroups, newGroup]);
    setSpawnedUnitIds(new Set([...spawnedUnitIds, unit.unitId]));
  };

  const handleDelete = (unitId: string) => {
    setSpawnedGroups(spawnedGroups.filter(group => group.unitId !== unitId));
    const newSet = new Set(spawnedUnitIds);
    newSet.delete(unitId);
    setSpawnedUnitIds(newSet);
  };

  const handleClearLocalStorage = () => {
    if (confirm('Are you sure you want to clear all saved data? This will reset spawned models and base size overrides.')) {
      localStorage.removeItem('spawnedGroups');
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
        />

        {/* Main Content */}
        <div className="flex-1 p-8">
          <header className="mb-8 flex items-center justify-between">
            <h1 className="text-4xl font-bold text-[#39FF14] mb-2">
              Warhammer 40k Tournament Planner
            </h1>
            <button
              onClick={handleClearLocalStorage}
              className="px-4 py-2 bg-red-900 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
            >
              Clear Saved Data
            </button>
          </header>

          <main className="bg-[#0f0f0f] border border-[#1a2a1a] rounded-lg p-6">
            <DeploymentPlanner
              spawnedGroups={spawnedGroups}
              onUpdateGroups={setSpawnedGroups}
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
