<script setup lang="ts">
import {computed,onMounted,onBeforeUnmount,ref,watch} from 'vue';
import {loadTencentMap,type MapHandle,type MarkerHandle,type TencentSDK} from './tencent-map';
import {preferredBasemap,lastPickerView,rememberPickerView,type Basemap} from './map-preferences';
import {satelliteReference} from '../../shared/coordinates';
import {visibleMapPlaces,type MapPlace} from '../../shared/coordinates';
const props=withDefaults(defineProps<{items?:MapPlace[];pick?:boolean;automaticCandidate?:boolean;rememberView?:boolean;center?:{latitude:number;longitude:number}|null;selected?:{latitude:number;longitude:number}|null}>(),{items:()=>[],pick:false});
const emit=defineEmits<{select:[code:string];pick:[point:{latitude:number;longitude:number;source_reference:string}]}>();
const container=ref<HTMLElement>(),error=ref(''),loading=ref(true),zoom=ref(12);
let map:MapHandle|undefined,markers:MarkerHandle|undefined,sdk:TencentSDK|undefined,disposed=false;
const basemap=ref<Basemap>(preferredBasemap.value);
function baseOptions(value:Basemap){return value==='satellite'?{type:'satellite' as const,features:['base','road']}:{type:'vector' as const};}
function changeBasemap(value:Basemap){if(!map)return;try{map.setBaseMap(baseOptions(value));basemap.value=value;preferredBasemap.value=value;error.value='';}catch{error.value='底图切换失败，请检查网络后重试地图。';}}
const shown=computed(()=>visibleMapPlaces(props.items,zoom.value));
const symbol=(fill:string)=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36"><path d="M14 35C10 27 1 21 1 14a13 13 0 0126 0c0 7-9 13-13 21" fill="${fill}" stroke="white" stroke-width="2"/><circle cx="14" cy="14" r="4" fill="white"/></svg>`);
function draw(){if(!sdk||!markers)return;
 const data=shown.value.map(p=>({id:p.code,styleId:p.map_display_role==='group'?'group':p.parent_code?'child':'parent',position:new sdk!.LatLng(p.latitude,p.longitude),properties:{code:p.code}}));
 if(props.pick&&props.selected)data.push({id:'selected',styleId:'selected',position:new sdk.LatLng(props.selected.latitude,props.selected.longitude),properties:{code:'selected'}});
 markers.setGeometries(data);
}
async function initialize(){markers?.setMap(null);map?.destroy();map=undefined;markers=undefined;error.value='';loading.value=true;try{
 sdk=await loadTencentMap();if(disposed||!container.value)return;
 const previous=props.rememberView?lastPickerView:null;
 const center=props.center||previous||props.items[0]||{latitude:27.76,longitude:117.99};
 map=new sdk.Map(container.value,{center:new sdk.LatLng(center.latitude,center.longitude),zoom:props.center?(props.pick?15:12):previous?.zoom??(props.pick?15:12),pitch:0,rotation:0,baseMap:baseOptions(basemap.value)});zoom.value=map.getZoom();
 markers=new sdk.MultiMarker({map,styles:{group:new sdk.MarkerStyle({width:28,height:28,anchor:{x:14,y:14},src:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><rect x="1" y="1" width="26" height="26" rx="5" fill="#7256a1" stroke="white" stroke-width="2"/><path d="M8 8h12v12H8z" fill="none" stroke="white" stroke-width="2"/></svg>')}),parent:new sdk.MarkerStyle({width:28,height:36,anchor:{x:14,y:36},src:symbol('#176348')}),child:new sdk.MarkerStyle({width:28,height:36,anchor:{x:14,y:36},src:symbol('#296bbb')}),selected:new sdk.MarkerStyle({width:28,height:36,anchor:{x:14,y:36},src:symbol('#b64e18')})},geometries:[]});
 map.on('zoom_changed',()=>{zoom.value=map!.getZoom();draw();});
 map.on('click',e=>{if(props.pick&&e.latLng)emit('pick',{latitude:e.latLng.getLat(),longitude:e.latLng.getLng(),source_reference:basemap.value==='satellite'?satelliteReference:'腾讯标准地图人工判点'});});
 markers.on('click',e=>{if(!props.pick&&e.geometry?.id)emit('select',e.geometry.id);});draw();
}catch(e){error.value=(e as Error).message;}finally{loading.value=false;}}
watch(()=>props.items,draw);watch(()=>props.selected,draw);
watch(()=>props.center,c=>{if(c&&sdk&&map)map.setCenter(new sdk.LatLng(c.latitude,c.longitude));});
onMounted(initialize);onBeforeUnmount(()=>{disposed=true;if(props.rememberView&&map){const c=map.getCenter();rememberPickerView({latitude:c.getLat(),longitude:c.getLng(),zoom:map.getZoom()});}markers?.setMap(null);map?.destroy();});
</script>
<template><div class="actions map-toolbar" role="group" aria-label="底图类型"><button type="button" :class="basemap==='standard'?'':'secondary'" :aria-pressed="basemap==='standard'" :disabled="loading||!!error" @click="changeBasemap('standard')">标准地图</button><button type="button" :class="basemap==='satellite'?'':'secondary'" :aria-pressed="basemap==='satellite'" :disabled="loading||!!error" @click="changeBasemap('satellite')">卫星影像</button></div><div class="map-shell"><div ref="container" class="map-canvas" aria-label="腾讯内部地图"></div>
 <div v-if="loading||error" class="map-message" role="status"><p>{{loading?'正在加载腾讯地图…':error}}</p><button v-if="error" type="button" class="secondary" @click="initialize">重试地图</button></div></div>
 <p v-if="!error&&!loading" class="muted">{{basemap==='satellite'?'卫星影像':'标准地图'}}<template v-if="!automaticCandidate"> · GCJ-02</template> · 缩放 {{zoom.toFixed(1)}}<template v-if="!pick"> · 当前显示 {{shown.length}} 个地点；14 级起展开子地点。</template><template v-else> · {{automaticCandidate?'点选后自动保存候选，点击“确认此位置”完成确认。':'点击地图选择位置，保存后仍需人工确认。'}}</template></p>
 <ul v-if="!pick&&shown.length" class="map-place-links"><li v-for="p in shown" :key="p.code"><button type="button" class="secondary" @click="emit('select',p.code)">{{p.map_display_role==='group'?'[集合] ':''}}{{p.code}} {{p.name}}</button> · {{p.public_level}} · {{p.current_status}}</li></ul>
</template>
