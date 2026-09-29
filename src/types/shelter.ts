// Core TypeScript interfaces for TerraShelter
// REGION-AGNOSTIC DATA STRUCTURES

export const DEFAULT_VERIFICATION_NOTICE =
  'Default reference value — verify before deployment' as const;

export const SAMPLE_PRESET_NOTICE =
  'SAMPLE DATA — NOT VALIDATED, FOR DEMO ONLY' as const;

/**
 * Single hourly climate reading.
 * Exactly 24 data points (0..23) describe a full diurnal cycle.
 */
export interface AmbientDataPoint {
  hour: number; // 0 to 23
  temperature_C: number; // Ambient air temperature in Celsius
  irradiance_wm2: number; // Total solar irradiance on horizontal surface (W/m²)
}

/**
 * Climate metadata and full 24-hour diurnal profile.
 * Free-text region name ensures true region-agnostic operation.
 */
export interface AmbientClimateConfig {
  regionName: string;
  latitude: number; // Decimal degrees (-90 to 90)
  longitude: number; // Decimal degrees (-180 to 180)
  dateSeasonLabel: string; // e.g., "Representative Winter Solstice" or "Dry Season"
  hourlyProfile: AmbientDataPoint[]; // Array of exactly 24 hours (0-23)
}

/**
 * Thermophysical material definition.
 * All default reference numerical values must be verified before field deployment.
 */
export interface Material {
  id: string;
  name: string;
  description?: string;
  conductivity_k: number; // Thermal conductivity k (W/m·K)
  density: number; // Density ρ (kg/m³)
  specificHeat_c: number; // Specific heat capacity c (J/kg·K)
  solarAbsorptivity: number; // Solar absorptivity α (0 to 1)
  thermalEmissivity: number; // Thermal emissivity ε (0 to 1)
  isDefaultReference: boolean; // Flags if values are reference placeholders
  verificationNotice: string; // Always visible on UI: "Default reference value — verify before deployment"
}

/**
 * A single layer in a multi-layer composite wall or roof.
 */
export interface WallLayer {
  id: string;
  materialId: string;
  thickness_m: number; // Thickness in meters (m)
}

/**
 * Supported opening types for passive solar and thermal envelope modeling.
 */
export type ShelterOpeningType = 'plain_glass' | 'insulated' | 'open_gap';

export interface ShelterOpening {
  id: string;
  count: number;
  areaEach_m2: number; // Area per opening in square meters (m²)
  type: ShelterOpeningType;
  description?: string;
}

/**
 * Supported shelter geometry shapes.
 * Structured as an extensible union for future shapes (dome, a-frame, etc.),
 * with rectangular box as the current implementation.
 */
export type ShelterShape = 'rectangular_box';

export interface ShelterGeometry {
  shape: ShelterShape;
  length_m: number; // Length in meters (m)
  width_m: number; // Width in meters (m)
  height_m: number; // Height in meters (m)
  orientation_deg: number; // Compass azimuth degrees (0 = North, 90 = East, 180 = South, 270 = West)
  openings: ShelterOpening[];
}

/**
 * Comprehensive Shelter Configuration.
 * Single source of truth shared between Quick Mode and Advanced Mode,
 * and structured to feed directly into future calculation engines.
 */
export interface ShelterConfig {
  ambientClimate: AmbientClimateConfig;
  materialsLibrary: Material[];
  wallLayers: WallLayer[];
  roofLayers: WallLayer[];
  geometry: ShelterGeometry;
  activePresetId: string | null;
}

/**
 * UI Convenience Preset definition.
 * NOTE: UI convenience presets only — the app logic must treat them
 * identically to any user-uploaded or manually entered data, with no special-casing.
 */
export interface RegionPreset {
  id: string;
  name: string;
  climateSummary: string;
  disclaimer: typeof SAMPLE_PRESET_NOTICE;
  ambientClimate: AmbientClimateConfig;
  defaultGeometry: Omit<ShelterGeometry, 'openings'> & { openings: ShelterOpening[] };
  defaultSingleMaterialId: string;
  defaultWallThickness_m: number;
  defaultRoofThickness_m: number;
}
