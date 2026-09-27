<script setup lang="ts">
import {onBeforeUnmount,onMounted,ref} from 'vue';
type State={running:boolean;startedAt:string|null;finishedAt:string|null;ok:boolean|null;log:string;exitCode:number|null};
const state=ref<State|null>(null),message=ref(''),timer=ref<number>();
async function load(){try{const response=await fetch('/api/admin/site-publish/status');state.value=await response.json();if(state.value?.running)timer.value=window.setTimeout(load,1800);}catch{message.value='暂时无法读取发布状态';}}
async function publish(){if(!confirm('确认把当前已发布内容更新到公开网站？系统会先完整检查，失败时仍保留现有网站。'))return;message.value='正在开始更新…';const response=await fetch('/api/admin/site-publish',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const body=await response.json();if(!response.ok){message.value=body.error||'无法开始更新';return;}state.value=body;message.value='网站正在检查和生成，可以继续留在此页面查看结果。';await load();}
onMounted(load);onBeforeUnmount(()=>timer.value&&clearTimeout(timer.value));
</script>
<template>
 <div class="site-publish">
  <button class="site-publish-button" :disabled="state?.running" @click="publish">{{state?.running?'正在更新网站…':'更新公开网站'}}</button>
  <span v-if="state?.ok===true" class="publish-ok">上次更新成功</span><span v-else-if="state?.ok===false" class="publish-failed">上次更新失败，旧网站未受影响</span>
  <small v-if="message">{{message}}</small>
 </div>
</template>
