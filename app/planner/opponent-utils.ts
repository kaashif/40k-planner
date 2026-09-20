import joe from '../../armies/joe-opponents.json' with {type:'json'};
import zak from '../../armies/zak-opponents.json' with {type:'json'};
import type {PlannerMarker} from './planner-utils';
export type OpponentModel={name:string;count:number;widthMm:number;heightMm:number;move:number;scout:number;shape?:string};
export type OpponentUnit={id:string;name:string;points:number;models:OpponentModel[];source:string;rules:string[];note?:string;hullSource?:string};
export type OpponentList={id:string;name:string;detachments:string;note:string;units:OpponentUnit[]};
export const opponentLists:OpponentList[]=[joe,zak];
/** Pack complete coherent groups into free space. Staging ignores terrain/deployment zones. */
export function spawnOpponents(listId:string,units:OpponentUnit[],existing:PlannerMarker[],reserved:PlannerMarker[],nextId:number,side:'blue'|'red'){
 const added:PlannerMarker[]=[];
 for(const unit of units){
  const rosterUnitId=`${listId}:${unit.id}`;
  const specs=unit.models.flatMap(spec=>Array.from({length:spec.count},()=>spec));
  const present=[...existing,...reserved].filter(m=>m.rosterUnitId===rosterUnitId);
  const remaining=specs.filter((spec,index)=>specs.slice(0,index+1).filter(s=>s.name===spec.name).length>present.filter(m=>m.label===spec.name).length);
  if(!remaining.length)continue;
  const sx=Math.max(...specs.map(m=>m.widthMm))/25.4+.4,sy=Math.max(...specs.map(m=>m.heightMm))/25.4+.4,cols=Math.min(3,remaining.length);
  let placed:PlannerMarker[]|undefined;
  for(let y=59;y>0&&!placed;y-=.5)for(let x=1;x<44&&!placed;x+=.5){
   const candidate=remaining.map((m,i):PlannerMarker=>({id:nextId+i,x:(x+(i%cols)*sx)/44,y:(y-Math.floor(i/cols)*sy)/60,widthMm:m.widthMm,heightMm:m.heightMm,label:m.name,side,unitId:present[0]?.unitId??rosterUnitId,rosterUnitId,moveInches:m.move,scoutInches:m.scout,shape:m.shape==='hull'?'hull':undefined,ruleTags:unit.rules}));
   if(candidate.every(m=>{const x=m.x*44,y=m.y*60,w=m.widthMm/50.8,h=m.heightMm/50.8;return x>=w&&x+w<=44&&y>=h&&y+h<=60&&[...existing,...added].every(o=>Math.abs(x-o.x*44)>w+o.widthMm/50.8+.1||Math.abs(y-o.y*60)>h+o.heightMm/50.8+.1)}))placed=candidate;
  }
  if(!placed)throw new Error(`No free staging space for ${unit.name}. Move or remove models first.`);
  added.push(...placed);nextId+=placed.length;
 }
 return {added,nextId};
}
