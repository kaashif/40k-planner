import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {stageArmy,rosterUnitId,type Army} from './army-utils.ts';
import {coherencyIssues,moveSelectedUnitsToDeepStrike,type PlannerMarker} from './planner-utils.ts';
const army:Army=JSON.parse(readFileSync(new URL('../../armies/thousand-sons-2000.json',import.meta.url),'utf8'));
test('full supplied roster has correctly sized bases, unique IDs and the requested reserves',()=>{
 const staged=stageArmy(army);const all=[...staged.markers,...staged.deepStrikeMarkers];
 assert.equal(all.length,46);assert.equal(staged.markers.length,34);assert.equal(staged.deepStrikeMarkers.length,12);assert.equal(new Set(all.map(m=>m.id)).size,46);
 for(const unit of army.units){const models=all.filter(m=>rosterUnitId(m,army)===unit.id);assert.equal(models.length,unit.models);for(const m of models){assert.equal(m.widthMm,unit.baseMm);assert.equal(m.heightMm,unit.baseMm);assert.equal(m.moveInches,unit.movementInches);assert(m.x*44-m.widthMm/25.4/2>=0&&m.x*44+m.widthMm/25.4/2<=44);assert(m.y*60-m.heightMm/25.4/2>=0&&m.y*60+m.heightMm/25.4/2<=60);}}
 assert.equal(staged.deepStrikeMarkers.filter(m=>m.unitId==='ts-scarabs').length,11);
 assert.equal(coherencyIssues(staged.markers).size,0);assert.equal(coherencyIssues(staged.deepStrikeMarkers).size,0);
 for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){const a=all[i],b=all[j];assert(Math.hypot((a.x-b.x)*44,(a.y-b.y)*60)>=(a.widthMm+b.widthMm)/25.4/2,'staging bases overlap');}
});
test('selecting a Rubric for reserve includes its Sorcerer without losing roster accounting',()=>{
 const staged=stageArmy(army);const rubric=staged.markers.find(m=>m.rosterUnitId==='ts-rubrics-1')!;
 const next=moveSelectedUnitsToDeepStrike(staged.markers,staged.deepStrikeMarkers,[rubric.id]);
 assert.equal(next.deepStrikeMarkers.filter(m=>m.unitId==='ts-rubrics-1').length,6);
 assert.equal(next.deepStrikeMarkers.filter(m=>rosterUnitId(m,army)==='ts-sorcerer-1').length,1);
});
test('legacy Necron IDs are resolved by the most specific roster unit',()=>{
 const old:Army=JSON.parse(readFileSync(new URL('../../armies/necrons-2000.json',import.meta.url),'utf8'));
 const marker={unitId:'manual-technomancer-veil-5'} as PlannerMarker;
 assert.equal(rosterUnitId(marker,old),'technomancer-veil');
});

test('corrected roster totals 2000 and the Disc is independent of the single bow unit',()=>{
 assert.equal(army.units.reduce((sum,u)=>sum+u.points,0),2000);
 assert.equal(army.units.filter(u=>u.name.includes('Bow Enlightened')).length,1);
 const staged=stageArmy(army),disc=staged.markers.find(m=>m.rosterUnitId==='ts-disc')!;
 const next=moveSelectedUnitsToDeepStrike(staged.markers,staged.deepStrikeMarkers,[disc.id]);
 assert.equal(next.markers.filter(m=>m.rosterUnitId==='ts-bows-2').length,3);
 assert.equal(next.deepStrikeMarkers.filter(m=>m.rosterUnitId==='ts-disc').length,1);
});
test('roster reserve checkbox accounts for the whole attached unit from an empty board',async()=>{
 const {setArmyReserve}=await import('./army-utils.ts');
 const next=setArmyReserve(army,'ts-scarabs',[],[],true,1,'blue');
 assert.equal(next.markers.length,0);assert.equal(next.deepStrikeMarkers.length,11);
 const twice=setArmyReserve(army,'ts-terminator-sorcerer',[],next.deepStrikeMarkers,true,next.nextId,'blue');
 assert.equal(twice.deepStrikeMarkers.length,11);assert.equal(new Set(twice.deepStrikeMarkers.map(m=>m.id)).size,11);
 const cleared=setArmyReserve(army,'ts-terminator-sorcerer',[],twice.deepStrikeMarkers,false,twice.nextId,'blue');assert.equal(cleared.markers.length,0);assert.equal(cleared.deepStrikeMarkers.length,0);
});
