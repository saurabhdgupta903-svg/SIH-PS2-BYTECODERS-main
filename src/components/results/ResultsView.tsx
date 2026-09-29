import React, { useState, useMemo, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  Activity,
  AlertTriangle,
  Flame,
  Sun,
  ShieldAlert,
  RotateCw,
  Gauge,
  Info,
  ChevronDown,
  ChevronUp,
  Table as TableIcon,
  ArrowRightLeft,
} from 'lucide-react';
import { useShelter } from '../../context/ShelterContext';
import { simulateSteadyCycle } from '../../lib/simulateSteadyCycle';
import {
  DEFAULT_ENGINE_NOTICE,
  DEFAULT_INFILTRATION_RATE,
  DEFAULT_AIR_DENSITY,
  DEFAULT_AIR_SPECIFIC_HEAT,
  DEFAULT_H_INTERIOR,
  DEFAULT_H_EXTERIOR,
  DEFAULT_SKY_TEMP_OFFSET_C,
  DEFAULT_TIME_STEP_SECONDS,
} from '../../lib/engineDefaults';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export const ResultsView: React.FC = () => {
  const { config } = useShelter();
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [showParameters, setShowParameters] = useState<boolean>(false);
  const [showDataTable, setShowDataTable] = useState<boolean>(false);

  // Derive simulation results reactively from current configuration
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
      console.error('Simulation execution failed:', err);
      const message =
        err instanceof Error ? err.message : 'An unexpected calculation error occurred.';
      return { simulationResults: null, simulationMeta: null, simulationError: message };
    }
  }, [config]);

  // Re-run simulation trigger with tactile feedback
  const handleReRun = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 250);
  }, []);

  // Compute summary metrics for the 3 REQUIRED outputs
  const summaryMetrics = useMemo(() => {
    if (!simulationResults || simulationResults.length === 0) return null;

    const insideTemps = simulationResults.map((r) => r.tempC);
    const ambientTemps = config.ambientClimate.hourlyProfile.map((p) => p.temperature_C);

    // Output 1: Predicted indoor temperature statistics
    const peakInside = Math.max(...insideTemps);
    const peakHour = simulationResults.findIndex((r) => r.tempC === peakInside);
    const minInside = Math.min(...insideTemps);
    const minHour = simulationResults.findIndex((r) => r.tempC === minInside);
    const avgInside = insideTemps.reduce((a, b) => a + b, 0) / insideTemps.length;

    const peakAmbient = Math.max(...ambientTemps);
    const minAmbient = Math.min(...ambientTemps);
    const avgAmbient = ambientTemps.reduce((a, b) => a + b, 0) / ambientTemps.length;

    const insideSwing = peakInside - minInside;
    const ambientSwing = peakAmbient - minAmbient;
    const dampingPercent = ambientSwing > 0 ? Math.max(0, (1 - insideSwing / ambientSwing) * 100) : 0;

    // Output 2: Solar thermal energy generated
    // Joules = Σ(Q_absorbed * Δt), Wh = Joules / 3600, kWh = Wh / 1000
    const totalSolarJoules = simulationResults.reduce(
      (sum, r) => sum + r.qAbsorbed * DEFAULT_TIME_STEP_SECONDS,
      0
    );
    const totalSolarWh = totalSolarJoules / 3600;
    const totalSolarKWh = totalSolarWh / 1000;
    const peakSolarWatts = Math.max(...simulationResults.map((r) => r.qAbsorbed));

    // Output 3: Heat flow over defined time period (ambient vs shelter difference)
    // Envelope conduction heat flow: Q_loss = U * A * (T_in - T_ambient)
    const totalLossJoules = simulationResults.reduce(
      (sum, r) => sum + r.qLoss * DEFAULT_TIME_STEP_SECONDS,
      0
    );
    const totalLossWh = totalLossJoules / 3600;
    const totalLossKWh = totalLossWh / 1000;
    const avgHeatFlowWatts = totalLossJoules / (24 * 3600); // 24-hour mean rate in Watts

    // Combined all losses (conduction + infiltration + radiative)
    const totalCombinedLossJoules = simulationResults.reduce(
      (sum, r) => sum + (r.qLoss + r.qInfiltration + r.qRadiative) * DEFAULT_TIME_STEP_SECONDS,
      0
    );
    const totalCombinedLossKWh = totalCombinedLossJoules / (3600 * 1000);

    const deltaTemps = simulationResults.map((r, i) => r.tempC - (config.ambientClimate.hourlyProfile[i]?.temperature_C ?? 0));
    const avgDeltaT = deltaTemps.reduce((a, b) => a + b, 0) / deltaTemps.length;
    const maxDeltaT = Math.max(...deltaTemps);

    return {
      peakInside,
      peakHour,
      minInside,
      minHour,
      avgInside,
      peakAmbient,
      minAmbient,
      avgAmbient,
      insideSwing,
      ambientSwing,
      dampingPercent,
      totalSolarWh,
      totalSolarKWh,
      peakSolarWatts,
      totalLossWh,
      totalLossKWh,
      avgHeatFlowWatts,
      totalCombinedLossKWh,
      avgDeltaT,
      maxDeltaT,
    };
  }, [simulationResults, config.ambientClimate.hourlyProfile]);

  // Data for Temperature Chart (Inside = #FF467A, Ambient = #FFD51E)
  const temperatureChartData = useMemo(() => {
    if (!simulationResults) return null;

    const labels = simulationResults.map((r) => {
      const h = Math.floor(r.time / 3600) % 24;
      return `${String(h).padStart(2, '0')}:00`;
    });

    const insideData = simulationResults.map((r) => Number(r.tempC.toFixed(2)));
    const ambientData = simulationResults.map((r) => {
      const h = Math.floor(r.time / 3600) % config.ambientClimate.hourlyProfile.length;
      return Number(config.ambientClimate.hourlyProfile[h]?.temperature_C.toFixed(2) ?? 0);
    });

    return {
      labels,
      datasets: [
        {
          label: 'Inside Temperature (°C)',
          data: insideData,
          borderColor: '#FF467A', // Palette Pink-Red
          backgroundColor: 'rgba(255, 70, 122, 0.12)',
          borderWidth: 2.5,
          tension: 0.4,
          cubicInterpolationMode: 'monotone' as const,
          pointRadius: 1,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: '#FF467A',
          pointHoverBorderColor: '#F4EFFF',
          pointHoverBorderWidth: 2,
          fill: true,
        },
        {
          label: 'Ambient Outside (°C)',
          data: ambientData,
          borderColor: '#FFD51E', // Palette Yellow
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 4],
          tension: 0.4,
          cubicInterpolationMode: 'monotone' as const,
          pointRadius: 1,
          pointHoverRadius: 4.5,
          pointHoverBackgroundColor: '#FFD51E',
          pointHoverBorderColor: '#0D0620',
          pointHoverBorderWidth: 2,
        },
      ],
    };
  }, [simulationResults, config.ambientClimate.hourlyProfile]);

  // Data for Heat Flow Chart (Solar = #FFD51E, Loss = #FF467A, Combined/Rad = #AB03A9)
  const heatFlowChartData = useMemo(() => {
    if (!simulationResults) return null;

    const labels = simulationResults.map((r) => {
      const h = Math.floor(r.time / 3600) % 24;
      return `${String(h).padStart(2, '0')}:00`;
    });

    return {
      labels,
      datasets: [
        {
          label: 'Solar Heat Gain Q_absorbed (W)',
          data: simulationResults.map((r) => Math.round(r.qAbsorbed)),
          borderColor: '#FFD51E', // Yellow
          backgroundColor: 'rgba(255, 213, 30, 0.08)',
          borderWidth: 2,
          pointRadius: 1,
          pointHoverRadius: 4.5,
          tension: 0.4,
          cubicInterpolationMode: 'monotone' as const,
        },
        {
          label: 'Envelope Conduction Q_loss (W)',
          data: simulationResults.map((r) => Math.round(r.qLoss)),
          borderColor: '#FF467A', // Pink-red
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 1,
          pointHoverRadius: 4.5,
          tension: 0.4,
          cubicInterpolationMode: 'monotone' as const,
        },
        {
          label: 'Infiltration Loss Q_infil (W)',
          data: simulationResults.map((r) => Math.round(r.qInfiltration)),
          borderColor: '#B9AEDB', // Lavender grey
          backgroundColor: 'transparent',
          borderWidth: 1.8,
          pointRadius: 1,
          pointHoverRadius: 4.5,
          tension: 0.4,
          cubicInterpolationMode: 'monotone' as const,
        },
        {
          label: 'Sky Radiative Loss Q_rad (W)',
          data: simulationResults.map((r) => Math.round(r.qRadiative)),
          borderColor: '#AB03A9', // Magenta
          backgroundColor: 'transparent',
          borderWidth: 1.8,
          pointRadius: 1,
          pointHoverRadius: 4.5,
          tension: 0.4,
          cubicInterpolationMode: 'monotone' as const,
        },
      ],
    };
  }, [simulationResults]);

  // Chart display options with subtle violet grid lines and dark tooltip
  const baseChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#B9AEDB',
          font: { size: 11, weight: 500 },
          usePointStyle: true,
          boxWidth: 8,
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: '#160B30',
        borderColor: '#2D1B54',
        borderWidth: 1,
        titleColor: '#F4EFFF',
        bodyColor: '#B9AEDB',
        titleFont: { size: 12, weight: 'bold' as const },
        bodyFont: { size: 11 },
        padding: 12,
        boxPadding: 6,
        usePointStyle: true,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(80, 3, 192, 0.12)' },
        ticks: { color: '#B9AEDB', font: { size: 11, weight: 'normal' as const } },
        title: {
          display: true,
          text: 'Hour of Diurnal Cycle (0:00 – 23:00)',
          color: '#F4EFFF',
          font: { size: 11, weight: 'bold' as const },
        },
      },
      y: {
        grid: { color: 'rgba(80, 3, 192, 0.12)' },
        ticks: { color: '#B9AEDB', font: { size: 11, weight: 'normal' as const } },
      },
    },
  };

  const tempChartOptions = {
    ...baseChartOptions,
    scales: {
      ...baseChartOptions.scales,
      y: {
        ...baseChartOptions.scales.y,
        title: {
          display: true,
          text: 'Air Temperature (°C)',
          color: '#F4EFFF',
          font: { size: 11, weight: 'bold' as const },
        },
      },
    },
  };

  const heatFlowChartOptions = {
    ...baseChartOptions,
    scales: {
      ...baseChartOptions.scales,
      y: {
        ...baseChartOptions.scales.y,
        title: {
          display: true,
          text: 'Heat Transfer Rate (W)',
          color: '#F4EFFF',
          font: { size: 11, weight: 'bold' as const },
        },
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-palette-card border border-palette-border">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-palette-yellow" />
            <h2 className="text-base font-bold text-palette-text-primary">
              Thermal Simulation Results & Core Decision Metrics
            </h2>
          </div>
          <p className="text-xs text-palette-text-secondary mt-0.5">
            Region: <strong className="text-palette-text-primary">{config.ambientClimate.regionName}</strong> &bull;{' '}
            {config.ambientClimate.dateSeasonLabel} (24-Hour Diurnal Model)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReRun}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-palette-violet hover:bg-palette-violet-hover disabled:opacity-40 text-palette-text-primary text-xs font-semibold shadow-sm transition-all"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Calculating...' : 'Re-run Simulation'}</span>
          </button>
        </div>
      </div>

      {/* Mandatory Engineering Reference Values Banner */}
      <div className="p-4 rounded-xl bg-palette-card border border-palette-border text-palette-text-secondary flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-palette-yellow shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-palette-text-primary">
            Results calculated using default engineering reference values for infiltration and convection — verify before relying on exact figures.
          </p>
          <p className="text-palette-text-secondary leading-relaxed">
            The numerical simulation employs standard reference constants for interior/exterior film coefficients,
            nocturnal clear-sky depression, and background air infiltration.
          </p>
          <button
            type="button"
            onClick={() => setShowParameters(!showParameters)}
            className="inline-flex items-center gap-1 mt-1 text-palette-yellow hover:underline font-medium"
          >
            <span>{showParameters ? 'Hide assumed parameters' : 'Inspect assumed reference parameters'}</span>
            {showParameters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Collapsible Reference Parameters Table */}
      {showParameters && (
        <div className="p-4 rounded-xl bg-palette-card border border-palette-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-palette-text-secondary uppercase tracking-wider">
              Assumed Engine Parameters ({DEFAULT_ENGINE_NOTICE})
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-palette-raised border border-palette-border">
              <span className="text-palette-text-muted block text-[11px] font-sans">Infiltration Rate (V̇)</span>
              <span className="text-palette-text-primary font-semibold">{DEFAULT_INFILTRATION_RATE} m³/s</span>
            </div>
            <div className="p-2.5 rounded-lg bg-palette-raised border border-palette-border">
              <span className="text-palette-text-muted block text-[11px] font-sans">Air Density (ρ)</span>
              <span className="text-palette-text-primary font-semibold">{DEFAULT_AIR_DENSITY} kg/m³</span>
            </div>
            <div className="p-2.5 rounded-lg bg-palette-raised border border-palette-border">
              <span className="text-palette-text-muted block text-[11px] font-sans">Air Specific Heat (c_p)</span>
              <span className="text-palette-text-primary font-semibold">{DEFAULT_AIR_SPECIFIC_HEAT} J/(kg·K)</span>
            </div>
            <div className="p-2.5 rounded-lg bg-palette-raised border border-palette-border">
              <span className="text-palette-text-muted block text-[11px] font-sans">Interior Film (h_i)</span>
              <span className="text-palette-text-primary font-semibold">{DEFAULT_H_INTERIOR} W/(m²·K)</span>
            </div>
            <div className="p-2.5 rounded-lg bg-palette-raised border border-palette-border">
              <span className="text-palette-text-muted block text-[11px] font-sans">Exterior Film (h_o)</span>
              <span className="text-palette-text-primary font-semibold">{DEFAULT_H_EXTERIOR} W/(m²·K)</span>
            </div>
            <div className="p-2.5 rounded-lg bg-palette-raised border border-palette-border">
              <span className="text-palette-text-muted block text-[11px] font-sans">Sky Temp Offset (ΔT_sky)</span>
              <span className="text-palette-text-primary font-semibold">{DEFAULT_SKY_TEMP_OFFSET_C} °C below ambient</span>
            </div>
          </div>
        </div>
      )}

      {/* Steady Daily Cycle Banner */}
      {simulationMeta && (
        <div className="p-3.5 rounded-xl border border-palette-border bg-palette-card flex items-start gap-2.5 text-xs text-palette-text-secondary">
          <Info className="w-4 h-4 text-palette-yellow shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="leading-relaxed">
              Steady daily cycle: the 24 h climate profile converged in {simulationMeta.daysSimulated} day cycles.
              <span className="font-mono ml-2 text-palette-text-muted">
                (Residual: {simulationMeta.residualC.toFixed(4)} °C)
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {simulationError && (
        <div className="p-4 rounded-xl bg-palette-card border border-palette-pink-red text-palette-pink-red flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-palette-pink-red shrink-0" />
          <div className="text-xs">
            <span className="font-semibold block">Simulation Failed:</span>
            <span>{simulationError}</span>
          </div>
        </div>
      )}

      {/* Loading Overlay State */}
      {isRefreshing && (
        <div className="p-12 text-center rounded-2xl bg-palette-card border border-palette-border space-y-3 animate-pulse">
          <RotateCw className="w-8 h-8 text-palette-yellow mx-auto animate-spin" />
          <p className="text-sm font-medium text-palette-text-primary">Integrating 24-hour thermal transient equations...</p>
          <p className="text-xs text-palette-text-secondary">Evaluating multi-layer conduction, solar flux, infiltration, and sky radiation</p>
        </div>
      )}

      {/* THE 3 REQUIRED MODEL OUTPUTS DASHBOARD */}
      {!isRefreshing && summaryMetrics && (
        <div className="space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-palette-yellow flex items-center gap-1.5">
            <Gauge className="w-4 h-4 text-palette-yellow" />
            <span>Core Model Outputs: Indoor Temperature &bull; Solar Thermal Energy &bull; Heat Flow Dynamics</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Output 1: Predicted Indoor Temperature */}
            <div className="p-4 rounded-xl bg-palette-card border border-palette-border space-y-2">
              <div className="flex items-center justify-between text-xs text-palette-text-secondary">
                <span className="flex items-center gap-1.5 font-semibold text-palette-text-primary">
                  <Flame className="w-3.5 h-3.5 text-palette-pink-red" />
                  (1) Predicted Indoor Temp
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-palette-violet text-palette-text-primary">
                  {summaryMetrics.dampingPercent.toFixed(0)}% Damping
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-palette-pink-red font-mono">
                  {summaryMetrics.avgInside > 0 ? `+${summaryMetrics.avgInside.toFixed(1)}` : summaryMetrics.avgInside.toFixed(1)}°C
                </span>
                <span className="text-xs text-palette-text-secondary">diurnal mean</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-palette-border/50 text-[11px] font-mono">
                <div>
                  <span className="text-palette-text-muted block text-[10px] font-sans">Peak Inside</span>
                  <span className="text-palette-pink-red font-bold">
                    {summaryMetrics.peakInside > 0 ? `+${summaryMetrics.peakInside.toFixed(1)}` : summaryMetrics.peakInside.toFixed(1)}°C
                  </span>
                  <span className="text-[10px] text-palette-text-muted ml-1">({String(summaryMetrics.peakHour).padStart(2, '0')}:00)</span>
                </div>
                <div>
                  <span className="text-palette-text-muted block text-[10px] font-sans">Min Inside</span>
                  <span className="text-palette-yellow font-bold">
                    {summaryMetrics.minInside > 0 ? `+${summaryMetrics.minInside.toFixed(1)}` : summaryMetrics.minInside.toFixed(1)}°C
                  </span>
                  <span className="text-[10px] text-palette-text-muted ml-1">({String(summaryMetrics.minHour).padStart(2, '0')}:00)</span>
                </div>
              </div>
            </div>

            {/* Output 2: Solar Thermal Energy Generated */}
            <div className="p-4 rounded-xl bg-palette-card border border-palette-border space-y-2">
              <div className="flex items-center justify-between text-xs text-palette-text-secondary">
                <span className="flex items-center gap-1.5 font-semibold text-palette-text-primary">
                  <Sun className="w-3.5 h-3.5 text-palette-yellow" />
                  (2) Solar Thermal Generated
                </span>
                <span className="text-[10px] font-mono text-palette-text-muted">
                  Peak: {Math.round(summaryMetrics.peakSolarWatts)} W
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-palette-yellow font-mono">
                  {summaryMetrics.totalSolarKWh.toFixed(2)} <span className="text-sm font-sans font-normal text-palette-text-secondary">kWh/day</span>
                </span>
              </div>
              <div className="pt-2 border-t border-palette-border/50 text-[11px] text-palette-text-secondary space-y-1">
                <div className="flex justify-between font-mono">
                  <span className="text-palette-text-muted">Total Diurnal Energy:</span>
                  <span className="text-palette-text-primary font-semibold">{Math.round(summaryMetrics.totalSolarWh).toLocaleString()} Wh</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-palette-text-muted">Glazing Transmittance (τ):</span>
                  <span className="text-palette-text-primary">100% (opaque deck)</span>
                </div>
              </div>
            </div>

            {/* Output 3: Heat Flow Over Defined Period (Ambient vs Shelter Difference) */}
            <div className="p-4 rounded-xl bg-palette-card border border-palette-border space-y-2">
              <div className="flex items-center justify-between text-xs text-palette-text-secondary">
                <span className="flex items-center gap-1.5 font-semibold text-palette-text-primary">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-palette-magenta" />
                  (3) 24h Heat Flow & ΔT
                </span>
                <span className="text-[10px] font-mono text-palette-text-muted">
                  Mean Rate: {Math.round(summaryMetrics.avgHeatFlowWatts)} W
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-palette-text-primary font-mono">
                  {summaryMetrics.totalLossKWh.toFixed(2)} <span className="text-sm font-sans font-normal text-palette-text-secondary">kWh/day</span>
                </span>
                <span className="text-[11px] text-palette-text-muted font-mono">(loss)</span>
              </div>
              <div className="pt-2 border-t border-palette-border/50 text-[11px] text-palette-text-secondary space-y-1">
                <div className="flex justify-between font-mono">
                  <span className="text-palette-text-muted">Mean ΔT (Inside − Amb):</span>
                  <span className="text-palette-pink-red font-bold">
                    {summaryMetrics.avgDeltaT > 0 ? `+${summaryMetrics.avgDeltaT.toFixed(1)}` : summaryMetrics.avgDeltaT.toFixed(1)}°C
                  </span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-palette-text-muted">All Losses (Cond+Inf+Rad):</span>
                  <span className="text-palette-magenta font-semibold">{summaryMetrics.totalCombinedLossKWh.toFixed(2)} kWh</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart 1: Temperature Prediction Chart */}
      {!isRefreshing && temperatureChartData && (
        <div className="p-5 rounded-2xl bg-palette-card border border-palette-border space-y-3 shadow-lg">
          <div>
            <h3 className="text-sm font-bold text-palette-text-primary flex items-center gap-2">
              <span>Diurnal Thermal Performance: Inside vs Ambient (°C)</span>
            </h3>
            <p className="text-xs text-palette-text-secondary">
              Hourly temperature predicted via explicit Euler lumped-capacitance transient forward stepping
            </p>
          </div>

          <div className="relative h-72 w-full pt-2">
            <Line data={temperatureChartData} options={tempChartOptions} />
          </div>
        </div>
      )}

      {/* Chart 2: Heat Flow Dynamics Chart */}
      {!isRefreshing && heatFlowChartData && (
        <div className="p-5 rounded-2xl bg-palette-card border border-palette-border space-y-3 shadow-lg">
          <div>
            <h3 className="text-sm font-bold text-palette-text-primary flex items-center gap-2">
              <span>Transient Heat Flow Dynamics (W)</span>
            </h3>
            <p className="text-xs text-palette-text-secondary">
              Hourly envelope conductive loss, infiltration loss, nocturnal sky radiation, and solar gain
            </p>
          </div>

          <div className="relative h-72 w-full pt-2">
            <Line data={heatFlowChartData} options={heatFlowChartOptions} />
          </div>
        </div>
      )}

      {/* Hourly Data Table Toggle & Breakdown */}
      {!isRefreshing && simulationResults && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowDataTable(!showDataTable)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-palette-card hover:bg-palette-raised text-palette-text-primary border border-palette-border text-xs font-semibold transition-colors"
          >
            <TableIcon className="w-3.5 h-3.5 text-palette-yellow" />
            <span>{showDataTable ? 'Hide 24-Hour Numeric Table' : 'View 24-Hour Numeric Table'}</span>
            {showDataTable ? <ChevronUp className="w-3.5 h-3.5 text-palette-yellow" /> : <ChevronDown className="w-3.5 h-3.5 text-palette-yellow" />}
          </button>

          {showDataTable && (
            <div className="overflow-x-auto rounded-xl border border-palette-border bg-palette-card p-3">
              <table className="w-full text-xs text-left font-mono">
                <thead className="bg-palette-raised text-palette-text-secondary uppercase text-[10px] tracking-wider font-sans">
                  <tr>
                    <th className="px-3 py-2 rounded-l">Hour</th>
                    <th className="px-3 py-2 text-palette-yellow">T_ambient (°C)</th>
                    <th className="px-3 py-2 text-palette-pink-red">T_inside (°C)</th>
                    <th className="px-3 py-2 text-palette-text-primary">ΔT (°C)</th>
                    <th className="px-3 py-2 text-palette-yellow">Q_absorbed (W)</th>
                    <th className="px-3 py-2 text-palette-pink-red">Q_loss (W)</th>
                    <th className="px-3 py-2 text-palette-text-secondary">Q_infil (W)</th>
                    <th className="px-3 py-2 text-palette-magenta rounded-r">Q_rad (W)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-palette-border text-palette-text-primary">
                  {simulationResults.map((r, i) => {
                    const ambient = config.ambientClimate.hourlyProfile[i]?.temperature_C ?? 0;
                    const delta = r.tempC - ambient;
                    return (
                      <tr key={r.time} className="hover:bg-palette-raised/60">
                        <td className="px-3 py-1.5 font-bold text-palette-text-secondary">
                          {String(i).padStart(2, '0')}:00
                        </td>
                        <td className="px-3 py-1.5 text-palette-yellow">
                          {ambient > 0 ? `+${ambient.toFixed(1)}` : ambient.toFixed(1)}
                        </td>
                        <td className="px-3 py-1.5 font-semibold text-palette-pink-red">
                          {r.tempC > 0 ? `+${r.tempC.toFixed(1)}` : r.tempC.toFixed(1)}
                        </td>
                        <td className="px-3 py-1.5 text-palette-text-primary">
                          {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
                        </td>
                        <td className="px-3 py-1.5 text-palette-yellow">{Math.round(r.qAbsorbed)}</td>
                        <td className="px-3 py-1.5 text-palette-pink-red">{Math.round(r.qLoss)}</td>
                        <td className="px-3 py-1.5 text-palette-text-secondary">{Math.round(r.qInfiltration)}</td>
                        <td className="px-3 py-1.5 text-palette-magenta">{Math.round(r.qRadiative)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Physics Note / Information Footer */}
      <div className="p-4 rounded-xl bg-palette-card/60 border border-palette-border flex items-start gap-3 text-xs text-palette-text-secondary">
        <Info className="w-4 h-4 text-palette-yellow shrink-0 mt-0.5" />
        <div className="space-y-1 leading-relaxed">
          <p>
            <strong className="text-palette-text-primary">Thermal Engine Architecture:</strong> Pure transient solver.
            Calculations are performed on user-selected physical matrices (layer thicknesses, density, specific heat,
            conductivity, emissivity, and ambient diurnal time series).
          </p>
        </div>
      </div>
    </div>
  );
};
