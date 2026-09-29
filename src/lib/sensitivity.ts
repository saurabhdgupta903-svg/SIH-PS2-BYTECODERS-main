/**
 * sensitivity.ts
 *
 * One-at-a-time input sensitivity using the existing steady-cycle simulation.
 * No new physics. Perturbation sizes are analysis settings, not uncertainties.
 */
import { simulateSteadyCycle } from './simulateSteadyCycle.ts';
import {
  DEFAULT_TIME_STEP_SECONDS,
  DEFAULT_INFILTRATION_RATE,
  DEFAULT_AIR_DENSITY,
  DEFAULT_AIR_SPECIFIC_HEAT,
  DEFAULT_H_INTERIOR,
  DEFAULT_H_EXTERIOR,
  DEFAULT_SKY_TEMP_OFFSET_C,
} from './engineDefaults.ts';
import { computeSeriesStats, type DesignGoal, type SeriesStats } from './rankingObjectives.ts';
import type { ShelterConfig, WallLayer } from '../types/shelter.ts';

/** Analysis setting, not a physical uncertainty. */
export const SENSITIVITY_FRACTIONS: readonly number[] = [0.1, 0.25, 0.5];

export const DEFAULT_SENSITIVITY_FRACTION = 0.25;

export type SensitivityMetric = 'min' | 'avg' | 'max' | 'swing';

export interface SensitivityRun {
  factor: number;
  stats: SeriesStats;
  converged: boolean;
  daysSimulated: number;
  residualC: number;
  note?: string;
}

export interface SensitivityRow {
  id: string;
  label: string;
  low: SensitivityRun;
  high: SensitivityRun;
}

export interface SensitivityBase {
  stats: SeriesStats;
  converged: boolean;
  daysSimulated: number;
  residualC: number;
}

export interface SensitivityResult {
  base: SensitivityBase;
  rows: SensitivityRow[];
  fraction: number;
}

interface EngineArgs {
  infiltrationRate: number;
  hExterior: number;
  skyTempOffsetC: number;
}

const DEFAULT_ENGINE_ARGS: EngineArgs = {
  infiltrationRate: DEFAULT_INFILTRATION_RATE,
  hExterior: DEFAULT_H_EXTERIOR,
  skyTempOffsetC: DEFAULT_SKY_TEMP_OFFSET_C,
};

function cloneConfig(config: ShelterConfig): ShelterConfig {
  return JSON.parse(JSON.stringify(config)) as ShelterConfig;
}

function runCycle(config: ShelterConfig, args: EngineArgs): SensitivityRun {
  const steady = simulateSteadyCycle(
    config,
    DEFAULT_TIME_STEP_SECONDS,
    args.infiltrationRate,
    DEFAULT_AIR_DENSITY,
    DEFAULT_AIR_SPECIFIC_HEAT,
    DEFAULT_H_INTERIOR,
    args.hExterior,
    args.skyTempOffsetC
  );
  return {
    factor: 1,
    stats: computeSeriesStats(steady.series.map((r) => r.tempC)),
    converged: steady.converged,
    daysSimulated: steady.daysSimulated,
    residualC: steady.residualC,
  };
}

function cloneLayerMaterial(config: ShelterConfig, layer: WallLayer): WallLayer | null {
  const mat = config.materialsLibrary.find((m) => m.id === layer.materialId);
  if (!mat) return null;
  const clone = { ...mat, id: `${mat.id}__sens_${layer.id}` };
  config.materialsLibrary.push(clone);
  const nextLayer = { ...layer, materialId: clone.id };
  return nextLayer;
}

function scaleWallProperty(
  config: ShelterConfig,
  factor: number,
  key: 'conductivity_k' | 'density' | 'specificHeat_c'
): ShelterConfig | null {
  if (config.wallLayers.length === 0) return null;
  const next = cloneConfig(config);
  const layers: WallLayer[] = [];
  for (const layer of next.wallLayers) {
    const clonedLayer = cloneLayerMaterial(next, layer);
    if (!clonedLayer) continue;
    const mat = next.materialsLibrary.find((m) => m.id === clonedLayer.materialId);
    if (mat) {
      mat[key] = mat[key] * factor;
    }
    layers.push(clonedLayer);
  }
  if (layers.length === 0) return null;
  next.wallLayers = layers;
  return next;
}

