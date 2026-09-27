import 'dotenv/config';import pg from 'pg';import {createPrototypeApp} from './app.js';
const host=process.env.PROTOTYPE_API_HOST||'127.0.0.1';
if(!['127.0.0.1','::1','localhost'].includes(host))throw Error('游客原型只允许 API 监听本机回环地址');
const db=new pg.Pool({connectionString:process.env.DATABASE_URL,max:3});
const app=createPrototypeApp(db);
await app.listen({host,port:Number(process.env.PROTOTYPE_API_PORT||3002)});
console.log('Local prototype read-only API listening on '+host+':'+(process.env.PROTOTYPE_API_PORT||3002));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();await db.end();process.exit(0);});
