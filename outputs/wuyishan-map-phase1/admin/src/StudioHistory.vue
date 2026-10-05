<script setup lang="ts">
import {onMounted,ref} from 'vue';
import {getStudio,getStudioRevisions,restoreStudio,type StudioPayload} from './content-studio-api';
const payload=ref<StudioPayload|null>(null),items=ref<any[]>([]),message=ref(''),busy=ref(false),file=ref<File|null>(null),preview=ref<any>(null);
async function load(){payload.value=await getStudio();items.value=(await getStudioRevisions()).items;}onMounted(load);
async function restore(n:number){if(!confirm(`把草稿恢复到版本 ${n}？公开网站不会变化。`))return;try{await restoreStudio(payload.value!,n);message.value=`已恢复为新草稿，来源版本 ${n}`;await load();preview.value=null;}catch(e){message.value=(e as Error).message;}}
function choose(event:Event){file.value=(event.target as HTMLInputElement).files?.[0]||null;preview.value=null;message.value='';}
async function transfer(mode:'preview'|'apply'){
 if(!file.value||!payload.value)return;
 if(mode==='apply'&&!confirm('用导入包替换当前本地草稿？当前版本会保留在历史中，公开网站不变。'))return;
 busy.value=true;try{
  const query=new URLSearchParams({mode,...(mode==='apply'?{expectedRevision:String(preview.value.expectedRevision),archiveHash:preview.value.archiveHash}:{})});
  const response=await fetch(`/api/admin/content-studio/import?${query}`,{method:'POST',headers:{'Content-Type':'application/zip'},body:file.value});const result=await response.json();if(!response.ok)throw Error(result.error||'导入失败');
  if(mode==='preview')preview.value=result;else{message.value=`已导入为本地草稿 ${result.draftRevision}，图片已恢复。公开快照没有改变。`;preview.value=null;file.value=null;await load();}
 }catch(e){message.value=(e as Error).message;preview.value=null;}finally{busy.value=false;}
}
</script>
<template><div class="workspace-page studio-page"><div class="workspace-title"><div><p class="kicker">修改历史与备份</p><h1>内容版本与恢复</h1><p>历史记录不可改写。恢复或导入会产生新草稿，保留当前公开快照。</p></div><div class="workspace-actions"><a class="button quiet" href="/api/admin/content-studio/export.zip">导出完整草稿与图片 ZIP</a><a class="button quiet" href="/api/admin/content-studio/export.json">仅导出内容 JSON</a><a class="button quiet" href="/api/admin/content-studio/export.geojson">导出地点 GeoJSON</a></div></div>
<p v-if="message" class="inline-message" role="status">{{message}}</p>
<section class="local-transfer"><h2>导入草稿包</h2><p>选择本维护台导出的 ZIP。先检查内容与图片摘要，再确认导入。JSON / GeoJSON 不包含图片，不能用于完整恢复。</p><label>选择 ZIP 文件<input type="file" accept=".zip,application/zip" :disabled="busy" @change="choose"></label><button :disabled="!file||busy" @click="transfer('preview')">{{busy?'正在校验…':'检查导入包'}}</button><div v-if="preview" class="import-preview"><p>{{preview.places}} 个地点 · {{preview.routes}} 条路线 · {{preview.groups}} 个分组 · {{preview.media}} 张图片</p><p>来源草稿 {{preview.sourceRevision}}；替换本地草稿 {{preview.expectedRevision}}。已有版本仍可从下方恢复。</p><small>内容摘要 {{preview.documentHash.slice(0,16)}}</small><button class="primary-action" :disabled="busy" @click="transfer('apply')">导入为本地草稿</button></div></section>
<div class="history-timeline"><article v-for="item in items" :key="item.revision_no"><time>{{new Date(item.created_at).toLocaleString('zh-CN')}}</time><div><strong>{{item.summary}}</strong><p>{{item.object_type}} · {{item.object_id}} · {{item.revision_id}}</p><small>快照 {{item.snapshot_hash.slice(0,12)}}</small></div><button @click="restore(Number(item.revision_no))">恢复为草稿</button></article></div></div></template>