import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultThreat,threatRanges,chargeChance,threatOutline} from './threat-utils.ts';
test('Angron and scouting Eightbound max threats use current 12-inch target cap',()=>{
 assert.equal(threatRanges(defaultThreat).charge,26);
 assert.equal(threatRanges({...defaultThreat,move:10,scout:6,useScout:true}).charge,28);
 assert.equal(threatRanges({...defaultThreat,chargeBonus:2}).charge,26);
});
test('Advance does not add to charge reach without explicit permission',()=>{
 const s={...defaultThreat,useAdvance:true};assert.equal(threatRanges(s).advance,20);assert.equal(threatRanges(s).charge,26);assert.equal(threatRanges({...s,advanceCharge:true}).charge,32);
});
test('Charge odds respect modified roll, target cap, and once-only reroll',()=>{
 const s={...defaultThreat,chargeBonus:1};assert(Math.abs(chargeChance(24,s)-10/36)<1e-10);assert(Math.abs(chargeChance(24,s,true)-(1-(26/36)**2))<1e-10);assert.equal(chargeChance(27,s),0);assert.equal(threatRanges({...defaultThreat,charge:2}).charge,null);assert.equal(threatRanges({...defaultThreat,charge:2,chargeBonus:1}).charge,17);
});
test('Oval threat is offset from the actual base edges in both axes',()=>{
 const path=threatOutline(120,92,10);assert(path.startsWith('M12.3622,0.0000'));assert(path.includes('L0.0000,11.8110'));
});

test('Probability bands use dice distributions, not percentages of max distance',async()=>{
 const {probabilityRange,reachChance}=await import('./threat-utils.ts');
 assert.equal(probabilityRange(defaultThreat,'charge',.5),21);
 assert.equal(probabilityRange(defaultThreat,'charge',.8),19);
 assert.equal(probabilityRange(defaultThreat,'advance',.5),18);
 assert.equal(probabilityRange(defaultThreat,'advance',.8),16);
 const s={...defaultThreat,move:10,chargeBonus:2,rerollCharge:true};
 assert.equal(probabilityRange(s,'charge',.5),20);
 assert.equal(probabilityRange(s,'charge',.8),19);
 assert.equal(probabilityRange(s,'charge',1e-10),22);
 assert.equal(reachChance(23,s,'charge'),0);
 const a={...defaultThreat,useAdvance:true,advanceCharge:true};
 assert.equal(probabilityRange(a,'charge',1e-10),32);
 assert(reachChance(25,{...a,rerollAdvance:true},'charge')>reachChance(25,a,'charge'));
});

test('Rotating arrows terminate on circular, oval and hull range boundaries',async()=>{
 const {threatRayEndpoint}=await import('./threat-utils.ts');
 for(const angle of [0,.7,Math.PI/2,Math.PI,4.2]){
  const p=threatRayEndpoint(50.8,50.8,12,angle);
  assert(Math.abs(Math.hypot(p.x,p.y)-13)<1e-8);
  assert(Math.abs(p.x*Math.sin(angle)-p.y*Math.cos(angle))<1e-8);
  const h=threatRayEndpoint(101.6,50.8,7,angle,'hull');
  assert(Math.abs(Math.hypot(Math.max(0,Math.abs(h.x)-2),Math.max(0,Math.abs(h.y)-1))-7)<1e-8);
 }
 const t=.7,a=120/50.8,b=92/50.8,r=10,n=Math.hypot(Math.cos(t)/a,Math.sin(t)/b);
 const expected={x:a*Math.cos(t)+r*Math.cos(t)/a/n,y:b*Math.sin(t)+r*Math.sin(t)/b/n};
 const p=threatRayEndpoint(120,92,r,Math.atan2(expected.y,expected.x));
 assert(Math.hypot(p.x-expected.x,p.y-expected.y)<1e-8);
});

test('Threat arrow segments follow distance order and merge coincident thresholds',async()=>{
 const {threatSegments}=await import('./threat-utils.ts');
 const segments=threatSegments(defaultThreat);
 assert.deepEqual(segments.map(s=>s.range),[16,17.5,19,20,21,26]);
 assert.deepEqual(segments.map(s=>s.bands[0].name),['80% advance','50% advance','80% charge','Max advance','50% charge','Max charge']);
 const ties=threatSegments({...defaultThreat,chargeBonus:1});
 assert.equal(ties.reduce((n,s)=>n+s.bands.length,0),6);
 assert(ties.some(s=>s.bands.length>1));
 assert(ties.every((s,i)=>!i||s.range>ties[i-1].range));
});

 test('Selected percentile separates fixed Scout and includes it once in both totals',async()=>{
 const {selectedProbabilityRange,threatBands}=await import('./threat-utils.ts');
 const s={...defaultThreat,move:8,scout:8,useScout:true};
 assert.equal(selectedProbabilityRange(s,'advance'),19.5);
 assert.equal(selectedProbabilityRange(s,'charge'),23);
 assert.equal(selectedProbabilityRange({...s,percentile:80},'advance'),18);
 assert.equal(selectedProbabilityRange({...s,percentile:80},'charge'),21);
 assert.equal(threatBands(s).find(b=>b.name==='Scout (fixed)')?.range,8);
 assert(!threatBands({...s,useScout:false}).some(b=>b.name==='Scout (fixed)'));
 assert.equal(selectedProbabilityRange({...s,useScout:false},'advance'),11.5);
 assert.equal(selectedProbabilityRange({...s,percentile:100},'charge'),0);
 const bands=threatBands({...s,percentile:80});assert.equal(new Set(bands.map(b=>b.name)).size,bands.length);
});

test('Optional full-roll rerolls improve means without keeping the discarded result',async()=>{
 const {meanRoll}=await import('./threat-utils.ts');
 assert.equal(meanRoll('advance'),3.5);assert.equal(meanRoll('charge'),7);
 assert.equal(meanRoll('advance',true),4.25);assert(Math.abs(meanRoll('charge',true)-287/36)<1e-10);
});

test('Overall slider selects the joint Advance + charge outcome and moves only the final segment',async()=>{
 const {overallThreatBands,selectedProbabilityRange,reachChance,threatSegments}=await import('./threat-utils.ts');
 const s={...defaultThreat,move:10,scout:8,useScout:true,useAdvance:true,advanceCharge:true,percentile:50};
 assert.equal(selectedProbabilityRange(s,'charge'),28.5);
 assert(Math.abs(reachChance(28.5,s,'charge')-.5)<1e-10);
 const safer={...s,percentile:80};assert.equal(selectedProbabilityRange(safer,'charge'),26);
 assert(reachChance(26,safer,'charge')>=.8);assert(reachChance(27,safer,'charge')<.8);
 assert.deepEqual(overallThreatBands(s).map(b=>b.range),[8,18,28.5]);
 assert.deepEqual(overallThreatBands(safer).map(b=>b.range),[8,18,26]);
 assert.equal(threatSegments(safer,true).at(-1)?.range,26);
 assert.equal(selectedProbabilityRange({...s,advanceCharge:false},'charge'),25);
});
