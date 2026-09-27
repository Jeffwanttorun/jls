import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const gcoordModule = require("../../wuyishan-map-phase1/node_modules/gcoord");
const gcoord = gcoordModule.default ?? gcoordModule;
const backupPath = fileURLToPath(new URL("../../wuyishan-map-phase1/database/seed/phase2-final-full.sql", import.meta.url));
const currentStatePath = fileURLToPath(new URL("../../wuyishan-map-phase1/reports/place-detail-v0.2-database-after.json", import.meta.url));
const outputPath = fileURLToPath(new URL("../src/data/wuyishan-public-map.json", import.meta.url));

function readCopy(sql, table) {
  const match = sql.match(new RegExp(`COPY public\\.${table} \\(([^)]+)\\) FROM stdin;\\r?\\n([\\s\\S]*?)\\r?\\n\\\\\\.`, "m"));
  if (!match) throw new Error(`Cannot find ${table} in verified backup`);
  const columns = match[1].split(", ").map((column) => column.trim());
  return match[2].split(/\r?\n/).filter(Boolean).map((line) => Object.fromEntries(line.split("\t").map((value, index) => [columns[index], value === "\\N" ? null : value])));
}

const existing = JSON.parse(await readFile(outputPath, "utf8"));
const state = JSON.parse(await readFile(currentStatePath, "utf8"));
const sql = await readFile(backupPath, "utf8");
const activeCoordinates = new Map(readCopy(sql, "place_coordinates")
  .filter((coordinate) => coordinate.status === "active" && coordinate.human_confirmed === "t" && coordinate.map_coordinate_system === "GCJ-02")
  .map((coordinate) => [coordinate.place_id, coordinate]));

const places = state.places
  .filter((place) => activeCoordinates.has(place.id) && !place.deleted_at && !place.duplicate_of_place_id && place.map_display_role !== "hidden")
  .sort((a, b) => (a.corridor_order ?? Number.MAX_SAFE_INTEGER) - (b.corridor_order ?? Number.MAX_SAFE_INTEGER) || a.code.localeCompare(b.code))
  .map((place) => {
    const coordinate = activeCoordinates.get(place.id);
    const [longitude, latitude] = gcoord.transform([Number(coordinate.map_longitude), Number(coordinate.map_latitude)], gcoord.GCJ02, gcoord.WGS84);
    return {
      code:place.code,
      name:place.name,
      region:place.region,
      status:place.current_status === "待核实" ? "正常" : place.current_status,
      sourceStatus:place.current_status,
      publicLevel:"P1",
      sourcePublicLevel:place.public_level,
      ownerApproved:true,
      coordinateStatus:"active",
      humanConfirmed:true,
      mapDisplayRole:place.map_display_role,
      corridorOrder:place.corridor_order,
      coordinates:{ latitude:Number(latitude.toFixed(7)), longitude:Number(longitude.toFixed(7)), system:"WGS84" },
      navigationCoordinates:{ latitude:Number(coordinate.map_latitude), longitude:Number(coordinate.map_longitude), system:"GCJ-02" },
    };
  });

if (places.length !== 41) throw new Error(`Expected 41 current owner-marked places, got ${places.length}`);

const output = {
  ...existing,
  generatedFrom:"Owner-approved publication of every current active, human-confirmed place coordinate; current place state from read-only integrity snapshot",
  generatedAt:new Date().toISOString(),
  publicationPolicy:{
    decision:"All locations personally marked by the owner may be public",
    decidedAt:"2026-09-24",
    includes:"active + human confirmed + not deleted + not duplicate + map role not hidden",
    excludes:"superseded, revoked, deleted, duplicate, hidden, and places without a formal active coordinate",
    navigation:"Publication does not change operational status or automatically enable navigation",
  },
  publicPlaceCount:places.length,
  places,
};

await writeFile(outputPath, JSON.stringify(output, null, 2) + "\n");
console.log(`Published ${places.length} owner-approved map markers without changing route geometry.`);
