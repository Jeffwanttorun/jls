import type {Page,Locator} from '@playwright/test';
export async function openTask(scope:Page|Locator,name:string){await scope.locator('.task-navigation').getByRole('button',{name,exact:true}).click();}
export async function openContent(scope:Page|Locator,title='简介'){await openTask(scope,'内容编辑');const card=scope.locator('.task-content-card').filter({has:scope.getByRole('heading',{name:title,exact:true})});if(await card.getByRole('button',{name:'编辑内容',exact:true}).count())await card.getByRole('button',{name:'编辑内容',exact:true}).click();}
export async function openDetails(scope:Locator){if(!await scope.evaluate(e=>(e as HTMLDetailsElement).open))await scope.locator(':scope > summary').click();}
export async function openOpening(scope:Page|Locator){await openTask(scope,'游客信息');const form=scope.locator('.studio-opening-fields');await openDetails(form);await openDetails(form.locator('details'));}
export async function openCoordinates(scope:Page|Locator){await openTask(scope,'位置与路线');await openDetails(scope.locator('.studio-coordinate-fields details'));}
