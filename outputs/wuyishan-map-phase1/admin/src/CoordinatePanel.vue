<script setup lang="ts">
import {computed,ref,watch} from 'vue';
import CoordinateManager from './CoordinateManager.vue';
import CoordinateQueue from './CoordinateQueue.vue';
import QuickSatellitePicker from './QuickSatellitePicker.vue';
const props=defineProps<{place:any;relocateRevision?:number}>(),emit=defineEmits<{changed:[]}>();
const active=computed(()=>props.place.coordinates.find((c:any)=>c.status==='active'));
const advanced=ref(false),busy=ref(false),relocating=ref(false);
watch(()=>props.relocateRevision,value=>{if(value){advanced.value=false;relocating.value=true;}},{immediate:true});
function toggle(event:Event){const open=(event.target as HTMLDetailsElement).open;advanced.value=open;if(open)emit('changed');}
</script>
<template>
 <QuickSatellitePicker v-if="!active&&!advanced&&!relocating" :place="place" @changed="emit('changed')" @advanced="advanced=true" @busy="busy=$event"/>
 <section v-else-if="active" class="current-summary"><h2>当前正式坐标</h2><p>{{active.map_latitude}}, {{active.map_longitude}} · {{active.map_coordinate_system}}</p><p>已有正式坐标。可使用上方“重新定位”或“删除定位”；替换需要明确确认，旧记录保留。</p></section>
 <section v-if="relocating" class="relocation-panel"><h2>重新定位</h2><button type="button" class="secondary" @click="relocating=false">收起重新定位</button><CoordinateManager :place="place" continuous @changed="emit('changed')"/></section>
 <details v-if="!relocating" class="advanced-coordinates" :open="advanced" @toggle="toggle"><summary :aria-disabled="busy" @click="event=>{if(busy)event.preventDefault()}">高级操作</summary><p>手机 GPS、手工输入、坐标系、来源详情、候选历史、替换与撤销。</p><CoordinateQueue v-if="advanced" :current-code="place.code" :complete="!!active" :revision="place"/><CoordinateManager v-if="advanced" :place="place" continuous @changed="emit('changed')"/></details>
</template>
