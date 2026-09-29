import type {
  ShelterConfig,
  Material,
  WallLayer,
} from '../types/shelter';
import {
  calculateSolarGain,
  calculateAbsorbedHeat,
  calculateUValueSingleLayer,
  calculateUValueMultiLayer,
  calculateHeatLoss,
  calculateInfiltrationLoss,
  calculateRadiativeLoss,
  calculateThermalCapacitance,
  simulateTemperatureOverTime,
  calculateEfficiencyScore,
} from './thermalEngine.ts';

function assertStrictEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`Assertion failed: expected ${expected}, got ${actual}. ${message ?? ''}`);
  }
}

function assertOk(value: boolean, message?: string): void {
  if (!value) {
    throw new Error(`Assertion failed: ${message ?? ''}`);
  }
}

console.log('--- TerraShelter Thermal Engine Unit Tests (Hand-Verifiable Arithmetic) ---');

// --- Test Formula 1: calculateSolarGain ---
// Q_solar = I * A * α * cos(θ)
// I = 100 W/m², A = 2 m², α = 0.5, θ = 0 rad -> cos(0) = 1
// Expected = 100 * 2 * 0.5 * 1 = 100 W
{
  const result = calculateSolarGain(100, 2, 0.5, 0);
  assertStrictEqual(result, 100, 'Formula 1: Solar gain at normal incidence failed');
  console.log('✓ Formula 1: calculateSolarGain (100 * 2 * 0.5 * cos(0) = 100 W)');
}

// --- Test Formula 2: calculateAbsorbedHeat ---
// Q_absorbed = Q_solar * τ
// Case A: With glazing, τ = 0.8: 100 * 0.8 = 80 W
// Case B: Without glazing, τ = 1: 100 * 1 = 100 W
{
  const withGlazing = calculateAbsorbedHeat(100, 0.8);
  assertStrictEqual(withGlazing, 80, 'Formula 2: Absorbed heat with glazing failed');

  const withoutGlazing = calculateAbsorbedHeat(100, 1.0);
  assertStrictEqual(withoutGlazing, 100, 'Formula 2: Absorbed heat without glazing failed');
  console.log('✓ Formula 2: calculateAbsorbedHeat (100 * 0.8 = 80 W, 100 * 1 = 100 W)');
}

// --- Test Formula 3: calculateUValueSingleLayer ---
// U = 1 / (1/h_i + L/k + 1/h_o)
// h_i = 2, L = 1, k = 1, h_o = 2
// 1/2 + 1/1 + 1/2 = 0.5 + 1 + 0.5 = 2.0
// U = 1 / 2.0 = 0.5 W/m²·K
{
  const result = calculateUValueSingleLayer(2, 1, 1, 2);
  assertStrictEqual(result, 0.5, 'Formula 3: Single-layer U-value failed');
  console.log('✓ Formula 3: calculateUValueSingleLayer (1 / (0.5 + 1.0 + 0.5) = 0.5 W/m²·K)');
}

// --- Test Formula 4: calculateUValueMultiLayer ---
// 1/U = 1/h_i + Σ(L_n / k_n) + 1/h_o
// h_i = 2, h_o = 2 -> 1/h_i + 1/h_o = 1.0
// Layer 1: L=0.5, k=1 -> L/k = 0.5
// Layer 2: L=1.0, k=2 -> L/k = 0.5
// Sum = 1.0 + 0.5 + 0.5 = 2.0 -> U = 1 / 2.0 = 0.5 W/m²·K
{
  const materials: Material[] = [
    {
      id: 'mat_1',
      name: 'Mat 1',
      conductivity_k: 1,
      density: 1000,
      specificHeat_c: 1000,
      solarAbsorptivity: 0.5,
      thermalEmissivity: 0.9,
      isDefaultReference: true,
      verificationNotice: '',
    },
    {
      id: 'mat_2',
      name: 'Mat 2',
      conductivity_k: 2,
      density: 1000,
      specificHeat_c: 1000,
      solarAbsorptivity: 0.5,
      thermalEmissivity: 0.9,
      isDefaultReference: true,
      verificationNotice: '',
    },
  ];

  const layers: WallLayer[] = [
    { id: 'l1', materialId: 'mat_1', thickness_m: 0.5 },
    { id: 'l2', materialId: 'mat_2', thickness_m: 1.0 },
  ];

  const result = calculateUValueMultiLayer(2, layers, materials, 2);
  assertStrictEqual(result, 0.5, 'Formula 4: Multi-layer U-value failed');
  console.log('✓ Formula 4: calculateUValueMultiLayer (1 / (0.5 + 0.5 + 0.5 + 0.5) = 0.5 W/m²·K)');
}

// --- Test Formula 5: calculateHeatLoss ---
// Q_loss = U * A * (T_in - T_ambient)
// U = 2 W/m²·K, A = 5 m², T_in = 20°C, T_ambient = 10°C
// Q_loss = 2 * 5 * (20 - 10) = 10 * 10 = 100 W
{
  const result = calculateHeatLoss(2, 5, 20, 10);
  assertStrictEqual(result, 100, 'Formula 5: Heat loss failed');
  console.log('✓ Formula 5: calculateHeatLoss (2 * 5 * (20 - 10) = 100 W)');
}

