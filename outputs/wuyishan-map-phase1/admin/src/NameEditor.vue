<script setup lang="ts">
import {ref,watch,nextTick,onBeforeUnmount} from 'vue';import {api} from './api';
const props=defineProps<{place:{code:string;name:string}}>(),emit=defineEmits<{changed:[]}>();
const editing=ref(false),draft=ref(''),original=ref(''),busy=ref(false),error=ref(''),message=ref(''),conflicts=ref<{code:string;name:string}[]>([]),input=ref<HTMLInputElement>(),opener=ref<HTMLButtonElement>();
let timer:ReturnType<typeof setTimeout>|undefined,revision=0;
function close(){if(busy.value)return;editing.value=false;revision++;clearTimeout(timer);void nextTick(()=>opener.value?.focus());}
async function open(){draft.value=props.place.name;original.value=props.place.name;error.value='';message.value='';conflicts.value=[];editing.value=true;await nextTick();input.value?.focus();input.value?.select();}
watch(draft,()=>{clearTimeout(timer);const current=++revision;conflicts.value=[];if(!editing.value||!draft.value.trim()||[...draft.value.trim()].length>120)return;timer=setTimeout(async()=>{try{const result=await api(`/places/${props.place.code}/name-conflicts?name=${encodeURIComponent(draft.value.trim())}`);if(current===revision)conflicts.value=result.items;}catch{/* The save response also returns duplicate warnings. */}},250);});
onBeforeUnmount(()=>{revision++;clearTimeout(timer);});
async function save(){if(busy.value)return;const name=draft.value.trim();if(!name||[...name].length>120){error.value='名称须为1至120个字符，不能只填空格';return;}busy.value=true;error.value='';try{const result=await api(`/places/${props.place.code}/name`,{name,expected_name:original.value});editing.value=false;message.value=result.warnings.length?'已保存；同一区域存在同名地点：'+result.warnings.map((p:any)=>p.code).join('、'):'名称已保存';emit('changed');}catch(e){error.value=(e as Error).message;}finally{busy.value=false;}}
</script>
<template><span class="name-editor"><button ref="opener" type="button" class="secondary" :aria-label="`编辑名称：${place.code}`" @click="open">编辑名称</button><small v-if="message" role="status">{{message}}</small>
 <div v-if="editing" class="action-shade"><form class="action-dialog" role="dialog" aria-modal="true" aria-label="编辑地点名称" @submit.prevent="save" @keydown.esc.prevent="close"><h2>编辑名称</h2><p>{{place.code}} · {{original}}</p><label>新名称<input ref="input" v-model="draft" required maxlength="120" :disabled="busy"></label><p v-if="conflicts.length" class="warning" role="status">同一区域存在同名地点：{{conflicts.map(p=>p.code+' '+p.name).join('、')}}。可以继续保存。</p><p v-if="error" class="error" role="alert">{{error}}</p><div class="actions"><button type="button" class="secondary" :disabled="busy" @click="close">取消</button><button :disabled="busy||!draft.trim()">保存</button></div></form></div>
 </span></template>
