<script setup lang="ts">
import {computed} from 'vue';import {openingDisplay} from '../../shared/place-opening';import type {StudioPlace} from './content-studio-api';
const props=withDefaults(defineProps<{place:StudioPlace;locale?:'zh'|'en';details?:boolean}>(),{locale:'zh'});const info=computed(()=>openingDisplay(props.place,props.locale));
</script>
<template><div class="opening-display" :lang="locale==='zh'?'zh-CN':'en'"><strong>{{info.operating}}</strong><span>{{info.schedule}}</span><small v-if="info.caution" class="opening-caution">{{info.caution}}</small><template v-if="details"><p v-if="info.hours">{{locale==='zh'?'开放时段':'Hours'}}：{{info.hours}}</p><p v-if="info.notes">{{info.notes}}</p><p v-if="info.source">{{locale==='zh'?'信息来源':'Source'}}：{{info.source}}</p><small v-if="info.lastVerifiedAt">{{locale==='zh'?'开放安排最后核实':'Opening schedule last verified'}}：{{info.lastVerifiedAt}}</small></template></div></template>
