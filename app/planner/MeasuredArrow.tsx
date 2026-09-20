type Point = {x:number;y:number};

/** Board coordinates are inches, independent of the displayed map size. */
export default function MeasuredArrow({points,color}:{points:Point[];color:string}) {
  const start=points[0],end=points.at(-1);
  if(!start||!end)return null;
  const dx=end.x-start.x,dy=end.y-start.y;
  const length=Math.hypot(dx,dy),angle=Math.atan2(dy,dx)*180/Math.PI;
  const head=Math.min(1.3,length*.4);
  return <g className="measured-arrow" data-length={length.toFixed(1)} aria-label={`Arrow ${length.toFixed(1)} inches`}>
    <g transform={`translate(${start.x} ${start.y}) rotate(${angle})`}>
      <line x1="0" y1="0" x2={Math.max(0,length-head*.75)} y2="0" stroke="#101018" strokeWidth=".65"/>
      <line x1="0" y1="0" x2={Math.max(0,length-head*.75)} y2="0" stroke={color} strokeWidth=".38"/>
      <polygon points={`${length},0 ${length-head},${head*.48} ${length-head},${-head*.48}`} fill={color} stroke="#101018" strokeWidth=".1"/>
    </g>
    <text x={(start.x+end.x)/2} y={(start.y+end.y)/2-.65} fill={color}>{length.toFixed(1)}″</text>
  </g>;
}
