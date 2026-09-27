export async function api<T=any>(path:string,body?:unknown,signal?:AbortSignal):Promise<T>{
 const response=await fetch(`/api/admin${path}`,{signal,method:body===undefined?'GET':'POST',...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
 if(!response.ok){const body=await response.json();throw Error(body.error||`请求失败 (${response.status})`);}
 return response.json();
}
export function display(v:unknown):string {if(v===null||v===undefined||v==='')return '未记录';if(typeof v==='boolean')return v?'是':'否';if(Array.isArray(v))return v.length?v.join('、'):'未记录';return String(v);}
export function date(v:unknown):string {if(!v)return '未核验';const d=new Date(String(v));return Number.isNaN(d.getTime())?'格式错误':d.toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'});}
