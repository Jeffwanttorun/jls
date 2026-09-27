import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../backend/src/app.js';

test('生产后台密码保护覆盖发布与维护接口',async()=>{
 const previous=process.env.ADMIN_PASSWORD;process.env.ADMIN_PASSWORD='a-long-test-password';
 const db={query:async()=>({rows:[]})} as any;
 const app=createApp(db);
 try{
  const denied=await app.inject({method:'GET',url:'/api/admin/site-publish/status'});
  assert.equal(denied.statusCode,401);
  assert.match(String(denied.headers['www-authenticate']),/Basic/);
  const wrong=await app.inject({method:'GET',url:'/api/admin/site-publish/status',headers:{authorization:`Basic ${Buffer.from('jeff:wrong').toString('base64')}`}});
  assert.equal(wrong.statusCode,401);
  const allowed=await app.inject({method:'GET',url:'/api/admin/site-publish/status',headers:{authorization:`Basic ${Buffer.from('jeff:a-long-test-password').toString('base64')}`}});
  assert.equal(allowed.statusCode,200);
  assert.equal(allowed.json().running,false);
 }finally{await app.close();if(previous===undefined)delete process.env.ADMIN_PASSWORD;else process.env.ADMIN_PASSWORD=previous;}
});
