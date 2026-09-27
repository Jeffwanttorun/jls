<script setup lang="ts">
import {computed,onMounted,ref} from 'vue';
import {usePlaces} from '../data';
import {imageFor,useVisitorPresentation} from '../presentation';
import MapOverlay from '../components/MapOverlay.vue';
import NavDialog from '../components/NavDialog.vue';
import MediaPlaceholder from '../components/MediaPlaceholder.vue';
import {corridorMapScope,themeMapScope} from '../mapScope';

const {places,load}=usePlaces();
const presentation=useVisitorPresentation();
const map=ref(false),selected=ref<any>(null),segmentMap=ref<any[]>([]);
onMounted(()=>Promise.all([load(),presentation.load()]));
const segments=computed(()=>presentation.contents.value.find(item=>item.document.slug==='corridor')?.document.modules.filter(item=>!item.hidden&&item.kind==='route_segment').sort((a,b)=>a.sequence-b.sequence).map(item=>({name:item.title,range:[Number(item.items[0]),Number(item.items[1])],experience:item.body,stay:item.items[2]||'',icon:item.items[3]||'•'}))||[]);
const groups=computed(()=>segments.value.map(s=>({...s,places:places.value.filter(p=>!p.service&&p.corridor_order!==null&&p.corridor_order>=s.range[0]&&p.corridor_order<=s.range[1])})));
const detail:Record<string,string>={'WY-0048':'xingcun','WY-0050':'xingcun','WY-0040':'tea','WY-0024':'butterfly','WY-0028':'butterfly'};
function openSegment(items:any[]){segmentMap.value=items;map.value=true;}
</script>

<template>
  <section class="corridor-hero">
    <MediaPlaceholder label="一号风景道沿途风景" tone="route" :src="imageFor(presentation.state.value,'corridor.hero')"/>
    <div class="hero-copy">
      <p class="eyebrow">从南源岭慢慢走到坳头村</p>
      <h1>一号风景道</h1>
      <p class="route-line">南源岭 → 星村 → 漫水桥 → 黄村 → 红星 → 月亮湾 → 桃源峪 → 大竹岚 → 坳头村</p>
      <p>不是赶景点的一条路线。可以沿路吃点东西、看展馆、到河边、观察自然，再慢慢往里走。</p>
      <button class="primary route-map-button" type="button" @click="segmentMap=[];map=true">打开整条路线地图</button>
    </div>
  </section>

  <section class="timeline-intro">
    <p class="eyebrow">一路向山里</p><h2>按自己的节奏慢慢走</h2>
  </section>
  <section class="route-timeline">
    <article v-for="(segment,index) in groups" :key="segment.name" class="timeline-stop">
      <div class="timeline-marker"><span>{{segment.icon}}</span></div>
      <div class="segment-card">
        <div class="segment-title"><div><small>{{String(index+1).padStart(2,'0')}}</small><h2>{{segment.name}}</h2></div><span>{{segment.stay}}</span></div>
        <p>{{segment.experience}}</p>
        <div class="place-chips">
          <template v-for="p in segment.places.slice(0,3)" :key="p.code">
            <RouterLink v-if="detail[p.code]" :to="'/place/'+detail[p.code]">{{p.name}}</RouterLink>
            <button v-else type="button" @click="selected=p">{{p.name}}</button>
          </template>
          <RouterLink v-if="segment.name==='漫水桥段'" to="/place/manshui">漫水桥</RouterLink>
        </div>
        <button class="segment-open" type="button" @click="openSegment(segment.places)">查看这一段 <span>→</span></button>
      </div>
    </article>
  </section>
  <div v-if="selected" class="shade" @click.self="selected=null">
    <section class="dialog compact-dialog" role="dialog" aria-label="沿路地点">
      <p class="eyebrow">沿路地点</p><h2>{{selected.name}}</h2><p>{{selected.region}}</p>
      <NavDialog :places="[selected]"/><button class="sheet-cancel" type="button" @click="selected=null">关闭</button>
    </section>
  </div>
  <MapOverlay
    v-if="map"
    :places="places"
    :scope="segmentMap.length?themeMapScope('一号风景道当前路段',segmentMap):corridorMapScope()"
    @close="map=false"
  />
</template>
