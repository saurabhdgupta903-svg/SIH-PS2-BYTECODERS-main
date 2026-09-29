/**
 * NUMERICAL SETTINGS for simulateSteadyCycle.ts
 *
 * These are convergence / iteration limits only — NOT physical properties.
 * All physical formulas remain exclusively in thermalEngine.ts.
 */

/** Numerical setting, not a physical property.
 *  Day-to-day change in start-of-day inside temperature (°C) below which
 *  the daily cycle is considered converged. */
export const STEADY_CYCLE_TOLERANCE_C = 0.01;

/** Numerical setting, not a physical property.
 *  Maximum number of 24-hour repetitions before giving up and returning
 *  converged = false. */
export const STEADY_CYCLE_MAX_DAYS = 60;
