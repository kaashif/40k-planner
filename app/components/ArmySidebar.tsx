'use client';

import { useState, useRef, useEffect } from 'react';

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
}

export default function ArmySidebar() {
  const [units, setUnits] = useState<UnitWithBase[]>([]);
  const [baseSizes, setBaseSizes] = useState<{ [key: string]: string }>({});
  const [flyDimensions, setFlyDimensions] = useState<{ [key: string]: { width: string; length: string } }>({});
  const [isRectangular, setIsRectangular] = useState<{ [key: string]: boolean }>({});
  const [savedBaseSizes, setSavedBaseSizes] = useState<{ [key: string]: string | { width: string; length: string } }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractModels = (selections: any[]): UnitWithBase[] => {
    const models: UnitWithBase[] = [];
    let modelIndex = 0;

    const processSelections = (sels: any[]) => {
      if (!sels) return;

      for (const sel of sels) {
        // If this selection has nested selections, check for nested models
        if (sel.selections && sel.selections.length > 0) {
          const nestedModels = sel.selections.filter(
            (nested: any) => nested.type === 'model'
          );

          // Add nested models if found
          for (const model of nestedModels) {
            models.push({
              name: model.name,
              type: model.type,
              number: model.number || 1,
              id: `model-${modelIndex++}`
            });
          }

          // If this selection itself is a model, also add it
          if (sel.type === 'model') {
            models.push({
              name: sel.name,
              type: sel.type,
              number: sel.number || 1,
              id: `model-${modelIndex++}`
            });
          }
        } else if (sel.type === 'model') {
          // Top-level model without nested selections
          models.push({
            name: sel.name,
            type: sel.type,
            number: sel.number || 1,
            id: `model-${modelIndex++}`
          });
        }
      }
    };

    processSelections(selections);
    return models;
  };

  // Load saved base sizes on mount
  useEffect(() => {
    const loadSavedBaseSizes = async () => {
      try {
        const response = await fetch('/api/base-sizes');
        const data = await response.json();
        setSavedBaseSizes(data);
      } catch (error) {
        console.error('Error loading saved base sizes:', error);
      }
    };

    loadSavedBaseSizes();
  }, []);

  // Load example army on mount
  useEffect(() => {
    const loadExampleArmy = async () => {
      try {
        const response = await fetch('/example.json');
        const data = await response.json();

        const selections = data.roster?.forces?.[0]?.selections || [];
        const models = extractModels(selections);

        setUnits(models);

        // Pre-populate base sizes from saved data
        const initialBaseSizes: { [key: string]: string } = {};
        const initialFlyDimensions: { [key: string]: { width: string; length: string } } = {};
        const initialIsRectangular: { [key: string]: boolean } = {};

        models.forEach(model => {
          const saved = savedBaseSizes[model.name];
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

    if (Object.keys(savedBaseSizes).length > 0 || units.length === 0) {
      loadExampleArmy();
    }
  }, [savedBaseSizes]);

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
        const models = extractModels(selections);

        setUnits(models);

        // Pre-populate base sizes from saved data
        const initialBaseSizes: { [key: string]: string } = {};
        const initialFlyDimensions: { [key: string]: { width: string; length: string } } = {};
        const initialIsRectangular: { [key: string]: boolean } = {};

        models.forEach(model => {
          const saved = savedBaseSizes[model.name];
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

  // Save base sizes whenever they change
  const updateBaseSize = (unitId: string, unitName: string, value: string) => {
    setBaseSizes((prev) => ({
      ...prev,
      [unitId]: value
    }));

    // Update saved base sizes by model name
    const newSavedBaseSizes = {
      ...savedBaseSizes,
      [unitName]: value
    };
    setSavedBaseSizes(newSavedBaseSizes);

    // Save to file
    fetch('/api/base-sizes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSavedBaseSizes)
    }).catch(error => console.error('Error saving base sizes:', error));
  };

  // Save fly dimensions whenever they change
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

    // Update saved base sizes by model name
    const newSavedBaseSizes = {
      ...savedBaseSizes,
      [unitName]: newDims
    };
    setSavedBaseSizes(newSavedBaseSizes);

    // Save to file
    fetch('/api/base-sizes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSavedBaseSizes)
    }).catch(error => console.error('Error saving base sizes:', error));
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
          <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
            {units.map((unit) => {
              const isRect = isRectangular[unit.id];
              const hasBaseSize = isRect
                ? (flyDimensions[unit.id]?.width && flyDimensions[unit.id]?.length)
                : baseSizes[unit.id];
              const isRed = !hasBaseSize;

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

                    <button
                      onClick={() => {
                        if (isRect) {
                          const dims = flyDimensions[unit.id];
                          console.log(`Spawning ${unit.name} with dimensions ${dims.width}×${dims.length}mm`);
                        } else {
                          console.log(`Spawning ${unit.name} with base size ${baseSizes[unit.id]}mm`);
                        }
                      }}
                      disabled={!hasBaseSize}
                      className={`flex-1 px-3 py-1 text-sm font-semibold rounded transition-colors ${
                        hasBaseSize
                          ? 'bg-[#0f4d0f] hover:bg-[#39FF14] hover:text-black text-white'
                          : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      Spawn
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </aside>
    </>
  );
}
