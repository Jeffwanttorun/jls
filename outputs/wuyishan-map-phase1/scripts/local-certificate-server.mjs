import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import 'dotenv/config';
const host=process.env.LOCAL_LAN_IP||'127.0.0.1',base=resolve('../../work/https');
const allowed={'/wuyishan-local.mobileconfig':['wuyishan-local.mobileconfig','application/x-apple-aspen-config'],'/wuyishan-local-ca.cer':['wuyishan-local-ca.cer','application/x-x509-ca-cert']};
http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.writeHead(405).end();return;}
 if(req.url==='/'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end(`<!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><title>本地维护台</title><style>body{font:17px/1.7 system-ui;max-width:600px;margin:auto;padding:24px}a{display:block;background:#e4f1eb;color:#164c36;padding:16px;border-radius:12px;margin:16px 0}</style><h1>本地草稿维护台</h1><p>请与电脑连接同一 Wi-Fi。这里只提供公开证书，不提供私钥。</p><a href="/wuyishan-local.mobileconfig">iPhone：下载本机证书描述文件</a><p>设置 → 已下载描述文件 → 安装。然后：通用 → 关于本机 → 证书信任设置 → 开启此 mkcert 根证书的完全信任。仅信任你自己的电脑。</p><a href="https://${host}:5173/studio">打开本地维护台</a><p>所有修改只保存到本地草稿。完成测试后可移除手机上的描述文件。</p></html>`);return;}
 const entry=allowed[req.url];if(!entry){res.writeHead(404).end();return;}
 try{const data=await readFile(resolve(base,entry[0]));res.setHeader('Content-Type',entry[1]);res.setHeader('Content-Disposition',`attachment; filename="${entry[0]}"`);res.end(data);}catch{res.writeHead(503).end('证书描述文件暂不可用');}
}).listen(8766,host,()=>console.log(`Public certificate download: http://${host}:8766/`));
