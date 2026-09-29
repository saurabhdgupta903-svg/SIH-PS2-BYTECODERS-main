/**
 * sensitivity.test.ts
 *
 * Hand-checkable tests for one-at-a-time sensitivity analysis.
 */
import assert from 'node:assert/strict';
import {
  runSensitivity,
  rankRows,
  rowEffect,
  type SensitivityRow,
} from './sensitivity.ts';
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
import { computeSeriesStats, type SeriesStats } from './rankingObjectives.ts';
import type { ShelterConfig } from '../types/shelter.ts';

console.log('--- TerraShelter Sensitivity Unit Tests ---');

const testMaterials = [
  {
    id: 'mat_adobe',
    name: 'Adobe',
    conductivity_k: 0.75,
    density: 1600,
    specificHeat_c: 1000,
    solarAbsorptivity: 0.7,
    thermalEmissivity: 0.9,
    isDefaultReference: true,
    verificationNotice: 'Test',
  },
];

function makeConfig(overrides: Partial<ShelterConfig> = {}): ShelterConfig {
  const profile = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    temperature_C: 10 + 5 * Math.sin((h / 24) * 2 * Math.PI),
    irradiance_wm2: h >= 7 && h <= 17 ? 400 : 0,
  }));
  return {
    ambientClimate: {
      regionName: 'Test Climate',
      latitude: 30,
      longitude: 75,
      dateSeasonLabel: 'Test',
      hourlyProfile: profile,
    },
    materialsLibrary: testMaterials.map((m) => ({ ...m })),
    wallLayers: [{ id: 'w1', materialId: 'mat_adobe', thickness_m: 0.4 }],
    roofLayers: [{ id: 'r1', materialId: 'mat_adobe', thickness_m: 0.3 }],
    geometry: {
      shape: 'rectangular_box',
      length_m: 4.0,
      width_m: 3.0,
      height_m: 2.5,
      orientation_deg: 180,
      openings: [],
    },
    activePresetId: null,
    ...overrides,
  };
}

const baseConfig = makeConfig();

// ---------------------------------------------------------------------------
// Test 1: Base stats equal a direct simulateSteadyCycle call
// ---------------------------------------------------------------------------
{
  const result = runSensitivity(baseConfig, 0.25);
  const direct = simulateSteadyCycle(
    baseConfig,
    DEFAULT_TIME_STEP_SECONDS,
    DEFAULT_INFILTRATION_RATE,
    DEFAULT_AIR_DENSITY,
    DEFAULT_AIR_SPECIFIC_HEAT,
    DEFAULT_H_INTERIOR,
    DEFAULT_H_EXTERIOR,
    DEFAULT_SKY_TEMP_OFFSET_C
  );
  const directStats = computeSeriesStats(direct.series.map((r) => r.tempC));
  assert.strictEqual(result.base.stats.min, directStats.min);
  assert.strictEqual(result.base.stats.avg, directStats.avg);
  assert.strictEqual(result.base.stats.max, directStats.max);
  assert.strictEqual(result.base.stats.swing, directStats.swing);
  assert.strictEqual(result.base.converged, direct.converged);
  assert.strictEqual(result.base.daysSimulated, direct.daysSimulated);
  console.log('✓ Test 1: Base stats match a direct simulateSteadyCycle call');
}

// ---------------------------------------------------------------------------
// Test 2: fraction = 0 gives zero deltas
// ---------------------------------------------------------------------------
{
  const result = runSensitivity(baseConfig, 0);
  for (const row of result.rows) {
    for (const metric of ['min', 'avg', 'max', 'swing'] as const) {
      assert.strictEqual(row.low.stats[metric], result.base.stats[metric], `${row.id} low ${metric}`);
      assert.strictEqual(row.high.stats[metric], result.base.stats[metric], `${row.id} high ${metric}`);
      assert.strictEqual(rowEffect(row, metric, result.base.stats), 0);
    }
  }
  console.log('✓ Test 2: fraction = 0 gives zero deltas for every row');
}

