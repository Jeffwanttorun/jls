import { productionSiteUrl } from "../site.config.mjs";

const siteUrl=(process.env.SITE_URL||process.argv[2]||productionSiteUrl).replace(/\/$/,"");
const expectedCommit=process.env.EXPECTED_RELEASE_COMMIT?.trim();
const cacheBust=`deployment-check=${Date.now()}`;
const pages=[
  {path:"/zh/explore-wuyishan/",required:["打开地图","实地路线","按兴趣找地方"],forbidden:["亲子带娃怎么玩","带娃怎么玩","看看怎么安排","游客主题"]},
  {path:"/explore-wuyishan/",required:["Wuyishan Map","Open the Map","No. 1 Scenic Road","Explore by Interest"],forbidden:[]},
  {path:"/zh/theme/water/",required:["在地图中查看","data-empty hidden","[hidden]{display:none!important}"],forbidden:["这个主题暂时没有同时标记为“适合带孩子”的地点。"]},
  {path:"/place/WY-0030/",required:["Tongmu Area","Next: Black Tea Origins Exhibition Hall"],forbidden:["Next: 野猴观察区域"]},
];

const failures=[];
for(const page of pages){
  const url=`${siteUrl}${page.path}?${cacheBust}`;
  const response=await fetch(url,{cache:"no-store",headers:{"Cache-Control":"no-cache, no-store","Pragma":"no-cache"}});
  const html=await response.text();
  if(!response.ok)failures.push(`${page.path}: HTTP ${response.status}`);
  for(const value of page.required)if(!html.includes(value))failures.push(`${page.path}: missing ${value}`);
  for(const value of page.forbidden)if(html.includes(value))failures.push(`${page.path}: contains obsolete ${value}`);
}

const releaseResponse=await fetch(`${siteUrl}/release.json?${cacheBust}`,{cache:"no-store",headers:{"Cache-Control":"no-cache, no-store"}});
if(!releaseResponse.ok)failures.push(`/release.json: HTTP ${releaseResponse.status}`);
const release=releaseResponse.ok?await releaseResponse.json():{};
if(expectedCommit&&release.repositoryHead!==expectedCommit)failures.push(`/release.json: expected commit ${expectedCommit}, received ${release.repositoryHead||"missing"}`);

if(failures.length)throw new Error(`Production content assertions failed:\n${failures.map((failure)=>`- ${failure}`).join("\n")}`);
console.log(JSON.stringify({ok:true,siteUrl,repositoryHead:release.repositoryHead,release:release.release,checkedPages:pages.map((page)=>page.path)}));
