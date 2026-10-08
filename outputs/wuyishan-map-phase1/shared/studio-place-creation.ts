import type {StudioPlace,StudioRole} from './content-studio.js';
import gcoordPackage from 'gcoord';
// Same CommonJS interop as the existing coordinate service.
const gcoord=gcoordPackage as unknown as {WGS84:string;BD09:string;GCJ02:string;transform:(xy:[number,number],from:string,to:string)=>[number,number]};
export function studioMapPoint(coordinates:StudioPlace['coordinates']){
 const source=coordinates.system==='WGS84'?gcoord.WGS84:coordinates.system==='GCJ-02'?gcoord.GCJ02:coordinates.system==='BD-09'?gcoord.BD09:null;
 if(!source)throw Error('未知坐标系，无法显示在腾讯地图');
 const [longitude,latitude]=gcoord.transform([coordinates.longitude,coordinates.latitude],source,gcoord.GCJ02);return {latitude,longitude};
}
export interface PlaceCreationContext {routeId:string;stageId:string;groupId:string|null;role:StudioRole;order:number}
export function emptyStudioPlace():StudioPlace {
 const text=()=>({zh:'',en:''});
 return {id:'',name:text(),shortName:text(),pinyin:'',englishNameStatus:'pending',labelPriority:60,
 category:'未分类',region:text(),address:text(),summary:text(),description:text(),whyStop:text(),firsthandNotes:text(),practicalInfo:{zh:[],en:[]},
 parking:text(),toiletNote:text(),foodNote:text(),shopNote:text(),lodgingNote:text(),facilities:{parking:false,toilet:false,food:false,shop:false,lodging:false},
 familySuitability:'unknown',familyNotes:text(),overnightStatus:'unknown',overnightNotes:text(),overnightLastCheckedAt:'',overnightSource:'',safetyNotes:text(),accessNotes:text(),seasonNotes:text(),
 trust:{firsthand:false,checkedInPerson:false,officialSource:false,recheckBeforeGoing:true,lastCheckedAt:''},themeIds:[],publicStatus:'待核实',published:false,recommended:false,
 videos:[],storyLinks:[],researchLinks:[],photos:[],coordinates:{latitude:0,longitude:0,system:'WGS84'},coordinateMissing:true,archivedAt:null};
}
