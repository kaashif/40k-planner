export type ThreatSettings={directionAngle?:number;move:number;scout:number;useScout:boolean;advance:number;useAdvance:boolean;advanceCharge:boolean;charge:number;chargeBonus:number;advanceBonus?:number;rerollCharge?:boolean;rerollAdvance?:boolean;activeRules?:string[]};
export const defaultThreat:ThreatSettings={move:14,scout:0,useScout:false,advance:6,useAdvance:false,advanceCharge:false,charge:12,chargeBonus:0};
export function threatRanges(s:ThreatSettings){
 const scout=s.useScout?s.scout:0;
 const move=scout+s.move;
 const advance=s.useAdvance?move+s.advance+(s.advanceBonus??0):null;
 const chargeDistance=Math.min(12,Math.max(0,s.charge+s.chargeBonus));
 const chargingMove=s.useAdvance&&s.advanceCharge?move+s.advance+(s.advanceBonus??0):move;
 return {scout,move,advance,charge:chargeDistance>2?chargingMove+chargeDistance:null,chargingMove,chargeDistance};
}
export function chargeChance(gap:number,s:ThreatSettings,reroll=false){
 const {chargingMove}=threatRanges(s);const remaining=Math.max(2.000001,gap-chargingMove);
 if(remaining>12)return 0;
 let successes=0;for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)if(a+b+s.chargeBonus>=remaining)successes++;
 const chance=successes/36;return reroll?1-(1-chance)**2:chance;
}
/** Offset an ellipse by a fixed distance along its outward normal. */
export function threatOutline(widthMm:number,heightMm:number,range:number,shape?:string){
 if(shape==='hull'){const a=widthMm/50.8,b=heightMm/50.8;return `M${-a},${-b-range}H${a}A${range},${range} 0 0 1 ${a+range},${-b}V${b}A${range},${range} 0 0 1 ${a},${b+range}H${-a}A${range},${range} 0 0 1 ${-a-range},${b}V${-b}A${range},${range} 0 0 1 ${-a},${-b-range}Z`;}
 const a=widthMm/25.4/2,b=heightMm/25.4/2;
 return Array.from({length:181},(_,i)=>{const t=i/180*Math.PI*2,c=Math.cos(t),s=Math.sin(t),n=Math.hypot(c/a,s/b);return `${i?'L':'M'}${(a*c+range*c/a/n).toFixed(4)},${(b*s+range*s/b/n).toFixed(4)}`;}).join(' ')+'Z';
}

/** Pre-movement probability: integrates D6 Advance and 2D6 charge, including full-roll rerolls. */
export function reachChance(gap:number,s:ThreatSettings,kind:'advance'|'charge'){
 const base=s.move+(s.useScout?s.scout:0),bonus=s.advanceBonus??0;
 const advances=kind==='advance'||s.useAdvance&&s.advanceCharge;
 const chanceAt=(roll:number)=>{
  const movement=base+(advances?roll+bonus:0);
  if(kind==='advance')return movement>=gap?1:0;
  return chargeChance(gap,{...s,move:movement,scout:0,useScout:false,useAdvance:false},s.rerollCharge??false);
 };
 if(!advances)return chanceAt(0);
 const p=Array.from({length:6},(_,i)=>chanceAt(i+1));
 // Re-roll an Advance only when it improves the chance of reaching this specific target.
 const mean=p.reduce((a,b)=>a+b,0)/6;
 return p.reduce((a,v)=>a+(s.rerollAdvance?Math.max(v,mean):v),0)/6;
}
export function probabilityRange(s:ThreatSettings,kind:'advance'|'charge',threshold:number){
 const start=s.move+(s.useScout?s.scout:0)+(kind==='advance'||s.useAdvance&&s.advanceCharge?s.advanceBonus??0:0);
 let best=0;
 for(let n=0;n<=18;n++){const distance=start+n;if(reachChance(distance,s,kind)+1e-10>=Math.max(1e-8,threshold))best=distance;}
 return best;
}
export function threatBands(s:ThreatSettings){return [
 {name:'Max charge',range:probabilityRange(s,'charge',1e-10),color:'#ff7baa'},
 {name:'50% charge',range:probabilityRange(s,'charge',.5),color:'#bb8cff'},
 {name:'80% charge',range:probabilityRange(s,'charge',.8),color:'#4ce0eb'},
 {name:'Max advance',range:probabilityRange(s,'advance',1e-10),color:'#ffc65c'},
 {name:'50% advance',range:probabilityRange(s,'advance',.5),color:'#f3ef80'},
 {name:'80% advance',range:probabilityRange(s,'advance',.8),color:'#92e5a1'},
];}

/** Centre-to-ring ray intersection, including the base footprint and its offset. */
export function threatRayEndpoint(widthMm:number,heightMm:number,range:number,angle:number,shape?:string){
 const a=widthMm/50.8,b=heightMm/50.8,c=Math.cos(angle),s=Math.sin(angle);
 if(shape==='hull'){
  let low=0,high=Math.hypot(a,b)+range;
  for(let i=0;i<50;i++){const r=(low+high)/2;if(Math.hypot(Math.max(0,Math.abs(r*c)-a),Math.max(0,Math.abs(r*s)-b))>range)high=r;else low=r;}
  return {x:c*low,y:s*low};
 }
 const target=Math.atan2(Math.abs(s),Math.abs(c));
 let low=0,high=Math.PI/2;
 const point=(t:number)=>{const x=Math.cos(t),y=Math.sin(t),n=Math.hypot(x/a,y/b);return {x:a*x+range*x/a/n,y:b*y+range*y/b/n};};
 for(let i=0;i<50;i++){const t=(low+high)/2,p=point(t);if(Math.atan2(p.y,p.x)<target)low=t;else high=t;}
 const p=point((low+high)/2);return {x:Math.sign(c)*p.x,y:Math.sign(s)*p.y};
}
