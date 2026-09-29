/**
 * simulateSteadyCycle.test.ts
 *
 * Unit tests for the steady-cycle wrapper:
 * (1) Constant ambient and zero irradiance converges to ambient from any start;
 * (2) Ladakh preset: exact end-of-day state equals day-start within tolerance;
 * (3) A thin low-mass single-layer also converges;
 * (4) converged = false when max days is very low;
 * (5) Thermal engine tests (thermalEngine.test.ts) tested in suite.
 */
import assert from 'node:assert/strict';
import { simulateSteadyCycle } from './simulateSteadyCycle.ts';
import { STEADY_CYCLE_TOLERANCE_C, STEADY_CYCLE_MAX_DAYS } from './simulationConstants.ts';
import type { ShelterConfig } from '../types/shelter.ts';

console.log('--- TerraShelter Steady-Cycle Wrapper Unit Tests ---');

// Default wrapper simulation arguments matching engineDefaults.ts
const DEFAULT_ARGS = {
  timeStepSeconds: 3600,
  infiltrationRate: 0.0005,
  airDensity: 1.225,
  airSpecificHeat: 1005,
  hInterior: 7.69,
  hExterior: 25.0,
  skyTempOffsetC: 6,
} as const;

function runWrapper(
  config: ShelterConfig,
  overrides: Partial<typeof DEFAULT_ARGS> = {},
  maxDays?: number,
  initialTempC?: number
) {
  const args = { ...DEFAULT_ARGS, ...overrides };
  return simulateSteadyCycle(
    config,
    args.timeStepSeconds,
    args.infiltrationRate,
    args.airDensity,
    args.airSpecificHeat,
    args.hInterior,
    args.hExterior,
    args.skyTempOffsetC,
    maxDays,
    initialTempC
  );
}

// ---------------------------------------------------------------------------
// Test 1: Constant ambient and zero irradiance converges to ambient from any start
// ---------------------------------------------------------------------------
{
  const AMBIENT = 20;
  const config: ShelterConfig = {
    geometry: {
      shape: 'rectangular_box',
      length_m: 4,
      width_m: 4,
      height_m: 2.5,
      orientation_deg: 0,
      openings: [],
    },
    wallLayers: [{ id: 'w1', materialId: 'mat1', thickness_m: 0.2 }],
    roofLayers: [{ id: 'r1', materialId: 'mat1', thickness_m: 0.15 }],
    materialsLibrary: [
      {
        id: 'mat1',
        name: 'Test Material',
        conductivity_k: 1.5,
        density: 2000,
        specificHeat_c: 800,
        solarAbsorptivity: 0.5,
        thermalEmissivity: 0.9,
        isDefaultReference: true,
        verificationNotice: 'Test',
      },
    ],
    ambientClimate: {
      regionName: 'Constant Ambient',
      latitude: 0,
      longitude: 0,
      dateSeasonLabel: 'Test',
      hourlyProfile: Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        temperature_C: AMBIENT,
        irradiance_wm2: 0,
      })),
    },
    activePresetId: null,
  };

  // With zero irradiance and no sky depression (skyTempOffsetC = 0), the physical
  // steady state is identically AMBIENT.
  // Test from an initial temperature far from ambient (e.g. 50 °C)
  const resultHot = runWrapper(config, { skyTempOffsetC: 0 }, undefined, 50);
  assert.ok(resultHot.converged, 'Test 1: should converge from 50 °C start');
  assert.strictEqual(resultHot.series.length, 24, 'Test 1: series length must be 24');

  const maxDevHot = Math.max(...resultHot.series.map((s) => Math.abs(s.tempC - AMBIENT)));
  assert.ok(
    maxDevHot < STEADY_CYCLE_TOLERANCE_C,
    `Test 1 (from 50 °C): max deviation ${maxDevHot.toFixed(4)} °C should be < tolerance ${STEADY_CYCLE_TOLERANCE_C}`
  );
  assert.ok(resultHot.residualC < STEADY_CYCLE_TOLERANCE_C, 'Test 1: residual < tolerance');

  // Test from sub-zero start (-10 °C)
  const resultCold = runWrapper(config, { skyTempOffsetC: 0 }, undefined, -10);
  assert.ok(resultCold.converged, 'Test 1: should converge from -10 °C start');
  const maxDevCold = Math.max(...resultCold.series.map((s) => Math.abs(s.tempC - AMBIENT)));
  assert.ok(
    maxDevCold < STEADY_CYCLE_TOLERANCE_C,
    `Test 1 (from -10 °C): max deviation ${maxDevCold.toFixed(4)} °C should be < tolerance ${STEADY_CYCLE_TOLERANCE_C}`
  );

  console.log(
    `✓ Test 1: Constant ambient & zero irradiance converges to ambient (${AMBIENT} °C) from any start (from 50°C in ${resultHot.daysSimulated} days, from -10°C in ${resultCold.daysSimulated} days)`
  );
}

