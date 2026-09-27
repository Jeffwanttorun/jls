<script setup lang="ts">
import {computed,onMounted,ref,watch} from 'vue';
import {useRoute,useRouter} from 'vue-router';
import {alertsFor,imageFor,imagesFor,labelsForContent,labelsForPlace,useVisitorPresentation} from '../presentation';
import {usePlaces} from '../data';
import type {Place} from '../types';
import PrototypeMap from '../components/PrototypeMap.vue';
import MapOverlay from '../components/MapOverlay.vue';
import NavDialog from '../components/NavDialog.vue';
import MediaPlaceholder from '../components/MediaPlaceholder.vue';
import {placeMapScope,themeMapScope,type MapScope} from '../mapScope';

const props=defineProps<{theme:string}>();
const {places,load}=usePlaces(),presentation=useVisitorPresentation();
const mapScope=ref<MapScope|null>(null),route=useRoute(),router=useRouter();
const kidsOnly=computed(()=>route.query.kids==='1');
onMounted(()=>Promise.all([load(),presentation.load()]));
watch(()=>props.theme,()=>{mapScope.value=null;window.scrollTo(0,0);});
const config=computed(()=>presentation.state.value?.themes.find(theme=>theme.id===props.theme));
const cards=computed(()=>{
 const state=presentation.state.value;if(!state||!config.value)return [];
 const byCode=new Map(places.value.map(place=>[place.code,place]));
 const rawAssignments=state.placeAssignments.filter(item=>item.themeIds.includes(props.theme)).sort((a,b)=>(a.orderByTheme[props.theme]??99999)-(b.orderByTheme[props.theme]??99999));
 const assignments=rawAssignments;
 const placeCards=assignments.map(assignment=>{
  const place=byCode.get(assignment.placeCode);if(!place)return null;
  const detail=state.contents.find(content=>content.document.slug!=='corridor'&&content.document.placeLinks.some(link=>link.placeCode===place.code));
  return {key:'place-'+place.code,place,title:assignment.titleByTheme[props.theme]||place.name,summary:assignment.summaryByTheme[props.theme]||`${config.value!.name}主题下的沿路体验`,detailSlug:detail?.document.slug||'',familyFriendly:assignment.familyFriendly,facilities:assignment.facilities,labels:labelsForPlace(state,place.code),alerts:alertsFor(state,[place.code]),images:imagesFor(state,`place.${place.code}.cover`,detail?`content.${detail.id}.cover`:null)};
 }).filter((item):item is NonNullable<typeof item>=>Boolean(item));
 const represented=new Set(assignments.map(item=>item.placeCode));
 const contentCards=state.contents.filter(content=>content.document.themeIds.includes(props.theme)&&!content.document.placeLinks.some(link=>represented.has(link.placeCode))).sort((a,b)=>(a.document.themeOrder?.[props.theme]??99999)-(b.document.themeOrder?.[props.theme]??99999)).map(content=>{
  const target=content.document.navigationTargets.find(item=>item.isDefault)||content.document.navigationTargets[0];const place=target?byCode.get(target.placeCode):undefined;
  return {key:'content-'+content.id,place:place||null,title:content.document.title,summary:content.document.summary,detailSlug:content.document.slug,familyFriendly:content.document.familyFriendly,facilities:state.placeAssignments.find(item=>item.placeCode===place?.code)?.facilities,labels:labelsForContent(state,content),alerts:alertsFor(state,content.document.placeLinks.map(link=>link.placeCode),content.id),images:imagesFor(state,`content.${content.id}.cover`,place?`place.${place.code}.cover`:null)};
 });
 return [...placeCards,...contentCards].filter(card=>!kidsOnly.value||card.familyFriendly);
});
const themePlaces=computed(()=>{const found=new Map<string,Place>();for(const card of cards.value)if(card.place)found.set(card.place.code,card.place);return [...found.values()];});
function toggleKids(){router.replace({path:'/theme/'+props.theme,query:kidsOnly.value?{}:{kids:'1'}});}
function openThemeMap(){mapScope.value=themeMapScope(`${config.value?.name||''}${kidsOnly.value?' · 适合带孩子':''}`,themePlaces.value);}
function openPlaceMap(place:Place|null){if(place)mapScope.value=placeMapScope(place);}
</script>

<template>
  <template v-if="config">
    <section class="theme-hero" :class="[config.tone,{'has-theme-photo':imageFor(presentation.state.value,`theme.${config.id}.hero`)}]" :style="imageFor(presentation.state.value,`theme.${config.id}.hero`)?{backgroundImage:`linear-gradient(90deg,rgba(15,58,43,.86),rgba(15,58,43,.38)),url(${imageFor(presentation.state.value,`theme.${config.id}.hero`)})`}:{}">
      <p class="eyebrow">{{config.eyebrow}}</p>
      <div class="theme-heading"><span>{{config.icon}}</span><h1>{{config.name}}</h1></div>
      <p>{{config.description}}</p>
      <button class="kids-filter" :class="{active:kidsOnly}" type="button" :aria-pressed="kidsOnly" @click="toggleKids"><span>✓</span>适合带孩子</button>
      <button class="primary blue" type="button" @click="openThemeMap">查看地图</button>
    </section>

    <section class="theme-map-card">
      <div class="section-head"><div><p class="eyebrow">沿一号风景道分布</p><h2>这些地方值得先看</h2></div><small>{{cards.length}} 个体验</small></div>
      <PrototypeMap :items="themePlaces" :highlight="themePlaces.map(place=>place.code)" show-route compact/>
    </section>

    <section class="theme-results" aria-label="主题地点">
      <article v-for="card in cards" :key="card.key" class="theme-place-card">
        <MediaPlaceholder :label="card.title" :tone="config.tone" :srcs="card.images" compact/>
        <div class="theme-place-copy">
          <p class="eyebrow">{{card.place?.region||'一号风景道沿线'}}</p>
          <div class="place-title-line"><h2>{{card.title}}</h2><span v-if="card.place?.status==='在建'" class="construction-badge">在建</span></div>
          <p>{{card.summary}}</p>
          <div class="multi-theme-tags"><span v-for="label in card.labels" :key="label" :class="{family:label==='适合带孩子'}">{{label}}</span><template v-if="card.facilities"><span v-if="card.facilities.toilet" class="facility-tag">卫生间</span><span v-if="card.facilities.shop" class="facility-tag">商店</span><span v-if="card.facilities.restaurant" class="facility-tag">餐馆</span><span v-if="card.facilities.lodging" class="facility-tag">住宿</span></template></div>
          <RouterLink v-if="card.detailSlug" class="button secondary" :to="'/place/'+card.detailSlug">查看详情</RouterLink>
          <div v-else-if="card.place" class="theme-place-actions">
            <NavDialog :places="[card.place]" label="导航到这里"/>
            <button class="secondary" type="button" @click="openPlaceMap(card.place)">查看地图</button>
          </div>          <div v-for="alert in card.alerts" :key="alert.id" class="visitor-alert theme-card-alert" :class="'level-'+alert.level"><strong>{{alert.level}}</strong><span>{{alert.text}}</span></div>
        </div>
      </article>
      <p v-if="kidsOnly&&!cards.length" class="theme-empty">这个主题暂时没有标记为适合带孩子的内容。</p>
    </section>
    <MapOverlay v-if="mapScope" :places="places" :scope="mapScope" @close="mapScope=null"/>
  </template>
  <section v-else-if="!presentation.loading.value" class="not-found"><h1>主题不存在</h1><RouterLink to="/">返回首页</RouterLink></section>
</template>



