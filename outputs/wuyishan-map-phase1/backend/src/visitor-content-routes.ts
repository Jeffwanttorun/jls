import {randomUUID} from 'node:crypto';
import type {FastifyInstance} from 'fastify';
import type {Pool} from 'pg';
import {VisitorContentError,VisitorContentStore,addVisitorHistory,ensureVisitorHome,ensureVisitorMedia,type VisitorAlert,type VisitorContentDocument,type VisitorContentState,type VisitorContentUnit} from '../../shared/visitor-content.js';

const now=()=>new Date().toISOString();

async function placeCatalog(db:Pool){
 return (await db.query(`SELECT p.code,p.name,p.place_type::text place_type,p.current_status status,p.deleted_at,p.duplicate_of_place_id,
  EXISTS(SELECT 1 FROM confirmed_place_coordinates c WHERE c.place_id=p.id) has_coordinate,
  COALESCE((SELECT array_agg(DISTINCT old_name ORDER BY old_name) FROM place_name_history h WHERE h.place_id=p.id),'{}') old_names
  FROM places p ORDER BY p.corridor_order ASC NULLS LAST,p.code`)).rows;
}

function contentDocument(value:any):VisitorContentDocument{
 if(!value||typeof value!=='object')throw new VisitorContentError('游客内容格式无效');
 const document=structuredClone(value) as VisitorContentDocument;document.themeOrder||={};return document;
}

function findContent(state:VisitorContentState,id:string){
 const item=state.contents.find(content=>content.id===id);
 if(!item)throw new VisitorContentError('游客内容不存在',404);
 return item;
}

function checkEntityVersion(item:{version:number},expected:unknown){
 if(!Number.isInteger(expected)||item.version!==expected)throw new VisitorContentError('内容已经被更新，请刷新后重新确认。',409);
}

async function validateNavigation(db:Pool,document:VisitorContentDocument,required=false){
 const targets=document.navigationTargets||[];
 if(targets.filter(item=>item.isDefault).length>1)throw new VisitorContentError('只能设置一个默认导航目标');
 if(required&&!targets.some(item=>item.isDefault))throw new VisitorContentError('发布前必须设置默认导航目标');
 if(!targets.length)return;
 const codes=[...new Set(targets.map(item=>item.placeCode))];
 const rows=(await db.query(`SELECT p.code,p.deleted_at,p.duplicate_of_place_id,EXISTS(SELECT 1 FROM confirmed_place_coordinates c WHERE c.place_id=p.id) has_coordinate FROM places p WHERE p.code=ANY($1)`,[codes])).rows;
 const byCode=new Map(rows.map(row=>[row.code,row]));
 for(const code of codes){const place=byCode.get(code);if(!place||place.deleted_at||place.duplicate_of_place_id)throw new VisitorContentError(`导航目标 ${code} 不是有效地点`);if(!place.has_coordinate)throw new VisitorContentError(`导航目标 ${code} 没有当前正式坐标`);}
}

function issuesFor(state:VisitorContentState,places:any[]){
 const byCode=new Map(places.map(place=>[place.code,place])),issues:any[]=[];
 for(const content of state.contents.filter(item=>!item.deletedAt)){
  const doc=content.draft;
  const push=(kind:string,message:string,section:string)=>issues.push({id:`${content.id}-${kind}`,kind,message,contentId:content.id,title:doc.title,href:`/visitor-content/${content.id}#${section}`});
  if(content.status==='published'&&!doc.themeIds.length)push('no-theme','已发布但没有游客主题','themes');
  if(content.status==='published'&&!doc.navigationTargets.some(item=>item.isDefault))push('no-navigation','已发布但没有默认导航','arrival');
  if(!doc.placeLinks.length)push('no-places','内容单元没有组成地点','arrival');
  for(const link of doc.placeLinks){const place=byCode.get(link.placeCode);if(!place)push('missing-place',`组成地点 ${link.placeCode} 不存在`,'arrival');else if(place.deleted_at)push('deleted-place',`引用了回收站地点 ${place.name}`,'arrival');else if(place.duplicate_of_place_id)push('duplicate-place',`引用了重复地点档案 ${place.name}`,'arrival');}
  for(const target of doc.navigationTargets){const place=byCode.get(target.placeCode);if(!place||place.deleted_at||place.duplicate_of_place_id)push('invalid-navigation',`导航目标 ${target.placeCode} 已失效`,'arrival');else if(!place.has_coordinate)push('navigation-no-coordinate',`导航目标 ${place.name} 没有当前正式坐标`,'arrival');}
  const construction=doc.placeLinks.map(link=>byCode.get(link.placeCode)).filter(place=>place?.status==='在建');
  if(content.status==='published'&&construction.length){const alertTexts=state.alerts.filter(alert=>!alert.deletedAt&&alert.enabled&&(alert.contentIds.includes(content.id)||alert.placeCodes.some(code=>construction.some(place=>place.code===code)))).map(alert=>alert.text).join(' ');if(!/在建|未开放|施工/.test(alertTexts))push('construction-no-alert','关联在建地点但没有明确在建提醒','alerts');}
 }
 return issues;
}

