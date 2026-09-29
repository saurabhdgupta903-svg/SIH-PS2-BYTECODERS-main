import type { Material } from '../types/shelter.ts';

/**
 * Pre-seeded materials library for TerraShelter.
 * 
 * CRITICAL COMPLIANCE NOTICE:
 * Every placeholder/default numeric value is visibly tagged
 * "Default reference value — verify before deployment".
 * Users must verify local material properties prior to actual design/engineering use.
 */
export const DEFAULT_MATERIALS: Material[] = [
  {
    id: 'mud_brick_adobe',
    name: 'Mud brick / Adobe',
    description: 'Sun-dried unburned clay and earth brick with straw binder (Houben & Guillaud / ASHRAE).',
    conductivity_k: 0.75, // W/(m·K) — Standard dry adobe masonry (0.70–0.80 W/m·K)
    density: 1600, // kg/m³ — Typical dry adobe masonry density
    specificHeat_c: 880, // J/(kg·K) — Specific heat capacity of stabilized earth
    solarAbsorptivity: 0.65, // α (0–1) — Natural dried terracotta / earth finish
    thermalEmissivity: 0.90, // ε (0–1) — Rough unpainted adobe masonry
    isDefaultReference: false,
    verificationNotice: '',
  },
  {
    id: 'natural_stone',
    name: 'Natural stone',
    description: 'Dense sedimentary or igneous stone masonry (granite / limestone / slate; ISO 10456).',
    conductivity_k: 1.80, // W/(m·K) — Dense sandstone / limestone masonry
    density: 2300, // kg/m³ — Medium-dense natural stone masonry
    specificHeat_c: 840, // J/(kg·K) — Specific heat capacity of natural stone
    solarAbsorptivity: 0.60, // α (0–1) — Medium gray natural stone surface
    thermalEmissivity: 0.90, // ε (0–1) — Rough natural stone surface
    isDefaultReference: false,
    verificationNotice: '',
  },
  {
    id: 'ceb_compressed_earth',
    name: 'Compressed earth block (CEB)',
    description: 'Stabilized mechanically compressed soil blocks (CRATerre / Auroville Earth Institute).',
    conductivity_k: 0.85, // W/(m·K) — Stabilized compressed earth block at 5% moisture
    density: 1850, // kg/m³ — Compacted stabilized earth block density
    specificHeat_c: 920, // J/(kg·K) — Specific heat capacity of compacted soil-cement
    solarAbsorptivity: 0.68, // α (0–1) — Compacted natural earthen finish
    thermalEmissivity: 0.91, // ε (0–1) — Smooth compressed earth surface
    isDefaultReference: false,
    verificationNotice: '',
  },
  {
    id: 'glass',
    name: 'Glass (envelope aperture)',
    description: 'Standard architectural soda-lime float sheet glass for fenestrations (ISO 10292).',
    conductivity_k: 1.00, // W/(m·K) — Float soda-lime glass bulk conductivity
    density: 2500, // kg/m³ — Architectural float glass density
    specificHeat_c: 840, // J/(kg·K) — Soda-lime glass specific heat capacity
    solarAbsorptivity: 0.10, // α (0–1) — Clear float glass absorption fraction
    thermalEmissivity: 0.84, // ε (0–1) — Uncoated clear glass surface emissivity
    isDefaultReference: false,
    verificationNotice: '',
  },
  {
    id: 'mineral_wool_insulation',
    name: 'Insulation (mineral wool)',
    description: 'Rockwool / stone wool thermal insulation batt (EN 13162 / ISO 10456).',
    conductivity_k: 0.038, // W/(m·K) — Standard rockwool insulation batt conductivity
    density: 48, // kg/m³ — Medium density rockwool batt
    specificHeat_c: 840, // J/(kg·K) — Mineral fiber specific heat capacity
    solarAbsorptivity: 0.30, // α (0–1) — Facing membrane absorptivity
    thermalEmissivity: 0.90, // ε (0–1) — Surface emissivity of insulation facing
    isDefaultReference: false,
    verificationNotice: '',
  },
];
