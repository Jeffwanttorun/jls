import {ref} from 'vue';
export type Basemap = 'standard'|'satellite';
// Preferences only; no coordinates are persisted or submitted by map movement.
export const preferredBasemap=ref<Basemap>('satellite');
export let lastPickerView:{latitude:number;longitude:number;zoom:number}|null=null;
export function rememberPickerView(view:NonNullable<typeof lastPickerView>){lastPickerView=view;}
