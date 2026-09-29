/**
 * designSearch.test.ts
 *
 * Unit tests for design search pure functions:
 * (1) Candidate generation is deterministic;
 * (2) Every candidate keeps the floor area (within rounding) and uses only available materials;
 * (3) Comparator: converged first, target-met before target-missed, then the design goal;
 * (4) An empty available list gives zero evaluations;
 * (5) Glazing-type materials are never used in wall or roof layers;
 * (6) The maximum total wall thickness drops candidates and is reported;
 * (7) Grid-edge notes flag designs on the edge of the search grid;
 * (8) The explanation string is built from numbers and never claims a target when none is set.
 */
import assert from 'node:assert/strict';
import {
  generateCandidates,
  compareCandidates,
  rankCandidates,
  gridEdgeNotes,
  defaultMaxTotalWallThickness_m,
  buildExplanationString,
  type EvaluatedCandidate,
} from './designSearch.ts';
import type { ShelterConfig } from '../types/shelter.ts';

console.log('--- TerraShelter Design Search Unit Tests ---');

const testProfile = Array.from({ length: 24 }, (_, h) => ({
  hour: h,
  temperature_C: 10 + 5 * Math.sin((h / 24) * 2 * Math.PI),
  irradiance_wm2: h >= 7 && h <= 17 ? 400 : 0,
}));

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
  {
    id: 'mat_stone',
    name: 'Stone',
    conductivity_k: 1.8,
    density: 2400,
    specificHeat_c: 880,
    solarAbsorptivity: 0.65,
    thermalEmissivity: 0.9,
    isDefaultReference: true,
    verificationNotice: 'Test',
  },
  {
    id: 'mat_insul',
    name: 'Insulation',
    conductivity_k: 0.04,
    density: 50,
    specificHeat_c: 840,
    solarAbsorptivity: 0.3,
    thermalEmissivity: 0.9,
    isDefaultReference: true,
    verificationNotice: 'Test',
  },
  {
    // Same id as the real library's glazing entry: must never be used as a wall layer
    id: 'glass',
    name: 'Glass',
    conductivity_k: 1.05,
    density: 2500,
    specificHeat_c: 840,
    solarAbsorptivity: 0.15,
    thermalEmissivity: 0.94,
    isDefaultReference: true,
    verificationNotice: 'Test',
  },
];

const baseConfig: ShelterConfig = {
  ambientClimate: {
    regionName: 'Test Climate',
    latitude: 30,
    longitude: 75,
    dateSeasonLabel: 'Test Solstice',
    hourlyProfile: testProfile,
  },
  materialsLibrary: testMaterials,
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
};

// ---------------------------------------------------------------------------
// Test 1: Candidate generation is deterministic
// ---------------------------------------------------------------------------
{
  const available = ['mat_adobe', 'mat_stone'];
  const run1 = generateCandidates(baseConfig, available);
  const run2 = generateCandidates(baseConfig, available);

  assert.strictEqual(run1.candidates.length, run2.candidates.length, 'Candidate counts must match');
  assert.strictEqual(run1.totalGenerated, run2.totalGenerated, 'Total generated must match');

  for (let i = 0; i < run1.candidates.length; i++) {
    const c1 = run1.candidates[i];
    const c2 = run2.candidates[i];
    assert.strictEqual(c1.id, c2.id, `Candidate ${i} id must match`);
    assert.strictEqual(c1.wallDescription, c2.wallDescription, `Candidate ${i} wall must match`);
    assert.strictEqual(c1.length_m, c2.length_m, `Candidate ${i} length must match`);
    assert.strictEqual(c1.width_m, c2.width_m, `Candidate ${i} width must match`);
    assert.strictEqual(c1.height_m, c2.height_m, `Candidate ${i} height must match`);
    assert.strictEqual(c1.wallUValue, c2.wallUValue, `Candidate ${i} wallU must match`);
    assert.strictEqual(c1.thermalCapacitance, c2.thermalCapacitance, `Candidate ${i} capacitance must match`);
  }

  console.log(`✓ Test 1: Candidate generation is 100% deterministic (${run1.candidates.length} candidates verified)`);
}

// ---------------------------------------------------------------------------
// Test 2: Every candidate keeps floor area and uses only available materials
// ---------------------------------------------------------------------------
{
  const available = ['mat_adobe', 'mat_stone'];
  const targetFloorArea = baseConfig.geometry.length_m * baseConfig.geometry.width_m; // 12.0 m²
  const res = generateCandidates(baseConfig, available);

  assert.ok(res.candidates.length > 0, 'Must generate candidates');

  for (const c of res.candidates) {
    const area = c.length_m * c.width_m;
    assert.ok(
      Math.abs(area - targetFloorArea) < 0.05,
      `Floor area ${area.toFixed(3)} must equal target ${targetFloorArea} m² within rounding`
    );
    for (const l of c.config.wallLayers) {
      assert.ok(available.includes(l.materialId), `Wall layer material ${l.materialId} must be in available list`);
    }
    assert.strictEqual(c.config.geometry.orientation_deg, baseConfig.geometry.orientation_deg);
    assert.strictEqual(c.config.geometry.openings.length, baseConfig.geometry.openings.length);
  }

  console.log(
    `✓ Test 2: All ${res.candidates.length} candidates preserve floor area (${targetFloorArea} m²) and use only available materials`
  );
}

