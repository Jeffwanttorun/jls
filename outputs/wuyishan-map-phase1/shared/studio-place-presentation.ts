import type {StudioPlace,ContentStudioDocument} from './content-studio.js';
import {emptyOpeningSchedule} from './place-opening.js';
import {emptyNavigationDestination,emptyPlaceShareInfo} from './place-actions.js';
export const placeCover=(p:StudioPlace)=>[...p.photos].sort((a,b)=>Number(b.role==='cover')-Number(a.role==='cover')||a.order-b.order)[0];
export const uniqueThemeIds=(p:StudioPlace)=>[...new Set(p.themeIds)];
function canonical(v:any):string{return JSON.stringify(v,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,value[k]])):value);}
export function samePlaceContent(a:StudioPlace,b:StudioPlace){const normalize=(p:StudioPlace)=>({...p,openingSchedule:p.openingSchedule??emptyOpeningSchedule(),navigationDestination:p.navigationDestination??emptyNavigationDestination(),shareInfo:p.shareInfo??emptyPlaceShareInfo()});return canonical(normalize(a))===canonical(normalize(b));}
export function unpublishedPlaceIds(draft:ContentStudioDocument,published:ContentStudioDocument|null){return Object.values(draft.places).filter(p=>!published?.places[p.id]||!samePlaceContent(p,published.places[p.id])).map(p=>p.id);}
