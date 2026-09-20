import test from 'node:test';
import assert from 'node:assert/strict';
import {pivotEndpoints} from './pivot-utils.ts';
test('Pivot line extends to both table edges at horizontal, vertical and diagonal angles',()=>{
 const p={id:1,x:22,y:30,angle:0,color:'#fff'};
 const [a,b]=pivotEndpoints(p);assert.equal(a.x,0);assert.equal(b.x,44);assert.equal(a.y,30);
 const [c,d]=pivotEndpoints({...p,angle:Math.PI/2});assert.equal(c.y,0);assert.equal(d.y,60);
 const [e,f]=pivotEndpoints({...p,angle:Math.PI/4});assert.equal(e.x,0);assert.equal(f.x,44);assert(Math.abs(e.y-8)<1e-8);assert(Math.abs(f.y-52)<1e-8);
});
