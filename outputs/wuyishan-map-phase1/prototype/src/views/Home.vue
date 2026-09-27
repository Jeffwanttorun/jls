<script setup lang="ts">
import {computed,onMounted,ref,watch} from 'vue';
import {useRoute,useRouter} from 'vue-router';
import {usePlaces} from '../data';
import MapOverlay from '../components/MapOverlay.vue';
import MediaPlaceholder from '../components/MediaPlaceholder.vue';
import {imageFor,imagesFor,useVisitorPresentation} from '../presentation';
import {allMapScope} from '../mapScope';

const {places,loading,error,load}=usePlaces(),map=ref(false),route=useRoute(),router=useRouter();
const presentation=useVisitorPresentation();
const themes=presentation.themes;
const home=computed(()=>presentation.state.value?.home);
const heroImage=computed(()=>imageFor(presentation.state.value,'home.hero')||presentation.state.value?.home.heroImage?.url||'');
const manshuiImages=computed(()=>imagesFor(presentation.state.value,`content.${presentation.contents.value.find(item=>item.document.slug==='manshui')?.id}.cover`,'place.WY-0009.cover'));
const moonbayImages=computed(()=>imagesFor(presentation.state.value,'place.WY-0012.cover'));
const butterflyImages=computed(()=>imagesFor(presentation.state.value,'place.WY-0024.cover',`content.${presentation.contents.value.find(item=>item.document.slug==='butterfly')?.id}.cover`));
onMounted(async()=>{await Promise.all([load(),presentation.load()]);if(route.query.map==='1')map.value=true;});
watch(()=>route.query.map,value=>{if(value==='1')map.value=true;});
function closeMap(){map.value=false;if(route.query.map)router.replace('/');}
function themeTarget(slug:string){return '/theme/'+slug;}
</script>

<template>
  <section class="home-hero">
    <MediaPlaceholder label="武夷山沿路风景" tone="forest" :src="heroImage"/>
    <div class="hero-copy">
      <p class="eyebrow light">{{home?.eyebrow}}</p>
      <h1>{{home?.titleLine1}}<br>{{home?.titleLine2}}</h1>
      <p>{{home?.introLine1}}<br>{{home?.introLine2}}</p>
      <div class="hero-actions">
        <button class="primary blue" @click="map=true">{{home?.mapButtonLabel}}</button>
        <RouterLink class="button pale" to="/corridor">{{home?.corridorButtonLabel}}</RouterLink>
      </div>
    </div>
  </section>

  <section class="home-section">
    <div class="theme-grid">
      <RouterLink v-for="theme in themes" :key="theme.name" :to="themeTarget(theme.id)" :class="theme.tone">
        <span class="theme-icon">{{theme.icon}}</span><strong>{{theme.name}}</strong><small>{{home?.themeCardHint}}</small>
      </RouterLink>
    </div>
  </section>

  <section class="home-section route-recommendations">
    <div class="section-head"><div><p class="eyebrow">{{home?.routesEyebrow}}</p><h2>{{home?.routesTitle}}</h2></div></div>
    <div class="route-recommend-grid">
      <RouterLink to="/corridor"><span>亲子</span><strong>{{home?.routeFamilyTitle}}</strong><small>{{home?.routeFamilySummary}}</small><b>→</b></RouterLink>
      <RouterLink to="/corridor"><span>1日</span><strong>{{home?.routeDayTitle}}</strong><small>{{home?.routeDaySummary}}</small><b>→</b></RouterLink>
      <RouterLink to="/corridor"><span>2日</span><strong>{{home?.routeTwoDayTitle}}</strong><small>{{home?.routeTwoDaySummary}}</small><b>→</b></RouterLink>
    </div>
  </section>

  <section class="home-section recommendations">
    <div class="section-head"><div><p class="eyebrow">{{home?.recommendationsEyebrow}}</p><h2>{{home?.recommendationsTitle}}</h2></div><RouterLink to="/corridor">{{home?.recommendationsLinkLabel}}</RouterLink></div>
    <div class="recommend-grid">
      <RouterLink to="/place/manshui" class="recommend-card"><MediaPlaceholder :label="home?.recommendationManshuiTitle||'漫水桥'" tone="water" :srcs="manshuiImages" compact/><span><strong>{{home?.recommendationManshuiTitle}}</strong><small>{{home?.recommendationManshuiSummary}}</small></span></RouterLink>
      <button class="recommend-card" @click="map=true"><MediaPlaceholder :label="home?.recommendationMoonbayTitle||'月亮湾'" tone="mist" :srcs="moonbayImages" compact/><span><strong>{{home?.recommendationMoonbayTitle}}</strong><small>{{home?.recommendationMoonbaySummary}}</small></span></button>
      <RouterLink to="/place/butterfly" class="recommend-card"><MediaPlaceholder :label="home?.recommendationTaoyuanyuTitle||'桃源峪'" tone="leaf" :srcs="butterflyImages" compact/><span><strong>{{home?.recommendationTaoyuanyuTitle}}</strong><small>{{home?.recommendationTaoyuanyuSummary}}</small></span></RouterLink>
    </div>
  </section>
  <p v-if="loading" role="status">正在读取本地地点…</p>
  <p v-if="error" class="error">{{error}}</p>
  <MapOverlay v-if="map" :places="places" :scope="allMapScope()" @close="closeMap"/>
</template>
