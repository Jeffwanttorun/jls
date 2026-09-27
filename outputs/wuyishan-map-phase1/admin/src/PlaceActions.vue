<script setup lang="ts">
import NameEditor from './NameEditor.vue';import DeletePosition from './DeletePosition.vue';import DeletePlace from './DeletePlace.vue';
defineProps<{place:{code:string;name:string;updated_at:string};coordinateId:string|null}>();defineEmits<{changed:[];relocate:[];deleted:[]}>();
</script>
<template><div class="place-common-actions" aria-label="地点常用操作"><NameEditor :place="place" @changed="$emit('changed')"/><button type="button" class="secondary" @click="$emit('relocate')">重新定位</button><DeletePosition :code="place.code" :name="place.name" :coordinate-id="coordinateId" @changed="$emit('changed')"/><DeletePlace :place="place" @deleted="$emit('deleted')"/></div><p class="muted delete-place-note">删除定位仅撤销当前坐标；删除地点会移入回收站，所有资料仍保留。</p></template>
