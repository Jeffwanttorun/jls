export class ApiError extends Error {kind:'conflict'|'coordinate'|'relationship'|'field'|'network'|'server';constructor(message:string,public status:number){super(message);this.kind=status===409&&/版本|草稿.*变化|内容.*更新/.test(message)?'conflict':status===0?'network':status>=500?'server':/坐标|经纬度|纬度|经度/.test(message)?'coordinate':/关系|路线|阶段|分组|主题引用/.test(message)?'relationship':'field';}}
export async function api<T=any>(path:string,body?:unknown,signal?:AbortSignal):Promise<T>{
 let response:Response;try{response=await fetch(`/api/admin${path}`,{signal,method:body===undefined?'GET':'POST',...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});}catch{throw new ApiError('网络连接失败，当前输入已保留，请检查连接后重试。',0);}
 if(!response.ok){const body=await response.json().catch(()=>({}));throw new ApiError(body.error||`服务器请求失败 (${response.status})`,response.status);}
 return response.json();
}
export function display(v:unknown):string {if(v===null||v===undefined||v==='')return '未记录';if(typeof v==='boolean')return v?'是':'否';if(Array.isArray(v))return v.length?v.join('、'):'未记录';return String(v);}
export function date(v:unknown):string {if(!v)return '未核验';const d=new Date(String(v));return Number.isNaN(d.getTime())?'格式错误':d.toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'});}
