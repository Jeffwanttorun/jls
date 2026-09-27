import {copyFile,mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import {basename,dirname,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';

export type VisitorPublishStatus='draft'|'published'|'hidden';
export type VisitorThemeId='water'|'scenery'|'nature'|'tea'|'museum'|'food'|string;
export type VisitorAlertLevel='提示'|'注意'|'重要';
export type VisitorPlaceRole='primary'|'secondary'|'parking'|'toilet'|'navigation'|'nearby_service'|'other';

export interface VisitorTheme {id:VisitorThemeId;name:string;icon:string;tone:string;eyebrow:string;description:string;sequence:number;version:number;updatedAt:string}
export interface VisitorFacilities {toilet:boolean;shop:boolean;restaurant:boolean;lodging:boolean}
export interface VisitorPlaceAssignment {placeCode:string;version:number;themeIds:string[];familyFriendly:boolean;facilities?:VisitorFacilities;parentCardByTheme?:Record<string,string>;orderByTheme:Record<string,number>;titleByTheme:Record<string,string>;summaryByTheme:Record<string,string>;updatedAt:string}
export interface VisitorContentModule {id:string;kind:string;title:string;body:string;items:string[];columns:Array<{title:string;icon:string;items:string[]}>;hidden:boolean;sequence:number}
export interface VisitorPlaceLink {placeCode:string;role:VisitorPlaceRole;sequence:number}
export interface VisitorNavigationTarget {placeCode:string;label:string;sequence:number;isDefault:boolean}
export interface VisitorContentDocument {
 internalName:string;slug:string;title:string;summary:string;themeIds:string[];themeOrder:Record<string,number>;familyFriendly:boolean;
 placeLinks:VisitorPlaceLink[];navigationTargets:VisitorNavigationTarget[];alertIds:string[];modules:VisitorContentModule[];
 presentation:{kind:string;eyebrow:string;cover:string;tags:string[];corridorAnchor:number;nearbyCodes:string[];arrivalNotes:Record<string,string>;dadTip:string;videoLabel:string;mediaText:string};
}
export interface VisitorContentUnit {id:string;version:number;status:VisitorPublishStatus;deletedAt:string|null;previousStatus:VisitorPublishStatus|null;updatedAt:string;publishedAt:string|null;publishedVersion:number|null;draft:VisitorContentDocument;published:VisitorContentDocument|null}
export interface VisitorAlert {id:string;version:number;text:string;level:VisitorAlertLevel;enabled:boolean;startAt:string|null;endAt:string|null;placeCodes:string[];contentIds:string[];deletedAt:string|null;updatedAt:string}
export interface VisitorHistory {id:string;at:string;objectType:string;objectId:string;changeType:string;beforeSummary:string;afterSummary:string}
export interface VisitorImageAsset {id:string;fileName:string;mimeType:'image/jpeg'|'image/png'|'image/webp';originalName:string;uploadedAt:string}
export interface VisitorHomeDocument {heroImage:VisitorImageAsset|null;eyebrow:string;titleLine1:string;titleLine2:string;introLine1:string;introLine2:string;mapButtonLabel:string;corridorButtonLabel:string;kidsLabel:string;themeCardHint:string;recommendationsEyebrow:string;recommendationsTitle:string;recommendationsLinkLabel:string;recommendationManshuiTitle:string;recommendationManshuiSummary:string;recommendationMoonbayTitle:string;recommendationMoonbaySummary:string;recommendationTaoyuanyuTitle:string;recommendationTaoyuanyuSummary:string;routesEyebrow:string;routesTitle:string;routeFamilyTitle:string;routeFamilySummary:string;routeDayTitle:string;routeDaySummary:string;routeTwoDayTitle:string;routeTwoDaySummary:string}
export interface VisitorHomeState {version:number;updatedAt:string;publishedAt:string|null;draft:VisitorHomeDocument;published:VisitorHomeDocument}
export interface VisitorMediaState {version:number;updatedAt:string;items:Record<string,VisitorImageAsset>}
export interface VisitorContentState {schemaVersion:number;version:number;updatedAt:string;home:VisitorHomeState;media:VisitorMediaState;themes:VisitorTheme[];placeAssignments:VisitorPlaceAssignment[];contents:VisitorContentUnit[];alerts:VisitorAlert[];history:VisitorHistory[]}

export class VisitorContentError extends Error {constructor(message:string,public statusCode=400){super(message)}}

const statuses=new Set(['draft','published','hidden']);
const levels=new Set(['提示','注意','重要']);
const roles=new Set(['primary','secondary','parking','toilet','navigation','nearby_service','other']);
const now=()=>new Date().toISOString();
const clone=<T>(value:T):T=>structuredClone(value);
const short=(value:unknown)=>JSON.stringify(value).slice(0,500);
const imageTypes=new Map([['image/jpeg','jpg'],['image/png','png'],['image/webp','webp']] as const);

function defaultHomeDocument():VisitorHomeDocument{return {heroImage:null,eyebrow:'一位本地爸爸的沿路笔记',titleLine1:'武夷山',titleLine2:'奶爸地图',introLine1:'我在武夷山生活，',introLine2:'把自己实际走过、愿意推荐的地方放在这里。',mapButtonLabel:'看地图',corridorButtonLabel:'一号风景道',kidsLabel:'适合带孩子',themeCardHint:'看看怎么安排',recommendationsEyebrow:'沿路挑三处',recommendationsTitle:'最近推荐',recommendationsLinkLabel:'查看路线 →',recommendationManshuiTitle:'漫水桥',recommendationManshuiSummary:'河边停一停，先看当天水况',recommendationMoonbayTitle:'月亮湾',recommendationMoonbaySummary:'在整条路线地图中查看位置',recommendationTaoyuanyuTitle:'桃源峪',recommendationTaoyuanyuSummary:'先在自然里找，再去展馆看懂',routesEyebrow:'按时间和同行人安排',routesTitle:'推荐路线',routeFamilyTitle:'带娃怎么玩',routeFamilySummary:'带孩子轻松走，优先选择方便停留的地方',routeDayTitle:'一天怎么玩',routeDaySummary:'用一天串起山水、茶和沿路停留',routeTwoDayTitle:'两天怎么玩',routeTwoDaySummary:'第一天看山水，第二天慢慢走进茶与自然'};}
function normalizeHomeDocument(value:Partial<VisitorHomeDocument>|undefined){return Object.assign(defaultHomeDocument(),value||{});}
function defaultHome(updatedAt:string):VisitorHomeState{const document=defaultHomeDocument();return {version:1,updatedAt,publishedAt:null,draft:clone(document),published:clone(document)};}
export function ensureVisitorHome(state:Partial<VisitorContentState>){const home=state.home||(state.home=defaultHome(state.updatedAt||now()));home.draft=normalizeHomeDocument(home.draft);home.published=normalizeHomeDocument(home.published);return home;}
function defaultMedia(updatedAt:string):VisitorMediaState{return {version:1,updatedAt,items:{}};}
export function ensureVisitorMedia(state:Partial<VisitorContentState>){return state.media||(state.media=defaultMedia(state.updatedAt||now()));}
function validateImage(image:VisitorImageAsset){if(!/^[a-f0-9]{64}\.(jpg|png|webp)$/.test(image.fileName)||!imageTypes.has(image.mimeType))throw new VisitorContentError('游客图片引用无效');}

function required(value:unknown,label:string,max=160){
 if(typeof value!=='string'||!value.trim())throw new VisitorContentError(`${label}不能为空`);
 if(value.trim().length>max)throw new VisitorContentError(`${label}过长`);
}

export function validateVisitorContentState(state:VisitorContentState){
 if(!state||state.schemaVersion!==1||!Number.isInteger(state.version)||state.version<1)throw new VisitorContentError('游客内容备份格式无效');
 const home=ensureVisitorHome(state);if(!Number.isInteger(home.version)||home.version<1)throw new VisitorContentError('首页版本无效');
 for(const image of [home.draft.heroImage,home.published.heroImage])if(image)validateImage(image);
 const media=ensureVisitorMedia(state);if(!Number.isInteger(media.version)||media.version<1)throw new VisitorContentError('游客图片版本无效');for(const [slot,image] of Object.entries(media.items)){if(!/^(home|corridor|theme|place|content)\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(slot))throw new VisitorContentError('游客图片位置无效');validateImage(image);}
 const themeIds=new Set<string>();
 for(const theme of state.themes){required(theme.id,'主题编号',40);required(theme.name,'主题名称',40);if(themeIds.has(theme.id))throw new VisitorContentError(`主题编号重复：${theme.id}`);themeIds.add(theme.id);}
 const assignments=new Map<string,VisitorPlaceAssignment>();
 for(const item of state.placeAssignments){required(item.placeCode,'地点编号',40);if(assignments.has(item.placeCode))throw new VisitorContentError(`游客卡片地点重复：${item.placeCode}`);assignments.set(item.placeCode,item);if(item.themeIds.some(id=>!themeIds.has(id)))throw new VisitorContentError(`${item.placeCode}引用不存在的游客主题`);}
 for(const item of state.placeAssignments)for(const [themeId,parentCode] of Object.entries(item.parentCardByTheme||{})){if(parentCode===item.placeCode)throw new VisitorContentError(`${item.placeCode}不能成为自己的父卡片`);if(!item.themeIds.includes(themeId))throw new VisitorContentError(`${item.placeCode}的父子关系不属于当前主题`);const parent=assignments.get(parentCode);if(!parent?.themeIds.includes(themeId))throw new VisitorContentError(`${item.placeCode}的父卡片不在同一主题`);if(parent.parentCardByTheme?.[themeId])throw new VisitorContentError('父子卡片只允许一层关系');}
 const contentIds=new Set<string>(),slugs=new Set<string>();
 for(const content of state.contents){
  required(content.id,'内容编号',80);if(contentIds.has(content.id))throw new VisitorContentError(`内容编号重复：${content.id}`);contentIds.add(content.id);
  if(!statuses.has(content.status))throw new VisitorContentError(`内容状态无效：${content.status}`);
  for(const [label,doc] of [['草稿',content.draft],['发布版本',content.published]] as const){
   if(!doc)continue;required(doc.internalName,`${label}内部名称`);required(doc.title,`${label}游客标题`);required(doc.slug,`${label}访问路径`,80);
   if(label==='发布版本'&&slugs.has(doc.slug))throw new VisitorContentError(`已发布访问路径重复：${doc.slug}`);if(label==='发布版本')slugs.add(doc.slug);
   if(doc.themeIds.some(id=>!themeIds.has(id)))throw new VisitorContentError(`${doc.title}引用不存在的游客主题`);
   if(doc.navigationTargets.filter(item=>item.isDefault).length>1)throw new VisitorContentError(`${doc.title}存在多个默认导航目标`);
   if(doc.placeLinks.some(item=>!roles.has(item.role)))throw new VisitorContentError(`${doc.title}存在无效地点角色`);
  }
  if(content.status==='published'&&!content.published)throw new VisitorContentError(`${content.draft.title}已发布但缺少发布版本`);
 }
 for(const alert of state.alerts){required(alert.text,'提醒内容',500);if(!levels.has(alert.level))throw new VisitorContentError('提醒级别无效');}
 return state;
}

export function addVisitorHistory(state:VisitorContentState,objectType:string,objectId:string,changeType:string,before:unknown,after:unknown){
 state.history.unshift({id:randomUUID(),at:now(),objectType,objectId,changeType,beforeSummary:short(before),afterSummary:short(after)});
 if(state.history.length>2000)state.history.length=2000;
}

export function visitorAlertIsActive(alert:VisitorAlert,at=new Date()){
 if(!alert.enabled||alert.deletedAt)return false;
 if(alert.startAt&&new Date(alert.startAt)>at)return false;
 if(alert.endAt&&new Date(alert.endAt)<=at)return false;
 return true;
}

export class VisitorContentStore {
 readonly filePath:string;readonly seedPath:string;readonly backupDir:string;readonly mediaDir:string;
 private queue:Promise<unknown>=Promise.resolve();
 constructor(options:{filePath?:string;seedPath?:string;backupDir?:string;mediaDir?:string}={}){
  this.filePath=resolve(options.filePath||process.env.VISITOR_CONTENT_STORE_PATH||'visitor-content-store/data.json');
  this.seedPath=resolve(options.seedPath||'visitor-content-store/seed.json');
  this.backupDir=resolve(options.backupDir||process.env.VISITOR_CONTENT_BACKUP_DIR||'visitor-content-store/backups');
  this.mediaDir=resolve(options.mediaDir||process.env.VISITOR_CONTENT_MEDIA_DIR||'visitor-content-store/media');
 }
 async ensure(){
  await mkdir(dirname(this.filePath),{recursive:true});await mkdir(this.backupDir,{recursive:true});await mkdir(this.mediaDir,{recursive:true});
  try{await readFile(this.filePath,'utf8');}catch{await copyFile(this.seedPath,this.filePath);}
  return this.read();
 }
 async read():Promise<VisitorContentState>{
  const state=JSON.parse(await readFile(this.filePath,'utf8')) as VisitorContentState;
  ensureVisitorHome(state);ensureVisitorMedia(state);
  return validateVisitorContentState(state);
 }
 async saveImage(buffer:Buffer,mimeType:string,originalName:string):Promise<VisitorImageAsset>{
  const extension=imageTypes.get(mimeType as 'image/jpeg'|'image/png'|'image/webp');if(!extension)throw new VisitorContentError('只支持 JPEG、PNG 或 WebP 图片');
  if(!buffer.length||buffer.length>12*1024*1024)throw new VisitorContentError('图片大小必须在 12MB 以内');
  const valid=mimeType==='image/jpeg'&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff
   ||mimeType==='image/png'&&buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))
   ||mimeType==='image/webp'&&buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP';
  if(!valid)throw new VisitorContentError('图片内容与文件类型不匹配');
  await mkdir(this.mediaDir,{recursive:true});const id=createHash('sha256').update(buffer).digest('hex'),fileName=`${id}.${extension}`;
  try{await writeFile(resolve(this.mediaDir,fileName),buffer,{flag:'wx'});}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}
  return {id,fileName,mimeType:mimeType as VisitorImageAsset['mimeType'],originalName:originalName.trim().slice(0,180)||`首页主图.${extension}`,uploadedAt:now()};
 }
 async readImage(fileName:string){if(!/^[a-f0-9]{64}\.(jpg|png|webp)$/.test(fileName))throw new VisitorContentError('图片不存在',404);try{return await readFile(resolve(this.mediaDir,fileName));}catch{throw new VisitorContentError('图片不存在',404);}}
 private async atomicWrite(state:VisitorContentState){
  validateVisitorContentState(state);await mkdir(dirname(this.filePath),{recursive:true});await mkdir(this.backupDir,{recursive:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const backup=resolve(this.backupDir,`${stamp}-v${state.version-1}-${basename(this.filePath)}`);
  try{await copyFile(this.filePath,backup);}catch{/* The first isolated test write may not have a previous file. */}
  const temp=`${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp,JSON.stringify(state,null,2)+'\n',{encoding:'utf8',flag:'wx'});
  await rename(temp,this.filePath);
 }
 async mutate<T>(expectedStoreVersion:number|undefined,change:(draft:VisitorContentState,current:VisitorContentState)=>T|Promise<T>):Promise<{state:VisitorContentState;result:T}>{
  const operation=this.queue.then(async()=>{
   const current=await this.read();
   if(expectedStoreVersion!==undefined&&current.version!==expectedStoreVersion)throw new VisitorContentError('内容已经被更新，请刷新后重新确认。',409);
   const draft=clone(current),result=await change(draft,current);
   draft.version=current.version+1;draft.updatedAt=now();validateVisitorContentState(draft);await this.atomicWrite(draft);
   return {state:draft,result};
  });
  this.queue=operation.catch(()=>undefined);
  return operation;
 }
 async exportBackup(){const state=await this.read();return {filename:`visitor-content-v${state.version}.json`,state};}
 async restore(snapshot:VisitorContentState,expectedStoreVersion:number){
  validateVisitorContentState(snapshot);
  return this.mutate(expectedStoreVersion,(draft,current)=>{
   const restored=clone(snapshot);restored.version=current.version;restored.updatedAt=current.updatedAt;
   Object.assign(draft,restored);addVisitorHistory(draft,'store','visitor-content','restore_backup',{version:current.version},{sourceVersion:snapshot.version});
   return {restoredFromVersion:snapshot.version};
  });
 }
}

export function publicVisitorPresentation(state:VisitorContentState,previewId?:string){
 const home=ensureVisitorHome(state),media=ensureVisitorMedia(state);
 const contents:Array<{id:string;version:number|null;status:string;updatedAt:string|null;document:VisitorContentDocument}>=state.contents.filter(item=>!item.deletedAt&&item.status==='published'&&item.published).map(item=>({id:item.id,version:item.publishedVersion,status:item.status,updatedAt:item.publishedAt,document:clone(item.published!)}));
 if(previewId){const item=state.contents.find(content=>content.id===previewId&&!content.deletedAt);if(item){const index=contents.findIndex(content=>content.id===item.id);const preview={id:item.id,version:item.version,status:'preview',updatedAt:item.updatedAt,document:clone(item.draft)};if(index>=0)contents[index]=preview;else contents.push(preview);}}
 const heroImage=home.published.heroImage?{...clone(home.published.heroImage),url:`/api/local-prototype/media/${home.published.heroImage.fileName}`}:null;
 const publicMedia=Object.fromEntries(Object.entries(media.items).map(([slot,image])=>[slot,{...clone(image),url:`/api/local-prototype/media/${image.fileName}`}])) as Record<string,VisitorImageAsset&{url:string}>;
 const placeAssignments=clone(state.placeAssignments).map(item=>({...item,parentCardByTheme:{}}));
 return {storeVersion:state.version,home:{version:home.version,updatedAt:home.updatedAt,...clone(home.published),heroImage:publicMedia['home.hero']||heroImage},mediaVersion:media.version,media:publicMedia,themes:clone(state.themes).sort((a,b)=>a.sequence-b.sequence),placeAssignments,contents,alerts:state.alerts.filter(alert=>visitorAlertIsActive(alert)).map(clone)};
}

