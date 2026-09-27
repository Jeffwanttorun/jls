import type { CreatorProfile } from "../types/social";
import { validateCreatorProfiles } from "../lib/creator-profiles";

// Add a profile only after Jeff confirms ownership and the public URL.
export const creatorProfileDatabase: readonly CreatorProfile[] = [];

validateCreatorProfiles(creatorProfileDatabase);
