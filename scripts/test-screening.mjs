import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const lessons=JSON.parse(readFileSync(new URL('../public/tactics/screening.json',import.meta.url)));
const gap=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)-a.r-b.r;
const coherent=ms=>ms.every((a,i)=>ms.some((b,j)=>i!==j&&gap(a,b)<=2)&&ms.every((b,j)=>i===j||gap(a,b)<=9));
test('two-rank Tzaangor screen is coherent, long-chain counterexample is not',()=>{
 const [good,bad]=lessons[0].figures;
 const screen=good.models.filter(m=>m.side==='screen');
 assert.equal(screen.length,10);assert(coherent(screen));assert(!coherent(bad.models));
 assert(gap(screen[0],screen[1])<40/25.4);
 assert(Math.abs(gap(bad.models[0],bad.models.at(-1))-16.74)<.01);
});
test('Angron flight endpoint succeeds in the wide pocket and fails in the tight pocket',()=>{
 const [good,bad]=lessons[1].figures;
 for(const f of [good,bad]){
  const start=f.models.find(m=>m.side==='enemy'),end=f.models.find(m=>m.side==='candidate');
  assert(Math.hypot(start.x-end.x,start.y-end.y)<=14-2);
  assert(f.models.filter(m=>['screen','protected'].includes(m.side)).every(m=>gap(start,m)>2));
 }
 const canLand=f=>f.models.filter(m=>['screen','protected'].includes(m.side)).every(m=>gap(f.models.find(m=>m.side==='candidate'),m)>2);
 assert(canLand(good));assert(!canLand(bad));
});
test('post-fight snapshots are on opposite sides of the 3-inch consolidation selection limit',()=>{
 const distances=lessons[2].figures.map(f=>Math.min(...f.models.filter(m=>m.side==='enemy').flatMap(a=>f.models.filter(m=>m.side==='protected').map(b=>gap(a,b)))));
 assert(distances[0]>2&&distances[0]<3);assert(distances[1]>3);
 assert(Math.abs(distances[0]-2.43)<.01);assert(Math.abs(distances[1]-4.43)<.01);
});
