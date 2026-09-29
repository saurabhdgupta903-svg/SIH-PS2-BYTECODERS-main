// VISUAL ONLY — not a physical property.
// Visual appearance mapping for TerraShelter 3D rendering.
// Physical properties (conductivity k, density rho, specific heat c, absorptivity alpha, emissivity epsilon)
// are strictly defined in Material within src/types/shelter.ts and materialsLibrary.

export interface VisualAppearance {
  color: string;
  roughness: number;
  metalness: number;
  opacity?: number;
  transparent?: boolean;
  legendNote?: string;
}

/**
 * Known material appearances for standard architectural materials.
 * Header comment: VISUAL ONLY — not a physical property.
 */
export const MATERIAL_VISUAL_REGISTRY: Record<string, VisualAppearance> = {
  mud_brick_adobe: {
    color: '#b47a4c', // Warm earthen terracotta / adobe
    roughness: 0.92,
    metalness: 0.02,
  },
  natural_stone: {
    color: '#78716c', // Granite / limestone / slate stone gray
    roughness: 0.85,
    metalness: 0.05,
  },
  ceb_compressed_earth: {
    color: '#9a6744', // Stabilized compressed earth block
    roughness: 0.88,
    metalness: 0.03,
  },
  glass: {
    color: '#67e8f9', // Translucent architectural glazing
    roughness: 0.1,
    metalness: 0.1,
    opacity: 0.45,
    transparent: true,
  },
  mineral_wool_insulation: {
    color: '#facc15', // Yellow mineral wool insulation batt
    roughness: 0.95,
    metalness: 0.0,
  },
};

/**
 * Fallback visual appearance for any material without an explicit entry.
 * Per project specification: neutral gray with legend note "no appearance defined".
 * Do not guess appearances for unknown materials.
 */
export const DEFAULT_UNKNOWN_APPEARANCE: VisualAppearance = {
  color: '#94a3b8', // Neutral gray (slate-400)
  roughness: 0.8,
  metalness: 0.0,
  legendNote: 'no appearance defined',
};

/**
 * Pure lookup function returning visual appearance.
 * Returns neutral gray if materialId is not found in registry.
 */
export function getMaterialAppearance(materialId: string | undefined): VisualAppearance {
  if (!materialId || !MATERIAL_VISUAL_REGISTRY[materialId]) {
    return DEFAULT_UNKNOWN_APPEARANCE;
  }
  return MATERIAL_VISUAL_REGISTRY[materialId];
}
