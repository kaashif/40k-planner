'use client';
import {useRef,type PointerEvent} from 'react';
import {threatOutline,threatBands,threatSegments,threatRayEndpoint,type ThreatSettings} from './threat-utils';
import {TABLE_WIDTH,TABLE_HEIGHT,type PlannerMarker} from './planner-utils';
export default function ThreatOverlay({marker,settings,onAngleChange}:{marker:PlannerMarker;settings:ThreatSettings;onAngleChange:(angle:number)=>void}){
 const dragging=useRef(false),svg=useRef<SVGSVGElement>(null);
 const angle=settings.directionAngle??Math.atan2((.5-marker.y)*TABLE_HEIGHT,(.5-marker.x)*TABLE_WIDTH);
 const bands=threatBands(settings).sort((a,b)=>b.range-a.range);
 const rotate=(event:PointerEvent<SVGCircleElement>)=>{
  const matrix=svg.current?.getScreenCTM();if(!matrix)return;
  const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
  onAngleChange(Math.atan2(point.y-marker.y*TABLE_HEIGHT,point.x-marker.x*TABLE_WIDTH));
 };
 const cx=marker.x*TABLE_WIDTH,cy=marker.y*TABLE_HEIGHT,c=Math.cos(angle),s=Math.sin(angle);
 const edgeX=Math.abs(c)<1e-9?Infinity:(c>0?TABLE_WIDTH-1-cx:cx-1)/Math.abs(c);
 const edgeY=Math.abs(s)<1e-9?Infinity:(s>0?TABLE_HEIGHT-1-cy:cy-1)/Math.abs(s);
 const handleRadius=Math.max(0,Math.min(Math.max(marker.widthMm,marker.heightMm)/50.8+3,edgeX,edgeY));
 return <svg ref={svg} className="threat-overlay" viewBox={`0 0 ${TABLE_WIDTH} ${TABLE_HEIGHT}`} aria-label={`${marker.label} threat ranges`}>
  <g transform={`translate(${marker.x*TABLE_WIDTH} ${marker.y*TABLE_HEIGHT})`}>
   {bands.map(({name,range,color})=><path key={name} data-band={name} d={threatOutline(marker.widthMm,marker.heightMm,range,marker.shape)} fill={color} fillOpacity=".025" stroke={color} strokeWidth=".38" strokeDasharray={name.includes('advance')?'.8 .4':undefined}><title>{`${name}: ${range} inches from base edge`}</title></path>)}
   {threatSegments(settings).map(({range,bands:labels},i,segments)=>{
    const end=threatRayEndpoint(marker.widthMm,marker.heightMm,range,angle,marker.shape);
    const previous=i?threatRayEndpoint(marker.widthMm,marker.heightMm,segments[i-1].range,angle,marker.shape):{x:0,y:0};
    const length=Math.hypot(end.x,end.y),start=Math.hypot(previous.x,previous.y);
    const head=Math.min(1,length-start),color=labels[0].color;
    const degrees=angle*180/Math.PI,flip=Math.cos(angle)<0;
    const labelSide=((TABLE_WIDTH/2-cx)*-s+(TABLE_HEIGHT/2-cy)*c)>=0?1:-1;
    const labelLane=segments.slice(0,i).reduce((n,segment)=>n+segment.bands.length,0);
    const labelY=labelSide*(1.4+labelLane*1.5);
    return <g key={range} className="threat-ray" data-band={labels.map(b=>b.name).join(' / ')} data-start={start} data-end={length} data-end-x={end.x} data-end-y={end.y}>
     <title>{labels.map(b=>`${b.name}: ${range}″ from base edge`).join('; ')}</title>
     <g transform={`rotate(${degrees})`}>
      <line x1={start} y1="0" x2={length-head*.7} y2="0" stroke="#0a1018" strokeWidth=".65"/>
      <line x1={start} y1="0" x2={length-head*.7} y2="0" stroke={color} strokeWidth=".4"/>
      <polygon points={`${length},0 ${length-head},.45 ${length-head},-.45`} fill={color} stroke="#0a1018" strokeWidth=".12"/>
      <line className="threat-label-leader" x1={length} y1="0" x2={length} y2={labelY} stroke={color} strokeWidth=".1"/>
      <text x={length} y={labelY} transform={flip?`rotate(180 ${length} ${labelY})`:undefined}>
       {labels.map((b,j)=><tspan key={b.name} x={length} dy={j?1.25:0} fill={b.color}>{b.name} {range}″</tspan>)}
      </text>
     </g>
    </g>;
   })}
   <circle className="threat-rotate-handle" role="slider" tabIndex={0} aria-label="Rotate threat arrows" aria-valuemin={0} aria-valuemax={360} aria-valuenow={Math.round(((angle*180/Math.PI)%360+360)%360)} aria-valuetext="Drag around the model, or use arrow keys to rotate" cx={Math.cos(angle)*handleRadius} cy={Math.sin(angle)*handleRadius} r=".8"
    onPointerDown={e=>{e.stopPropagation();e.preventDefault();dragging.current=true;e.currentTarget.setPointerCapture(e.pointerId);rotate(e);}}
    onPointerMove={e=>{if(dragging.current){e.stopPropagation();rotate(e);}}}
    onPointerUp={e=>{e.stopPropagation();dragging.current=false;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
    onPointerCancel={()=>{dragging.current=false;}} onLostPointerCapture={()=>{dragging.current=false;}}
    onKeyDown={e=>{if(['ArrowLeft','ArrowDown','ArrowRight','ArrowUp'].includes(e.key)){e.preventDefault();e.stopPropagation();onAngleChange(angle+(['ArrowLeft','ArrowDown'].includes(e.key)?-1:1)*Math.PI/36);}}}>
    <title>Drag to rotate all threat arrows around this model</title>
   </circle>
  </g>
 </svg>;
}
