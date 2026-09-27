import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const now=new Date().toISOString();

function replaceTheme(ids,from,to){return [...new Set(ids.map(id=>id===from?to:id))];}
function migrateOrder(record,from,to){
 const next={...(record||{})};
 if(next[to]===undefined&&next[from]!==undefined)next[to]=next[from];
 delete next[from];return next;
}

function migrateState(state,{recordHistory=false}={}){
 if(!state.themes.some(theme=>theme.id==='tea')&&state.themes.some(theme=>theme.id==='camping'))return state;
 const tea=state.themes.find(theme=>theme.id==='tea');
 const museum=state.themes.find(theme=>theme.id==='museum');
 const food=state.themes.find(theme=>theme.id==='food');
 if(!tea||!museum||!food)throw new Error('Expected tea, museum and food themes before migration.');

 const teaCodes=state.placeAssignments.filter(item=>item.themeIds.includes('tea')).sort((a,b)=>(a.orderByTheme?.tea??99999)-(b.orderByTheme?.tea??99999)).map(item=>item.placeCode);
 const museumCodes=state.placeAssignments.filter(item=>item.themeIds.includes('museum')&&!item.themeIds.includes('tea')).sort((a,b)=>(a.orderByTheme?.museum??99999)-(b.orderByTheme?.museum??99999)).map(item=>item.placeCode);
 const mergedOrder=new Map([...teaCodes,...museumCodes].map((code,index)=>[code,(index+1)*10]));

 state.themes=state.themes.filter(theme=>theme.id!=='tea').map(theme=>{
  if(theme.id==='museum')return {...theme,name:'茶与展馆',icon:'馆',tone:'museum',eyebrow:'从茶到沿路展馆',description:'从茶园、制茶工艺到植物、昆虫与村落展馆，按兴趣慢慢认识武夷山。',sequence:40,version:(theme.version||0)+1,updatedAt:now};
  if(theme.id==='food')return {...theme,name:'吃的',icon:'食',tone:'food',eyebrow:'沿路吃饭与补给',description:'整理沿路吃饭、补给和歇脚的位置，方便按行程就近选择。',sequence:50,version:(theme.version||0)+1,updatedAt:now};
  return theme;
 });
 state.themes.push({id:'camping',name:'床车露营',icon:'营',tone:'camping',eyebrow:'车上过夜与沿路停靠',description:'整理适合床车停靠、过夜和休息的位置，方便按需要筛选。',sequence:60,version:1,updatedAt:now});
 state.themes.sort((a,b)=>a.sequence-b.sequence);

 for(const item of state.placeAssignments){
  const hadTea=item.themeIds.includes('tea');
  if(!hadTea)continue;
  item.themeIds=replaceTheme(item.themeIds,'tea','museum');
  item.orderByTheme=migrateOrder(item.orderByTheme,'tea','museum');
  item.titleByTheme=migrateOrder(item.titleByTheme,'tea','museum');
  item.summaryByTheme=migrateOrder(item.summaryByTheme,'tea','museum');
  item.parentCardByTheme=migrateOrder(item.parentCardByTheme,'tea','museum');
  item.version=(item.version||0)+1;item.updatedAt=now;
 }
 for(const item of state.placeAssignments)if(mergedOrder.has(item.placeCode)&&item.themeIds.includes('museum')){
  const order=mergedOrder.get(item.placeCode);if(item.orderByTheme?.museum===order)continue;
  const alreadyMigrated=teaCodes.includes(item.placeCode);item.orderByTheme={...item.orderByTheme,museum:order};
  if(!alreadyMigrated){item.version=(item.version||0)+1;item.updatedAt=now;}
 }

 for(const content of state.contents){
  let changed=false;
  for(const key of ['draft','published']){
   const document=content[key];if(!document?.themeIds?.includes('tea'))continue;
   document.themeIds=replaceTheme(document.themeIds,'tea','museum');
   document.themeOrder=migrateOrder(document.themeOrder,'tea','museum');changed=true;
  }
  if(changed){content.version=(content.version||0)+1;content.updatedAt=now;if(content.status==='published'){content.publishedVersion=content.version;content.publishedAt=now;}}
 }

 if(state.media?.items?.['theme.tea.hero']){
  if(!state.media.items['theme.museum.hero'])state.media.items['theme.museum.hero']=state.media.items['theme.tea.hero'];
  delete state.media.items['theme.tea.hero'];state.media.version=(state.media.version||0)+1;state.media.updatedAt=now;
 }
 state.version=(state.version||0)+1;state.updatedAt=now;
 if(recordHistory)state.history.push({id:`hist-${randomUUID()}`,at:now,objectType:'store',objectId:'visitor-content',changeType:'theme_taxonomy_migration',beforeSummary:'茶、展馆、吃与床车露营三个主题',afterSummary:'茶与展馆、吃的、床车露营三个主题'});
 return state;
}

const dataPath=resolve(root,'visitor-content-store/data.json');
const seedPath=resolve(root,'visitor-content-store/seed.json');
const stamp=now.replace(/[:.]/g,'-');
await mkdir(resolve(root,'visitor-content-store/backups'),{recursive:true});
await copyFile(dataPath,resolve(root,`visitor-content-store/backups/pre-theme-taxonomy-${stamp}.json`));
for(const [path,recordHistory] of [[dataPath,true],[seedPath,false]]){
 const state=JSON.parse(await readFile(path,'utf8'));
 await writeFile(path,JSON.stringify(migrateState(state,{recordHistory}),null,2)+'\n','utf8');
}
console.log('Theme taxonomy migrated: museum=茶与展馆, food=吃的, camping=床车露营.');
