import type { PlannerMarker } from './planner-utils';
export type ArmyUnit={id:string;label:string;name:string;points:number;models:number;baseMm:number;movementInches:number;attachedTo?:string;source?:string;defaultDeepStrike?:boolean};
export type Army={name:string;faction:string;pointsLimit:number;units:ArmyUnit[]};
export function rosterUnitId(marker:PlannerMarker,army:Army){
 if(marker.rosterUnitId)return army.units.find(u=>u.id===marker.rosterUnitId)?.id;
 return [...army.units].sort((a,b)=>b.id.length-a.id.length).find(u=>marker.unitId===u.id||marker.unitId?.startsWith(`manual-${u.id}-`))?.id;
}
/** A spaced roster tray, not a legal deployment. Attached units share a selection/coherency group. */
export function stageArmy(army:Army,side:'blue'|'red'='blue'){
 let id=1;
 const markers:PlannerMarker[]=[],deepStrikeMarkers:PlannerMarker[]=[];
 const groups=[...new Set(army.units.map(u=>u.attachedTo??u.id))];
 groups.forEach((group,index)=>{
  const units=army.units.filter(u=>(u.attachedTo??u.id)===group);
  const spacing=Math.max(2.2,...units.map(u=>u.baseMm/25.4+.65));
  let model=0;
  for(const unit of units)for(let i=0;i<unit.models;i++){
   const marker:PlannerMarker={id:id++,x:(6+(index%3)*13+(model%3)*spacing)/44,y:(7+Math.floor(index/3)*13+Math.floor(model/3)*spacing)/60,widthMm:unit.baseMm,heightMm:unit.baseMm,label:unit.name,unitId:group,rosterUnitId:unit.id,side,moveInches:unit.movementInches};
   (units.some(u=>u.defaultDeepStrike)?deepStrikeMarkers:markers).push(marker);model++;
  }
 });
 return {markers,deepStrikeMarkers};
}
