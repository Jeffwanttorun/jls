import {test} from 'node:test';import assert from 'node:assert/strict';
import {convertForMap} from '../backend/src/coordinates.js';
import {visibleMapPlaces} from '../shared/coordinates.js';
import {publicPlace} from '../shared/domain.js';

test('共享公开投影同样排除软删除地点',()=>{
 assert.equal(publicPlace({code:'WY-9001',name:'已删除',public_level:'P1',current_status:'正常',deleted_at:'2026-09-10T00:00:00Z'},
 {human_confirmed:true,status:'active',map_coordinate_system:'GCJ-02',map_latitude:27,map_longitude:117}),null);
});
test('地图缩放按祖先层级折叠和展开，过滤父点后不丢子点',()=>{
 const p={code:'WY-0001',ancestor_codes:[]},c={code:'WY-0002',ancestor_codes:['WY-0001']},g={code:'WY-0003',ancestor_codes:['WY-0002','WY-0001']};
 assert.deepEqual(visibleMapPlaces([p,c,g],13),[p]);assert.deepEqual(visibleMapPlaces([p,c,g],14),[p,c,g]);
 assert.deepEqual(visibleMapPlaces([c,g],10),[c]);assert.deepEqual(visibleMapPlaces([g],10),[g]);
 assert.deepEqual(visibleMapPlaces([p,g],10),[p]);
});
test('GCJ-02 无偏移，WGS84/BD09 保留原值并独立转换，未知不猜',()=>{
 assert.deepEqual(convertForMap(27.76,117.99,'GCJ-02'),{converted_latitude:27.76,converted_longitude:117.99,map_coordinate_system:'GCJ-02',conversion_method:'identity:GCJ-02'});
 const original=[116.403988,39.914266];const r=convertForMap(original[1],original[0],'WGS84');
 assert(Math.abs(r.converted_latitude!-39.915669)<0.0001);assert(Math.abs(r.converted_longitude!-116.410232)<0.0001);
 assert.deepEqual(original,[116.403988,39.914266]);assert.equal(convertForMap(27.76,117.99,'未知').converted_latitude,null);
 assert.notEqual(convertForMap(27.76,117.99,'BD-09').converted_latitude,27.76);
});
test('superseded、revoked 即使曾确认也不作为公开导航',()=>{
 for(const status of ['superseded','revoked'])assert.equal(publicPlace({code:'WY-0001',name:'测试',public_level:'P1',current_status:'正常'}, {human_confirmed:true,status,map_coordinate_system:'GCJ-02',map_latitude:27,map_longitude:117})!.navigation,null);
});