// ---------------------------------------------------------------------------
// Test 3: Comparator: converged first, target-met first, then the design goal
// ---------------------------------------------------------------------------
function makeMock(
  id: string,
  stats: { min: number; avg: number; max: number },
  opts: { converged?: boolean; error?: string | null } = {}
): EvaluatedCandidate {
  return {
    id,
    config: baseConfig,
    wallDescription: 'Wall',
    roofDescription: 'Roof',
    dimensionsDescription: 'Geom',
    length_m: 4,
    width_m: 3,
    height_m: 2.5,
    floorArea_m2: 12,
    totalWallThickness_m: 0.4,
    wallUValue: 1,
    roofUValue: 1,
    thermalCapacitance: 1e6,
    gridInfo: { layerMultipliers: [1], heightMultiplier: 1 },
    results: [],
    daysSimulated: 5,
    converged: opts.converged ?? true,
    residualC: 0.005,
    peak: stats.max,
    min: stats.min,
    avg: stats.avg,
    swing: stats.max - stats.min,
    targetMinTempC: undefined,
    meetsTarget: null,
    error: opts.error ?? null,
  };
}

{
  // keep_warm: higher minimum first
  const A = makeMock('A', { min: 15, avg: 18, max: 21 });
  const B = makeMock('B', { min: 18, avg: 20, max: 22 });
  const C = makeMock('C', { min: 12, avg: 25, max: 40 }); // misses a 14 °C target
  const D = makeMock('D', { min: 10, avg: 15, max: 20 }); // misses a 14 °C target

  const warm = rankCandidates([D, C, A, B], 'keep_warm');
  assert.deepStrictEqual(warm.map((c) => c.id), ['B', 'A', 'C', 'D'], 'keep_warm sorts by minimum, descending');

  // With a target of 14 °C, target-met designs (A, B) rank first, then the goal decides
  const warmTarget = rankCandidates([D, C, A, B], 'keep_warm', 14);
  assert.deepStrictEqual(warmTarget.map((c) => c.id), ['B', 'A', 'C', 'D'], 'target-met before target-missed');

  // Target ordering overrides the goal metric: E has a huge min but the target is above it
  const E = makeMock('E', { min: 16, avg: 17, max: 18 });
  const F = makeMock('F', { min: 20, avg: 21, max: 22 });
  const overTarget = rankCandidates([E, F], 'keep_warm', 18);
  assert.strictEqual(overTarget[0].id, 'F', 'only F meets an 18 °C target');
  assert.ok(compareCandidates(F, E, 'keep_warm', 18) < 0);

  // keep_cool: lower maximum first
  const cool = rankCandidates([A, B, C, D], 'keep_cool');
  assert.deepStrictEqual(cool.map((c) => c.id), ['D', 'A', 'B', 'C'], 'keep_cool sorts by maximum, ascending');

  // stabilize: lower swing first (A swing 6, B swing 4, C swing 28, D swing 10)
  const stable = rankCandidates([A, B, C, D], 'stabilize');
  assert.deepStrictEqual(stable.map((c) => c.id), ['B', 'A', 'D', 'C'], 'stabilize sorts by swing, ascending');

  console.log('✓ Test 3: Comparator honors converged-first, target-met-first, then each design goal');
}

{
  // A design that did not converge ranks after a converged one, even if its metric is better
  const good = makeMock('good', { min: 10, avg: 12, max: 14 });
  const drifting = makeMock('drifting', { min: 30, avg: 31, max: 32 }, { converged: false });
  const failed = makeMock('failed', { min: 99, avg: 99, max: 99 }, { error: 'boom' });
  const ranked = rankCandidates([failed, drifting, good], 'keep_warm');
  assert.deepStrictEqual(ranked.map((c) => c.id), ['good', 'drifting', 'failed'], 'errors last, unconverged after converged');
  console.log('✓ Test 3b: Unconverged designs rank after converged ones; errored designs rank last');
}