function scaleLayerThicknesses(
  config: ShelterConfig,
  which: 'wall' | 'roof',
  factor: number
): ShelterConfig | null {
  const layers = which === 'wall' ? config.wallLayers : config.roofLayers;
  if (layers.length === 0) return null;
  const next = cloneConfig(config);
  if (which === 'wall') {
    next.wallLayers = next.wallLayers.map((l) => ({ ...l, thickness_m: l.thickness_m * factor }));
  } else {
    next.roofLayers = next.roofLayers.map((l) => ({ ...l, thickness_m: l.thickness_m * factor }));
  }
  return next;
}

function clipNote(original: number, applied: number, clipped: boolean): string | undefined {
  if (!clipped) return undefined;
  return `applied x${(applied / original).toFixed(2)} (clipped at 1)`;
}

function scaleRoofOptical(
  config: ShelterConfig,
  factor: number,
  key: 'solarAbsorptivity' | 'thermalEmissivity'
): { config: ShelterConfig; factor: number; note?: string } | null {
  const roof0 = config.roofLayers[0];
  if (!roof0) return null;
  const next = cloneConfig(config);
  const layer = next.roofLayers[0];
  const clonedLayer = cloneLayerMaterial(next, layer);
  if (!clonedLayer) return null;
  next.roofLayers = [clonedLayer, ...next.roofLayers.slice(1)];
  const mat = next.materialsLibrary.find((m) => m.id === clonedLayer.materialId);
  if (!mat) return null;
  const original = mat[key];
  const raw = original * factor;
  const clipped = raw > 1;
  const appliedValue = clipped ? 1 : raw;
  mat[key] = appliedValue;
  const appliedFactor = original === 0 ? factor : appliedValue / original;
  return { config: next, factor: appliedFactor, note: clipNote(original, appliedValue, clipped) };
}

function scaleIrradiance(config: ShelterConfig, factor: number): ShelterConfig | null {
  if (!config.ambientClimate.hourlyProfile.length) return null;
  const next = cloneConfig(config);
  next.ambientClimate.hourlyProfile = next.ambientClimate.hourlyProfile.map((p) => ({
    ...p,
    irradiance_wm2: p.irradiance_wm2 * factor,
  }));
  return next;
}

interface VariantSpec {
  config: ShelterConfig;
  args: EngineArgs;
  factor: number;
  note?: string;
}

function evaluateSpec(spec: VariantSpec): SensitivityRun {
  const run = runCycle(spec.config, spec.args);
  const out: SensitivityRun = {
    ...run,
    factor: spec.factor,
  };
  if (spec.note !== undefined) {
    out.note = spec.note;
  }
  return out;
}

type SideBuilder = (factor: number) => VariantSpec | null;

function buildRow(id: string, label: string, fraction: number, build: SideBuilder): SensitivityRow | null {
  const lowFactor = 1 - fraction;
  const highFactor = 1 + fraction;
  const lowSpec = build(lowFactor);
  const highSpec = build(highFactor);
  if (!lowSpec || !highSpec) return null;
  return {
    id,
    label,
    low: evaluateSpec(lowSpec),
    high: evaluateSpec(highSpec),
  };
}

export function metricForGoal(goal: DesignGoal): SensitivityMetric {
  if (goal === 'keep_warm') return 'min';
  if (goal === 'keep_cool') return 'max';
  return 'swing';
}

export function rowEffect(row: SensitivityRow, metric: SensitivityMetric, base: SeriesStats): number {
  const baseVal = base[metric];
  const lowDelta = Math.abs(row.low.stats[metric] - baseVal);
  const highDelta = Math.abs(row.high.stats[metric] - baseVal);
  return Math.max(lowDelta, highDelta);
}

/** Stable descending sort by rowEffect. */
export function rankRows(
  rows: SensitivityRow[],
  metric: SensitivityMetric,
  base: SeriesStats
): SensitivityRow[] {
  return [...rows].sort((a, b) => rowEffect(b, metric, base) - rowEffect(a, metric, base));
}

