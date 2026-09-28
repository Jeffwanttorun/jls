import snapshot from "./wuyishan-public-map.json";
import type { Locale } from "../i18n/config";
import type { MapDataset, MapPlace, MapRouteGeometry } from "../types/map";
import { knowledgePlaces, localizedPlaceName } from "./knowledge-places";
import { knowledgeRouteById } from "./knowledge-routes";
import { localizedCategory } from "./knowledge-map-i18n";
import { publicMapFilterIds, type PublicMapFilterId } from "./map-filters";

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
  const places:MapPlace[]=knowledgePlaces.map((place)=>({
    id:place.id,
    href:locale==="zh"?`/zh/place/${place.id}`:`/place/${place.id}`,
    name:localizedPlaceName(place,locale),
    shortName:localizedPlaceName(place,locale,true),
    labelPriority:place.labelPriority,
    category:localizedCategory(place.category,locale),
    alternateName:locale==="en"&&place.nameEn?place.nameZh:undefined,
    summary:place.summary?.[locale],
    locale,
    translationStatus:locale==="zh"||place.englishNameStatus!=="pending"?"complete":"partial",
    coordinates:place.coordinates as SnapshotPoint,
    categories:[],topics:[],filterIds:(place.themeIds??[]).filter((id):id is PublicMapFilterId=>publicMapFilterIds.includes(id as PublicMapFilterId)),practicalInformation:[],
    relatedRoutes:(place.routeIds??[]).flatMap((routeId)=>{
      const route=knowledgeRouteById.get(routeId);
      return route?[{id:route.id,label:locale==="zh"?route.nameZh:route.nameEn,href:locale==="zh"?`/zh/route/${route.slug}`:`/route/${route.slug}`}]:[];
    }),
    relatedStories:(place.storyLinks??[]).map((link,index)=>({id:`story-${place.id}-${index}`,label:link.title,href:link.url})),
    relatedVideos:[],
  }));
  const routes:MapRouteGeometry[]=snapshot.routes.map((route)=>({
    id:route.id,
    names:{en:"Wuyishan No. 1 Scenic Road",zh:"武夷山国家公园一号风景道"},
    path:route.path as SnapshotPoint[],
    relatedPlaceIds:[],topics:[],
  }));
  return {locale,routingMode:"current",places,routes};
}
