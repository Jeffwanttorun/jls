import { access, lstat, readFile, rename, rm, symlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const release=process.argv[2];
if(!release||!/^[0-9T-]+Z$/.test(release))throw new Error("Usage: node scripts/rollback-site.mjs <release-id>");
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const releasesDir=resolve(process.env.SITE_RELEASES_DIR||resolve(root,".local-releases"));
const currentLink=resolve(process.env.SITE_CURRENT_LINK||resolve(releasesDir,"current"));
const target=resolve(releasesDir,release);
await access(resolve(target,"release.json"));
const metadata=JSON.parse(await readFile(resolve(target,"release.json"),"utf8"));
const next=`${currentLink}.rollback-${process.pid}`;
await symlink(target,next,process.platform==="win32"?"junction":"dir");
try{const stat=await lstat(currentLink);if(!stat.isSymbolicLink()&&process.platform!=="win32")throw new Error(`${currentLink} is not a managed release link.`);if(process.platform==="win32")await rm(currentLink,{force:true,recursive:true});}catch(error){if(error?.code!=="ENOENT")throw error;}
await rename(next,currentLink);
console.log(JSON.stringify({ok:true,rolledBackTo:release,currentLink,metadata}));
