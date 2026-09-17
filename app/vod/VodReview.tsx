import Link from 'next/link';
import data from '../../public/vod/fowler-parry/analysis.json';
import BoardDiagram from './BoardDiagram';
import './vod.css';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const timestamp = (second: number) => [Math.floor(second / 3600), Math.floor(second / 60) % 60, second % 60].map(n => String(n).padStart(2, '0')).join(':');
const video = (second: number, id = data.videoId) => `https://www.youtube.com/watch?v=${id}&t=${second}s`;
// Short excerpts from the broadcast's automatic English captions.
const captions: Record<number, {second: number; text: string}> = {
  4500: {second: 4421, text: 'Going after the Defiler here.'},
  5700: {second: 5603, text: 'Six damage dead.'},
  11040: {second: 11009, text: '78–45 is the finish.'},
};
const labels: Record<number, string> = {
  2400: 'Deployment', 4500: 'Thousand Sons · turn 1',
  5700: 'After turn 1 shooting', 7500: 'Turn 2 · after the counterattack',
  8700: 'Midgame', 10920: 'Turn 4 · late board', 11040: 'Final score',
};

export default function VodReview() {
  return <main className="vod-site">
    <header className="vod-header">
      <h1>Alex Fowler vs Frasier Parry</h1>
      <p>Thousand Sons · Grand Coven / Emperor’s Children · Carnival of Excess</p>
      <p>WTC Warmaster · 12 August 2026 · Priority Assets / Disruption · <a href={video(2400)}>WarGames Live ↗</a></p>
    </header>
    <p className="vod-key"><span>● Thousand Sons</span><span>● Emperor’s Children</span><span>◌ Unidentified group</span> · Maps approximate. Arrows join sampled positions, not exact movement paths or complete turns.</p>
    <div className="vod-sequence">
      {data.checkpoints.map(frame => <section className="vod-moment" id={`frame-${frame.second}`} key={frame.second} aria-labelledby={`heading-${frame.second}`}>
        <header className="vod-moment-heading"><h2 id={`heading-${frame.second}`}>{labels[frame.second]}</h2><a href={video(frame.second)}>{timestamp(frame.second)} ↗</a><span className="vod-score">TS {frame.score[0]} — EC {frame.score[1]}</span></header>
        <div className={`vod-moment-content ${frame.camera !== 'overhead' ? 'vod-nonboard' : ''}`}>
          <figure className="vod-frame"><img src={`${basePath}/vod/fowler-parry/${String(frame.second).padStart(6, '0')}.jpg`} alt={frame.alt} width="1600" height="900" /><figcaption>{data.broadcaster} · {timestamp(frame.second)}</figcaption></figure>
          {frame.camera === 'overhead' && <BoardDiagram second={frame.second} />}
          {captions[frame.second] && <aside className="vod-caption"><blockquote>“{captions[frame.second].text}”</blockquote><a href={video(captions[frame.second].second)}>{timestamp(captions[frame.second].second)} · auto-captions ↗</a></aside>}
        </div>
        {frame.second === 10920 && <p className="vod-small">37-minute gap from the previous overhead; intervening moves are not fully tracked.</p>}
        {frame.second === 11040 && <p className="vod-small">Final total includes turn-five scoring entered at the finish.</p>}
      </section>)}
    </div>
    <footer className="vod-footer">
      <p>More Grand Coven with Magnus · not yet analysed</p>
      {data.queue.map(game => <a key={game.videoId} href={video(game.second, game.videoId)}>{game.player ?? 'Alex Fowler'} vs {game.opponent} ↗</a>)}
      <nav><a href={data.indexUrl}>Game source</a><a href={`${basePath}/vod/fowler-parry/frames.json`}>Frame provenance</a><Link href="/missions/">Missions</Link><Link href="/planner/">Planner</Link><Link href="/plans/">Plans</Link><Link href="/reviews/">Reviews</Link></nav>
    </footer>
  </main>;
}
