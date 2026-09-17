import BoardDiagram, { type BoardState } from './BoardDiagram';

export type Game = {
  id: string; title: string; matchup: string; event: string; mission: string;
  videoId: string; broadcaster: string; indexUrl: string; result: string; notes?: string;
  frames: { second: number; label: string; score?: number[]; image: string; alt: string;
    caption?: { second:number; text:string }; board?: BoardState }[];
};
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const timestamp = (s:number) => [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(n=>String(n).padStart(2,'0')).join(':');

export default function GameSequence({game}: {game:Game}) {
  const video = (s:number) => `https://www.youtube.com/watch?v=${game.videoId}&t=${s}s`;
  return <section className="vod-game" id={game.id} aria-labelledby={`${game.id}-heading`}>
    <header className="vod-header">
      <h2 id={`${game.id}-heading`}>{game.title} <span>{game.result}</span></h2>
      <p>{game.matchup}</p><p>{game.event} · {game.mission} · <a href={video(game.frames[0].second)}>{game.broadcaster} ↗</a> · <a href={game.indexUrl}>Game source</a></p>
      {game.notes && <p className="vod-small">{game.notes}</p>}
    </header>
    <div className="vod-sequence">
      {game.frames.map((frame,index) => {
        const previous = game.frames.slice(0,index).findLast(f=>f.board);
        return <section className="vod-moment" id={`${game.id}-${frame.second}`} key={frame.second} aria-labelledby={`${game.id}-${frame.second}-heading`}>
          <header className="vod-moment-heading"><h3 id={`${game.id}-${frame.second}-heading`}>{frame.label}</h3><a href={video(frame.second)}>{timestamp(frame.second)} ↗</a>{frame.score && <span className="vod-score">TS {frame.score[0]} — Opp. {frame.score[1]}</span>}</header>
          <div className={`vod-moment-content ${!frame.board?'vod-nonboard':''}`}>
            <figure className="vod-frame"><img src={`${basePath}/vod/${game.id}/${frame.image}`} alt={frame.alt} width="1600" height="900"/><figcaption>{game.broadcaster} · {timestamp(frame.second)}</figcaption></figure>
            {frame.board && <BoardDiagram second={frame.second} board={frame.board} previousBoard={previous?.board ? {second:previous.second,board:previous.board}:undefined} gameId={game.id}/>}
            {frame.caption && <aside className="vod-caption"><blockquote>“{frame.caption.text}”</blockquote><a href={video(frame.caption.second)}>{timestamp(frame.caption.second)} · captions ↗</a></aside>}
          </div>
        </section>;
      })}
    </div>
  </section>;
}
