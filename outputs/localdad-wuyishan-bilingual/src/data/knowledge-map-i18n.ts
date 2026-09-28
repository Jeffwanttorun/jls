import type { Locale } from "../i18n/config";
import type { PlaceTrustStatus } from "../types/knowledge-map";

const categoryNames:Record<string,string>={
  "路线核心节点":"Route landmark",
  "停车":"Parking",
  "公共服务":"Public facility",
  "观景点":"Viewpoint",
  "餐饮补给":"Food and supplies",
  "沿线停留点":"Roadside stop",
  "营地":"Camping",
  "茶园与风景":"Tea landscape",
  "茶文化展馆":"Tea exhibition",
  "支线路口":"Side-road junction",
  "自然科普展馆":"Nature exhibition",
  "人文展馆":"Local culture exhibition",
  "沿线风景":"Roadside scenery",
  "玩水地点":"Waterside stop",
  "瀑布":"Waterfall",
  "自然观察点":"Nature observation area",
  "沿线地点":"Place along the route",
};

export function localizedCategory(category:string,locale:Locale){
  return locale==="zh"?category:categoryNames[category]??category;
}

const trustLabels={
  firsthand:{zh:"Jeff 的实地记录",en:"Visited in person"},
  checkedInPerson:{zh:"Jeff 已实地核验",en:"Checked in person by Jeff"},
  officialSource:{zh:"基于官方信息",en:"Based on official information"},
  recheckBeforeGoing:{zh:"出发前请重新确认",en:"Recheck before you go"},
} as const;

export function localizedTrustLabels(status:PlaceTrustStatus|undefined,locale:Locale){
  if(!status)return [];
  const keys=(Object.keys(trustLabels) as Array<keyof typeof trustLabels>)
    .filter((key)=>status[key]===true)
    .filter((key)=>key!=="firsthand"||status.checkedInPerson!==true);
  return keys.map((key)=>trustLabels[key][locale]);
}

export function localizedLastChecked(date:string,locale:Locale){
  const value=new Date(`${date}T00:00:00Z`);
  if(Number.isNaN(value.getTime()))return date;
  return new Intl.DateTimeFormat(locale==="zh"?"zh-CN":"en-US",{year:"numeric",month:locale==="zh"?"numeric":"short"}).format(value);
}
