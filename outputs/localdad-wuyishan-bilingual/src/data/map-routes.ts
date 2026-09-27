import type { MapRouteGeometry } from "../types/map";
import { locationDatabase } from "./locations";
import { validateMapRoutes } from "../lib/map-data";

// Add a route only after its line geometry and related places are confirmed.
export const mapRouteDatabase: readonly MapRouteGeometry[] = [];

validateMapRoutes(mapRouteDatabase, new Set(locationDatabase.map((location) => location.slug)));
