// One optional extension of the existing place model, shared by Studio and the site.
export type OpeningKind='daily'|'weekends'|'weekdays'|'appointment'|'irregular'|'unknown';
export interface PlaceOpeningSchedule {
 kind:OpeningKind;weekdays:number[];hours:{zh:string;en:string};notes:{zh:string;en:string};source:{zh:string;en:string};lastVerifiedAt:string;confirmed:boolean;
}
export const openingKindLabels:Record<OpeningKind,{zh:string;en:string}>={daily:{zh:'每天开放',en:'Open daily'},weekends:{zh:'仅周末开放',en:'Open on weekends only'},weekdays:{zh:'指定星期开放',en:'Open on selected days'},appointment:{zh:'预约开放',en:'Visits by appointment'},irregular:{zh:'不定期开放',en:'Open on an irregular schedule'},unknown:{zh:'时间待核实',en:'Opening schedule to be confirmed'}};
export const openingWeekdays=[{id:1,zh:'周一',en:'Monday'},{id:2,zh:'周二',en:'Tuesday'},{id:3,zh:'周三',en:'Wednesday'},{id:4,zh:'周四',en:'Thursday'},{id:5,zh:'周五',en:'Friday'},{id:6,zh:'周六',en:'Saturday'},{id:7,zh:'周日',en:'Sunday'}];
export function emptyOpeningSchedule():PlaceOpeningSchedule{return {kind:'unknown',weekdays:[],hours:{zh:'',en:''},notes:{zh:'',en:''},source:{zh:'',en:''},lastVerifiedAt:'',confirmed:false};}
export function operatingCode(status?:string){if(['开放','正常','正常运营'].includes(status||''))return '开放';if(['关闭','临时关闭','暂停开放'].includes(status||''))return '关闭';if(['在建','施工','尚未开放','在建/尚未开放'].includes(status||''))return '在建';return status||'待核实';}
export function operatingLabel(status:string|undefined,locale:'zh'|'en'){
 const code=operatingCode(status),labels:Record<string,{zh:string;en:string}>={'开放':{zh:'正常运营',en:'In operation'},'关闭':{zh:'暂停开放',en:'Temporarily closed'},'在建':{zh:'在建 / 尚未开放',en:'Under construction / Not yet open'},'待核实':{zh:'待核实',en:'Status to be confirmed'},'永久关闭':{zh:'永久关闭',en:'Permanently closed'},'季节关闭':{zh:'季节关闭',en:'Seasonally closed'},'道路中断':{zh:'道路中断',en:'Access road closed'},'不建议前往':{zh:'不建议前往',en:'Visits not recommended'}};
 return labels[code]?.[locale]||(locale==='zh'?code:'Status to be confirmed');
}
export function openingScheduleErrors(value:unknown):string[]{
 if(value===undefined)return [];
 const s=value as PlaceOpeningSchedule,errors:string[]=[];
 if(!s||typeof s!=='object'||Array.isArray(s))return ['开放安排格式错误'];
 if(!Object.hasOwn(openingKindLabels,s.kind))errors.push('开放安排类型无效');
 if(typeof s.confirmed!=='boolean')errors.push('开放安排核实标记无效');
 if(!Array.isArray(s.weekdays)||s.weekdays.some(d=>!Number.isInteger(d)||d<1||d>7)||new Set(s.weekdays).size!==s.weekdays.length)errors.push('开放星期应为不重复的周一至周日');
 for(const key of ['hours','notes','source'] as const)if(!s[key]||typeof s[key].zh!=='string'||typeof s[key].en!=='string')errors.push('开放时段、说明和来源须保留中英文字段');
 if(typeof s.lastVerifiedAt!=='string'||s.lastVerifiedAt&&(!/^\d{4}-\d\d-\d\d$/.test(s.lastVerifiedAt)||!Number.isFinite(Date.parse(s.lastVerifiedAt))||new Date(s.lastVerifiedAt).toISOString().slice(0,10)!==s.lastVerifiedAt))errors.push('最后核实日期无效');
 if(s.confirmed&&s.kind==='unknown')errors.push('时间待核实时不能标记为已确认');
 if(s.confirmed&&s.kind==='weekdays'&&(!Array.isArray(s.weekdays)||!s.weekdays.length))errors.push('请勾选已确认的开放星期');
 return errors;
}
export function openingDisplay(place:{publicStatus?:string;openingSchedule?:PlaceOpeningSchedule},locale:'zh'|'en'){
 const s=place.openingSchedule,confirmed=!!s?.confirmed&&s.kind!=='unknown'&&!openingScheduleErrors(s).length;
 let schedule=confirmed?openingKindLabels[s!.kind][locale]:openingKindLabels.unknown[locale];
 if(confirmed&&s!.kind==='weekdays')schedule=locale==='zh'?`指定星期开放：${openingWeekdays.filter(d=>s!.weekdays.includes(d.id)).map(d=>d.zh).join('、')}`:`Open on ${openingWeekdays.filter(d=>s!.weekdays.includes(d.id)).map(d=>d.en).join(', ')}`;
 const code=operatingCode(place.publicStatus),inactive=['关闭','在建','永久关闭','季节关闭','道路中断','不建议前往'].includes(code);
 return {operating:operatingLabel(place.publicStatus,locale),schedule,confirmed,inactive,caution:inactive?(locale==='zh'?'当前不开放；已记录的开放安排不代表可以入馆。':'Currently unavailable. The recorded schedule does not mean visits are available.'):'',hours:confirmed?s!.hours[locale]:'',notes:confirmed?s!.notes[locale]:'',source:confirmed?s!.source[locale]:'',lastVerifiedAt:confirmed?s!.lastVerifiedAt:''};
}
