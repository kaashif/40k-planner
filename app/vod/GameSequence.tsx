import BoardDiagram, { type BoardState, type TerrainLayout } from './BoardDiagram';

export type Game = {
  terrainLayout?: TerrainLayout;
  id: string; title: string; matchup: string; event: string; mission: string;
  videoId: string; broadcaster: string; indexUrl: string; result: string; notes?: string;
  date?: string; edition?: string; editionSource?: string; dateNote?: string;
  analysis?: {heading:string;text:string;seconds:number[]}[];
  lessons?: {text:string;seconds:number[]}[];
  lists?: {player:string;source:string;units:string[];notes:string}[];
  roster?: {image:string;second:number;label?:string;opponentImage?:string;opponentSecond?:number};
  deployment: {
    terminators: 'on-board' | 'reserve' | 'not-in-list' | 'unknown';
    items: {unit:string; status:string; evidence:string; sources:{label:string;url:string}[]}[];
    caveat?:string;
  };
  frames: { second: number; label: string; score?: number[]; image: string; alt: string;
    caption?: { second:number; text:string }; board?: BoardState;
    evidence?: {visible:string;interpretation:string;unknown:string;confidence:string} }[];
};
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const timestamp = (s:number) => [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(n=>String(n).padStart(2,'0')).join(':');

export default function GameSequence({game}: {game:Game}) {
  const video = (s:number) => `https://www.youtube.com/watch?v=${game.videoId}&t=${s}s`;
  return <section className="vod-game" id={game.id} aria-labelledby={`${game.id}-heading`}>
    <header className="vod-header">
      <h2 id={`${game.id}-heading`}>{game.title} <span>{game.result}</span></h2>
      <p>{game.matchup}</p><p>{game.event} · {game.mission} · <a href={video(game.frames[0].second)}>{game.broadcaster} ↗</a> · <a href={game.indexUrl}>Game source</a></p>
      {game.date && <p><strong>{game.date} · {game.edition}</strong>{game.editionSource && <> · <a href={game.editionSource}>Edition evidence ↗</a></>}</p>}
      {game.dateNote && <p className="vod-small">{game.dateNote}</p>}
      {game.notes && <p className="vod-small">{game.notes}</p>}
    </header>
    {game.terrainLayout && <section className="vod-review-text"><h3>Terrain layout · {game.terrainLayout.confidence}</h3><p><strong>{game.terrainLayout.label}</strong> — {game.terrainLayout.evidence}</p><p>{game.terrainLayout.note}</p><p><a href={`${basePath}${game.terrainLayout.image}`}>Open matched terrain PNG ↗</a> · <a href={game.terrainLayout.sourceUrl}>Archived planner layout ↗</a></p></section>}
    {game.analysis && <section className="vod-review-text" aria-label="Game summary and reserve timeline">{game.analysis.map(section=><div key={section.heading}><h3>{section.heading}</h3><p>{section.text}</p><p>{section.seconds.map(s=><a key={s} href={video(s)}>{timestamp(s)} ↗ </a>)}</p></div>)}</section>}
    {game.lessons && <section className="vod-lessons" aria-label="Melee matchup lessons"><h3>What to practise against melee pressure</h3><ul>{game.lessons.map(lesson=><li key={lesson.text}>{lesson.text}{' '}{lesson.seconds.map(s=><a key={s} href={video(s)}>{timestamp(s)} ↗ </a>)}</li>)}</ul></section>}
    {game.lists && <section className="vod-lists" aria-label="Verified event lists">{game.lists.map(list=><div key={list.player}><h3>{list.player} · <a href={list.source}>Event list ↗</a></h3><ul>{list.units.map(unit=><li key={unit}>{unit}</li>)}</ul><p className="vod-small">{list.notes}</p></div>)}</section>}
    <section className="vod-reserves" aria-label={`${game.title} starting reserves`}>
      <h3>Starting positions / reserves</h3>
      <dl>{game.deployment.items.map(item=><div key={item.unit}>
        <dt>{item.unit}</dt><dd><strong>{item.status}</strong> — {item.evidence}{' '}
          {item.sources.map(source=><a key={source.url} href={source.url}>{source.label} ↗</a>)}
        </dd>
      </div>)}</dl>
      {game.deployment.caveat && <p className="vod-small">{game.deployment.caveat}</p>}
    </section>
    {game.roster && <div className="vod-rosters">
      <figure><img src={`${basePath}/vod/${game.id}/${game.roster.image}`} alt={game.roster.label ?? 'Thousand Sons roster shown in the broadcast'} width="1600" height="900"/><figcaption><a href={video(game.roster.second)}>{game.roster.label ?? 'Thousand Sons roster'} · {timestamp(game.roster.second)} ↗</a></figcaption></figure>
      {game.roster.opponentImage && <figure><img src={`${basePath}/vod/${game.id}/${game.roster.opponentImage}`} alt="Opponent roster shown in the broadcast" width="1600" height="900"/><figcaption><a href={video(game.roster.opponentSecond!)}>Opponent roster · {timestamp(game.roster.opponentSecond!)} ↗</a></figcaption></figure>}
    </div>}
    <p className="vod-small"><a href={`${basePath}/vod/${game.id}/game.json`}>Structured analysis</a> · <a href={`${basePath}/vod/${game.id}/frames.json`}>Image provenance and timestamps</a> · <a href="https://github.com/kaashif/40k-planner/blob/main/docs/magnus-vs-world-eaters.md">Apply these games to your World Eaters matchup</a></p>
    <div className="vod-sequence">
      {game.frames.map((frame,index) => {
        const previous = game.frames.slice(0,index).findLast(f=>f.board);
        return <section className="vod-moment" id={`${game.id}-${frame.second}`} key={frame.second} aria-labelledby={`${game.id}-${frame.second}-heading`}>
          <header className="vod-moment-heading"><h3 id={`${game.id}-${frame.second}-heading`}>{frame.label}</h3><a href={video(frame.second)}>{timestamp(frame.second)} ↗</a>{frame.score && <span className="vod-score">TS {frame.score[0]} — Opp. {frame.score[1]}</span>}</header>
          <div className={`vod-moment-content ${!frame.board?'vod-nonboard':''}`}>
            <figure className="vod-frame"><img src={`${basePath}/vod/${game.id}/${frame.image}`} alt={frame.alt} width="1600" height="900"/><figcaption>{game.broadcaster} · {timestamp(frame.second)}</figcaption></figure>
            {frame.board && <BoardDiagram second={frame.second} board={frame.board} previousBoard={previous?.board ? {second:previous.second,board:previous.board}:undefined} gameId={game.id} layout={game.terrainLayout}/>}
            {frame.caption && <aside className="vod-caption"><blockquote>“{frame.caption.text}”</blockquote><a href={video(frame.caption.second)}>{timestamp(frame.caption.second)} · captions ↗</a></aside>}
          </div>
          {frame.evidence && <dl className="vod-evidence"><div><dt>Visible</dt><dd>{frame.evidence.visible}</dd></div><div><dt>Interpretation</dt><dd>{frame.evidence.interpretation}</dd></div><div><dt>Unknown</dt><dd>{frame.evidence.unknown}</dd></div><div><dt>Confidence</dt><dd>{frame.evidence.confidence}</dd></div></dl>}
        </section>;
      })}
    </div>
  </section>;
}
