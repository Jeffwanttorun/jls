/** Browser timeout plus a watchdog for providers that never invoke either callback. */
export function capturePosition(): Promise<GeolocationPosition> {
 return new Promise((resolve,reject)=>{
  const timer=window.setTimeout(()=>reject(Error('定位超时，请到信号较好的位置后重试。')),16000);
  const finish=(position:GeolocationPosition)=>{clearTimeout(timer);resolve(position);};
  const fail=(error:GeolocationPositionError)=>{clearTimeout(timer);reject(Error(error.code===1?'定位权限被拒绝，请在浏览器设置中允许位置权限。':error.code===3?'定位超时，请到信号较好的位置后重试。':'无法取得当前位置，请重试或改用手工输入。'));};
  try{navigator.geolocation.getCurrentPosition(finish,fail,{enableHighAccuracy:true,timeout:15000,maximumAge:0});}
  catch{clearTimeout(timer);reject(Error('无法取得当前位置，请重试或改用手工输入。'));}
 });
}
