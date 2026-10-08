<script setup lang="ts">
import {onMounted,onBeforeUnmount,ref} from 'vue';
import StudioPlaceEditor from './StudioPlaceEditor.vue';
import type {StudioPayload,StudioRoute,ContentStudioDocument} from './content-studio-api';
import type {PlaceCreationContext} from '../../shared/studio-place-creation';
defineProps<{payload:StudioPayload;routeDraft?:StudioRoute;context?:PlaceCreationContext;initialPoint?:{latitude:number;longitude:number}}>();
defineEmits<{cancel:[];created:[result:{id:string;draftRevision:number;document:ContentStudioDocument}]}>();
const panel=ref<HTMLElement>();let oldOverflow='',previous:HTMLElement|null=null;
onMounted(()=>{previous=document.activeElement as HTMLElement;oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';panel.value?.focus();});
onBeforeUnmount(()=>{document.body.style.overflow=oldOverflow;previous?.focus({preventScroll:true});});
function trap(event:KeyboardEvent){if(event.key!=='Tab')return;const items=Array.from(panel.value?.querySelectorAll<HTMLElement>('button:not(:disabled),input,textarea,select,a[href]')||[]).filter(e=>e.getClientRects().length);const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
</script>
<template><Teleport to="body"><div class="studio-create-overlay"><section ref="panel" class="studio-create-dialog" role="dialog" aria-modal="true" aria-label="新建地点" tabindex="-1" @keydown="trap"><StudioPlaceEditor creating :base-payload="payload" :route-draft="routeDraft" :context="context" :initial-point="initialPoint" @cancel="$emit('cancel')" @created="$emit('created',$event)"/></section></div></Teleport></template>
