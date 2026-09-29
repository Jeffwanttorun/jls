export type StudioLocaleText={zh:string;en:string};
export type StudioRole='core-stop'|'secondary-stop'|'observation'|'service'|'junction'|'food';
export type FamilySuitability='yes'|'conditional'|'no'|'unknown';
export type OvernightStatus='allowed'|'used-in-person'|'recheck'|'not-recommended'|'prohibited'|'unknown';

export interface StudioMembership {placeId:string;stageId:string;groupId:string|null;role:StudioRole;order:number;visible:boolean;showRoleLabel?:boolean}
export interface StudioGroup {id:string;title:StudioLocaleText;summary:StudioLocaleText;order:number;published:boolean;visible:boolean;archivedAt:string|null}
export interface StudioStage {id:string;title:StudioLocaleText;summary:StudioLocaleText;order:number;published:boolean;visible:boolean;archivedAt:string|null;groups:StudioGroup[]}
export interface StudioRoute {id:string;slug:string;name:StudioLocaleText;summary:StudioLocaleText;mapTitle:StudioLocaleText;order:number;published:boolean;featured:boolean;archivedAt:string|null;geometryRouteIds:string[];stages:StudioStage[];memberships:StudioMembership[];practicalNotes:{zh:string[];en:string[]};videos:StudioLink[];storyLinks:StudioLink[];researchLinks:StudioLink[]}
export interface StudioLink {id:string;platform?:'douyin'|'youtube'|'instagram'|'tiktok';title:StudioLocaleText;url:string;publishedAt?:string;language?:'zh'|'en'}
export interface StudioPhoto {id:string;fileName:string;alt:StudioLocaleText;role:'cover'|'gallery';order:number}
export interface StudioPlace {
 id:string;name:StudioLocaleText;shortName:StudioLocaleText;pinyin:string;englishNameStatus:'official'|'established'|'translated'|'pinyin'|'pending';labelPriority:20|40|60|80|100;
 category:string;region:StudioLocaleText;address:StudioLocaleText;summary:StudioLocaleText;description:StudioLocaleText;whyStop:StudioLocaleText;firsthandNotes:StudioLocaleText;
 practicalInfo:{zh:string[];en:string[]};parking:StudioLocaleText;toiletNote:StudioLocaleText;foodNote:StudioLocaleText;shopNote:StudioLocaleText;lodgingNote:StudioLocaleText;
 facilities:{parking:boolean;toilet:boolean;food:boolean;shop:boolean;lodging:boolean};familySuitability:FamilySuitability;familyNotes:StudioLocaleText;
 overnightStatus:OvernightStatus;overnightNotes:StudioLocaleText;overnightLastCheckedAt:string;overnightSource:string;safetyNotes:StudioLocaleText;accessNotes:StudioLocaleText;seasonNotes:StudioLocaleText;
 trust:{firsthand:boolean;checkedInPerson:boolean;officialSource:boolean;recheckBeforeGoing:boolean;lastCheckedAt:string};themeIds:string[];publicStatus:string;published:boolean;recommended:boolean;
 videos:StudioLink[];storyLinks:StudioLink[];researchLinks:StudioLink[];photos:StudioPhoto[];
 coordinates:{latitude:number;longitude:number;system:string;navigationLatitude?:number;navigationLongitude?:number};
}
export interface StudioTheme {id:string;name:StudioLocaleText;summary:StudioLocaleText;icon:string;tone:string;order:number;published:boolean;archivedAt:string|null}
export interface StudioSiteSettings {brand:StudioLocaleText;contactEmail:string;socialLinks:StudioLink[];footerNote:StudioLocaleText}
export interface ContentStudioDocument {schemaVersion:2;routes:StudioRoute[];places:Record<string,StudioPlace>;themes:StudioTheme[];siteSettings:StudioSiteSettings;geometry:{routeCount:number;pointCount:number;protectedHash:string};updatedAt:string}

export interface StudioValidationIssue {level:'error'|'warning';code:string;message:string;href?:string}

