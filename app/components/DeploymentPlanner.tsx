'use client';

import { useState } from 'react';

interface Turn {
  number: number;
  notes: string;
}

export default function DeploymentPlanner() {
  const [deployment, setDeployment] = useState('');
  const [turns, setTurns] = useState<Turn[]>([
    { number: 1, notes: '' },
    { number: 2, notes: '' },
    { number: 3, notes: '' },
    { number: 4, notes: '' },
    { number: 5, notes: '' },
  ]);

  const updateTurn = (turnNumber: number, notes: string) => {
    setTurns(turns.map(turn =>
      turn.number === turnNumber ? { ...turn, notes } : turn
    ));
  };

  const handleClear = () => {
    setDeployment('');
    setTurns(turns.map(turn => ({ ...turn, notes: '' })));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4 text-[#39FF14]">Deployment & Turn Planner</h2>
        <p className="text-gray-400 mb-4">
          Plan your deployment strategy and outline your actions for each turn.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2 text-gray-200">Deployment Strategy</h3>
          <textarea
            value={deployment}
            onChange={(e) => setDeployment(e.target.value)}
            placeholder="Describe your deployment plan...&#10;- Unit positions&#10;- Screening units&#10;- Reserved units&#10;- Deployment zone coverage"
            className="w-full h-40 p-4 bg-[#1a1a1a] border border-[#1a2a1a] rounded-lg text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#39FF14] resize-none"
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3 text-gray-200">Turn-by-Turn Plan</h3>
          <div className="space-y-3">
            {turns.map((turn) => (
              <div key={turn.number} className="bg-[#1a1a1a] border border-[#1a2a1a] rounded-lg p-4">
                <label className="block mb-2 font-semibold text-[#39FF14]">
                  Turn {turn.number}
                </label>
                <textarea
                  value={turn.notes}
                  onChange={(e) => updateTurn(turn.number, e.target.value)}
                  placeholder={`Plan for turn ${turn.number}...`}
                  className="w-full h-24 p-3 bg-[#0a0a0a] border border-[#1a2a1a] rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#39FF14] resize-none text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleClear}
          className="px-6 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-gray-300 font-semibold rounded-lg transition-colors"
        >
          Clear All
        </button>
      </div>
    </div>
  );
}
