'use client';

import { useState, useRef } from 'react';

interface Unit {
  name: string;
  type: string;
  number: number;
}

interface UnitWithBase extends Unit {
  baseSize?: string;
  id: string;
}

export default function ArmySidebar() {
  const [units, setUnits] = useState<UnitWithBase[]>([]);
  const [baseSizes, setBaseSizes] = useState<{ [key: string]: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleJsonImport = () => {
    fileInputRef.current?.click();
  };

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
        setBaseSizes({});
      } catch (error) {
        console.error('Error parsing JSON:', error);
        setUnits([{ name: 'Error parsing JSON', type: 'error', number: 1, id: 'error' }]);
      }
    }
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
              const hasBaseSize = baseSizes[unit.id];
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
                  <p className="font-semibold text-gray-200 mb-2">{unit.name}</p>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400 whitespace-nowrap">{unit.number} models</span>
                    <input
                      type="number"
                      value={baseSizes[unit.id] || ''}
                      onChange={(e) =>
                        setBaseSizes((prev) => ({
                          ...prev,
                          [unit.id]: e.target.value
                        }))
                      }
                      placeholder="mm"
                      className="w-16 px-2 py-1 text-sm bg-[#0a0a0a] border border-[#2a2a2a] rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#39FF14] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => console.log(`Spawning ${unit.name} with base size ${baseSizes[unit.id]}mm`)}
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
