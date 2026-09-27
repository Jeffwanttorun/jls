<script setup lang="ts">
import {onBeforeUnmount,onMounted,ref,watch} from 'vue';
import type {Place} from '../types';
import {loadMap} from '../tencent';
import {corridorEnd,corridorGeometry,corridorRouteSegments,corridorStart} from '../routeConfig';

const props=withDefaults(defineProps<{
  items:Place[];
  highlight?:string[];
  compact?:boolean;
  showRoute?:boolean;
  showRouteKey?:boolean;
  routeMode?:boolean;
  dimOthers?:boolean;
  fitItems?:boolean;
  focusZoom?:number;
}>(),{highlight:()=>[],compact:false,showRoute:false,showRouteKey:false,routeMode:false,dimOthers:false,fitItems:false,focusZoom:15});
const emit=defineEmits<{select:[place:Place]}>();
const container=ref<HTMLElement>();
const loading=ref(true),error=ref('');
let map:any,markers:any,routeLine:any,disposed=false,sdk:any,currentZoom=11;

function bottlePin(color:string,size=30){
  const padding=5,width=size+padding*2,visualHeight=size+8,height=visualHeight+padding*2;
  const cx=width/2,top=padding+1,radius=(size-2)/2,cy=top+radius,left=cx-radius,right=cx+radius,tipY=padding+visualHeight-1;
  const path=`M ${cx} ${tipY} C ${cx-3} ${tipY-6}, ${left} ${cy+radius*.45}, ${left} ${cy} A ${radius} ${radius} 0 1 1 ${right} ${cy} C ${right} ${cy+radius*.45}, ${cx+3} ${tipY-6}, ${cx} ${tipY} Z`;
  const symbolScale=Math.max(.68,size/30);
  const medallionRadius=radius*.76;
  const iconStroke=Math.max(1.15,1.7*symbolScale);
  const bottle=`<circle cx="${cx}" cy="${cy}" r="${medallionRadius}" fill="#fffaf1"/><g transform="translate(${cx} ${cy}) rotate(-10) scale(${symbolScale})" fill="none" stroke="${color}" stroke-width="${iconStroke}" stroke-linecap="round" stroke-linejoin="round"><path d="M-2.4-6h4.8v2.4c0 .8.6 1.4 1.4 1.9C5-.9 5.8.4 5.8 2v5.2c0 2.1-1.6 3.8-3.7 3.8h-4.2c-2.1 0-3.7-1.7-3.7-3.8V2c0-1.6.8-2.9 2-3.7.8-.5 1.4-1.1 1.4-1.9V-6Z"/><path d="M-4.5 3.2h9M-3.5 6.2h7"/><rect x="-3.6" y="-8.6" width="7.2" height="2.6" rx="1" fill="${color}" stroke="none"/><path d="M-2.1-8.6c.2-2 1-3 2.1-3s1.9 1 2.1 3Z" fill="${color}" stroke="none"/></g>`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" data-symbol="baby-bottle" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" overflow="visible"><path d="${path}" fill="${color}" stroke="white" stroke-width="2" stroke-linejoin="round"/>${bottle}</svg>`;
  return {width,height,anchor:{x:cx,y:tipY+1},src:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)};
}
const routeBadge=(label:string,color:string)=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="17" fill="'+color+'" stroke="white" stroke-width="3"/><text x="20" y="25" text-anchor="middle" font-size="14" font-weight="700" fill="white">'+label+'</text></svg>');

function markerItems(){
  return props.routeMode&&currentZoom<13?props.items.filter(place=>!place.service):props.items;
}

function styleFor(place:Place){
  if(props.routeMode&&place.code===corridorStart.code)return 'routeStart';
  if(props.routeMode&&place.code===corridorEnd.code)return 'routeEnd';
  if(props.highlight.includes(place.code))return 'focus';
  if(props.dimOthers)return 'muted';
  return place.service?'service':'core';
}

function drawMarkers(){
  if(!markers||!sdk)return;
  markers.setGeometries(markerItems().map(place=>({id:place.code,styleId:styleFor(place),position:new sdk.LatLng(place.latitude,place.longitude),properties:{code:place.code}})));
}

function drawRoute(){
  if(!map||!sdk?.MultiPolyline||!sdk?.PolylineStyle)return;
  routeLine?.setMap(null);
  routeLine=null;
  if(!props.showRoute)return;
  routeLine=new sdk.MultiPolyline({
    map,
    styles:{corridor:new sdk.PolylineStyle({
      color:props.routeMode?'rgba(23,107,76,.84)':'rgba(23,107,76,.36)',
      width:props.routeMode?6:3,
      borderWidth:1,
      borderColor:'rgba(255,255,255,.9)',
      lineCap:'round'
    })},
    geometries:corridorRouteSegments.map(segment=>({
      id:segment.id,
      styleId:'corridor',
      paths:segment.path.map(point=>new sdk.LatLng(point.latitude,point.longitude)),
      properties:{kind:'main-corridor',label:segment.label}
    }))
  });
}

function fitRoute(){
  if(!props.routeMode||!map||!sdk)return;
  try{
    const points=corridorGeometry.map(point=>new sdk.LatLng(point.latitude,point.longitude));
    const bounds=new sdk.LatLngBounds(points[0],points[0]);
    points.slice(1).forEach(point=>bounds.extend(point));
    map.fitBounds(bounds,{padding:{top:150,right:36,bottom:110,left:36}});
  }catch{
    const middle=corridorGeometry[Math.floor(corridorGeometry.length/2)];
    map.setCenter(new sdk.LatLng(middle.latitude,middle.longitude));
    map.setZoom(10);
  }
}

function fitPlaces(){
  if((!props.compact&&!props.fitItems)||!map||!sdk||!props.items.length)return;
  const highlighted=props.items.filter(place=>props.highlight.includes(place.code));
  const places=highlighted.length?highlighted:props.items;
  const points=places.map(place=>new sdk.LatLng(place.latitude,place.longitude));
  if(points.length===1){map.setCenter(points[0]);map.setZoom(props.compact?13:props.focusZoom);return;}
  try{
    const bounds=new sdk.LatLngBounds(points[0],points[0]);
    points.slice(1).forEach(point=>bounds.extend(point));
    map.fitBounds(bounds,{padding:30});
  }catch{}
}

async function init(){
  try{
    sdk=await loadMap();
    if(disposed||!container.value)return;
    const focus=props.items.filter(place=>props.highlight.includes(place.code));
    const base=focus.length?focus:props.items;
    const center=base.reduce((value,place)=>({latitude:value.latitude+place.latitude/base.length,longitude:value.longitude+place.longitude/base.length}),{latitude:0,longitude:0});
    currentZoom=props.compact?13:11;
    map=new sdk.Map(container.value,{center:new sdk.LatLng(center.latitude||27.76,center.longitude||117.99),zoom:currentZoom,pitch:0,rotation:0});
    markers=new sdk.MultiMarker({map,styles:{
      core:new sdk.MarkerStyle(bottlePin('#1f6b4f',30)),
      service:new sdk.MarkerStyle(bottlePin('#718078',22)),
      focus:new sdk.MarkerStyle(bottlePin('#e56a3a',38)),
      muted:new sdk.MarkerStyle(bottlePin('#9aa8a2',20)),
      routeStart:new sdk.MarkerStyle({width:40,height:40,anchor:{x:20,y:20},src:routeBadge('起','#176b4c')}),
      routeEnd:new sdk.MarkerStyle({width:40,height:40,anchor:{x:20,y:20},src:routeBadge('终','#d36d32')})
    },geometries:[]});
    markers.on('click',(event:any)=>{
      const place=props.items.find(item=>item.code===event.geometry?.id);
      if(place)emit('select',place);
    });
    map.on?.('zoom_changed',()=>{currentZoom=map.getZoom();drawMarkers();});
    drawRoute();
    drawMarkers();
    if(props.routeMode)setTimeout(fitRoute,50);
    else if(props.compact||props.fitItems)setTimeout(fitPlaces,50);
  }catch(reason){
    error.value=(reason as Error).message;
  }finally{
    loading.value=false;
  }
}

watch(()=>[props.items,props.highlight,props.dimOthers],()=>{drawMarkers();if(props.compact||props.fitItems)setTimeout(fitPlaces,20);},{deep:true});
watch(()=>[props.showRoute,props.routeMode],()=>{drawRoute();drawMarkers();if(props.routeMode)setTimeout(fitRoute,20);},{deep:true});
onMounted(init);
onBeforeUnmount(()=>{disposed=true;routeLine?.setMap(null);markers?.setMap(null);map?.destroy();});
</script>

<template>
  <div class="map-wrap" :class="{compact,'route-mode':routeMode}">
    <div ref="container" class="map-canvas" aria-label="腾讯地图"></div>
    <div v-if="showRoute&&showRouteKey" class="route-map-key" :class="{strong:routeMode}"><i></i><span>一号风景道 · 南源岭至坳头村</span></div>
    <div v-if="loading||error" class="map-cover" role="status">{{loading?'正在加载地图…':error}}</div>
  </div>
</template>

