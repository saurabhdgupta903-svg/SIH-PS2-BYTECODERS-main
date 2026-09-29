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
  SplitSquareVertical,
  Layers,
  Box,
  RotateCw,
  Plus,
  Trash2,
  Award,
  ShieldAlert,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useShelter } from '../../context/ShelterContext';
import { NumberInput } from '../common/NumberInput';
import type { ShelterConfig, Material } from '../../types/shelter';
import {
  DESIGN_GOALS,
  getGoalInfo,
  goalMetricValue,
  compareStatsByGoal,
  type DesignGoal,
} from '../../lib/rankingObjectives';
import { getDefaultGoalForRegion } from '../../lib/regionMaterialAvailability';
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

export type ComparisonMode = 'materials' | 'geometry';

export interface VariantItem {
  id: string;
  name: string;
  color: string;
  config: ShelterConfig;
}

const VARIANT_COLORS = [
  '#FF467A', // Pink-red
  '#FFD51E', // Yellow
  '#AB03A9', // Magenta
  '#5003C0', // Violet
];

// Helper to seed initial variants based on mode and current workspace config
function generateInitialVariants(baseConfig: ShelterConfig, mode: ComparisonMode): VariantItem[] {
  const library = baseConfig.materialsLibrary;
  const wallMatId = baseConfig.wallLayers[0]?.materialId ?? library[0]?.id;
  const activeWallMat = library.find((m) => m.id === wallMatId) ?? library[0];

  if (mode === 'materials') {
    // Pick up to 3 distinct materials from library
    const mat0 = activeWallMat;
    const mat1 = library.find((m) => m.id !== mat0?.id) ?? library[1] ?? mat0;
    const mat2 = library.find((m) => m.id !== mat0?.id && m.id !== mat1?.id) ?? library[2] ?? library[0];

    const makeMatConfig = (mat: Material, suffix: string): ShelterConfig => ({
      ...baseConfig,
      wallLayers: [
        {
          id: `var-wall-${suffix}`,
          materialId: mat.id,
          thickness_m: baseConfig.wallLayers[0]?.thickness_m ?? 0.3,
        },
      ],
      roofLayers: [
        {
          id: `var-roof-${suffix}`,
          materialId: mat.id,
          thickness_m: baseConfig.roofLayers[0]?.thickness_m ?? 0.2,
        },
      ],
    });

    return [
      {
        id: 'var-1',
        name: `${mat0?.name ?? 'Base Material'}`,
        color: VARIANT_COLORS[0],
        config: makeMatConfig(mat0, '1'),
      },
      {
        id: 'var-2',
        name: `${mat1?.name ?? 'Alternative 1'}`,
        color: VARIANT_COLORS[1],
        config: makeMatConfig(mat1, '2'),
      },
      {
        id: 'var-3',
        name: `${mat2?.name ?? 'Alternative 2'}`,
        color: VARIANT_COLORS[2],
        config: makeMatConfig(mat2, '3'),
      },
    ];
  } else {
    // Geometry Mode
    const geom = baseConfig.geometry;
    return [
      {
        id: 'var-1',
        name: `${geom.length_m}×${geom.width_m}m Base`,
        color: VARIANT_COLORS[0],
        config: {
          ...baseConfig,
          geometry: { ...geom },
        },
      },
      {
        id: 'var-2',
        name: `${(geom.length_m + 2).toFixed(1)}×${geom.width_m.toFixed(1)}m Extended`,
        color: VARIANT_COLORS[1],
        config: {
          ...baseConfig,
          geometry: {
            ...geom,
            length_m: Number((geom.length_m + 2).toFixed(1)),
          },
        },
      },
      {
        id: 'var-3',
        name: `${geom.length_m}×${geom.width_m}m Rotated 90°`,
        color: VARIANT_COLORS[2],
        config: {
          ...baseConfig,
          geometry: {
            ...geom,
            orientation_deg: (geom.orientation_deg + 90) % 360,
          },
        },
      },
    ];
  }
}

