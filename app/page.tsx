'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import ArmySidebar from './components/ArmySidebar';
import DeploymentPlanner from './components/DeploymentPlanner';
import ExportPDFButton from './components/ExportPDFButton';
import { Model, SpawnedGroup, SpawnedUnit, SelectedModel } from './types';

function MainContent() {

  // Army data state
  const [armyUnits, setArmyUnits] = useState<{ name: string; stats?: Record<string, string>; invulnSave?: string }[]>([]);
  const [auras, setAuras] = useState<{ [unitName: string]: number }>({});

  // Per-round and per-turn state
  const [currentRound, setCurrentRound] = useState<string>('terraform');
  const [currentTurn, setCurrentTurn] = useState<string>('deployment');
  const [spawnedGroupsByRoundAndTurn, setSpawnedGroupsByRoundAndTurn] = useState<{ [key: string]: SpawnedGroup[] }>({});
  const [reserveUnits, setReserveUnits] = useState<Set<string>>(new Set());
  const [allUnitIds, setAllUnitIds] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Selection state (per-round and per-turn)
  const [selectedModelsByRoundAndTurn, setSelectedModelsByRoundAndTurn] = useState<{ [key: string]: SelectedModel[] }>({});
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [boxSelectStart, setBoxSelectStart] = useState<{ x: number; y: number } | null>(null);
  const [boxSelectEnd, setBoxSelectEnd] = useState<{ x: number; y: number } | null>(null);

  // Derived state for current round and turn
  const stateKey = `${currentRound}-${currentTurn}`;
  const deploymentKey = `${currentRound}-deployment`;
  const spawnedGroups = spawnedGroupsByRoundAndTurn[stateKey] || [];
  const deploymentGroups = spawnedGroupsByRoundAndTurn[deploymentKey] || [];
  const spawnedUnitIds = new Set(spawnedGroups.map(g => g.unitId));
  const selectedModels = selectedModelsByRoundAndTurn[stateKey] || [];

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const savedGroups = localStorage.getItem('spawnedGroupsByRoundAndTurn');
      if (savedGroups) {
        setSpawnedGroupsByRoundAndTurn(JSON.parse(savedGroups));
      } else {
        // Migration: try loading old format
        const oldSavedGroups = localStorage.getItem('spawnedGroupsByRound');
        if (oldSavedGroups) {
          const oldGroups = JSON.parse(oldSavedGroups);
          // Convert old format to new format (treat old data as deployment state)
          const newGroups: { [key: string]: SpawnedGroup[] } = {};
          for (const [roundId, groups] of Object.entries(oldGroups)) {
            newGroups[`${roundId}-deployment`] = groups as SpawnedGroup[];
          }
          setSpawnedGroupsByRoundAndTurn(newGroups);
        }
      }
    } catch (error) {
      console.error('Error loading spawned groups from localStorage:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save state to localStorage whenever spawnedGroupsByRoundAndTurn changes
  useEffect(() => {
    if (!isLoaded) return; // Don't save on initial load

    try {
      localStorage.setItem('spawnedGroupsByRoundAndTurn', JSON.stringify(spawnedGroupsByRoundAndTurn));
    } catch (error) {
      console.error('Error saving spawned groups to localStorage:', error);
    }
  }, [spawnedGroupsByRoundAndTurn, isLoaded]);

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

    setSpawnedGroupsByRoundAndTurn(prev => {
      const currentGroups = prev[stateKey] || [];

      // Map dimensions in mm (60" x 44")
      const MAP_WIDTH_MM = 60 * 25.4;  // 1524mm
      const MAP_HEIGHT_MM = 44 * 25.4; // 1117.6mm

      // Calculate the size of the unit's formation
      const formationWidth = modelsPerRow * (modelSize + spacing);
      const formationRows = Math.ceil(unit.modelCount / modelsPerRow);
      const formationHeight = formationRows * (modelSize + spacing);

      // Spawn in the center of the map
      const groupX = (MAP_WIDTH_MM - formationWidth) / 2;
      const groupY = (MAP_HEIGHT_MM - formationHeight) / 2;

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
        [stateKey]: [...currentGroups, newGroup]
      };
    });
  };

  const handleDelete = (unitId: string) => {
    setSpawnedGroupsByRoundAndTurn(prev => ({
      ...prev,
      [stateKey]: (prev[stateKey] || []).filter(group => group.unitId !== unitId)
    }));

    // Remove deleted models from selection
    setSelectedModelsByRoundAndTurn(prev => ({
      ...prev,
      [stateKey]: (prev[stateKey] || []).filter(sel => sel.groupId !== unitId)
    }));
  };

  const handleUpdateGroups = (groups: SpawnedGroup[]) => {
    setSpawnedGroupsByRoundAndTurn(prev => ({
      ...prev,
      [stateKey]: groups
    }));
  };

  const handleSelectionChange = (models: SelectedModel[]) => {
    setSelectedModelsByRoundAndTurn(prev => ({
      ...prev,
      [stateKey]: models
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

  const handleAuraChange = useCallback((unitName: string, auraInches: number) => {
    setAuras(prev => ({
      ...prev,
      [unitName]: auraInches
    }));
  }, []);

  const handleTurnChange = useCallback((turn: string) => {
    setCurrentTurn(turn);
  }, []);

  const handleResetToDeployment = useCallback(() => {
    const deploymentKey = `${currentRound}-deployment`;
    const deploymentState = spawnedGroupsByRoundAndTurn[deploymentKey] || [];

    // Deep copy the deployment state to the current turn
    const copiedState = JSON.parse(JSON.stringify(deploymentState));

    setSpawnedGroupsByRoundAndTurn(prev => ({
      ...prev,
      [stateKey]: copiedState
    }));

    // Clear selection
    setSelectedModelsByRoundAndTurn(prev => ({
      ...prev,
      [stateKey]: []
    }));
  }, [currentRound, stateKey, spawnedGroupsByRoundAndTurn]);

  const handleClearLocalStorage = () => {
    if (confirm('Are you sure you want to clear all saved data? This will reset spawned models and base size overrides.')) {
      localStorage.removeItem('spawnedGroupsByRoundAndTurn');
      localStorage.removeItem('spawnedGroupsByRound'); // Old format
      localStorage.removeItem('baseSizeOverrides');
      window.location.reload();
    }
  };

  const handleExportData = () => {
    try {
      const exportData = {
        spawnedGroupsByRoundAndTurn: JSON.parse(localStorage.getItem('spawnedGroupsByRoundAndTurn') || '{}'),
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

        if (importData.spawnedGroupsByRoundAndTurn) {
          localStorage.setItem('spawnedGroupsByRoundAndTurn', JSON.stringify(importData.spawnedGroupsByRoundAndTurn));
        } else if (importData.spawnedGroupsByRound) {
          // Handle old format - convert to new format
          const newGroups: { [key: string]: SpawnedGroup[] } = {};
          for (const [roundId, groups] of Object.entries(importData.spawnedGroupsByRound)) {
            newGroups[`${roundId}-deployment`] = groups as SpawnedGroup[];
          }
          localStorage.setItem('spawnedGroupsByRoundAndTurn', JSON.stringify(newGroups));
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
          onAuraChange={handleAuraChange}
          auras={auras}
        />

        {/* Main Content */}
        <div className="flex-1 p-8">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-[#39FF14] mb-4">
              Warhammer 40k Tournament Planner
            </h1>
            <div className="flex gap-3">
              <ExportPDFButton spawnedGroupsByRoundAndTurn={spawnedGroupsByRoundAndTurn} />
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

          <main className="bg-[#0f0f0f] border border-[#1a2a1a] rounded-lg p-6">
              <DeploymentPlanner
                spawnedGroups={spawnedGroups}
                deploymentGroups={deploymentGroups}
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
                armyUnits={armyUnits}
                auras={auras}
                currentTurn={currentTurn}
                onTurnChange={handleTurnChange}
                onResetToDeployment={handleResetToDeployment}
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
