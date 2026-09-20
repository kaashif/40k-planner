import test from 'node:test';
import assert from 'node:assert/strict';
import {readNamedPlans,validatePlan,type PlanFile} from './plan-files.ts';
const plan:PlanFile={schemaVersion:1,rosterRevision:2,armyId:'thousand-sons',name:'Both armies',layoutId:'purge-the-foe-vs-priority-assets-a',markers:[{id:1,x:10,y:40,widthMm:100,heightMm:100,label:'Magnus',side:'blue'},{id:2,x:10,y:8,widthMm:100,heightMm:100,label:'Angron',side:'red'}],deepStrikeMarkers:[{id:3,x:25,y:40,widthMm:60,heightMm:60,label:'Prince',side:'blue'}]};
test('Named saves round-trip both sides and reserves without discarding marker data',()=>{const stored={...plan,planId:'test',savedAt:'2026-09-20'};assert.deepEqual(readNamedPlans(JSON.stringify([stored])),[stored]);});
test('Reject invalid coordinates, sides, sizes and duplicate reserve IDs',()=>{
 for(const patch of [{x:100},{y:NaN},{side:'green'},{widthMm:0}])assert.throws(()=>validatePlan({...plan,markers:[{...plan.markers[0],...patch}]}));
 assert.throws(()=>validatePlan({...plan,deepStrikeMarkers:[plan.markers[0]]}));
 assert.throws(()=>readNamedPlans('{broken'));
});

test('legacy TS roster migration removes duplicate bows and detaches Disc without moving other models',async()=>{
 const {correctThousandSonsRoster}=await import('./plan-files.ts');
 const base={id:1,x:10,y:12,widthMm:40,heightMm:40,label:'Bow 1',side:'blue' as const,rosterUnitId:'ts-bows-1',unitId:'ts-bows-1'};
 const disc={...base,id:2,rosterUnitId:'ts-disc',label:'Disc'};
 const bow={...base,id:3,rosterUnitId:'ts-bows-2',unitId:'ts-bows-2'};
 const enemy={...base,id:4,rosterUnitId:'joe:angron',unitId:'joe:angron',side:'red' as const};
 const old={markers:[base,disc,enemy],deepStrikeMarkers:[bow],name:'Keep my positions'};
 const p=correctThousandSonsRoster(old);assert.equal(p.markers.length,2);assert.equal(p.markers[0].unitId,'ts-disc');assert.equal(p.deepStrikeMarkers[0].label,'Bow Enlightened');assert.deepEqual(p.markers[1],enemy);assert.equal(p.markers[0].x,10);assert.equal(p.name,old.name);assert.equal(old.markers.length,3);
 assert.deepEqual(correctThousandSonsRoster(p),p);
 const fallback=correctThousandSonsRoster({markers:[base,disc]});assert.equal(fallback.markers.length,2);assert.equal(fallback.markers[0].rosterUnitId,'ts-bows-2');
});
