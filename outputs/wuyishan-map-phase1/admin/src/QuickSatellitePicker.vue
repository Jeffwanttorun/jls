<script setup lang="ts">
import {computed,ref,watch} from 'vue';
import {useRouter,onBeforeRouteLeave} from 'vue-router';
import TencentMap from './TencentMap.vue';
import {api} from './api';
import {preferredBasemap} from './map-preferences';
import type {CandidateInput} from '../../shared/coordinates';
const props=defineProps<{place:any}>(),emit=defineEmits<{changed:[];advanced:[];busy:[value:boolean]}>();
const code=props.place.code as string,router=useRouter();
preferredBasemap.value='satellite';
type Point={latitude:number;longitude:number;source_reference:string;source_time:string;position_certainty:NonNullable<CandidateInput['position_certainty']>};
const certainty=ref<NonNullable<CandidateInput['position_certainty']>>('certain');
const labels={certain:'高',approximate:'中',uncertain:'低'};
const selected=ref<Point|null>(null),candidate=ref<any>(null),busy=ref(false),error=ref(''),status=ref(''),saved=ref(false),finished=ref(false),uncertain=ref(false);
const oldPending=computed(()=>props.place.candidates.filter((c:any)=>c.status==='pending'&&c.id!==candidate.value?.id).length);
watch(busy,value=>emit('busy',value));
onBeforeRouteLeave(()=>!busy.value);
async function request(path:string,body?:unknown){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);try{return await api(path,body,controller.signal);}catch(e){if(controller.signal.aborted)throw Error('请求超时，请检查网络并刷新选点状态。');throw e;}finally{clearTimeout(timer);}}
async function recover(){
 const detail=await request(`/places/${code}`);
 const point=selected.value;
 const found=point&&detail.candidates.find((c:any)=>c.source_type==='map_click'&&c.raw_coordinate_system==='GCJ-02'&&c.raw_latitude===point.latitude&&c.raw_longitude===point.longitude&&Date.parse(c.source_time)===Date.parse(point.source_time)&&c.position_certainty===point.position_certainty&&c.source_reference===point.source_reference);
 if(found)candidate.value=found;
 return detail;
}
async function rejectCurrent(reason:string){if(candidate.value?.status==='pending')await request(`/places/${code}/coordinate-candidates/${candidate.value.id}/reject`,{reason});candidate.value=null;}
async function pick(point:{latitude:number;longitude:number;source_reference:string}){
 if(busy.value||saved.value||uncertain.value)return;
 busy.value=true;error.value='';status.value='正在保存选点…';
 try{
  await rejectCurrent('重新点选：保留上一候选作为已拒绝记录');
  selected.value={...point,source_time:new Date().toISOString(),position_certainty:certainty.value};
  uncertain.value=true;
  candidate.value=await request(`/places/${code}/coordinate-candidates`,{...selected.value,source_type:'map_click',coordinate_system:'GCJ-02',accuracy_meters:null});
  uncertain.value=false;status.value='选点已保存为候选，请核对落点后确认。';
 }catch(e){
  error.value=(e as Error).message;status.value='';
  if(uncertain.value){try{await recover();if(candidate.value){uncertain.value=false;status.value='已找回本次候选，可继续确认。';}}catch{/* Keep uncertainty explicit; do not resend creation. */}}
 }finally{busy.value=false;emit('changed');}
}
async function refreshState(){busy.value=true;error.value='';try{const detail=await recover();if(detail.coordinates.some((c:any)=>c.status==='active')){emit('changed');return;}if(candidate.value?.status==='pending'){uncertain.value=false;status.value='已找回本次候选，可继续确认。';}else{error.value='尚未找到本次候选。请稍后再刷新状态，或在高级操作中检查；不会自动重复保存。';}}catch(e){error.value=(e as Error).message;}finally{busy.value=false;}}
async function cancel(){if(busy.value||saved.value||uncertain.value)return;busy.value=true;error.value='';try{await rejectCurrent('用户撤销本次选点');selected.value=null;status.value='已撤销本次选点，可重新点击地图。';}catch(e){error.value=(e as Error).message;}finally{busy.value=false;emit('changed');}}
async function changeCertainty(){if(selected.value&&!busy.value)await pick(selected.value);}
async function next(){
 busy.value=true;error.value='';status.value='已确认此位置，正在进入下一个地点…';
 try{const queue=await request(`/coordinate-queue?after=${code}`);busy.value=false;if(queue.next){await router.push({path:`/places/${queue.next.code}`,query:{queue:'missing'}});window.scrollTo(0,0);}else{finished.value=true;status.value='连续判点完成，已没有其他无正式坐标地点。';}}
 catch(e){error.value='本地点已经确认成功，但读取下一地点失败。可重试进入下一个，不会重复写入坐标。';status.value='';}finally{busy.value=false;}
}
async function confirm(){
 if(busy.value||!candidate.value||candidate.value.status!=='pending'||saved.value)return;
 busy.value=true;error.value='';status.value='正在人工确认…';
 try{
  await request(`/places/${code}/coordinate-candidates/${candidate.value.id}/confirm`,{expected_current_id:null,acknowledged:true});saved.value=true;
 }catch(e){
  error.value=(e as Error).message;status.value='';
  try{const detail=await recover();const active=detail.coordinates.find((c:any)=>c.status==='active');if(active?.candidate_id===candidate.value?.id){saved.value=true;}else if(active){error.value='此地点已有正式坐标，已停止快捷确认。请在高级操作中核对替换，旧历史会保留。';emit('changed');}}catch{/* Retry confirmation uses the same candidate id. */}
 }finally{busy.value=false;}
 if(saved.value)await next();
}
</script>
<template><section class="quick-picker" aria-label="连续卫星判点"><h2>连续卫星判点</h2>
 <p class="muted">点击地图选位置，再点“确认此位置”，成功后自动进入下一个地点。{{place.corridor_order===null?'本地点待排，暂未确认道路位置。':`路线顺序 ${String(place.corridor_order).padStart(4,'0')}`}}</p>
 <div class="quick-map" :class="{'is-busy':busy||saved||uncertain}"><TencentMap pick automatic-candidate remember-view :selected="selected" @pick="pick"/><div v-if="busy" class="quick-busy" role="status">正在处理，请稍候…</div></div>
 <div class="quick-main-actions"><button type="button" :disabled="busy||!candidate||candidate.status!=='pending'||saved||uncertain" @click="confirm">确认此位置</button><button type="button" class="secondary" :disabled="busy||!selected||saved||uncertain" @click="cancel">撤销本次选点 / 重新点选</button></div>
 <p v-if="status" class="success" role="status">{{status}}</p><p v-if="error" class="error" role="alert">{{error}}</p>
 <button v-if="uncertain" type="button" class="secondary" :disabled="busy" @click="refreshState">刷新选点状态</button>
 <button v-if="saved&&!finished&&!busy" type="button" @click="next">继续进入下一个地点</button>
 <RouterLink v-if="finished" to="/places">返回地点列表</RouterLink>
 <details class="certainty-options"><summary>位置确定度：{{labels[certainty]}}</summary><label>位置确定度<select v-model="certainty" aria-label="快捷位置确定度" :disabled="busy||saved||uncertain" @change="changeCertainty"><option value="certain">高</option><option value="approximate">中</option><option value="uncertain">低</option></select></label><p class="muted">这是人工判断，不是 GPS 测量精度，也不代表实地核验。修改已选位置的确定度会保留旧候选并新建一条。</p></details>
 <p v-if="oldPending" class="muted">还有 {{oldPending}} 条原有待确认候选，可在高级操作中查看。</p>
 <p class="muted">是否实地核验：{{place.verifications.length?'有记录':'未有记录'}}。卫星判点不会生成实地核验记录。</p>
 <button v-if="finished" type="button" class="secondary" @click="emit('changed');emit('advanced')">查看正式坐标和历史</button>
 </section></template>
