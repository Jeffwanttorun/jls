import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const editorialFolders = {
  knowledge:"src/content/knowledge",
  route:"src/content/routes",
  person:"src/content/people",
  story:"src/content/local-stories",
  tea:"src/content/tea-culture",
  family:"src/content/family-guides",
};

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

function validateCommon(flags) {
  const slug = required(flags, "slug");
  if (!slugPattern.test(slug)) throw new Error("Slug must use lowercase letters, numbers, and single hyphens.");
  const description = required(flags, "description");
  if (description.length < 50 || description.length > 180) throw new Error("Description must contain 50–180 characters.");
  const lang = flags.lang ?? "en";
  if (!["en", "zh"].includes(lang)) throw new Error("Language must be en or zh.");
  return { slug, description, lang, title:required(flags, "title") };
}

function yamlValue(value) {
  return typeof value === "string" ? JSON.stringify(value) : JSON.stringify(value);
}

function markdownDocument(frontmatter) {
  const lines = Object.entries(frontmatter).map(([key, value]) => `${key}: ${yamlValue(value)}`);
  return `---\n${lines.join("\n")}\n---\n\n`;
}

function writeNewFile(path, content) {
  if (existsSync(path)) throw new Error(`Refusing to overwrite existing file: ${relative(root, path)}`);
  mkdirSync(dirname(path), { recursive:true });
  writeFileSync(path, content, "utf8");
  console.log(`Created draft: ${relative(root, path)}`);
}

function createEditorialDraft(type, flags) {
  const { slug, description, lang, title } = validateCommon(flags);
  const today = new Date().toISOString().slice(0, 10);
  const common = {
    title,
    slug,
    description,
    eyebrow:flags.eyebrow ?? title,
    lang,
    translationKey:flags["translation-key"] ?? slug,
    audience:[],
    created:today,
    updated:today,
    trustStatus:"reconfirm-before-travel",
    recordStatus:"draft",
    practicalInformation:[],
    photos:[],
    videos:[],
    relatedPlaceIds:[],
    relatedPersonIds:[],
    relatedStoryIds:[],
    relatedRouteIds:[],
    relatedKnowledgeIds:[],
    relatedGuideIds:[],
    relatedTopics:[],
    sources:[],
  };
  if (type === "knowledge") {
    const category = required(flags, "heritage-category");
    if (!["overview", "natural-heritage", "cultural-heritage", "tea-heritage", "living-heritage"].includes(category)) throw new Error("Invalid --heritage-category value.");
    common.contentCategory = category === "overview" ? "why-wuyishan" : category;
    common.trustStatus = "research-in-progress";
    common.heritageCategory = category;
    common.heritageCategories = category === "overview" ? ["natural-heritage", "tea-heritage", "cultural-heritage", "living-heritage"] : [category];
    common.summary = required(flags, "summary");
    common.keyIdeaIds = [];
    common.learningNotes = { readingFocus:[], keyVocabulary:[], usefulSentences:[], speakingPractice:[], guideUsage:[] };
  } else if (type === "route") {
    common.contentCategory = "route";
    common.routeName = title;
    common.highlights = [];
    common.routeLocations = [];
    common.transportNotes = [];
  } else if (type === "person") {
    common.contentCategory = "person";
    common.personName = required(flags, "person-name");
    common.shortIntroduction = required(flags, "introduction");
    common.relatedThemes = [];
  } else if (type === "story") {
    const storyType = required(flags, "story-type");
    if (!["people", "work", "food", "tea", "family", "daily-life"].includes(storyType)) throw new Error("Invalid --story-type value.");
    common.contentCategory = "story";
    common.storyType = storyType;
  } else if (type === "tea") {
    common.contentCategory = "tea-culture";
    common.teaNames = [];
  } else if (type === "family") {
    common.contentCategory = "family-travel";
    common.familyConsiderations = [];
  }
  writeNewFile(join(root, editorialFolders[type], `${slug}.md`), markdownDocument(common));
}

