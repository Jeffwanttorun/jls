<script setup lang="ts">
import {ref,nextTick} from 'vue';import {api} from './api';
const props=defineProps<{code:string;name:string;coordinateId:string|null}>(),emit=defineEmits<{changed:[]}>();
const target=ref<{code:string;name:string;id:string}|null>(null),busy=ref(false),error=ref(''),failed=ref(false),cancelButton=ref<HTMLButtonElement>();
async function open(){if(!props.coordinateId)return;target.value={code:props.code,name:props.name,id:props.coordinateId};error.value='';failed.value=false;await nextTick();cancelButton.value?.focus();}
function close(){if(busy.value)return;target.value=null;if(failed.value)emit('changed');}
async function remove(){if(!target.value||busy.value||failed.value)return;busy.value=true;error.value='';const current=target.value;try{await api(`/places/${current.code}/location/delete`,{expected_current_id:current.id});target.value=null;emit('changed');}catch(e){error.value=(e as Error).message;failed.value=true;}finally{busy.value=false;}}
</script>
<template><button type="button" class="warning-button" :disabled="!coordinateId" @click="open">删除定位</button><div v-if="target" class="action-shade"><section class="action-dialog" role="alertdialog" aria-modal="true" aria-label="删除当前定位" @keydown.esc.prevent="close"><p>确认删除「{{target.name}}」当前定位？地点本身不会删除，原定位将保留在历史记录中。</p><p v-if="error" class="error" role="alert">{{error}}</p><div class="actions"><button ref="cancelButton" type="button" class="secondary" :disabled="busy" @click="close">取消</button><button type="button" class="warning-button" :disabled="busy||failed" @click="remove">确认删除定位</button></div></section></div></template>
