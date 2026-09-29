import React, { useMemo, useState } from 'react';
import { AlertTriangle, Activity, ShieldAlert } from 'lucide-react';
import { useShelter } from '../../context/ShelterContext';
import { getDefaultGoalForRegion } from '../../lib/regionMaterialAvailability';
import {
  DEFAULT_SENSITIVITY_FRACTION,
  SENSITIVITY_FRACTIONS,
  metricForGoal,
  rankRows,
  runSensitivity,
  type SensitivityMetric,
} from '../../lib/sensitivity';

const METRIC_OPTIONS: { id: SensitivityMetric; label: string }[] = [
  { id: 'min', label: 'Coldest hour' },
  { id: 'avg', label: 'Average' },
  { id: 'max', label: 'Hottest hour' },
  { id: 'swing', label: 'Diurnal swing' },
];

const FRACTION_OPTIONS = SENSITIVITY_FRACTIONS.map((f) => ({
  value: f,
  label: `±${Math.round(f * 100)}%`,
}));

function formatDelta(value: number): string {
  const abs = Math.abs(value).toFixed(2);
  if (value > 0) return `+${abs}`;
  if (value < 0) return `−${abs}`;
  return '0.00';
}

function metricLabel(metric: SensitivityMetric): string {
  return METRIC_OPTIONS.find((m) => m.id === metric)?.label ?? metric;
}