// ---------------------------------------------------------------------------
// Test 3: input config is unchanged
// ---------------------------------------------------------------------------
{
  const before = JSON.stringify(baseConfig);
  runSensitivity(baseConfig, 0.25);
  assert.strictEqual(JSON.stringify(baseConfig), before);
  console.log('✓ Test 3: input config is deep-equal (JSON) before and after');
}

// ---------------------------------------------------------------------------
// Test 4: emissivity 0.9 × 1.25 is clipped at 1
// ---------------------------------------------------------------------------
{
  const result = runSensitivity(baseConfig, 0.25);
  const row = result.rows.find((r) => r.id === 'roof_epsilon');
  assert.ok(row, 'roof emissivity row must exist');
  assert.ok(row.high.note, 'high run must record a clip note');
  assert.match(row.high.note, /clipped at 1/);
  assert.match(row.high.note, /applied x1\.11/);
  console.log('✓ Test 4: emissivity 0.9 with fraction 0.25 is clipped at 1');
}

// ---------------------------------------------------------------------------
// Test 5: more infiltration lowers average inside temperature
// ---------------------------------------------------------------------------
{
  const constantProfile = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    temperature_C: 20,
    irradiance_wm2: 300,
  }));
  const cfg = makeConfig({
    ambientClimate: {
      regionName: 'Constant',
      latitude: 30,
      longitude: 75,
      dateSeasonLabel: 'Test',
      hourlyProfile: constantProfile,
    },
  });
  const result = runSensitivity(cfg, 0.25);
  const row = result.rows.find((r) => r.id === 'infiltration');
  assert.ok(row, 'infiltration row must exist');
  assert.ok(
    row.high.stats.avg < result.base.stats.avg,
    `more infiltration avg ${row.high.stats.avg} should be below base ${result.base.stats.avg}`
  );
  assert.ok(
    row.low.stats.avg > result.base.stats.avg,
    `less infiltration avg ${row.low.stats.avg} should be above base ${result.base.stats.avg}`
  );
  console.log('✓ Test 5: more infiltration lowers average inside temperature');
}

// ---------------------------------------------------------------------------
// Test 6: rankRows is descending rowEffect
// ---------------------------------------------------------------------------
{
  const fakeStats = (avg: number): SeriesStats => ({ min: avg, avg, max: avg, swing: 0 });
  const fakeRun = (avg: number) => ({
    factor: 1,
    stats: fakeStats(avg),
    converged: true,
    daysSimulated: 1,
    residualC: 0,
  });
  const rows: SensitivityRow[] = [
    { id: 'a', label: 'A', low: fakeRun(1), high: fakeRun(2) },
    { id: 'b', label: 'B', low: fakeRun(10), high: fakeRun(0) },
    { id: 'c', label: 'C', low: fakeRun(3), high: fakeRun(3) },
  ];
  const base = fakeStats(0);
  const ranked = rankRows(rows, 'avg', base);
  assert.deepEqual(
    ranked.map((r) => r.id),
    ['b', 'c', 'a']
  );
  for (let i = 1; i < ranked.length; i++) {
    assert.ok(rowEffect(ranked[i - 1], 'avg', base) >= rowEffect(ranked[i], 'avg', base));
  }
  console.log('✓ Test 6: rankRows returns descending rowEffect order');
}

// ---------------------------------------------------------------------------
// Test 7: no wall layers skips wall rows and does not throw
// ---------------------------------------------------------------------------
{
  const cfg = makeConfig({ wallLayers: [] });
  const result = runSensitivity(cfg, 0.25);
  const wallIds = new Set(['wall_thickness', 'wall_k', 'wall_density', 'wall_c']);
  for (const row of result.rows) {
    assert.ok(!wallIds.has(row.id), `unexpected wall row ${row.id}`);
  }
  assert.ok(result.rows.some((r) => r.id === 'roof_thickness'));
  assert.ok(result.rows.some((r) => r.id === 'height'));
  console.log('✓ Test 7: no wall layers omits wall rows without throwing');
}

console.log('--- All sensitivity tests passed ---');
