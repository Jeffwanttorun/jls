import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readFile, readlink, rename, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import {dependencyInstallPlan} from './publish-dependencies.mjs';
import {auditExistingRuntime} from './publish-runtime-audit.mjs';
import {deploymentStorage,assertStorageAvailable,ensureBuildRuntime} from './publish-native-runtime.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const releasesDir=resolve(process.env.SITE_RELEASES_DIR||resolve(root,".local-releases"));
const currentLink=resolve(process.env.SITE_CURRENT_LINK||resolve(releasesDir,"current"));
const storePath=resolve(process.env.VISITOR_CONTENT_STORE_PATH||resolve(root,"../wuyishan-map-phase1/visitor-content-store/data.json"));
const mediaDir=resolve(process.env.VISITOR_CONTENT_MEDIA_DIR||resolve(root,"../wuyishan-map-phase1/visitor-content-store/media"));
const contentStudioSnapshotPath=resolve(process.env.CONTENT_STUDIO_SNAPSHOT_PATH||(process.env.VISITOR_CONTENT_STORE_PATH?resolve(dirname(process.env.VISITOR_CONTENT_STORE_PATH),"../content-studio/published.json"):resolve(root,"../wuyishan-map-phase1/content-studio-store/published.json")));
const backupRoot=resolve(process.env.SITE_BACKUP_DIR||resolve(releasesDir,"backups"));
const packageManager=process.env.SITE_PACKAGE_MANAGER||(/^win/.test(process.platform)?"pnpm.cmd":"pnpm");
const stamp=new Date().toISOString().replace(/[:.]/g,"-");
const releaseDir=resolve(releasesDir,stamp);
const releaseId=stamp;
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
try{await cp(contentStudioSnapshotPath,resolve(backupRoot,stamp,"content-studio-published.json"));}catch(error){if(error?.code!=="ENOENT")throw error;}

// A git pull updates package.json but does not install new build dependencies.
// Fail before build/activation if the exact lockfile cannot be installed.
const runtimeAudit=await auditExistingRuntime(root);
console.log('Read-only existing runtime audit:',JSON.stringify(runtimeAudit));
await writeFile(resolve(backupRoot,stamp,'runtime-audit.json'),JSON.stringify(runtimeAudit,null,2));
await readFile(resolve(root,'pnpm-lock.yaml'));
const dependencyPlan=dependencyInstallPlan(packageManager,JSON.parse(await readFile(resolve(root,'package.json'),'utf8')));
const runStep=(command,args)=>new Promise((resolvePromise,reject)=>{
 const child=spawn(command,args,{cwd:root,stdio:'inherit',env:{...process.env,CI:'true'},shell:process.platform==='win32'});
 child.once('error',reject);child.once('exit',code=>code===0?resolvePromise():reject(new Error(`Deployment step exited ${code}; the current release was not changed.`)));
});
let deploymentStage='storage';
try{
 runtimeAudit.storage=await deploymentStorage(root);console.log('Deployment storage:',JSON.stringify(runtimeAudit.storage));assertStorageAvailable(runtimeAudit.storage);
 deploymentStage='dependency installation';console.log('Installing locked website dependencies before building…');await runStep(dependencyPlan.command,dependencyPlan.args);
 deploymentStage='native runtime';runtimeAudit.nativeRuntime=await ensureBuildRuntime(root,packageManager);
 deploymentStage='website build';await runStep(packageManager,['run','build']);
}catch(error){
 // Keep the full read-only diagnostics at the END of the existing bounded API log.
 console.error('Deployment failure diagnostics:',JSON.stringify({stage:deploymentStage,runtimeAudit}));
 throw error;
}

const mapAfter=await readFile(resolve(root,"src/data/wuyishan-public-map.json"));
if(sha256(mapAfter)!==mapHashBefore)throw new Error("Protected public map geometry changed during publication; release was not activated.");

await mkdir(releaseDir,{recursive:false});
await cp(buildDir,releaseDir,{recursive:true});
const state=JSON.parse(await readFile(storePath,"utf8"));
const studioRuntime=JSON.parse(await readFile(resolve(root,"src/data/content-studio-runtime.json"),"utf8"));
const buildTime=new Date().toISOString();
await writeFile(resolve(releaseDir,"release.json"),JSON.stringify({release:releaseId,releaseId,publishedAt:buildTime,buildTime,repositoryHead,buildCommitSha:repositoryHead,gitRemote,gitBranch,remoteHead,visitorStoreVersion:state.version,contentRevision:studioRuntime.contentRevision,contentSnapshotHash:studioRuntime.contentSnapshotHash,mapHash:mapHashBefore},null,2)+"\n");

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

console.log(JSON.stringify({ok:true,runtimeAudit,repositoryHead,buildCommitSha:repositoryHead,gitRemote,gitBranch,remoteHead,projectDir:root,buildDir,release:releaseId,releaseDir,currentLink,visitorStoreVersion:state.version,contentRevision:studioRuntime.contentRevision,contentSnapshotHash:studioRuntime.contentSnapshotHash,mapHash:mapHashBefore}));
