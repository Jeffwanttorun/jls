import snapshot from "./wuyishan-public-map.json";
import runtime from "./visitor-runtime.json";
import studioRuntime from "./content-studio-runtime.json";
import { publicMapLabelFor } from "./map-place-labels";
import { knowledgeRoutes, routeRoleForPlace } from "./knowledge-routes";
import type { KnowledgePlace } from "../types/knowledge-map";

type RuntimePlace = {
  code:string; name:string; region:string; summary:string; themes:string[];
  /** @deprecated Legacy import value. Convert once at this adapter boundary; public UI reads familySuitability. */
  familyFriendly:boolean; facilities?:{toilet?:boolean;shop?:boolean;restaurant?:boolean;lodging?:boolean};
  status:string; image:string|null;
};

type SnapshotPlace = (typeof snapshot.places)[number] & { ownerApproved?:boolean; humanConfirmed?:boolean };

const runtimeById = new Map((runtime.places as RuntimePlace[]).map((place)=>[place.code,place]));
const studioPlaces=studioRuntime.document.places;
const routeIdsByPlace = new Map<string,string[]>();
const publicKnowledgeRoutes=knowledgeRoutes.filter((route)=>route.published);
for(const route of publicKnowledgeRoutes) for(const placeId of route.placeIds){
  const routeIds=routeIdsByPlace.get(placeId)??[];
  routeIds.push(route.id);
  routeIdsByPlace.set(placeId,routeIds);
}

const reviewedEnglishNames:Record<string,{name:string;shortName?:string;status:KnowledgePlace["englishNameStatus"]}>={
  "WY-0001":{name:"Nanyuanling",status:"established"},
  "WY-0005":{name:"Sancai Peak Viewpoint",shortName:"Sancai Peak",status:"translated"},
  "WY-0004":{name:"Qiyun Peak",status:"pinyin"},
  "WY-0009":{name:"Manshui Bridge",status:"translated"},
  "WY-0012":{name:"Yueliangwan",status:"pinyin"},
  "WY-0024":{name:"Taoyuanyu",status:"pinyin"},
  "WY-0028":{name:"Longdu Butterfly Science Exhibition Hall",shortName:"Butterfly Hall",status:"translated"},
  "WY-0030":{name:"Wild Monkey Valley",status:"translated"},
  "WY-0032":{name:"Black Tea Origins Exhibition Hall",shortName:"Black Tea Hall",status:"translated"},
  "WY-0033":{name:"Grand Canyon Exhibition Hall",shortName:"Grand Canyon Hall",status:"translated"},
  "WY-0035":{name:"Dazhulan Nature Observation Area",shortName:"Dazhulan",status:"translated"},
  "WY-0036":{name:"Aotou Viewpoint",shortName:"Aotou",status:"translated"},
  "WY-0040":{name:"Huangcun Oolong Tea Exhibition Hall",shortName:"Oolong Tea Hall",status:"translated"},
  "WY-0041":{name:"Rare Plant Science Exhibition Hall",shortName:"Rare Plant Hall",status:"translated"},
  "WY-0002":{name:"Nanyuanling Parking",status:"translated"},
  "WY-0003":{name:"Nanyuanling Restroom",status:"translated"},
  "WY-0047":{name:"Sancai Peak Restroom",status:"translated"},
  "WY-0051":{name:"Manshui Bridge Parking 1",status:"translated"},
  "WY-0052":{name:"Manshui Bridge Parking 2",status:"translated"},
  "WY-0053":{name:"Manshui Bridge Restroom",status:"translated"},
  "WY-0057":{name:"Fengyin Tea Fields Parking",status:"translated"},
  "WY-0058":{name:"Wuyiyuan Junction 1",status:"translated"},
  "WY-0059":{name:"Wuyiyuan Junction 2",status:"translated"},
  "WY-0013":{name:"Yueliangwan Parking",status:"translated"},
  "WY-0015":{name:"Feicui Valley Junction",status:"translated"},
  "WY-0025":{name:"Taoyuanyu Parking",status:"translated"},
  "WY-0026":{name:"Taoyuanyu Restroom",status:"translated"},
};

