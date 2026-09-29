import { access, copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultPhaseRoot = resolve(projectRoot, "../wuyishan-map-phase1");
const storePath = resolve(process.env.VISITOR_CONTENT_STORE_PATH || resolve(defaultPhaseRoot, "visitor-content-store/data.json"));
const seedPath = resolve(defaultPhaseRoot, "visitor-content-store/seed.json");
const mediaDir = resolve(process.env.VISITOR_CONTENT_MEDIA_DIR || resolve(defaultPhaseRoot, "visitor-content-store/media"));
const publicMapPath = resolve(projectRoot, "src/data/wuyishan-public-map.json");
const outputPath = resolve(projectRoot, "src/data/visitor-runtime.json");
const publicMediaDir = resolve(projectRoot, "public/visitor-media");
const studioSnapshotPath = resolve(process.env.CONTENT_STUDIO_SNAPSHOT_PATH || (process.env.VISITOR_CONTENT_STORE_PATH ? resolve(dirname(process.env.VISITOR_CONTENT_STORE_PATH), "../content-studio/published.json") : resolve(defaultPhaseRoot, "content-studio-store/published.json")));
const studioSeedPath = resolve(defaultPhaseRoot, "content-studio-store/seed.json");
const studioOutputPath = resolve(projectRoot, "src/data/content-studio-runtime.json");

const [liveState, seedState, publicMap] = await Promise.all([
  readFile(storePath, "utf8").then(JSON.parse).catch(() => null),
  readFile(seedPath, "utf8").then(JSON.parse),
  readFile(publicMapPath, "utf8").then(JSON.parse),
]);
const state = liveState && Number(liveState.version) >= Number(seedState.version) ? liveState : seedState;

if (state?.schemaVersion !== 1 || !Array.isArray(state.themes) || !Array.isArray(state.placeAssignments)) {
  throw new Error("Visitor content store is not a supported schemaVersion 1 document.");
}

const publicPlaces = new Map(publicMap.places.map((place) => [place.code, place]));
const publishedContents = state.contents
  .filter((item) => !item.deletedAt && item.status === "published" && item.published)
  .map((item) => ({ id:item.id, version:item.publishedVersion, publishedAt:item.publishedAt, document:item.published }));

const mediaItems = state.media?.items || {};
const contentCoverByPlace = new Map();
for (const content of publishedContents) {
  if (content.document.slug === "corridor") continue;
  const cover=mediaItems[`content.${content.id}.cover`]?.fileName;
  if (!cover) continue;
  for (const link of content.document.placeLinks.filter((item)=>item.role==="primary")) contentCoverByPlace.set(link.placeCode,cover);
}
const referencedFiles = new Set(Object.values(mediaItems).map((image) => image.fileName));
for (const image of [state.home?.published?.heroImage]) if (image?.fileName) referencedFiles.add(image.fileName);

await mkdir(publicMediaDir, { recursive:true });
for (const fileName of referencedFiles) {
  if (!/^[a-f0-9]{64}\.(?:jpg|png|webp)$/.test(fileName)) throw new Error(`Unsafe visitor media filename: ${fileName}`);
  const source = resolve(mediaDir, fileName);
  const publicFile = resolve(publicMediaDir, fileName);
  try {
    await access(source);
    await copyFile(source, publicFile);
  } catch {
    await access(publicFile);
  }
}

const runtime = {
  schemaVersion:1,
  sourceStoreVersion:state.version,
  generatedAt:state.updatedAt,
  home:{ ...state.home?.published, heroImage:mediaItems["home.hero"]?.fileName || state.home?.published?.heroImage?.fileName || null },
  themes:[...state.themes].sort((a,b)=>a.sequence-b.sequence).map(({id,name,icon,tone,description,sequence})=>({id,name,icon,tone,description,sequence,heroImage:mediaItems[`theme.${id}.hero`]?.fileName || null})),
  places:state.placeAssignments
    .filter((assignment)=>assignment.themeIds.length && publicPlaces.has(assignment.placeCode))
    .map((assignment)=>{
      const place=publicPlaces.get(assignment.placeCode);
      const orderedThemes=[...assignment.themeIds].sort((a,b)=>(assignment.orderByTheme?.[a]??99999)-(assignment.orderByTheme?.[b]??99999));
      const primaryTheme=orderedThemes[0];
      return {
        code:assignment.placeCode,
        name:assignment.titleByTheme?.[primaryTheme] || place.name,
        region:place.region || "一号风景道沿线",
        summary:assignment.summaryByTheme?.[primaryTheme] || "查看地点与导航信息。",
        summaryByTheme:assignment.summaryByTheme || {},
        themes:assignment.themeIds,
        familyFriendly:Boolean(assignment.familyFriendly),
        facilities:assignment.facilities || {},
        status:place.status || "正常",
        orderByTheme:assignment.orderByTheme || {},
        image:mediaItems[`place.${assignment.placeCode}.cover`]?.fileName || contentCoverByPlace.get(assignment.placeCode) || null,
      };
    }),
  contents:publishedContents,
  alerts:state.alerts.filter((alert)=>!alert.deletedAt && alert.enabled),
  media:Object.fromEntries(Object.entries(mediaItems).map(([slot,image])=>[slot,image.fileName])),
};

await writeFile(outputPath, JSON.stringify(runtime,null,2)+"\n", "utf8");

const studioSource=await readFile(studioSnapshotPath,"utf8").then(JSON.parse).catch(async()=>{
  // The production website checkout is intentionally self-contained and may
  // not include the sibling admin project on its first V6 deployment. The
  // committed runtime snapshot is therefore the safe deployment fallback;
  // local development can still regenerate it from the canonical seed.
  const committed=await readFile(studioOutputPath,"utf8").then(JSON.parse).catch(()=>null);
  if(committed?.schemaVersion===2&&committed?.document?.schemaVersion===2)return committed;
  return {schemaVersion:2,contentRevision:"repository-seed",contentSnapshotHash:null,publishedAt:null,document:JSON.parse(await readFile(studioSeedPath,"utf8"))};
});
if(studioSource?.schemaVersion!==2||studioSource?.document?.schemaVersion!==2)throw new Error("Content Studio snapshot is not a supported schemaVersion 2 document.");
if(Object.keys(studioSource.document.places||{}).length!==publicMap.places.length)throw new Error(`Content Studio place integrity mismatch: expected ${publicMap.places.length}.`);
if(studioSource.document.geometry?.routeCount!==publicMap.routes.length||studioSource.document.geometry?.pointCount!==publicMap.routeSource.geometryPointCount)throw new Error("Protected route geometry metadata changed in Content Studio.");
if(!studioSource.contentSnapshotHash)studioSource.contentSnapshotHash=createHash("sha256").update(JSON.stringify(studioSource.document)).digest("hex");
await writeFile(studioOutputPath,JSON.stringify(studioSource,null,2)+"\n","utf8");

const existingFiles = new Set(await readdir(publicMediaDir));
const missing = [...referencedFiles].filter((file)=>!existingFiles.has(file));
if (missing.length) throw new Error(`Visitor media copy incomplete: ${missing.join(", ")}`);

console.log(`Synced visitor content store v${state.version}${state === seedState ? " from repository snapshot" : " from live store"}: ${runtime.themes.length} themes, ${runtime.places.length} theme places, ${referencedFiles.size} media files. Content Studio ${studioSource.contentRevision}: ${Object.keys(studioSource.document.places).length} places.`);
