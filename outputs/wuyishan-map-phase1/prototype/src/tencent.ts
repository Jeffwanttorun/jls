export interface SDK{Map:new(el:HTMLElement,o:any)=>any;LatLng:new(lat:number,lng:number)=>any;MultiMarker:new(o:any)=>any;MarkerStyle:new(o:any)=>any}
declare global{interface Window{TMap?:SDK;prototypeMapReady?:()=>void}}
let loading:Promise<SDK>|null=null,key='';
export async function mapConfig(){const r=await fetch('/api/local-prototype/map-config');if(!r.ok)throw Error('地图配置读取失败');const data=await r.json();if(data.scope!=='local-prototype'||!data.key)throw Error('本地原型尚未配置腾讯地图 Key');key=data.key;return data;}
export async function loadMap(){if(window.TMap)return window.TMap;if(loading)return loading;loading=(async()=>{await mapConfig();return new Promise<SDK>((resolve,reject)=>{const s=document.createElement('script'),timer=setTimeout(()=>fail(),15000);function fail(){clearTimeout(timer);s.remove();loading=null;reject(Error('腾讯地图加载失败，请检查网络、Key 和授权域名。'));}window.prototypeMapReady=()=>{clearTimeout(timer);delete window.prototypeMapReady;window.TMap?resolve(window.TMap):fail();};s.onerror=fail;s.src='https://map.qq.com/api/gljs?'+new URLSearchParams({v:'1.exp',key,callback:'prototypeMapReady'});document.head.appendChild(s);});})();return loading;}
function assertNavigationTarget(name:string,lat:number,lng:number){
  if(!name.trim())throw Error('暂未设置导航位置');
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180)throw Error('当前地点没有合法坐标');
}

export function navigationWebUrl(name:string,lat:number,lng:number){
  assertNavigationTarget(name,lat,lng);
  // Tencent's URI gateway currently redirects iPhone Safari to a malformed
  // /m/mqq/nav/cond=... path (missing the query separator). Use Tencent's
  // working hash-route H5 navigation page instead.
  const params=new URLSearchParams({cond:'0',epointx:String(lng),epointy:String(lat),eword:name.trim(),sword:'我的位置',transport:'2'});
  return `https://map.qq.com/nav/drive#routes/page?${params.toString()}`;
}

export async function navigationUrl(name:string,lat:number,lng:number){if(!key)await mapConfig();return navigationWebUrl(name,lat,lng);}

export function navigationAppUrl(name:string,lat:number,lng:number,referer=key){
  assertNavigationTarget(name,lat,lng);
  const params=new URLSearchParams({type:'drive',from:'我的位置',fromcoord:'CurrentLocation',to:name.trim(),tocoord:`${lat},${lng}`});
  if(referer)params.set('referer',referer);
  return `qqmap://map/routeplan?${params.toString()}`;
}

export function openNavigation(webUrl:string,appUrl:string){
  const isAppleMobile=/iPhone|iPad|iPod/i.test(navigator.userAgent);
  if(!isAppleMobile){window.location.assign(webUrl);return;}
  let settled=false;
  const onVisibility=()=>{if(document.visibilityState==='hidden'){settled=true;window.clearTimeout(timer);document.removeEventListener('visibilitychange',onVisibility);}};
  document.addEventListener('visibilitychange',onVisibility);
  const timer=window.setTimeout(()=>{document.removeEventListener('visibilitychange',onVisibility);if(!settled&&document.visibilityState!=='hidden')window.location.assign(webUrl);},900);
  try{window.location.assign(appUrl);}catch{window.clearTimeout(timer);document.removeEventListener('visibilitychange',onVisibility);window.location.assign(webUrl);}
}
