<script setup lang="ts">
import { ref,watch } from 'vue';
import { useRoute,useRouter } from 'vue-router';
import { api,date } from './api';
import InfoFields from './InfoFields.vue';
import CoordinatePanel from './CoordinatePanel.vue';
import PlaceActions from './PlaceActions.vue';
const route=useRoute(),router=useRouter(),place=ref<any>(null),error=ref(''),loading=ref(false);
const relocation=ref(route.query.relocate==='1'?1:0);
let requestId=0;
async function refresh(){const id=++requestId;loading.value=true;error.value='';try{const data=await api(`/places/${encodeURIComponent(String(route.params.code))}`);if(id===requestId)place.value=data;}catch(e){if(id===requestId)error.value=(e as Error).message;}finally{if(id===requestId)loading.value=false;}}
watch(()=>route.params.code,()=>{place.value=null;relocation.value=route.query.relocate==='1'?1:0;void refresh();},{immediate:true});
const basic={corridor_order:'路线顺序（空值为待排）',corridor_role:'主线/支线角色',map_display_role:'地图显示角色',code:'业务编号',name:'名称',short_name:'简称',place_type:'类型',region:'区域',main_line:'所属主线',category_name:'分类',tags:'标签',priority:'优先级',current_status:'当前状态',public_level:'公开等级',coordinate_status:'坐标状态',intro:'简介',risk_note:'主要风险',notes:'备注'};
const coord={source_type:'坐标来源',source_file:'源文件',source_time:'原始采集时间',raw_latitude:'原始纬度',raw_longitude:'原始经度',raw_coordinate_system:'原始坐标系',accuracy_meters:'定位精度（米）',confidence_level:'可信等级',map_latitude:'地图纬度',map_longitude:'地图经度',map_coordinate_system:'地图坐标系',conversion_method:'转换方法',human_confirmed:'坐标经人工确认',confirmed_at:'确认时间',confirmed_by:'确认人'};
const practical={car_access:'车辆可达',road_type:'道路类型',road_width_note:'路宽',passing_difficulty:'会车难度',four_wheel_drive_required:'需要四驱',walking_required:'需要步行',walking_distance_m:'步行距离（米）',walking_duration_min:'步行时长（分钟）',parking_available:'停车',parking_type:'停车类型',parking_capacity_note:'停车容量',parking_fee_note:'停车费用',toilet_available:'厕所',toilet_distance_m:'厕所距离（米）',food_available:'餐饮',water_available:'饮水',mobile_signal_note:'手机信号',charging_available:'充电'};
const verification={verified_at:'核验时间',verifier:'核验人',open_status:'开放状态',road_status:'道路',parking_status:'停车',toilet_status:'厕所',weather:'天气',water_condition:'水情',observation_note:'水情/自然观察原记录',general_note:'备注',source_photo_note:'照片编号原记录'};
</script>
<template>
 <RouterLink to="/places">← 地点列表</RouterLink><p v-if="loading" role="status">正在读取…</p><p v-if="error" role="alert" class="error">{{error}}</p>
 <template v-if="place"><h1>{{place.name}}</h1><p>{{place.code}} · {{place.current_status}} · {{place.public_level}} · {{place.freshness}}</p>
 <p v-if="place.duplicate" role="status">这是保留的重复档案，原始资料未删除。请前往 <RouterLink :to="`/places/${place.duplicate.code}`">{{place.duplicate.code}} {{place.duplicate.name}}</RouterLink> 处理坐标。</p>
 <PlaceActions v-if="!place.duplicate" :place="place" :coordinate-id="place.coordinates.find((c:any)=>c.status==='active')?.id||null" @changed="refresh" @relocate="relocation++" @deleted="router.push('/recycle')"/>
 <CoordinatePanel v-if="!place.duplicate" :key="place.code" :place="place" :relocate-revision="relocation" @changed="refresh"/>
 <section><h2>基本信息</h2><InfoFields :data="place" :fields="basic"/></section>
 <section><h2>名称历史</h2><p v-if="!place.name_history?.length">暂无改名记录。</p><ul><li v-for="(h,i) in place.name_history" :key="i">{{h.old_name}} → {{h.new_name}} · {{new Date(h.changed_at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}} · {{h.change_source}}</li></ul></section>
 <section><h2>父地点与子地点</h2><p>父地点：<RouterLink v-if="place.parent_code" :to="`/places/${place.parent_code}`">{{place.parent_code}} {{place.parent_name}}</RouterLink><span v-else>未指定</span></p><ul v-if="place.children.length"><li v-for="child in place.children" :key="child.code"><RouterLink :to="`/places/${child.code}`">{{child.code}} {{child.name}}</RouterLink> · {{child.public_level}}</li></ul><p v-else>暂无子地点。</p></section>
 <section><h2>实用信息</h2><InfoFields :data="place.practical" :fields="practical"/></section>
 <section><h2>亲子与老人</h2><InfoFields :data="place.accessibility" :fields="{child_friendly_note:'适合带娃（来源评价）',stroller_friendly:'推车友好',baby_carrier_possible:'可用背带',age_2_3_rating:'2—3岁',age_4_6_rating:'4—6岁',age_7_plus_rating:'7岁以上',elderly_friendly:'老人友好',stairs_note:'台阶',slope_note:'坡度',shade_note:'遮阴',seats_available:'座位',fall_risk:'跌落风险',water_risk:'水域风险',vehicle_risk:'车辆风险'}"/></section>
 <section><h2>自然观察与水域</h2><InfoFields :data="place.nature" :fields="{primary_observation:'主要观察',secondary_observation:'次要观察',best_season:'最佳季节',best_time:'最佳时段',weather_note:'天气',wind_note:'风力',temperature_note:'温度',guaranteed_sighting:'保证看到',waiting_required:'需要等待',ecological_sensitivity:'生态敏感性'}"/><InfoFields :data="place.water" :fields="{water_type:'水域类型',normal_depth_note:'常态水深',riverbed_type:'河床',slippery_risk:'湿滑风险',current_risk:'水流风险',rainfall_risk:'降雨风险',upstream_rainfall_risk:'上游降雨风险',child_water_entry_note:'儿童下水',life_jacket_note:'救生衣',last_water_check_at:'最后水情核验'}"/></section>
 <section><h2>最新核验</h2><p>实际核验日期：{{date(place.last_verified_at)}}</p><p v-if="place.source_last_verified_at">Excel 来源声明日期：{{date(place.source_last_verified_at)}}（未据此生成核验历史）</p><InfoFields :data="place.latest_verification" :fields="verification"/></section>
 <section><h2>历史核验</h2><p v-if="!place.verifications.length">暂无实地核验记录。</p><article v-for="v in place.verifications" :key="v.id"><h3>{{v.code}}</h3><InfoFields :data="v" :fields="verification"/></article></section>
 <section><h2>关联路线</h2><p v-if="!place.routes.length">暂无明确站点关联。</p><ul><li v-for="r in place.routes" :key="`${r.code}-${r.sequence}`">{{r.code}} {{r.name}} · {{r.sequence?`来源顺序 ${r.sequence}`:'仅关联，未指定顺序'}} · {{r.sequence_confirmed?'顺序已确认':'候选关系，未实地确认'}} · {{r.publish_status}}</li></ul></section>
 <section><h2>关联攻略</h2><p v-if="!place.guides.length">暂无关联攻略。</p><ul><li v-for="g in place.guides" :key="g.code">{{g.code}} {{g.title}} · {{g.publish_status}}</li></ul></section>
 <section><h2>媒体</h2><p v-if="!place.media.length">尚未登记媒体文件。</p><article v-for="m in place.media" :key="m.id"><InfoFields :data="m" :fields="{media_type:'类型',purpose:'用途',local_source_path:'原始文件',file_url:'文件地址',shot_at:'拍摄时间',public_status:'公开状态'}"/></article></section>
 </template>
</template>
