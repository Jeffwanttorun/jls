import type { KnowledgeRoute } from "../types/knowledge-map";

const scenicRoadStages = [
  { id:"nanyuanling", titleZh:"南源岭", titleEn:"Nanyuanling", placeIds:["WY-0001","WY-0002","WY-0003","WY-0004","WY-0005","WY-0047"] },
  { id:"xingcun", titleZh:"星村", titleEn:"Xingcun", placeIds:["WY-0048","WY-0049","WY-0050"] },
  { id:"manshui-bridge", titleZh:"漫水桥", titleEn:"Manshui Bridge", placeIds:["WY-0051","WY-0052","WY-0053","WY-0009"] },
  { id:"huangcun-hongxing", titleZh:"黄村与红星", titleEn:"Huangcun and Hongxing", placeIds:["WY-0055","WY-0056","WY-0057","WY-0040","WY-0058","WY-0059","WY-0041","WY-0044","WY-0043"] },
  { id:"moon-bay-taoyuanyu", titleZh:"月亮湾与桃源峪", titleEn:"Yueliangwan and Taoyuanyu", placeIds:["WY-0012","WY-0013","WY-0015","WY-0017","WY-0018","WY-0060","WY-0021","WY-0022","WY-0024","WY-0025","WY-0026","WY-0028"] },
  { id:"tongmu-dazhulan", titleZh:"桐木与大竹岚", titleEn:"Tongmu and Dazhulan", placeIds:["WY-0030","WY-0031","WY-0032","WY-0033","WY-0035","WY-0061"] },
  { id:"aotou", titleZh:"坳头", titleEn:"Aotou", placeIds:["WY-0036"] },
] as const;

export const knowledgeRoutes: readonly KnowledgeRoute[] = [{
  id:"no-1-scenic-road",
  slug:"no-1-scenic-road",
  nameZh:"一号风景道",
  nameEn:"No. 1 Scenic Road",
  summaryZh:"从南源岭出发，沿现有公开路线依次理解村庄、河谷、茶、展馆与山林地点。",
  summaryEn:"Follow the published route from Nanyuanling through villages, river valleys, tea areas, exhibition halls, and forest stops.",
  placeIds:scenicRoadStages.flatMap((stage)=>[...stage.placeIds]),
  stages:scenicRoadStages.map((stage)=>({...stage,placeIds:[...stage.placeIds]})),
}];

for(const route of knowledgeRoutes){
  const uniquePlaceIds=new Set(route.placeIds);
  if(uniquePlaceIds.size!==route.placeIds.length)throw new Error(`Duplicate place relationship in route ${route.id}`);
  const stagePlaceIds=route.stages.flatMap((stage)=>stage.placeIds);
  if(stagePlaceIds.length!==route.placeIds.length||stagePlaceIds.some((placeId,index)=>placeId!==route.placeIds[index])){
    throw new Error(`Route stage order does not match route place order for ${route.id}`);
  }
}

export const knowledgeRouteById = new Map(knowledgeRoutes.map((route)=>[route.id,route]));
