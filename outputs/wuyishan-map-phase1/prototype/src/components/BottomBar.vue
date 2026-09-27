<script setup lang="ts">
import type {Place} from '../types';
import NavDialog from './NavDialog.vue';

defineProps<{places:Place[]}>();
defineEmits<{map:[]}>();
</script>

<template>
  <nav class="bottom-bar" aria-label="页面快捷操作">
    <button class="bottom-action" type="button" @click="$emit('map')"><span>⌖</span>查看地图</button>
    <NavDialog :places="places" label="导航到这里"/>
    <RouterLink to="/corridor"><span>↝</span>一号风景道</RouterLink>
  </nav>
</template>
