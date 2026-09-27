import {resolve} from 'node:path';
import {VisitorContentStore,addVisitorHistory,ensureVisitorMedia,type VisitorImageAsset} from '../shared/visitor-content.js';

const store=new VisitorContentStore({
 filePath:resolve('visitor-content-store/data.json'),
 seedPath:resolve('visitor-content-store/seed.json'),
 backupDir:resolve('visitor-content-store/backups'),
 mediaDir:resolve('visitor-content-store/media')
});

const taoyuanyu:VisitorImageAsset={
 id:'c8bd4b82de52dedb47ad73c99300fb5a3acf526cb59da7370bd07d4e1552e09f',
 fileName:'c8bd4b82de52dedb47ad73c99300fb5a3acf526cb59da7370bd07d4e1552e09f.jpg',
 mimeType:'image/jpeg',
 originalName:'桃源峪.png',
 uploadedAt:'2026-09-24T02:53:38.642Z'
};
const butterfly:VisitorImageAsset={
 id:'03f35abce64a25d43f24aed7074152a9dcaa52e50f5217206d40757118fad58e',
 fileName:'03f35abce64a25d43f24aed7074152a9dcaa52e50f5217206d40757118fad58e.jpg',
 mimeType:'image/jpeg',
 originalName:'蝴蝶馆.png',
 uploadedAt:'2026-09-24T10:00:03.872Z'
};

const before=await store.read();
if(before.media.items['place.WY-0024.cover']?.id===taoyuanyu.id&&before.media.items['place.WY-0028.cover']?.id===butterfly.id){
 console.log('桃源峪与蝴蝶馆图片槽位已经分离，无需重复修改。');
 process.exit(0);
}

const result=await store.mutate(before.version,draft=>{
 const media=ensureVisitorMedia(draft),oldTaoyuanyu=media.items['place.WY-0024.cover']||null,oldButterfly=media.items['place.WY-0028.cover']||null;
 media.items['place.WY-0024.cover']=taoyuanyu;
 media.items['place.WY-0028.cover']=butterfly;
 media.version++;
 media.updatedAt=new Date().toISOString();
 addVisitorHistory(draft,'visual_media','place.WY-0024.cover','split_place_media',oldTaoyuanyu,taoyuanyu);
 addVisitorHistory(draft,'visual_media','place.WY-0028.cover','split_place_media',oldButterfly,butterfly);
 return media;
});

console.log(JSON.stringify({storeVersion:result.state.version,mediaVersion:result.result.version,taoyuanyu:result.result.items['place.WY-0024.cover'].fileName,butterfly:result.result.items['place.WY-0028.cover'].fileName},null,2));