export const CompareView: React.FC = () => {
  const { config } = useShelter();
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('materials');
  const [variants, setVariants] = useState<VariantItem[]>(() =>
    generateInitialVariants(config, 'materials')
  );
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [showParameters, setShowParameters] = useState<boolean>(false);
  // Design goal used for ranking (default follows the active region preset; user can override)
  const [goalOverride, setGoalOverride] = useState<DesignGoal | null>(null);
  const goal: DesignGoal = goalOverride ?? getDefaultGoalForRegion(config.activePresetId);

  // Switch comparison modes and reset variants to appropriate defaults
  const handleModeChange = useCallback(
    (newMode: ComparisonMode) => {
      setComparisonMode(newMode);
      setVariants(generateInitialVariants(config, newMode));
    },
    [config]
  );

  // Add a new variant (cloning base configuration)
  const handleAddVariant = useCallback(() => {
    if (variants.length >= 4) return;
    const nextIdx = variants.length;
    const nextColor = VARIANT_COLORS[nextIdx % VARIANT_COLORS.length];
    const newVariant: VariantItem = {
      id: `var-${Date.now()}`,
      name: `Variant ${nextIdx + 1}`,
      color: nextColor,
      config: JSON.parse(JSON.stringify(config)),
    };
    setVariants((prev) => [...prev, newVariant]);
  }, [variants.length, config]);

  // Remove a variant (minimum 2 maintained)
  const handleRemoveVariant = useCallback(
    (idToRemove: string) => {
      if (variants.length <= 2) return;
      setVariants((prev) => prev.filter((v) => v.id !== idToRemove));
    },
    [variants.length]
  );

  // Update variant name
  const handleUpdateName = useCallback((id: string, newName: string) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, name: newName } : v))
    );
  }, []);

  // Update wall material in materials mode
  const handleUpdateMaterial = useCallback(
    (variantId: string, materialId: string) => {
      const selectedMat = config.materialsLibrary.find((m) => m.id === materialId);
      setVariants((prev) =>
        prev.map((v) => {
          if (v.id !== variantId) return v;
          const updatedWallLayers = v.config.wallLayers.length > 0
            ? [{ ...v.config.wallLayers[0], materialId }]
            : [{ id: `layer-${Date.now()}`, materialId, thickness_m: 0.3 }];
          const updatedRoofLayers = v.config.roofLayers.length > 0
            ? [{ ...v.config.roofLayers[0], materialId }]
            : [{ id: `layer-roof-${Date.now()}`, materialId, thickness_m: 0.2 }];

          return {
            ...v,
            name: selectedMat ? selectedMat.name : v.name,
            config: {
              ...v.config,
              wallLayers: updatedWallLayers,
              roofLayers: updatedRoofLayers,
            },
          };
        })
      );
    },
    [config.materialsLibrary]
  );

  // Update wall thickness
  const handleUpdateWallThickness = useCallback(
    (variantId: string, thickness_m: number) => {
      setVariants((prev) =>
        prev.map((v) => {
          if (v.id !== variantId) return v;
          const updatedWallLayers = v.config.wallLayers.map((l, i) =>
            i === 0 ? { ...l, thickness_m } : l
          );
          return {
            ...v,
            config: {
              ...v.config,
              wallLayers: updatedWallLayers,
            },
          };
        })
      );
    },
    []
  );

  // Update geometry parameters in geometry mode
  const handleUpdateGeometry = useCallback(
    (
      variantId: string,
      field: 'length_m' | 'width_m' | 'height_m' | 'orientation_deg',
      value: number
    ) => {
      setVariants((prev) =>
        prev.map((v) => {
          if (v.id !== variantId) return v;
          const updatedGeom = {
            ...v.config.geometry,
            [field]: value,
          };
          return {
            ...v,
            config: {
              ...v.config,
              geometry: updatedGeom,
            },
          };
        })
      );
    },
    []
  );

  // Re-run simulation trigger with brief tactile visual feedback
  const handleReRun = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 250);
  }, []);

  // Run simulation engine independently for each variant
  const simulatedVariants = useMemo(() => {
    return variants.map((variant) => {
      try {
        const { geometry, ambientClimate, wallLayers, roofLayers } = variant.config;
        if (!geometry || geometry.length_m <= 0 || geometry.width_m <= 0 || geometry.height_m <= 0) {
          throw new Error('All dimensions (L, W, H) must be strictly greater than zero.');
        }
        if (!ambientClimate.hourlyProfile || ambientClimate.hourlyProfile.length === 0) {
          throw new Error('Ambient climate profile has no hourly data points.');
        }
        if (wallLayers.length === 0 && roofLayers.length === 0) {
          throw new Error('At least one wall or roof assembly layer is required.');
        }

        const steady = simulateSteadyCycle(
          variant.config,
          DEFAULT_TIME_STEP_SECONDS,
          DEFAULT_INFILTRATION_RATE,
          DEFAULT_AIR_DENSITY,
          DEFAULT_AIR_SPECIFIC_HEAT,
          DEFAULT_H_INTERIOR,
          DEFAULT_H_EXTERIOR,
          DEFAULT_SKY_TEMP_OFFSET_C
        );

        const results = steady.series;
        const insideTemps = results.map((r) => r.tempC);
        const peak = Math.max(...insideTemps);
        const peakHour = results.findIndex((r) => r.tempC === peak);
        const min = Math.min(...insideTemps);
        const minHour = results.findIndex((r) => r.tempC === min);
        const avg = insideTemps.reduce((a, b) => a + b, 0) / insideTemps.length;
        const swing = peak - min;

        return {
          ...variant,
          results,
          steadyMeta: {
            daysSimulated: steady.daysSimulated,
            converged: steady.converged,
            residualC: steady.residualC,
          },
          metrics: {
            peak,
            peakHour,
            min,
            minHour,
            avg,
            swing,
          },
          error: null,
        };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Calculation error encountered during simulation.';
        return {
          ...variant,
          results: null,
          steadyMeta: null,
          metrics: null,
          error: message,
        };
      }
    });
  }, [variants]);

  // Ranked variants: converged designs first, then by the selected design goal.
  // (The efficiency score is not used: at a steady daily cycle it is about zero.)
  const rankedVariants = useMemo(() => {
    const valid = simulatedVariants.filter((v) => v.metrics !== null);
    return [...valid].sort((a, b) => {
      const aConverged = a.steadyMeta?.converged ?? false;
      const bConverged = b.steadyMeta?.converged ?? false;
      if (aConverged && !bConverged) return -1;
      if (!aConverged && bConverged) return 1;
      const am = a.metrics!;
      const bm = b.metrics!;
      return compareStatsByGoal(
        goal,
        { min: am.min, avg: am.avg, max: am.peak, swing: am.swing },
        { min: bm.min, avg: bm.avg, max: bm.peak, swing: bm.swing }
      );
    });
  }, [simulatedVariants, goal]);

  const goalInfo = getGoalInfo(goal);
  const variantGoalMetric = (v: { metrics: { min: number; avg: number; peak: number; swing: number } | null }): number =>
    v.metrics
      ? goalMetricValue(goal, { min: v.metrics.min, avg: v.metrics.avg, max: v.metrics.peak, swing: v.metrics.swing })
      : 0;

  // Top ranked variant
  const bestVariant = rankedVariants[0] ?? null;
  const lowestVariant = rankedVariants[rankedVariants.length - 1] ?? null;

  // Chart.js Comparative Multi-line Dataset
  const comparativeChartData = useMemo(() => {
    const firstSuccessful = simulatedVariants.find((v) => v.results && v.results.length > 0);
    if (!firstSuccessful || !firstSuccessful.results) return null;

    const labels = firstSuccessful.results.map((r) => {
      const h = Math.floor(r.time / 3600) % 24;
      return `${String(h).padStart(2, '0')}:00`;
    });

    const hourlyAmbient = config.ambientClimate.hourlyProfile.map((p) => p.temperature_C);

    const datasets = [
      // Ambient line
      {
        label: 'Ambient Air Temperature (°C)',
        data: labels.map((_, i) => Number(hourlyAmbient[i % hourlyAmbient.length]?.toFixed(2) ?? 0)),
        borderColor: '#FFD51E', // Yellow
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [5, 4],
        pointRadius: 1,
        pointHoverRadius: 4.5,
        tension: 0.4,
        cubicInterpolationMode: 'monotone' as const,
      },
      // Variant lines
      ...simulatedVariants
        .filter((v) => v.results !== null)
        .map((v) => ({
          label: `${v.name} (°C)`,
          data: v.results!.map((r) => Number(r.tempC.toFixed(2))),
          borderColor: v.color,
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          pointRadius: 1,
          pointHoverRadius: 5,
          tension: 0.4,
          cubicInterpolationMode: 'monotone' as const,
        })),
    ];

    return { labels, datasets };
  }, [simulatedVariants, config.ambientClimate.hourlyProfile]);

  // Chart options
  const chartOptions = {
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
          color: '#cbd5e1',
          font: { size: 11, weight: 500 },
          usePointStyle: true,
          boxWidth: 8,
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: 'rgba(51, 65, 85, 0.8)',
        borderWidth: 1,
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
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
        grid: { color: 'rgba(148, 163, 184, 0.08)' },
        ticks: { color: '#94a3b8', font: { size: 11, weight: 'normal' as const } },
        title: {
          display: true,
          text: 'Hour of Diurnal Cycle (0:00 – 23:00)',
          color: '#cbd5e1',
          font: { size: 11, weight: 'bold' as const },
        },
      },
      y: {
        grid: { color: 'rgba(148, 163, 184, 0.08)' },
        ticks: { color: '#94a3b8', font: { size: 11, weight: 'normal' as const } },
        title: {
          display: true,
          text: 'Indoor Temperature (°C)',
          color: '#cbd5e1',
          font: { size: 11, weight: 'bold' as const },
        },
      },
    },
  };

  // Helper to get distinguishing description
  const getDistinguishingFeature = (variant: VariantItem) => {
    if (comparisonMode === 'materials') {
      const wallLayer = variant.config.wallLayers[0];
      const mat = variant.config.materialsLibrary.find((m) => m.id === wallLayer?.materialId);
      const thMm = Math.round((wallLayer?.thickness_m ?? 0) * 1000);
      return `${mat?.name ?? 'Unknown'} (${thMm} mm)`;
    } else {
      const { length_m, width_m, height_m, orientation_deg } = variant.config.geometry;
      return `${length_m}m × ${width_m}m × ${height_m}m (${orientation_deg}°)`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Comparison Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <SplitSquareVertical className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-slate-100">
              Multi-Variant Passive Design Comparison
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Simulate 2–4 architectural options under identical diurnal climate conditions &bull; Region:{' '}
            <strong className="text-slate-200">{config.ambientClimate.regionName}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Comparison Mode Toggle */}
          <div className="flex items-center p-1 rounded-lg bg-slate-800 border border-slate-700">
            <button
              type="button"
              onClick={() => handleModeChange('materials')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                comparisonMode === 'materials'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Compare Materials</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('geometry')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                comparisonMode === 'geometry'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>Compare Geometry</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleReRun}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Recalculating...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Mandatory "NEEDS VALIDATION" Disclosure Banner */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-amber-300">
            Comparative results calculated using standardized default engineering reference parameters.
          </p>
          <p className="text-amber-200/80 leading-relaxed">
            All variants are simulated with identical infiltration rates ({DEFAULT_INFILTRATION_RATE} m³/s),
            convective film coefficients ({DEFAULT_H_INTERIOR} / {DEFAULT_H_EXTERIOR} W/m²·K), and nocturnal sky depression ({DEFAULT_SKY_TEMP_OFFSET_C} °C).
            Verify material properties against local field samples prior to physical fabrication.
          </p>
          <button
            type="button"
            onClick={() => setShowParameters(!showParameters)}
            className="inline-flex items-center gap-1 mt-1 text-amber-300 hover:text-amber-200 underline font-medium"
          >
            <span>{showParameters ? 'Hide assumed parameters' : 'Inspect assumed reference parameters'}</span>
            {showParameters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Collapsible Reference Parameters Table */}
      {showParameters && (
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Assumed Engine Parameters ({DEFAULT_ENGINE_NOTICE})
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-slate-850 border border-slate-750">
              <span className="text-slate-400 block text-[11px] font-sans">Infiltration Rate (V̇)</span>
              <span className="text-slate-100 font-semibold">{DEFAULT_INFILTRATION_RATE} m³/s (~0.5 ACH)</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-850 border border-slate-750">
              <span className="text-slate-400 block text-[11px] font-sans">Air Density (ρ)</span>
              <span className="text-slate-100 font-semibold">{DEFAULT_AIR_DENSITY} kg/m³</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-850 border border-slate-750">
              <span className="text-slate-400 block text-[11px] font-sans">Air Specific Heat (c_p)</span>
              <span className="text-slate-100 font-semibold">{DEFAULT_AIR_SPECIFIC_HEAT} J/(kg·K)</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-850 border border-slate-750">
              <span className="text-slate-400 block text-[11px] font-sans">Interior Film (h_i)</span>
              <span className="text-slate-100 font-semibold">{DEFAULT_H_INTERIOR} W/(m²·K)</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-850 border border-slate-750">
              <span className="text-slate-400 block text-[11px] font-sans">Exterior Film (h_o)</span>
              <span className="text-slate-100 font-semibold">{DEFAULT_H_EXTERIOR} W/(m²·K)</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-850 border border-slate-750">
              <span className="text-slate-400 block text-[11px] font-sans">Sky Temp Offset (ΔT_sky)</span>
              <span className="text-slate-100 font-semibold">{DEFAULT_SKY_TEMP_OFFSET_C} °C below ambient</span>
            </div>
          </div>
        </div>
      )}

      {/* Steady Daily Cycle Banner */}
      {simulatedVariants.length > 0 && (
        <div
          className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
            simulatedVariants.every((v) => v.steadyMeta?.converged)
              ? 'bg-slate-900/80 border-slate-800 text-slate-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
          }`}
        >
          {simulatedVariants.every((v) => v.steadyMeta?.converged) ? (
            <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <p className="leading-relaxed">
              Steady daily cycle: the 24 h climate profile is repeated for N days until the day-to-day change is below 0.01 °C. Assumes the daily climate repeats.
              {simulatedVariants[0]?.steadyMeta && (
                <span className="font-mono ml-2 text-slate-400">
                  (Baseline: {simulatedVariants[0].steadyMeta.daysSimulated} days, residual: {simulatedVariants[0].steadyMeta.residualC.toFixed(4)} °C)
                </span>
              )}
            </p>
            {simulatedVariants.some((v) => v.steadyMeta && !v.steadyMeta.converged) && (
              <p className="text-amber-400 font-semibold">
                Warning: One or more variants did not fully converge within 60 days limit.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Variant Builder Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-200">
              Active Design Variants ({variants.length}/4)
            </h3>
            <span className="text-xs text-slate-400">
              {comparisonMode === 'materials'
                ? 'Select wall materials & thicknesses to observe thermal mass variance'
                : 'Adjust footprint dimensions and orientation'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleAddVariant}
            disabled={variants.length >= 4}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Variant</span>
          </button>
        </div>

        {/* Variant Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {variants.map((variant) => {
            const sim = simulatedVariants.find((s) => s.id === variant.id);
            const isRankOne = rankedVariants[0]?.id === variant.id;

            return (
              <div
                key={variant.id}
                className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 relative space-y-3 flex flex-col justify-between shadow-md"
                style={{ borderTopColor: variant.color, borderTopWidth: 3 }}
              >
                <div>
                  {/* Card Header: Color Indicator, Name Input, Remove */}
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: variant.color }}
                      />
                      <input
                        type="text"
                        value={variant.name}
                        onChange={(e) => handleUpdateName(variant.id, e.target.value)}
                        className="bg-transparent text-xs font-bold text-slate-200 focus:bg-slate-800 focus:outline-none rounded px-1.5 py-0.5 w-full truncate border border-transparent focus:border-slate-700"
                        title="Click to rename variant"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      {isRankOne && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold" title="Ranks first for the selected design goal">
                          <Award className="w-3 h-3" />
                          #1
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveVariant(variant.id)}
                        disabled={variants.length <= 2}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 disabled:opacity-30 disabled:hover:text-slate-500 transition-colors"
                        title={variants.length <= 2 ? 'Minimum 2 variants required' : 'Remove variant'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Mode-Specific Input Controls */}
                  <div className="pt-2 space-y-2.5">
                    {comparisonMode === 'materials' ? (
                      <div className="space-y-2 text-xs">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">
                            Primary Wall Material
                          </label>
                          <select
                            value={variant.config.wallLayers[0]?.materialId ?? ''}
                            onChange={(e) => handleUpdateMaterial(variant.id, e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                          >
                            {config.materialsLibrary.map((mat) => (
                              <option key={mat.id} value={mat.id}>
                                {mat.name} (k={mat.conductivity_k})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                            <span>Wall Thickness</span>
                            <span className="font-mono text-slate-300">
                              {Math.round((variant.config.wallLayers[0]?.thickness_m ?? 0.3) * 1000)} mm
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.1"
                            max="0.8"
                            step="0.05"
                            value={variant.config.wallLayers[0]?.thickness_m ?? 0.3}
                            onChange={(e) =>
                              handleUpdateWallThickness(variant.id, parseFloat(e.target.value))
                            }
                            className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">Length (m)</label>
                            <NumberInput
                              step="0.5"
                              min={1}
                              max={30}
                              value={variant.config.geometry.length_m}
                              onChange={(val) =>
                                handleUpdateGeometry(variant.id, 'length_m', val)
                              }
                              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">Width (m)</label>
                            <NumberInput
                              step="0.5"
                              min={1}
                              max={30}
                              value={variant.config.geometry.width_m}
                              onChange={(val) =>
                                handleUpdateGeometry(variant.id, 'width_m', val)
                              }
                              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">Height (m)</label>
                            <NumberInput
                              step="0.2"
                              min={1.5}
                              max={10}
                              value={variant.config.geometry.height_m}
                              onChange={(val) =>
                                handleUpdateGeometry(variant.id, 'height_m', val)
                              }
                              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">Azimuth (°)</label>
                            <NumberInput
                              step="15"
                              min={0}
                              max={360}
                              value={variant.config.geometry.orientation_deg}
                              onChange={(val) =>
                                handleUpdateGeometry(variant.id, 'orientation_deg', val)
                              }
                              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Per-Variant Error Display or Mini Metric Snippet */}
                <div className="pt-2 border-t border-slate-800/80">
                  {sim?.error ? (
                    <div className="flex items-center gap-1.5 text-rose-400 text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate" title={sim.error}>{sim.error}</span>
                    </div>
                  ) : sim?.metrics ? (
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                      <span>Peak: <strong className="text-amber-400">{sim.metrics.peak.toFixed(1)}°</strong></span>
                      <span>Swing: <strong className="text-slate-200">{sim.metrics.swing.toFixed(1)}°</strong></span>
                      <span>Min: <strong className="text-sky-400">{sim.metrics.min.toFixed(1)}°</strong></span>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comparative Multi-line Temperature Chart */}
      {comparativeChartData && (
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <span>Diurnal Temperature Trajectories — Multi-Variant Overlay</span>
              </h3>
              <p className="text-xs text-slate-400">
                Hourly interior response comparison across all active variants under identical solar & ambient loading
              </p>
            </div>
          </div>

          <div className="relative h-80 w-full pt-2">
            <Line data={comparativeChartData} options={chartOptions} />
          </div>
        </div>
      )}

      {/* Performance Ranking & Comparison Table */}
      {rankedVariants.length > 0 && (
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                <span>Design Goal Ranking & Performance Metrics</span>
              </h3>
              <p className="text-xs text-slate-400">
                {goalInfo.description} Designs that did not reach a steady daily cycle rank after those that did.
              </p>
            </div>
            <div className="shrink-0 ml-4 space-y-1">
              <label htmlFor="compare-design-goal" className="block text-[11px] text-slate-400">
                Design goal
              </label>
              <select
                id="compare-design-goal"
                value={goal}
                onChange={(e) => setGoalOverride(e.target.value as DesignGoal)}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                {DESIGN_GOALS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Takeaway Insight Callout */}
          {bestVariant && lowestVariant && bestVariant.id !== lowestVariant.id && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 flex items-start gap-2.5 text-xs">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="text-emerald-300">Design Takeaway: </strong>
                <span>
                  <strong>{bestVariant.name}</strong> ranks first for the goal “{goalInfo.label}” with{' '}
                  <strong className="font-mono text-emerald-300">
                    {goalInfo.metricLabel}: {variantGoalMetric(bestVariant).toFixed(1)}
                  </strong>
                  . {lowestVariant.name} ranks last with{' '}
                  <strong className="font-mono text-slate-100">{variantGoalMetric(lowestVariant).toFixed(1)}</strong>
                  , a difference of{' '}
                  <strong className="font-mono text-emerald-300">
                    {Math.abs(variantGoalMetric(bestVariant) - variantGoalMetric(lowestVariant)).toFixed(1)}
                  </strong>
                  .
                </span>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-xs text-left font-mono">
              <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider font-sans">
                <tr>
                  <th className="px-3.5 py-2.5">Rank & Design Variant</th>
                  <th className="px-3 py-2.5">Distinguishing Spec</th>
                  <th className="px-3 py-2.5 text-amber-400">Peak Inside (°C)</th>
                  <th className="px-3 py-2.5 text-sky-400">Min Inside (°C)</th>
                  <th className="px-3 py-2.5 text-slate-300">Diurnal Swing (ΔT)</th>
                  <th className="px-3 py-2.5 text-amber-300">Avg Inside (°C)</th>
                  <th className="px-3 py-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {rankedVariants.map((v, rankIdx) => {
                  const m = v.metrics!;
                  const isFirst = rankIdx === 0;

                  return (
                    <tr
                      key={v.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isFirst ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      {/* Rank & Name */}
                      <td className="px-3.5 py-3 font-sans">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                              isFirst
                                ? 'bg-amber-500 text-slate-950 shadow-sm'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {rankIdx + 1}
                          </span>
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: v.color }}
                          />
                          <span className="font-semibold text-slate-100">{v.name}</span>
                        </div>
                      </td>

                      {/* Distinguishing Spec */}
                      <td className="px-3 py-3 text-slate-400 font-sans text-[11px]">
                        {getDistinguishingFeature(v)}
                      </td>

                      {/* Peak Inside */}
                      <td className="px-3 py-3 text-amber-400 font-semibold">
                        {m.peak > 0 ? `+${m.peak.toFixed(1)}` : m.peak.toFixed(1)}°C
                        <span className="text-[10px] text-slate-500 ml-1 font-normal font-sans">
                          ({String(m.peakHour).padStart(2, '0')}:00)
                        </span>
                      </td>

                      {/* Min Inside */}
                      <td className="px-3 py-3 text-sky-400 font-semibold">
                        {m.min > 0 ? `+${m.min.toFixed(1)}` : m.min.toFixed(1)}°C
                        <span className="text-[10px] text-slate-500 ml-1 font-normal font-sans">
                          ({String(m.minHour).padStart(2, '0')}:00)
                        </span>
                      </td>

                      {/* Diurnal Swing */}
                      <td className="px-3 py-3 text-slate-200">
                        {m.swing.toFixed(1)}°C
                      </td>

                      {/* Average Inside */}
                      <td className="px-3 py-3 font-bold text-amber-300">
                        {m.avg.toFixed(1)}°C
                      </td>

                      {/* Badge / Status */}
                      <td className="px-3 py-3 text-right">
                        {isFirst ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-sans font-semibold">
                            <CheckCircle2 className="w-3 h-3" />
                            Optimal
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-sans">
                            Rank #{rankIdx + 1}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-start gap-3 text-xs text-slate-400">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <div className="space-y-1 leading-relaxed">
          <p>
            <strong className="text-slate-300">Comparative Physics Rigor:</strong> All variants are solved using the same
            lumped capacitance forward-stepping equations (Formulas 1–10). Variation stems strictly from thermal resistance
            (ΣL/k), envelope thermal capacity (Σm · c_p), and geometry-derived surface area ratios.
          </p>
        </div>
      </div>
    </div>
  );
};
