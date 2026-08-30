'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import reviewData from '../../public/reference/11th-edition/plans/brighton-reviews.json';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const referenceRoot = `${basePath}/reference/11th-edition`;
const markerColour: Record<string, string> = {
  nightbringer: '#f97316',
  'void-dragon': '#a78bfa',
  ammentar: '#ffd166',
  'skorpekh-lord': '#f97316',
  'technomancer-veil': '#ffd166',
  technomancer: '#ffd166',
  reanimator: '#ffd166',
  'wraiths-left': '#39d98a',
  'wraiths-centre': '#39d98a',
  'flayed-ones': '#67e8f9',
  'flayed-ones-2': '#67e8f9',
  skorpekhs: '#a78bfa',
};

export default function BrightonReviews() {
  const [query, setQuery] = useState('');
  const [disposition, setDisposition] = useState('all');
  const reviews = useMemo(() => reviewData.reviews.filter((review) => {
    const haystack = `${review.id} ${review.opponent} ${review.team} ${review.faction} ${review.objective}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (disposition === 'all' || review.opponentDisposition === disposition);
  }), [query, disposition]);
  const dispositions = [...new Set(reviewData.reviews.map(({ opponentDisposition }) => opponentDisposition))];

  return (
    <main className="review-page">
      <header className="review-header">
        <div>
          <h1>Brighton deployment review</h1>
          <p>{reviewData.reviewCount} numbered drafts · {reviewData.opponentCount} opponents · layouts A/B/C</p>
        </div>
        <nav><Link href="/">Missions</Link><Link href="/plans/">Plan library</Link></nav>
      </header>

      <section className="review-notice">
        <p>Reply with the stable ID when you want a change, for example <strong>D-014</strong>. Every draft is base-legal and overlap-free; NB and R badges confirm that the full Nightbringer and Reanimator bases are both terrain-clear and screened from the sampled opposing deployment zone. “Exposed” counts every other friendly model with at least one sampled clear ray.</p>
        <p>Opponent-list analysis is based on the published Brighton roster text. Brando McCready&apos;s published entry contains no usable army list, so D-025–D-027 are explicitly faction/objective-generic.</p>
      </section>

      <div className="review-controls">
        <label>Find <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ID, player, team, faction…" /></label>
        <label>Matchup <select value={disposition} onChange={(event) => setDisposition(event.target.value)}><option value="all">All dispositions</option>{dispositions.map((value) => <option key={value}>{value}</option>)}</select></label>
        <span>{reviews.length} shown</span>
      </div>

      <section className="review-grid" aria-label="Numbered deployment reviews">
        {reviews.map((review) => <ReviewCard key={review.id} review={review} />)}
      </section>
    </main>
  );
}

function ReviewCard({ review }: { review: (typeof reviewData.reviews)[number] }) {
  const page = String(review.layoutPage).padStart(2, '0');
  const importantPass = review.audit.legal
    && review.audit.nightbringerTerrainClear
    && review.audit.reanimatorTerrainClear
    && review.audit.nightbringerHidden
    && review.audit.reanimatorHidden
    && review.audit.missileCompact;
  return (
    <article className="review-card" id={review.id.toLowerCase()}>
      <div className="review-card-heading">
        <strong>{review.id}</strong>
        <div><h2>{review.opponent}</h2><p>{review.team}</p></div>
        <span className={importantPass ? 'audit-pass' : 'audit-fail'}>{importantPass ? 'hard checks pass' : 'check failed'}</span>
      </div>
      <dl className="review-meta">
        <div><dt>Army</dt><dd>{review.faction}</dd></div>
        <div><dt>Objective</dt><dd>{review.objective}{review.abandonHome ? ' · Abandon Home' : ''}</dd></div>
        <div><dt>Layout</dt><dd>{review.layout} · {review.opponentDisposition}</dd></div>
      </dl>
      <a className="review-board" href={`${basePath}/planner/?layout=${review.layoutId}`} aria-label={`Open ${review.id} layout in the planner`}>
        <img loading="lazy" src={`${referenceRoot}/maps/layout-${page}.jpg`} alt={`${review.id}: layout ${review.layout} against ${review.opponent}`} />
        <svg viewBox="0 0 44 60" preserveAspectRatio="none" aria-hidden="true">
          {review.markers.map((marker) => {
            const radius = marker.widthMm / 25.4 / 2;
            return <g key={marker.id}><circle cx={marker.x} cy={marker.y} r={radius} fill={markerColour[marker.unitId] ?? '#f97316'} stroke="#090b0f" strokeWidth=".13" opacity=".94" /><text x={marker.x} y={marker.y + .22} textAnchor="middle" fontSize={Math.max(.55, Math.min(.82, radius * .72))} fontWeight="700" fill="#090b0f">{marker.label}</text></g>;
          })}
        </svg>
      </a>
      <div className="audit-row">
        <span className="audit-pass">legal</span>
        <span className="audit-pass">NB clear + hidden</span>
        <span className="audit-pass">R clear + hidden</span>
        <span className={review.audit.missileCompact ? 'audit-pass' : 'audit-fail'}>missile compact</span>
        <span className={review.audit.exposedModelCount ? 'audit-warn' : 'audit-pass'}>{review.audit.exposedModelCount} exposed</span>
        <span>{review.reserves.includes('void-dragon') ? 'VD reserve' : 'VD board'}</span>
      </div>
      <details>
        <summary>Matchup reasoning and audit</summary>
        <div className="review-details">
          <h3>List signals</h3>
          <ul>{review.threatSignals.map((signal) => <li key={signal}>{signal}</li>)}</ul>
          <h3>Applied plan</h3>
          <ul>{review.rationale.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          {review.audit.exposedModels.length > 0 && <p><strong>Sampled exposed models:</strong> {review.audit.exposedModels.join(', ')}</p>}
          <p><a href={`https://kaashif.github.io/brighton/lists/${review.listId}/`}>Opponent list ↗</a> · <a href={`${referenceRoot}/plans/brighton-reviews.json`}>Review data JSON</a></p>
        </div>
      </details>
    </article>
  );
}
