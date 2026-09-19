import Link from 'next/link';
import { notFound } from 'next/navigation';
import { games } from '../games';
import GameSequence from '../GameSequence';
import '../vod.css';
export function generateStaticParams() { return games.map(game=>({gameId:game.id})); }
export default async function GamePage({params}:{params:Promise<{gameId:string}>}) {
 const {gameId}=await params;
 const game=games.find(g=>g.id===gameId);
 if(!game) notFound();
 return <main className="vod-site"><nav><Link href="/">← All game analyses</Link></nav><h1>{game.title} · game analysis</h1><p>All lists, deployment notes and evidence are visible below. Scroll through the game in timestamp order.</p><GameSequence game={game}/><footer className="vod-footer"><nav>{games.filter(g=>g.id!==gameId).map(g=><Link key={g.id} href={`/vod/${g.id}/`}>{g.title}</Link>)}</nav><nav><Link href="/">All games</Link><Link href="/missions/">Missions</Link></nav></footer></main>;
}
