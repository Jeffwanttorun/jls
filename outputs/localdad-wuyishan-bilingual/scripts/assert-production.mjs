import { productionSiteUrl } from "../site.config.mjs";

const siteUrl=(process.env.SITE_URL||process.argv[2]||productionSiteUrl).replace(/\/$/,"");
const expectedCommit=process.env.EXPECTED_RELEASE_COMMIT?.trim();
const cacheBust=`deployment-check=${Date.now()}`;
const pages=[
  {path:"/",required:["Landscape","Tea","Culture","Nature","href=\"/why-wuyishan#culture\"","href=\"/why-wuyishan#nature\""],forbidden:[">Forest</h3>",">People and Ideas</h3>"]},
  {path:"/zh/",required:["山水","茶","人文","自然","href=\"/zh/why-wuyishan#culture\"","href=\"/zh/why-wuyishan#nature\""],forbidden:[">森林</h3>"]},
  {path:"/why-wuyishan/",required:["id=\"culture\"","id=\"nature\"","id=\"people-and-ideas\"","id=\"forest\"","Culture","Nature"],forbidden:[">Forest</h2>",">People and Ideas</h2>"]},
  {path:"/zh/why-wuyishan/",required:["id=\"culture\"","id=\"nature\"","id=\"people-and-ideas\"","id=\"forest\"","人文","自然"],forbidden:[">森林</h2>"]},
  {path:"/zh/explore-wuyishan/",required:["打开地图","实地路线","按兴趣找地方"],forbidden:["亲子带娃怎么玩","带娃怎么玩","看看怎么安排","游客主题"]},
  {path:"/explore-wuyishan/",required:["Wuyishan Map","Open the Map","No. 1 Scenic Road","Explore by Interest"],forbidden:[]},
  {path:"/zh/theme/water/",required:["在地图中查看","只看亲子可去的地点","theme-family-filter-text","data-empty hidden","[hidden]{display:none!important}"],forbidden:["这个主题暂时没有同时标记为“适合带孩子”的地点。"]},
  {path:"/theme/water/",required:["View on Map","Show places for families","theme-family-filter-text"],forbidden:[]},
  {path:"/place/WY-0030/",required:["Tongmu Area","Next core stop","Black Tea Origins Exhibition Hall","Chinese name for local search:","Back to map"],forbidden:["Working English translation","Pinyin","pending","中文原名"]},
  {path:"/zh/route/no-1-scenic-road/",required:["筛选沿途地点","茶与展馆","床车过夜","9 个核心停留点 · 41 个已记录地图点","9 个核心停留点中，9 个已实地核验","id=\"no-1-scenic-road-map\""],forbidden:[">water<",">museum<",">camping<"]},
  {path:"/route/no-1-scenic-road/",required:["9 core stops · 41 mapped places","9 of 9 core stops checked in person","id=\"no-1-scenic-road-map\""],forbidden:[]},
  {path:"/zh/theme/camping/",required:["床车过夜","WY-0055","过夜情况需确认"],forbidden:["/zh/place/WY-0003","/zh/place/WY-0053","/zh/place/WY-0002","/zh/place/WY-0052"]},
];

const failures=[];
for(const page of pages){
  const url=`${siteUrl}${page.path}?${cacheBust}`;
  const response=await fetch(url,{cache:"no-store",headers:{"Cache-Control":"no-cache, no-store","Pragma":"no-cache"}});
  const html=await response.text();
  if(!response.ok)failures.push(`${page.path}: HTTP ${response.status}`);
  for(const value of page.required)if(!html.includes(value))failures.push(`${page.path}: missing ${value}`);
  for(const value of page.forbidden)if(html.includes(value))failures.push(`${page.path}: contains obsolete ${value}`);
  if(page.path==="/place/WY-0030/"){
    const neighbors=html.match(/<div[^>]*class="route-neighbors"[^>]*>([\s\S]*?)<\/div>/)?.[1]??"";
    if(!neighbors.includes("Next core stop")||!neighbors.includes("Black Tea Origins Exhibition Hall"))failures.push(`${page.path}: core-stop navigation is incorrect`);
    if(neighbors.includes("野猴观察区域"))failures.push(`${page.path}: nearby place leaked into core-stop navigation`);
  }
}

const releaseResponse=await fetch(`${siteUrl}/release.json?${cacheBust}`,{cache:"no-store",headers:{"Cache-Control":"no-cache, no-store"}});
if(!releaseResponse.ok)failures.push(`/release.json: HTTP ${releaseResponse.status}`);
const release=releaseResponse.ok?await releaseResponse.json():{};
if(expectedCommit&&release.repositoryHead!==expectedCommit)failures.push(`/release.json: expected commit ${expectedCommit}, received ${release.repositoryHead||"missing"}`);
if(expectedCommit&&release.buildCommitSha!==expectedCommit)failures.push(`/release.json: build commit does not match ${expectedCommit}`);
if(expectedCommit&&release.remoteHead!==expectedCommit)failures.push(`/release.json: remote main does not match ${expectedCommit}`);
if(!release.releaseId||!release.buildTime)failures.push("/release.json: missing release identity metadata");
if(!release.contentRevision)failures.push("/release.json: missing content revision");
if(release.contentSnapshotHash&& !/^[a-f0-9]{64}$/.test(release.contentSnapshotHash))failures.push("/release.json: invalid content snapshot hash");

if(failures.length)throw new Error(`Production content assertions failed:\n${failures.map((failure)=>`- ${failure}`).join("\n")}`);
console.log(JSON.stringify({ok:true,siteUrl,repositoryHead:release.repositoryHead,release:release.release,checkedPages:pages.map((page)=>page.path)}));
