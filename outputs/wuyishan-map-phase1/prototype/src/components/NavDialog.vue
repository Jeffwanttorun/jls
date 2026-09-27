<script setup lang="ts">
import {computed,ref} from 'vue';
import type {Place} from '../types';
import {navigationAppUrl,navigationUrl,openNavigation} from '../tencent';

const props=withDefaults(defineProps<{places:Place[];label?:string}>(),{label:'导航'});
const open=ref(false),busy=ref(''),error=ref('');
const hasDestination=computed(()=>props.places.length>0);

function kind(p:Place){
  if(/停车/.test(p.name))return {icon:'P',label:'停车'};
  if(/卫生间/.test(p.name))return {icon:'🚻',label:'公共卫生间'};
  if(/河滩|河边|玩水/.test(p.name))return {icon:'水',label:'河边活动位置'};
  if(/馆/.test(p.name))return {icon:'馆',label:'展馆'};
  return {icon:'•',label:p.category_name||'地点'};
}

async function go(p:Place){
  busy.value=p.code;
  error.value='';
  try{
    const url=await navigationUrl(p.name,p.latitude,p.longitude),appUrl=navigationAppUrl(p.name,p.latitude,p.longitude);
    (window as Window&{__prototypeNavigation?:string;__prototypeNavigationApp?:string}).__prototypeNavigation=url;
    (window as Window&{__prototypeNavigationApp?:string}).__prototypeNavigationApp=appUrl;
    openNavigation(url,appUrl);
  }catch(e){
    error.value=(e as Error).message;
  }finally{
    busy.value='';
  }
}
</script>

<template>
  <button v-if="hasDestination" class="primary nav-trigger" type="button" @click="open=true">{{label}}</button>
  <span v-else class="nav-unavailable" role="status">暂未设置导航位置</span>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="shade" @click.self="open=false">
        <section class="dialog nav-sheet" role="dialog" aria-modal="true" aria-label="选择要前往的地点">
          <span class="drawer-handle"></span>
          <div class="sheet-head">
            <div><p class="eyebrow">打开腾讯地图</p><h2>选择要前往的地点</h2></div>
            <button class="icon-close" type="button" aria-label="关闭导航选择" @click="open=false">×</button>
          </div>
          <button v-for="p in props.places" :key="p.code" type="button" class="destination" :disabled="!!busy" @click="go(p)">
            <span class="destination-icon">{{kind(p).icon}}</span>
            <span><strong>{{p.name}}</strong><small>{{kind(p).label}}</small></span>
            <b>›</b>
          </button>
          <p v-if="error" class="error">{{error}}</p>
          <button class="sheet-cancel" type="button" @click="open=false">取消</button>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
