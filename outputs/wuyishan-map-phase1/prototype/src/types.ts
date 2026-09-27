export interface Place {
  code:string;
  name:string;
  place_type:string;
  region:string|null;
  corridor_order:number|null;
  parent_code:string|null;
  category_name:string;
  status:string;
  latitude:number;
  longitude:number;
  service:boolean;
}

export type PageKind='outdoor'|'museum'|'nature'|'food';
export type ModuleVariant='steps'|'numbered'|'timeline'|'checklist'|'suitability'|'sequence'|'choices'|'question';

export interface ContentColumn {
  title:string;
  icon:string;
  items:string[];
}

export interface ContentModule {
  title:string;
  items?:string[];
  columns?:ContentColumn[];
  variant:ModuleVariant;
}

export interface PageConfig {
  slug:string;
  kind:PageKind;
  title:string;
  placeCodes:string[];
  nearbyCodes:string[];
  corridorAnchor:number;
  eyebrow:string;
  oneLiner:string;
  tags:string[];
  cover:string;
  modules:ContentModule[];
  arrivalNotes:Record<string,string>;
  dadTip:string;
  mediaText:string;
  videoLabel:string;
}
