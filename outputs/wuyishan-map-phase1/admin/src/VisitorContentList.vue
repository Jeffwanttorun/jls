<script setup lang="ts">
import {computed,onMounted,ref} from 'vue';
import {getVisitorState,formatUpdate,placeName,postVisitor,previewUrl,statusLabels,type VPayload} from './visitor-content-api';
const payload=ref<VPayload|null>(null),query=ref(''),showRecycle=ref(false),message=ref(''),busy=ref(false);
async function load(){payload.value=await getVisitorState();}
onMounted(load);
const active=computed(()=>payload.value?.state.contents.filter(item=>showRecycle.value?Boolean(item.deletedAt):!item.deletedAt).filter(item=>{
 const q=query.value.trim().toLowerCase();if(!q)return true;const places=item.draft.placeLinks.map(link=>payload.value!.places.find(place=>place.code===link.placeCode)).filter(Boolean);return [item.draft.title,item.draft.internalName,item.draft.summary,...places.flatMap(place=>[place!.code,place!.name,...place!.old_names])].some(value=>String(value).toLowerCase().includes(q));
})||[]);
const placeMatches=computed(()=>{const q=query.value.trim().toLowerCase();if(!q||!payload.value)return [];return payload.value.places.filter(place=>!place.deleted_at&&!place.duplicate_of_place_id&&[place.code,place.name,...place.old_names].some(value=>value.toLowerCase().includes(q))).slice(0,8);});
function themes(ids:string[]){return payload.value?.state.themes.filter(theme=>ids.includes(theme.id)).map(theme=>theme.name)||[];}
function defaultNav(item:any){const target=item.draft.navigationTargets.find((nav:any)=>nav.isDefault);return target?placeName(payload.value!.places,target.placeCode):'缺失';}
function alertCount(item:any){const codes=item.draft.placeLinks.map((link:any)=>link.placeCode);return payload.value?.state.alerts.filter(alert=>alert.enabled&&!alert.deletedAt&&(alert.contentIds.includes(item.id)||alert.placeCodes.some(code=>codes.includes(code)))).length||0;}
async function copy(item:any){busy.value=true;try{const result=await postVisitor<any>(`/${item.id}/copy`,{expected_store_version:payload.value!.state.version});message.value='已复制为新草稿';await load();location.href='/visitor-content/'+result.item.id;}catch(e){message.value=(e as Error).message;}finally{busy.value=false;}}
async function change(item:any,action:'hide'|'restore'){busy.value=true;try{await postVisitor(`/${item.id}/${action}`,{expected_version:item.version});message.value=action==='hide'?'已隐藏，游客端不再显示':'已恢复游客内容';await load();}catch(e){message.value=(e as Error).message;}finally{busy.value=false;}}
async function exportBackup(){const response=await fetch('/api/admin/visitor-content/backup');const body=await response.json();const blob=new Blob([JSON.stringify(body.data||body.state||body,null,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=body.filename||'visitor-content-backup.json';link.click();URL.revokeObjectURL(link.href);message.value='备份已导出';}
</script>

<template>
 <div class="workspace-page visitor-workspace">
  <div class="workspace-title"><div><p class="kicker">游客内容工作台</p><h1>游客内容</h1><p>维护游客看什么、怎么讲和导航到哪里。</p></div><div class="workspace-actions"><button class="secondary quiet" @click="exportBackup">导出备份</button><RouterLink class="button primary-action" to="/visitor-content/new">新建内容</RouterLink></div></div>
  <p v-if="message" class="inline-message">{{message}}</p>
  <section class="content-toolbar"><label class="content-search"><span>搜索内容或地点</span><input v-model="query" placeholder="标题、地点名称、旧名称或 WY 编号"></label><button class="secondary quiet" :class="{selected:showRecycle}" @click="showRecycle=!showRecycle">{{showRecycle?'返回正常内容':'游客内容回收区'}}</button></section>
  <section v-if="placeMatches.length" class="search-place-results"><p class="kicker">匹配地点</p><div class="compact-place" v-for="place in placeMatches" :key="place.code"><span><strong>{{place.name}}</strong><small>{{place.code}}<template v-if="place.old_names.length"> · 曾用名 {{place.old_names.join('、')}}</template></small></span><RouterLink :to="'/visitor-themes?place='+place.code">修改游客主题</RouterLink></div></section>
  <div class="content-card-list">
   <article v-for="item in active" :key="item.id" class="visitor-content-card">
    <div class="content-card-main"><div class="card-topline"><span class="status-chip" :class="item.status">{{statusLabels[item.status]}}</span><span v-if="item.status==='published'&&item.version!==item.publishedVersion" class="status-chip draft-change">有未发布修改</span><span v-if="item.deletedAt" class="status-chip hidden">回收区</span></div><h2>{{item.draft.title}}</h2><p>{{item.draft.summary||'还没有填写一句简介'}}</p><div class="soft-tags"><span v-for="theme in themes(item.draft.themeIds)" :key="theme">{{theme}}</span><span v-if="item.draft.familyFriendly">适合带孩子</span></div></div>
    <dl class="content-card-facts"><div><dt>默认导航</dt><dd :class="{missing:defaultNav(item)==='缺失'}">{{defaultNav(item)}}</dd></div><div><dt>现场提醒</dt><dd>{{alertCount(item)?alertCount(item)+' 条':'无提醒'}}</dd></div><div><dt>最后修改</dt><dd>{{formatUpdate(item.updatedAt)}}</dd></div></dl>
    <div class="card-actions"><template v-if="!item.deletedAt"><RouterLink class="button secondary" :to="'/visitor-content/'+item.id">编辑</RouterLink><a class="button secondary" :href="previewUrl(item.id)" target="_blank">预览</a><button class="quiet" :disabled="busy" @click="copy(item)">复制</button><button v-if="item.status==='published'" class="quiet" :disabled="busy" @click="change(item,'hide')">隐藏</button></template><button v-else class="secondary" :disabled="busy" @click="change(item,'restore')">恢复</button></div>
   </article>
   <p v-if="payload&&!active.length" class="empty-state">没有找到符合条件的游客内容。</p>
  </div>
 </div>
</template>
