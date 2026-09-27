<script setup lang="ts">
import {computed} from 'vue';
const props=withDefaults(defineProps<{label:string;tone?:string;compact?:boolean;split?:boolean;src?:string;srcs?:string[]}>(),{tone:'forest',compact:false,split:false,src:'',srcs:()=>[]});
const photos=computed(()=>props.srcs.length?props.srcs:props.src?[props.src]:[]);
</script>

<template>
  <div class="media-art" :class="[tone,{compact,split,'has-photo':photos.length}]" role="group" :aria-label="photos.length?label:label+'，等待真实素材'">
    <div v-if="photos.length" class="media-carousel"><figure v-for="(photo,index) in photos" :key="photo"><img class="media-photo" :src="photo" :alt="`${label}，第 ${index+1} 张`"><span v-if="photos.length>1">{{index+1}} / {{photos.length}}</span></figure></div>
    <template v-else><div class="sun"></div><div class="ridge back"></div><div class="ridge front"></div><div class="water"></div><span class="material-status">等待真实素材</span><strong>{{label}}</strong></template>
    <div v-if="split" class="split-lines"><i></i><i></i></div>
  </div>
</template>
