type Group = { x: number; y: number; label: string; side: 'ts' | 'ec' | 'unknown'; key?: string; vehicle?: boolean; uncertain?: boolean; dx?: number; dy?: number };
export type BoardState = { terrain: {x:number;y:number;w:number;h:number;r:number}[]; groups: Group[] };

// Hand-traced from the five published overhead frames, not a measured terrain pack.
// Each marker represents a unit/group, never an exact model count or base size.
const positions: Record<number, Group[]> = {
  2400: [
    { x: 63, y: 8, label: 'Magnus', side: 'ts', key: 'magnus', dx: 12, dy: 4 },
    { x: 57, y: 4, label: 'White transport', side: 'ts', key: 'white', vehicle: true, dx: -116, dy: 18 },
    { x: 19, y: 13, label: 'Infantry · ID?', side: 'unknown', uncertain: true, dy: 22 },
    { x: 26, y: 73, label: 'Purple transport', side: 'ec', vehicle: true, dx: -12, dy: -17 },
    { x: 88, y: 65, label: 'Units obscured', side: 'unknown', uncertain: true, dx: -105, dy: -18 },
    { x: 30, y: 93, label: 'Large model · ID?', side: 'unknown', uncertain: true, dx: 13, dy: 0 },
  ],
  4500: [
    { x: 82, y: 29, label: 'Magnus', side: 'ts', key: 'magnus', dy: -18 },
    { x: 58, y: 4, label: 'White transport', side: 'ts', key: 'white', vehicle: true, dx: -119, dy: 17 },
    { x: 88, y: 4, label: 'Infantry · ID?', side: 'unknown', uncertain: true, dx: -90, dy: 24 },
    { x: 17, y: 43, label: 'Purple transport', side: 'ec', vehicle: true, dy: -19 },
    { x: 86, y: 51, label: 'Purple transport', side: 'ec', vehicle: true, dx: -103, dy: -16 },
    { x: 45, y: 62, label: 'Infantry · ID?', side: 'unknown', uncertain: true, dx: 15 },
    { x: 71, y: 68, label: 'Infantry · ID?', side: 'unknown', uncertain: true, dx: 15 },
  ],
  7500: [
    { x: 83, y: 29, label: 'Magnus', side: 'ts', key: 'magnus', dy: -18 },
    { x: 67, y: 2, label: 'White transport', side: 'ts', key: 'white', vehicle: true, dx: -122, dy: 18 },
    { x: 8, y: 29, label: 'Purple transport', side: 'ec', vehicle: true, dx: 16 },
    { x: 91, y: 33, label: 'Purple transport', side: 'ec', vehicle: true, dx: -104, dy: 28 },
    { x: 79, y: 34, label: 'Infantry · ID?', side: 'unknown', uncertain: true, dx: -98, dy: 14 },
    { x: 52, y: 57, label: 'Infantry · ID?', side: 'unknown', uncertain: true, dx: 15 },
    { x: 19, y: 75, label: 'Infantry · ID?', side: 'unknown', uncertain: true, dx: 15 },
  ],
  8700: [
    { x: 88, y: 29, label: 'Magnus', side: 'ts', key: 'magnus', dy: -18 },
    { x: 69, y: 28, label: 'White transport', side: 'ts', key: 'white', vehicle: true, dx: -120, dy: -18 },
    { x: 60, y: 34, label: 'Infantry · ID?', side: 'unknown', uncertain: true, dx: -103, dy: 16 },
    { x: 21, y: 28, label: 'Purple transport', side: 'ec', vehicle: true, dx: -50, dy: -22 },
    { x: 27, y: 30, label: 'Infantry · ID?', side: 'unknown', uncertain: true, dx: 15 },
    { x: 92, y: 34, label: 'Purple transport', side: 'ec', vehicle: true, dx: -103, dy: 25 },
    { x: 79, y: 59, label: 'Infantry · ID?', side: 'unknown', uncertain: true, dx: -95, dy: 21 },
  ],
  10920: [
    { x: 65, y: 47, label: 'White transport', side: 'ts', key: 'white', vehicle: true, dx: 16 },
    { x: 10, y: 8, label: 'Purple transport', side: 'ec', vehicle: true, dx: 16 },
    { x: 52, y: 51, label: 'Red model · ID?', side: 'unknown', uncertain: true, dx: -116, dy: -17 },
    { x: 53, y: 58, label: 'Winged model · ID?', side: 'unknown', uncertain: true, dx: 15, dy: 8 },
    { x: 75, y: 40, label: 'Small group · ID?', side: 'unknown', uncertain: true, dx: -110, dy: -17 },
  ],
};

