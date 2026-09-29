import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {knowledgePlaces} from '../../localdad-wuyishan-bilingual/src/data/knowledge-places.js';
import {knowledgeRoutes} from '../../localdad-wuyishan-bilingual/src/data/knowledge-routes.js';
import runtime from '../../localdad-wuyishan-bilingual/src/data/visitor-runtime.json' with {type:'json'};
import map from '../../localdad-wuyishan-bilingual/src/data/wuyishan-public-map.json' with {type:'json'};
import type {ContentStudioDocument,StudioPlace,StudioTheme} from '../shared/content-studio.js';

const visitorThemeById=new Map(runtime.themes.map(theme=>[theme.id,theme]));
const emptyText=()=>({zh:'',en:''});
const themes:StudioTheme[]=[...runtime.themes].map((theme,index)=>({id:theme.id,name:{zh:theme.name,en:''},summary:{zh:theme.description??'',en:''},icon:theme.icon,tone:theme.tone,order:theme.sequence??index*10,published:true,archivedAt:null}));
const places=Object.fromEntries(knowledgePlaces.map((place):[string,StudioPlace]=>[place.id,{
 id:place.id,name:{zh:place.nameZh,en:place.nameEn??''},shortName:{zh:place.shortNameZh,en:place.shortNameEn??''},pinyin:'',englishNameStatus:place.englishNameStatus,labelPriority:place.labelPriority,
 category:place.category,region:{zh:place.region?.zh??'',en:place.region?.en??''},address:emptyText(),summary:{zh:place.summary?.zh??'',en:place.summary?.en??''},description:{zh:place.description?.zh??'',en:place.description?.en??''},whyStop:{zh:place.whyStop?.zh??'',en:place.whyStop?.en??''},firsthandNotes:{zh:place.firsthandNotes?.zh??'',en:place.firsthandNotes?.en??''},
 practicalInfo:{zh:place.practicalInfo?.zh??[],en:place.practicalInfo?.en??[]},parking:{zh:place.parking?.zh??'',en:place.parking?.en??''},toiletNote:emptyText(),foodNote:emptyText(),shopNote:emptyText(),lodgingNote:emptyText(),
 facilities:{parking:Boolean(place.parking),toilet:place.toilet===true,food:place.food===true,shop:place.shop===true,lodging:place.lodging===true},familySuitability:place.familySuitability??'unknown',familyNotes:{zh:place.familyNotes?.zh??'',en:place.familyNotes?.en??''},
 overnightStatus:place.overnightStatus??'unknown',overnightNotes:emptyText(),overnightLastCheckedAt:'',overnightSource:'',safetyNotes:{zh:place.safetyNotes?.zh??'',en:place.safetyNotes?.en??''},accessNotes:{zh:place.accessNotes?.zh??'',en:place.accessNotes?.en??''},seasonNotes:{zh:place.seasonNotes?.zh??'',en:place.seasonNotes?.en??''},
 trust:{firsthand:place.trustStatus?.firsthand===true,checkedInPerson:place.trustStatus?.checkedInPerson===true,officialSource:place.trustStatus?.officialSource===true,recheckBeforeGoing:place.trustStatus?.recheckBeforeGoing===true,lastCheckedAt:place.lastCheckedAt??''},themeIds:place.themeIds??[],publicStatus:place.publicStatus??'正常',published:true,recommended:(place.labelPriority??20)>=80,
 videos:(place.videos??[]).map((item,index)=>({id:`${place.id}-video-${index+1}`,platform:item.platform,title:{zh:item.title,en:item.title},url:item.url,publishedAt:item.publishedAt,language:item.language})),storyLinks:(place.storyLinks??[]).map((item,index)=>({id:`${place.id}-story-${index+1}`,title:{zh:item.title,en:item.title},url:item.url})),researchLinks:(place.researchLinks??[]).map((item,index)=>({id:`${place.id}-research-${index+1}`,title:{zh:item.title,en:item.title},url:item.url})),
 photos:(place.photoGallery??[]).map((item,index)=>({id:`${place.id}-photo-${index+1}`,fileName:item.src.replace(/^.*\//,''),alt:{zh:item.altZh,en:item.altEn??''},role:index===0?'cover':'gallery',order:index*10})),
 coordinates:{latitude:place.coordinates.latitude,longitude:place.coordinates.longitude,system:place.coordinates.system},
}]));

const routes=knowledgeRoutes.map(route=>({
 id:route.id,slug:route.slug,name:{zh:route.nameZh,en:route.nameEn},summary:{zh:route.summaryZh??'',en:route.summaryEn??''},mapTitle:{zh:route.mapTitleZh??'',en:route.mapTitleEn??''},order:route.order,published:route.published,featured:route.featured,archivedAt:null,geometryRouteIds:[...route.geometryRouteIds],
 stages:route.stages.map((stage,index)=>({id:stage.id,title:{zh:stage.titleZh,en:stage.titleEn??''},summary:emptyText(),order:(index+1)*10,published:true,visible:true,archivedAt:null,groups:[]})),
 memberships:route.stages.flatMap(stage=>stage.placeIds.map((placeId,index)=>({placeId,stageId:stage.id,groupId:null,role:route.places.find(item=>item.placeId===placeId)!.role,order:(index+1)*10,visible:true}))),
 practicalNotes:{zh:route.practicalNotesZh??[],en:route.practicalNotesEn??[]},videos:[],storyLinks:[],researchLinks:[],
}));

// The protected source count excludes the five repeated join points that are
// intentionally present in the six rendered segments.
const pointCount=map.routeSource.geometryPointCount;
const geometryHash=createHash('sha256').update(JSON.stringify(map.routes)).digest('hex');
const document:ContentStudioDocument={schemaVersion:2,routes,places,themes,siteSettings:{brand:{zh:'武夷山奶爸',en:'Local Dad Jeff'},contactEmail:'',socialLinks:[],footerNote:emptyText()},geometry:{routeCount:map.routes.length,pointCount,protectedHash:geometryHash},updatedAt:new Date().toISOString()};
const output=resolve('content-studio-store/seed.json');await mkdir(resolve('content-studio-store'),{recursive:true});await writeFile(output,JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({output,places:Object.keys(places).length,routes:routes.length,themes:themes.length,routeSegments:map.routes.length,routePoints:pointCount,knownThemes:[...visitorThemeById.keys()]},null,2));
