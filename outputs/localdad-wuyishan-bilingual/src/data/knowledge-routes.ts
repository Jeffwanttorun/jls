import type { KnowledgeRoute, KnowledgeRoutePlaceRole } from "../types/knowledge-map";

const scenicRoadStages = [
  { id:"nanyuanling", titleZh:"南源岭", titleEn:"Nanyuanling", placeIds:["WY-0001","WY-0002","WY-0003","WY-0004","WY-0005","WY-0047"] },
  { id:"xingcun", titleZh:"星村", titleEn:"Xingcun", placeIds:["WY-0048","WY-0049","WY-0050"] },
  { id:"manshui-bridge", titleZh:"漫水桥", titleEn:"Manshui Bridge", placeIds:["WY-0051","WY-0052","WY-0053","WY-0009"] },
  { id:"huangcun-hongxing", titleZh:"黄村与红星", titleEn:"Huangcun and Hongxing", placeIds:["WY-0055","WY-0056","WY-0057","WY-0040","WY-0058","WY-0059","WY-0041","WY-0044","WY-0043"] },
  { id:"moon-bay-taoyuanyu", titleZh:"月亮湾与桃源峪", titleEn:"Yueliangwan and Taoyuanyu", placeIds:["WY-0012","WY-0013","WY-0015","WY-0017","WY-0018","WY-0060","WY-0021","WY-0022","WY-0024","WY-0025","WY-0026","WY-0028"] },
  { id:"tongmu-dazhulan", titleZh:"桐木与大竹岚", titleEn:"Tongmu and Dazhulan", placeIds:["WY-0030","WY-0031","WY-0032","WY-0033","WY-0035","WY-0061"] },
  { id:"aotou", titleZh:"坳头", titleEn:"Aotou", placeIds:["WY-0036"] },
] as const;

// Route roles describe how a place is used by a visitor on this route. They are
// deliberately explicit: adding a new marker must not silently promote it into
// the main previous/next journey.
export const scenicRoadPlaceRoles:Record<string,KnowledgeRoutePlaceRole> = {
  "WY-0001":"core-stop", "WY-0002":"service", "WY-0003":"service", "WY-0004":"observation", "WY-0005":"observation", "WY-0047":"service",
  "WY-0048":"food", "WY-0049":"food", "WY-0050":"secondary-stop",
  "WY-0051":"service", "WY-0052":"service", "WY-0053":"service", "WY-0009":"core-stop",
  "WY-0055":"secondary-stop", "WY-0056":"secondary-stop", "WY-0057":"service", "WY-0040":"secondary-stop", "WY-0058":"junction", "WY-0059":"junction", "WY-0041":"secondary-stop", "WY-0044":"secondary-stop", "WY-0043":"secondary-stop",
  "WY-0012":"core-stop", "WY-0013":"service", "WY-0015":"junction", "WY-0017":"observation", "WY-0018":"observation", "WY-0060":"observation", "WY-0021":"observation", "WY-0022":"observation", "WY-0024":"core-stop", "WY-0025":"service", "WY-0026":"service", "WY-0028":"secondary-stop",
  "WY-0030":"core-stop", "WY-0031":"observation", "WY-0032":"core-stop", "WY-0033":"core-stop", "WY-0035":"core-stop", "WY-0061":"secondary-stop",
  "WY-0036":"core-stop",
};

const scenicRoadPlaceIds=scenicRoadStages.flatMap((stage)=>[...stage.placeIds]);

export const knowledgeRoutes: readonly KnowledgeRoute[] = [{
  id:"no-1-scenic-road",
  slug:"no-1-scenic-road",
  published:true,
  featured:true,
  order:10,
  nameZh:"一号风景道",
  nameEn:"No. 1 Scenic Road",
  summaryZh:"从南源岭一路到坳头，沿途经过村庄、河谷、茶园、展馆和山林观察点。",
  summaryEn:"Travel from Nanyuanling to Aotou through villages, river valleys, tea fields, exhibition halls, and forest observation stops.",
  mapTitleZh:"从南源岭到坳头",
  mapTitleEn:"From Nanyuanling to Aotou",
  placeIds:scenicRoadPlaceIds,
  geometryRouteIds:["corridor-01","corridor-02","corridor-03","corridor-04","corridor-05","corridor-06"],
  places:scenicRoadPlaceIds.map((placeId)=>({placeId,role:scenicRoadPlaceRoles[placeId]})),
  stages:scenicRoadStages.map((stage)=>({...stage,placeIds:[...stage.placeIds]})),
}];

for(const route of knowledgeRoutes){
  if(!Number.isFinite(route.order))throw new Error(`Route order is invalid for ${route.id}`);
  if(route.featured&&!route.published)throw new Error(`Featured route must be published: ${route.id}`);
  const uniquePlaceIds=new Set(route.placeIds);
  if(uniquePlaceIds.size!==route.placeIds.length)throw new Error(`Duplicate place relationship in route ${route.id}`);
  const stagePlaceIds=route.stages.flatMap((stage)=>stage.placeIds);
  if(stagePlaceIds.length!==route.placeIds.length||stagePlaceIds.some((placeId,index)=>placeId!==route.placeIds[index])){
    throw new Error(`Route stage order does not match route place order for ${route.id}`);
  }
  if(route.places.length!==route.placeIds.length||route.places.some((item,index)=>item.placeId!==route.placeIds[index]||!item.role)){
    throw new Error(`Route place roles are incomplete for ${route.id}`);
  }
}

export const knowledgeRouteById = new Map(knowledgeRoutes.map((route)=>[route.id,route]));

export function routeRoleForPlace(route:KnowledgeRoute,placeId:string){
  return route.places.find((item)=>item.placeId===placeId)?.role;
}