const regionNames:Record<string,string>={
  "南源岭":"Nanyuanling", "星村":"Xingcun", "星村—黄村沿线":"Between Xingcun and Huangcun",
  "黄村":"Huangcun", "武夷源":"Wuyiyuan", "红星村":"Hongxing Village", "月亮湾":"Yueliangwan",
  "翡翠谷支线":"Feicui Valley side road", "黄村—红星沿线":"Between Huangcun and Hongxing",
  "皮坑":"Pikeng", "一号风景道沿线":"Along No. 1 Scenic Road", "桃源峪":"Taoyuanyu",
  "红星村附近":"Near Hongxing Village", "桐木区域":"Tongmu Area", "大竹岚":"Dazhulan", "坳头村":"Aotou Village",
};

const reviewedEnglishSummaries:Record<string,string>={
  "WY-0009":"A stop by the bridge and riverbank to check the water conditions that day.",
  "WY-0012":"A river bend and natural area for observation. Entering the water is prohibited.",
  "WY-0024":"A starting point for observing the stream edge and forest edge.",
  "WY-0028":"An exhibition about butterflies and their environment.",
  "WY-0030":"A stop for observing the forest environment on the way toward Tongmu.",
  "WY-0032":"An exhibition about the origins of black tea.",
  "WY-0033":"An exhibition about the Wuyishan Grand Canyon.",
  "WY-0035":"A nature observation area in Dazhulan.",
  "WY-0036":"A viewpoint over the Wuyishan Grand Canyon.",
  "WY-0040":"Exhibits on oolong tea craft and culture.",
  "WY-0041":"Science exhibits introducing rare plants of Wuyishan.",
};

const genericSummaries=new Set(["查看地点与导航信息。","查看地点与导航信息"]);
const media=(fileName:string)=>`/visitor-media/${fileName}`;

