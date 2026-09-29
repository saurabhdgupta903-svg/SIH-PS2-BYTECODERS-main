/**
 * simulateSteadyCycle.ts
 *
 * Wrapper around simulateTemperatureOverTime that repeats the same 24-hour
 * ambient profile day-by-day until the day-start inside temperature converges.
 *
 * NO physics is derived here. All formulas remain exclusively in thermalEngine.ts.
 * This file only controls iteration and convergence checking.
 */
import { simulateTemperatureOverTime } from './thermalEngine.ts';
import { STEADY_CYCLE_TOLERANCE_C, STEADY_CYCLE_MAX_DAYS } from './simulationConstants.ts';
import type { ShelterConfig } from '../types/shelter.ts';

/** Shape of one element in the simulation series (mirrors engine output). */
export type SimStep = ReturnType<typeof simulateTemperatureOverTime>[number];

/**
 * Result returned by simulateSteadyCycle.
 *
 * - `series`        — The final-day simulation array (24 points), same shape as engine output.
 * - `daysSimulated` — Total days run (1 = converged on first day, 60 = hit max).
 * - `converged`     — true if |dayStart[n] - dayStart[n-1]| < STEADY_CYCLE_TOLERANCE_C.
 * - `residualC`     — Absolute day-start temperature change on the final iteration (°C).
 */
export interface SteadyCycleResult {
  series: SimStep[];
  daysSimulated: number;
  converged: boolean;
  residualC: number;
}

/**
 * Repeats the 24-hour profile until day-start temperature converges.
 *
 * Arguments mirror simulateTemperatureOverTime exactly, minus `initialTempC`
 * (Day 1 always starts at hourlyProfile[0].temperature_C).
 * Optional `maxDays` defaults to STEADY_CYCLE_MAX_DAYS (60).
 */
export function simulateSteadyCycle(
  config: ShelterConfig,
  timeStepSeconds: number,
  infiltrationRate: number,
  airDensity: number,
  airSpecificHeat: number,
  hInterior: number,
  hExterior: number,
  skyTempOffsetC: number,
  maxDays: number = STEADY_CYCLE_MAX_DAYS,
  initialTempC?: number
): SteadyCycleResult {
  const profile = config.ambientClimate.hourlyProfile;
  if (!profile || profile.length === 0) {
    return {
      series: [],
      daysSimulated: 0,
      converged: true,
      residualC: 0,
    };
  }

  // EXACT end-of-day state: run the engine on a COPY of the config whose
  // hourlyProfile has one EXTRA point appended (a copy of hour 0's temperature
  // and irradiance, 25 points).
  const config25: ShelterConfig = {
    ...config,
    ambientClimate: {
      ...config.ambientClimate,
      hourlyProfile: [
        ...profile,
        {
          ...profile[0],
          hour: 24,
        },
      ],
    },
  };

  // Day 1 starts at hourlyProfile[0].temperature_C (or explicit initialTempC if supplied)
  let dayStartTemp: number = initialTempC !== undefined ? initialTempC : profile[0].temperature_C;
  let lastSeries: SimStep[] = [];
  let residualC = 0;
  let day = 0;

  for (day = 1; day <= maxDays; day++) {
    const sim25 = simulateTemperatureOverTime(
      config25,
      dayStartTemp,
      timeStepSeconds,
      infiltrationRate,
      airDensity,
      airSpecificHeat,
      hInterior,
      hExterior,
      skyTempOffsetC
    );

    // Return only the first 24 entries, in the engine's output shape
    lastSeries = sim25.slice(0, 24);

    // results[24].tempC is then exactly the state after 24 hours; use it as the next day's start
    const endOfDayTemp = sim25[24]?.tempC ?? dayStartTemp;
    residualC = Math.abs(endOfDayTemp - dayStartTemp);

    if (residualC < STEADY_CYCLE_TOLERANCE_C) {
      return {
        series: lastSeries,
        daysSimulated: day,
        converged: true,
        residualC,
      };
    }

    dayStartTemp = endOfDayTemp;
  }

  // Reached max days without converging
  return {
    series: lastSeries,
    daysSimulated: maxDays,
    converged: false,
    residualC,
  };
}
