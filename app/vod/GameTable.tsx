import Link from 'next/link';
import BoardDiagram from './BoardDiagram';
import { games } from './games';

const overview: Record<string,{reserve:string;other:string;position:string;second:number}> = {
  'fowler-parry': {reserve:'Winged Daemon Prince and one Enlightened unit — reported in reserve.',other:'Scarabs + Terminator Sorcerer start on-board. Two Rubric units are embarked in the Rhino, not in reserve.',position:'Deployment view. Only identifiable TS pieces are plotted; the Scarabs are confirmed by the later close-up, not located precisely here.',second:2400},
  'fowler-power': {reserve:'10 Scarabs + Terminator Sorcerer, winged Daemon Prince and 3 spear Enlightened — explicitly declared in reserve.',other:'Two Rubric units start in the Rhino, not in reserve.',position:'Bottom turn one: earliest reviewed board position, not exact deployment.',second:18000},
  'yarin-iyer': {reserve:'Unknown. No verified starting-reserve declaration.',other:'The roster contains 10 Scarabs, a Terminator Sorcerer and a winged Prince; list inclusion does not establish reserves.',position:'Early board position. Magnus is behind the centre-right line; northern Scarab identity is probable. Exact deployment unresolved.',second:3000},
  'most-fritschen': {reserve:'Unknown. No verified starting-reserve declaration.',other:'The roster contains 10 Scarabs and a Terminator Sorcerer. Crystal is on the Infernal Master.',position:'Opening sampled board. Magnus is left-middle; this is not a verified pregame deployment.',second:24000},
  'terroxer-allot': {reserve:'Unknown. No clear unit-level reserve declaration recovered.',other:'No Scarab Terminators in this list. Hidden or embarked models cannot be counted as reserves.',position:'Top turn one: earliest reviewed board position, not exact deployment.',second:15000},
};

export default function GameTable() {
 return <section className="vod-overview" aria-labelledby="deployment-overview"><h2 id="deployment-overview">Games, starting reserves and deployment</h2><p>Diagrams show identifiable Thousand Sons pieces on the board for orientation. Teal markers are TS; dotted markers and “?” indicate uncertain identities. Unseen units are omitted. Positions and terrain are approximate.</p>
 <table className="vod-game-table"><caption>All five game analyses · starting reserves and earliest useful TS positions</caption><thead><tr><th scope="col">Game</th><th scope="col">Starting reserves</th><th scope="col">Thousand Sons deployment / early position</th></tr></thead><tbody>{games.map(game=>{
 const entry=overview[game.id];
 const frame=game.frames.find(f=>f.second===entry.second)!;
 const board={...frame.board!,groups:frame.board!.groups.filter(g=>g.side==='ts')};
 return <tr key={game.id} id={game.id}><th scope="row"><h3><Link href={`/vod/${game.id}/`}>{game.title} →</Link></h3><p>{game.matchup}</p><p>{game.event}</p><p>{game.edition ?? '11th edition'}</p><p className="vod-table-result">{game.result}</p><Link href={`/vod/${game.id}/`}>Full analysis and sources</Link></th><td data-label="Starting reserves"><p><strong>{entry.reserve}</strong></p><p>{entry.other}</p><Link href={`/vod/${game.id}/#${game.id}-heading`}>Declaration evidence and arrival timeline →</Link></td><td data-label="Deployment / early position"><p>{entry.position}</p><BoardDiagram gameId={`overview-${game.id}`} second={frame.second} board={board} layout={game.terrainLayout}/><a href={`https://www.youtube.com/watch?v=${game.videoId}&t=${frame.second}s`}>Watch this position ↗</a> · <Link href={`/vod/${game.id}/#${game.id}-${frame.second}`}>Screenshot and full diagram →</Link></td></tr>;
 })}</tbody></table></section>;
}
