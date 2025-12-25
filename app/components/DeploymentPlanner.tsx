'use client';

import { useState } from 'react';
import Image from 'next/image';

interface Layout {
  id: string;
  title: string;
  image: string;
}

const layouts: Layout[] = [
  { id: 'terraform', title: 'Round 1: Terraform', image: '/round1_terraform.png' },
  { id: 'purge', title: 'Round 2: Purge the Foe', image: '/round2_purge.png' },
  { id: 'supplies', title: 'Round 3: Hidden Supplies', image: '/round3_hidden_supplies.png' },
  { id: 'linchpin', title: 'Round 4: Linchpin', image: '/round4_linchpin.png' },
  { id: 'take', title: 'Round 5: Take and Hold', image: '/round5_take.png' },
];

export default function DeploymentPlanner() {
  const [selectedLayout, setSelectedLayout] = useState(layouts[0]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4 text-[#39FF14]">Deployment & Turn Planner</h2>
        <p className="text-gray-400 mb-4">
          View terrain layouts for different mission types.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block mb-2 font-semibold text-gray-200">
            Select Mission Layout
          </label>
          <select
            value={selectedLayout.id}
            onChange={(e) => {
              const layout = layouts.find(l => l.id === e.target.value);
              if (layout) setSelectedLayout(layout);
            }}
            className="w-full p-3 bg-[#1a1a1a] border border-[#1a2a1a] rounded-lg text-gray-200 focus:outline-none focus:border-[#39FF14] cursor-pointer"
          >
            {layouts.map((layout) => (
              <option key={layout.id} value={layout.id}>
                {layout.title}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-[#1a1a1a] border border-[#1a2a1a] rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4 text-[#39FF14] text-center">
            {selectedLayout.title}
          </h3>
          <div className="relative w-full" style={{ aspectRatio: '1' }}>
            <Image
              src={selectedLayout.image}
              alt={selectedLayout.title}
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>
      </div>
    </div>
  );
}
