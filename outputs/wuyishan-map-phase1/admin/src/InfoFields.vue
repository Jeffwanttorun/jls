<script setup lang="ts">
import { display } from './api';
defineProps<{data:Record<string,unknown>|null;fields:Record<string,string>}>();
</script>
<template><dl v-if="data" class="facts"><div v-for="(label,key) in fields" :key="key"><dt>{{label}}</dt><dd>{{display(data[key])}}</dd></div></dl><p v-else class="muted">尚无记录。</p></template>
