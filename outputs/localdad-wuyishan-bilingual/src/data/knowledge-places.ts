import snapshot from "./wuyishan-public-map.json";
import runtime from "./visitor-runtime.json";
import { publicMapLabelFor } from "./map-place-labels";
import { knowledgeRoutes } from "./knowledge-routes";
import type { KnowledgePlace } from "../types/knowledge-map";

type RuntimePlace = {
  code:string; name:string; region:string; summary:string; themes:string[];
  familyFriendly:boolean; facilities?:{toilet?:boolean;shop?:boolean;restaurant?:boolean;lodging?:boolean};
  status:string; image:string|null;
};

const runtimeById = new Map((runtime.places as RuntimePlace[]).map((place)=>[place.code,place]));
const routeIdsByPlace = new Map<string,string[]>();
for(const route of knowledgeRoutes) for(const placeId of route.placeIds){
  const routeIds=routeIdsByPlace.get(placeId)??[];
  routeIds.push(route.id);
  routeIdsByPlace.set(placeId,routeIds);
}

const reviewedEnglishNames:Record<string,{name:string;shortName?:string;status:KnowledgePlace["englishNameStatus"]}>={
  "WY-0001":{name:"Nanyuanling",status:"established"},
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

const basePlaces:KnowledgePlace[]=snapshot.places.map((point)=>{
  const managed=runtimeById.get(point.code);
  const labels=publicMapLabelFor(point.code,managed?.name??point.name);
  const english=reviewedEnglishNames[point.code];
  const summary=managed?.summary?.trim();
  const image=managed?.image?.trim();
  return {
    id:point.code,
    nameZh:managed?.name?.trim()||point.name,
    nameEn:english?.name,
    shortNameZh:labels.shortName,
    shortNameEn:english?.shortName??english?.name,
    englishNameStatus:english?.status??"pending",
    labelPriority:labels.labelPriority,
    category:labels.category,
    coordinates:point.coordinates,
    region:managed?.region?.trim()||point.region||undefined,
    summary:summary&&!genericSummaries.has(summary)?{zh:summary,en:reviewedEnglishSummaries[point.code]}:reviewedEnglishSummaries[point.code]?{en:reviewedEnglishSummaries[point.code]}:undefined,
    toilet:managed?.facilities?.toilet===true?true:undefined,
    food:managed?.facilities?.restaurant===true?true:undefined,
    shop:managed?.facilities?.shop===true?true:undefined,
    lodging:managed?.facilities?.lodging===true?true:undefined,
    familyFriendly:managed?.familyFriendly===true?true:undefined,
    trustStatus:{firsthand:true,checkedInPerson:true,recheckBeforeGoing:managed?.status==="在建"?true:undefined},
    routeIds:routeIdsByPlace.get(point.code),
    videos:[], storyLinks:[], researchLinks:[],
    photoGallery:image?[{src:media(image),altZh:`${managed?.name??point.name}现场照片`,altEn:english?`Photo of ${english.name}`:undefined}]:[],
    themeIds:managed?.themes??[],
    publicStatus:managed?.status??point.status,
  };
});

const pointById=new Map(basePlaces.map((place)=>[place.id,place]));
if(pointById.size!==snapshot.places.length)throw new Error("Knowledge map contains duplicate place IDs");
for(const route of knowledgeRoutes)for(const placeId of route.placeIds)if(!pointById.has(placeId))throw new Error(`Unknown place ${placeId} in route ${route.id}`);
function squaredDistance(a:KnowledgePlace,b:KnowledgePlace){
  const lat=a.coordinates.latitude-b.coordinates.latitude;
  const lng=a.coordinates.longitude-b.coordinates.longitude;
  return lat*lat+lng*lng;
}

for(const route of knowledgeRoutes){
  route.placeIds.forEach((placeId,index)=>{
    const place=pointById.get(placeId);
    if(!place)return;
    place.previousPlaceId=route.placeIds[index-1];
    place.nextPlaceId=route.placeIds[index+1];
  });
}
for(const place of basePlaces){
  place.nearbyPlaceIds=basePlaces.filter((other)=>other.id!==place.id).sort((a,b)=>squaredDistance(place,a)-squaredDistance(place,b)).slice(0,3).map((other)=>other.id);
}

export const knowledgePlaces:readonly KnowledgePlace[]=basePlaces;
export const knowledgePlaceById=new Map(knowledgePlaces.map((place)=>[place.id,place]));

export function localizedPlaceName(place:KnowledgePlace,locale:"zh"|"en",short=false){
  if(locale==="zh")return short?place.shortNameZh:place.nameZh;
  return short?(place.shortNameEn??place.shortNameZh):(place.nameEn??place.nameZh);
}