function createPlaceDraft(flags) {
  const { slug, description, lang, title } = validateCommon(flags);
  if (lang !== "en") throw new Error("Create the shared place record with --lang en, then add a reviewed Chinese narrative later.");
  const categories = required(flags, "categories").split(",").map((value) => value.trim()).filter(Boolean);
  const allowed = new Set(["river", "peak", "trail", "tea-area", "village", "neighborhood", "recreation-area"]);
  for (const category of categories) if (!allowed.has(category)) throw new Error(`Unknown place category: ${category}`);
  const source = {
    slug,
    translationKey:flags["translation-key"] ?? slug,
    title,
    englishName:flags["english-name"] ?? title,
    description,
    localSummary:required(flags, "summary"),
    lang:"en",
    categories,
    experienceCategories:[],
    audience:[],
    bestFor:[],
    sourceStatus:"reconfirm-before-travel",
    nearbyPlaces:[],
    gallery:[],
    relatedTopics:[],
    relatedRouteIds:[],
    relatedStoryIds:[],
    videos:[],
    order:99,
    featured:false,
    recordStatus:"draft",
  };
  const sourcePath = join(root, "src/data/place-sources", `${slug}.json`);
  const narrativePath = join(root, "src/content/locations", slug, "en.md");
  if (existsSync(sourcePath) || existsSync(narrativePath)) throw new Error(`A place source or narrative already exists for: ${slug}`);
  writeNewFile(sourcePath, `${JSON.stringify(source, null, 2)}\n`);
  writeNewFile(narrativePath, markdownDocument({ recordKey:slug, lang:"en" }));
}

function createVideoDraft(flags) {
  const { slug, description, lang, title } = validateCommon(flags);
  const platform = required(flags, "platform");
  if (!["youtube", "instagram"].includes(platform)) throw new Error("Platform must be youtube or instagram.");
  const contentType = required(flags, "content-type");
  if (!["explanation", "place-visit", "route", "interview", "story"].includes(contentType)) throw new Error("Invalid --content-type value.");
  const source = { slug, title, platform, url:required(flags, "url"), language:lang, contentType, description, relationships:[], recordStatus:"draft" };
  writeNewFile(join(root, "src/data/video-sources", `${slug}.json`), `${JSON.stringify(source, null, 2)}\n`);
}

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes:true }).flatMap((entry) => entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]);
}

