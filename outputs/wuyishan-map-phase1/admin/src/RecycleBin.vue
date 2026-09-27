<script setup lang="ts">
import {ref,onMounted} from 'vue';import {api} from './api';
const q=ref(''),items=ref<any[]>([]),total=ref(0),page=ref(1),loading=ref(false),error=ref(''),message=ref(''),restoring=ref('');
let requestId=0;
async function load(){const id=++requestId;loading.value=true;error.value='';try{const params=new URLSearchParams({page:String(page.value),page_size:'25'});if(q.value.trim())params.set('q',q.value.trim());const result=await api(`/recycle-bin?${params}`);if(id===requestId){items.value=result.items;total.value=result.total;}}catch(e){if(id===requestId)error.value=(e as Error).message;}finally{if(id===requestId)loading.value=false;}}
function search(){page.value=1;void load();}
async function restore(p:any){restoring.value=p.code;error.value='';message.value='';try{await api(`/places/${p.code}/restore`,{expected_deleted_at:p.deleted_at});message.value=`已恢复 ${p.code} ${p.name}`;await load();}catch(e){error.value=(e as Error).message;}finally{restoring.value='';}}
onMounted(load);
</script>
<template><h1>地点回收站</h1><p>这里只保存已删除地点。恢复地点不会重建或改写坐标、名称历史、路线、排序及其他关联资料。</p>
 <form class="filters" @submit.prevent="search"><label class="search">搜索名称或业务编号<input v-model="q" placeholder="当前名称 / 历史名称 / WY编号"></label><button>查询</button><button type="button" class="secondary" @click="q='';search()">重置</button></form>
 <p v-if="message" class="success" role="status">{{message}}</p><p v-if="error" class="error" role="alert">{{error}}</p><p v-if="loading" role="status">正在读取…</p>
 <div class="table-wrap"><table class="recycle-table"><thead><tr><th>业务编号</th><th>名称</th><th>父地点</th><th>区域</th><th>删除时间</th><th>保留记录</th><th>操作</th></tr></thead><tbody><tr v-for="p in items" :key="p.code"><td>{{p.code}}</td><td>{{p.name}}</td><td>{{p.parent_code?`${p.parent_code} ${p.parent_name}`:'未指定'}}</td><td>{{p.region||'未记录'}}</td><td>{{new Date(p.deleted_at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}}</td><td>坐标 {{p.coordinate_history_count}} · 名称 {{p.name_history_count}}</td><td><button type="button" :disabled="restoring===p.code" @click="restore(p)">恢复地点</button></td></tr><tr v-if="!loading&&!items.length"><td colspan="7">回收站为空。</td></tr></tbody></table></div>
 <nav class="pagination" aria-label="分页"><button class="secondary" :disabled="page===1||loading" @click="page--;load()">上一页</button><span>共 {{total}} 个 · 第 {{page}} / {{Math.max(1,Math.ceil(total/25))}} 页</span><button class="secondary" :disabled="page*25>=total||loading" @click="page++;load()">下一页</button></nav>
</template>
