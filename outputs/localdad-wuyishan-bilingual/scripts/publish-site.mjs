import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readFile, readlink, rename, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const releasesDir=resolve(process.env.SITE_RELEASES_DIR||resolve(root,".local-releases"));
const currentLink=resolve(process.env.SITE_CURRENT_LINK||resolve(releasesDir,"current"));
const storePath=resolve(process.env.VISITOR_CONTENT_STORE_PATH||resolve(root,"../wuyishan-map-phase1/visitor-content-store/data.json"));
const mediaDir=resolve(process.env.VISITOR_CONTENT_MEDIA_DIR||resolve(root,"../wuyishan-map-phase1/visitor-content-store/media"));
const backupRoot=resolve(process.env.SITE_BACKUP_DIR||resolve(releasesDir,"backups"));
const packageManager=process.env.SITE_PACKAGE_MANAGER||(/^win/.test(process.platform)?"pnpm.cmd":"pnpm");
const stamp=new Date().toISOString().replace(/[:.]/g,"-");
const releaseDir=resolve(releasesDir,stamp);
const buildDir=resolve(root,"dist");
const execFileAsync=promisify(execFile);
const {stdout:headOutput}=await execFileAsync("git",["rev-parse","HEAD"],{cwd:root});
const repositoryHead=headOutput.trim();
const gitRemote=process.env.SITE_GIT_REMOTE||"origin";
const gitBranch=process.env.SITE_GIT_BRANCH||"main";
const {stdout:remoteOutput}=await execFileAsync("git",["ls-remote",gitRemote,`refs/heads/${gitBranch}`],{cwd:root});
const remoteHead=remoteOutput.trim().split(/\s+/)[0];
if(!remoteHead)throw new Error(`Cannot resolve ${gitRemote}/${gitBranch}; publication was not started.`);
if(repositoryHead!==remoteHead){
 throw new Error(`Server checkout ${repositoryHead} does not match ${gitRemote}/${gitBranch} ${remoteHead}; pull the repository before publishing.`);
}

const sha256=(buffer)=>createHash("sha256").update(buffer).digest("hex");
const mapBefore=await readFile(resolve(root,"src/data/wuyishan-public-map.json"));
const mapHashBefore=sha256(mapBefore);

await mkdir(resolve(backupRoot,stamp),{recursive:true});
await cp(storePath,resolve(backupRoot,stamp,"visitor-content.json"));
await cp(mediaDir,resolve(backupRoot,stamp,"media"),{recursive:true});

await new Promise((resolvePromise,reject)=>{
 const child=spawn(packageManager,["run","build"],{cwd:root,stdio:"inherit",env:process.env,shell:process.platform==="win32"});
 child.once("error",reject);
 child.once("exit",code=>code===0?resolvePromise():reject(new Error(`Website build failed with exit code ${code}`)));
});

const mapAfter=await readFile(resolve(root,"src/data/wuyishan-public-map.json"));
if(sha256(mapAfter)!==mapHashBefore)throw new Error("Protected public map geometry changed during publication; release was not activated.");

await mkdir(releaseDir,{recursive:false});
await cp(buildDir,releaseDir,{recursive:true});
const state=JSON.parse(await readFile(storePath,"utf8"));
await writeFile(resolve(releaseDir,"release.json"),JSON.stringify({release:stamp,publishedAt:new Date().toISOString(),repositoryHead,gitRemote,gitBranch,remoteHead,visitorStoreVersion:state.version,mapHash:mapHashBefore},null,2)+"\n");

await mkdir(dirname(currentLink),{recursive:true});
let previousTarget;
try{previousTarget=await readlink(currentLink);}catch(error){if(error?.code!=="ENOENT")throw error;}
const nextLink=`${currentLink}.next-${process.pid}`;
try{await rm(nextLink,{force:true,recursive:true});}catch{}
await symlink(releaseDir,nextLink,process.platform==="win32"?"junction":"dir");
try{
 const stat=await lstat(currentLink);
 if(!stat.isSymbolicLink()&&process.platform!=="win32")throw new Error(`${currentLink} exists and is not a managed release link.`);
 if(process.platform==="win32")await rm(currentLink,{force:true,recursive:true});
}catch(error){if(error?.code!=="ENOENT")throw error;}
await rename(nextLink,currentLink);

try{
 await new Promise((resolvePromise,reject)=>{
  const child=spawn(process.execPath,[resolve(root,"scripts/assert-production.mjs")],{cwd:root,stdio:"inherit",env:{...process.env,EXPECTED_RELEASE_COMMIT:repositoryHead},shell:false});
  child.once("error",reject);
  child.once("exit",code=>code===0?resolvePromise():reject(new Error(`Production content assertions failed with exit code ${code}`)));
 });
}catch(error){
 if(previousTarget){
  const rollbackLink=`${currentLink}.rollback-${process.pid}`;
  try{await rm(rollbackLink,{force:true,recursive:true});}catch{}
  await symlink(previousTarget,rollbackLink,process.platform==="win32"?"junction":"dir");
  await rename(rollbackLink,currentLink);
 }
 throw error;
}

console.log(JSON.stringify({ok:true,repositoryHead,gitRemote,gitBranch,remoteHead,projectDir:root,buildDir,release:stamp,releaseDir,currentLink,visitorStoreVersion:state.version,mapHash:mapHashBefore}));
