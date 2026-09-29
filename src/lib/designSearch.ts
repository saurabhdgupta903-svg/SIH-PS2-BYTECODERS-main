/**
 * designSearch.ts
 *
 * Pure functions for candidate design generation, evaluation, and ranking.
 * Default search grid — not a standard.
 *
 * Does NOT vary orientation, opening area, or glazing
 * (the engine has no solar incidence model or fenestration U-values).
 *
 * Ranking is goal based (see rankingObjectives.ts). The efficiency score η is
 * deliberately NOT used: at a steady daily cycle it only reflects thermal
 * capacitance times the convergence residual.
 */
import { simulateSteadyCycle, type SimStep } from './simulateSteadyCycle.ts';
import { calculateUValueMultiLayer, calculateThermalCapacitance } from './thermalEngine.ts';
import {
  DEFAULT_TIME_STEP_SECONDS,
  DEFAULT_INFILTRATION_RATE,
  DEFAULT_AIR_DENSITY,
  DEFAULT_AIR_SPECIFIC_HEAT,
  DEFAULT_H_INTERIOR,
  DEFAULT_H_EXTERIOR,
  DEFAULT_SKY_TEMP_OFFSET_C,
} from './engineDefaults.ts';
import {
  computeSeriesStats,
  compareStatsByGoal,
  getGoalInfo,
  goalMetricValue,
  type DesignGoal,
} from './rankingObjectives.ts';
import { isNonWallMaterial } from './wallMaterials.ts';
import type { ShelterConfig, WallLayer } from '../types/shelter.ts';

export const SEARCH_GRID_NOTICE = 'Default search grid — not a standard';
export const MAX_CANDIDATE_EVALUATIONS = 3000;

/** Search grid definition (design parameters, not physical values). */
export const WALL_THICKNESS_MULTIPLIERS: readonly number[] = [0.5, 0.75, 1.0, 1.5, 2.0];
export const HEIGHT_MULTIPLIERS: readonly number[] = [0.8, 1.0, 1.2];
export const GRID_MIN_THICKNESS_MULTIPLIER = WALL_THICKNESS_MULTIPLIERS[0];
export const GRID_MAX_THICKNESS_MULTIPLIER =
  WALL_THICKNESS_MULTIPLIERS[WALL_THICKNESS_MULTIPLIERS.length - 1];
export const GRID_MIN_HEIGHT_MULTIPLIER = HEIGHT_MULTIPLIERS[0];
export const GRID_MAX_HEIGHT_MULTIPLIER = HEIGHT_MULTIPLIERS[HEIGHT_MULTIPLIERS.length - 1];

const FALLBACK_BASE_WALL_THICKNESS_M = 0.3;
const FALLBACK_BASE_ROOF_THICKNESS_M = 0.25;

export interface GridInfo {
  /** Thickness multiplier (relative to the current wall) of each wall layer. */
  layerMultipliers: number[];
  /** Height multiplier relative to the current height. */
  heightMultiplier: number;
}

export interface CandidateDesign {
  id: string;
  config: ShelterConfig;
  wallDescription: string;
  roofDescription: string;
  dimensionsDescription: string;
  length_m: number;
  width_m: number;
  height_m: number;
  floorArea_m2: number;
  totalWallThickness_m: number;
  wallUValue: number;
  roofUValue: number;
  thermalCapacitance: number;
  gridInfo: GridInfo;
}

export interface EvaluatedCandidate extends CandidateDesign {
  results: SimStep[] | null;
  daysSimulated: number;
  converged: boolean;
  residualC: number;
  peak: number;
  min: number;
  avg: number;
  swing: number;
  /** The target minimum temperature used for this evaluation, if any. */
  targetMinTempC: number | undefined;
  /** null when no target was set. */
  meetsTarget: boolean | null;
  error: string | null;
}

export interface GenerationResult {
  candidates: CandidateDesign[];
  totalGenerated: number;
  evaluatedCount: number;
  isSubsampled: boolean;
  /** Grid combinations skipped because of the maximum total wall thickness. */
  droppedByThicknessCap: number;
}

export interface GenerateOptions {
  /** Optional upper bound on the SUM of wall layer thicknesses (m). */
  maxTotalWallThickness_m?: number;
}

