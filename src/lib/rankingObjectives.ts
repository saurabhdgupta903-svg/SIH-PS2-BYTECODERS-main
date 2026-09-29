/**
 * rankingObjectives.ts
 *
 * Design-goal based ranking for the Design Recommender and the Compare tab.
 *
 * WHY THIS EXISTS
 * At a steady daily cycle the net energy stored over 24 h is ~0, so the
 * efficiency score η = (absorbed - losses) / solar collapses to
 * C * (T_end - T_start) / ∫Q_solar, i.e. only thermal capacitance times the
 * convergence residual. It no longer measures performance, so designs are
 * ranked on the simulated inside temperatures instead.
 *
 * All statistics come straight from the final steady-cycle day series.
 * No physics is computed here and no comfort thresholds are invented.
 */

export type DesignGoal = 'keep_warm' | 'keep_cool' | 'stabilize';

export interface DesignGoalInfo {
  id: DesignGoal;
  label: string;
  /** Name of the primary metric the goal ranks by. */
  metricLabel: string;
  /** Plain-language description of the ranking rule (shown in the UI). */
  description: string;
}

export const DESIGN_GOALS: DesignGoalInfo[] = [
  {
    id: 'keep_warm',
    label: 'Keep warm',
    metricLabel: 'Coldest hour (°C)',
    description:
      'Highest minimum inside temperature over the steady daily cycle. Ties are broken by the higher average.',
  },
  {
    id: 'keep_cool',
    label: 'Keep cool',
    metricLabel: 'Hottest hour (°C)',
    description:
      'Lowest maximum inside temperature over the steady daily cycle. Ties are broken by the lower average. The engine has no ventilation or shading, so this mostly rewards envelopes that shed heat by conduction.',
  },
  {
    id: 'stabilize',
    label: 'Stabilize',
    metricLabel: 'Diurnal swing (°C)',
    description:
      'Smallest difference between the hottest and coldest hour. Ties are broken by the lower maximum.',
  },
];

export interface SeriesStats {
  min: number;
  avg: number;
  max: number;
  /** max - min */
  swing: number;
}

/** Numerical tolerance under which two metric values count as tied. */
const TIE_EPSILON = 1e-9;

export function getGoalInfo(goal: DesignGoal): DesignGoalInfo {
  return DESIGN_GOALS.find((g) => g.id === goal) ?? DESIGN_GOALS[0];
}

/** Min / average / max / swing of an inside-temperature series (°C). */
export function computeSeriesStats(temps: number[]): SeriesStats {
  if (temps.length === 0) {
    throw new Error('Cannot compute statistics of an empty temperature series');
  }
  let min = temps[0];
  let max = temps[0];
  let sum = 0;
  for (const t of temps) {
    if (t < min) min = t;
    if (t > max) max = t;
    sum += t;
  }
  return { min, avg: sum / temps.length, max, swing: max - min };
}

/** The value of the goal's primary metric for a set of statistics. */
export function goalMetricValue(goal: DesignGoal, s: SeriesStats): number {
  switch (goal) {
    case 'keep_warm':
      return s.min;
    case 'keep_cool':
      return s.max;
    case 'stabilize':
      return s.swing;
  }
}

/**
 * Comparator: negative when `a` is the better design for the goal.
 *
 * keep_warm : higher min first, tie -> higher avg
 * keep_cool : lower max first,  tie -> lower avg
 * stabilize : lower swing first, tie -> lower max
 */
export function compareStatsByGoal(goal: DesignGoal, a: SeriesStats, b: SeriesStats): number {
  let primary = 0;
  let secondary = 0;
  switch (goal) {
    case 'keep_warm':
      primary = b.min - a.min;
      secondary = b.avg - a.avg;
      break;
    case 'keep_cool':
      primary = a.max - b.max;
      secondary = a.avg - b.avg;
      break;
    case 'stabilize':
      primary = a.swing - b.swing;
      secondary = a.max - b.max;
      break;
  }
  if (Math.abs(primary) > TIE_EPSILON) return primary;
  if (Math.abs(secondary) > TIE_EPSILON) return secondary;
  return 0;
}