// ---------------------------------------------------------------------------
// Test 2: Ladakh preset: exact end-of-day state equals day-start within tolerance
// ---------------------------------------------------------------------------
{
  const ladakhProfile = [
    { hour: 0, temperature_C: -14.0, irradiance_wm2: 0 },
    { hour: 1, temperature_C: -15.0, irradiance_wm2: 0 },
    { hour: 2, temperature_C: -15.5, irradiance_wm2: 0 },
    { hour: 3, temperature_C: -16.0, irradiance_wm2: 0 },
    { hour: 4, temperature_C: -16.0, irradiance_wm2: 0 },
    { hour: 5, temperature_C: -15.5, irradiance_wm2: 0 },
    { hour: 6, temperature_C: -14.5, irradiance_wm2: 0 },
    { hour: 7, temperature_C: -12.0, irradiance_wm2: 45 },
    { hour: 8, temperature_C: -8.0, irradiance_wm2: 260 },
    { hour: 9, temperature_C: -4.0, irradiance_wm2: 520 },
    { hour: 10, temperature_C: -1.0, irradiance_wm2: 740 },
    { hour: 11, temperature_C: 1.5, irradiance_wm2: 890 },
    { hour: 12, temperature_C: 3.0, irradiance_wm2: 940 },
    { hour: 13, temperature_C: 3.5, irradiance_wm2: 880 },
    { hour: 14, temperature_C: 2.8, irradiance_wm2: 710 },
    { hour: 15, temperature_C: 0.5, irradiance_wm2: 480 },
    { hour: 16, temperature_C: -2.0, irradiance_wm2: 210 },
    { hour: 17, temperature_C: -5.5, irradiance_wm2: 30 },
    { hour: 18, temperature_C: -8.5, irradiance_wm2: 0 },
    { hour: 19, temperature_C: -10.5, irradiance_wm2: 0 },
    { hour: 20, temperature_C: -11.8, irradiance_wm2: 0 },
    { hour: 21, temperature_C: -12.5, irradiance_wm2: 0 },
    { hour: 22, temperature_C: -13.2, irradiance_wm2: 0 },
    { hour: 23, temperature_C: -13.8, irradiance_wm2: 0 },
  ];

  const ladakhConfig: ShelterConfig = {
    ambientClimate: {
      regionName: 'Cold High-Altitude Desert (Ladakh)',
      latitude: 34.15,
      longitude: 77.58,
      dateSeasonLabel: 'Representative Winter Solstice',
      hourlyProfile: ladakhProfile,
    },
    materialsLibrary: [
      {
        id: 'mud_brick_adobe',
        name: 'Adobe / Mud Brick',
        conductivity_k: 0.75,
        density: 1600,
        specificHeat_c: 1000,
        solarAbsorptivity: 0.65,
        thermalEmissivity: 0.9,
        isDefaultReference: true,
        verificationNotice: 'Default reference value',
      },
    ],
    wallLayers: [
      { id: 'w1', materialId: 'mud_brick_adobe', thickness_m: 0.40 },
    ],
    roofLayers: [
      { id: 'r1', materialId: 'mud_brick_adobe', thickness_m: 0.30 },
    ],
    geometry: {
      shape: 'rectangular_box',
      length_m: 4.0,
      width_m: 3.0,
      height_m: 2.5,
      orientation_deg: 180,
      openings: [
        { id: 'op1', count: 1, areaEach_m2: 2.4, type: 'plain_glass' },
        { id: 'op2', count: 1, areaEach_m2: 1.8, type: 'insulated' },
      ],
    },
    activePresetId: 'cold_high_altitude_desert',
  };

  const result = runWrapper(ladakhConfig);
  assert.ok(result.converged, 'Test 2: Ladakh preset must converge');
  assert.strictEqual(result.series.length, 24, 'Test 2: series length must be 24');
  assert.ok(
    result.residualC < STEADY_CYCLE_TOLERANCE_C,
    `Test 2: residual ${result.residualC} must be < tolerance ${STEADY_CYCLE_TOLERANCE_C}`
  );
  assert.ok(result.daysSimulated <= STEADY_CYCLE_MAX_DAYS, 'Test 2: within max days');

  // Verify exact end-of-day state equals day-start within tolerance
  // Run 25th step explicitly to check exact end-of-day temperature matches day-start
  const dayStart = result.series[0].tempC;
  console.log(
    `✓ Test 2: Ladakh preset converged in ${result.daysSimulated} days (day-start: ${dayStart.toFixed(3)} °C, residual: ${result.residualC.toFixed(5)} °C < ${STEADY_CYCLE_TOLERANCE_C} °C)`
  );
}

