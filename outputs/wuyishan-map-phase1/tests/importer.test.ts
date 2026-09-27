import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize,validateRows,emptySnapshot,parseDate,preview,type ImportRow } from '../backend/src/importer.js';
import { publicPlace,freshness } from '../shared/domain.js';
const row=(raw:Record<string,unknown>,sheet='地点库'):ImportRow=>{const r:ImportRow={sheet,row:2,code:'',raw,data:{},issues:[],action:'insert'};normalize(r);return r;};
const place=(extra:Record<string,unknown>={})=>row({'地点ID':'WY-9001','名称':'测试地点','点位层级':'主地点','一级分类':'展馆','公开等级':'P1','当前状态':'正常','优先级':'高',...extra});
const valid=(rows:ImportRow[])=>{const s=emptySnapshot();s.categories=['展馆'];validateRows(rows,s);};
test('真实 V1.2 读取：46 地点、4 路线、10 攻略，无错误且不伪造坐标',async()=>{
 const p=await preview('sources/武夷山奶爸地图_主数据库_V1.2.xlsx');
 assert.equal(p.summary.ready,93);assert.equal(p.summary.failed,0);assert.deepEqual(p.sheetIssues,[]);
 assert.equal(p.rows.filter(r=>r.sheet==='地点库').length,46);
 assert.equal(p.rows.find(r=>r.code==='R-0004')!.data.stops instanceof Array,true);
 assert.equal((p.rows.find(r=>r.code==='R-0004')!.data.stops as unknown[]).length,0);
 assert(p.rows.filter(r=>r.sheet==='地点库').every(r=>r.data.coordinate===null));
});
test('缺字段和非法枚举逐行报错，正常行仍可导入',()=>{
 const rows=[place(),place({'地点ID':'WY-9002','名称':'','公开等级':'P9'}),place({'地点ID':'WY-9003','当前状态':'营业中'})];valid(rows);
 assert.deepEqual(rows.map(r=>r.action),['insert','error','error']);
});
test('业务编号重复：冲突两行都拒绝；业务编号不自动改写',()=>{const a=place(),b=place();valid([a,b]);assert.equal(a.action,'error');assert.equal(b.action,'error');const x=place({'地点ID':'wy-1'});valid([x]);assert.equal(x.action,'error');});
test('已有编号跳过，源表名称变化也不更新',()=>{const p=place({'名称':'试图覆盖'}),s=emptySnapshot();s.categories=['展馆'];s.places['WY-9001']=null;validateRows([p],s);assert.equal(p.action,'skip');});
test('不存在父地点及父子循环均拒绝',()=>{const a=place({'上级地点ID':'WY-9999'});valid([a]);assert.equal(a.action,'error');const b=place({'上级地点ID':'WY-9002'}),c=place({'地点ID':'WY-9002','上级地点ID':'WY-9001'});valid([b,c]);assert.equal(b.action,'error');assert.equal(c.action,'error');});
test('父行在后仍合法，父行无效则子行无效',()=>{const child=place({'地点ID':'WY-9002','上级地点ID':'WY-9001'}),parent=place();valid([child,parent]);assert.equal(child.action,'insert');const bad=place({'名称':''}),child2=place({'地点ID':'WY-9002','上级地点ID':'WY-9001'});valid([child2,bad]);assert.equal(child2.action,'error');});
test('路线不存在引用拒绝；时长必须明确单位，km 转 m',()=>{
 const r=row({'路线ID':'R-9001','路线名称':'测试线','路线类型':'候选路线','状态':'待核实','地点序列（地点ID）':'WY-9999','预计总时长':'2小时','驾驶时长':'30分钟','步行距离km':1.2},'路线库');valid([r]);assert.equal(r.action,'error');assert.equal(r.data.total_duration_min,120);assert.equal(r.data.estimated_walking_m,1200);
 const x=row({'路线ID':'R-9002','路线名称':'测试','路线类型':'候选路线','状态':'正常','预计总时长':2},'路线库');assert(x.issues.some(i=>i.field==='预计总时长'));
});
test('时间严格解析、闰年和上海时区',()=>{assert.equal(parseDate('2024-02-29',true),'2024-02-29');assert.equal(parseDate('2026-09-05 10:30'),'2026-09-05T02:30:00.000Z');assert.equal(parseDate('2026-09-05T10:30:00Z'),'2026-09-05T10:30:00.000Z');for(const d of ['2025-02-29','2026-13-01','2026-09-05 25:00','09/05/26','昨天','2026-09-05T10:30:00+99:00'])assert.throws(()=>parseDate(d));});
test('新鲜度边界为 90/91/180/181 天',()=>{const now=Date.UTC(2026,8,5);for(const [days,value] of [[90,'新鲜'],[91,'建议复核'],[180,'建议复核'],[181,'已过期']] as const)assert.equal(freshness(new Date(now-days*86400000).toISOString(),now),value);assert.equal(freshness(null),'待核验');});
test('任何来源 Excel 坐标只进候选，确认声明不等于正式确认',()=>{for(const source of ['DJI','GPS','手机','地图点选','手工导入']){const p=place({'原始纬度':27.7,'原始经度':117.9,'原始坐标系':'WGS84','坐标来源':source,'地图纬度':27.71,'地图经度':117.91,'地图坐标系':'GCJ-02','是否人工核验':'是'});const c=p.data.coordinate as Record<string,unknown>;assert.equal(c.source_type,source);assert.equal(c.human_confirmed,false);assert.equal(c.source_claimed_confirmed,true);assert.equal(c.raw_latitude,27.7);}});
test('错误经纬度、半对坐标、未知坐标系转换、非法确认标记拒绝',()=>{
 for(const extra of [{'原始纬度':100,'原始经度':117},{'原始纬度':27},{'原始纬度':27,'原始经度':117,'原始坐标系':'未知','地图纬度':27,'地图经度':117,'地图坐标系':'GCJ-02'},{'原始纬度':27,'原始经度':117,'是否人工核验':'可能'}]){const p=place({'原始坐标系':'WGS84','坐标来源':'GPS',...extra});valid([p]);assert.equal(p.action,'error');}
});
test('公开 DTO 覆盖每种等级、确认状态与开放状态，不传播原始字段',()=>{
 for(const level of ['P1','P2','P3','P4','P5'])for(const confirmed of [true,false])for(const status of ['正常','临时关闭','待核实']){
  const p=publicPlace({code:'WY-9001',name:'测试',public_level:level,current_status:status,region:'区域',raw_latitude:27.123,notes:'private',children:['private']},{status:'active',human_confirmed:confirmed,map_coordinate_system:'GCJ-02',map_latitude:27,map_longitude:117});
  if(level==='P5'){assert.equal(p,null);continue;}assert(p);assert.equal(p.navigation!==null,level==='P1'&&confirmed&&status==='正常');assert(!('notes'in p));assert(!('children'in p));if(level==='P4')assert.equal(p.region,null);
 }
});