export const SensitivityView: React.FC = () => {
  const { config } = useShelter();
  const regionMetric = metricForGoal(getDefaultGoalForRegion(config.activePresetId));
  const [metricOverride, setMetricOverride] = useState<SensitivityMetric | null>(null);
  const metric: SensitivityMetric = metricOverride ?? regionMetric;
  const [fraction, setFraction] = useState<number>(DEFAULT_SENSITIVITY_FRACTION);

  const analysis = useMemo(() => {
    try {
      return { ok: true as const, data: runSensitivity(config, fraction) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Simulation failed';
      return { ok: false as const, error: message };
    }
  }, [config, fraction]);

  const ranked = useMemo(() => {
    if (!analysis.ok) return [];
    return rankRows(analysis.data.rows, metric, analysis.data.base.stats);
  }, [analysis, metric]);

  const maxAbsDelta = useMemo(() => {
    if (!analysis.ok) return 0;
    const baseVal = analysis.data.base.stats[metric];
    let max = 0;
    for (const row of ranked) {
      max = Math.max(
        max,
        Math.abs(row.low.stats[metric] - baseVal),
        Math.abs(row.high.stats[metric] - baseVal)
      );
    }
    return max;
  }, [analysis, ranked, metric]);

  if (!analysis.ok) {
    return (
      <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>Sensitivity analysis could not run: {analysis.error}</span>
      </div>
    );
  }

  const { base } = analysis.data;
  const pct = Math.round(fraction * 100);
  const top = ranked[0];
  const insight =
    top !== undefined
      ? `Largest effect on ${metricLabel(metric)}: ${top.label} (${formatDelta(top.low.stats[metric] - base.stats[metric])} / ${formatDelta(top.high.stats[metric] - base.stats[metric])} °C)`
      : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-bold text-slate-100">Sensitivity</h2>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs leading-relaxed text-amber-200/80">
          One-at-a-time analysis: each input is changed alone; interactions between inputs are not
          shown. The perturbation size is an analysis setting, not a measured uncertainty. Defaults
          are unverified. Absolute temperatures are illustrative.
        </p>
      </div>

      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
          <h3 className="text-sm font-bold text-slate-200">Analysis settings</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="sens-metric" className="text-xs font-semibold text-slate-300">
            Metric
          </label>
          <select
            id="sens-metric"
            value={metric}
            onChange={(e) => setMetricOverride(e.target.value as SensitivityMetric)}
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
          >
            {METRIC_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="sens-fraction" className="text-xs font-semibold text-slate-300">
            Perturbation
          </label>
          <select
            id="sens-fraction"
            value={fraction}
            onChange={(e) => setFraction(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
          >
            {FRACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
          <h3 className="text-sm font-bold text-slate-200">Baseline</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-400 block">Min</span>
            <span className="font-mono text-slate-100">{base.stats.min.toFixed(2)} °C</span>
          </div>
          <div>
            <span className="text-slate-400 block">Avg</span>
            <span className="font-mono text-slate-100">{base.stats.avg.toFixed(2)} °C</span>
          </div>
          <div>
            <span className="text-slate-400 block">Max</span>
            <span className="font-mono text-slate-100">{base.stats.max.toFixed(2)} °C</span>
          </div>
          <div>
            <span className="text-slate-400 block">Swing</span>
            <span className="font-mono text-slate-100">{base.stats.swing.toFixed(2)} °C</span>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 font-mono">
          {base.daysSimulated} days simulated · residual {base.residualC.toFixed(4)} °C
        </p>
        {!base.converged && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Base simulation did not converge.
          </div>
        )}
      </div>

      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
          <h3 className="text-sm font-bold text-slate-200">Tornado</h3>
        </div>
        <div className="space-y-3">
          {ranked.map((row) => {
            const lowDelta = row.low.stats[metric] - base.stats[metric];
            const highDelta = row.high.stats[metric] - base.stats[metric];
            const scale = maxAbsDelta > 0 ? 100 / maxAbsDelta : 0;
            const eitherUnconverged = !row.low.converged || !row.high.converged;
            return (
              <div key={row.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-200">{row.label}</span>
                  <span className="font-mono text-slate-400">
                    {formatDelta(lowDelta)} / {formatDelta(highDelta)} °C
                    {eitherUnconverged ? ' · not converged' : ''}
                  </span>
                </div>
                <TornadoPair
                  lowDelta={lowDelta}
                  highDelta={highDelta}
                  scale={scale}
                />
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-1.5 rounded bg-sky-400" /> −{pct}%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-1.5 rounded bg-amber-400" /> +{pct}%
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/90 shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          <caption className="sr-only">
            Sensitivity deltas at minus and plus {pct} percent for each input
          </caption>
          <thead>
            <tr className="border-b border-slate-800 bg-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-3">Input</th>
              <th className="py-3 px-3">Delta at −{pct}%</th>
              <th className="py-3 px-3">Delta at +{pct}%</th>
              <th className="py-3 px-3">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {ranked.map((row) => {
              const lowDelta = row.low.stats[metric] - base.stats[metric];
              const highDelta = row.high.stats[metric] - base.stats[metric];
              const notes = [row.low.note, row.high.note].filter(Boolean).join('; ');
              return (
                <tr key={row.id} className="text-slate-300">
                  <td className="py-3 px-3 font-sans text-slate-200">{row.label}</td>
                  <td className="py-3 px-3 font-mono">{formatDelta(lowDelta)} °C</td>
                  <td className="py-3 px-3 font-mono">{formatDelta(highDelta)} °C</td>
                  <td className="py-3 px-3 text-slate-400">{notes || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {insight && (
        <div className="px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-200">
          {insight}
        </div>
      )}
    </div>
  );
};

const TornadoPair: React.FC<{
  lowDelta: number;
  highDelta: number;
  scale: number;
}> = ({ lowDelta, highDelta, scale }) => {
  return (
    <div className="space-y-0.5">
      <TornadoBar delta={lowDelta} scale={scale} colorClass="bg-sky-400" />
      <TornadoBar delta={highDelta} scale={scale} colorClass="bg-amber-400" />
    </div>
  );
};

const TornadoBar: React.FC<{
  delta: number;
  scale: number;
  colorClass: string;
}> = ({ delta, scale, colorClass }) => {
  const widthPct = Math.min(100, Math.abs(delta) * scale);
  return (
    <div className="flex h-1.5 w-full">
      <div className="w-1/2 flex justify-end">
        {delta < 0 && (
          <div className={`${colorClass} h-full rounded-l-sm`} style={{ width: `${widthPct}%` }} />
        )}
      </div>
      <div className="w-px bg-slate-600" />
      <div className="w-1/2">
        {delta > 0 && (
          <div className={`${colorClass} h-full rounded-r-sm`} style={{ width: `${widthPct}%` }} />
        )}
      </div>
    </div>
  );
};
