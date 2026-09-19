import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const data=read('public/matchups/world-eaters-reserve-plan/plans.json');
const geometry=read('public/matchups/world-eaters-deployments.json');
function inside(x,y,points){let yes=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;}
test('reserve plan fits the user’s 2,000-point battle and covers all variants',()=>{
 assert.equal(data.reservePoints,385+130+205);assert.equal(data.reserveLimit,2000*.5);assert(data.reservePoints<=data.reserveLimit);assert.deepEqual(data.layouts.map(l=>l.variant),['A','B','C']);
});
for(const plan of data.layouts){
 test(`${plan.variant}: deployment anchors and whole Magnus base fit the assigned zone`,()=>{
  const zone=geometry.find(l=>l.variant===plan.variant).zones.find(z=>z.type==='player');
  assert.deepEqual(plan.units.map(u=>u.id).sort(),['M','R1','R2','T','D+B1','Rob','Sp','En','B2'].sort());
  for(const unit of plan.units){assert(inside(unit.x,unit.y,zone.points),`${unit.id} outside zone`);if(unit.id==='M')for(let degree=0;degree<360;degree++){const rad=degree*Math.PI/180;assert(inside(unit.x+Math.cos(rad)*100/25.4/2,unit.y+Math.sin(rad)*100/25.4/2,zone.points),'Magnus base crosses zone');}}
 });
 test(`${plan.variant}: terrain PNG and source match the reviewed revision`,()=>{
  for(const [path,hash]of [[plan.image,plan.sha256],[plan.sourceImage,plan.sourceSha256]]){const bytes=readFileSync(new URL('../public'+path,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);}
 });
}
