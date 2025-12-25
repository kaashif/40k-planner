'use client';

import { useState, useRef } from 'react';

interface Unit {
  name: string;
  type: string;
  number: number;
}

export default function ArmySidebar() {
  const [units, setUnits] = useState<Unit[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleJsonImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Extract units from the JSON structure
        const selections = data.roster?.forces?.[0]?.selections || [];
        const unitSelections = selections.filter(
          (sel: Unit) => sel.type === 'unit' || sel.type === 'model'
        );

        setUnits(unitSelections);
      } catch (error) {
        console.error('Error parsing JSON:', error);
        setUnits([{ name: 'Error parsing JSON', type: 'error', number: 1 }]);
      }
    }
  };

  return (
    <>
      <aside className="w-80 bg-[#0f0f0f] border-r border-[#1a2a1a] p-6 min-h-screen">
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
            {units.flatMap((unit, unitIdx) =>
              Array.from({ length: unit.number }, (_, idx) => (
                <div
                  key={`${unitIdx}-${idx}`}
                  className="p-3 bg-[#1a1a1a] border border-[#1a2a1a] rounded-lg text-gray-300 hover:border-[#39FF14] transition-colors"
                >
                  {unit.name}
                </div>
              ))
            )}
          </div>
        )}
      </aside>
    </>
  );
}
