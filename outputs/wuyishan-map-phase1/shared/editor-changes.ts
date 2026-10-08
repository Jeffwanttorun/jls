// JSON documents: arrays are reviewed as a unit so concurrent reorderings are never silently merged.
export interface EditorChange {path:string[];base:unknown;mine:unknown;latest:unknown;mineChanged:boolean;latestChanged:boolean;contested:boolean;selected:boolean}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const object=(v:any)=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function editorChanges(base:any,mine:any,latest:any,path:string[]=[]):EditorChange[]{
 if(object(base)&&object(mine)&&object(latest))return [...new Set([...Object.keys(base),...Object.keys(mine),...Object.keys(latest)])].flatMap(k=>editorChanges(base[k],mine[k],latest[k],[...path,k]));
 const mineChanged=!same(base,mine),latestChanged=!same(base,latest);if(!mineChanged&&!latestChanged)return [];
 const contested=mineChanged&&latestChanged&&!same(mine,latest);return [{path,base,mine,latest,mineChanged,latestChanged,contested,selected:mineChanged&&!contested}];
}
export function applyEditorChanges(latest:any,rows:EditorChange[]){let result=JSON.parse(JSON.stringify(latest));for(const row of rows.filter(r=>r.mineChanged&&r.selected)){const v=row.mine===undefined?undefined:JSON.parse(JSON.stringify(row.mine));if(!row.path.length){result=v;continue;}let target=result;for(const key of row.path.slice(0,-1))target=target[key]??={};const key=row.path.at(-1)!;if(v===undefined)delete target[key];else target[key]=v;}return result;}
export function editorField(path:string[]){const labels:Record<string,string>={name:'名称',summary:'简介',whyStop:'为什么值得停',address:'地址',region:'区域',zh:'中文',en:'英文',photos:'照片及说明',themeIds:'兴趣主题',stages:'阶段与分组',memberships:'地点路线关联',openingSchedule:'开放安排',publicStatus:'运营状态',coordinates:'坐标',latitude:'纬度',longitude:'经度',brand:'品牌',contactEmail:'联系邮箱',footerNote:'页脚说明',published:'公开状态',firsthandNotes:'实地记录',practicalInfo:'实用信息',safetyNotes:'安全提示',order:'顺序'};return path.length?path.map(k=>labels[k]||k).join(' · '):'全部编辑内容';}
