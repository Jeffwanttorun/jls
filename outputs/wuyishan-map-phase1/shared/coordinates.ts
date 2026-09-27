export const coordinateSources = ['phone_gps','map_click','manual_input','dji_srt','gps_track','imported_file','other'] as const;
export const sourceLabels:Record<string,string>={phone_gps:'手机定位',map_click:'地图点选',manual_input:'手工输入',dji_srt:'DJI 字幕',gps_track:'GPS 轨迹',imported_file:'文件导入',other:'其他'};
export const statusLabels:Record<string,string>={active:'当前有效',superseded:'已被替换',revoked:'已撤销',pending:'待确认',confirmed:'已确认',rejected:'已拒绝'};
export const legacySources:Record<string,string>={'手机':'phone_gps','地图点选':'map_click','手工导入':'imported_file','DJI':'dji_srt','GPS':'gps_track'};
export const positionCertainties=['certain','approximate','uncertain'] as const;
export const certaintyLabels:Record<string,string>={certain:'确定',approximate:'大致位置',uncertain:'不确定'};
export const satelliteReference='腾讯卫星影像人工判读';
export interface CandidateInput {
 latitude:number; longitude:number; coordinate_system:'WGS84'|'GCJ-02'|'BD-09'|'未知';
 accuracy_meters:number|null; source_type:typeof coordinateSources[number]; source_reference?:string;
 source_time:string; notes?:string; position_certainty?:typeof positionCertainties[number];
}
export interface MapPlace {updated_at:string;map_display_role?:'pin'|'group'|'hidden';corridor_order?:number|null;code:string;name:string;parent_code:string|null;ancestor_codes:string[];latitude:number;longitude:number;category_name:string;region:string;current_status:string;public_level:string;has_pending:boolean;coordinate_id:string}
// Only suppress a child if a valid, filter-matching ancestor is actually present.
export function visibleMapPlaces<T extends Pick<MapPlace,'code'|'ancestor_codes'|'map_display_role'>>(places:T[],zoom:number):T[]{
 places=places.filter(p=>p.map_display_role!=='hidden');
 if(zoom>=14)return places;
 const codes=new Set(places.map(p=>p.code));
 return places.filter(p=>!p.ancestor_codes.some(code=>codes.has(code)));
}
