'use client';

import Link from 'next/link';
import { useMemo, useSyncExternalStore } from 'react';
import layoutsData from '../../public/reference/11th-edition/data/event-layouts.json';
import deploymentPlans from '../../public/reference/11th-edition/plans/index.json';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

function subscribeToLocalSaves(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function localSaveSnapshot() {
  return layoutsData.layouts
    .filter((layout) => localStorage.getItem(`deployment-planner:v2:${layout.id}`) !== null)
    .map(({ id }) => id)
    .join(',');
}

export default function PlanLibrary() {
  const savedSnapshot = useSyncExternalStore(subscribeToLocalSaves, localSaveSnapshot, () => '');
  const savedLayouts = useMemo(() => new Set(savedSnapshot ? savedSnapshot.split(',') : []), [savedSnapshot]);
  const plannedLayouts = useMemo(() => new Map(deploymentPlans.plans.map((plan) => [plan.layoutId, plan])), []);
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
          <Link href="/">← Missions</Link>
          <h1>Deployment plan library</h1>
          <p>Every objective matchup and official layout. Bundled plans and local browser saves are marked.</p>
        </div>
      </header>
      <div className="plan-library-summary">
        <strong>{deploymentPlans.plans.length} bundled plans</strong>
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
                  <Link className={`plan-layout-card${bundled || saved ? ' planned' : ''}`} href={`/planner/?layout=${layout.id}`} key={layout.id}>
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