/**
 * Default cap on total wall thickness: the search grid's own upper bound for a
 * single layer (2x the current wall thickness). A search-grid definition,
 * not a construction standard.
 */
export function defaultMaxTotalWallThickness_m(baseConfig: ShelterConfig): number {
  const base = baseConfig.wallLayers[0]?.thickness_m ?? FALLBACK_BASE_WALL_THICKNESS_M;
  return Number((base * GRID_MAX_THICKNESS_MULTIPLIER).toFixed(4));
}

interface AssemblySpec {
  layers: WallLayer[];
  description: string;
  multipliers: number[];
}

/** U-values and thermal capacitance via the existing engine functions (no new physics). */
function computeEnvelopeMetrics(config: ShelterConfig): {
  wallU: number;
  roofU: number;
  capacitance: number;
} {
  const wallU = calculateUValueMultiLayer(
    DEFAULT_H_INTERIOR,
    config.wallLayers,
    config.materialsLibrary,
    DEFAULT_H_EXTERIOR
  );
  const roofU = calculateUValueMultiLayer(
    DEFAULT_H_INTERIOR,
    config.roofLayers,
    config.materialsLibrary,
    DEFAULT_H_EXTERIOR
  );

  const { length_m, width_m, height_m } = config.geometry;
  const wallGrossArea = 2 * (length_m + width_m) * height_m;
  const roofArea = length_m * width_m;
  const capElements: { mass: number; specificHeat: number }[] = [];

  for (const layer of config.wallLayers) {
    const mat = config.materialsLibrary.find((m) => m.id === layer.materialId);
    if (mat) {
      capElements.push({
        mass: mat.density * (wallGrossArea * layer.thickness_m),
        specificHeat: mat.specificHeat_c,
      });
    }
  }
  for (const layer of config.roofLayers) {
    const mat = config.materialsLibrary.find((m) => m.id === layer.materialId);
    if (mat) {
      capElements.push({
        mass: mat.density * (roofArea * layer.thickness_m),
        specificHeat: mat.specificHeat_c,
      });
    }
  }
  capElements.push({
    mass: length_m * width_m * height_m * DEFAULT_AIR_DENSITY,
    specificHeat: DEFAULT_AIR_SPECIFIC_HEAT,
  });

  return { wallU, roofU, capacitance: calculateThermalCapacitance(capElements) };
}

function sumThickness(layers: WallLayer[]): number {
  return layers.reduce((s, l) => s + l.thickness_m, 0);
}

/**
 * Generates candidate designs deterministically from a base configuration
 * and a set of available material IDs.
 *
 * Floor area is strictly conserved.
 * Orientation, openings, and glazing are strictly conserved.
 * Glazing-type materials (see wallMaterials.ts) are never used in wall or roof layers.
 */