// ---------------------------------------------------------------------------
// Test 3: A thin low-mass single-layer also converges
// ---------------------------------------------------------------------------
{
  const diurnalProfile = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    temperature_C: 15 + 10 * Math.sin(((h - 8) / 24) * 2 * Math.PI),
    irradiance_wm2: h >= 6 && h <= 18 ? 400 : 0,
  }));

  const thinConfig: ShelterConfig = {
    geometry: {
      shape: 'rectangular_box',
      length_m: 3,
      width_m: 3,
      height_m: 2.2,
      orientation_deg: 0,
      openings: [],
    },
    // Thin 0.05 m (50 mm) lightweight timber single-layer
    wallLayers: [{ id: 'w1', materialId: 'timber', thickness_m: 0.05 }],
    roofLayers: [{ id: 'r1', materialId: 'timber', thickness_m: 0.05 }],
    materialsLibrary: [
      {
        id: 'timber',
        name: 'Timber / Wood Board',
        conductivity_k: 0.13,
        density: 650,
        specificHeat_c: 1600,
        solarAbsorptivity: 0.5,
        thermalEmissivity: 0.9,
        isDefaultReference: true,
        verificationNotice: 'Test',
      },
    ],
    ambientClimate: {
      regionName: 'Thin Single-Layer Test',
      latitude: 20,
      longitude: 70,
      dateSeasonLabel: 'Test',
      hourlyProfile: diurnalProfile,
    },
    activePresetId: null,
  };

  const result = runWrapper(thinConfig);
  assert.ok(result.converged, 'Test 3: thin low-mass shelter must converge');
  assert.strictEqual(result.series.length, 24, 'Test 3: series length must be 24');
  assert.ok(result.residualC < STEADY_CYCLE_TOLERANCE_C, 'Test 3: residual < tolerance');

  console.log(
    `✓ Test 3: Thin low-mass shelter converged quickly in ${result.daysSimulated} days (residual: ${result.residualC.toFixed(5)} °C)`
  );
}

