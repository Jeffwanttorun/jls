<script setup lang="ts">
import {computed,onMounted,ref,watch} from 'vue';
import {alertsFor,imageFor,useVisitorPresentation} from '../presentation';
import {usePlaces} from '../data';
import type {ContentModule,PageConfig,PageKind,Place} from '../types';
import PrototypeMap from '../components/PrototypeMap.vue';
import NavDialog from '../components/NavDialog.vue';
import MapOverlay from '../components/MapOverlay.vue';
import BottomBar from '../components/BottomBar.vue';
import MediaPlaceholder from '../components/MediaPlaceholder.vue';
import {contentMapScope,placeMapScope} from '../mapScope';

const props=defineProps<{slug?:string;previewId?:string}>();
const {places,load}=usePlaces(),map=ref(false),presentation=useVisitorPresentation(props.previewId);
onMounted(()=>Promise.all([load(),presentation.load()]));
const content=computed(()=>presentation.contents.value.find(item=>props.previewId?item.id===props.previewId:item.document.slug===props.slug));
const config=computed<PageConfig|undefined>(()=>{const doc=content.value?.document;if(!doc)return undefined;return {slug:doc.slug,kind:doc.presentation.kind as PageKind,title:doc.title,placeCodes:[...doc.placeLinks].sort((a,b)=>a.sequence-b.sequence).map(item=>item.placeCode),nearbyCodes:doc.presentation.nearbyCodes,corridorAnchor:doc.presentation.corridorAnchor,eyebrow:doc.presentation.eyebrow,oneLiner:doc.summary,tags:doc.presentation.tags,cover:doc.presentation.cover,modules:[...doc.modules].filter(item=>!item.hidden&&item.kind!=='route_segment').sort((a,b)=>a.sequence-b.sequence).map(item=>({title:item.title,variant:item.kind as ContentModule['variant'],items:item.items,columns:item.columns})),arrivalNotes:doc.presentation.arrivalNotes,dadTip:doc.presentation.dadTip,mediaText:doc.presentation.mediaText,videoLabel:doc.presentation.videoLabel};});
const related=computed(()=>config.value?.placeCodes.map(code=>places.value.find(p=>p.code===code)).filter(Boolean) as Place[]||[]);
const nearby=computed(()=>config.value?.nearbyCodes.map(code=>places.value.find(p=>p.code===code)).filter(Boolean) as Place[]||[]);
const activeAlerts=computed(()=>alertsFor(presentation.state.value,content.value?.document.placeLinks.map(link=>link.placeCode)||[],content.value?.id));
const around=computed(()=>{
  if(!config.value)return {previous:null,next:null};
  const orders=related.value.map(p=>p.corridor_order).filter((value):value is number=>value!==null);
  const start=Math.min(config.value.corridorAnchor,...orders),end=Math.max(config.value.corridorAnchor,...orders);
  const excluded=new Set(config.value.placeCodes);
  const choices=places.value.filter(p=>!p.service&&p.corridor_order!==null&&!excluded.has(p.code)).map(p=>({name:p.name,order:p.corridor_order!}));
  for(const page of presentation.contents.value.map(item=>item.document))if(page.slug!==config.value.slug)choices.push({name:page.title,order:page.presentation.corridorAnchor});
  choices.sort((a,b)=>a.order-b.order);
  return {previous:[...choices].reverse().find(p=>p.order<start)||null,next:choices.find(p=>p.order>end)||null};
});
// The content unit's default navigation target is authoritative. Keep the
// coordinate in the places read model so the presentation layer cannot drift.
const navPlaces=computed(()=>{const target=content.value?.document.navigationTargets?.find(item=>item.isDefault);if(!target)return [];const place=places.value.find(item=>item.code===target.placeCode);return place?[place]:[];});
const detailMapScope=computed(()=>related.value.length===1&&content.value?.document.placeLinks.length===1?placeMapScope(related.value[0]):contentMapScope(config.value?.title||'当前内容',content.value?.document.placeLinks||[]));
const coverImage=computed(()=>imageFor(presentation.state.value,content.value?`content.${content.value.id}.cover`:null,related.value[0]?`place.${related.value[0].code}.cover`:null));
const videoImage=computed(()=>imageFor(presentation.state.value,content.value?`content.${content.value.id}.video`:null,content.value?`content.${content.value.id}.cover`:null));
watch(()=>[props.slug,props.previewId],()=>window.scrollTo(0,0));
function guide(){document.getElementById('first-guide')?.scrollIntoView({behavior:'smooth'});}
function itemParts(item:string){const [title,note]=item.split('｜');return {title,note};}
function pointIcon(p:Place){return /停车/.test(p.name)?'P':/卫生间/.test(p.name)?'🚻':/河滩|河边/.test(p.name)?'水':/馆/.test(p.name)?'馆':'•';}
function moduleClass(module:ContentModule){return 'module-'+module.variant;}
</script>