// --- Test Formula 6: calculateInfiltrationLoss ---
// Q_infiltration = V̇ * ρ * c_p * (T_in - T_ambient)
// V̇ = 1 m³/s, ρ = 1 kg/m³, c_p = 1000 J/kg·K, T_in = 20°C, T_ambient = 10°C
// Q_infiltration = 1 * 1 * 1000 * (20 - 10) = 10000 W
{
  const result = calculateInfiltrationLoss(1, 1, 1000, 20, 10);
  assertStrictEqual(result, 10000, 'Formula 6: Infiltration loss failed');
  console.log('✓ Formula 6: calculateInfiltrationLoss (1 * 1 * 1000 * (20 - 10) = 10000 W)');
}

// --- Test Formula 7: calculateRadiativeLoss ---
// Q_radiative = ε * σ * A * (T_surface_K^4 - T_sky_K^4)
// ε = 1, A = 1 m²
// T_surface = 26.85°C -> 300 K -> 300^4 = 81 * 10^8
// T_sky = -73.15°C -> 200 K -> 200^4 = 16 * 10^8
// Δ(T^4) = (81 - 16) * 10^8 = 65 * 10^8
// Q_radiative = 1 * (5.67 * 10^-8) * 1 * (65 * 10^8) = 5.67 * 65 = 368.55 W
{
  const result = calculateRadiativeLoss(1, 1, 26.85, -73.15);
  assertOk(Math.abs(result - 368.55) < 1e-9, `Formula 7: Radiative loss failed, expected 368.55, got ${result}`);
  console.log('✓ Formula 7: calculateRadiativeLoss (1 * 5.67e-8 * 1 * (300^4 - 200^4) = 368.55 W)');
}

// --- Test Formula 8: calculateThermalCapacitance ---
// C = Σ(m_n * c_n)
// Element 1: mass = 10 kg, c = 500 J/kg·K -> 5000 J/K
// Element 2: mass = 20 kg, c = 250 J/kg·K -> 5000 J/K
// Total C = 5000 + 5000 = 10000 J/K
{
  const elements = [
    { mass: 10, specificHeat: 500 },
    { mass: 20, specificHeat: 250 },
  ];
  const result = calculateThermalCapacitance(elements);
  assertStrictEqual(result, 10000, 'Formula 8: Thermal capacitance failed');
  console.log('✓ Formula 8: calculateThermalCapacitance (10 * 500 + 20 * 250 = 10000 J/K)');
}

// --- Test Formula 9: simulateTemperatureOverTime ---
// Simple test case:
// 1-hour profile: hour 0, T_ambient = 10°C, Irradiance = 0 W/m²
// Geometry: 1m x 1m x 1m box (A_roof = 1 m², A_walls = 4 m², A_total = 5 m²)
// Wall layer: 1m thickness, k = 1, ρ = 1, c = 1000
// Roof layer: 1m thickness, k = 1, ρ = 1, c = 1000, α = 0, ε = 0
// h_i = 2, h_o = 2 -> U_wall = 0.5, U_roof = 0.5 -> U_overall = 0.5 W/m²·K
// Capacitance:
//   Wall mass = 4 m² * 1 m * 1 kg/m³ = 4 kg, c = 1000 -> 4000 J/K
//   Roof mass = 1 m² * 1 m * 1 kg/m³ = 1 kg, c = 1000 -> 1000 J/K
//   Air mass = 1 m³ * 1 kg/m³ = 1 kg, c = 1000 -> 1000 J/K
//   Total C = 4000 + 1000 + 1000 = 6000 J/K
// Inputs: initialTempC = 20°C, timeStepSeconds = 60s, infiltrationRate = 0, skyTempOffsetC = 0
// Step 0 (t = 0s):
//   T_in = 20°C, T_ambient = 10°C
//   Q_solar = 0, Q_absorbed = 0
//   Q_loss = 0.5 * 5 * (20 - 10) = 25 W
//   Q_infiltration = 0, Q_radiative = 0
//   Net heat flow = -25 W
//   ΔT = (60 / 6000) * (-25) = 0.01 * (-25) = -0.25°C
//   Next T_in (at t = 60s) = 20 - 0.25 = 19.75°C
// Step 1 (t = 60s):
//   T_in = 19.75°C, T_ambient = 10°C
//   Q_loss = 0.5 * 5 * (19.75 - 10) = 2.5 * 9.75 = 24.375 W
//   ΔT = 0.01 * (-24.375) = -0.24375°C
//   Next T_in (at t = 120s) = 19.75 - 0.24375 = 19.50625°C
{
  const dummyConfig: ShelterConfig = {
    ambientClimate: {
      regionName: 'Test Region',
      latitude: 0,
      longitude: 0,
      dateSeasonLabel: 'Test Day',
      hourlyProfile: [
        { hour: 0, temperature_C: 10, irradiance_wm2: 0 },
      ],
    },
    materialsLibrary: [
      {
        id: 'mat_test',
        name: 'Test Material',
        conductivity_k: 1,
        density: 1,
        specificHeat_c: 1000,
        solarAbsorptivity: 0,
        thermalEmissivity: 0,
        isDefaultReference: true,
        verificationNotice: '',
      },
    ],
    wallLayers: [{ id: 'w1', materialId: 'mat_test', thickness_m: 1 }],
    roofLayers: [{ id: 'r1', materialId: 'mat_test', thickness_m: 1 }],
    geometry: {
      shape: 'rectangular_box',
      length_m: 1,
      width_m: 1,
      height_m: 1,
      orientation_deg: 0,
      openings: [],
    },
    activePresetId: null,
  };

  const results = simulateTemperatureOverTime(
    dummyConfig,
    20, // initialTempC
    60, // timeStepSeconds
    0,  // infiltrationRate
    1,  // airDensity
    1000, // airSpecificHeat
    2,  // hInterior
    2,  // hExterior
    0   // skyTempOffsetC
  );

  // 1 hour = 3600 seconds -> 60 steps
  assertStrictEqual(results.length, 60, 'Formula 9: Step count should be 60');
  // Check Step 0
  assertStrictEqual(results[0].time, 0);
  assertStrictEqual(results[0].tempC, 20);
  assertStrictEqual(results[0].qSolar, 0);
  assertStrictEqual(results[0].qAbsorbed, 0);
  assertStrictEqual(results[0].qLoss, 25);
  assertStrictEqual(results[0].qInfiltration, 0);
  assertStrictEqual(results[0].qRadiative, 0);

  // Check Step 1
  assertStrictEqual(results[1].time, 60);
  assertStrictEqual(results[1].tempC, 19.75);
  assertStrictEqual(results[1].qLoss, 24.375);

  // Check Step 2
  assertStrictEqual(results[2].time, 120);
  assertOk(Math.abs(results[2].tempC - 19.50625) < 1e-9);

  console.log('✓ Formula 9: simulateTemperatureOverTime (Step 0: Tin=20°C, Qloss=25W -> Step 1: Tin=19.75°C, Qloss=24.375W)');
}

