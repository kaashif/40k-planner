'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ArmyImporter from './components/ArmyImporter';
import DeploymentPlanner from './components/DeploymentPlanner';
import FlashcardMaker from './components/FlashcardMaker';

type Tab = 'army' | 'deployment' | 'flashcards';

function TabContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>('deployment');

  useEffect(() => {
    const tab = searchParams.get('tab') as Tab;
    if (tab && ['army', 'deployment', 'flashcards'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    router.push(`?tab=${tab}`, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-[#39FF14] mb-2">
            Warhammer 40k Tournament Planner
          </h1>
          <p className="text-gray-400">
            Prepare for battle with the Necron dynasties
          </p>
        </header>

        <div className="mb-6 border-b border-[#1a2a1a]">
          <nav className="flex gap-1">
            <button
              onClick={() => handleTabChange('army')}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'army'
                  ? 'border-[#39FF14] text-[#39FF14]'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              Army Importer
            </button>
            <button
              onClick={() => handleTabChange('deployment')}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'deployment'
                  ? 'border-[#39FF14] text-[#39FF14]'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              Deployment & Turns
            </button>
            <button
              onClick={() => handleTabChange('flashcards')}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'flashcards'
                  ? 'border-[#39FF14] text-[#39FF14]'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              Flashcards
            </button>
          </nav>
        </div>

        <main className="bg-[#0f0f0f] border border-[#1a2a1a] rounded-lg p-6">
          {activeTab === 'army' && <ArmyImporter />}
          {activeTab === 'deployment' && <DeploymentPlanner />}
          {activeTab === 'flashcards' && <FlashcardMaker />}
        </main>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <TabContent />
    </Suspense>
  );
}