const basePlaces:KnowledgePlace[]=(snapshot.places as SnapshotPlace[]).map((point)=>{
  const managed=runtimeById.get(point.code);
  const studio=studioPlaces[point.code as keyof typeof studioPlaces];
  const labels=publicMapLabelFor(point.code,managed?.name??point.name);
  const english=reviewedEnglishNames[point.code];
  const summary=managed?.summary?.trim();
  const image=managed?.image?.trim();
  const routeRole=publicKnowledgeRoutes.map((route)=>routeRoleForPlace(route,point.code)).find(Boolean);
  const sourceThemeIds=studio?.themeIds??managed?.themes??[];
  const campingRole:KnowledgePlace["campingRole"]=sourceThemeIds.includes("camping")
    ? routeRole==="service"||routeRole==="junction"?"service-only":labels.category==="停车"?"parking":"overnight-stop"
    : undefined;
  const themeIds=sourceThemeIds.filter((themeId)=>themeId!=="camping"||campingRole==="overnight-stop");
  const familySuitability:KnowledgePlace["familySuitability"]=studio?.familySuitability??(managed?.familyFriendly===true
    ? themeIds.includes("water")?"conditional":"yes"
    : managed?.familyFriendly===false?"no":"unknown");
  return {
    id:point.code,
    nameZh:studio?.name.zh.trim()||managed?.name?.trim()||point.name,
    nameEn:studio?.name.en.trim()||english?.name,
    shortNameZh:studio?.shortName.zh.trim()||labels.shortName,
    shortNameEn:(studio?.shortName.en.trim()||english?.shortName)??english?.name,
    englishNameStatus:studio?.englishNameStatus??english?.status??"pending",
    labelPriority:studio?.labelPriority??labels.labelPriority,
    category:studio?.category??labels.category,
    coordinates:point.coordinates,
    region:(studio?.region.zh.trim()||managed?.region?.trim()||point.region)?{zh:(studio?.region.zh.trim()||managed?.region?.trim()||point.region)!,en:studio?.region.en.trim()||regionNames[(managed?.region?.trim()||point.region)!]}:undefined,
    summary:studio&&(studio.summary.zh.trim()||studio.summary.en.trim())?{zh:studio.summary.zh||undefined,en:studio.summary.en||undefined}:summary&&!genericSummaries.has(summary)?{zh:summary,en:reviewedEnglishSummaries[point.code]}:reviewedEnglishSummaries[point.code]?{en:reviewedEnglishSummaries[point.code]}:undefined,
    description:studio&&(studio.description.zh||studio.description.en)?studio.description:undefined,whyStop:studio&&(studio.whyStop.zh||studio.whyStop.en)?studio.whyStop:undefined,firsthandNotes:studio&&(studio.firsthandNotes.zh||studio.firsthandNotes.en)?studio.firsthandNotes:undefined,
    practicalInfo:studio&&(studio.practicalInfo.zh.length||studio.practicalInfo.en.length)?studio.practicalInfo:undefined,
    parking:studio&&(studio.parking.zh||studio.parking.en)?studio.parking:undefined,
    toilet:studio?.facilities.toilet===true||managed?.facilities?.toilet===true?true:undefined,
    food:studio?.facilities.food===true||managed?.facilities?.restaurant===true?true:undefined,
    shop:studio?.facilities.shop===true||managed?.facilities?.shop===true?true:undefined,
    lodging:studio?.facilities.lodging===true||managed?.facilities?.lodging===true?true:undefined,
    familySuitability,
    familyNotes:studio&&(studio.familyNotes.zh||studio.familyNotes.en)?studio.familyNotes:familySuitability==="conditional"?{
      zh:"亲子可去，但需要根据当天水况、天气、孩子年龄和成人看护情况判断。",
      en:"Suitable for families only when current water, weather, the child's age, and close adult supervision allow.",
    }:undefined,
    campingRole,
    overnightStatus:studio?.overnightStatus??(campingRole==="overnight-stop"?"unknown":undefined),
    safetyNotes:studio&&(studio.safetyNotes.zh||studio.safetyNotes.en)?studio.safetyNotes:undefined,accessNotes:studio&&(studio.accessNotes.zh||studio.accessNotes.en)?studio.accessNotes:undefined,seasonNotes:studio&&(studio.seasonNotes.zh||studio.seasonNotes.en)?studio.seasonNotes:undefined,lastCheckedAt:studio?.trust.lastCheckedAt||undefined,
    trustStatus:studio?{firsthand:studio.trust.firsthand||undefined,checkedInPerson:studio.trust.checkedInPerson||undefined,officialSource:studio.trust.officialSource||undefined,recheckBeforeGoing:studio.trust.recheckBeforeGoing||undefined}:(point.ownerApproved===true&&point.humanConfirmed===true)||managed?.status==="在建"?{firsthand:point.ownerApproved===true&&point.humanConfirmed===true?true:undefined,checkedInPerson:point.ownerApproved===true&&point.humanConfirmed===true?true:undefined,recheckBeforeGoing:managed?.status==="在建"?true:undefined}:undefined,
    routeIds:routeIdsByPlace.get(point.code),
    videos:studio?.videos.flatMap(item=>item.platform?[{platform:item.platform,title:item.title.zh||item.title.en,url:item.url,publishedAt:item.publishedAt,language:item.language}]:[])??[], storyLinks:studio?.storyLinks.map(item=>({title:item.title.zh||item.title.en,url:item.url}))??[], researchLinks:studio?.researchLinks.map(item=>({title:item.title.zh||item.title.en,url:item.url}))??[],
    photoGallery:studio?.photos.length?studio.photos.sort((a,b)=>a.order-b.order).map(item=>({src:media(item.fileName),altZh:item.alt.zh||studio.name.zh,altEn:item.alt.en||undefined})):image?[{src:media(image),altZh:`${managed?.name??point.name}现场照片`,altEn:english?`Photo of ${english.name}`:undefined}]:[],
    themeIds,
    publicStatus:managed?.status??point.status,
  };
});