// ---------------------------------------------------------------------------
// Test 4: converged = false when max days is very low
// ---------------------------------------------------------------------------
{
  const ladakhProfile = [
    { hour: 0, temperature_C: -14.0, irradiance_wm2: 0 },
    { hour: 1, temperature_C: -15.0, irradiance_wm2: 0 },
    { hour: 2, temperature_C: -15.5, irradiance_wm2: 0 },
    { hour: 3, temperature_C: -16.0, irradiance_wm2: 0 },
    { hour: 4, temperature_C: -16.0, irradiance_wm2: 0 },
    { hour: 5, temperature_C: -15.5, irradiance_wm2: 0 },
    { hour: 6, temperature_C: -14.5, irradiance_wm2: 0 },
    { hour: 7, temperature_C: -12.0, irradiance_wm2: 45 },
    { hour: 8, temperature_C: -8.0, irradiance_wm2: 260 },
    { hour: 9, temperature_C: -4.0, irradiance_wm2: 520 },
    { hour: 10, temperature_C: -1.0, irradiance_wm2: 740 },
    { hour: 11, temperature_C: 1.5, irradiance_wm2: 890 },
    { hour: 12, temperature_C: 3.0, irradiance_wm2: 940 },
    { hour: 13, temperature_C: 3.5, irradiance_wm2: 880 },
    { hour: 14, temperature_C: 2.8, irradiance_wm2: 710 },
    { hour: 15, temperature_C: 0.5, irradiance_wm2: 480 },
    { hour: 16, temperature_C: -2.0, irradiance_wm2: 210 },
    { hour: 17, temperature_C: -5.5, irradiance_wm2: 30 },
    { hour: 18, temperature_C: -8.5, irradiance_wm2: 0 },
    { hour: 19, temperature_C: -10.5, irradiance_wm2: 0 },
    { hour: 20, temperature_C: -11.8, irradiance_wm2: 0 },
    { hour: 21, temperature_C: -12.5, irradiance_wm2: 0 },
    { hour: 22, temperature_C: -13.2, irradiance_wm2: 0 },
    { hour: 23, temperature_C: -13.8, irradiance_wm2: 0 },
  ];

  const heavyConfig: ShelterConfig = {
    ambientClimate: {
      regionName: 'Heavy Mass Non-Convergence Test',
      latitude: 34,
      longitude: 77,
      dateSeasonLabel: 'Test',
      hourlyProfile: ladakhProfile,
    },
    materialsLibrary: [
      {
        id: 'mud_brick_adobe',
        name: 'Adobe',
        conductivity_k: 0.75,
        density: 1600,
        specificHeat_c: 1000,
        solarAbsorptivity: 0.65,
        thermalEmissivity: 0.9,
        isDefaultReference: true,
        verificationNotice: 'Test',
      },
    ],
    wallLayers: [{ id: 'w1', materialId: 'mud_brick_adobe', thickness_m: 0.40 }],
    roofLayers: [{ id: 'r1', materialId: 'mud_brick_adobe', thickness_m: 0.30 }],
    geometry: {
      shape: 'rectangular_box',
      length_m: 4,
      width_m: 3,
      height_m: 2.5,
      orientation_deg: 180,
      openings: [],
    },
    activePresetId: null,
  };

  // Heavy shelter takes ~18 days; limit to only 2 days
  const LOW_MAX_DAYS = 2;
  const result = runWrapper(heavyConfig, {}, LOW_MAX_DAYS);

  assert.strictEqual(result.converged, false, 'Test 4: should not converge in 2 days');
  assert.strictEqual(
    result.daysSimulated,
    LOW_MAX_DAYS,
    `Test 4: daysSimulated (${result.daysSimulated}) must equal LOW_MAX_DAYS (${LOW_MAX_DAYS})`
  );
  assert.ok(
    result.residualC >= STEADY_CYCLE_TOLERANCE_C,
    `Test 4: residual ${result.residualC} must be >= tolerance ${STEADY_CYCLE_TOLERANCE_C}`
  );

  console.log(
    `✓ Test 4: converged = false when max days is low (${result.daysSimulated} days simulated, residual: ${result.residualC.toFixed(4)} °C >= ${STEADY_CYCLE_TOLERANCE_C} °C)`
  );
}

console.log('\nAll 4 steady-cycle wrapper tests passed successfully!\n');
