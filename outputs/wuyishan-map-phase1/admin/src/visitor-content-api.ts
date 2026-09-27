import {api} from './api';

export interface VTheme {id:string;name:string;icon:string;tone:string;eyebrow:string;description:string;sequence:number;version:number;updatedAt:string}
export interface VPlace {code:string;name:string;place_type:string;status:string;deleted_at:string|null;duplicate_of_place_id:string|null;has_coordinate:boolean;old_names:string[]}
export interface VAssignment {placeCode:string;version:number;themeIds:string[];familyFriendly:boolean;facilities?:{toilet:boolean;shop:boolean;restaurant:boolean;lodging:boolean};parentCardByTheme?:Record<string,string>;orderByTheme:Record<string,number>;titleByTheme:Record<string,string>;summaryByTheme:Record<string,string>;updatedAt:string}
export interface VModule {id:string;kind:string;title:string;body:string;items:string[];columns:Array<{title:string;icon:string;items:string[]}>;hidden:boolean;sequence:number}
export interface VDocument {internalName:string;slug:string;title:string;summary:string;themeIds:string[];themeOrder:Record<string,number>;familyFriendly:boolean;placeLinks:Array<{placeCode:string;role:string;sequence:number}>;navigationTargets:Array<{placeCode:string;label:string;sequence:number;isDefault:boolean}>;alertIds:string[];modules:VModule[];presentation:{kind:string;eyebrow:string;cover:string;tags:string[];corridorAnchor:number;nearbyCodes:string[];arrivalNotes:Record<string,string>;dadTip:string;videoLabel:string;mediaText:string}}
export interface VContent {id:string;version:number;status:'draft'|'published'|'hidden';deletedAt:string|null;previousStatus:string|null;updatedAt:string;publishedAt:string|null;publishedVersion:number|null;draft:VDocument;published:VDocument|null}
export interface VAlert {id:string;version:number;text:string;level:'提示'|'注意'|'重要';enabled:boolean;startAt:string|null;endAt:string|null;placeCodes:string[];contentIds:string[];deletedAt:string|null;updatedAt:string}
export interface VImage {id:string;fileName:string;mimeType:string;originalName:string;uploadedAt:string}
export interface VHomeDocument {heroImage:VImage|null;eyebrow:string;titleLine1:string;titleLine2:string;introLine1:string;introLine2:string;mapButtonLabel:string;corridorButtonLabel:string;kidsLabel:string;themeCardHint:string;recommendationsEyebrow:string;recommendationsTitle:string;recommendationsLinkLabel:string;recommendationManshuiTitle:string;recommendationManshuiSummary:string;recommendationMoonbayTitle:string;recommendationMoonbaySummary:string;recommendationTaoyuanyuTitle:string;recommendationTaoyuanyuSummary:string;routesEyebrow:string;routesTitle:string;routeFamilyTitle:string;routeFamilySummary:string;routeDayTitle:string;routeDaySummary:string;routeTwoDayTitle:string;routeTwoDaySummary:string}
export interface VHome {version:number;updatedAt:string;publishedAt:string|null;draft:VHomeDocument;published:VHomeDocument}
export interface VMedia {version:number;updatedAt:string;items:Record<string,VImage>}
export interface VState {schemaVersion:number;version:number;updatedAt:string;home:VHome;media:VMedia;themes:VTheme[];placeAssignments:VAssignment[];contents:VContent[];alerts:VAlert[];history:any[]}
export interface VIssue {id:string;kind:string;message:string;contentId:string;title:string;href:string}
export interface VPayload {state:VState;places:VPlace[];issues:VIssue[]}

export const roleLabels:Record<string,string>={primary:'主要体验',secondary:'第二体验 / 下一部分',parking:'停车',toilet:'卫生间',navigation:'导航',nearby_service:'附近服务',other:'其他'};
export const statusLabels:Record<string,string>={draft:'草稿',published:'已发布',hidden:'隐藏'};

export function getVisitorState(){return api<VPayload>('/visitor-content/state');}
export function postVisitor<T=any>(path:string,body:unknown){return api<T>('/visitor-content'+path,body);}
export function placeName(places:VPlace[],code:string){const place=places.find(item=>item.code===code);return place?place.name:code;}
export function formatUpdate(value:string){const date=new Date(value);return date.toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});}
export function emptyDocument():VDocument{return {internalName:'',slug:'',title:'',summary:'',themeIds:[],themeOrder:{},familyFriendly:false,placeLinks:[],navigationTargets:[],alertIds:[],modules:[],presentation:{kind:'outdoor',eyebrow:'',cover:'沿路真实画面',tags:[],corridorAnchor:9999,nearbyCodes:[],arrivalNotes:{},dadTip:'',videoLabel:'真实画面',mediaText:'真实素材稍后补充。'}};}
export function previewUrl(id:string){return `${location.protocol}//${location.hostname}:5174/preview/${encodeURIComponent(id)}`;}
export function visitorHomeUrl(){return `${location.protocol}//${location.hostname}:5174/`;}
export function adminMediaUrl(image:VImage|null|undefined){return image?`/api/admin/visitor-content/media/${encodeURIComponent(image.fileName)}`:'';}

