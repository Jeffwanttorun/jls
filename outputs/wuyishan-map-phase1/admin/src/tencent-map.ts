import {api} from './api';
export interface LatLng {getLat():number;getLng():number}
export interface MapHandle {on:(event:string,fn:(e:any)=>void)=>void;getZoom:()=>number;setZoom:(n:number)=>void;getCenter:()=>LatLng;setBaseMap:(baseMap:{type:'vector'|'satellite';features?:string[]})=>void;setCenter:(ll:LatLng)=>void;destroy:()=>void}
export interface MarkerHandle {on:(event:string,fn:(e:any)=>void)=>void;setGeometries:(items:unknown[])=>void;setMap:(map:null)=>void}
export interface TencentSDK {Map:new(el:HTMLElement,options:unknown)=>MapHandle;LatLng:new(lat:number,lng:number)=>LatLng;MultiMarker:new(options:unknown)=>MarkerHandle;MarkerStyle:new(options:unknown)=>unknown}
declare global {interface Window{TMap?:TencentSDK;wymapReady?:()=>void}}
let loading:Promise<TencentSDK>|null=null;
export async function loadTencentMap(){
 if(window.TMap)return window.TMap;
 if(loading)return loading;
 loading=(async()=>{
  const config=await api<{key:string}>('/map-config');
  if(!config.key)throw Error('尚未配置腾讯地图 Key。请在服务器 .env 设置 TENCENT_MAP_KEY 并重启 API。');
  return new Promise<TencentSDK>((resolve,reject)=>{
   const script=document.createElement('script');
   const timer=window.setTimeout(()=>fail(),15000);
   function fail(){window.clearTimeout(timer);script.remove();delete window.wymapReady;reject(Error('腾讯地图加载失败，请检查网络、Key 和授权域名，然后重试。'));}
   window.wymapReady=()=>{window.clearTimeout(timer);delete window.wymapReady;window.TMap?resolve(window.TMap):fail();};
   script.onerror=fail;script.src=`https://map.qq.com/api/gljs?${new URLSearchParams({v:'1.exp',key:config.key,callback:'wymapReady'})}`;document.head.appendChild(script);
  });
 })();
 try{return await loading;}catch(e){loading=null;throw e;}
}
