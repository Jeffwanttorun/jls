import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupCardsByName,orderCardsByParent} from '../shared/card-hierarchy.js';

test('父子卡片紧邻排列且不丢失卡片',()=>{
  const items=[{code:'A'},{code:'B',parent:'A'},{code:'C'},{code:'D',parent:'A'}];
  assert.deepEqual(orderCardsByParent(items,item=>item.code,item=>item.parent).map(item=>item.code),['A','B','D','C']);
});
test('父卡片缺失时仍保留子卡片',()=>{
  const items=[{code:'A',parent:'missing'},{code:'B'}];
  assert.deepEqual(orderCardsByParent(items,item=>item.code,item=>item.parent).map(item=>item.code),['A','B']);
});
test('同名卡片在维护界面相邻排列并保持组间原顺序',()=>{
 const items=[{code:'A',name:'桃源峪'},{code:'B',name:'蝴蝶馆'},{code:'C',name:'桃 源峪'},{code:'D',name:'补给'}];
 assert.deepEqual(groupCardsByName(items,item=>item.name).map(item=>item.code),['A','C','B','D']);
});
