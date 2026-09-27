<script setup lang="ts">
import {ref,watch} from 'vue';
import {useRouter} from 'vue-router';
import {api} from './api';
import {preferredBasemap} from './map-preferences';
const props=defineProps<{currentCode?:string;complete?:boolean;revision?:unknown}>();
const router=useRouter(),remaining=ref(0),unranked=ref(0),next=ref<{code:string;name:string;has_pending:boolean;corridor_order:number|null}|null>(null),error=ref(''),loading=ref(false);
let requestId=0;
async function load(){const id=++requestId;loading.value=true;error.value='';try{
 const result=await api(`/coordinate-queue${props.currentCode?'?after='+encodeURIComponent(props.currentCode):''}`);
 if(id===requestId){remaining.value=result.remaining;unranked.value=result.unranked;next.value=result.next;}
}catch(e){if(id===requestId)error.value=(e as Error).message;}finally{if(id===requestId)loading.value=false;}}
async function advance(){await load();if(error.value||!next.value)return;preferredBasemap.value='satellite';await router.push({path:`/places/${next.value.code}`,query:{queue:'missing'}});window.scrollTo(0,0);}
watch(()=>[props.currentCode,props.revision],load,{immediate:true});
</script>
<template><section class="coordinate-queue" aria-label="无正式坐标连续处理"><h2>无正式坐标地点 · 连续判点</h2>
 <p>尚有 {{remaining}} 个地点无有效正式坐标（包含待确认候选和已撤销地点）。</p>
 <p>按一号风景道路线顺序处理；{{unranked}} 个待排地点单列在队尾，不代表道路位置。</p>
 <p v-if="currentCode">{{complete?'本地点已有正式坐标，可检查记录后继续。':'请先核对已有候选；暂不确定时可以跳过，不会自动写入任何坐标。'}}</p>
 <p v-if="next">下一地点：{{next.corridor_order===null?'待排':String(next.corridor_order).padStart(4,'0')}} · {{next.code}} {{next.name}}{{next.has_pending?' · 已有待确认候选':''}}</p>
 <p v-else-if="!loading">{{remaining?'其余地点均已有正式坐标。':'全部地点均已有正式坐标。'}}</p>
 <p v-if="error" role="alert" class="error">{{error}}</p>
 <div class="actions"><button type="button" :disabled="loading||!next" @click="advance">{{loading?'正在读取…':!currentCode?'开始卫星判点':complete?'下一个无正式坐标地点':'暂跳过，处理下一个'}}</button><button type="button" class="secondary" :disabled="loading" @click="load">刷新待处理数量</button><RouterLink :to="{path:'/places',query:{coordinate:'无正式坐标'}}">选择待处理地点</RouterLink></div>
 </section></template>
