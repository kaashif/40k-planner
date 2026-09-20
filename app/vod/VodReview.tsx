import Link from 'next/link';
import { type Game } from './GameSequence';
import { games } from './games';
import './vod.css';
import GameTable from './GameTable';

export default function VodReview({embedded=false}:{embedded?:boolean}) {
  const Container=embedded?'section':'main';
  const Title=embedded?'h2':'h1';
  const count = (status:Game['deployment']['terminators']) => games.filter(game=>game.deployment.terminators===status).length;
  return <Container className={embedded?"home-game-studies":"vod-site"}>
    <Title>Grand Coven · Magnus</Title>
    <section className="vod-focus" aria-label="Fast melee study">
      <h2>Winning into fast melee</h2>
      <p>Reviewed 19 September 2026. New analyses: Blood Angels, <strong>21 August · 11th edition</strong>; Slaanesh Daemons, <strong>14 August · 11th edition</strong>. New to this collection, 29 and 36 days old at review.</p>
      <p>Core matchups to scout: World Eaters, Blood Angels, Space Wolves, Emperor’s Children, assault Orks, Drukhari and fast Daemon builds. Other factions qualify when their actual lists deliver fast melee pressure.</p>
      <p><a href="https://github.com/kaashif/40k-planner/blob/main/docs/fast-melee-vod-study.md">Army checklist, list comparison, tactical notes and search results ↗</a> · <a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/vod/search-2026-09-19.json`}>Source inventory ↗</a></p>
      <p><a href="https://github.com/kaashif/40k-planner/blob/main/docs/magnus-vs-world-eaters.md">Your Magnus list vs World Eaters: deployment, reserves and target priorities ↗</a></p>
      <p><a href="https://github.com/kaashif/40k-planner/blob/main/docs/world-eaters-game-plan.md">World Eaters game plan: concise summary ↗</a></p>
      <p><Link href="/matchups/world-eaters/">Purge vs Priority Assets: three deployment examples and charge calculator →</Link></p>
      <p><Link href="/tactics/screening/">Screening tactics: formations, Angron landings and combat follow-up →</Link></p>
      <p><Link href="/matchups/world-eaters/reserve-plan/">Scarabs + Prince off-board: your plan for PA vs Purge A, B and C →</Link></p>
      <nav><a href="#yarin-iyer">Blood Angels</a><a href="#most-fritschen">Slaanesh Daemons</a><a href="#fowler-parry">Emperor’s Children</a><a href="#fowler-power">Earlier Daemons win</a></nav>
    </section>
    <p className="vod-key"><span>● Thousand Sons</span><span>● Opponent</span><span>◌ Probable identity / previous position</span> · Maps approximate. Dotted arrows join sampled sightings, not exact routes. Labels with ? are uncertain.</p>
    <p className="vod-reserve-summary">Confirmed Terminator starts: <strong>{count('on-board')} on-board · {count('reserve')} in reserve</strong> (both Fowler). {count('unknown')} unknown starts; Terroxer has no Terminators. Lists confirm Terminators in both new games, but do not establish their reserve declarations. This tiny, win-only sample is not a general usage rate.</p>
    <GameTable/>
    <footer className="vod-footer"><nav><Link href="/missions/">Missions</Link><Link href="/planner/">Planner</Link><Link href="/plans/">Plans</Link><Link href="/reviews/">Reviews</Link></nav></footer>
  </Container>;
}