// ---------------------------------------------------------------------------
// Test 4: Empty available list gives zero evaluations
// ---------------------------------------------------------------------------
{
  const resEmpty = generateCandidates(baseConfig, []);
  assert.strictEqual(resEmpty.candidates.length, 0, 'Empty available list must return 0 candidates');
  assert.strictEqual(resEmpty.totalGenerated, 0, 'totalGenerated must be 0');
  assert.strictEqual(resEmpty.evaluatedCount, 0, 'evaluatedCount must be 0');

  const resUnknown = generateCandidates(baseConfig, ['non_existent_id']);
  assert.strictEqual(resUnknown.candidates.length, 0, 'Non-existent materials must return 0 candidates');

  // A list that only contains a glazing material also yields zero candidates
  const resGlassOnly = generateCandidates(baseConfig, ['glass']);
  assert.strictEqual(resGlassOnly.candidates.length, 0, 'A glass-only list must return 0 candidates');

  console.log('✓ Test 4: Empty (or glass-only) available materials list returns 0 candidates');
}

// ---------------------------------------------------------------------------
// Test 5: Glazing-type materials are never used as wall or roof layers
// ---------------------------------------------------------------------------
{
  const withGlassAvailable = ['mat_adobe', 'mat_stone', 'mat_insul', 'glass'];
  for (const alsoVaryRoof of [false, true]) {
    const res = generateCandidates(baseConfig, withGlassAvailable, alsoVaryRoof);
    assert.ok(res.candidates.length > 0);
    for (const c of res.candidates) {
      for (const l of [...c.config.wallLayers, ...c.config.roofLayers]) {
        if (!(l.materialId === 'mat_adobe' && !alsoVaryRoof)) {
          assert.notStrictEqual(l.materialId, 'glass', 'glass must never be a wall or roof layer');
        }
        assert.notStrictEqual(l.materialId, 'glass');
      }
    }
  }
  console.log('✓ Test 5: Glass is never used as a wall or roof layer, even when listed as available');
}

// ---------------------------------------------------------------------------
// Test 6: Maximum total wall thickness drops candidates and is reported
// ---------------------------------------------------------------------------
{
  const available = ['mat_adobe', 'mat_stone'];
  const uncapped = generateCandidates(baseConfig, available);
  const cap = defaultMaxTotalWallThickness_m(baseConfig);
  assert.strictEqual(cap, 0.8, 'default cap is 2x the current 0.40 m wall');

  const capped = generateCandidates(baseConfig, available, false, { maxTotalWallThickness_m: cap });
  assert.ok(capped.totalGenerated < uncapped.totalGenerated, 'the cap must remove some candidates');
  assert.strictEqual(
    capped.totalGenerated + capped.droppedByThicknessCap,
    uncapped.totalGenerated,
    'kept + dropped must equal the uncapped total'
  );
  for (const c of capped.candidates) {
    assert.ok(c.totalWallThickness_m <= cap + 1e-9, `total ${c.totalWallThickness_m} must not exceed ${cap}`);
  }
  // A cap below the thinnest layer removes everything
  const none = generateCandidates(baseConfig, available, false, { maxTotalWallThickness_m: 0.01 });
  assert.strictEqual(none.candidates.length, 0);
  console.log(
    `✓ Test 6: Thickness cap keeps ${capped.totalGenerated} of ${uncapped.totalGenerated} candidates (${capped.droppedByThicknessCap} dropped)`
  );
}

// ---------------------------------------------------------------------------
// Test 7: Grid-edge notes
// ---------------------------------------------------------------------------
{
  const edge = makeMock('edge', { min: 1, avg: 2, max: 3 });
  edge.gridInfo = { layerMultipliers: [2.0, 1.0], heightMultiplier: 1.2 };
  edge.totalWallThickness_m = 0.8;
  const notes = gridEdgeNotes(edge, 0.8);
  assert.strictEqual(notes.length, 3, 'max thickness, max height and thickness cap');

  const middle = makeMock('mid', { min: 1, avg: 2, max: 3 });
  middle.gridInfo = { layerMultipliers: [1.0], heightMultiplier: 1.0 };
  middle.totalWallThickness_m = 0.4;
  assert.strictEqual(gridEdgeNotes(middle, 0.8).length, 0, 'a mid-grid design has no edge notes');
  console.log('✓ Test 7: Grid-edge notes flag edge designs and stay silent for mid-grid designs');
}

// ---------------------------------------------------------------------------
// Test 8: Explanation string
// ---------------------------------------------------------------------------
{
  const c = makeMock('x', { min: 10, avg: 12, max: 14 });
  const noTarget = buildExplanationString(c, 'keep_warm');
  assert.ok(noTarget.includes('No target set'), 'no target -> "No target set"');
  assert.ok(!noTarget.includes('Target met'), 'must not claim a target was met');
  assert.ok(noTarget.includes('Coldest hour (°C): 10.00'));

  const withTarget: EvaluatedCandidate = { ...c, targetMinTempC: 11 };
  assert.ok(buildExplanationString(withTarget, 'keep_warm').includes('Does not meet target'));
  console.log('✓ Test 8: Explanation string reports only computed numbers and never a false "Target met"');
}

console.log('\nAll design search unit tests passed successfully!\n');
