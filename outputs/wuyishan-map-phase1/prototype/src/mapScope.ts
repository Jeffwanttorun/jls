import type {Place} from './types';
import {corridorCoreCodes,corridorServiceCodes} from './routeConfig';

export type MapScope=
 | {kind:'all';title:'全部地点'}
 | {kind:'corridor';title:'一号风景道'}
 | {kind:'selection';source:'place'|'content'|'theme';title:string;placeCodes:string[];primaryCodes:string[];showRoute:boolean};

export const allMapScope=():MapScope=>({kind:'all',title:'全部地点'});
export const corridorMapScope=():MapScope=>({kind:'corridor',title:'一号风景道'});
export const placeMapScope=(place:Place):MapScope=>({kind:'selection',source:'place',title:place.name,placeCodes:[place.code],primaryCodes:[place.code],showRoute:false});
// Theme maps reuse the frozen corridor geometry as a quiet spatial reference.
// The theme result still controls markers and bounds; no POI-to-POI line is
// generated. Place and ordinary content scopes remain fully isolated.
export const themeMapScope=(title:string,places:Place[]):MapScope=>({kind:'selection',source:'theme',title,placeCodes:places.map(place=>place.code),primaryCodes:places.filter(place=>!place.service).map(place=>place.code),showRoute:true});
export const contentMapScope=(title:string,links:Array<{placeCode:string;role:string}>):MapScope=>({kind:'selection',source:'content',title,placeCodes:links.map(link=>link.placeCode),primaryCodes:links.filter(link=>link.role==='primary'||link.role==='secondary').map(link=>link.placeCode),showRoute:false});

const corridorCodes=new Set([...corridorCoreCodes,...corridorServiceCodes]);
export function placesForMapScope(scope:MapScope,places:Place[]){
 if(scope.kind==='all')return places;
 if(scope.kind==='corridor')return places.filter(place=>corridorCodes.has(place.code));
 const allowed=new Set(scope.placeCodes);return places.filter(place=>allowed.has(place.code));
}
export function highlightsForMapScope(scope:MapScope){return scope.kind==='corridor'?corridorCoreCodes:scope.kind==='selection'?scope.primaryCodes:[];}
export function showRouteForMapScope(scope:MapScope){return scope.kind==='corridor'||(scope.kind==='selection'&&scope.source==='theme'&&scope.showRoute);}

export function mapScopeName(scope:MapScope){
 if(scope.kind==='corridor')return 'route';
 if(scope.kind==='all')return 'all-places';
 if(scope.source==='place')return 'single-place';
 if(scope.source==='content')return 'content-unit';
 return 'theme';
}

