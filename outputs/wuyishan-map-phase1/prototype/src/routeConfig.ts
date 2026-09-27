import {corridorRouteSegments,corridorRouteSource} from './routeGeometryData.js';
export interface RoutePoint { latitude:number; longitude:number }

// These codes control marker visibility only. They never generate or reshape
// the route. Road geometry is the separately cached Tencent driving result in
// routeGeometryData.ts; service and branch POIs are deliberately excluded.
export const corridorCoreCodes=[
  'WY-0001','WY-0004','WY-0005','WY-0050','WY-0009','WY-0055','WY-0056','WY-0040',
  'WY-0041','WY-0044','WY-0043','WY-0012','WY-0017','WY-0018','WY-0060','WY-0021',
  'WY-0022','WY-0024','WY-0028','WY-0030','WY-0032','WY-0033','WY-0035','WY-0036'
];

export const corridorServiceCodes=[
  'WY-0002','WY-0003','WY-0047','WY-0051','WY-0052','WY-0053','WY-0057','WY-0013',
  'WY-0023','WY-0025','WY-0026','WY-0029'
];

export const corridorBranchCodes=['WY-0038','WY-0058','WY-0059','WY-0062'];

export {corridorRouteSegments,corridorRouteSource};
export const corridorGeometry:RoutePoint[]=corridorRouteSegments.flatMap((segment:{readonly path:readonly RoutePoint[]},index:number)=>index===0?[...segment.path]:segment.path.slice(1));

export const corridorStart={code:'WY-0001',label:'南源岭'};
export const corridorEnd={code:'WY-0036',label:'坳头村 / 坳头观景台'};