export function runSensitivity(
  config: ShelterConfig,
  fraction: number = DEFAULT_SENSITIVITY_FRACTION
): SensitivityResult {
  const baseRun = runCycle(config, DEFAULT_ENGINE_ARGS);
  const base: SensitivityBase = {
    stats: baseRun.stats,
    converged: baseRun.converged,
    daysSimulated: baseRun.daysSimulated,
    residualC: baseRun.residualC,
  };

  const rows: SensitivityRow[] = [];

  const push = (row: SensitivityRow | null) => {
    if (row) rows.push(row);
  };

  push(
    buildRow('wall_thickness', 'Wall thickness', fraction, (factor) => {
      const next = scaleLayerThicknesses(config, 'wall', factor);
      if (!next) return null;
      return { config: next, args: DEFAULT_ENGINE_ARGS, factor };
    })
  );

  push(
    buildRow('roof_thickness', 'Roof thickness', fraction, (factor) => {
      const next = scaleLayerThicknesses(config, 'roof', factor);
      if (!next) return null;
      return { config: next, args: DEFAULT_ENGINE_ARGS, factor };
    })
  );

  push(
    buildRow('height', 'Height', fraction, (factor) => {
      const next = cloneConfig(config);
      next.geometry = { ...next.geometry, height_m: next.geometry.height_m * factor };
      return { config: next, args: DEFAULT_ENGINE_ARGS, factor };
    })
  );

  push(
    buildRow('wall_k', 'Wall conductivity k', fraction, (factor) => {
      const next = scaleWallProperty(config, factor, 'conductivity_k');
      if (!next) return null;
      return { config: next, args: DEFAULT_ENGINE_ARGS, factor };
    })
  );

  push(
    buildRow('wall_density', 'Wall density', fraction, (factor) => {
      const next = scaleWallProperty(config, factor, 'density');
      if (!next) return null;
      return { config: next, args: DEFAULT_ENGINE_ARGS, factor };
    })
  );

  push(
    buildRow('wall_c', 'Wall specific heat', fraction, (factor) => {
      const next = scaleWallProperty(config, factor, 'specificHeat_c');
      if (!next) return null;
      return { config: next, args: DEFAULT_ENGINE_ARGS, factor };
    })
  );

  push(
    buildRow('roof_alpha', 'Roof solar absorptivity α', fraction, (factor) => {
      const scaled = scaleRoofOptical(config, factor, 'solarAbsorptivity');
      if (!scaled) return null;
      return { config: scaled.config, args: DEFAULT_ENGINE_ARGS, factor: scaled.factor, note: scaled.note };
    })
  );

  push(
    buildRow('roof_epsilon', 'Roof emissivity ε', fraction, (factor) => {
      const scaled = scaleRoofOptical(config, factor, 'thermalEmissivity');
      if (!scaled) return null;
      return { config: scaled.config, args: DEFAULT_ENGINE_ARGS, factor: scaled.factor, note: scaled.note };
    })
  );

  push(
    buildRow('infiltration', 'Infiltration rate', fraction, (factor) => ({
      config: cloneConfig(config),
      args: { ...DEFAULT_ENGINE_ARGS, infiltrationRate: DEFAULT_INFILTRATION_RATE * factor },
      factor,
    }))
  );

  push(
    buildRow('sky_offset', 'Sky temperature offset', fraction, (factor) => ({
      config: cloneConfig(config),
      args: { ...DEFAULT_ENGINE_ARGS, skyTempOffsetC: DEFAULT_SKY_TEMP_OFFSET_C * factor },
      factor,
    }))
  );

  push(
    buildRow('h_exterior', 'Exterior film coefficient h_o', fraction, (factor) => ({
      config: cloneConfig(config),
      args: { ...DEFAULT_ENGINE_ARGS, hExterior: DEFAULT_H_EXTERIOR * factor },
      factor,
    }))
  );

  push(
    buildRow('irradiance', 'Solar irradiance', fraction, (factor) => {
      const next = scaleIrradiance(config, factor);
      if (!next) return null;
      return { config: next, args: DEFAULT_ENGINE_ARGS, factor };
    })
  );

  return { base, rows, fraction };
}