export function registerVisitorContentRoutes(app:FastifyInstance,db:Pool,store=new VisitorContentStore()){
 app.addContentTypeParser(/^image\/(?:jpeg|png|webp)$/i,{parseAs:'buffer',bodyLimit:12*1024*1024},(_req,body,done)=>done(null,body));
 app.addHook('onReady',async()=>{await store.ensure();});
 app.get('/api/admin/visitor-content/state',async()=>{const [state,places]=await Promise.all([store.read(),placeCatalog(db)]);return {state,places,issues:issuesFor(state,places)};});
 app.get('/api/admin/visitor-content/media/:fileName',async(req,reply)=>{const fileName=String((req.params as any).fileName),extension=fileName.split('.').pop(),type=extension==='png'?'image/png':extension==='webp'?'image/webp':'image/jpeg';return reply.type(type).send(await store.readImage(fileName));});
 app.post('/api/admin/visitor-content/visual-media/:slot',async req=>{
  const slot=decodeURIComponent(String((req.params as any).slot||''));if(!/^(home|corridor|theme|place|content)\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(slot))throw new VisitorContentError('图片位置无效');
  const expected=Number(req.headers['x-media-version']);if(!Number.isInteger(expected))throw new VisitorContentError('图片版本无效');
  const mimeType=String(req.headers['content-type']||'').split(';')[0].toLowerCase(),encoded=String(req.headers['x-original-name']||'');let originalName='游客图片';try{originalName=decodeURIComponent(encoded)||originalName;}catch{/* Use the safe fallback name. */}
  const image=await store.saveImage(req.body as Buffer,mimeType,originalName);
  const result=await store.mutate(undefined,draft=>{const media=ensureVisitorMedia(draft);checkEntityVersion(media,expected);const before=media.items[slot]||null;media.items[slot]=image;media.version++;media.updatedAt=now();addVisitorHistory(draft,'visual_media',slot,'replace_and_publish',before,image);return media;});
  return {media:result.result,storeVersion:result.state.version};
 });
 app.post('/api/admin/visitor-content/visual-media/:slot/remove',async req=>{const slot=decodeURIComponent(String((req.params as any).slot||'')),body=req.body as any;const result=await store.mutate(undefined,draft=>{const media=ensureVisitorMedia(draft);checkEntityVersion(media,body.expected_version);const before=media.items[slot]||null;delete media.items[slot];media.version++;media.updatedAt=now();addVisitorHistory(draft,'visual_media',slot,'remove_and_publish',before,null);return media;});return {media:result.result,storeVersion:result.state.version};});

 app.post('/api/admin/visitor-content/home/image',async req=>{
  const expected=Number(req.headers['x-home-version']);if(!Number.isInteger(expected))throw new VisitorContentError('首页版本无效');
  const mimeType=String(req.headers['content-type']||'').split(';')[0].toLowerCase(),encoded=String(req.headers['x-original-name']||'');let originalName='首页主图';try{originalName=decodeURIComponent(encoded)||originalName;}catch{/* Use the safe fallback name. */}
  const image=await store.saveImage(req.body as Buffer,mimeType,originalName);
  const result=await store.mutate(undefined,draft=>{const home=ensureVisitorHome(draft);checkEntityVersion(home,expected);const before=home.draft.heroImage;home.draft.heroImage=image;home.version++;home.updatedAt=now();addVisitorHistory(draft,'home','visitor-home','save_hero_draft',before,image);return home;});
  return {home:result.result,storeVersion:result.state.version};
 });
 app.post('/api/admin/visitor-content/home/remove-image',async req=>{const body=req.body as any;const result=await store.mutate(undefined,draft=>{const home=ensureVisitorHome(draft);checkEntityVersion(home,body.expected_version);const before=home.draft.heroImage;home.draft.heroImage=null;home.version++;home.updatedAt=now();addVisitorHistory(draft,'home','visitor-home','remove_hero_draft',before,null);return home;});return {home:result.result,storeVersion:result.state.version};});
 app.post('/api/admin/visitor-content/home/publish',async req=>{const body=req.body as any;const result=await store.mutate(undefined,draft=>{const home=ensureVisitorHome(draft);checkEntityVersion(home,body.expected_version);const before=home.published.heroImage;home.published=structuredClone(home.draft);home.version++;home.updatedAt=now();home.publishedAt=home.updatedAt;addVisitorHistory(draft,'home','visitor-home','publish',before,home.published.heroImage);return home;});return {home:result.result,storeVersion:result.state.version};});
 app.post('/api/admin/visitor-content/home/text',async req=>{const body=req.body as any,fields=['eyebrow','titleLine1','titleLine2','introLine1','introLine2','mapButtonLabel','corridorButtonLabel','kidsLabel','themeCardHint','recommendationsEyebrow','recommendationsTitle','recommendationsLinkLabel','recommendationManshuiTitle','recommendationManshuiSummary','recommendationMoonbayTitle','recommendationMoonbaySummary','recommendationTaoyuanyuTitle','recommendationTaoyuanyuSummary','routesEyebrow','routesTitle','routeFamilyTitle','routeFamilySummary','routeDayTitle','routeDaySummary','routeTwoDayTitle','routeTwoDaySummary'] as const;const result=await store.mutate(undefined,draft=>{const home=ensureVisitorHome(draft);checkEntityVersion(home,body.expected_version);const before=Object.fromEntries(fields.map(field=>[field,home.published[field]]));for(const field of fields){const value=String(body[field]??'').trim();if(!value)throw new VisitorContentError('首页文字不能为空');home.draft[field]=value;home.published[field]=value;}home.version++;home.updatedAt=now();home.publishedAt=home.updatedAt;addVisitorHistory(draft,'home','visitor-home','quick_text_update',before,Object.fromEntries(fields.map(field=>[field,home.published[field]])));return home;});return {home:result.result,storeVersion:result.state.version};});

 app.post('/api/admin/visitor-content/theme-presentation',async req=>{const body=req.body as any,id=String(body.theme_id||'');const result=await store.mutate(undefined,draft=>{const theme=draft.themes.find(item=>item.id===id);if(!theme)throw new VisitorContentError('游客主题不存在');checkEntityVersion(theme,body.expected_version);const before={name:theme.name,icon:theme.icon,eyebrow:theme.eyebrow,description:theme.description};const name=String(body.name||'').trim(),icon=String(body.icon||'').trim(),eyebrow=String(body.eyebrow||'').trim(),description=String(body.description||'').trim();if(!name||!icon||!eyebrow||!description)throw new VisitorContentError('主题文字不能为空');Object.assign(theme,{name,icon,eyebrow,description,version:theme.version+1,updatedAt:now()});addVisitorHistory(draft,'theme',id,'quick_text_update',before,{name,icon,eyebrow,description});return theme;});return {item:result.result,storeVersion:result.state.version};});

 app.post('/api/admin/visitor-content/create',async req=>{
  const body=req.body as any,document=contentDocument(body.document);
  await validateNavigation(db,document,false);
  const result=await store.mutate(body.expected_store_version,(draft,current)=>{
   if(draft.contents.some(item=>!item.deletedAt&&(item.draft.slug===document.slug||item.published?.slug===document.slug)))throw new VisitorContentError('访问路径已经存在');
   const at=now(),item:VisitorContentUnit={id:randomUUID(),version:1,status:'draft',deletedAt:null,previousStatus:null,updatedAt:at,publishedAt:null,publishedVersion:null,draft:document,published:null};
   draft.contents.unshift(item);addVisitorHistory(draft,'content',item.id,'create',null,{title:document.title,status:'draft'});return item;
  });return {item:result.result,storeVersion:result.state.version};
 });

 app.post('/api/admin/visitor-content/:id/save',async req=>{
  const body=req.body as any,id=(req.params as any).id,document=contentDocument(body.document);await validateNavigation(db,document,false);
  const result=await store.mutate(undefined,draft=>{const item=findContent(draft,id);checkEntityVersion(item,body.expected_version);const before=item.draft;item.draft=document;item.version++;item.updatedAt=now();addVisitorHistory(draft,'content',id,'save_draft',{title:before.title,summary:before.summary,themes:before.themeIds},{title:document.title,summary:document.summary,themes:document.themeIds});return item;});
  return {item:result.result,storeVersion:result.state.version};
 });

 app.post('/api/admin/visitor-content/:id/publish',async req=>{
  const body=req.body as any,id=(req.params as any).id;
  const current=findContent(await store.read(),id);checkEntityVersion(current,body.expected_version);await validateNavigation(db,current.draft,true);
  if(!current.draft.themeIds.length)throw new VisitorContentError('发布前至少选择一个游客主题');if(!current.draft.placeLinks.length)throw new VisitorContentError('发布前至少关联一个组成地点');
  const result=await store.mutate(undefined,draft=>{const item=findContent(draft,id);checkEntityVersion(item,body.expected_version);const before={status:item.status,publishedVersion:item.publishedVersion};item.version++;item.status='published';item.published=structuredClone(item.draft);item.publishedVersion=item.version;item.publishedAt=now();item.updatedAt=item.publishedAt;addVisitorHistory(draft,'content',id,'publish',before,{status:item.status,publishedVersion:item.publishedVersion});return item;});
  return {item:result.result,storeVersion:result.state.version};
 });

 app.post('/api/admin/visitor-content/:id/hide',async req=>{
  const body=req.body as any,id=(req.params as any).id;const result=await store.mutate(undefined,draft=>{const item=findContent(draft,id);checkEntityVersion(item,body.expected_version);const before=item.status;item.version++;item.status='hidden';item.updatedAt=now();addVisitorHistory(draft,'content',id,'hide',before,item.status);return item;});return {item:result.result,storeVersion:result.state.version};
 });

 app.post('/api/admin/visitor-content/:id/copy',async req=>{
  const body=req.body as any,id=(req.params as any).id;const result=await store.mutate(body.expected_store_version,draft=>{const source=findContent(draft,id),at=now(),doc=structuredClone(source.draft);doc.internalName+= '（副本）';doc.title+='（副本）';doc.slug=`${doc.slug}-copy-${Date.now().toString().slice(-6)}`;const item:VisitorContentUnit={id:randomUUID(),version:1,status:'draft',deletedAt:null,previousStatus:null,updatedAt:at,publishedAt:null,publishedVersion:null,draft:doc,published:null};draft.contents.unshift(item);addVisitorHistory(draft,'content',item.id,'copy',{sourceId:id},{title:doc.title});return item;});return {item:result.result,storeVersion:result.state.version};
 });

 app.post('/api/admin/visitor-content/:id/delete',async req=>{const body=req.body as any,id=(req.params as any).id;const result=await store.mutate(undefined,draft=>{const item=findContent(draft,id);checkEntityVersion(item,body.expected_version);item.previousStatus=item.status;item.status='hidden';item.deletedAt=now();item.version++;item.updatedAt=item.deletedAt;addVisitorHistory(draft,'content',id,'move_to_recycle',null,{deletedAt:item.deletedAt});return item;});return {item:result.result,storeVersion:result.state.version};});
 app.post('/api/admin/visitor-content/:id/restore',async req=>{const body=req.body as any,id=(req.params as any).id;const result=await store.mutate(undefined,draft=>{const item=findContent(draft,id);checkEntityVersion(item,body.expected_version);item.deletedAt=null;item.status=item.previousStatus||'draft';item.previousStatus=null;item.version++;item.updatedAt=now();addVisitorHistory(draft,'content',id,'restore',null,{status:item.status});return item;});return {item:result.result,storeVersion:result.state.version};});

 app.post('/api/admin/visitor-content/place-themes',async req=>{
  const body=req.body as any,places=await placeCatalog(db),place=places.find(item=>item.code===body.place_code);
  if(!place||place.deleted_at||place.duplicate_of_place_id)throw new VisitorContentError('只能维护正常地点的游客主题');
  if(body.parent_card_by_theme&&Object.values(body.parent_card_by_theme).some(value=>String(value||'').trim()))throw new VisitorContentError('父子卡片功能已取消');
   const result=await store.mutate(undefined,draft=>{
    let item=draft.placeAssignments.find(row=>row.placeCode===body.place_code);
    if(!item){item={placeCode:body.place_code,version:0,themeIds:[],familyFriendly:false,facilities:{toilet:false,shop:false,restaurant:false,lodging:false},parentCardByTheme:{},orderByTheme:{},titleByTheme:{},summaryByTheme:{},updatedAt:now()};draft.placeAssignments.push(item);}
    checkEntityVersion(item,body.expected_version);
    const before={themes:item.themeIds,familyFriendly:item.familyFriendly,facilities:item.facilities,parentCardByTheme:item.parentCardByTheme,titleByTheme:item.titleByTheme,summaryByTheme:item.summaryByTheme};
    item.themeIds=[...new Set<string>((body.theme_ids||[]) as string[])];item.familyFriendly=Boolean(body.family_friendly);
    if(body.facilities&&typeof body.facilities==='object')item.facilities={toilet:Boolean(body.facilities.toilet),shop:Boolean(body.facilities.shop),restaurant:Boolean(body.facilities.restaurant),lodging:Boolean(body.facilities.lodging)};
    if(body.title_by_theme&&typeof body.title_by_theme==='object')item.titleByTheme=Object.fromEntries(draft.themes.map(theme=>[theme.id,String(body.title_by_theme[theme.id]||'').trim()]).filter(([,value])=>value));
    if(body.summary_by_theme&&typeof body.summary_by_theme==='object')item.summaryByTheme=Object.fromEntries(draft.themes.map(theme=>[theme.id,String(body.summary_by_theme[theme.id]||'').trim()]).filter(([,value])=>value));
    item.orderByTheme=Object.fromEntries(Object.entries(item.orderByTheme).filter(([themeId])=>item!.themeIds.includes(themeId)));
    item.titleByTheme=Object.fromEntries(Object.entries(item.titleByTheme).filter(([themeId])=>item!.themeIds.includes(themeId)));
    item.summaryByTheme=Object.fromEntries(Object.entries(item.summaryByTheme).filter(([themeId])=>item!.themeIds.includes(themeId)));
    item.parentCardByTheme={};
    for(const row of draft.placeAssignments){if(row===item||!Object.keys(row.parentCardByTheme||{}).length)continue;const previous=structuredClone(row.parentCardByTheme);row.parentCardByTheme={};row.version++;row.updatedAt=now();addVisitorHistory(draft,'place_theme',row.placeCode,'remove_parent_card_feature',previous,{});}
    item.version++;item.updatedAt=now();addVisitorHistory(draft,'place_theme',item.placeCode,'update',before,{themes:item.themeIds,familyFriendly:item.familyFriendly,facilities:item.facilities,parentCardByTheme:item.parentCardByTheme,titleByTheme:item.titleByTheme,summaryByTheme:item.summaryByTheme});return item;
   });return {item:result.result,storeVersion:result.state.version};
 });

 app.post('/api/admin/visitor-content/content-presentation',async req=>{
  const body=req.body as any,id=String(body.content_id||''),themeIds=[...new Set<string>((body.theme_ids||[]) as string[])];
  const result=await store.mutate(undefined,draft=>{const item=findContent(draft,id);checkEntityVersion(item,body.expected_version);const validThemes=new Set(draft.themes.map(theme=>theme.id));if(themeIds.some(theme=>!validThemes.has(theme)))throw new VisitorContentError('游客主题不存在');const before={title:item.draft.title,summary:item.draft.summary,themes:item.draft.themeIds,familyFriendly:item.draft.familyFriendly};if(typeof body.title==='string'){const title=body.title.trim();if(!title)throw new VisitorContentError('卡片标题不能为空');item.draft.title=title;}if(typeof body.summary==='string')item.draft.summary=body.summary.trim();item.draft.themeIds=themeIds;item.draft.familyFriendly=Boolean(body.family_friendly);if(item.status==='published'&&item.published){item.published.title=item.draft.title;item.published.summary=item.draft.summary;item.published.themeIds=[...themeIds];item.published.familyFriendly=item.draft.familyFriendly;}item.version++;item.updatedAt=now();if(item.status==='published'){item.publishedVersion=item.version;item.publishedAt=item.updatedAt;}addVisitorHistory(draft,'content',id,'quick_presentation_update',before,{title:item.draft.title,summary:item.draft.summary,themes:item.draft.themeIds,familyFriendly:item.draft.familyFriendly});return item;});return {item:result.result,storeVersion:result.state.version};
 });

 app.post('/api/admin/visitor-content/quick-create',async req=>{
  const body=req.body as any,title=String(body.title||'').trim(),summary=String(body.summary||'').trim(),placeCode=String(body.place_code||''),themeIds=[...new Set<string>((body.theme_ids||[]) as string[])];
  if(!title)throw new VisitorContentError('卡片标题不能为空');if(!placeCode)throw new VisitorContentError('请选择卡片对应的地点');if(!themeIds.length)throw new VisitorContentError('请至少选择一个主题');
  const document:VisitorContentDocument={internalName:title,slug:`card-${Date.now().toString(36)}`,title,summary,themeIds,themeOrder:{},familyFriendly:Boolean(body.family_friendly),placeLinks:[{placeCode,role:'primary',sequence:10}],navigationTargets:[{placeCode,label:'导航',sequence:10,isDefault:true}],alertIds:[],modules:[],presentation:{kind:String(body.kind||'outdoor'),eyebrow:'',cover:'沿路真实画面',tags:[],corridorAnchor:9999,nearbyCodes:[],arrivalNotes:{},dadTip:'',videoLabel:'真实画面',mediaText:'真实素材稍后补充。'}};
  await validateNavigation(db,document,true);
  const result=await store.mutate(body.expected_store_version,(draft)=>{const validThemes=new Set(draft.themes.map(theme=>theme.id));if(themeIds.some(theme=>!validThemes.has(theme)))throw new VisitorContentError('游客主题不存在');const at=now(),item:VisitorContentUnit={id:randomUUID(),version:1,status:'published',deletedAt:null,previousStatus:null,updatedAt:at,publishedAt:at,publishedVersion:1,draft:document,published:structuredClone(document)};draft.contents.unshift(item);addVisitorHistory(draft,'content',item.id,'quick_create_and_publish',null,{title,placeCode,themes:themeIds});return item;});
  return {item:result.result,storeVersion:result.state.version};
 });

 app.post('/api/admin/visitor-content/themes/batch',async req=>{
  const body=req.body as any,themeId=String(body.theme_id||''),selectedPlaces=new Set<string>(body.place_codes||[]),selectedContents=new Set<string>(body.content_ids||[]),catalog=await placeCatalog(db),validPlaces=new Set(catalog.filter(item=>!item.deleted_at&&!item.duplicate_of_place_id).map(item=>item.code));
  if([...selectedPlaces].some(code=>!validPlaces.has(code)))throw new VisitorContentError('批量选择包含回收站或无效地点');
   const result=await store.mutate(body.expected_store_version,draft=>{if(!draft.themes.some(theme=>theme.id===themeId))throw new VisitorContentError('游客主题不存在');for(const code of validPlaces){let item=draft.placeAssignments.find(row=>row.placeCode===code);if(!item&&selectedPlaces.has(code)){item={placeCode:code,version:0,themeIds:[],familyFriendly:false,facilities:{toilet:false,shop:false,restaurant:false,lodging:false},parentCardByTheme:{},orderByTheme:{},titleByTheme:{},summaryByTheme:{},updatedAt:now()};draft.placeAssignments.push(item);}if(!item)continue;const has=item.themeIds.includes(themeId),want=selectedPlaces.has(code);if(has!==want){item.themeIds=want?[...item.themeIds,themeId]:item.themeIds.filter(id=>id!==themeId);if(!want&&item.parentCardByTheme)delete item.parentCardByTheme[themeId];item.version++;item.updatedAt=now();}}
    for(const item of draft.placeAssignments){const parent=item.parentCardByTheme?.[themeId];if(parent&&!selectedPlaces.has(parent)){delete item.parentCardByTheme![themeId];item.version++;item.updatedAt=now();}}
   for(const content of draft.contents.filter(item=>!item.deletedAt)){const has=content.draft.themeIds.includes(themeId),want=selectedContents.has(content.id);if(has!==want){content.draft.themeIds=want?[...content.draft.themeIds,themeId]:content.draft.themeIds.filter(id=>id!==themeId);content.version++;content.updatedAt=now();}}
   addVisitorHistory(draft,'theme',themeId,'batch_update',{},{placeCount:selectedPlaces.size,contentCount:selectedContents.size});return {themeId,placeCount:selectedPlaces.size,contentCount:selectedContents.size};});return {...result.result,storeVersion:result.state.version};
 });

 app.post('/api/admin/visitor-content/alerts/save',async req=>{
  const body=req.body as any,at=now();const result=await store.mutate(undefined,draft=>{let alert:VisitorAlert|undefined=body.id?draft.alerts.find(item=>item.id===body.id):undefined;const placeCodes=[...new Set<string>((body.place_codes||[]) as string[])],contentIds=[...new Set<string>((body.content_ids||[]) as string[])];if(alert){checkEntityVersion(alert,body.expected_version);const before=structuredClone(alert);Object.assign(alert,{text:String(body.text||'').trim(),level:body.level,enabled:Boolean(body.enabled),startAt:body.start_at||null,endAt:body.end_at||null,placeCodes,contentIds,updatedAt:at});alert.version++;addVisitorHistory(draft,'alert',alert.id,'update',before,alert);}else{alert={id:randomUUID(),version:1,text:String(body.text||'').trim(),level:body.level,enabled:Boolean(body.enabled),startAt:body.start_at||null,endAt:body.end_at||null,placeCodes,contentIds,deletedAt:null,updatedAt:at};draft.alerts.unshift(alert);addVisitorHistory(draft,'alert',alert.id,'create',null,alert);}return alert!;});return {item:result.result,storeVersion:result.state.version};
 });
 app.post('/api/admin/visitor-content/alerts/:id/toggle',async req=>{const body=req.body as any,id=(req.params as any).id;const result=await store.mutate(undefined,draft=>{const alert=draft.alerts.find(item=>item.id===id);if(!alert)throw new VisitorContentError('现场提醒不存在',404);checkEntityVersion(alert,body.expected_version);const before=alert.enabled;alert.enabled=Boolean(body.enabled);alert.version++;alert.updatedAt=now();addVisitorHistory(draft,'alert',id,'toggle',before,alert.enabled);return alert;});return {item:result.result,storeVersion:result.state.version};});

 app.get('/api/admin/visitor-content/backup',async()=>store.exportBackup());
 app.post('/api/admin/visitor-content/restore',async req=>{const body=req.body as any;const result=await store.restore(body.state,body.expected_store_version);return {storeVersion:result.state.version,...result.result};});
}


