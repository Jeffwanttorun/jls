import {computed,onMounted,onBeforeUnmount,ref,type Ref} from 'vue';
import {onBeforeRouteLeave,onBeforeRouteUpdate} from 'vue-router';
import {clone,getStudio,type StudioPayload,type ContentStudioDocument} from './content-studio-api';
import {ApiError} from './api';
import {editorChanges,applyEditorChanges,type EditorChange} from '../../shared/editor-changes';
export function useEditorSafety(options:{payload:Ref<StudioPayload|null>;current:()=>any;setCurrent:(value:any)=>void;select:(doc:ContentStudioDocument)=>any;save:()=>Promise<boolean|undefined>;extraDirty?:()=>boolean;busy?:()=>boolean;creation?:boolean;validateLatest?:(next:StudioPayload)=>string|null}){
 const baseline=ref<any>(null),baseDocument=ref<ContentStudioDocument|null>(null),leaveOpen=ref(false),conflict=ref(false),rows=ref<EditorChange[]>([]),latest=ref<StudioPayload|null>(null),reviewed=ref(false),error=ref(''),working=ref(false),blocked=ref(false),reviewInput=ref<any>(null);
 let resolveLeave:((value:boolean)=>void)|undefined;
 const dirty=computed(()=>baseline.value!==null&&(JSON.stringify(options.current())!==JSON.stringify(baseline.value)||!!options.extraDirty?.()));
 function capture(value=options.current()){baseline.value=clone(value);baseDocument.value=options.payload.value?clone(options.payload.value.document):null;conflict.value=false;rows.value=[];latest.value=null;error.value='';}
 async function guard(){if(options.busy?.()||working.value)return false;if(!dirty.value)return true;if(resolveLeave)return false;leaveOpen.value=true;return new Promise<boolean>(r=>resolveLeave=r);}
 function decide(leave:boolean){leaveOpen.value=false;const r=resolveLeave;resolveLeave=undefined;r?.(leave);}
 async function saveAndLeave(){working.value=true;try{if(await options.save()){if(!dirty.value)decide(true);else error.value='保存期间又有新修改，请再次保存或继续编辑。';}}finally{working.value=false;}}
 async function requestLeave(action:()=>void){if(await guard())action();}
 onBeforeRouteLeave(guard);onBeforeRouteUpdate(guard);
 function unload(e:BeforeUnloadEvent){if(dirty.value||options.busy?.()||working.value){e.preventDefault();e.returnValue='';}}
 onMounted(()=>window.addEventListener('beforeunload',unload));onBeforeUnmount(()=>{window.removeEventListener('beforeunload',unload);resolveLeave?.(false);});
 function fail(e:unknown){const err=e as Error;conflict.value=e instanceof ApiError&&e.kind==='conflict';error.value=conflict.value?'其他窗口已更新草稿。您的输入仍在；请获取最新版本并查看差异后继续编辑。':err.message||'请求失败，输入已保留。';}
 async function compare(){working.value=true;reviewed.value=false;latest.value=null;rows.value=[];try{const next=await getStudio(),remote=options.creation?options.current():options.select(next.document);if(remote===undefined){error.value='最新版本已没有此编辑对象；当前输入仍保留，请继续查看未保存内容。';return;}latest.value=next;reviewInput.value=clone(options.current());rows.value=editorChanges(baseline.value,reviewInput.value,remote);if(options.creation&&baseDocument.value&&JSON.stringify(baseDocument.value)!==JSON.stringify(next.document))rows.value.push({path:['已保存草稿（只读）'],base:baseDocument.value,mine:baseDocument.value,latest:next.document,mineChanged:false,latestChanged:true,contested:false,selected:false});reviewed.value=false;const reason=options.validateLatest?.(next);blocked.value=!!reason;if(reason)error.value=reason;}catch(e){error.value=(e as Error).message;}finally{working.value=false;}}
 function reapply(){if(!latest.value||!reviewed.value||blocked.value)return;if(JSON.stringify(options.current())!==JSON.stringify(reviewInput.value)){reviewed.value=false;error.value='比较之后表单又有修改，请重新获取差异。当前输入仍保留。';return;}const remote=options.creation?options.current():options.select(latest.value.document),merged=applyEditorChanges(remote,rows.value.filter(r=>r.mineChanged));options.payload.value=latest.value;baseline.value=clone(remote);baseDocument.value=clone(latest.value.document);options.setCurrent(merged);conflict.value=false;latest.value=null;rows.value=[];error.value='已按您的选择重新应用修改，请检查表单后再次保存。';}
 return {dirty,leaveOpen,conflict,blocked,rows,latest,reviewed,error,working,capture,fail,compare,reapply,decide,saveAndLeave,requestLeave,current:options.current};
}
