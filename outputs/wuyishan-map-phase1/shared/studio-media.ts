import type {VisitorMediaState,VisitorImageAsset} from './visitor-content.js';import type {ContentStudioDocument} from './content-studio.js';
type MediaImage=Omit<VisitorImageAsset,'mimeType'>&{mimeType:string};
export function studioMedia(media:{items:Record<string,MediaImage>},document:ContentStudioDocument){
 const groups=new Map<string,{image:MediaImage;slots:string[];names:string[]}>();
 for(const [slot,image] of Object.entries(media.items)){const key=image.id+'|'+image.fileName,group=groups.get(key)||{image,slots:[],names:[]};group.slots.push(slot);if(!group.names.includes(image.originalName))group.names.push(image.originalName);groups.set(key,group);}
 return [...groups.values()].map((group,index)=>{const uses=Object.values(document.places).flatMap(place=>place.photos.filter(p=>p.fileName===group.image.fileName).map(photo=>({placeId:place.id,name:place.name.zh,photoId:photo.id,archived:!!place.archivedAt}))),readable=group.names.find(n=>n&&!/^[a-f0-9]{64}(\.|$)|^content\./.test(n));return {...group,uses,places:[...new Map(uses.map(u=>[u.placeId,u])).values()],title:readable||(uses.length?`${uses[0].name} · 图片`:`图片 ${index+1} · ${group.image.mimeType.split('/')[1].toUpperCase()}`)};});
}
