import {spawn} from 'node:child_process';
import type {FastifyInstance} from 'fastify';

type PublishState={running:boolean;startedAt:string|null;finishedAt:string|null;ok:boolean|null;log:string;exitCode:number|null};
const state:PublishState={running:false,startedAt:null,finishedAt:null,ok:null,log:'',exitCode:null};

export function registerSitePublishing(app:FastifyInstance){
 app.get('/api/admin/site-publish/status',async()=>state);
 app.post('/api/admin/site-publish',async(_req,reply)=>{
  const script=process.env.SITE_PUBLISH_SCRIPT,project=process.env.SITE_PROJECT_DIR;
  if(!script||!project)return reply.code(503).send({error:'服务器尚未配置网站发布路径'});
  if(state.running)return reply.code(409).send({error:'网站正在更新，请稍候'});
  Object.assign(state,{running:true,startedAt:new Date().toISOString(),finishedAt:null,ok:null,log:'正在检查并生成网站…',exitCode:null});
  const child=spawn(process.execPath,[script],{cwd:project,env:process.env,shell:false});
  const append=(chunk:Buffer)=>{state.log=(state.log+chunk.toString('utf8')).slice(-12000);};
  child.stdout.on('data',append);child.stderr.on('data',append);
  child.once('error',error=>Object.assign(state,{running:false,finishedAt:new Date().toISOString(),ok:false,log:(state.log+'\n'+error.message).slice(-12000)}));
  child.once('exit',code=>Object.assign(state,{running:false,finishedAt:new Date().toISOString(),ok:code===0,exitCode:code,log:(state.log+`\n发布进程结束：${code}`).slice(-12000)}));
  return reply.code(202).send(state);
 });
}
