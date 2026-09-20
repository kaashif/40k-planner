import test from 'node:test';
import assert from 'node:assert/strict';
import {opponentLists,spawnOpponents} from './opponent-utils.ts';
import {stageArmy} from './army-utils.ts';
import {coherencyIssues} from './planner-utils.ts';
import ts from '../../armies/thousand-sons-2000.json' with {type:'json'};
import {applyThreatRules} from './threat-rules.ts';
import {defaultThreat,probabilityRange} from './threat-utils.ts';
test('Both complete opponents fit with Thousand Sons, preserving counts, base footprints and groups',()=>{
 const staged=stageArmy(ts);let markers=staged.markers,id=50;
 for(const list of opponentLists){const r=spawnOpponents(list.id,list.units,markers,staged.deepStrikeMarkers,id,'red');assert.equal(r.added.length,list.id==='joe'?59:38);assert.equal(coherencyIssues(r.added).size,0);markers=[...markers,...r.added];id=r.nextId;assert.equal(spawnOpponents(list.id,list.units,markers,staged.deepStrikeMarkers,id,'red').added.length,0);}
 assert.equal(new Set(markers.map(m=>m.id)).size,markers.length);
 for(const m of markers){assert(m.x*44>=m.widthMm/50.8);assert(m.y*60>=m.heightMm/50.8);assert(m.x*44+m.widthMm/50.8<=44);assert(m.y*60+m.heightMm/50.8<=60);}
 for(const m of markers.filter(m=>m.side==='red'))for(const o of markers.filter(o=>o.id!==m.id))assert(Math.abs((m.x-o.x)*44)>(m.widthMm+o.widthMm)/50.8||Math.abs((m.y-o.y)*60)>(m.heightMm+o.heightMm)/50.8);
 assert.equal(markers.filter(m=>m.label==='Dishonoured'&&m.widthMm===40).length,2);
 assert.equal(markers.filter(m=>m.label==='Combat Servitor'&&m.widthMm===25).length,6);
 assert.equal(markers.filter(m=>m.shape==='hull').length,3);
});
test('Named rule effects are restricted to the selected unit and do not stack charge rerolls',()=>{
 const s={...defaultThreat,move:10,activeRules:['bloodlust','motive','devotion','frenzy']};
 const we=applyThreatRules(s,['we','battle-lust']);assert.equal(we.chargeBonus,2);assert.equal(we.rerollCharge,true);assert.equal(we.advanceCharge,false);assert.equal(we.move,10);
 const admech=applyThreatRules({...s,move:8},['vehicle']);assert.equal(admech.move,11);assert.equal(admech.advanceBonus,1);assert.equal(admech.chargeBonus,1);assert.equal(admech.advanceCharge,false);
 assert.equal(applyThreatRules(s,['thulia']).advanceCharge,true);
 const spawn=applyThreatRules({...defaultThreat,move:10,scout:8,useScout:true,useAdvance:true},['we','advance-charge']);assert.equal(probabilityRange(spawn,'charge',1e-10),36);
});
