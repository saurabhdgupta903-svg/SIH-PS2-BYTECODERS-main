import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileText, Info, Printer } from 'lucide-react';
import { useShelter } from '../../context/ShelterContext';
import {
  DEFAULT_AIR_DENSITY,
  DEFAULT_AIR_SPECIFIC_HEAT,
  DEFAULT_ENGINE_NOTICE,
  DEFAULT_H_EXTERIOR,
  DEFAULT_H_INTERIOR,
  DEFAULT_INFILTRATION_RATE,
  DEFAULT_SKY_TEMP_OFFSET_C,
  DEFAULT_TIME_STEP_SECONDS,
} from '../../lib/engineDefaults';
import {
  candidateGoalMetric,
  defaultMaxTotalWallThickness_m,
  evaluateBaseline,
  evaluateCandidate,
  generateCandidates,
  gridEdgeNotes,
  rankCandidates,
  type EvaluatedCandidate,
} from '../../lib/designSearch';
import {
  getAvailableMaterialsForRegion,
  getDefaultGoalForRegion,
} from '../../lib/regionMaterialAvailability';
import { getGoalInfo, type DesignGoal } from '../../lib/rankingObjectives';
import {
  DEFAULT_SENSITIVITY_FRACTION,
  metricForGoal,
  rankRows,
  runSensitivity,
  type SensitivityRow,
} from '../../lib/sensitivity';
import type { ShelterConfig, WallLayer } from '../../types/shelter';

const ENGINE_DEFAULTS: { name: string; value: string }[] = [
  { name: 'DEFAULT_TIME_STEP_SECONDS', value: `${DEFAULT_TIME_STEP_SECONDS} s` },
  { name: 'DEFAULT_INFILTRATION_RATE', value: `${DEFAULT_INFILTRATION_RATE} m³/s` },
  { name: 'DEFAULT_AIR_DENSITY', value: `${DEFAULT_AIR_DENSITY} kg/m³` },
  { name: 'DEFAULT_AIR_SPECIFIC_HEAT', value: `${DEFAULT_AIR_SPECIFIC_HEAT} J/(kg·K)` },
  { name: 'DEFAULT_H_INTERIOR', value: `${DEFAULT_H_INTERIOR} W/(m²·K)` },
  { name: 'DEFAULT_H_EXTERIOR', value: `${DEFAULT_H_EXTERIOR} W/(m²·K)` },
  { name: 'DEFAULT_SKY_TEMP_OFFSET_C', value: `${DEFAULT_SKY_TEMP_OFFSET_C} °C` },
];

function formatDelta(value: number): string {
  const abs = Math.abs(value).toFixed(2);
  if (value > 0) return `+${abs}`;
  if (value < 0) return `−${abs}`;
  return '0.00';
}

function describeLayers(layers: WallLayer[], config: ShelterConfig): { material: string; thickness_mm: number; k: string }[] {
  return layers.map((layer) => {
    const mat = config.materialsLibrary.find((m) => m.id === layer.materialId);
    return {
      material: mat?.name ?? layer.materialId,
      thickness_mm: Math.round(layer.thickness_m * 1000),
      k: mat !== undefined ? `${mat.conductivity_k}` : '—',
    };
  });
}

function openingCount(config: ShelterConfig): number {
  return config.geometry.openings.reduce((sum, o) => sum + o.count, 0);
}

interface ReportOk {
  ok: true;
  generatedAt: string;
  ambient: { min: number; avg: number; max: number; peakIrradiance: number };
  current: EvaluatedCandidate;
  top: EvaluatedCandidate[];
  evaluatedCount: number;
  goal: DesignGoal;
  goalLabel: string;
  goalMetricLabel: string;
  edgeNotes: string[];
  sensitivityRows: SensitivityRow[];
  metric: ReturnType<typeof metricForGoal>;
  baseMetric: number;
}

type ReportState = { ok: false; error: string } | ReportOk;

function buildReport(config: ShelterConfig): ReportState {
  const profile = config.ambientClimate.hourlyProfile;
  const temps = profile.map((p) => p.temperature_C);
  const irrad = profile.map((p) => p.irradiance_wm2);
  const ambientAvg = temps.length === 0 ? 0 : temps.reduce((s, t) => s + t, 0) / temps.length;

  const goal = getDefaultGoalForRegion(config.activePresetId);
  const goalInfo = getGoalInfo(goal);
  const metric = metricForGoal(goal);
  const maxWall = defaultMaxTotalWallThickness_m(config);

  const current = evaluateBaseline(config);
  if (current.error) {
    throw new Error(current.error);
  }

  const generated = generateCandidates(
    config,
    getAvailableMaterialsForRegion(config.activePresetId),
    false,
    { maxTotalWallThickness_m: maxWall }
  );
  const evaluated = generated.candidates.map((c) => evaluateCandidate(c));
  const ranked = rankCandidates(evaluated, goal);
  const top = ranked.slice(0, 3);
  const winner = ranked[0];
  const edgeNotes = winner ? gridEdgeNotes(winner, maxWall) : [];

  const sensitivity = runSensitivity(config, DEFAULT_SENSITIVITY_FRACTION);
  const sensitivityRows = rankRows(sensitivity.rows, metric, sensitivity.base.stats).slice(0, 5);

  return {
    ok: true,
    generatedAt: new Date().toLocaleString(),
    ambient: {
      min: temps.length === 0 ? 0 : Math.min(...temps),
      avg: ambientAvg,
      max: temps.length === 0 ? 0 : Math.max(...temps),
      peakIrradiance: irrad.length === 0 ? 0 : Math.max(...irrad),
    },
    current,
    top,
    evaluatedCount: generated.evaluatedCount,
    goal,
    goalLabel: goalInfo.label,
    goalMetricLabel: goalInfo.metricLabel,
    edgeNotes,
    sensitivityRows,
    metric,
    baseMetric: sensitivity.base.stats[metric],
  };
}

