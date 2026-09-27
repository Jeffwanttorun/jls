import snapshot from "./wuyishan-public-map.json";
import type { Locale } from "../i18n/config";
import type { MapDataset, MapPlace, MapRouteGeometry } from "../types/map";

type SnapshotPoint = { latitude:number; longitude:number; system:"WGS84" };

export const publicMapProvenance = {
  generatedFrom:snapshot.generatedFrom,
  generatedAt:snapshot.generatedAt,
  sourceGeometrySha256:snapshot.sourceGeometrySha256,
  sourcePointCount:snapshot.routeSource.geometryPointCount,
  segmentCount:snapshot.routes.length,
  publicPlaceCount:snapshot.publicPlaceCount,
} as const;

export const publicMapPlaceCodes = new Set(snapshot.places.map((place)=>place.code));

export function wuyishanPublicMap(locale:Locale):MapDataset {
  const places:MapPlace[]=snapshot.places.map((place)=>({
    id:place.code,
    href:locale==="zh"?`/zh/place/${place.code}`:"/map",
    name:place.name,
    alternateName:place.code,
    summary:locale==="zh"?`${place.region} · 当前状态：${place.status}`:`${place.region} · Status: open and approved for public map display`,
    locale,
    translationStatus:locale==="zh"?"complete":"partial",
    coordinates:place.coordinates as SnapshotPoint,
    categories:[],topics:[],filterIds:[],practicalInformation:[],relatedRoutes:[],relatedStories:[],relatedVideos:[],
  }));
  const routes:MapRouteGeometry[]=snapshot.routes.map((route)=>({
    id:route.id,
    names:{en:"Wuyishan No. 1 Scenic Road",zh:"武夷山国家公园一号风景道"},
    path:route.path as SnapshotPoint[],
    relatedPlaceIds:[],topics:[],
  }));
  return {locale,routingMode:"current",places,routes};
}