const ruins = [
  {x:14,y:10,w:19,h:7,r:0}, {x:11,y:21,w:19,h:16,r:0},
  {x:51,y:9,w:23,h:14,r:35}, {x:76,y:11,w:19,h:13,r:0},
  {x:72,y:34,w:23,h:15,r:-35}, {x:44,y:42,w:12,h:14,r:0},
  {x:18,y:53,w:21,h:13,r:35}, {x:5,y:75,w:24,h:17,r:0},
  {x:32,y:77,w:24,h:14,r:35}, {x:75,y:62,w:21,h:17,r:0},
  {x:52,y:67,w:9,h:4,r:0}, {x:70,y:85,w:18,h:5,r:0},
];

export default function BoardDiagram({ second, board, previousBoard, gameId = 'fowler-parry' }: {second: number; board?: BoardState; previousBoard?: {second:number; board:BoardState}; gameId?:string}) {
  const times = Object.keys(positions).map(Number).sort((a,b) => a-b);
  const source = board ? second : times.filter(time => time <= second).at(-1)!;
  const previous = board ? previousBoard?.second : times[times.indexOf(source)-1];
  const previousGroups = board ? previousBoard?.board.groups : positions[previous!];
  const id = `board-${gameId}-${second}`;
  const groups = board?.groups ?? positions[source];
  const terrain = board?.terrain ?? ruins;
  const colors = { ts: '#78e3d0', ec: '#f8a5c5', unknown: '#d3c9aa' };
  const stamp = (s: number) => [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(n=>String(n).padStart(2,'0')).join(':');
  return <section className="vod-board" aria-label="Simplified board-state diagram">
    <div className="vod-board-heading">{previous ? `${stamp(previous)} → ${stamp(source)}` : `First sampled positions · ${stamp(source)}`}</div>
    <svg viewBox="0 0 640 480" role="img" aria-labelledby={`${id}-title ${id}-description`}>
      <title id={`${id}-title`}>{`Approximate unit-group positions at ${stamp(source)}`}</title>
      <desc id={`${id}-description`}>{`Same orientation as the broadcast. Teal is Thousand Sons; pink is the opponent; beige dashed markers have unresolved identity. Terrain is approximate. ${groups.map(g=>g.label).join(', ')}. Dashed arrows connect sampled positions, not proven movement paths.`}</desc>
      <defs><pattern id={`${id}-grid`} width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#263c40" strokeWidth=".5" /></pattern>{Object.entries(colors).map(([side,color])=><marker key={side} id={`${id}-arrow-${side}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill={color} /></marker>)}</defs>
      <rect x="12" y="12" width="616" height="456" rx="5" fill="#111e24" stroke="#547078" />
      <rect x="20" y="20" width="600" height="440" fill={`url(#${id}-grid)`} />
      <g transform="translate(20 20)">
        {terrain.map((ruin,i)=><g key={i} transform={`translate(${ruin.x*6} ${ruin.y*4.4}) rotate(${ruin.r} ${ruin.w*3} ${ruin.h*2.2})`}><rect width={ruin.w*6} height={ruin.h*4.4} fill="#26363d" stroke="#4a5b60" strokeWidth="1" /><path d={`M4 ${ruin.h*4.4-4} V4 H${ruin.w*6-4}`} stroke="#718084" strokeWidth="4" fill="none" /></g>)}
        {previousGroups && groups.filter(g=>g.key).map(g=>{const old=previousGroups.find(p=>p.key===g.key);return old && Math.hypot(old.x-g.x,old.y-g.y)>4 ? <g key={`arrow-${g.key}`} className="vod-movement"><circle cx={old.x*6} cy={old.y*4.4} r="10" fill="#111e24" stroke={colors[g.side]} strokeDasharray="3 3" opacity=".7"/><path d={`M${old.x*6},${old.y*4.4} L${g.x*6},${g.y*4.4}`} stroke={colors[g.side]} strokeWidth="2.5" strokeDasharray="6 4" markerEnd={`url(#${id}-arrow-${g.side})`}/></g>:null;})}
        {groups.map((g,i)=><g key={`${g.label}-${i}`} transform={`translate(${g.x*6} ${g.y*4.4})`}><circle r="10" fill="#15242b" stroke={colors[g.side]} strokeWidth="2.5" strokeDasharray={g.uncertain?'3 2':undefined}/>{g.vehicle ? <rect x="-5" y="-7" width="10" height="14" rx="2" fill={colors[g.side]} opacity=".8"/> : <circle r="4" fill={colors[g.side]}/>}<text x={g.dx??(g.x>78?-14:14)} y={g.dy??4} textAnchor={g.dx===undefined&&g.x>78?'end':undefined} fill={colors[g.side]} fontSize="11" fontFamily="Arial, sans-serif" fontWeight="600" paintOrder="stroke" stroke="#111e24" strokeWidth="4" strokeLinejoin="round">{g.label}</text></g>)}
      </g>
    </svg>
  </section>;
}
