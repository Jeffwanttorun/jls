import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const originalsRoot = join(root, "media/originals");
const metadataRoot = join(root, "src/data/image-sources");
const publicImagesRoot = join(root, "public/images");
const libraryRoot = join(publicImagesRoot, "library");
const stableIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const supportedExtensions = new Set([".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp", ".avif"]);
const maxOriginalBytes = 30 * 1024 * 1024;
const maxPublicImageBytes = 2 * 1024 * 1024;
const targetWidths = [640, 960, 1440];

function parseFlags(values) {
  const flags = {};
  for (let index = 0; index < values.length; index += 1) {
    const token = values[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = values[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    flags[key] = value;
    index += 1;
  }
  return flags;
}

function required(flags, key) {
  const value = flags[key]?.trim();
  if (!value) throw new Error(`Missing required option: --${key}`);
  return value;
}

function csv(value) {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
}

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes:true }).flatMap((entry) => entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]);
}

function imageFiles(directory) {
  return walk(directory).filter((path) => supportedExtensions.has(extname(path).toLowerCase()));
}

function managedRecords() {
  if (!existsSync(metadataRoot)) return [];
  return walk(metadataRoot).filter((path) => extname(path) === ".json").map((path) => ({ path, data:JSON.parse(readFileSync(path, "utf8")) }));
}

function ensureUnique(values, label, issues) {
  const seen = new Set();
  for (const value of values) {
    const normalized = String(value).toLowerCase();
    if (seen.has(normalized)) issues.push(`Duplicate ${label}: ${value}`);
    seen.add(normalized);
  }
}

