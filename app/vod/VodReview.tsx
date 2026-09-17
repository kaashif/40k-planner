import Link from 'next/link';
import GameSequence, { type Game } from './GameSequence';
import parry from '../../public/vod/fowler-parry/game.json';
import power from '../../public/vod/fowler-power/game.json';
import terroxer from '../../public/vod/terroxer-allot/game.json';
import './vod.css';

export default function VodReview() {
  return <main className="vod-site">
    <h1>Grand Coven · Magnus</h1>
    <p className="vod-key"><span>● Thousand Sons</span><span>● Opponent</span><span>◌ Probable identity / previous position</span> · Maps approximate. Dotted arrows join sampled sightings, not exact routes. Labels with ? are uncertain.</p>
    {[parry,power,terroxer].map(game=><GameSequence key={game.id} game={game as Game}/>)}
    <footer className="vod-footer"><nav><Link href="/missions/">Missions</Link><Link href="/planner/">Planner</Link><Link href="/plans/">Plans</Link><Link href="/reviews/">Reviews</Link></nav></footer>
  </main>;
}
