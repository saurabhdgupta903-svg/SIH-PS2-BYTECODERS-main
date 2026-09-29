/**
 * SAMPLE DATA — NOT VALIDATED. Edit to reflect real local availability.
 *
 * Region Material Availability + default design goals for TerraShelter.
 * Maps each region preset id to an array of available material IDs.
 * Initialized to ALL library materials for every region (no invented
 * restrictions) except glazing-type materials, which are never wall materials.
 */
import { DEFAULT_MATERIALS } from '../data/defaultMaterials.ts';
import type { DesignGoal } from './rankingObjectives.ts';
import { NON_WALL_MATERIAL_IDS, isNonWallMaterial } from './wallMaterials.ts';

export { NON_WALL_MATERIAL_IDS, isNonWallMaterial };

const WALL_MATERIAL_IDS: string[] = DEFAULT_MATERIALS.map((m) => m.id).filter(
  (id) => !isNonWallMaterial(id)
);

export const REGION_MATERIAL_AVAILABILITY: Record<string, string[]> = {
  cold_high_altitude_desert: [...WALL_MATERIAL_IDS],
  hot_arid_climate: [...WALL_MATERIAL_IDS],
  temperate_climate: [...WALL_MATERIAL_IDS],
};

/**
 * SAMPLE DATA — NOT VALIDATED. Edit to reflect real design goals.
 * The design GOAL of a region (what the shelter is for). This is a problem
 * definition, not a design mapping: the winning design is always found by
 * simulation.
 */
export const REGION_DESIGN_GOALS: Record<string, DesignGoal> = {
  cold_high_altitude_desert: 'keep_warm',
  hot_arid_climate: 'keep_cool',
  temperate_climate: 'stabilize',
};

/** Default goal for a preset id; custom or unknown configurations default to 'keep_warm'. */
export function getDefaultGoalForRegion(regionPresetId: string | null): DesignGoal {
  if (regionPresetId && REGION_DESIGN_GOALS[regionPresetId]) {
    return REGION_DESIGN_GOALS[regionPresetId];
  }
  return 'keep_warm';
}

/**
 * Returns available material IDs for a given preset ID,
 * falling back to all wall-capable library materials if unknown or null.
 */
export function getAvailableMaterialsForRegion(regionPresetId: string | null): string[] {
  if (regionPresetId && REGION_MATERIAL_AVAILABILITY[regionPresetId]) {
    return [...REGION_MATERIAL_AVAILABILITY[regionPresetId]];
  }
  return [...WALL_MATERIAL_IDS];
}
