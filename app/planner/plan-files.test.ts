import test from 'node:test';
import assert from 'node:assert/strict';
import {readNamedPlans,validatePlan,type PlanFile} from './plan-files.ts';
const plan:PlanFile={schemaVersion:1,armyId:'thousand-sons',name:'Both armies',layoutId:'purge-the-foe-vs-priority-assets-a',markers:[{id:1,x:10,y:40,widthMm:100,heightMm:100,label:'Magnus',side:'blue'},{id:2,x:10,y:8,widthMm:100,heightMm:100,label:'Angron',side:'red'}],deepStrikeMarkers:[{id:3,x:25,y:40,widthMm:60,heightMm:60,label:'Prince',side:'blue'}]};
test('Named saves round-trip both sides and reserves without discarding marker data',()=>{const stored={...plan,planId:'test',savedAt:'2026-09-20'};assert.deepEqual(readNamedPlans(JSON.stringify([stored])),[stored]);});
test('Reject invalid coordinates, sides, sizes and duplicate reserve IDs',()=>{
 for(const patch of [{x:100},{y:NaN},{side:'green'},{widthMm:0}])assert.throws(()=>validatePlan({...plan,markers:[{...plan.markers[0],...patch}]}));
 assert.throws(()=>validatePlan({...plan,deepStrikeMarkers:[plan.markers[0]]}));
 assert.throws(()=>readNamedPlans('{broken'));
});
