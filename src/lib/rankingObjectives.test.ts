/**
 * rankingObjectives.test.ts
 * Hand-checkable tests for the design-goal statistics and comparators.
 */
import assert from 'node:assert/strict';
import {
  computeSeriesStats,
  goalMetricValue,
  compareStatsByGoal,
  getGoalInfo,
  DESIGN_GOALS,
} from './rankingObjectives.ts';

console.log('--- TerraShelter Ranking Objectives Unit Tests ---');

// Test 1: statistics of a small hand-checkable series
{
  const s = computeSeriesStats([10, 20, 30, 20]);
  assert.strictEqual(s.min, 10);
  assert.strictEqual(s.max, 30);
  assert.strictEqual(s.avg, 20);
  assert.strictEqual(s.swing, 20);
  assert.throws(() => computeSeriesStats([]), 'an empty series must throw');
  console.log('✓ Test 1: min/avg/max/swing of [10,20,30,20] are 10/20/30/20');
}

// Test 2: goal metric selection
{
  const s = { min: 5, avg: 8, max: 11, swing: 6 };
  assert.strictEqual(goalMetricValue('keep_warm', s), 5);
  assert.strictEqual(goalMetricValue('keep_cool', s), 11);
  assert.strictEqual(goalMetricValue('stabilize', s), 6);
  console.log('✓ Test 2: keep_warm -> min, keep_cool -> max, stabilize -> swing');
}

// Test 3: primary ordering
{
  const a = { min: 10, avg: 12, max: 14, swing: 4 };
  const b = { min: 8, avg: 12, max: 20, swing: 12 };
  assert.ok(compareStatsByGoal('keep_warm', a, b) < 0, 'a has the higher minimum');
  assert.ok(compareStatsByGoal('keep_cool', a, b) < 0, 'a has the lower maximum');
  assert.ok(compareStatsByGoal('stabilize', a, b) < 0, 'a has the lower swing');
  assert.ok(compareStatsByGoal('keep_warm', b, a) > 0);
  console.log('✓ Test 3: primary ordering for all three goals');
}

// Test 4: tie-breakers
{
  const a = { min: 10, avg: 15, max: 20, swing: 10 };
  const b = { min: 10, avg: 12, max: 20, swing: 10 };
  assert.ok(compareStatsByGoal('keep_warm', a, b) < 0, 'tie on min -> higher average wins');
  assert.ok(compareStatsByGoal('keep_cool', b, a) < 0, 'tie on max -> lower average wins');

  const c = { min: 5, avg: 10, max: 15, swing: 10 };
  const d = { min: 6, avg: 11, max: 16, swing: 10 };
  assert.ok(compareStatsByGoal('stabilize', c, d) < 0, 'tie on swing -> lower maximum wins');

  assert.strictEqual(compareStatsByGoal('keep_warm', a, a), 0, 'identical statistics tie exactly');
  console.log('✓ Test 4: tie-breakers (avg for warm/cool, max for stabilize) and exact ties');
}

// Test 5: goal catalogue
{
  assert.deepStrictEqual(DESIGN_GOALS.map((g) => g.id), ['keep_warm', 'keep_cool', 'stabilize']);
  assert.strictEqual(getGoalInfo('stabilize').label, 'Stabilize');
  console.log('✓ Test 5: goal catalogue exposes the three goals');
}

console.log('\nAll ranking objective tests passed successfully!\n');
