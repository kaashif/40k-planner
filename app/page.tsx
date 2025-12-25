'use client';

import { Suspense } from 'react';
import ArmySidebar from './components/ArmySidebar';
import DeploymentPlanner from './components/DeploymentPlanner';

function MainContent() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="flex">
        {/* Army Sidebar */}
        <ArmySidebar />

        {/* Main Content */}
        <div className="flex-1 p-8">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-[#39FF14] mb-2">
              Warhammer 40k Tournament Planner
            </h1>
          </header>

          <main className="bg-[#0f0f0f] border border-[#1a2a1a] rounded-lg p-6">
            <DeploymentPlanner />
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
