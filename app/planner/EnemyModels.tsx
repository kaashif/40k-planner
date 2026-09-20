'use client';
import {useState} from 'react';
import {opponentLists,type OpponentUnit} from './opponent-utils';
import type {PlannerMarker} from './planner-utils';
export default function EnemyModels({onAdd,onReserve,markers,reserves}:{reserves:PlannerMarker[];onReserve:(list:string,unit:OpponentUnit,enabled:boolean)=>void;onAdd:(list:string,units:OpponentUnit[])=>void;markers:PlannerMarker[]}){
 const [listId,setListId]=useState('joe'),[arquebus,setArquebus]=useState(false);
 const [rhino,setRhino]=useState({width:80,height:120}),[skorpius,setSkorpius]=useState({width:90,height:155});
 const list=opponentLists.find(l=>l.id===listId)!;
 const units=list.units.map(u=>({...u,models:u.models.flatMap(m=>m.shape==='hull'?[{...m,widthMm:(listId==='joe'?rhino:skorpius).width,heightMm:(listId==='joe'?rhino:skorpius).height}]:u.id==='rangers'&&arquebus?[{...m,count:9},{...m,name:'Ranger with arquebus',count:1,widthMm:60,heightMm:35.5}]:[m])}));
 const dimensions=listId==='joe'?rhino:skorpius,setDimensions=listId==='joe'?setRhino:setSkorpius;
 return <section className="enemy-models">
 <div className="opponent-settings"><label>Opponent<select aria-label="Opponent list" value={listId} title={`${list.detachments} · ${list.note}`} onChange={e=>setListId(e.target.value)}>{opponentLists.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
 <div className="hull-inputs"><label>Hull width mm (est.)<input type="number" min="30" max="300" value={dimensions.width} onChange={e=>setDimensions({...dimensions,width:Math.min(300,Math.max(30,Number(e.target.value)))})}/></label><label>Length mm (est.)<input type="number" min="30" max="300" value={dimensions.height} onChange={e=>setDimensions({...dimensions,height:Math.min(300,Math.max(30,Number(e.target.value)))})}/></label></div>
 {listId==='zak'&&<label className="compact-check"><input type="checkbox" checked={arquebus} onChange={e=>setArquebus(e.target.checked)}/> Rangers include one arquebus</label>}
 <div className="opponent-actions"><button onClick={()=>onAdd(listId,units)}>Add whole opponent list</button><a href="https://github.com/kaashif/40k-planner/blob/main/docs/opponent-list-rules.md" target="_blank" rel="noreferrer" title="Rules, hull estimates and roster notes">Rules ↗</a></div></div>
 <div className="opponent-roster" style={{gridTemplateRows:`repeat(${units.length}, minmax(0, 1fr))`}}>{units.map(u=>{const total=u.models.reduce((n,m)=>n+m.count,0),present=markers.filter(m=>m.rosterUnitId===`${listId}:${u.id}`).length;return <article className="opponent-unit" key={u.id}>
 <div><strong title={`${u.name}${u.note?` — ${u.note}`:''}`}>{u.name}</strong><span title={u.models.map(m=>`${m.count} × ${m.widthMm} × ${m.heightMm} mm${m.shape==='hull'?' estimated hull':''} · M${m.move}″`).join('; ')}>{present}/{total} · {u.points} pts · M{u.models[0].move}″ <a href={u.source} target="_blank" rel="noreferrer" title="Datasheet">↗</a>{u.hullSource&&<> · <a href={u.hullSource} target="_blank" rel="noreferrer" title="Hull measurement source">Hull ↗</a></>}</span></div>
 <label className="roster-reserve" title="Deep strike"><input type="checkbox" aria-label={`Deep strike ${u.name}`} checked={reserves.filter(m=>m.rosterUnitId===`${listId}:${u.id}`).length>=total} onChange={e=>onReserve(listId,u,e.target.checked)}/> DS</label><button aria-label={`Add ${u.name}`} disabled={present>=total} onClick={()=>onAdd(listId,[u])}>Add</button></article>})}</div></section>
}
