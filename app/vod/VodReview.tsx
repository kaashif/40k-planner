'use client';

import { useState } from 'react';
import Link from 'next/link';
import data from '../../public/vod/fowler-parry/analysis.json';
import './vod.css';
import BoardDiagram from './BoardDiagram';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const frames = data.checkpoints;
const timestamp = (second: number) => [Math.floor(second / 3600), Math.floor(second / 60) % 60, second % 60].map(n => String(n).padStart(2, '0')).join(':');
const video = (second: number, id = data.videoId) => `https://www.youtube.com/watch?v=${id}&t=${second}s`;
const asset = (second: number) => `${basePath}/vod/fowler-parry/${String(second).padStart(6, '0')}.jpg`;

export default function VodReview() {
  const [selected, setSelected] = useState(0);
  const [compare, setCompare] = useState(false);
  const [annotations, setAnnotations] = useState(true);
  const frame = frames[selected];
  const previousOverhead = frames.slice(0, selected).findLastIndex(item => item.camera === 'overhead');
  const canCompare = frame.camera === 'overhead' && previousOverhead >= 0;
  const before = canCompare ? frames[previousOverhead] : null;

  return (
    <main className="vod-site">
      <a className="vod-skip" href="#review">Skip to the game review</a>
      <header className="vod-nav">
        <Link className="vod-brand" href="/" aria-label="40k Field Notes home"><span>40K</span> FIELD NOTES<span className="vod-brand-dot">●</span></Link>
        <nav aria-label="Main navigation">
          <a className="vod-nav-active" href="#review">VOD analysis</a>
          <a href="#watch-next">Watch next</a>
          <Link href="/missions/">Mission tools ↗</Link>
        </nav>
      </header>

      <section className="vod-intro">
        <div>
          <p className="vod-eyebrow">THOUSAND SONS / GRAND COVEN / 11TH EDITION</p>
          <h1>Read the board.<br /><span>Not just the result.</span></h1>
          <p className="vod-deck">A game, broken into the moments that changed it. Real broadcast frames, timestamped evidence, and honest gaps.</p>
        </div>
        <aside className="vod-pilot-label"><span className="vod-status">● PILOT REVIEW 001</span><strong>Fowler vs Parry</strong><span>WTC Warmaster GT · 12 Aug 2026</span><span>7 checkpoints · sampled, not a full replay</span></aside>
      </section>

      <section className="vod-match" aria-label="Pilot match information">
        <div><span className="vod-team-label">THOUSAND SONS · GRAND COVEN</span><h2>Alex Fowler <b>78</b></h2><p>Priority Assets</p></div>
        <span className="vod-vs">VS</span>
        <div className="vod-opponent"><span className="vod-team-label">EMPEROR’S CHILDREN · CARNIVAL OF EXCESS</span><h2>Frasier Parry <b>45</b></h2><p>Disruption</p></div>
        <a className="vod-source-button" href={video(2400)} target="_blank" rel="noreferrer">Watch on WarGames Live ↗</a>
      </section>
      <p className="vod-scope">Not a Priority Assets mirror or a Knights matchup. This is a positioning and target-allocation study, not a prescription for exposing Magnus to big Knights. Final score includes closing turn-five scoring.</p>

      <section id="review" className="vod-review" aria-labelledby="review-heading">
        <div className="vod-section-heading"><div><p className="vod-eyebrow">THE GAME, IN EVIDENCE</p><h2 id="review-heading">Follow the board state</h2></div><span>All times are broadcast timestamps</span></div>
        <div className="vod-timeline" role="group" aria-label="Game checkpoints">
          {frames.map((item, index) => <button type="button" key={item.second} aria-pressed={selected === index} onClick={() => setSelected(index)}><span>{String(index + 1).padStart(2, '0')} <time>{timestamp(item.second)}</time></span><strong>{item.label}</strong><i>{item.score.join(' – ')}</i></button>)}
        </div>

        <div className="vod-viewer-toolbar">
          <div className="vod-step-buttons"><button type="button" disabled={selected === 0} onClick={() => setSelected(selected - 1)} aria-label="Previous checkpoint">←</button><span>{selected + 1} / {frames.length}</span><button type="button" disabled={selected === frames.length - 1} onClick={() => setSelected(selected + 1)} aria-label="Next checkpoint">→</button></div>
          <div className="vod-view-options"><label><input type="checkbox" checked={annotations} onChange={event => setAnnotations(event.target.checked)} /> Board markers</label><label title={!canCompare ? 'Select an overhead checkpoint after deployment to compare.' : undefined}><input type="checkbox" checked={compare} disabled={!canCompare} onChange={event => setCompare(event.target.checked)} /> Compare overheads</label></div>
        </div>

        <div className={`vod-evidence-layout ${compare && canCompare ? 'vod-comparing' : ''}`}>
          <div className="vod-visual-column">
            <div className="vod-frame-pair">
              {compare && before && <figure className="vod-frame"><div className="vod-frame-caption"><span>BEFORE · {before.label}</span><a href={video(before.second)}>{timestamp(before.second)} ↗</a></div><img src={asset(before.second)} alt={before.alt} width="1600" height="900" /></figure>}
              <figure className="vod-frame">
                <div className="vod-frame-caption"><span>{compare && canCompare ? 'AFTER' : frame.camera.toUpperCase()} · {frame.label}</span><a href={video(frame.second)} target="_blank" rel="noreferrer">{timestamp(frame.second)} ↗</a></div>
                <div className="vod-image-wrap"><img src={asset(frame.second)} alt={frame.alt} width="1600" height="900" fetchPriority="high" />{annotations && frame.pins.map((pin, index) => <span key={pin.label} className="vod-pin" style={{ left: `${pin.x}%`, top: `${pin.y}%` }} title={pin.label} aria-label={`Marker ${index + 1}: ${pin.label}`}>{index + 1}</span>)}</div>
                <figcaption>Frame: {data.broadcaster} · original composition retained · <a href={asset(frame.second)} target="_blank" rel="noreferrer">Open full-size ↗</a></figcaption>
              </figure>
            </div>
            {annotations && frame.pins.length > 0 && <ol className="vod-pin-key">{frame.pins.map(pin => <li key={pin.label}>{pin.label}</li>)}</ol>}
            {compare && before && <p className="vod-comparison-note">Same overhead orientation, {Math.floor((frame.second - before.second) / 60)} minutes apart. Positions between these captures are not continuously tracked.</p>}
            <div className="vod-score-strip"><span>OVERLAY AT CAPTURE</span><strong className="vod-ts-score">TS {frame.score[0]}</strong><span>:</span><strong className="vod-ec-score">EC {frame.score[1]}</strong><small>May lag play; not a scoring ledger.</small></div>
            <BoardDiagram second={frame.second} />
          </div>

          <article className="vod-notes" aria-live="polite" aria-atomic="true">
            <p className="vod-eyebrow">{frame.phase}</p><h3>{frame.title}</h3>
            <section className="vod-note-block vod-observed"><h4>Visible in this frame <span>Direct evidence</span></h4><ul>{frame.visible.map(note => <li key={note}>{note}</li>)}</ul></section>
            {frame.reported.length > 0 && <section className="vod-note-block vod-reported"><h4>Reported in commentary <span>Caption-assisted</span></h4>{frame.reported.map(note => <p key={note.start}>{note.text} <a href={video(note.start)} target="_blank" rel="noreferrer">{timestamp(note.start)}–{timestamp(note.end)} ↗</a></p>)}</section>}
            <section className="vod-note-block vod-inferred"><h4>My read <span>Interpretation</span></h4><p>{frame.interpretation}</p></section>
            <details className="vod-unknown" open><summary>What this does not establish</summary><p>{frame.unknown}</p></details>
          </article>
        </div>
      </section>

      <section className="vod-takeaways" aria-labelledby="takeaway-heading">
        <div className="vod-section-heading"><div><p className="vod-eyebrow">TAKE TO YOUR NEXT REVIEW</p><h2 id="takeaway-heading">Three questions worth asking</h2></div></div>
        <div className="vod-takeaway-grid">
          <article><span>01 / COMMITMENT</span><h3>What can answer Magnus?</h3><p>He starts on-table and commits right. The counterattack reportedly leaves him on four wounds. Study the opposing threat, not just the eventual win.</p><button onClick={() => setSelected(3)} type="button">Review the counterattack ↑</button></article>
          <article><span>02 / DAMAGE PLAN</span><h3>Who finishes the target?</h3><p>The first Defiler kill is described as combined fire. Budget for follow-up damage instead of making the whole plan depend on Magnus’s first activation.</p><button onClick={() => setSelected(2)} type="button">Review the shooting sequence ↑</button></article>
          <article><span>03 / CONVERSION</span><h3>What survived to score?</h3><p>The debrief focuses on failing to remove both damage threats. The late total then leaps ahead; distinguish surviving output from a continuously comfortable lead.</p><button onClick={() => setSelected(6)} type="button">Review the finish ↑</button></article>
        </div>
      </section>

      <section id="watch-next" className="vod-queue" aria-labelledby="queue-heading">
        <div className="vod-section-heading"><div><p className="vod-eyebrow">THE WATCHLIST</p><h2 id="queue-heading">More Grand Coven, less searching</h2></div><span>Source-indexed · not yet analysed</span></div>
        <div className="vod-queue-grid">{data.queue.map((game, index) => <article key={game.videoId}><span className="vod-queue-tag">{index === 0 ? 'NEXT UP · YOUR MISSION MIRROR' : 'QUEUED · DIFFERENT MATCHUP'}</span><h3>{game.title}</h3><strong>{game.player ?? 'Alex Fowler'} vs {game.opponent}</strong><p>{game.note}</p><small>{game.date} · {game.broadcaster}</small><div><a href={video(game.second, game.videoId)} target="_blank" rel="noreferrer">Watch from indexed start ↗</a><a href={game.indexUrl} target="_blank" rel="noreferrer">Index / lists ↗</a></div></article>)}</div>
        <p className="vod-fine-print">Queue scores and timestamps come from 40kVODIndex, not a footage review; starts may include pre-game footage. Together with the pilot, these are three indexed Grand Coven wins. Only the pilot has been analysed here.</p>
        <p className="vod-fine-print">Review scope: Grand Coven with Magnus. The queued games’ Grand Coven detachments are index-confirmed; Magnus still needs roster or footage confirmation before analysis. No qualifying Knights game has been verified yet. Other detachments are excluded.</p>
      </section>

      <details className="vod-method" id="sources"><summary>Sources, method & limits <span>How this review was made</span></summary><div className="vod-method-grid"><section><h3>Evidence, not a synthetic replay</h3><p>Public broadcast frames were sampled coarsely to find the match, then more closely around opening movement, shooting, retaliation and the finish. Comparable overhead shots were preferred. Seven stills are published from 33 inspected candidate captures; automatic English captions helped locate reported events.</p><p>The index starts at 00:10:37, in a countdown. This review begins at 00:40:00 and stops in the post-game debrief, before the next match. The large midgame gap is intentional and labelled, not filled with invented moves.</p><p>Direct evidence refers to visible positions and overlays. Commentary is a fallible, caption-assisted report. “My read” is interpretation. This is not a verified dice log, rules audit, complete casualty ledger or exact range reconstruction.</p></section><section><h3>Original sources</h3><ul><li><a href={video(2400)}>WarGames Live · original broadcast ↗</a></li><li><a href={data.indexUrl}>40kVODIndex · pairing, dispositions and final score ↗</a></li><li><a href={data.rosterUrl}>Fowler’s linked BCP roster ↗</a> — login/JavaScript-dependent; full list not independently verified.</li><li><a href={data.editionSource}>11th-edition event pack linked by the broadcaster ↗</a></li><li><a href={`${basePath}/vod/fowler-parry/analysis.json`}>Checkpoint evidence data ↗</a> · <a href={`${basePath}/vod/fowler-parry/frames.json`}>Frame provenance & hashes ↗</a></li></ul><p>The broadcast displays Carnival of Excess; the index additionally lists Frenzied Host. No 10th-edition rules or data were used. The pilot is not claimed to use your exact roster.</p><p>Broadcast images belong to their respective owners and are reproduced as limited excerpts for analysis, with links to the original. Reviewed 17 September 2026.</p></section></div></details>

      <footer className="vod-footer"><div><strong>FIELD NOTES</strong><p>Watch carefully. Keep the uncertainty visible.</p></div><nav aria-label="Secondary tools"><Link href="/missions/">Mission matrix</Link><Link href="/planner/">Deployment planner</Link><Link href="/plans/">Plan library</Link><Link href="/reviews/">Deployment reviews</Link></nav></footer>
    </main>
  );
}
