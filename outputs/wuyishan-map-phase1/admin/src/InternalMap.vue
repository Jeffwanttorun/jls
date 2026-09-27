<script setup lang="ts">
import {ref,onMounted} from 'vue';import {useRouter} from 'vue-router';import {api} from './api';import TencentMap from './TencentMap.vue';import CoordinateQueue from './CoordinateQueue.vue';import PlaceActions from './PlaceActions.vue';import type {MapPlace} from '../../shared/coordinates';
const router=useRouter(),items=ref<MapPlace[]>([]),options=ref<Record<string,string[]>>({}),error=ref(''),loading=ref(false);
const filters=ref<Record<string,string>>({category:'',region:'',status:'',public_level:'',coordinate_status:'active'});
const selected=ref<MapPlace|null>(null);
function select(code:string){selected.value=items.value.find(p=>p.code===code)||null;}
let requestId=0;
async function load(){const id=++requestId;loading.value=true;error.value='';try{const q=new URLSearchParams();for(const [k,v]of Object.entries(filters.value))if(v)q.set(k,v);const r=await api(`/map-places?${q}`);if(id===requestId){items.value=r.items;if(selected.value)selected.value=r.items.find((p:MapPlace)=>p.code===selected.value?.code)||null;}}catch(e){if(id===requestId)error.value=(e as Error).message;}finally{if(id===requestId)loading.value=false;}}
onMounted(async()=>{try{options.value=await api('/options');await load();}catch(e){error.value=(e as Error).message;}});
</script>
<template><h1>内部地图</h1><p>仅显示当前有效且经人工确认的正式坐标。P2—P5 精确位置用于内部局域网核对。</p>
 <CoordinateQueue :revision="items"/>
 <form class="filters" @submit.prevent="load"><label v-for="[key,label,list] in [['category','分类','categories'],['region','区域','regions'],['status','地点状态','current_status'],['public_level','公开等级','public_level']]" :key="key">{{label}}<select v-model="filters[key]" :aria-label="label"><option value="">全部</option><option v-for="v in options[list]" :key="v">{{v}}</option></select></label>
 <label>坐标状态<select v-model="filters.coordinate_status" aria-label="坐标状态"><option value="active">当前有效</option><option value="active_with_pending">当前有效，且有待确认候选</option><option value="pending">待确认（不显示地图点）</option><option value="superseded">已替换（不显示地图点）</option><option value="revoked">已撤销（不显示地图点）</option></select></label><button>查询地图</button></form>
 <p v-if="error" role="alert" class="error">{{error}}</p><p v-if="loading">正在读取…</p><p v-else>符合筛选条件的正式地点：{{items.length}} 个。</p>
 <TencentMap :items="items" @select="select"/>
 <section v-if="selected" :key="selected.code" class="map-place-popup" role="dialog" aria-label="地图地点操作"><h2>{{selected.name}}</h2><p>{{selected.code}} · {{selected.public_level}} · {{selected.current_status}} · {{selected.latitude}}, {{selected.longitude}}</p><PlaceActions :place="selected" :coordinate-id="selected.coordinate_id" @changed="load" @deleted="load" @relocate="router.push({path:`/places/${selected.code}`,query:{relocate:'1'}})"/><div class="actions"><RouterLink :to="`/places/${selected.code}`">查看地点详情</RouterLink><button type="button" class="secondary" @click="selected=null">关闭地点弹窗</button></div></section>
 <p v-if="!items.length&&!loading">当前没有符合条件的正式坐标。可在地点详情采集候选，核对后确认。</p>
</template>