export function generateCandidates(
  baseConfig: ShelterConfig,
  availableMaterialIds: string[],
  alsoVaryRoof: boolean = false,
  options: GenerateOptions = {}
): GenerationResult {
  const empty: GenerationResult = {
    candidates: [],
    totalGenerated: 0,
    evaluatedCount: 0,
    isSubsampled: false,
    droppedByThicknessCap: 0,
  };

  if (!availableMaterialIds || availableMaterialIds.length === 0) {
    return empty;
  }

  // Filter materials library to available, wall-capable materials only
  const availableMaterials = baseConfig.materialsLibrary.filter(
    (m) => availableMaterialIds.includes(m.id) && !isNonWallMaterial(m.id)
  );

  if (availableMaterials.length === 0) {
    return empty;
  }

  const cap = options.maxTotalWallThickness_m;
  const hasCap = cap !== undefined && Number.isFinite(cap) && cap > 0;

  const baseWallThickness = baseConfig.wallLayers[0]?.thickness_m ?? FALLBACK_BASE_WALL_THICKNESS_M;
  const wallThicknesses = WALL_THICKNESS_MULTIPLIERS.map((m) =>
    Number((baseWallThickness * m).toFixed(4))
  );

  // 1. Wall assemblies
  // Single layer (one available material at one thickness)
  // Two-layer composites (unordered pair of different available materials, each with its own thickness)
  const wallAssemblies: AssemblySpec[] = [];
  let droppedWallAssemblies = 0;
  const CAP_TOLERANCE = 1e-9;

  for (const mat of availableMaterials) {
    wallThicknesses.forEach((t, ti) => {
      if (hasCap && t > cap! + CAP_TOLERANCE) {
        droppedWallAssemblies++;
        return;
      }
      wallAssemblies.push({
        layers: [{ id: 'w1', materialId: mat.id, thickness_m: t }],
        description: `${mat.name} (${Math.round(t * 1000)} mm)`,
        multipliers: [WALL_THICKNESS_MULTIPLIERS[ti]],
      });
    });
  }

  for (let i = 0; i < availableMaterials.length; i++) {
    for (let j = i + 1; j < availableMaterials.length; j++) {
      const matA = availableMaterials[i];
      const matB = availableMaterials[j];
      wallThicknesses.forEach((tA, ia) => {
        wallThicknesses.forEach((tB, ib) => {
          if (hasCap && tA + tB > cap! + CAP_TOLERANCE) {
            droppedWallAssemblies++;
            return;
          }
          wallAssemblies.push({
            layers: [
              { id: 'w1', materialId: matA.id, thickness_m: tA },
              { id: 'w2', materialId: matB.id, thickness_m: tB },
            ],
            description: `${matA.name} (${Math.round(tA * 1000)} mm) + ${matB.name} (${Math.round(tB * 1000)} mm)`,
            multipliers: [WALL_THICKNESS_MULTIPLIERS[ia], WALL_THICKNESS_MULTIPLIERS[ib]],
          });
        });
      });
    }
  }

  // 2. Roof assemblies
  let roofAssemblies: AssemblySpec[] = [];
  if (!alsoVaryRoof) {
    const roofLayersCopy = baseConfig.roofLayers.map((l) => ({ ...l }));
    const roofDesc = roofLayersCopy
      .map((l) => {
        const mat = baseConfig.materialsLibrary.find((m) => m.id === l.materialId);
        return `${mat?.name ?? l.materialId} (${Math.round(l.thickness_m * 1000)} mm)`;
      })
      .join(' + ');
    roofAssemblies = [
      { layers: roofLayersCopy, description: roofDesc || 'Current Roof', multipliers: [] },
    ];
  } else {
    const baseRoofThickness = baseConfig.roofLayers[0]?.thickness_m ?? FALLBACK_BASE_ROOF_THICKNESS_M;
    const roofThicknesses = WALL_THICKNESS_MULTIPLIERS.map((m) =>
      Number((baseRoofThickness * m).toFixed(4))
    );

    for (const mat of availableMaterials) {
      for (const t of roofThicknesses) {
        roofAssemblies.push({
          layers: [{ id: 'r1', materialId: mat.id, thickness_m: t }],
          description: `${mat.name} (${Math.round(t * 1000)} mm)`,
          multipliers: [],
        });
      }
    }

    for (let i = 0; i < availableMaterials.length; i++) {
      for (let j = i + 1; j < availableMaterials.length; j++) {
        const matA = availableMaterials[i];
        const matB = availableMaterials[j];
        for (const tA of roofThicknesses) {
          for (const tB of roofThicknesses) {
            roofAssemblies.push({
              layers: [
                { id: 'r1', materialId: matA.id, thickness_m: tA },
                { id: 'r2', materialId: matB.id, thickness_m: tB },
              ],
              description: `${matA.name} (${Math.round(tA * 1000)} mm) + ${matB.name} (${Math.round(tB * 1000)} mm)`,
              multipliers: [],
            });
          }
        }
      }
    }
  }

  // 3. Geometries
  // Floor area is strictly conserved: floorArea = length_m * width_m
  const currentL = baseConfig.geometry.length_m;
  const currentW = baseConfig.geometry.width_m;
  const currentH = baseConfig.geometry.height_m;
  const floorArea = currentL * currentW;

  // Aspect ratios: current, 1:1, 3:2, 2:1
  const rawAspectOptions = [
    { length_m: currentL, width_m: currentW },
    { length_m: Math.sqrt(floorArea), width_m: Math.sqrt(floorArea) },
    { length_m: 1.5 * Math.sqrt(floorArea / 1.5), width_m: Math.sqrt(floorArea / 1.5) },
    { length_m: 2.0 * Math.sqrt(floorArea / 2.0), width_m: Math.sqrt(floorArea / 2.0) },
  ];

  const footprintOptions: { length_m: number; width_m: number }[] = [];
  for (const opt of rawAspectOptions) {
    if (
      !footprintOptions.some(
        (existing) =>
          Math.abs(existing.length_m - opt.length_m) < 0.01 &&
          Math.abs(existing.width_m - opt.width_m) < 0.01
      )
    ) {
      footprintOptions.push(opt);
    }
  }

  interface GeomSpec {
    length_m: number;
    width_m: number;
    height_m: number;
    heightMultiplier: number;
    description: string;
  }
  const geometryOptions: GeomSpec[] = [];
  for (const fp of footprintOptions) {
    for (const hm of HEIGHT_MULTIPLIERS) {
      const h = Number((currentH * hm).toFixed(3));
      geometryOptions.push({
        length_m: fp.length_m,
        width_m: fp.width_m,
        height_m: h,
        heightMultiplier: hm,
        description: `${fp.length_m.toFixed(2)}m × ${fp.width_m.toFixed(2)}m × ${h.toFixed(2)}m`,
      });
    }
  }

  // 4. Combine into full candidate designs
  const allCandidates: CandidateDesign[] = [];
  let candidateId = 1;

  for (const wall of wallAssemblies) {
    for (const roof of roofAssemblies) {
      for (const geom of geometryOptions) {
        const candidateConfig: ShelterConfig = {
          ambientClimate: {
            ...baseConfig.ambientClimate,
            hourlyProfile: baseConfig.ambientClimate.hourlyProfile.map((p) => ({ ...p })),
          },
          materialsLibrary: baseConfig.materialsLibrary.map((m) => ({ ...m })),
          wallLayers: wall.layers.map((l) => ({ ...l })),
          roofLayers: roof.layers.map((l) => ({ ...l })),
          geometry: {
            shape: baseConfig.geometry.shape,
            length_m: geom.length_m,
            width_m: geom.width_m,
            height_m: geom.height_m,
            orientation_deg: baseConfig.geometry.orientation_deg,
            openings: baseConfig.geometry.openings.map((o) => ({ ...o })),
          },
          activePresetId: baseConfig.activePresetId,
        };

        const metrics = computeEnvelopeMetrics(candidateConfig);

        allCandidates.push({
          id: `cand-${candidateId++}`,
          config: candidateConfig,
          wallDescription: wall.description,
          roofDescription: roof.description,
          dimensionsDescription: geom.description,
          length_m: geom.length_m,
          width_m: geom.width_m,
          height_m: geom.height_m,
          floorArea_m2: floorArea,
          totalWallThickness_m: sumThickness(candidateConfig.wallLayers),
          wallUValue: metrics.wallU,
          roofUValue: metrics.roofU,
          thermalCapacitance: metrics.capacitance,
          gridInfo: {
            layerMultipliers: [...wall.multipliers],
            heightMultiplier: geom.heightMultiplier,
          },
        });
      }
    }
  }

  const totalGenerated = allCandidates.length;
  const droppedByThicknessCap = droppedWallAssemblies * roofAssemblies.length * geometryOptions.length;

  // Stride subsampling if exceeds MAX_CANDIDATE_EVALUATIONS
  if (totalGenerated > MAX_CANDIDATE_EVALUATIONS) {
    const stride = totalGenerated / MAX_CANDIDATE_EVALUATIONS;
    const sampled = Array.from({ length: MAX_CANDIDATE_EVALUATIONS }, (_, i) =>
      allCandidates[Math.floor(i * stride)]
    );
    return {
      candidates: sampled,
      totalGenerated,
      evaluatedCount: MAX_CANDIDATE_EVALUATIONS,
      isSubsampled: true,
      droppedByThicknessCap,
    };
  }

  return {
    candidates: allCandidates,
    totalGenerated,
    evaluatedCount: totalGenerated,
    isSubsampled: false,
    droppedByThicknessCap,
  };
}

