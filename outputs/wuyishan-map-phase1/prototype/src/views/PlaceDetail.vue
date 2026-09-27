<script setup lang="ts">
import {computed,onMounted,ref,watch} from 'vue';
import {usePlaces} from '../data';
import type {MapScope} from '../mapScope';
import {placeMapScope} from '../mapScope';
import type {Place} from '../types';
import BottomBar from '../components/BottomBar.vue';
import MapOverlay from '../components/MapOverlay.vue';
import MediaPlaceholder from '../components/MediaPlaceholder.vue';
import NavDialog from '../components/NavDialog.vue';
import {facilitiesForPlace} from '../placeDetailConfig';
import {imagesFor,useVisitorPresentation} from '../presentation';

const props=defineProps<{code:string}>();
const {places,load}=usePlaces();
const presentation=useVisitorPresentation();
const mapScope=ref<MapScope|null>(null);
onMounted(()=>Promise.all([load(),presentation.load()]));
watch(()=>props.code,()=>{mapScope.value=null;window.scrollTo(0,0);});

const place=computed(()=>places.value.find(item=>item.code===props.code));
const parent=computed(()=>place.value?.parent_code?places.value.find(item=>item.code===place.value?.parent_code)||null:null);
const facilities=computed(()=>{
 if(!place.value)return [];
 const configured=presentation.state.value?.placeAssignments.find(item=>item.placeCode===place.value?.code)?.facilities;
 if(!configured)return facilitiesForPlace(place.value.code);
 return ([['toilet','卫生间'],['shop','商店'],['restaurant','餐馆'],['lodging','住宿']] as const).map(([id,label])=>({id,label,available:configured[id],navigationPlaceCode:configured[id]?place.value!.code:undefined,note:`本地点有${label}，可导航到这个地点。`})).filter(item=>item.available);
});

function openMap(target:Place|undefined){if(target)mapScope.value=placeMapScope(target);}
function facilityTarget(code?:string){return code?places.value.find(item=>item.code===code):undefined;}
</script>

<template>
  <template v-if="place">
    <section class="detail-hero place-detail-hero">
      <MediaPlaceholder :label="place.name" :tone="place.service?'mist':'forest'" :srcs="imagesFor(presentation.state.value,`place.${place.code}.cover`)"/>
    </section>
    <section class="detail-hero-copy place-detail-copy">
      <p class="eyebrow">{{place.service?'到达与服务':'一号风景道沿路地点'}}</p>
      <h1>{{place.name}}</h1>
      <p class="lede">{{place.region||'一号风景道沿线'}} · {{place.category_name}}</p>
      <div class="tags"><span>{{place.category_name}}</span><span v-if="place.region">{{place.region}}</span><span>{{place.status}}</span></div>
      <div class="hero-actions"><NavDialog :places="[place]" label="导航到这里"/><button class="secondary" type="button" @click="openMap(place)">查看地图</button></div>
    </section>

    <section v-if="facilities.length" class="content-card place-facilities-card" aria-label="本地点设施">
      <div class="section-head"><div><p class="eyebrow">到了以后怎么办</p><h2>本地点设施</h2></div></div>
      <div v-if="facilities.length" class="facility-list">
        <article v-for="facility in facilities" :key="facility.id" class="facility-row" :class="{unavailable:!facility.available}">
          <span class="facility-mark" aria-hidden="true">{{facility.available?'✓':'×'}}</span>
          <div class="facility-copy"><h3>{{facility.label}}</h3><p>{{facility.note}}</p></div>
          <NavDialog v-if="facility.available&&facilityTarget(facility.navigationPlaceCode)" :places="[facilityTarget(facility.navigationPlaceCode)!]" label="导航"/>
          <button v-else class="facility-nav-disabled" type="button" disabled>导航</button>
        </article>
      </div>
    </section>

    <section class="content-card place-facts-card">
      <p class="eyebrow">地点信息</p><h2>到达前先知道</h2>
      <dl class="place-facts"><div><dt>所属区域</dt><dd>{{place.region||'沿线地点'}}</dd></div><div><dt>内容类型</dt><dd>{{place.category_name}}</dd></div><div><dt>当前状态</dt><dd>{{place.status}}</dd></div><div v-if="parent"><dt>所属地点</dt><dd>{{parent.name}}</dd></div></dl>
      <p class="data-note">导航与地图使用当前正式位置；页面不展示或猜测经纬度。</p>
    </section>

    <BottomBar :places="[place]" @map="openMap(place)"/>
    <MapOverlay v-if="mapScope" :places="places" :scope="mapScope" @close="mapScope=null"/>
  </template>
  <section v-else class="not-found"><h1>地点不存在</h1><RouterLink to="/">返回首页</RouterLink></section>
</template>
