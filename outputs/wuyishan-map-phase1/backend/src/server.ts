import { pool,migrate } from './db.js';
import { createApp } from './app.js';
if(process.env.NODE_ENV==='production'&&!process.env.ADMIN_PASSWORD)throw new Error('ADMIN_PASSWORD is required in production');
const app=createApp(pool);
await migrate();
await app.listen({host:process.env.HOST||'127.0.0.1',port:Number(process.env.PORT||3001)});
console.log(`API listening on ${app.server.address() && process.env.HOST||'127.0.0.1'}:${process.env.PORT||3001}`);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();await pool.end();process.exit(0);});