<template>
  <template v-if="config">
    <div v-if="props.previewId" class="preview-banner">草稿预览 · 普通游客看不到这个版本</div>
    <section class="detail-hero" :class="config.kind">
      <MediaPlaceholder :label="config.cover" :tone="config.kind" :split="config.kind==='food'" :src="coverImage"/>
    </section>
    <section class="detail-hero-copy">
      <p class="eyebrow">{{config.eyebrow}}</p>
      <h1>{{config.title}}</h1>
      <p class="lede">{{config.oneLiner}}</p>
      <div class="tags"><span v-for="tag in config.tags" :key="tag">{{tag}}</span></div>
      <div class="hero-actions">
        <NavDialog :places="navPlaces" label="导航到这里"/>
        <button class="secondary" type="button" @click="map=true">查看地图</button>
        <button v-if="config.kind==='museum'" class="secondary" type="button" @click="guide">开始看馆指南</button>
      </div>
      <div v-for="alert in activeAlerts" :key="alert.id" class="visitor-alert hero-alert" :class="'level-'+alert.level"><strong>{{alert.level}}</strong><span>{{alert.text}}</span></div>
    </section>

    <section class="content-card arrival-card" :class="{'food-journey':config.kind==='food'}">
      <div class="section-head">
        <div><p class="eyebrow">先把到达问题解决</p><h2>{{config.kind==='food'?'我会这样停':'到了以后'}}</h2></div>
        <button class="map-link" type="button" @click="map=true">查看地图 →</button>
      </div>
           <PrototypeMap :items="related" :highlight="related.map(p=>p.code)" compact @select="()=>{}"/>
      <div class="arrival-list">
        <article v-for="(p,index) in related" :key="p.code">
          <MediaPlaceholder :label="p.name" tone="service" :src="imageFor(presentation.state.value,`place.${p.code}.cover`)" compact/>
          <div class="arrival-number">{{String(index+1).padStart(2,'0')}}</div>
          <span class="point-icon">{{pointIcon(p)}}</span>
          <div class="arrival-copy"><h3>{{p.name}}</h3><p>{{config.arrivalNotes[p.code]||'这一页的实际到达位置'}}</p></div>
          <NavDialog :places="[p]"/>
        </article>
      </div>
    </section>
    <section v-for="(module,index) in config.modules" :id="index===0?'first-guide':undefined" :key="module.title" class="content-card visual-module" :class="moduleClass(module)">
      <div class="section-title"><span>{{String(index+1).padStart(2,'0')}}</span><h2>{{module.title}}</h2></div>
      <div v-if="module.columns" class="suitability-grid">
        <article v-for="column in module.columns" :key="column.title">
          <span class="weather-icon">{{column.icon}}</span><h3>{{column.title}}</h3>
          <ul><li v-for="item in column.items" :key="item">{{item}}</li></ul>
        </article>
      </div>
      <ol v-else class="module-items">
        <li v-for="(item,itemIndex) in module.items" :key="item">
          <span v-if="['steps','numbered','checklist'].includes(module.variant)" class="item-index">{{module.variant==='checklist'?'✓':String(itemIndex+1).padStart(2,'0')}}</span>
          <i v-if="['timeline','sequence'].includes(module.variant)" class="route-dot"></i>
          <template v-if="module.variant==='choices'"><strong>{{itemParts(item).title}}</strong><small>{{itemParts(item).note}}</small></template>
          <template v-else>{{item}}</template>
        </li>
      </ol>
    </section>
    <section class="dad-tip"><span>奶爸提醒</span><p>{{config.dadTip}}</p></section>
    <section class="content-card video-card">
      <p class="eyebrow">真实画面以后补上</p><h2>我拍过这里</h2>
      <div class="video-thumb"><MediaPlaceholder :label="config.videoLabel" :tone="config.kind" :src="videoImage"/><button type="button" disabled>▶</button></div>
      <p>{{config.mediaText}}</p>
    </section>
    <section class="content-card nearby-card"><h2>附近还可以去</h2><div class="nearby"><span v-for="p in nearby" :key="p.code">{{p.name}}</span></div></section>
    <section class="journey-next"><p>沿一号风景道继续</p><div class="prev-next"><div><small>← 上一站</small><strong>{{around.previous?.name||'从这里开始'}}</strong></div><div><small>下一站 →</small><strong>{{around.next?.name||'路线终点'}}</strong></div></div></section>
    <BottomBar :places="navPlaces" @map="map=true"/>
    <MapOverlay v-if="map" :places="places" :scope="detailMapScope" @close="map=false"/>
  </template>
  <section v-else class="not-found"><h1>页面不存在</h1><RouterLink to="/">返回首页</RouterLink></section>
</template>

