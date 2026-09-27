import {computed,ref} from 'vue';import type {Place} from './types';
const places=ref<Place[]>([]),loading=ref(false),error=ref('');let task:Promise<void>|null=null;
export function usePlaces(){
 async function load(){if(places.value.length||task)return task;loading.value=true;task=fetch('/api/local-prototype/places').then(async r=>{if(!r.ok)throw Error('读取本地原型地点失败');const body=await r.json();if(body.scope!=='local-prototype')throw Error('数据来源不是本地原型适配层');places.value=body.items;}).catch(e=>{error.value=(e as Error).message;task=null;}).finally(()=>loading.value=false);return task;}
 return {places,loading,error,load,byCode:(code:string)=>places.value.find(p=>p.code===code),orderedCore:computed(()=>places.value.filter(p=>!p.service&&p.corridor_order!==null).sort((a,b)=>a.corridor_order!-b.corridor_order!))};
}
export function neighbors(anchor:number,items:Place[]){const core=items.filter(p=>!p.service&&p.corridor_order!==null).sort((a,b)=>a.corridor_order!-b.corridor_order!);return {previous:[...core].reverse().find(p=>p.corridor_order!<anchor)||null,next:core.find(p=>p.corridor_order!>anchor)||null};}
