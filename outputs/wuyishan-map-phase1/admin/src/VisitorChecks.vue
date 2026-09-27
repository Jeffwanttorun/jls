<script setup lang="ts">
import {computed,onMounted,ref} from 'vue';
import {getVisitorState,type VIssue,type VPayload} from './visitor-content-api';
const payload=ref<VPayload|null>(null);
onMounted(async()=>payload.value=await getVisitorState());
const groups=computed<Array<[string,VIssue[]]>>(()=>{const map=new Map<string,VIssue[]>();for(const issue of payload.value?.issues||[]){const list=map.get(issue.kind)||[];list.push(issue);map.set(issue.kind,list);}return [...map.entries()];});
</script>
<template><div class="workspace-page"><div class="workspace-title"><div><p class="kicker">发布前自查</p><h1>内容检查</h1><p>集中发现主题、导航、失效地点和在建提醒问题。</p></div><span class="check-count">{{payload?.issues.length||0}} 项</span></div><section v-if="payload&&!payload.issues.length" class="check-clear"><strong>当前没有检查问题</strong><p>发布状态、引用和导航规则均通过。</p></section><section v-for="[kind,items] in groups" :key="kind" class="check-group"><h2>{{kind}}</h2><RouterLink v-for="issue in items" :key="issue.id" :to="issue.href"><strong>{{issue.title}}</strong><span>{{issue.message}}</span><b>去修正 →</b></RouterLink></section></div></template>
