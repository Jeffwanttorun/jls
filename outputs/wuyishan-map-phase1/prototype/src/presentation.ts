import {computed,ref} from 'vue';

export interface PresentationTheme {id:string;name:string;icon:string;tone:string;eyebrow:string;description:string;sequence:number}
export interface PresentationAssignment {placeCode:string;themeIds:string[];familyFriendly:boolean;facilities?:{toilet:boolean;shop:boolean;restaurant:boolean;lodging:boolean};parentCardByTheme?:Record<string,string>;orderByTheme:Record<string,number>;titleByTheme:Record<string,string>;summaryByTheme:Record<string,string>}
export interface PresentationModule {id:string;kind:string;title:string;body:string;items:string[];columns:Array<{title:string;icon:string;items:string[]}>;hidden:boolean;sequence:number}
export interface PresentationDocument {internalName:string;slug:string;title:string;summary:string;themeIds:string[];themeOrder:Record<string,number>;familyFriendly:boolean;placeLinks:Array<{placeCode:string;role:string;sequence:number}>;navigationTargets:Array<{placeCode:string;label:string;sequence:number;isDefault:boolean}>;alertIds:string[];modules:PresentationModule[];presentation:{kind:string;eyebrow:string;cover:string;tags:string[];corridorAnchor:number;nearbyCodes:string[];arrivalNotes:Record<string,string>;dadTip:string;videoLabel:string;mediaText:string}}
export interface PresentationContent {id:string;version:number|null;status:string;updatedAt:string|null;document:PresentationDocument}
export interface PresentationAlert {id:string;text:string;level:'提示'|'注意'|'重要';placeCodes:string[];contentIds:string[]}
export interface PresentationImage {id:string;fileName:string;mimeType:string;originalName:string;uploadedAt:string;url:string}
export interface VisitorPresentation {storeVersion:number;home:{version:number;updatedAt:string;heroImage:PresentationImage|null;eyebrow:string;titleLine1:string;titleLine2:string;introLine1:string;introLine2:string;mapButtonLabel:string;corridorButtonLabel:string;kidsLabel:string;themeCardHint:string;recommendationsEyebrow:string;recommendationsTitle:string;recommendationsLinkLabel:string;recommendationManshuiTitle:string;recommendationManshuiSummary:string;recommendationMoonbayTitle:string;recommendationMoonbaySummary:string;recommendationTaoyuanyuTitle:string;recommendationTaoyuanyuSummary:string;routesEyebrow:string;routesTitle:string;routeFamilyTitle:string;routeFamilySummary:string;routeDayTitle:string;routeDaySummary:string;routeTwoDayTitle:string;routeTwoDaySummary:string};mediaVersion:number;media:Record<string,PresentationImage>;themes:PresentationTheme[];placeAssignments:PresentationAssignment[];contents:PresentationContent[];alerts:PresentationAlert[]}

const publicState=ref<VisitorPresentation|null>(null),publicLoading=ref(false),publicError=ref('');let publicTask:Promise<void>|null=null;

async function fetchPresentation(previewId?:string){
 const response=await fetch(previewId?`/api/local-prototype/preview/${encodeURIComponent(previewId)}`:'/api/local-prototype/presentation');
 if(!response.ok)throw Error('读取游客内容失败');const body=await response.json();if(body.scope!=='local-prototype')throw Error('游客内容来源无效');return body as VisitorPresentation;
}

export function useVisitorPresentation(previewId?:string){
 if(previewId){
  const state=ref<VisitorPresentation|null>(null),loading=ref(false),error=ref('');
  const load=async()=>{loading.value=true;error.value='';try{state.value=await fetchPresentation(previewId);}catch(e){error.value=(e as Error).message;}finally{loading.value=false;}};
  return {state,loading,error,load,themes:computed(()=>state.value?.themes||[]),contents:computed(()=>state.value?.contents||[])};
 }
 const load=async()=>{if(publicState.value||publicTask)return publicTask;publicLoading.value=true;publicTask=fetchPresentation().then(value=>{publicState.value=value;}).catch(e=>{publicError.value=(e as Error).message;publicTask=null;}).finally(()=>{publicLoading.value=false;});return publicTask;};
 return {state:publicState,loading:publicLoading,error:publicError,load,themes:computed(()=>publicState.value?.themes||[]),contents:computed(()=>publicState.value?.contents||[])};
}

export function labelsForPlace(state:VisitorPresentation|null,placeCode:string){
 const assignment=state?.placeAssignments.find(item=>item.placeCode===placeCode);if(!assignment)return [];
 const labels=(state?.themes||[]).filter(theme=>assignment.themeIds.includes(theme.id)).map(theme=>theme.name);if(assignment.familyFriendly)labels.push('适合带孩子');return labels;
}

export function labelsForContent(state:VisitorPresentation|null,content:PresentationContent){
 const labels=(state?.themes||[]).filter(theme=>content.document.themeIds.includes(theme.id)).map(theme=>theme.name);if(content.document.familyFriendly)labels.push('适合带孩子');return labels;
}

export function alertsFor(state:VisitorPresentation|null,placeCodes:string[],contentId?:string){
 return (state?.alerts||[]).filter(alert=>(contentId&&alert.contentIds.includes(contentId))||alert.placeCodes.some(code=>placeCodes.includes(code)));
}

export function imageFor(state:VisitorPresentation|null,...slots:Array<string|undefined|null>){for(const slot of slots)if(slot&&state?.media?.[slot])return state.media[slot].url;return '';}
export function imagesFor(state:VisitorPresentation|null,...slots:Array<string|undefined|null>){
 for(const slot of slots){if(!slot||!state)return [];const images=Object.entries(state.media).filter(([key])=>key===slot||key.startsWith(slot+'.gallery.')).sort((a,b)=>a[1].uploadedAt.localeCompare(b[1].uploadedAt)).map(([,image])=>image.url);if(images.length)return [...new Set(images)];}
 return [];
}