const pointById=new Map(basePlaces.map((place)=>[place.id,place]));
if(pointById.size!==snapshot.places.length)throw new Error("Knowledge map contains duplicate place IDs");
for(const route of publicKnowledgeRoutes)for(const placeId of route.placeIds)if(!pointById.has(placeId))throw new Error(`Unknown place ${placeId} in route ${route.id}`);
function squaredDistance(a:KnowledgePlace,b:KnowledgePlace){
  const lat=a.coordinates.latitude-b.coordinates.latitude;
  const lng=a.coordinates.longitude-b.coordinates.longitude;
  return lat*lat+lng*lng;
}

for(const route of publicKnowledgeRoutes){
  const primarySequence=route.places.filter((item)=>item.role==="core-stop").map((item)=>item.placeId);
  primarySequence.forEach((placeId,index)=>{
    const place=pointById.get(placeId);
    if(!place)return;
    place.previousPlaceId=primarySequence[index-1];
    place.nextPlaceId=primarySequence[index+1];
  });
}
for(const place of basePlaces){
  const visitorRole=(role:ReturnType<typeof routeRoleForPlace>)=>role==="core-stop"||role==="secondary-stop"||role==="observation";
  const orderedVisitorIds:string[]=[];
  const addVisitorCandidates=(ids:string[],routeId?:string)=>ids.forEach((id)=>{
    if(id===place.id||orderedVisitorIds.includes(id))return;
    const candidate=pointById.get(id);
    if(!candidate)return;
    const hasVisitorRole=routeId
      ? visitorRole(routeRoleForPlace(publicKnowledgeRoutes.find((route)=>route.id===routeId)!,id))
      : publicKnowledgeRoutes.some((route)=>visitorRole(routeRoleForPlace(route,id)));
    if(hasVisitorRole)orderedVisitorIds.push(id);
  });
  const containingRoutes=publicKnowledgeRoutes.filter((route)=>route.placeIds.includes(place.id));
  for(const route of containingRoutes){
    for(const stage of route.stages.filter((item)=>item.placeIds.includes(place.id))){
      addVisitorCandidates([...stage.placeIds].sort((a,b)=>squaredDistance(place,pointById.get(a)!)-squaredDistance(place,pointById.get(b)!)),route.id);
    }
  }
  for(const route of containingRoutes){
    addVisitorCandidates([...route.placeIds].sort((a,b)=>squaredDistance(place,pointById.get(a)!)-squaredDistance(place,pointById.get(b)!)),route.id);
  }
  addVisitorCandidates(basePlaces.map((item)=>item.id).sort((a,b)=>squaredDistance(place,pointById.get(a)!)-squaredDistance(place,pointById.get(b)!)));
  const sameStageServiceIds=new Set(publicKnowledgeRoutes.flatMap((route)=>
    route.stages
      .filter((stage)=>stage.placeIds.includes(place.id))
      .flatMap((stage)=>stage.placeIds.filter((placeId)=>["service","food"].includes(routeRoleForPlace(route,placeId)??""))),
  ));
  const serviceCandidates=basePlaces.filter((other)=>other.id!==place.id&&sameStageServiceIds.has(other.id));
  if(!(place.nearbyPlaceIds?.length))place.nearbyPlaceIds=orderedVisitorIds.slice(0,3);
  place.nearbyServiceIds=serviceCandidates.sort((a,b)=>squaredDistance(place,a)-squaredDistance(place,b)).slice(0,3).map((other)=>other.id);
}

export const knowledgePlaces:readonly KnowledgePlace[]=basePlaces;
export const knowledgePlaceById=new Map(knowledgePlaces.map((place)=>[place.id,place]));

export function localizedPlaceName(place:KnowledgePlace,locale:"zh"|"en",short=false){
  if(locale==="zh")return short?place.shortNameZh:place.nameZh;
  return short?(place.shortNameEn??place.shortNameZh):(place.nameEn??place.nameZh);
}

export function localizedPlaceRegion(place:KnowledgePlace,locale:"zh"|"en"){
  return place.region?.[locale]??place.region?.zh;
}