async function check() {
  const issues = [];
  const records = managedRecords();
  ensureUnique(records.map(({ data }) => data.id), "managed image ID", issues);
  ensureUnique(records.map(({ data }) => data.filename), "original image filename", issues);
  ensureUnique(imageFiles(publicImagesRoot).map((path) => basename(path)), "public image filename", issues);

  for (const { path, data } of records) {
    const label = relative(root, path);
    if (!stableIdPattern.test(data.id ?? "")) issues.push(`${label}: invalid or missing id`);
    if (!data.filename?.trim()) issues.push(`${label}: missing filename`);
    if (!data.alt?.trim()) issues.push(`${label}: missing alt text`);
    if (!Number.isInteger(data.originalWidth) || data.originalWidth < 1 || !Number.isInteger(data.originalHeight) || data.originalHeight < 1) issues.push(`${label}: invalid original dimensions`);
    if (!Number.isInteger(data.width) || data.width < 1 || !Number.isInteger(data.height) || data.height < 1) issues.push(`${label}: invalid display dimensions`);
    if (data.relatedPlaceId && !stableIdPattern.test(data.relatedPlaceId)) issues.push(`${label}: invalid relatedPlaceId`);
    if (data.photoDate && data.captureDate && data.photoDate !== data.captureDate) issues.push(`${label}: photoDate and legacy captureDate must match when both are present`);
    if (data.recordStatus === "published" && data.copyrightStatus === "unconfirmed") issues.push(`${label}: published image rights are unconfirmed`);
    if (data.recordStatus === "published" && ["licensed", "permission-granted", "public-domain"].includes(data.copyrightStatus) && !data.source?.trim() && !data.creditSource?.trim()) issues.push(`${label}: published third-party image is missing source information`);
    if (data.recordStatus === "published" && ["licensed", "permission-granted", "public-domain"].includes(data.copyrightStatus) && !data.credit?.trim() && !data.creditSource?.trim()) issues.push(`${label}: published third-party image is missing credit information`);

    const originalPath = join(originalsRoot, data.filename ?? "");
    if (!existsSync(originalPath)) issues.push(`${label}: missing original file media/originals/${data.filename ?? ""}`);
    else {
      const originalStat = statSync(originalPath);
      if (originalStat.size > maxOriginalBytes) issues.push(`${label}: original exceeds 30 MB`);
      const metadata = await sharp(originalPath).metadata();
      if (metadata.width !== data.originalWidth || metadata.height !== data.originalHeight) issues.push(`${label}: original dimensions do not match the file`);
      if (originalStat.size !== data.originalBytes) issues.push(`${label}: original byte size does not match the file`);
    }

    for (const variant of data.variants ?? []) {
      const variantPath = join(root, "public", String(variant.src ?? "").replace(/^\//, ""));
      if (!existsSync(variantPath)) {
        issues.push(`${label}: missing generated variant ${variant.src ?? ""}`);
        continue;
      }
      const stat = statSync(variantPath);
      if (stat.size > maxPublicImageBytes) issues.push(`${label}: generated variant exceeds 2 MB: ${variant.src}`);
      if (stat.size !== variant.bytes) issues.push(`${label}: generated byte size does not match: ${variant.src}`);
      const metadata = await sharp(variantPath).metadata();
      if (metadata.width !== variant.width || metadata.height !== variant.height || metadata.format !== variant.format) issues.push(`${label}: generated format or dimensions do not match: ${variant.src}`);
    }
  }

  for (const path of imageFiles(publicImagesRoot)) {
    if (statSync(path).size > maxPublicImageBytes) issues.push(`${relative(root, path)}: public image exceeds 2 MB`);
    const metadata = await sharp(path).metadata();
    if (!metadata.width || !metadata.height) issues.push(`${relative(root, path)}: image dimensions cannot be read`);
  }

  if (issues.length) throw new Error(`Image validation failed:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
  console.log(`Image validation passed: ${records.length} managed assets; ${imageFiles(publicImagesRoot).length} public image files.`);
}

async function prepare(flags) {
  const id = required(flags, "id");
  if (!stableIdPattern.test(id)) throw new Error("Image ID must use lowercase letters, numbers, and single hyphens.");
  const requestedFile = required(flags, "file");
  const filename = basename(requestedFile);
  if (filename !== requestedFile) throw new Error("Use a filename from media/originals, not a path.");
  const sourcePath = join(originalsRoot, filename);
  if (!existsSync(sourcePath)) throw new Error(`Original image not found: media/originals/${filename}`);
  if (!supportedExtensions.has(extname(filename).toLowerCase())) throw new Error(`Unsupported image format: ${extname(filename)}`);
  const alt = required(flags, "alt");
  const copyrightStatus = required(flags, "copyright-status");
  if (!["owned", "licensed", "permission-granted", "public-domain", "unconfirmed"].includes(copyrightStatus)) throw new Error("Invalid --copyright-status value.");
  if (flags["capture-date"] && !/^\d{4}-\d{2}-\d{2}$/.test(flags["capture-date"])) throw new Error("Capture date must use YYYY-MM-DD.");
  if (flags["photo-date"] && !/^\d{4}-\d{2}-\d{2}$/.test(flags["photo-date"])) throw new Error("Photo date must use YYYY-MM-DD.");
  if (flags["capture-date"] && flags["photo-date"] && flags["capture-date"] !== flags["photo-date"]) throw new Error("--photo-date and legacy --capture-date must match when both are used.");
  const relatedPlaceId = flags["related-place"]?.trim();
  if (relatedPlaceId && !stableIdPattern.test(relatedPlaceId)) throw new Error("Related place ID must use lowercase letters, numbers, and single hyphens.");
  const relationships = {
    places:[...new Set([...(relatedPlaceId ? [relatedPlaceId] : []), ...csv(flags["related-places"])])],
    topics:csv(flags["related-topics"]),
    videos:csv(flags["related-videos"]),
  };
  for (const [type, ids] of Object.entries(relationships)) {
    for (const relationshipId of ids) if (!stableIdPattern.test(relationshipId)) throw new Error(`Invalid related ${type} ID: ${relationshipId}`);
  }
  const relatedArticles = csv(flags["related-articles"]).map((value) => {
    const [type, articleId, extra] = value.split(":");
    if (extra || !["knowledge", "route", "story"].includes(type) || !stableIdPattern.test(articleId ?? "")) throw new Error(`Invalid related article '${value}'. Use type:id.`);
    return { type, id:articleId };
  });
  const metadataPath = join(metadataRoot, `${id}.json`);
  const outputPath = join(libraryRoot, id);
  if (existsSync(metadataPath) || existsSync(outputPath)) throw new Error(`Refusing to overwrite an existing managed image: ${id}`);
  if (managedRecords().some(({ data }) => data.filename?.toLowerCase() === filename.toLowerCase())) throw new Error(`Original filename is already registered: ${filename}`);
  const sourceStat = statSync(sourcePath);
  if (sourceStat.size > maxOriginalBytes) throw new Error("Original image exceeds the 30 MB authoring limit.");
  const sourceMetadata = await sharp(sourcePath).metadata();
  if (!sourceMetadata.width || !sourceMetadata.height) throw new Error("Image dimensions could not be read.");

  const widths = [...new Set(targetWidths.map((width) => Math.min(width, sourceMetadata.width)).filter((width) => width > 0))].sort((a, b) => a - b);
  const temporaryPath = `${outputPath}.tmp`;
  mkdirSync(temporaryPath, { recursive:true });
  const variants = [];
  try {
    for (const width of widths) {
      for (const format of ["jpeg", "webp", "avif"]) {
        const extension = format === "jpeg" ? "jpg" : format;
        const name = `${id}-${width}.${extension}`;
        const destination = join(temporaryPath, name);
        const pipeline = sharp(sourcePath).rotate().resize({ width, withoutEnlargement:true });
        let output;
        if (format === "jpeg") output = await pipeline.jpeg({ quality:82, mozjpeg:true }).toFile(destination);
        if (format === "webp") output = await pipeline.webp({ quality:80 }).toFile(destination);
        if (format === "avif") output = await pipeline.avif({ quality:55 }).toFile(destination);
        const bytes = statSync(destination).size;
        if (bytes > maxPublicImageBytes) throw new Error(`Generated variant exceeds 2 MB: ${name}`);
        variants.push({ src:`/images/library/${id}/${name}`, format, width:output.width, height:output.height, bytes });
      }
    }
    mkdirSync(libraryRoot, { recursive:true });
    renameSync(temporaryPath, outputPath);
  } catch (error) {
    rmSync(temporaryPath, { recursive:true, force:true });
    throw error;
  }

  const largestJpeg = variants.filter((variant) => variant.format === "jpeg").at(-1);
  const srcset = (format) => variants.filter((variant) => variant.format === format).map((variant) => `${variant.src} ${variant.width}w`).join(", ");
  const record = {
    id,
    filename,
    alt,
    ...(flags.caption ? { caption:flags.caption } : {}),
    ...(flags.source ? { source:flags.source } : {}),
    ...(flags.credit ? { credit:flags.credit } : {}),
    copyrightStatus,
    ...(flags.photographer ? { photographer:flags.photographer } : {}),
    ...(flags["photo-location"] ? { photoLocation:flags["photo-location"] } : {}),
    ...(flags["photo-date"] ? { photoDate:flags["photo-date"] } : {}),
    ...(relatedPlaceId ? { relatedPlaceId } : {}),
    ...(flags["capture-date"] ? { captureDate:flags["capture-date"] } : {}),
    originalWidth:sourceMetadata.width,
    originalHeight:sourceMetadata.height,
    originalBytes:sourceStat.size,
    src:largestJpeg.src,
    srcset:srcset("jpeg"),
    avifSrcset:srcset("avif"),
    webpSrcset:srcset("webp"),
    width:largestJpeg.width,
    height:largestJpeg.height,
    variants,
    relatedPlaceIds:relationships.places,
    relatedTopicIds:relationships.topics,
    relatedArticles,
    relatedVideoIds:relationships.videos,
    recordStatus:"draft",
  };
  mkdirSync(metadataRoot, { recursive:true });
  writeFileSync(metadataPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  console.log(`Prepared draft image asset: ${relative(root, metadataPath)}`);
  console.log(`Generated ${variants.length} responsive JPEG, WebP, and AVIF files in ${relative(root, outputPath)}.`);
}

function help() {
  console.log(`Image tools\n\nPrepare: npm run image:prepare -- --file <filename-in-media/originals> --id <stable-id> --alt <description> --copyright-status <owned|licensed|permission-granted|public-domain|unconfirmed>\nValidate: npm run image:check\n\nOptional metadata: --caption, --source, --credit, --photographer, --photo-location, --photo-date, --related-place, --related-places, --related-topics, --related-articles type:id, --related-videos. Comma-separate relationship values. Legacy --capture-date remains supported.`);
}

try {
  const command = process.argv[2] ?? "help";
  if (command === "prepare") await prepare(parseFlags(process.argv.slice(3)));
  else if (command === "check") await check();
  else help();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
