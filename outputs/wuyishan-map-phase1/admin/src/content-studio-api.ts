import {api} from './api';
import type {ContentStudioDocument,StudioPlace,StudioRoute,StudioTheme,StudioValidationIssue} from '../../shared/content-studio';
export interface StudioPayload {draftRevision:number;publishedRevision:string|null;publishedSnapshotHash:string|null;updatedAt:string;publishedAt:string|null;document:ContentStudioDocument;dashboard:{stats:Record<string,number>;issues:StudioValidationIssue[];issueCounts:Record<string,number>;recentPlaces:StudioPlace[]}}
export const getStudio=()=>api<StudioPayload>('/content-studio/state');
export const getStudioRevisions=()=>api<{items:any[]}>('/content-studio/revisions');
export const saveStudio=(payload:StudioPayload,document:ContentStudioDocument,objectType:string,objectId:string,summary:string)=>api<{ok:boolean;draftRevision:number}>('/content-studio/save',{expectedRevision:payload.draftRevision,document,objectType,objectId,summary});
export const publishStudio=(payload:StudioPayload,acknowledgeWarnings=false)=>api<{ok:boolean;contentRevision:string;contentSnapshotHash:string;warnings:StudioValidationIssue[]}>('/content-studio/publish',{expectedRevision:payload.draftRevision,acknowledgeWarnings});
export const restoreStudio=(payload:StudioPayload,revisionNo:number)=>api('/content-studio/restore',{expectedRevision:payload.draftRevision,revisionNo});
// Vue wraps editor data in proxies, which structuredClone cannot copy in
// Safari/Chromium. Content Studio documents are JSON by contract.
export const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
export const roleLabels:Record<string,string>={'core-stop':'核心停留点','secondary-stop':'普通停留点','observation':'观察点','service':'服务设施','junction':'支线路口','food':'餐饮补给'};
export const familyLabels:Record<string,string>={yes:'适合',conditional:'有条件适合',no:'不适合',unknown:'未确认'};
export const overnightLabels:Record<string,string>={allowed:'已确认允许','used-in-person':'Jeff 曾经实地过夜，当前需再次确认',recheck:'出发前重新确认','not-recommended':'不建议',prohibited:'禁止',unknown:'未确认'};
export type {ContentStudioDocument,StudioPlace,StudioRoute,StudioTheme};
