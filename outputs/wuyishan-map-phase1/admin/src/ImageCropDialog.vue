<script setup lang="ts">
import {nextTick,onBeforeUnmount,onMounted,ref,watch} from 'vue';

const props=defineProps<{file:File;title:string;aspect:number}>();
const emit=defineEmits<{cancel:[];confirm:[blob:Blob]}>();
const canvas=ref<HTMLCanvasElement>(),zoom=ref(1),panX=ref(0),panY=ref(0),loading=ref(true),busy=ref(false);
let image:HTMLImageElement|undefined,sourceUrl='',drag:{x:number;y:number;panX:number;panY:number;id:number}|null=null;
const clamp=(value:number)=>Math.max(-1,Math.min(1,value));

function metrics(width:number,height:number){if(!image)return null;const base=Math.max(width/image.naturalWidth,height/image.naturalHeight),scale=base*zoom.value,dw=image.naturalWidth*scale,dh=image.naturalHeight*scale,mx=Math.max(0,(dw-width)/2),my=Math.max(0,(dh-height)/2);return {dw,dh,mx,my,x:(width-dw)/2+panX.value*mx,y:(height-dh)/2+panY.value*my};}
function draw(){const target=canvas.value;if(!target||!image)return;const width=720,height=Math.round(width/props.aspect);if(target.width!==width||target.height!==height){target.width=width;target.height=height;}const context=target.getContext('2d')!,m=metrics(width,height)!;context.clearRect(0,0,width,height);context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(image,m.x,m.y,m.dw,m.dh);}
async function load(){sourceUrl=URL.createObjectURL(props.file);image=new Image();image.onload=async()=>{loading.value=false;await nextTick();draw();};image.onerror=()=>{loading.value=false;};image.src=sourceUrl;}
function reset(){zoom.value=1;panX.value=0;panY.value=0;draw();}
function pointerDown(event:PointerEvent){const target=canvas.value;if(!target||!image)return;target.setPointerCapture(event.pointerId);drag={x:event.clientX,y:event.clientY,panX:panX.value,panY:panY.value,id:event.pointerId};}
function pointerMove(event:PointerEvent){if(!drag||!canvas.value||!image||event.pointerId!==drag.id)return;const rect=canvas.value.getBoundingClientRect(),m=metrics(canvas.value.width,canvas.value.height)!;const scale=canvas.value.width/rect.width;panX.value=m.mx?clamp(drag.panX+(event.clientX-drag.x)*scale/m.mx):0;panY.value=m.my?clamp(drag.panY+(event.clientY-drag.y)*scale/m.my):0;draw();}
function pointerUp(event:PointerEvent){if(drag?.id===event.pointerId)drag=null;}
async function confirm(){if(!image)return;busy.value=true;try{const output=document.createElement('canvas');output.width=1600;output.height=Math.round(1600/props.aspect);const context=output.getContext('2d')!,m=metrics(output.width,output.height)!;context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(image,m.x,m.y,m.dw,m.dh);const blob=await new Promise<Blob|null>(resolve=>output.toBlob(resolve,'image/jpeg',.88));if(blob)emit('confirm',blob);}finally{busy.value=false;}}
watch([zoom,panX,panY],draw);onMounted(load);onBeforeUnmount(()=>{if(sourceUrl)URL.revokeObjectURL(sourceUrl);});
</script>

<template>
 <div class="crop-shade" role="dialog" aria-modal="true" :aria-label="'裁剪'+title">
  <section class="crop-dialog">
   <div class="crop-heading"><div><small>调整图片</small><h2>{{title}}</h2></div><button class="quiet" type="button" @click="emit('cancel')">取消</button></div>
   <div class="crop-frame" :style="{aspectRatio:String(aspect)}"><canvas ref="canvas" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="pointerUp"></canvas><span v-if="loading">正在读取图片…</span></div>
   <p class="crop-help">拖动图片调整裁剪位置，再用滑杆缩放。</p>
   <label class="crop-slider"><span>缩放</span><input v-model.number="zoom" type="range" min="1" max="3" step="0.01"></label>
   <details class="crop-fine-tune"><summary>精细调整</summary><label class="crop-slider"><span>左右位置</span><input v-model.number="panX" type="range" min="-1" max="1" step="0.01"></label><label class="crop-slider"><span>上下位置</span><input v-model.number="panY" type="range" min="-1" max="1" step="0.01"></label></details>
   <div class="crop-actions"><button class="secondary" type="button" @click="reset">恢复默认</button><button class="primary-action" type="button" :disabled="busy||loading" @click="confirm">{{busy?'正在处理…':'使用这张图'}}</button></div>
  </section>
 </div>
</template>
