import {createRequire} from 'node:module';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
const root=process.argv[2]||resolve(dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(resolve(root,'package.json'));
const sharp=require('sharp'),qrcode=require('qrcode');
await sharp({create:{width:1,height:1,channels:3,background:'#ffffff'}}).png().toBuffer();
await qrcode.toString('deployment-runtime-check',{type:'svg'});
console.log('Build runtime passed: Sharp native PNG encoding and QR generation.');
