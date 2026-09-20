'use client';

import Link from 'next/link';
import NamedPlanLinks from './NamedPlanLinks';
import { useMemo, useState, useSyncExternalStore } from 'react';
import layoutsData from '../../public/reference/11th-edition/data/event-layouts.json';
import deploymentPlans from '../../public/reference/11th-edition/plans/index.json';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

function subscribeToLocalSaves(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function localSaveSnapshot() {
  return ['necrons','thousand-sons'].flatMap(army => layoutsData.layouts
    .filter(layout => localStorage.getItem(army === 'necrons' ? `deployment-planner:v2:${layout.id}` : `deployment-planner:v3:thousand-sons:${layout.id}`) !== null)
    .map(({id}) => `${army}:${id}`)).join(',');
}

export default function PlanLibrary() {
  const [army,setArmy] = useState('thousand-sons');
  const savedSnapshot = useSyncExternalStore(subscribeToLocalSaves, localSaveSnapshot, () => '');
  const savedLayouts = useMemo(() => new Set(savedSnapshot.split(',').filter(s=>s.startsWith(`${army}:`)).map(s=>s.slice(army.length+1))), [savedSnapshot,army]);
  const plannedLayouts = useMemo(() => new Map((army==='necrons'?deploymentPlans.plans:[]).map((plan) => [plan.layoutId, plan])), [army]);
  const matchups = useMemo(() => {
    const grouped = new Map<string, typeof layoutsData.layouts>();
    for (const layout of layoutsData.layouts) {
      const key = `${layout.attacker.forceDisposition} vs ${layout.defender.forceDisposition}`;
      grouped.set(key, [...(grouped.get(key) ?? []), layout]);
    }
    return [...grouped.entries()];
  }, []);

  return (
    <main className="plan-library-shell">
      <header className="planner-header">
        <div>
          <Link href="/">VOD analysis</Link>
          <Link href="/missions/">← Missions</Link>
          <h1>Deployment plan library</h1>
          <p>Every objective matchup and official layout. Bundled plans and local browser saves are marked.</p>
        </div>
      </header>
      <NamedPlanLinks/>
      <label>Army <select aria-label="Army" value={army} onChange={e=>setArmy(e.target.value)}><option value="thousand-sons">Somehow...Magnus returned</option><option value="necrons">Brighton Necrons</option></select></label>
      <div className="plan-library-summary">
        <strong>{plannedLayouts.size} bundled plans</strong>
        <span>{savedLayouts.size} layouts saved locally</span>
      </div>
      <div className="plan-matchup-grid">
        {matchups.map(([matchup, layouts]) => (
          <section className="plan-matchup" key={matchup}>
            <h2>{matchup}</h2>
            <div className="plan-layout-row">
              {layouts.map((layout) => {
                const page = String(layout.pdfPage).padStart(2, '0');
                const bundled = plannedLayouts.get(layout.id);
                const saved = savedLayouts.has(layout.id);
                return (
                  <Link className={`plan-layout-card${bundled || saved ? ' planned' : ''}`} href={`/planner/?layout=${layout.id}&army=${army}`} key={layout.id}>
                    <img
                      src={bundled ? `${basePath}/reference/11th-edition/plans/${bundled.preview}` : `${basePath}/reference/11th-edition/maps/layout-${page}.jpg`}
                      alt=""
                    />
                    <span><strong>Layout {layout.layout}</strong><small>{bundled ? 'Bundled plan' : saved ? 'Local plan' : 'Not planned yet'}</small></span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
