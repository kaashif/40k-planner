'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import missionsData from '../public/reference/11th-edition/data/missions.json';
import layoutsData from '../public/reference/11th-edition/data/event-layouts.json';
import deploymentPlans from '../public/reference/11th-edition/plans/index.json';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const referenceRoot = `${basePath}/reference/11th-edition`;
const doubleSidedCards = new Set([
  'disruption/death-trap',
  'disruption/smoke-and-mirrors',
  'disruption/locate-and-deny',
  'reconnaissance/triangulation',
  'reconnaissance/surveil-the-foe',
  'reconnaissance/gather-intel',
  'priority-assets/secure-asset',
  'priority-assets/vital-link',
  'priority-assets/extract-relic',
  'priority-assets/vanguard-operation',
  'priority-assets/sabotage',
]);

function slug(value: string) {
  return value.toLowerCase().replaceAll("'", '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function Home() {
  const [playerDispositionId, setPlayerDispositionId] = useState('take-and-hold');
  const [opponentDispositionId, setOpponentDispositionId] = useState('take-and-hold');

  const playerDisposition = missionsData.forceDispositions.find(({ id }) => id === playerDispositionId)!;
  const opponentDisposition = missionsData.forceDispositions.find(({ id }) => id === opponentDispositionId)!;
  const playerMission = playerDisposition.primaryMissionsByOpponent[
    opponentDispositionId as keyof typeof playerDisposition.primaryMissionsByOpponent
  ];
  const opponentMission = opponentDisposition.primaryMissionsByOpponent[
    playerDispositionId as keyof typeof opponentDisposition.primaryMissionsByOpponent
  ];

  const selectedLayouts = useMemo(() => layoutsData.layouts.filter((layout) => {
    const left = layout.attacker.forceDisposition;
    const right = layout.defender.forceDisposition;
    return (
      (left === playerDisposition.name && right === opponentDisposition.name) ||
      (left === opponentDisposition.name && right === playerDisposition.name)
    );
  }), [playerDisposition.name, opponentDisposition.name]);

  function selectMatchup(playerId: string, opponentId: string) {
    setPlayerDispositionId(playerId);
    setOpponentDispositionId(opponentId);
    requestAnimationFrame(() => document.getElementById('selected-layouts')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  return (
    <main className="tool">
      <header className="tool-header">
        <div>
          <h1>40k 11th edition missions</h1>
          <p>Chapter Approved 2026–27 / Event Companion v1.0</p>
        </div>
        <div className="reference-links">
          <Link href="/reviews/">Brighton deployment review</Link>
          <Link href="/plans/">Deployment plan library</Link>
          <a href={`${referenceRoot}/official/core-rules.pdf`}>Core rules PDF</a>
          <a href={`${referenceRoot}/current-layout-reference.pdf`}>Current layout reference PDF</a>
          <a href={`${referenceRoot}/official/terrain-area-footprints.pdf`}>Terrain footprints PDF</a>
        </div>
      </header>

      <section aria-labelledby="matrix-title">
        <div className="section-title">
          <h2 id="matrix-title">Primary mission matrix</h2>
          <span>Click a mission to show its three layouts.</span>
        </div>

        <div className="matrix-scroll">
          <table className="mission-matrix">
            <thead>
              <tr>
                <th className="matrix-corner">You ↓ / Opponent →</th>
                {missionsData.forceDispositions.map((opponent) => (
                  <th key={opponent.id}>{opponent.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {missionsData.forceDispositions.map((player) => (
                <tr key={player.id}>
                  <th>{player.name}</th>
                  {missionsData.forceDispositions.map((opponent) => {
                    const mission = player.primaryMissionsByOpponent[
                      opponent.id as keyof typeof player.primaryMissionsByOpponent
                    ];
                    const active = player.id === playerDispositionId && opponent.id === opponentDispositionId;
                    return (
                      <td key={opponent.id}>
                        <button
                          className={active ? 'active' : ''}
                          type="button"
                          aria-pressed={active}
                          onClick={() => selectMatchup(player.id, opponent.id)}
                        >
                          {mission}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="selected-layouts" id="selected-layouts" aria-live="polite">
        <div className="selected-heading">
          <div>
            <span>Your disposition</span>
            <strong>{playerDisposition.name}</strong>
            <b>{playerMission}</b>
          </div>
          <div className="versus">vs</div>
          <div>
            <span>Opponent disposition</span>
            <strong>{opponentDisposition.name}</strong>
            <b>{opponentMission}</b>
          </div>
        </div>

        <div className="primary-cards">
          <PrimaryCard
            label="Your primary card"
            dispositionId={playerDisposition.id}
            dispositionName={playerDisposition.name}
            mission={playerMission}
          />
          <PrimaryCard
            label="Opponent primary card"
            dispositionId={opponentDisposition.id}
            dispositionName={opponentDisposition.name}
            mission={opponentMission}
          />
        </div>

        <div className="layouts-label">Possible layouts</div>
        <div className="layout-grid">
          {selectedLayouts.map((layout) => {
            const page = String(layout.pdfPage).padStart(2, '0');
            const hasDeploymentPlan = deploymentPlans.plans.some(({ layoutId }) => layoutId === layout.id);
            return (
              <article className="layout" key={layout.id}>
                <div className="layout-heading">
                  <h3>Layout {layout.layout}</h3>
                  <a href={`${referenceRoot}/current-layout-reference.pdf#page=${layout.pdfPage - 7}`} target="_blank">
                    PDF page {layout.pdfPage} ↗
                  </a>
                </div>
                <Link className="layout-planner-link" href={`/planner/?layout=${layout.id}`}>
                  {/* This measured preview is synchronized from the current GDM/Battlemaster set. */}
                  <img
                    src={`${referenceRoot}/layouts/layout-${page}.jpg`}
                    alt={`${playerDisposition.name} versus ${opponentDisposition.name}, layout ${layout.layout}`}
                  />
                  <span>{hasDeploymentPlan ? 'Open planned Necron deployment' : 'Open deployment planner'}</span>
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <details className="reference-section">
        <summary>Secondary mission index ({missionsData.secondaryMissions.length})</summary>
        <div className="secondary-list">
          {missionsData.secondaryMissions.map((mission) => (
            <span key={mission.id}>{mission.name}{mission.fixed ? ' [fixed]' : ''}</span>
          ))}
        </div>
      </details>

      <details className="reference-section">
        <summary>Raw reference files</summary>
        <div className="file-list">
          <a href={`${referenceRoot}/data/missions.json`}>missions.json</a>
          <a href={`${referenceRoot}/data/event-layouts.json`}>event-layouts.json</a>
          <a href={`${referenceRoot}/data/sources.json`}>sources.json</a>
          <a href={`${referenceRoot}/extracted/core-rules.txt`}>core-rules.txt</a>
          <a href={`${referenceRoot}/extracted/event-companion.txt`}>event-companion.txt</a>
        </div>
      </details>
    </main>
  );
}

function PrimaryCard({ label, dispositionId, dispositionName, mission }: {
  label: string;
  dispositionId: string;
  dispositionName: string;
  mission: string;
}) {
  const missionSlug = slug(mission);
  const cardKey = `${dispositionId}/${missionSlug}`;
  const imageRoot = `${referenceRoot}/cards/${cardKey}`;

  return (
    <article className="primary-card">
      <div className="primary-card-heading">
        <div><span>{label}</span><strong>{dispositionName} — {mission}</strong></div>
      </div>
      <div className={`card-images${doubleSidedCards.has(cardKey) ? ' double-sided' : ''}`}>
        <img src={`${imageRoot}.png`} alt={`${mission} primary mission card`} />
        {doubleSidedCards.has(cardKey) && (
          <img src={`${imageRoot}-back.png`} alt={`${mission} primary mission card reverse`} />
        )}
      </div>
    </article>
  );
}
