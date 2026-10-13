import {productionSiteUrl} from '../../site.config.mjs';
// Callers must supply published paths; never share the local preview origin.
export function publicShareUrl(path:string):string|null{
 if(!path.startsWith('/')||path.startsWith('//'))return null;
 const url=new URL(path,productionSiteUrl);
 if(!/^\/(?:zh\/)?(?:map\/?|place\/WY-\d{4,}\/?|(?:route|theme)\/[a-z0-9-]+\/?)$/.test(url.pathname))return null;
 url.hash='';return url.href;
}