function frontmatterValue(source, key) {
  const block = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
  const match = block.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  if (!match) return undefined;
  const value = match[1].trim();
  try { return JSON.parse(value); }
  catch { return value.replace(/^['"]|['"]$/g, ""); }
}

function inventory() {
  const records = [];
  for (const [type, folder] of Object.entries(editorialFolders)) {
    for (const path of walk(join(root, folder)).filter((file) => extname(file) === ".md")) {
      const source = readFileSync(path, "utf8");
      const data = Object.fromEntries(["title", "slug", "description", "eyebrow", "lang", "translationKey", "recordStatus", "summary", "created", "updated", "heritageCategory", "heritageCategories", "personName", "shortIntroduction", "storyType"].map((key) => [key, frontmatterValue(source, key)]));
      records.push({ type, status:data.recordStatus ?? "draft", lang:data.lang ?? "en", id:data.translationKey ?? data.slug ?? "missing-id", path, data, source });
    }
  }
  for (const [type, folder] of [["place", "src/data/place-sources"], ["video", "src/data/video-sources"], ["image", "src/data/image-sources"]]) {
    for (const path of walk(join(root, folder)).filter((file) => extname(file) === ".json")) {
      const source = readFileSync(path, "utf8");
      const data = JSON.parse(source);
      records.push({ type, status:data.recordStatus ?? "draft", lang:data.lang ?? data.language ?? "en", id:data.translationKey ?? data.slug ?? data.id ?? "missing-id", path, data, source });
    }
  }
  for (const path of walk(join(root, "src/content/guides")).filter((file) => extname(file) === ".md")) {
    const source = readFileSync(path, "utf8");
    if (frontmatterValue(source, "recordStatus") !== "draft") continue;
    const data = Object.fromEntries(["title", "slug", "description", "eyebrow", "lang", "translationKey", "recordStatus"].map((key) => [key, frontmatterValue(source, key)]));
    records.push({ type:"guide", status:"draft", lang:data.lang ?? "en", id:data.translationKey ?? data.slug ?? "missing-id", path, data, source });
  }
  return records;
}

function previewPath(record) {
  const sections = { guide:"guides", knowledge:"why-wuyishan", route:"routes", person:"people", story:"local-stories", tea:"tea-culture", family:"family-guides", place:"locations", video:"videos" };
  const slug = record.data.slug;
  return slug && sections[record.type] ? `/draft-preview/${sections[record.type]}/${slug}` : undefined;
}

function showStatus() {
  const records = inventory();
  if (records.length === 0) return console.log("No future content drafts have been created.");
  for (const record of records) {
    const preview = record.status === "draft" ? previewPath(record) : undefined;
    console.log(`${record.status.padEnd(10)} ${record.type.padEnd(10)} ${record.lang} ${record.id}  ${relative(root, record.path)}${preview ? `\n  Local preview: ${preview}` : ""}`);
  }
  const drafts = records.filter((record) => record.status !== "published").length;
  console.log(`\n${records.length} future records; ${drafts} drafts; ${records.length - drafts} published.`);
}

function checkMissing() {
  const issues = [];
  for (const record of inventory()) {
    const label = relative(root, record.path);
    const common = record.type === "place" ? ["slug", "translationKey", "title", "englishName", "description", "localSummary", "categories"] : record.type === "video" ? ["slug", "title", "description", "platform", "url", "language", "contentType", "recordStatus"] : record.type === "image" ? ["id", "filename", "alt", "copyrightStatus", "originalWidth", "originalHeight", "src", "srcset", "avifSrcset", "webpSrcset", "width", "height", "variants", "recordStatus"] : ["title", "slug", "description", "eyebrow", "lang", "translationKey", "recordStatus"];
    for (const field of common) if (record.data[field] === undefined || record.data[field] === "" || (Array.isArray(record.data[field]) && record.data[field].length === 0)) issues.push(`${label}: missing ${field}`);
    if (record.type === "knowledge") for (const field of ["summary", "created", "updated", "heritageCategory", "heritageCategories"]) if (!record.data[field]) issues.push(`${label}: missing ${field}`);
    if (record.type === "route" && !record.data.routeName) issues.push(`${label}: missing routeName`);
    if (record.type === "person") for (const field of ["personName", "shortIntroduction"]) if (!record.data[field]) issues.push(`${label}: missing ${field}`);
    if (record.type === "story" && !record.data.storyType) issues.push(`${label}: missing storyType`);
    if (record.type === "place" && !existsSync(join(root, "src/content/locations", record.data.slug, "en.md"))) issues.push(`${label}: missing English narrative file`);
  }
  if (issues.length) {
    console.error(`Content inventory problems:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
    process.exitCode = 1;
  } else console.log("Content inventory check passed. Detailed schemas and relationships are validated by npm run build.");
}

function markdownBody(source) {
  return source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

function hasNonEmptyFrontmatterList(source, key) {
  const block = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
  const lines = block.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (start < 0) return false;
  const inline = lines[start].slice(key.length + 1).trim();
  if (inline) {
    try {
      const value = JSON.parse(inline);
      return Array.isArray(value) && value.length > 0;
    } catch {
      return inline !== "[]";
    }
  }
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\S/.test(lines[index])) break;
    if (/^\s+-\s+/.test(lines[index])) return true;
  }
  return false;
}

function checkQuality() {
  const issues = [];
  const marketingPatterns = [
    ["must-see or must-visit language", /\bmust[- ](?:see|visit)\b/i],
    ["hidden gem", /\bhidden gem\b/i],
    ["ultimate guide", /\bultimate guide\b/i],
    ["breathtaking", /\bbreathtaking\b/i],
    ["paradise", /\bparadise\b/i],
    ["bucket list", /\bbucket list\b/i],
    ["world-famous", /\bworld[- ]famous\b/i],
    ["unforgettable experience", /\bunforgettable experience\b/i],
    ["best ever", /\bbest ever\b/i],
    ["prohibited pace language", /\bslowly\b|\bslow travel\b/i],
  ];
  const placeholderPattern = /\b(?:TODO|TBD|lorem ipsum|replace me|placeholder content)\b/i;
  const unfinishedEditorialPattern = /\b(?:draft boundary|before publication|finished article should|planned article|historical story is not ready)\b/i;
  const records = inventory();

  for (const record of records.filter((item) => item.type === "knowledge" && item.lang === "en")) {
    const label = relative(root, record.path);
    if (!record.data.summary) issues.push(`${label}: missing summary`);
    if (record.status === "published" && !hasNonEmptyFrontmatterList(record.source, "sources")) issues.push(`${label}: published knowledge article is missing sources`);
    if (record.status === "published" && unfinishedEditorialPattern.test(markdownBody(record.source))) issues.push(`${label}: published article contains an unfinished editorial note`);
  }

  const qualityFiles = [
    ...walk(join(root, "src/content")).filter((path) => extname(path) === ".md"),
    ...["src/data/place-sources", "src/data/video-sources", "src/data/image-sources"].flatMap((folder) => walk(join(root, folder)).filter((path) => extname(path) === ".json")),
  ];

  for (const path of qualityFiles) {
    const source = readFileSync(path, "utf8");
    const label = relative(root, path);
    const lang = path.endsWith(".md") ? frontmatterValue(source, "lang") ?? "en" : JSON.parse(source).lang ?? JSON.parse(source).language ?? "en";
    if (lang !== "en") continue;
    if (placeholderPattern.test(source)) issues.push(`${label}: contains an unsupported placeholder marker`);
    for (const [name, pattern] of marketingPatterns) if (pattern.test(source)) issues.push(`${label}: contains ${name}`);
    if (path.endsWith(".md")) {
      for (const [index, line] of markdownBody(source).split(/\r?\n/).entries()) {
        const hanCharacters = line.match(/[\p{Script=Han}]/gu) ?? [];
        if (hanCharacters.length >= 12 && !/[A-Za-z]/.test(line)) issues.push(`${label}:${index + 1}: possible untranslated Chinese text`);
      }
    }
  }

  if (issues.length) {
    console.error(`Content quality problems:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
    process.exitCode = 1;
  } else console.log("Content quality check passed. No copy was rewritten automatically.");
}

function help() {
  console.log(`Content tools\n\nCreate: npm run content:new -- --type <knowledge|place|route|person|story|tea|family|video> [required options]\nStatus: npm run content:status\nQuality review: npm run content:quality\nLocal draft preview: npm run preview:drafts\nFull validation: npm run content:check\n\nAll new records are drafts. Quality checks report problems but never rewrite copy. Run the create command without enough options to see the missing option; README documents each content type.`);
}

try {
  const command = process.argv[2] ?? "help";
  if (command === "new") {
    const flags = parseFlags(process.argv.slice(3));
    const type = required(flags, "type");
    if (type === "place") createPlaceDraft(flags);
    else if (type === "video") createVideoDraft(flags);
    else if (type in editorialFolders) createEditorialDraft(type, flags);
    else throw new Error(`Unknown content type: ${type}`);
  } else if (command === "status") showStatus();
  else if (command === "missing") checkMissing();
  else if (command === "quality") checkQuality();
  else help();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
