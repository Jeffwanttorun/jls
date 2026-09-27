export function orderCardsByParent<T>(items:T[],codeOf:(item:T)=>string,parentOf:(item:T)=>string|undefined):T[]{
 const byCode=new Map(items.map(item=>[codeOf(item),item]));
 const children=new Map<string,T[]>();
 for(const item of items){const parent=parentOf(item);if(!parent||!byCode.has(parent)||parent===codeOf(item))continue;const list=children.get(parent)||[];list.push(item);children.set(parent,list);}
 const result:T[]=[],seen=new Set<string>();
 const append=(item:T)=>{const code=codeOf(item);if(seen.has(code))return;seen.add(code);result.push(item);for(const child of children.get(code)||[])append(child);};
 for(const item of items)if(!parentOf(item)||!byCode.has(parentOf(item)!))append(item);
 for(const item of items)append(item);
 return result;
}

export function groupCardsByName<T>(items:T[],nameOf:(item:T)=>string):T[]{
 const keyOf=(item:T)=>nameOf(item).replace(/\s+/g,'').toLocaleLowerCase();
 const groups=new Map<string,T[]>();
 for(const item of items){const key=keyOf(item),group=groups.get(key)||[];group.push(item);groups.set(key,group);}
 const result:T[]=[],seen=new Set<string>();
 for(const item of items){const key=keyOf(item);if(seen.has(key))continue;seen.add(key);result.push(...(groups.get(key)||[]));}
 return result;
}