// --- Test Formula 10: calculateEfficiencyScore ---
// Case A: No glazing (τ = 1, qAbsorbed = qSolar = 100 W)
// η = (∫Q_absorbed dt - ∫(Q_loss + Q_infiltration + Q_radiative) dt) / ∫Q_solar dt
// 2 time steps, Δt = 10s:
// Step 0: qSolar = 100, qAbsorbed = 100, qLoss = 20, qInfil = 10, qRad = 10 -> net retained = 60 W
// Step 1: qSolar = 100, qAbsorbed = 100, qLoss = 20, qInfil = 10, qRad = 10 -> net retained = 60 W
// qSolarSeries = [100, 100]
// ∫Q_absorbed dt = (100 + 100) * 10 = 2000 J
// ∫Losses dt = (40 + 40) * 10 = 800 J
// ∫Q_solar dt = (100 + 100) * 10 = 2000 J
// η = (2000 - 800) / 2000 = 1200 / 2000 = 0.6
{
  const dummyResults: ReturnType<typeof simulateTemperatureOverTime> = [
    { time: 0, tempC: 20, qSolar: 100, qAbsorbed: 100, qLoss: 20, qInfiltration: 10, qRadiative: 10 },
    { time: 10, tempC: 20.5, qSolar: 100, qAbsorbed: 100, qLoss: 20, qInfiltration: 10, qRadiative: 10 },
  ];
  const qSolarSeries = [100, 100];

  const score = calculateEfficiencyScore(dummyResults, qSolarSeries);
  assertStrictEqual(score, 0.6, 'Formula 10: Efficiency score failed');
  console.log('✓ Formula 10: calculateEfficiencyScore (τ=1: (2000 J - 800 J) / 2000 J = 0.6)');
}

// Case B: With glazing transmittance loss (τ = 0.8, qSolar = 100 W, qAbsorbed = 80 W)
// ∫Q_absorbed dt = (80 + 80) * 10 = 1600 J
// ∫Losses dt = (40 + 40) * 10 = 800 J
// ∫Q_solar dt = (100 + 100) * 10 = 2000 J
// η = (1600 - 800) / 2000 = 800 / 2000 = 0.4
{
  const dummyResultsWithGlazing: ReturnType<typeof simulateTemperatureOverTime> = [
    { time: 0, tempC: 20, qSolar: 100, qAbsorbed: 80, qLoss: 20, qInfiltration: 10, qRadiative: 10 },
    { time: 10, tempC: 20.5, qSolar: 100, qAbsorbed: 80, qLoss: 20, qInfiltration: 10, qRadiative: 10 },
  ];
  const qSolarSeries = [100, 100];

  const score = calculateEfficiencyScore(dummyResultsWithGlazing, qSolarSeries);
  assertStrictEqual(score, 0.4, 'Formula 10 with glazing: Efficiency score failed');
  console.log('✓ Formula 10: calculateEfficiencyScore (τ=0.8: (1600 J - 800 J) / 2000 J = 0.4)');
}

console.log('\nAll 10 pure function tests passed successfully with exact hand-checked arithmetic!');
