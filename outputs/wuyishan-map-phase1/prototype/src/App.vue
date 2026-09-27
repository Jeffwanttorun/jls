<script setup lang="ts">
import {computed,onMounted,ref,watch} from 'vue';
import {useRoute,useRouter} from 'vue-router';
import {useVisitorPresentation} from './presentation';
const route=useRoute(),router=useRouter(),menu=ref(false);
const presentation=useVisitorPresentation();onMounted(presentation.load);
const isHome=computed(()=>route.path==='/');
const currentTitle=computed(()=>route.path==='/corridor'?'一号风景道':route.params.previewId?'草稿预览':route.params.code?'地点详情':route.params.slug?presentation.contents.value.find(item=>item.document.slug===String(route.params.slug))?.document.title:route.params.theme?presentation.themes.value.find(theme=>theme.id===String(route.params.theme))?.name:'');
watch(()=>route.fullPath,()=>menu.value=false);
function back(){if(history.length>1)router.back();else router.push('/');}
</script>

<template>
  <header class="site-head" :class="{home:isHome}">
    <button v-if="!isHome" class="head-action" type="button" aria-label="返回" @click="back">←</button>
    <RouterLink class="brand" to="/">
      <strong>武夷山奶爸地图</strong><small v-if="currentTitle">{{currentTitle}}</small>
    </RouterLink>
    <button class="head-action menu-trigger" type="button" aria-label="菜单" :aria-expanded="menu" @click="menu=!menu">•••</button>
    <Transition name="fade">
      <nav v-if="menu" class="site-menu" aria-label="主菜单">
        <RouterLink to="/"><span>⌂</span>首页</RouterLink>
        <RouterLink :to="{path:'/',query:{map:'1'}}"><span>⌖</span>地图</RouterLink>
        <RouterLink to="/corridor"><span>↝</span>一号风景道</RouterLink>
      </nav>
    </Transition>
  </header>
  <main><RouterView/></main>
</template>
