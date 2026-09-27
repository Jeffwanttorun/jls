export interface PlaceFacilityFact{
  id:string;
  label:string;
  available:boolean;
  navigationPlaceCode?:string;
  note:string;
}

// V0.2 tourist presentation facts explicitly confirmed by the owner.
// These facts describe the selected place itself and do not pull in nearby POIs.
const placeFacilityFacts:Record<string,PlaceFacilityFact[]>={
  'WY-0004':[
    {id:'toilet',label:'卫生间',available:true,navigationPlaceCode:'WY-0004',note:'本地点有卫生间，导航目标为齐云峰观景/日出位置。'},
    {id:'restaurant',label:'餐馆',available:false,note:'本地点没有餐馆。'}
  ]
};

export function facilitiesForPlace(code:string){return placeFacilityFacts[code]||[];}
