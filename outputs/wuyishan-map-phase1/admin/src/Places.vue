<script setup lang="ts">
import { ref,onMounted,watch } from 'vue';
import {useRoute} from 'vue-router';import CoordinateQueue from './CoordinateQueue.vue';
import { api,date } from './api';
import NameEditor from './NameEditor.vue';
import DeletePlace from './DeletePlace.vue';
const route=useRoute();
const filters=ref<Record<string,string>>({q:'',region:'',category:'',tag:'',priority:'',status:'',public_level:'',coordinate:route.query.coordinate==='无正式坐标'?'无正式坐标':'',freshness:'',sort:'corridor',archive:''});
watch(()=>route.query.coordinate,value=>{filters.value.coordinate=value==='无正式坐标'?'无正式坐标':'';search();});
const options=ref<Record<string,string[]>>({}),items=ref<any[]>([]),total=ref(0),page=ref(1),error=ref(''),loading=ref(false);
const editing=ref<any>(null),draftOrder=ref(''),saving=ref(false);
async function moveOrder(direction:'up'|'down'){if(!editing.value)return;saving.value=true;error.value='';try{await api(`/places/${editing.value.code}/corridor-move`,{direction,expected_order:editing.value.corridor_order});editing.value=null;await load();}catch(e){error.value=(e as Error).message;}finally{saving.value=false;}}
async function saveOrder(){if(!editing.value)return;saving.value=true;error.value='';try{await api(`/places/${editing.value.code}/corridor-order`,{order:draftOrder.value===''?null:Number(draftOrder.value),expected_order:editing.value.corridor_order});editing.value=null;await load();}catch(e){error.value=(e as Error).message;}finally{saving.value=false;}}
const fields=[['archive','档案范围','archive'],['region','区域','regions'],['category','分类','categories'],['tag','标签','tags'],['priority','优先级','priority'],['status','状态','current_status'],['public_level','公开等级','public_level'],['coordinate','坐标状态','coordinate'],['freshness','核验新鲜度','freshness']];
let requestId=0;
async function load(){const id=++requestId;loading.value=true;error.value='';try{const params=new URLSearchParams({page:String(page.value),page_size:'25'});Object.entries(filters.value).forEach(([k,v])=>{if(v)params.set(k,k==='archive'?({'当前地点':'active','重复档案':'duplicates','全部档案':'all'}[v]||v):v);});const result=await api(`/places?${params}`);if(id===requestId){items.value=result.items;total.value=result.total;}}catch(e){if(id===requestId)error.value=(e as Error).message;}finally{if(id===requestId)loading.value=false;}}
function search(){page.value=1;void load();}
function reset(){Object.keys(filters.value).forEach(k=>filters.value[k]=k==='sort'?'corridor':'');search();}
onMounted(async()=>{try{options.value={...await api('/options'),archive:['当前地点','重复档案','全部档案'],coordinate:['无正式坐标','缺坐标','待确认','已确认'],freshness:['待核验','新鲜','建议复核','已过期']};await load();}catch(e){error.value=(e as Error).message;}});
</script>
<template>
 <div class="title-row"><div><h1>地点列表</h1><p>共 {{ total }} 个地点 · 读取已迁移数据</p></div></div>
 <CoordinateQueue :revision="items"/>
 <form v-if="editing" class="filters" aria-label="调整路线顺序" @submit.prevent="saveOrder"><p>{{editing.code}} {{editing.name}}：仅修改路线顺序，留空设为待排。</p><label>新顺序号<input v-model="draftOrder" type="number" min="1" max="2147483647" step="1" aria-label="新顺序号"></label><button :disabled="saving">保存路线顺序</button><button type="button" class="secondary" :disabled="saving||editing.corridor_order===null" @click="moveOrder('up')">上移</button><button type="button" class="secondary" :disabled="saving||editing.corridor_order===null" @click="moveOrder('down')">下移</button><p>上移/下移与全库相邻已排地点交换顺序，不以筛选结果为边界；待排地点不会被自动插入。</p><button type="button" class="secondary" :disabled="saving" @click="editing=null">取消调整</button></form>
 <form class="filters" @submit.prevent="search"><label class="search">搜索名称或业务编号<input v-model="filters.q" placeholder="当前名称 / 历史名称 / WY编号"></label>
  <label v-for="[key,label,source] in fields" :key="key">{{ label }}<select v-model="filters[key]" :aria-label="label"><option value="">全部</option><option v-for="v in options[source]" :key="v" :value="v">{{ v }}</option></select></label>
  <label>排序<select v-model="filters.sort"><option value="corridor">一号风景道路线顺序</option><option value="priority">高优先级优先</option><option value="updated">最近更新</option><option value="oldest">最久未核验</option><option value="coordinates">缺坐标优先</option></select></label>
  <div class="actions"><button type="submit">查询</button><button type="button" class="secondary" @click="reset">重置</button></div>
 </form>
 <p v-if="error" class="error" role="alert">{{error}}</p><p v-if="loading" role="status">正在读取…</p>
 <div class="table-wrap"><table><thead><tr><th scope="col">路线顺序</th><th scope="col">业务编号</th><th scope="col">名称</th><th scope="col">类型</th><th scope="col">区域</th><th scope="col">分类</th><th scope="col">优先级</th><th scope="col">当前状态</th><th scope="col">公开等级</th><th scope="col">坐标状态</th><th scope="col">最后核验日期</th></tr></thead>
 <tbody><tr v-for="p in items" :key="p.code"><td><strong>{{p.corridor_order===null?(p.duplicate_of_place_id?'重复档案':'待排'):String(p.corridor_order).padStart(4,'0')}}</strong><button v-if="!p.duplicate_of_place_id" class="secondary" type="button" :aria-label="`调整${p.code}路线顺序`" @click="editing=p;draftOrder=p.corridor_order===null?'':String(p.corridor_order)">调整</button></td><td>{{p.code}}</td><td><RouterLink :to="{path:`/places/${p.code}`,query:filters.coordinate==='无正式坐标'?{queue:'missing'}:{}}">{{p.name}}</RouterLink><div class="list-name-action"><NameEditor :place="p" @changed="load"/><DeletePlace :place="p" @deleted="load"/></div></td><td>{{p.place_type}}</td><td>{{p.region||'未记录'}}</td><td>{{p.category_name}}</td><td>{{p.priority}}</td><td>{{p.current_status}}</td><td>{{p.public_level}}</td><td>{{p.coordinate_status}}</td><td>{{date(p.last_verified_at)}}<small v-if="p.source_last_verified_at">来源表日期：{{date(p.source_last_verified_at)}}</small></td></tr><tr v-if="!loading&&!items.length"><td colspan="11">没有匹配的地点。</td></tr></tbody></table></div>
 <nav class="pagination" aria-label="分页"><button class="secondary" :disabled="page===1||loading" @click="page--;load()">上一页</button><span>第 {{page}} / {{Math.max(1,Math.ceil(total/25))}} 页</span><button class="secondary" :disabled="page*25>=total||loading" @click="page++;load()">下一页</button></nav>
</template>
