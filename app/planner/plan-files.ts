import type {PlannerMarker} from './planner-utils';
import type {PivotLine} from './pivot-utils';
import type {ThreatSettings} from './threat-utils';
export const NAMED_PLANS_KEY='deployment-planner:named:v1';
export type PlanFile={schemaVersion:1;name:string;layoutId:string;armyId?:string;rosterRevision?:number;intent?:string;markers:PlannerMarker[];deepStrikeMarkers?:PlannerMarker[];sightLines?:{label:string;from:[number,number];to:[number,number];clear:boolean;blockedAt:[number,number]|null}[];markupPaths?:{kind?:'arrow';id:number;color:string;points:{x:number;y:number}[]}[];side?:'red'|'blue';threatSettings?:ThreatSettings;pivotLines?:PivotLine[];threatEnabled?:boolean;threatModelId?:number};
export type NamedPlan=PlanFile&{planId:string;savedAt:string};
export function validatePlan(value:unknown):PlanFile{
 if(!value||typeof value!=='object')throw new Error('Expected a deployment plan object.');
 const p=value as PlanFile;
 if(p.schemaVersion!==1||typeof p.name!=='string'||typeof p.layoutId!=='string'||!Array.isArray(p.markers))throw new Error('Unsupported deployment plan.');
 if(p.armyId&&!['necrons','thousand-sons'].includes(p.armyId))throw new Error('Unknown army in deployment plan.');
 if(p.deepStrikeMarkers!==undefined&&!Array.isArray(p.deepStrikeMarkers))throw new Error('Invalid reserve list.');
 const ids=new Set<number>();
 for(const m of [...p.markers,...(p.deepStrikeMarkers??[])]){
  if(!m||!Number.isInteger(m.id)||ids.has(m.id)||typeof m.label!=='string'||!['blue','red'].includes(m.side)||!Number.isFinite(m.x)||!Number.isFinite(m.y)||m.x<0||m.x>44||m.y<0||m.y>60||!Number.isFinite(m.widthMm)||!Number.isFinite(m.heightMm)||m.widthMm<=0||m.heightMm<=0||m.widthMm>500||m.heightMm>500)throw new Error('Invalid model coordinates, base size, side or duplicate model ID.');
  if(m.moveInches!==undefined&&(!Number.isFinite(m.moveInches)||m.moveInches<0||m.moveInches>100))throw new Error('Invalid movement value.');
  if(m.scoutInches!==undefined&&(!Number.isFinite(m.scoutInches)||m.scoutInches<0||m.scoutInches>100))throw new Error('Invalid Scout value.');
  if(m.shape!==undefined&&m.shape!=='hull')throw new Error('Invalid model shape.');
  if(m.ruleTags!==undefined&&(!Array.isArray(m.ruleTags)||m.ruleTags.some(t=>typeof t!=='string')))throw new Error('Invalid rule tags.');
  ids.add(m.id);
 }
 if(p.markupPaths!==undefined){if(!Array.isArray(p.markupPaths))throw new Error('Invalid markup.');for(const path of p.markupPaths){if(!path||!Number.isInteger(path.id)||typeof path.color!=='string'||path.kind!==undefined&&path.kind!=='arrow'||!Array.isArray(path.points)||path.kind==='arrow'&&(path.points.length<1||path.points.length>2)||path.points.some(point=>!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)))throw new Error('Invalid markup path.');}}
 if(p.sightLines!==undefined){if(!Array.isArray(p.sightLines))throw new Error('Invalid sight lines.');for(const line of p.sightLines){if(!line||typeof line.label!=='string'||typeof line.clear!=='boolean'||![line.from,line.to].every(point=>Array.isArray(point)&&point.length===2&&point.every(Number.isFinite))||line.blockedAt!==null&&(!Array.isArray(line.blockedAt)||line.blockedAt.length!==2||!line.blockedAt.every(Number.isFinite)))throw new Error('Invalid sight line.');}}
 if(p.side!==undefined&&!['blue','red'].includes(p.side))throw new Error('Invalid player side.');
 if(p.threatSettings!==undefined){const settings=p.threatSettings;if(!settings||!['move','scout','advance','charge','chargeBonus'].every(key=>Number.isFinite(settings[key as keyof ThreatSettings]))||!['useScout','useAdvance','advanceCharge'].every(key=>typeof settings[key as keyof ThreatSettings]==='boolean'))throw new Error('Invalid threat settings.');}
 if(p.pivotLines!==undefined&&(!Array.isArray(p.pivotLines)||p.pivotLines.some(l=>!l||!Number.isInteger(l.id)||![l.x,l.y,l.angle].every(Number.isFinite)||l.x<0||l.x>44||l.y<0||l.y>60||typeof l.color!=='string')))throw new Error('Invalid pivot sight lines.');
 if(p.threatSettings?.percentile!==undefined&&(!Number.isInteger(p.threatSettings.percentile)||p.threatSettings.percentile<1||p.threatSettings.percentile>100))throw new Error('Invalid threat percentile.');
 if(p.threatSettings?.directionAngle!==undefined&&!Number.isFinite(p.threatSettings.directionAngle))throw new Error('Invalid threat direction.');
 if(p.threatSettings){const s=p.threatSettings;if(s.advanceBonus!==undefined&&!Number.isFinite(s.advanceBonus)||s.rerollCharge!==undefined&&typeof s.rerollCharge!=='boolean'||s.rerollAdvance!==undefined&&typeof s.rerollAdvance!=='boolean'||s.activeRules!==undefined&&(!Array.isArray(s.activeRules)||s.activeRules.some(r=>typeof r!=='string')))throw new Error('Invalid threat modifiers.');}
 if(p.threatEnabled!==undefined&&typeof p.threatEnabled!=='boolean'||p.threatModelId!==undefined&&!Number.isInteger(p.threatModelId))throw new Error('Invalid threat selection.');
 return p.armyId==='thousand-sons'?correctThousandSonsRoster(p):p;
}
export function readNamedPlans(raw:string|null):NamedPlan[]{
 if(!raw)return [];
 const items:unknown=JSON.parse(raw);if(!Array.isArray(items))throw new Error('Saved plans could not be read.');
 return items.map(item=>{const p=validatePlan(item) as NamedPlan;if(typeof p.planId!=='string'||typeof p.savedAt!=='string')throw new Error('Saved plan metadata could not be read.');return p;});
}

/** Correct only pre-revision-2 Thousand Sons saves; preserve positions and unrelated data. */
export function correctThousandSonsRoster<T extends {markers:PlannerMarker[];deepStrikeMarkers?:PlannerMarker[];rosterRevision?:number}>(plan:T):T{
 if((plan.rosterRevision??1)>=2)return plan;
 const all=[...plan.markers,...(plan.deepStrikeMarkers??[])];
 const hasBow2=all.some(m=>m.rosterUnitId==='ts-bows-2');
 const fix=(models:PlannerMarker[])=>models.filter(m=>!hasBow2||m.rosterUnitId!=='ts-bows-1').map(m=>{
  if(m.rosterUnitId==='ts-disc')return {...m,unitId:'ts-disc'};
  if(m.rosterUnitId==='ts-bows-1'||m.rosterUnitId==='ts-bows-2')return {...m,rosterUnitId:'ts-bows-2',unitId:m.unitId==='ts-bows-1'?'ts-bows-2':m.unitId,label:'Bow Enlightened'};
  return m;
 });
 return {...plan,markers:fix(plan.markers),deepStrikeMarkers:fix(plan.deepStrikeMarkers??[]),rosterRevision:2};
}