export const ReportView: React.FC = () => {
  const { config } = useShelter();
  const [snapshot, setSnapshot] = useState<ShelterConfig | null>(null);

  useEffect(() => {
    setSnapshot(null);
    const id = window.setTimeout(() => setSnapshot(config), 0);
    return () => window.clearTimeout(id);
  }, [config]);

  const report = useMemo(() => {
    if (!snapshot) return null;
    try {
      return buildReport(snapshot);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Simulation failed';
      return { ok: false as const, error: message };
    }
  }, [snapshot]);

  if (!report) {
    return <p className="text-sm text-slate-400">Preparing report...</p>;
  }

  if (!report.ok) {
    return (
      <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>Report could not be generated: {report.error}</span>
      </div>
    );
  }

  const climate = config.ambientClimate;
  const wallRows = describeLayers(config.wallLayers, config);
  const roofRows = describeLayers(config.roofLayers, config);
  const { geometry } = config;

  return (
    <div className="space-y-8">
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
        <div>
          <p className="text-xs text-slate-400">Choose “Save as PDF” in the print dialog.</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-palette-pink-red hover:bg-palette-pink-red/90 text-white text-xs font-bold shadow-md shadow-palette-pink-red/20 transition-all"
          onClick={() => window.print()}
        >
          <Printer className="w-4 h-4" />
          Print / Save as PDF
        </button>
      </div>

      <article className="ts-report space-y-6 text-sm text-slate-300">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <FileText className="w-5 h-5 text-palette-yellow" />
            <h1 className="text-base font-bold text-slate-100">SHELTER-X / ThermoShelter Designer — Thermal Performance Report</h1>
          </div>
          <p className="text-slate-200">{climate.regionName}</p>
          <p className="text-xs text-slate-400">{climate.dateSeasonLabel}</p>
          <p className="text-xs font-mono text-slate-400">
            Latitude {climate.latitude} · Longitude {climate.longitude}
          </p>
          <p className="text-xs text-slate-400">Generated {report.generatedAt}</p>
        </div>

        <section className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <h2 className="text-sm font-bold text-slate-200 pb-2 border-b border-slate-800">Ambient climate</h2>
          <p className="font-mono text-xs text-slate-300">
            Min {report.ambient.min.toFixed(2)} °C · Avg {report.ambient.avg.toFixed(2)} °C · Max{' '}
            {report.ambient.max.toFixed(2)} °C · Peak irradiance {report.ambient.peakIrradiance.toFixed(2)} W/m²
          </p>
        </section>

        <section className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <h2 className="text-sm font-bold text-slate-200 pb-2 border-b border-slate-800">Design</h2>
          <LayerTable title="Wall layers" rows={wallRows} />
          <LayerTable title="Roof layers" rows={roofRows} />
          <p className="text-xs text-slate-300">
            Footprint {geometry.length_m.toFixed(2)} m × {geometry.width_m.toFixed(2)} m · Height{' '}
            {geometry.height_m.toFixed(2)} m · Orientation {geometry.orientation_deg}° · Openings {openingCount(config)}
          </p>
        </section>

        <section className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <h2 className="text-sm font-bold text-slate-200 pb-2 border-b border-slate-800">Simulated performance</h2>
          <p className="font-mono text-xs text-slate-300">
            Min {report.current.min.toFixed(2)} °C · Avg {report.current.avg.toFixed(2)} °C · Max{' '}
            {report.current.peak.toFixed(2)} °C · Swing {report.current.swing.toFixed(2)} °C
          </p>
          <p className="text-xs text-slate-400 font-mono">
            Days to converge {report.current.daysSimulated} · Residual {report.current.residualC.toFixed(4)} °C ·
            Converged {report.current.converged ? 'yes' : 'no'}
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/90 shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <caption className="sr-only">Engine default parameters</caption>
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3">Parameter</th>
                  <th className="py-3 px-3">Value</th>
                  <th className="py-3 px-3">Notice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {ENGINE_DEFAULTS.map((row) => (
                  <tr key={row.name} className="text-slate-300">
                    <td className="py-3 px-3 font-mono text-xs">{row.name}</td>
                    <td className="py-3 px-3 font-mono">{row.value}</td>
                    <td className="py-3 px-3 text-xs text-amber-200/80">{DEFAULT_ENGINE_NOTICE}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <h2 className="text-sm font-bold text-slate-200 pb-2 border-b border-slate-800">Recommended design</h2>
          <p className="text-xs text-slate-400">
            Goal: {report.goalLabel} ({report.goalMetricLabel}). Designs evaluated: {report.evaluatedCount}.
          </p>
          {report.edgeNotes.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                The top-ranked design is on the edge of the search grid: {report.edgeNotes.join('; ')}.
              </span>
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/90 shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <caption className="sr-only">Current design and top recommended designs</caption>
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3">Design</th>
                  <th className="py-3 px-3">Wall assembly</th>
                  <th className="py-3 px-3">Dimensions</th>
                  <th className="py-3 px-3">Min / Avg / Max</th>
                  <th className="py-3 px-3">Swing</th>
                  <th className="py-3 px-3">Goal metric</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                <DesignRow label="Current" candidate={report.current} goal={report.goal} />
                {report.top.map((c, i) => (
                  <DesignRow key={c.id} label={`#${i + 1}`} candidate={c} goal={report.goal} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <h2 className="text-sm font-bold text-slate-200 pb-2 border-b border-slate-800">Sensitivity</h2>
          <p className="text-xs text-slate-400">Top 5 inputs by effect on {report.goalMetricLabel} at ±25%.</p>
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/90 shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <caption className="sr-only">Sensitivity top five inputs</caption>
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3">Input</th>
                  <th className="py-3 px-3">Delta at −25%</th>
                  <th className="py-3 px-3">Delta at +25%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {report.sensitivityRows.map((row) => {
                  const lowDelta = row.low.stats[report.metric] - report.baseMetric;
                  const highDelta = row.high.stats[report.metric] - report.baseMetric;
                  return (
                    <tr key={row.id} className="text-slate-300">
                      <td className="py-3 px-3 font-sans text-slate-200">{row.label}</td>
                      <td className="py-3 px-3">{formatDelta(lowDelta)} °C</td>
                      <td className="py-3 px-3">{formatDelta(highDelta)} °C</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <h2 className="text-sm font-bold text-slate-200 pb-2 border-b border-slate-800">Assumptions and limitations</h2>
          <ul className="list-disc pl-5 space-y-1 text-xs text-slate-400 leading-relaxed">
            <li>Orientation and openings are held fixed in the design search.</li>
            <li>Floor / ground conduction is unmodeled.</li>
            <li>
              Solar gain is applied directly to the interior node, so absolute temperatures are illustrative.
            </li>
            <li>Default sky temperature offset and film coefficients are used.</li>
            <li>Performance is a steady daily cycle, not a transient start-up.</li>
            <li>Sample presets are not validated (demo only).</li>
            <li>All material values need verification before deployment.</li>
          </ul>
        </section>
      </article>
    </div>
  );
};

const LayerTable: React.FC<{
  title: string;
  rows: { material: string; thickness_mm: number; k: string }[];
}> = ({ title, rows }) => (
  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/90 shadow-sm">
    <table className="w-full text-left text-xs border-collapse">
      <caption className="text-left font-semibold text-slate-300 px-3 py-2">{title}</caption>
      <thead>
        <tr className="border-b border-slate-800 bg-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          <th className="py-3 px-3">Material</th>
          <th className="py-3 px-3">Thickness (mm)</th>
          <th className="py-3 px-3">k (W/m·K)</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800/60">
        {rows.map((row, i) => (
          <tr key={`${row.material}-${i}`} className="text-slate-300">
            <td className="py-3 px-3 text-slate-200">{row.material}</td>
            <td className="py-3 px-3 font-mono">{row.thickness_mm}</td>
            <td className="py-3 px-3 font-mono">{row.k}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const DesignRow: React.FC<{
  label: string;
  candidate: EvaluatedCandidate;
  goal: DesignGoal;
}> = ({ label, candidate, goal }) => (
  <tr className="text-slate-300">
    <td className="py-3 px-3 font-sans font-medium text-slate-100">{label}</td>
    <td className="py-3 px-3 font-sans text-slate-200">{candidate.wallDescription}</td>
    <td className="py-3 px-3 font-mono">{candidate.dimensionsDescription}</td>
    <td className="py-3 px-3 font-mono">
      {candidate.min.toFixed(2)} / {candidate.avg.toFixed(2)} / {candidate.peak.toFixed(2)} °C
    </td>
    <td className="py-3 px-3 font-mono">{candidate.swing.toFixed(2)} °C</td>
    <td className="py-3 px-3 font-mono">{candidateGoalMetric(candidate, goal).toFixed(2)}</td>
  </tr>
);