export function validateContentStudio(doc:ContentStudioDocument){
 const issues:StudioValidationIssue[]=[];
 const placeIds=new Set(Object.keys(doc.places));
 if(placeIds.size!==Object.keys(doc.places).length)issues.push({level:'error',code:'duplicate-place',message:'地点编号重复'});
 const routeIds=new Set<string>(),slugs=new Set<string>();
 for(const route of doc.routes){
  if(routeIds.has(route.id))issues.push({level:'error',code:'duplicate-route',message:`路线编号重复：${route.id}`});routeIds.add(route.id);
  if(slugs.has(route.slug))issues.push({level:'error',code:'duplicate-slug',message:`路线访问路径重复：${route.slug}`});slugs.add(route.slug);
  const stageIds=new Set(route.stages.filter(s=>!s.archivedAt).map(s=>s.id));
  const groupIds=new Set(route.stages.flatMap(s=>s.groups.filter(g=>!g.archivedAt).map(g=>g.id)));
  const membershipKeys=new Set<string>();
  for(const member of route.memberships.filter(m=>m.visible)){
   const key=`${member.placeId}:${member.stageId}`;if(membershipKeys.has(key))issues.push({level:'error',code:'duplicate-membership',message:`${route.name.zh} 中 ${member.placeId} 重复出现`});membershipKeys.add(key);
   if(!placeIds.has(member.placeId))issues.push({level:'error',code:'missing-place',message:`路线引用不存在地点：${member.placeId}`});
   if(!stageIds.has(member.stageId))issues.push({level:'error',code:'missing-stage',message:`${member.placeId} 引用不存在阶段：${member.stageId}`});
   if(member.groupId&&!groupIds.has(member.groupId))issues.push({level:'error',code:'missing-group',message:`${member.placeId} 引用不存在分组：${member.groupId}`});
  }
 }
 for(const place of Object.values(doc.places)){
  if(place.published&&(!Number.isFinite(place.coordinates.latitude)||!Number.isFinite(place.coordinates.longitude)))issues.push({level:'error',code:'missing-coordinate',message:`公开地点 ${place.id} 缺少坐标`,href:`/studio/places/${place.id}`});
  if(place.englishNameStatus!=='pending'&&!place.name.en.trim())issues.push({level:'error',code:'english-status',message:`${place.id} 已标记英文名状态但英文名为空`,href:`/studio/places/${place.id}`});
  if(!place.name.en.trim())issues.push({level:'warning',code:'missing-english',message:`${place.id} 缺英文名称`,href:`/studio/places/${place.id}`});
  if(!place.photos.length)issues.push({level:'warning',code:'missing-image',message:`${place.id} 尚未设置图片`,href:`/studio/places/${place.id}`});
  if(!place.summary.zh.trim())issues.push({level:'warning',code:'missing-summary',message:`${place.id} 尚未填写简介`,href:`/studio/places/${place.id}`});
  if(place.overnightStatus==='unknown')issues.push({level:'warning',code:'overnight-unknown',message:`${place.id} 过夜情况未确认`,href:`/studio/places/${place.id}`});
 }
 if(doc.geometry.routeCount!==6||doc.geometry.pointCount!==952)issues.push({level:'error',code:'geometry-integrity',message:`受保护路线应为 6 段 / 952 点，当前是 ${doc.geometry.routeCount} 段 / ${doc.geometry.pointCount} 点`});
 return issues;
}

export function studioStats(doc:ContentStudioDocument){
 const places=Object.values(doc.places),routes=doc.routes.filter(r=>r.published&&!r.archivedAt),themes=doc.themes.filter(t=>t.published&&!t.archivedAt);
 return {places:places.filter(p=>p.published).length,routes:routes.length,themes:themes.length,coreStops:routes.flatMap(r=>r.memberships).filter(m=>m.visible&&m.role==='core-stop').length,routeSegments:doc.geometry.routeCount,routePoints:doc.geometry.pointCount};
}
