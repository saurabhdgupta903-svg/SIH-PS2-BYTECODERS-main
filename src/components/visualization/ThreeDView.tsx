import React, { useMemo } from 'react';
import { Box, AlertTriangle, ShieldAlert, Info } from 'lucide-react';
import { useShelter } from '../../context/ShelterContext';
import { simulateSteadyCycle } from '../../lib/simulateSteadyCycle';
import {
  DEFAULT_TIME_STEP_SECONDS,
  DEFAULT_INFILTRATION_RATE,
  DEFAULT_AIR_DENSITY,
  DEFAULT_AIR_SPECIFIC_HEAT,
  DEFAULT_H_INTERIOR,
  DEFAULT_H_EXTERIOR,
  DEFAULT_SKY_TEMP_OFFSET_C,
} from '../../lib/engineDefaults';
import { ShelterViewer } from './ShelterViewer';

export const ThreeDView: React.FC = () => {
  const { config } = useShelter();

  // Run thermal simulation identically to ResultsView.tsx
  const { simulationResults, simulationMeta, simulationError } = useMemo(() => {
    try {
      if (!config.ambientClimate.hourlyProfile || config.ambientClimate.hourlyProfile.length === 0) {
        throw new Error('Ambient climate profile has no hourly data points.');
      }

      const steady = simulateSteadyCycle(
        config,
        DEFAULT_TIME_STEP_SECONDS,
        DEFAULT_INFILTRATION_RATE,
        DEFAULT_AIR_DENSITY,
        DEFAULT_AIR_SPECIFIC_HEAT,
        DEFAULT_H_INTERIOR,
        DEFAULT_H_EXTERIOR,
        DEFAULT_SKY_TEMP_OFFSET_C
      );

      return {
        simulationResults: steady.series,
        simulationMeta: {
          daysSimulated: steady.daysSimulated,
          converged: steady.converged,
          residualC: steady.residualC,
        },
        simulationError: null,
      };
    } catch (err: unknown) {
      console.error('3D View simulation execution failed:', err);
      const message =
        err instanceof Error ? err.message : 'An unexpected calculation error occurred.';
      return { simulationResults: null, simulationMeta: null, simulationError: message };
    }
  }, [config]);

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Box className="w-5 h-5 text-amber-400" />
            <span>Parametric 3D Shelter Visualizer</span>
          </h2>
          <p className="text-xs text-slate-400">
            Real-time interactive 3D envelope render with simulated diurnal temperature mapping and layer inspection.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto font-mono text-xs text-slate-300">
          <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
            Shape: <strong className="text-amber-400 font-bold">{config.geometry.shape}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
            Azimuth: <strong className="text-amber-400 font-bold">{config.geometry.orientation_deg}°</strong>
          </span>
        </div>
      </div>

      {/* Mandatory Disclosure Banner (Feature 11) */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 shadow-sm">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-amber-100">
            Schematic visualization. Colors reflect simulated inside temperature from default engineering values — verify before deployment.
          </p>
          <p className="text-[11px] text-amber-300/80">
            Thermal behavior corresponds to unconditioned lumped-capacitance transient response driven by the 24-hour ambient climate profile.
          </p>
        </div>
      </div>

      {/* Steady Daily Cycle Banner */}
      {simulationMeta && (
        <div
          className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
            simulationMeta.converged
              ? 'bg-slate-900/80 border-slate-800 text-slate-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
          }`}
        >
          {simulationMeta.converged ? (
            <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <p className="leading-relaxed">
              Steady daily cycle: the 24 h climate profile is repeated for {simulationMeta.daysSimulated} days until the day-to-day change is below 0.01 °C. Assumes the daily climate repeats.
              <span className="font-mono ml-2 text-slate-400">
                (Residual: {simulationMeta.residualC.toFixed(4)} °C)
              </span>
            </p>
            {!simulationMeta.converged && (
              <p className="text-amber-400 font-semibold">
                Warning: Steady daily cycle did not fully converge within 60 days limit (residual: {simulationMeta.residualC.toFixed(4)} °C).
              </p>
            )}
          </div>
        </div>
      )}

      {/* Simulation Error State (Matching ResultsView style) */}
      {simulationError && (
        <div className="p-6 rounded-2xl bg-rose-950/30 border border-rose-500/40 text-rose-200 space-y-3 shadow-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            <h3 className="font-bold text-sm">Simulation Calculation Failure</h3>
          </div>
          <p className="text-xs text-slate-300">
            The thermal engine was unable to compute temperature projections for the current configuration:
          </p>
          <pre className="p-3 rounded-lg bg-slate-950 border border-rose-500/30 font-mono text-xs text-rose-300 whitespace-pre-wrap">
            {simulationError}
          </pre>
          <p className="text-[11px] text-slate-400">
            Please check that valid wall/roof layers and ambient climate points are defined in the Inputs tab.
          </p>
        </div>
      )}

      {/* Render Pure ShelterViewer when Simulation Succeeds */}
      {simulationResults && (
        <ShelterViewer config={config} simulation={simulationResults} />
      )}
    </div>
  );
};