/**
 * Notes describing where a design sits on the edge of the search grid.
 * When the best design is on the edge, a wider grid might rank higher.
 */
export function gridEdgeNotes(c: CandidateDesign, maxTotalWallThickness_m?: number): string[] {
  const notes: string[] = [];
  const mult = c.gridInfo.layerMultipliers;
  if (mult.some((m) => m === GRID_MAX_THICKNESS_MULTIPLIER)) {
    notes.push(`a wall layer is at the grid maximum (${GRID_MAX_THICKNESS_MULTIPLIER}× the current thickness)`);
  }
  if (mult.some((m) => m === GRID_MIN_THICKNESS_MULTIPLIER)) {
    notes.push(`a wall layer is at the grid minimum (${GRID_MIN_THICKNESS_MULTIPLIER}× the current thickness)`);
  }
  if (c.gridInfo.heightMultiplier === GRID_MAX_HEIGHT_MULTIPLIER) {
    notes.push(`height is at the grid maximum (${GRID_MAX_HEIGHT_MULTIPLIER}× the current height)`);
  }
  if (c.gridInfo.heightMultiplier === GRID_MIN_HEIGHT_MULTIPLIER) {
    notes.push(`height is at the grid minimum (${GRID_MIN_HEIGHT_MULTIPLIER}× the current height)`);
  }
  if (
    maxTotalWallThickness_m !== undefined &&
    Number.isFinite(maxTotalWallThickness_m) &&
    maxTotalWallThickness_m > 0 &&
    c.totalWallThickness_m >= maxTotalWallThickness_m - 1e-6
  ) {
    notes.push('total wall thickness is at the maximum allowed');
  }
  return notes;
}

