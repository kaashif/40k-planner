export type PivotLine={id:number;x:number;y:number;angle:number;color:string};
/** Clip an infinite line to the 44 × 60 inch table. */
export function pivotEndpoints(p:PivotLine){
 const dx=Math.cos(p.angle),dy=Math.sin(p.angle),ts:number[]=[];
 if(Math.abs(dx)>1e-9)ts.push((0-p.x)/dx,(44-p.x)/dx);
 if(Math.abs(dy)>1e-9)ts.push((0-p.y)/dy,(60-p.y)/dy);
 const inside=ts.map(t=>({t,x:p.x+t*dx,y:p.y+t*dy})).filter(q=>q.x>=-1e-7&&q.x<=44+1e-7&&q.y>=-1e-7&&q.y<=60+1e-7).sort((a,b)=>a.t-b.t);
 return [inside[0]??p,inside.at(-1)??p];
}
