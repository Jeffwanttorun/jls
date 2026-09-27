import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';

type Point=[number,number];
const controls=[
  {label:'南源岭',index:0},
  {label:'星村',index:92},
  {label:'黄村',index:132},
  {label:'月亮湾',index:207},
  {label:'桃源峪方向',index:536},
  {label:'大峡谷展示馆附近',index:768},
  {label:'坳头村 / 坳头观景台',index:951}
];

function decode(value:string):Point[]{
  const values=value.split(',').map(Number);
  let longitude=values[0],latitude=values[1];
  const points:Point[]=[[latitude,longitude]];
  for(let index=2;index<values.length;index+=2){
    longitude+=values[index]/1e6;
    latitude+=values[index+1]/1e6;
    points.push([latitude,longitude]);
  }
  return points;
}

function meters(a:Point,b:Point){
   const radius=6371000;
  const x=(b[1]-a[1])*Math.PI/180*Math.cos((a[0]+b[0])*Math.PI/360);
  const y=(b[0]-a[0])*Math.PI/180;
  return radius*Math.hypot(x,y);
}

const raw=JSON.parse(await readFile('reports/route-theme-v0.2/tencent-route-raw.json','utf8'));
const route=raw.detail?.mt?.[0];
assert.equal(raw.info?.error,0);
assert(route?.coors);
assert(route.key_roads?.includes('武夷山国家公园1号风景道'));
const points=decode(route.coors);
assert.equal(points.length,952);

const segments=controls.slice(0,-1).map((control,index)=>{
  const next=controls[index+1];
  const path=points.slice(control.index,next.index+1).map(([latitude,longitude])=>({latitude:Number(latitude.toFixed(7)),longitude:Number(longitude.toFixed(7))}));
  const geometryDistanceMeters=Math.round(path.slice(1).reduce((sum,point,pathIndex)=>sum+meters([path[pathIndex].latitude,path[pathIndex].longitude],[point.latitude,point.longitude]),0));
  return {id:'segment-'+(index+1),label:control.label+' → '+next.label,from:control.label,to:next.label,path,geometryDistanceMeters};
});

for(let index=1;index<segments.length;index++){
  const previous=segments[index-1].path.at(-1)!;
  const current=segments[index].path[0];
  assert.deepEqual(previous,current);
}

const source={
  sourceType:'tencent_driving_route_geometry',
  sourceReference:'腾讯地图官方驾车路线规划结果（一次获取后固化，只读）',
  capturedAt:'2026-09-10',
  coordinateSystem:'GCJ-02',
  totalDistanceMeters:route.distance,
  durationMinutes:route.time,
  geometryPointCount:points.length,
  keyRoads:route.key_roads,
  controls:controls.map(control=>({label:control.label,geometryIndex:control.index,latitude:points[control.index][0],longitude:points[control.index][1]})),
  segmentation:'六段连续几何；相邻段共用同一连接点',
  runtimeRequests:false
};

await mkdir('reports/route-geometry-v0.2',{recursive:true});
await writeFile('reports/route-geometry-v0.2/source-summary.json',JSON.stringify({source,segments:segments.map(segment=>({id:segment.id,label:segment.label,points:segment.path.length,distanceMeters:segment.geometryDistanceMeters}))},null,2));
const generated='// Generated from a verified Tencent driving route response. Do not derive this geometry from place coordinates or corridor_order.\nexport const corridorRouteSource='+JSON.stringify(source,null,2)+' as const;\n\nexport const corridorRouteSegments='+JSON.stringify(segments,null,2)+' as const;\n';
await writeFile('prototype/src/routeGeometryData.ts',generated);
console.log(JSON.stringify({source,segments:segments.map(segment=>({label:segment.label,points:segment.path.length,distanceMeters:segment.geometryDistanceMeters}))},null,2));
