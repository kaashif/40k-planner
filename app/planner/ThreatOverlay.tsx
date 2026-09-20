import {threatOutline,threatBands,type ThreatSettings} from './threat-utils';
import {TABLE_WIDTH,TABLE_HEIGHT,type PlannerMarker} from './planner-utils';
export default function ThreatOverlay({marker,settings}:{marker:PlannerMarker;settings:ThreatSettings}){
 return <svg className="threat-overlay" viewBox={`0 0 ${TABLE_WIDTH} ${TABLE_HEIGHT}`} aria-label={`${marker.label} threat ranges`}><g transform={`translate(${marker.x*TABLE_WIDTH} ${marker.y*TABLE_HEIGHT})`}>{threatBands(settings).sort((a,b)=>b.range-a.range).map(({name,range,color})=><path key={name} data-band={name} d={threatOutline(marker.widthMm,marker.heightMm,range,marker.shape)} fill={color} fillOpacity=".025" stroke={color} strokeWidth=".16" strokeDasharray={name.includes('advance')?'.6 .3':undefined}><title>{`${name}: ${range} inches from base edge`}</title></path>)}</g></svg>;
}
