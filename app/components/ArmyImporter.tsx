'use client';

import { useState } from 'react';

export default function ArmyImporter() {
  const [armyData, setArmyData] = useState('');
  const [parsedUnits, setParsedUnits] = useState<string[]>([]);

  const handleImport = () => {
    const units = armyData
      .split('\n')
      .filter(line => line.trim().length > 0);
    setParsedUnits(units);
  };

  const handleClear = () => {
    setArmyData('');
    setParsedUnits([]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4 text-[#39FF14]">Army Importer</h2>
        <p className="text-gray-400 mb-4">
          Paste your army list below. Each line will be treated as a separate unit.
        </p>
      </div>

      <div className="space-y-4">
        <textarea
          value={armyData}
          onChange={(e) => setArmyData(e.target.value)}
          placeholder="Paste your army list here...&#10;Example:&#10;Necron Warriors x20&#10;Overlord&#10;Immortals x10"
          className="w-full h-64 p-4 bg-[#1a1a1a] border border-[#1a2a1a] rounded-lg text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#39FF14] resize-none font-mono text-sm"
        />

        <div className="flex gap-3">
          <button
            onClick={handleImport}
            className="px-6 py-2 bg-[#0f4d0f] hover:bg-[#39FF14] hover:text-black text-white font-semibold rounded-lg transition-colors"
          >
            Import Army
          </button>
          <button
            onClick={handleClear}
            className="px-6 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-gray-300 font-semibold rounded-lg transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {parsedUnits.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-bold mb-4 text-[#39FF14]">
            Imported Units ({parsedUnits.length})
          </h3>
          <div className="bg-[#1a1a1a] border border-[#1a2a1a] rounded-lg p-4 space-y-2">
            {parsedUnits.map((unit, index) => (
              <div
                key={index}
                className="p-3 bg-[#0a0a0a] border border-[#1a2a1a] rounded text-gray-200 hover:border-[#39FF14] transition-colors"
              >
                {unit}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