/**
 * Evaluates a single candidate design using simulateSteadyCycle.
 * Protected with try/catch for per-candidate error isolation.
 */
export function evaluateCandidate(
  candidate: CandidateDesign,
  targetMinTempC?: number
): EvaluatedCandidate {
  try {
    const steady = simulateSteadyCycle(
      candidate.config,
      DEFAULT_TIME_STEP_SECONDS,
      DEFAULT_INFILTRATION_RATE,
      DEFAULT_AIR_DENSITY,
      DEFAULT_AIR_SPECIFIC_HEAT,
      DEFAULT_H_INTERIOR,
      DEFAULT_H_EXTERIOR,
      DEFAULT_SKY_TEMP_OFFSET_C
    );

    const stats = computeSeriesStats(steady.series.map((r) => r.tempC));

    return {
      ...candidate,
      results: steady.series,
      daysSimulated: steady.daysSimulated,
      converged: steady.converged,
      residualC: steady.residualC,
      peak: stats.max,
      min: stats.min,
      avg: stats.avg,
      swing: stats.swing,
      targetMinTempC,
      meetsTarget: targetMinTempC !== undefined ? stats.min >= targetMinTempC : null,
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Simulation failed';
    return {
      ...candidate,
      results: null,
      daysSimulated: 0,
      converged: false,
      residualC: 0,
      peak: -999,
      min: -999,
      avg: -999,
      swing: 0,
      targetMinTempC,
      meetsTarget: targetMinTempC !== undefined ? false : null,
      error: message,
    };
  }
}

/**
 * Evaluates the baseline (active) design for the comparison row.
 */
export function evaluateBaseline(
  baseConfig: ShelterConfig,
  targetMinTempC?: number
): EvaluatedCandidate {
  const describe = (layers: WallLayer[]) =>
    layers
      .map((l) => {
        const mat = baseConfig.materialsLibrary.find((m) => m.id === l.materialId);
        return `${mat?.name ?? l.materialId} (${Math.round(l.thickness_m * 1000)} mm)`;
      })
      .join(' + ');

  const geomDesc = `${baseConfig.geometry.length_m.toFixed(2)}m × ${baseConfig.geometry.width_m.toFixed(2)}m × ${baseConfig.geometry.height_m.toFixed(2)}m`;
  const metrics = computeEnvelopeMetrics(baseConfig);

  const baselineCandidate: CandidateDesign = {
    id: 'baseline-current',
    config: baseConfig,
    wallDescription: describe(baseConfig.wallLayers),
    roofDescription: describe(baseConfig.roofLayers),
    dimensionsDescription: geomDesc,
    length_m: baseConfig.geometry.length_m,
    width_m: baseConfig.geometry.width_m,
    height_m: baseConfig.geometry.height_m,
    floorArea_m2: baseConfig.geometry.length_m * baseConfig.geometry.width_m,
    totalWallThickness_m: sumThickness(baseConfig.wallLayers),
    wallUValue: metrics.wallU,
    roofUValue: metrics.roofU,
    thermalCapacitance: metrics.capacitance,
    gridInfo: { layerMultipliers: [], heightMultiplier: 1 },
  };

  return evaluateCandidate(baselineCandidate, targetMinTempC);
}

/**
 * Comparator for candidate ranking:
 * 1. Error-free before errored
 * 2. Converged (steady daily cycle reached) before not converged, because
 *    the temperatures of a design that is still drifting are not reliable
 * 3. If a target minimum temperature was set: target-met before target-missed
 * 4. The selected design goal (see rankingObjectives.ts)
 */
export function compareCandidates(
  a: EvaluatedCandidate,
  b: EvaluatedCandidate,
  goal: DesignGoal,
  targetMinTempC?: number
): number {
  if (a.error && !b.error) return 1;
  if (!a.error && b.error) return -1;
  if (a.error && b.error) return 0;

  if (a.converged && !b.converged) return -1;
  if (!a.converged && b.converged) return 1;

  if (targetMinTempC !== undefined) {
    const aMet = a.min >= targetMinTempC;
    const bMet = b.min >= targetMinTempC;
    if (aMet && !bMet) return -1;
    if (!aMet && bMet) return 1;
  }

  return compareStatsByGoal(
    goal,
    { min: a.min, avg: a.avg, max: a.peak, swing: a.swing },
    { min: b.min, avg: b.avg, max: b.peak, swing: b.swing }
  );
}

/**
 * Ranks candidates by the design goal (and the optional target temperature).
 * Array.prototype.sort is stable, so ties keep the deterministic generation order.
 */
export function rankCandidates(
  candidates: EvaluatedCandidate[],
  goal: DesignGoal,
  targetMinTempC?: number
): EvaluatedCandidate[] {
  return [...candidates].sort((a, b) => compareCandidates(a, b, goal, targetMinTempC));
}

/** Value of the goal's primary metric for an evaluated candidate. */
export function candidateGoalMetric(c: EvaluatedCandidate, goal: DesignGoal): number {
  return goalMetricValue(goal, { min: c.min, avg: c.avg, max: c.peak, swing: c.swing });
}

/**
 * Builds an explanation string for a design based strictly on computed numbers.
 * No claims like "adobe is better because...". Computed numbers only.
 */
export function buildExplanationString(c: EvaluatedCandidate, goal: DesignGoal): string {
  const info = getGoalInfo(goal);
  const capMJ = (c.thermalCapacitance / 1e6).toFixed(2);

  let targetNote: string;
  if (c.targetMinTempC === undefined) {
    targetNote = 'No target set';
  } else {
    targetNote = c.min >= c.targetMinTempC ? 'Target met' : 'Does not meet target';
  }

  const cycleNote = c.converged
    ? `Steady cycle reached in ${c.daysSimulated} days (residual ${c.residualC.toFixed(4)} °C)`
    : `Steady cycle NOT reached after ${c.daysSimulated} days (residual ${c.residualC.toFixed(4)} °C)`;

  return (
    `Goal "${info.label}" — ${info.metricLabel}: ${candidateGoalMetric(c, goal).toFixed(2)} | ` +
    `Wall U-value: ${c.wallUValue.toFixed(3)} W/m²·K | ` +
    `Capacitance: ${capMJ} MJ/K | ` +
    `Min: ${c.min.toFixed(2)} °C, Avg: ${c.avg.toFixed(2)} °C, Max: ${c.peak.toFixed(2)} °C | ` +
    `Diurnal swing: ${c.swing.toFixed(2)} °C | ` +
    `${cycleNote} | ` +
    `Status: ${targetNote}`
  );
}
