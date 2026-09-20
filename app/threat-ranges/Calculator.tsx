'use client';
import {useState} from 'react';
import ThreatCalculator from '../planner/ThreatCalculator';
import ThreatOverlay from '../planner/ThreatOverlay';
import {defaultThreat} from '../planner/threat-utils';
import {opponentLists} from '../planner/opponent-utils';
import {applyThreatRules} from '../planner/threat-rules';
export default function Calculator(){
 const [value,setValue]=useState(defaultThreat),[preset,setPreset]=useState('custom'),[width,setWidth]=useState(100),[height,setHeight]=useState(100);
 const choices=opponentLists.flatMap(l=>l.units.map(u=>({id:`${l.id}:${u.id}`,list:l.name,unit:u})));
 const selected=choices.find(c=>c.id===preset),tags=selected?.unit.rules??[];
 const shape:'hull'|undefined=selected?.unit.models[0].shape==='hull'?'hull':undefined;
 const marker={id:1,x:.5,y:.5,widthMm:width,heightMm:height,label:selected?.unit.name??'Example attacker',side:'red' as const,shape};
 return <><label>Unit <select aria-label="Threat unit" value={preset} onChange={e=>{setPreset(e.target.value);const u=choices.find(c=>c.id===e.target.value)?.unit;if(u){const m=u.models[0];setValue({...defaultThreat,move:Math.min(...u.models.map(m=>m.move)),scout:Math.min(...u.models.map(m=>m.scout)),useScout:u.models.every(m=>m.scout>0),useAdvance:u.rules.includes('advance-charge')});setWidth(m.widthMm);setHeight(m.heightMm);}else setValue(defaultThreat);}}><option value="custom">Custom attacker</option>{choices.map(c=><option value={c.id} key={c.id}>{c.list} · {c.unit.name}</option>)}</select></label><p>Example footprint uses the first model in the selected unit; map rings use whichever individual model you select.</p><label>Footprint width mm <input type="number" min="10" max="300" value={width} onChange={e=>setWidth(Math.max(10,Math.min(300,Number(e.target.value))))}/></label> <label>Footprint height mm <input type="number" min="10" max="300" value={height} onChange={e=>setHeight(Math.max(10,Math.min(300,Number(e.target.value))))}/></label><ThreatCalculator value={value} onChange={setValue} label={marker.label} ruleTags={tags}/><div className="standalone-threat-board"><svg viewBox="0 0 44 60" aria-label="44 by 60 inch example board"><defs><pattern id="threat-grid" width="2" height="2" patternUnits="userSpaceOnUse"><path d="M2 0H0V2" stroke="#41515b" strokeWidth=".05" fill="none"/></pattern></defs><rect width="44" height="60" fill="url(#threat-grid)"/>{shape==='hull'?<rect x={22-width/50.8} y={30-height/50.8} width={width/25.4} height={height/25.4} fill="#ee718f"/>:<ellipse cx="22" cy="30" rx={width/50.8} ry={height/50.8} fill="#ee718f"/>}</svg><ThreatOverlay marker={marker} settings={applyThreatRules(value,tags)} onAngleChange={directionAngle=>setValue(s=>({...s,directionAngle}))}/></div></>;
}
