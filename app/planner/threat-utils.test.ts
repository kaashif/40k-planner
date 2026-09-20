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
