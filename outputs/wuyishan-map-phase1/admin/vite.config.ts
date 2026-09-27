import { defineConfig,loadEnv } from 'vite';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vue from '@vitejs/plugin-vue';
export default defineConfig(({mode})=>{const env=loadEnv(mode,process.cwd(),'');return {root:'admin',base:env.ADMIN_BASE_PATH||'/',plugins:[vue()],server:{host:env.ADMIN_HOST||'127.0.0.1',port:5173,strictPort:true,
 fs:{strict:true,allow:[resolve('admin'),resolve('shared'),resolve('node_modules')],deny:['.env','.env.*','*.{crt,pem,key,sql}','**/.git/**']},
 ...(env.DEV_HTTPS_CERT&&env.DEV_HTTPS_KEY?{https:{cert:readFileSync(env.DEV_HTTPS_CERT),key:readFileSync(env.DEV_HTTPS_KEY)}}:{}),
 proxy:{'/api':env.API_PROXY_TARGET||'http://127.0.0.1:3001'}},build:{outDir:'dist'}};});
