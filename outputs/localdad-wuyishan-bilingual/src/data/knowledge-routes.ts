import studio from "./content-studio-runtime.json";
import type { KnowledgeRoute, KnowledgeRoutePlaceRole } from "../types/knowledge-map";

const document=studio.document;
const activeRoutes=document.routes.filter((route)=>!route.archivedAt);

export const knowledgeRoutes:readonly KnowledgeRoute[]=activeRoutes.map((route)=>{
  const activeStages=route.stages.filter((stage)=>!stage.archivedAt&&stage.visible).sort((a,b)=>a.order-b.order);
  const orderedMemberships=activeStages.flatMap((stage)=>{
    const groupOrder=new Map(stage.groups.filter((group)=>!group.archivedAt&&group.visible).sort((a,b)=>a.order-b.order).map((group,index)=>[group.id,index]));
    return route.memberships.filter((member)=>member.visible&&member.stageId===stage.id).sort((a,b)=>{
      const ga=memberGroupOrder(a.groupId,groupOrder),gb=memberGroupOrder(b.groupId,groupOrder);
      return ga-gb||a.order-b.order;
    });
  });
  return {
    id:route.id,slug:route.slug,published:route.published,featured:route.featured,order:route.order,
    nameZh:route.name.zh,nameEn:route.name.en,summaryZh:route.summary.zh||undefined,summaryEn:route.summary.en||undefined,mapTitleZh:route.mapTitle.zh||undefined,mapTitleEn:route.mapTitle.en||undefined,
    placeIds:orderedMemberships.map((member)=>member.placeId),geometryRouteIds:route.geometryRouteIds,
    places:orderedMemberships.map((member)=>({placeId:member.placeId,role:member.role as KnowledgeRoutePlaceRole,stageId:member.stageId,groupId:member.groupId??undefined,order:member.order,showRoleLabel:member.showRoleLabel})),
    stages:activeStages.map((stage)=>({id:stage.id,titleZh:stage.title.zh,titleEn:stage.title.en||undefined,placeIds:orderedMemberships.filter((member)=>member.stageId===stage.id).map((member)=>member.placeId),groups:stage.groups.filter((group)=>!group.archivedAt&&group.visible).sort((a,b)=>a.order-b.order).map((group)=>({id:group.id,titleZh:group.title.zh,titleEn:group.title.en||undefined,summaryZh:group.summary.zh||undefined,summaryEn:group.summary.en||undefined,placeIds:orderedMemberships.filter((member)=>member.groupId===group.id).map((member)=>member.placeId)}))})),
    practicalNotesZh:route.practicalNotes.zh,practicalNotesEn:route.practicalNotes.en,
    videos:route.videos.flatMap((item)=>item.platform?[{platform:item.platform,title:item.title.zh||item.title.en,url:item.url,publishedAt:item.publishedAt,language:item.language}]:[]),
    storyLinks:route.storyLinks.map((item)=>({title:item.title.zh||item.title.en,url:item.url})),researchLinks:route.researchLinks.map((item)=>({title:item.title.zh||item.title.en,url:item.url})),
  };
});

function memberGroupOrder(groupId:string|null,groupOrder:Map<string,number>){return groupId?(groupOrder.get(groupId)??999):998;}
for(const route of knowledgeRoutes){
  if(!Number.isFinite(route.order))throw new Error(`Route order is invalid for ${route.id}`);
  if(route.featured&&!route.published)throw new Error(`Featured route must be published: ${route.id}`);
  const uniquePlaceIds=new Set(route.placeIds);if(uniquePlaceIds.size!==route.placeIds.length)throw new Error(`Duplicate place relationship in route ${route.id}`);
  const stagePlaceIds=route.stages.flatMap((stage)=>stage.placeIds);if(stagePlaceIds.length!==route.placeIds.length||stagePlaceIds.some((placeId,index)=>placeId!==route.placeIds[index]))throw new Error(`Route stage order does not match route place order for ${route.id}`);
}

export const scenicRoadPlaceRoles:Record<string,KnowledgeRoutePlaceRole>=Object.fromEntries(knowledgeRoutes.find((route)=>route.id==="no-1-scenic-road")?.places.map((item)=>[item.placeId,item.role])??[]);
export const knowledgeRouteById=new Map(knowledgeRoutes.map((route)=>[route.id,route]));
export function routeRoleForPlace(route:KnowledgeRoute,placeId:string){return route.places.find((item)=>item.placeId===placeId)?.role;}
