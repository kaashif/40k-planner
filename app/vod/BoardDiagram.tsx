export type TerrainLayout = {label:string;image:string;width:number;height:number;confidence:string;sourceUrl:string;note:string;evidence:string};
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
type Sighting = {second:number;x:number;y:number};
type Group = {x:number;y:number;label:string;side:'ts'|'ec'|'unknown';key?:string;vehicle?:boolean;uncertain?:boolean;dx?:number;dy?:number;trail?:Sighting[]};
export type BoardState = {terrain:{x:number;y:number;w:number;h:number;r:number}[];groups:Group[]};
const stamp=(s:number)=>[Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(n=>String(n).padStart(2,'0')).join(':');

export default function BoardDiagram({second,board,previousBoard,gameId,layout}: {second:number;board:BoardState;previousBoard?:{second:number;board:BoardState};gameId:string;layout?:TerrainLayout}) {
  const width=layout && layout.height>layout.width?440:600;
  const height=layout?width*layout.height/layout.width:440;
  const sx=width/100, sy=height/100;
  const id=`board-${gameId}-${second}`;
  const colors={ts:'#78e3d0',ec:'#f8a5c5',unknown:'#d3c9aa'};
  return <section className="vod-board" aria-label="Unit positions on matched terrain layout">
    <div className="vod-board-heading">{previousBoard?`${stamp(previousBoard.second)} → ${stamp(second)}`:`First sampled positions · ${stamp(second)}`}</div>
    <svg viewBox={`0 0 ${width+40} ${height+40}`} role="img" aria-labelledby={`${id}-title ${id}-description`}>
      <title id={`${id}-title`}>{`Approximate unit-group positions at ${stamp(second)}`}</title>
      <desc id={`${id}-description`}>{`Teal: Thousand Sons; pink: opponent. ${layout ? `Likely layout: ${layout.label}. Unit positions approximate.` : "Terrain and positions approximate."} ${board.groups.map(g=>g.label).join(', ')}. Arrows connect observed positions, not verified continuous routes.`}</desc>
      <defs><pattern id={`${id}-grid`} width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0 L0 0 0 40" fill="none" stroke="#263c40" strokeWidth=".5"/></pattern>{Object.entries(colors).map(([side,color])=><marker key={side} id={`${id}-arrow-${side}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill={color}/></marker>)}</defs>
      <rect x="12" y="12" width={width+16} height={height+16} rx="5" fill="#111e24" stroke="#547078"/>
      <rect x="20" y="20" width={width} height={height} fill={`url(#${id}-grid)`}/>
      <g transform="translate(20 20)">
        {layout ? <image className="vod-terrain-image" href={`${basePath}${layout.image}`} width={width} height={height} preserveAspectRatio="none"/> : board.terrain.map((r,i)=><g key={i} transform={`translate(${r.x*sx} ${r.y*sy}) rotate(${r.r} ${r.w*sx/2} ${r.h*sy/2})`}><rect width={r.w*sx} height={r.h*sy} fill="#26363d" stroke="#4a5b60"/><path d={`M4 ${r.h*sy-4} V4 H${r.w*sx-4}`} stroke="#718084" strokeWidth="4" fill="none"/></g>)}
        {board.groups.filter(g=>g.key).map(g=>{
          const old=previousBoard?.board.groups.find(p=>p.key===g.key);
          if(!old)return null;
          const trail=(g.trail??[]).filter(p=>p.second>previousBoard!.second && p.second<second);
          const points=[old,...trail,g];
          if(points.every(p=>Math.hypot(p.x-old.x,p.y-old.y)<=4))return null;
          return <g key={`move-${g.key}`} className="vod-movement"><circle cx={old.x*sx} cy={old.y*sy} r="10" fill="#111e24" stroke={colors[g.side]} strokeDasharray="3 3" opacity=".7"/><polyline points={points.map(p=>`${p.x*sx},${p.y*sy}`).join(' ')} fill="none" stroke={colors[g.side]} strokeWidth="2.5" strokeDasharray="6 4" markerEnd={`url(#${id}-arrow-${g.side})`}/>{trail.map(p=><circle key={p.second} className="vod-sighting" cx={p.x*sx} cy={p.y*sy} r="4" fill={colors[g.side]}><title>{`${g.label}: sighted ${stamp(p.second)}`}</title></circle>)}</g>;
        })}
        {board.groups.map((g,i)=><g key={`${g.label}-${i}`} transform={`translate(${g.x*sx} ${g.y*sy})`}><circle r="10" fill="#15242b" stroke={colors[g.side]} strokeWidth="2.5" strokeDasharray={g.uncertain?'3 2':undefined}/>{g.vehicle?<rect x="-5" y="-7" width="10" height="14" rx="2" fill={colors[g.side]} opacity=".8"/>:<circle r="4" fill={colors[g.side]}/>}<text x={g.dx??(g.x>78?-14:14)} y={g.dy??4} textAnchor={g.dx===undefined&&g.x>78?'end':undefined} fill={colors[g.side]} fontSize="11" fontFamily="Arial,sans-serif" fontWeight="600" paintOrder="stroke" stroke="#111e24" strokeWidth="4" strokeLinejoin="round">{g.label}</text></g>)}
      </g>
    </svg>
    {layout && <p className="vod-small vod-layout-caption"><strong>{layout.confidence}: {layout.label}</strong><br/><a href={`${basePath}${layout.image}`}>Terrain PNG ↗</a> · <a href={layout.sourceUrl}>15 August archive ↗</a><br/>Unit positions approximate. Layout colours are not player colours.</p>}
  </section>;
}
