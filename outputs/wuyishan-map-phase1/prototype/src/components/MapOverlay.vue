<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,ref,watch} from 'vue';
import type {Place} from '../types';
import type {MapScope} from '../mapScope';
import {allMapScope,corridorMapScope,highlightsForMapScope,mapScopeName,placesForMapScope,showRouteForMapScope} from '../mapScope';
import PrototypeMap from './PrototypeMap.vue';
import NavDialog from './NavDialog.vue';
import MediaPlaceholder from './MediaPlaceholder.vue';
import {corridorEnd,corridorStart} from '../routeConfig';
import {imageFor,useVisitorPresentation} from '../presentation';

const props=defineProps<{places:Place[];scope:MapScope}>();
const presentation=useVisitorPresentation();
defineEmits<{close:[]}>();
function initialSelected(scope:MapScope){return scope.kind==='selection'&&scope.source==='place'?props.places.find(place=>place.code===scope.placeCodes[0])||null:null;}
const selected=ref<Place|null>(initialSelected(props.scope)),activeScope=ref<MapScope>(props.scope),sheetExpanded=ref(false),viewportHeight=ref('100dvh');
let touchStartY=0;
watch(()=>props.scope,value=>{activeScope.value=value;selected.value=initialSelected(value);sheetExpanded.value=false;},{deep:true});
const visible=computed(()=>placesForMapScope(activeScope.value,props.places));
const highlights=computed(()=>highlightsForMapScope(activeScope.value));
const routeMode=computed(()=>activeScope.value.kind==='corridor');
const layers=computed(()=>({markers:true,route:showRouteForMapScope(activeScope.value),routeLegend:activeScope.value.kind==='corridor',routeMetadata:activeScope.value.kind==='corridor',themeLabels:activeScope.value.kind==='selection'&&activeScope.value.source==='theme',contentOverlays:activeScope.value.kind==='selection'&&activeScope.value.source==='content'}));
const canSwitch=computed(()=>props.scope.kind==='all');
const contextLabel=computed(()=>activeScope.value.kind==='selection'?(activeScope.value.source==='theme'?'当前主题':activeScope.value.source==='content'?'当前内容':'当前地点'):'');
const guides:Record<string,string>={'WY-0040':'tea','WY-0048':'xingcun','WY-0049':'xingcun','WY-0050':'xingcun','WY-0051':'manshui','WY-0052':'manshui','WY-0053':'manshui','WY-0009':'manshui','WY-0024':'butterfly','WY-0025':'butterfly','WY-0026':'butterfly','WY-0028':'butterfly'};
function detailTarget(place:Place){const guide=guides[place.code];return guide?'/place/'+guide:'/location/'+place.code;}
function setMode(mode:'all'|'corridor'){activeScope.value=mode==='all'?allMapScope():corridorMapScope();selected.value=null;sheetExpanded.value=false;}
function description(p:Place){if(/停车/.test(p.name))return '停车位置';if(/卫生间/.test(p.name))return '公共卫生间';if(/河滩|河边|玩水/.test(p.name))return '河边停留与活动位置';return p.region?p.region+' · 沿路地点':'一号风景道沿路地点';}
function selectPlace(place:Place){selected.value=place;sheetExpanded.value=false;}
function dismiss(){selected.value=null;sheetExpanded.value=false;}
function syncViewport(){viewportHeight.value=`${Math.round(window.visualViewport?.height||window.innerHeight)}px`;}
function startSheetGesture(event:TouchEvent){touchStartY=event.touches[0]?.clientY||0;}
function finishSheetGesture(event:TouchEvent){const end=event.changedTouches[0]?.clientY||touchStartY;if(touchStartY-end>24)sheetExpanded.value=true;else if(end-touchStartY>24)sheetExpanded.value=false;}
onMounted(()=>{presentation.load();syncViewport();window.addEventListener('resize',syncViewport);window.visualViewport?.addEventListener('resize',syncViewport);});
onBeforeUnmount(()=>{window.removeEventListener('resize',syncViewport);window.visualViewport?.removeEventListener('resize',syncViewport);});
</script>
<template><section class="full-map" role="dialog" aria-modal="true" aria-label="游客地图" :style="{'--map-viewport-height':viewportHeight}" :data-map-scope="mapScopeName(activeScope)" :data-route-layer="layers.route?'visible':'hidden'" :data-route-presentation="layers.routeMetadata?'primary':layers.route?'background':'none'" :data-selected-code="selected?.code||''" :data-visible-codes="visible.map(place=>place.code).join(',')">
 <header class="map-top"><button class="map-back" type="button" @click="$emit('close')">← 返回</button><strong>武夷山奶爸地图</strong></header>
 <div v-if="canSwitch" class="map-switch" aria-label="地图显示范围"><button :class="{active:activeScope.kind==='all'}" @click="setMode('all')">全部地点</button><button :class="{active:activeScope.kind==='corridor'}" @click="setMode('corridor')">一号风景道</button></div>
 <div v-else-if="activeScope.kind==='selection'" class="map-context-caption" :class="{'single-place-caption':activeScope.source==='place'}"><small>{{contextLabel}}</small><strong>{{activeScope.title}}</strong><span v-if="activeScope.source!=='place'">{{visible.length}} 个相关地点</span></div>
 <div v-if="layers.routeMetadata" class="route-caption"><strong>{{corridorStart.label}} → {{corridorEnd.label}}</strong><span>主线路线 · 服务点随缩放显示</span></div>
 <PrototypeMap :items="visible" :highlight="highlights" :show-route="layers.route" :show-route-key="layers.routeLegend" :route-mode="routeMode" :fit-items="!routeMode" @select="selectPlace"/>
 <Transition name="card-up"><article v-if="selected" class="map-card" :class="{'is-expanded':sheetExpanded}" aria-label="地图地点卡" :data-sheet-state="sheetExpanded?'expanded':'default'">
  <button class="map-sheet-handle" type="button" :aria-expanded="sheetExpanded" :aria-label="sheetExpanded?'收起地点详情':'展开地点详情'" @click="sheetExpanded=!sheetExpanded" @touchstart.passive="startSheetGesture" @touchend.prevent="finishSheetGesture"><i></i><span>{{sheetExpanded?'向下收起':'向上查看完整内容'}}</span></button>
  <button class="card-dismiss" aria-label="关闭地点卡" @click="dismiss">×</button>
  <div class="map-card-scroll" tabindex="0">
   <div class="map-card-summary"><MediaPlaceholder :label="selected.name" :tone="selected.service?'mist':'forest'" :src="imageFor(presentation.state.value,`place.${selected.code}.cover`)" compact/><div class="map-card-copy"><p class="eyebrow">{{selected.service?'到达与服务':'沿路体验'}}</p><h2>{{selected.name}}</h2><div class="map-card-actions"><NavDialog :places="[selected]" label="导航到这里"/><RouterLink class="secondary button" :to="detailTarget(selected)">查看详情</RouterLink></div></div></div>
   <div class="map-card-details"><p>{{description(selected)}}</p><dl><div><dt>所属区域</dt><dd>{{selected.region||'沿线地点'}}</dd></div><div><dt>内容类型</dt><dd>{{selected.category_name}}</dd></div><div><dt>当前状态</dt><dd>{{selected.status}}</dd></div></dl></div>
   <div class="map-sheet-safe-end" aria-hidden="true"></div>
  </div>
 </article></Transition>
</section></template>
