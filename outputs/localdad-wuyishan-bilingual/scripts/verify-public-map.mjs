import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const path=fileURLToPath(new URL("../src/data/wuyishan-public-map.json",import.meta.url));
const data=JSON.parse(readFileSync(path,"utf8"));
const errors=[];
if(data.routeSource?.geometryPointCount!==952)errors.push("route source must remain 952 points");
if(data.routes?.length!==6)errors.push("route must remain six segments");
if(!/^[A-F0-9]{64}$/.test(data.sourceGeometrySha256||""))errors.push("missing source geometry hash");
for(const place of data.places||[]){
  if(place.ownerApproved!==true)errors.push(`${place.code}: precise coordinate lacks explicit owner approval`);
  if(place.coordinateStatus!=="active")errors.push(`${place.code}: non-active coordinate is public`);
  if(place.humanConfirmed!==true)errors.push(`${place.code}: unconfirmed coordinate is public`);
  if(place.mapDisplayRole==="hidden")errors.push(`${place.code}: hidden place is public`);
  if(place.coordinates?.system!=="WGS84")errors.push(`${place.code}: public web coordinate is not WGS84`);
  if(place.navigationCoordinates?.system!=="GCJ-02"||!Number.isFinite(place.navigationCoordinates?.latitude)||!Number.isFinite(place.navigationCoordinates?.longitude))errors.push(`${place.code}: navigation coordinate is not valid GCJ-02`);
}
for(const route of data.routes||[])for(const point of route.path||[])if(point.system!=="WGS84")errors.push(`${route.id}: route point is not WGS84`);
if(data.places?.length!==41)errors.push(`expected 41 owner-approved current markers, found ${data.places?.length}`);
if(errors.length)throw new Error(`Public map safety check failed:\n${errors.map((error)=>`- ${error}`).join("\n")}`);
console.log(`Public map safety passed: ${data.places.length} owner-approved active markers, ${data.routes.length} segments, ${data.routeSource.geometryPointCount} source points.`);
