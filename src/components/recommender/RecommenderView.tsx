import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles,
  Sliders,
  Check,
  AlertTriangle,
  ShieldAlert,
  Info,
  Box,
  TrendingUp,
  Award,
  RotateCw,
  CheckCircle2,
} from 'lucide-react';
import { useShelter } from '../../context/ShelterContext';
import { REGION_PRESETS } from '../../data/regionPresets';
import type { ShelterConfig, Material, RegionPreset } from '../../types/shelter';
import {
  generateCandidates,
  evaluateCandidate,
  evaluateBaseline,
  rankCandidates,
  buildExplanationString,
  candidateGoalMetric,
  gridEdgeNotes,
  defaultMaxTotalWallThickness_m,
  SEARCH_GRID_NOTICE,
  type EvaluatedCandidate,
  type GenerationResult,
} from '../../lib/designSearch';
import { DESIGN_GOALS, getGoalInfo, type DesignGoal } from '../../lib/rankingObjectives';
import {
  REGION_MATERIAL_AVAILABILITY,
  getAvailableMaterialsForRegion,
  getDefaultGoalForRegion,
  isNonWallMaterial,
} from '../../lib/regionMaterialAvailability';
import { DEFAULT_SKY_TEMP_OFFSET_C } from '../../lib/engineDefaults';
import { STEADY_CYCLE_TOLERANCE_C } from '../../lib/simulationConstants';
import { ShelterViewer } from '../visualization/ShelterViewer';

function buildPresetConfigCopy(preset: RegionPreset, library: Material[]): ShelterConfig {
  return {
    ambientClimate: {
      ...preset.ambientClimate,
      hourlyProfile: preset.ambientClimate.hourlyProfile.map((p) => ({ ...p })),
    },
    materialsLibrary: library.map((m) => ({ ...m })),
    wallLayers: [
      {
        id: 'wall_layer_default',
        materialId: preset.defaultSingleMaterialId,
        thickness_m: preset.defaultWallThickness_m,
      },
    ],
    roofLayers: [
      {
        id: 'roof_layer_default',
        materialId: preset.defaultSingleMaterialId,
        thickness_m: preset.defaultRoofThickness_m,
      },
    ],
    geometry: {
      shape: preset.defaultGeometry.shape,
      length_m: preset.defaultGeometry.length_m,
      width_m: preset.defaultGeometry.width_m,
      height_m: preset.defaultGeometry.height_m,
      orientation_deg: preset.defaultGeometry.orientation_deg,
      openings: preset.defaultGeometry.openings.map((op) => ({ ...op })),
    },
    activePresetId: preset.id,
  };
}

interface ShowcaseWinner {
  regionPreset: RegionPreset;
  winner: EvaluatedCandidate;
  goal: DesignGoal;
  /** Total wall thickness limit (m) used for this region's search. */
  capM: number;
  /** The preset's own default design, simulated the same way, for comparison. */
  presetDesign: EvaluatedCandidate;
  evaluatedCount: number;
}

interface LastRun {
  goal: DesignGoal;
  capM: number | undefined;
  target: number | undefined;
}

/** "Cold high-altitude desert (e.g. Ladakh-type climate)" -> "Cold high-altitude desert" */
function shortRegionName(name: string): string {
  return name.split(' (')[0];
}

export const RecommenderView: React.FC = () => {
  const { config, setWallLayers, setRoofLayers, updateGeometry } = useShelter();

  // Materials available at this site (pre-filled per active preset, editable in local state)
  const initialAvailableMaterials = useMemo(() => {
    return getAvailableMaterialsForRegion(config.activePresetId);
  }, [config.activePresetId]);

  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>(initialAvailableMaterials);
  const [alsoVaryRoof, setAlsoVaryRoof] = useState<boolean>(false);
  const [targetMinTempInput, setTargetMinTempInput] = useState<string>('');
  // Design goal: follows the active region preset unless the user picks one
  const [goalOverride, setGoalOverride] = useState<DesignGoal | null>(null);
  const goal: DesignGoal = goalOverride ?? getDefaultGoalForRegion(config.activePresetId);
  // Max total wall thickness (mm): pre-filled with the search grid's own upper bound; clear to remove
  const [capInputOverride, setCapInputOverride] = useState<string | null>(null);
  const defaultCapMm = useMemo(
    () => String(Math.round(defaultMaxTotalWallThickness_m(config) * 1000)),
    [config]
  );
  const capInput = capInputOverride ?? defaultCapMm;
  const [lastRun, setLastRun] = useState<LastRun | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');
  const [evaluatedCandidates, setEvaluatedCandidates] = useState<EvaluatedCandidate[] | null>(null);
  const [generationMeta, setGenerationMeta] = useState<GenerationResult | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [applySuccessMsg, setApplySuccessMsg] = useState<string | null>(null);

  // Region Showcase state
  const [isShowcaseRunning, setIsShowcaseRunning] = useState<boolean>(false);
  const [showcaseProgress, setShowcaseProgress] = useState<string>('');
  const [showcaseWinners, setShowcaseWinners] = useState<ShowcaseWinner[] | null>(null);
  const [showcaseRegionId, setShowcaseRegionId] = useState<string | null>(null);

  // Sync available materials and design goal when preset changes in workspace
  useEffect(() => {
    setSelectedMaterialIds(getAvailableMaterialsForRegion(config.activePresetId));
    setGoalOverride(null);
  }, [config.activePresetId]);

  const targetMinTempC = useMemo(() => {
    const parsed = parseFloat(targetMinTempInput);
    return isNaN(parsed) ? undefined : parsed;
  }, [targetMinTempInput]);

  const maxTotalWallThickness_m = useMemo(() => {
    const parsed = parseFloat(capInput);
    return Number.isFinite(parsed) && parsed > 0 ? parsed / 1000 : undefined;
  }, [capInput]);

  const wallMaterialCount = useMemo(
    () => config.materialsLibrary.filter((m) => !isNonWallMaterial(m.id)).length,
    [config.materialsLibrary]
  );

  // Toggle material checkbox (glazing-type materials can never be wall materials)
  const handleToggleMaterial = (matId: string) => {
    if (isNonWallMaterial(matId)) return;
    setSelectedMaterialIds((prev) =>
      prev.includes(matId) ? prev.filter((id) => id !== matId) : [...prev, matId]
    );
  };

  // Evaluate baseline configuration for the comparison row
  const baseline = useMemo(() => {
    return evaluateBaseline(config, targetMinTempC);
  }, [config, targetMinTempC]);

  // Run Search with chunked setTimeout(0) to keep UI responsive
  const handleRunSearch = useCallback(() => {
    if (selectedMaterialIds.length === 0) return;

    setIsEvaluating(true);
    setEvaluatedCandidates(null);
    setSelectedCandidateId(null);
    setApplySuccessMsg(null);
    setProgressText('Generating candidate design search grid...');
    const runGoal = goal;
    const runCap = maxTotalWallThickness_m;
    const runTarget = targetMinTempC;

    setTimeout(() => {
      const genResult = generateCandidates(config, selectedMaterialIds, alsoVaryRoof, {
        maxTotalWallThickness_m: runCap,
      });
      setGenerationMeta(genResult);
      setLastRun({ goal: runGoal, capM: runCap, target: runTarget });

      const total = genResult.candidates.length;
      if (total === 0) {
        setIsEvaluating(false);
        setEvaluatedCandidates([]);
        return;
      }

      const chunkSize = 200;
      const evaluatedList: EvaluatedCandidate[] = [];
      let currentIndex = 0;

      function processChunk() {
        const endIndex = Math.min(currentIndex + chunkSize, total);
        for (let i = currentIndex; i < endIndex; i++) {
          evaluatedList.push(evaluateCandidate(genResult.candidates[i], targetMinTempC));
        }
        currentIndex = endIndex;
        setProgressText(`Evaluating ${currentIndex} / ${total} designs...`);

        if (currentIndex < total) {
          setTimeout(processChunk, 0);
        } else {
          // Ranking
          const ranked = rankCandidates(evaluatedList, runGoal, runTarget);
          setEvaluatedCandidates(ranked);
          if (ranked.length > 0) {
            setSelectedCandidateId(ranked[0].id);
          }
          setIsEvaluating(false);
          setProgressText('');
        }
      }

      processChunk();
    }, 10);
  }, [config, selectedMaterialIds, alsoVaryRoof, targetMinTempC, goal, maxTotalWallThickness_m]);

  // Run Region Showcase (all 3 presets) on config copies
  const handleRunShowcase = useCallback(() => {
    setIsShowcaseRunning(true);
    setShowcaseWinners(null);
    setShowcaseRegionId(null);
    setShowcaseProgress('Preparing regional presets...');

    setTimeout(() => {
      const winners: ShowcaseWinner[] = [];
      const presets = REGION_PRESETS.slice(0, 3);
      let presetIdx = 0;

      function processPreset() {
        if (presetIdx >= presets.length) {
          setShowcaseWinners(winners);
          setIsShowcaseRunning(false);
          setShowcaseProgress('');
          return;
        }

        const preset = presets[presetIdx];
        setShowcaseProgress(`Simulating regional candidates for ${preset.name}...`);

        setTimeout(() => {
          const presetConfig = buildPresetConfigCopy(preset, config.materialsLibrary);
          const avail = REGION_MATERIAL_AVAILABILITY[preset.id] ?? getAvailableMaterialsForRegion(preset.id);
          // Each region has its own design goal and a wall-thickness limit of 2x its own preset wall
          const presetGoal = getDefaultGoalForRegion(preset.id);
          const capM = defaultMaxTotalWallThickness_m(presetConfig);
          const gen = generateCandidates(presetConfig, avail, false, { maxTotalWallThickness_m: capM });
          const evalList = gen.candidates.map((c) => evaluateCandidate(c));
          const ranked = rankCandidates(evalList, presetGoal);

          if (ranked.length > 0) {
            winners.push({
              regionPreset: preset,
              winner: ranked[0],
              goal: presetGoal,
              capM,
              presetDesign: evaluateBaseline(presetConfig),
              evaluatedCount: evalList.length,
            });
          }
          presetIdx++;
          processPreset();
        }, 10);
      }

      processPreset();
    }, 10);
  }, [config.materialsLibrary]);

  // Top 10 ranked candidates
  const topCandidates = useMemo(() => {
    if (!evaluatedCandidates) return [];
    return evaluatedCandidates.slice(0, 10);
  }, [evaluatedCandidates]);

  // Selected candidate
  const selectedCandidate = useMemo(() => {
    if (!evaluatedCandidates || !selectedCandidateId) return null;
    return evaluatedCandidates.find((c) => c.id === selectedCandidateId) ?? null;
  }, [evaluatedCandidates, selectedCandidateId]);

  const selectedRank = useMemo(() => {
    if (!evaluatedCandidates || !selectedCandidateId) return 1;
    const idx = evaluatedCandidates.findIndex((c) => c.id === selectedCandidateId);
    return idx >= 0 ? idx + 1 : 1;
  }, [evaluatedCandidates, selectedCandidateId]);

  const selectedEdgeNotes = useMemo(
    () => (selectedCandidate ? gridEdgeNotes(selectedCandidate, lastRun?.capM) : []),
    [selectedCandidate, lastRun]
  );

  const selectedShowcase = useMemo(() => {
    if (!showcaseWinners || showcaseWinners.length === 0) return null;
    return showcaseWinners.find((w) => w.regionPreset.id === showcaseRegionId) ?? showcaseWinners[0];
  }, [showcaseWinners, showcaseRegionId]);

  // Apply selected candidate to active workspace using existing context actions
  const handleApplyToActive = useCallback(() => {
    if (!selectedCandidate) return;
    setWallLayers(selectedCandidate.config.wallLayers);
    setRoofLayers(selectedCandidate.config.roofLayers);
    updateGeometry({
      length_m: selectedCandidate.config.geometry.length_m,
      width_m: selectedCandidate.config.geometry.width_m,
      height_m: selectedCandidate.config.geometry.height_m,
    });
    setApplySuccessMsg(
      `Successfully applied Rank #${selectedRank} design (${selectedCandidate.wallDescription}) to active workspace!`
    );
    setTimeout(() => {
      setApplySuccessMsg(null);
    }, 4000);
  }, [selectedCandidate, selectedRank, setWallLayers, setRoofLayers, updateGeometry]);

  // Check if showcase winners are identical across any regions
  const identicalShowcaseNote = useMemo(() => {
    if (!showcaseWinners || showcaseWinners.length < 2) return null;
    const pairs: string[] = [];
    for (let i = 0; i < showcaseWinners.length; i++) {
      for (let j = i + 1; j < showcaseWinners.length; j++) {
        const wA = showcaseWinners[i].winner;
        const wB = showcaseWinners[j].winner;
        const sameWall = wA.wallDescription === wB.wallDescription;
        const sameRoof = wA.roofDescription === wB.roofDescription;
        const sameGeom =
          wA.length_m === wB.length_m && wA.width_m === wB.width_m && wA.height_m === wB.height_m;
        if (sameWall && sameRoof && sameGeom) {
          pairs.push(`${showcaseWinners[i].regionPreset.name} and ${showcaseWinners[j].regionPreset.name}`);
        }
      }
    }
    return pairs.length > 0 ? pairs.join(', ') : null;
  }, [showcaseWinners]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-slate-100">
              Parametric Design Recommender
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Generates, simulates (steady daily cycle), and ranks envelope designs for local material availability &bull;{' '}
            <span className="text-amber-400 font-mono font-medium">{SEARCH_GRID_NOTICE}</span>
          </p>
        </div>
        <div className="text-xs font-mono text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
          Climate: <strong className="text-slate-200">{config.ambientClimate.regionName}</strong>
        </div>
      </div>

      {/* Mandatory Engineering Limitations Disclosure Banner */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1.5">
          <p className="font-semibold text-amber-300">
            Design Recommender Assumptions & Engineering Limitations — Verify Before Physical Deployment
          </p>
          <ul className="list-disc list-inside space-y-0.5 text-amber-200/80 leading-relaxed">
            <li>
              <strong>Fixed Orientation & Apertures:</strong> Orientation, opening area, and glazing are held fixed; the thermal engine does not model solar incidence angles or fenestration U-values.
            </li>
            <li>
              <strong>Ground Conduction:</strong> Heat transfer through floor slab and foundation soil is unmodeled in the lumped-capacitance nodal solver.
            </li>
            <li>
              <strong>Night Sky Depression:</strong> Clear-sky depression (ΔT_sky = {DEFAULT_SKY_TEMP_OFFSET_C} °C) uses default engineering reference values.
            </li>
            <li>
              <strong>Steady Daily Cycle:</strong> Simulates repeated 24-hour diurnal cycles until day-start inside temperature converges (tolerance {STEADY_CYCLE_TOLERANCE_C} °C).
            </li>
            <li>
              <strong>Solar Gain:</strong> Absorbed solar heat is applied directly to the interior node, so absolute inside temperatures are illustrative. Use the results to compare designs, not as predicted temperatures.
            </li>
            <li>
              <strong>Ranking:</strong> Designs are ranked on simulated inside temperatures by the selected design goal. The efficiency score η is not used: at a steady daily cycle it is about zero and only reflects thermal capacitance.
            </li>
            <li>
              <strong>Empirical Property Verification:</strong> Literature thermophysical properties must be validated against actual local material specimens.
            </li>
          </ul>
        </div>
      </div>

      {/* Setup Section */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
          <Sliders className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-slate-200">Recommender Configuration</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Available Materials Checkbox List */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                Materials Available at this Site:
              </label>
              <span className="text-[11px] font-mono text-slate-400">
                {selectedMaterialIds.length} of {wallMaterialCount} selected
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {config.materialsLibrary.map((mat) => {
                const nonWall = isNonWallMaterial(mat.id);
                const isSelected = !nonWall && selectedMaterialIds.includes(mat.id);
                return (
                  <label
                    key={mat.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-xs ${
                      nonWall ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                    } transition-all ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/40 text-slate-100'
                        : 'bg-slate-850/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={nonWall}
                      onChange={() => handleToggleMaterial(mat.id)}
                      className="mt-0.5 rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-900"
                    />
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-200">{mat.name}</div>
                      <div className="font-mono text-[11px] text-slate-400">
                        k: {mat.conductivity_k} W/m·K &bull; ρ: {mat.density} kg/m³ &bull; c: {mat.specificHeat_c} J/kg·K
                      </div>
                      {nonWall && (
                        <div className="text-[11px] text-slate-500">Aperture material, not used for walls</div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            {selectedMaterialIds.length === 0 && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>At least one material must be selected. Select available materials to run recommendation search.</span>
              </div>
            )}
          </div>

          {/* Search Controls */}
          <div className="space-y-4">
            {/* Design goal */}
            <div className="space-y-1.5">
              <label
                htmlFor="design-goal"
                className="text-xs font-semibold text-slate-300 flex items-center justify-between"
              >
                <span>Design goal:</span>
                <span className="text-[11px] font-normal text-slate-500">Ranks the designs</span>
              </label>
              <select
                id="design-goal"
                value={goal}
                onChange={(e) => setGoalOverride(e.target.value as DesignGoal)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              >
                {DESIGN_GOALS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label} — {g.metricLabel}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500">{getGoalInfo(goal).description}</p>
            </div>

            {/* Max total wall thickness */}
            <div className="space-y-1.5">
              <label
                htmlFor="max-wall-thickness"
                className="text-xs font-semibold text-slate-300 flex items-center justify-between"
              >
                <span>Max total wall thickness (mm):</span>
                <span className="text-[11px] font-normal text-slate-500">Optional</span>
              </label>
              <input
                id="max-wall-thickness"
                type="number"
                min="0"
                step="10"
                value={capInput}
                onChange={(e) => setCapInputOverride(e.target.value)}
                placeholder="no limit"
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <p className="text-[11px] text-slate-500">
                Pre-filled with the search grid's own upper bound (2× the current wall). Clear the field to remove the
                limit.
              </p>
            </div>

            {/* Optional Target Minimum Temperature */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Target Min Inside Temp (°C):</span>
                <span className="text-[11px] font-normal text-slate-500">Optional</span>
              </label>
              <input
                type="number"
                step="0.5"
                value={targetMinTempInput}
                onChange={(e) => setTargetMinTempInput(e.target.value)}
                placeholder="e.g. 5.0 (empty = no target)"
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <p className="text-[11px] text-slate-500">
                Designs failing this threshold are marked "Does not meet target" and ranked after passing designs.
              </p>
            </div>

            {/* Also vary roof assembly */}
            <div className="pt-2">
              <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={alsoVaryRoof}
                  onChange={(e) => setAlsoVaryRoof(e.target.checked)}
                  className="mt-0.5 rounded border-slate-750 text-amber-500 focus:ring-amber-500 bg-slate-850"
                />
                <div>
                  <span className="font-semibold block">Also vary roof assembly</span>
                  <span className="text-[11px] text-slate-500">
                    If unchecked, the roof stays as in the current configuration. Varying the roof multiplies the search grid many times over, so only a sample of it is evaluated and the ranking is approximate.
                  </span>
                </div>
              </label>
            </div>

            {/* Run Button */}
            <div className="pt-3">
              <button
                type="button"
                onClick={handleRunSearch}
                disabled={isEvaluating || selectedMaterialIds.length === 0}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 text-white disabled:text-slate-500 text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2"
              >
                {isEvaluating ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>{progressText || 'Evaluating...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Run Design Recommender</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results Section */}
      {evaluatedCandidates && (
        <div className="space-y-6">
          {/* Results Summary Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-slate-200">
                Top Recommended Architectural Configurations
              </span>
            </div>
            <div className="font-mono text-slate-400">
              {generationMeta?.isSubsampled ? (
                <span>
                  Showing top 10 of {generationMeta.evaluatedCount} evaluated (subsampled from {generationMeta.totalGenerated} grid permutations)
                </span>
              ) : (
                <span>
                  Showing top 10 of {generationMeta?.evaluatedCount ?? evaluatedCandidates.length} evaluated
                </span>
              )}
            </div>
          </div>

          {lastRun && (
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-0.5">
              <p>
                Ranked by <strong className="text-slate-200">{getGoalInfo(lastRun.goal).label}</strong> (
                {getGoalInfo(lastRun.goal).metricLabel}). Designs that did not reach a steady daily cycle rank after
                those that did. The efficiency score η is not used: at a steady daily cycle it is about zero.
              </p>
              {generationMeta && generationMeta.droppedByThicknessCap > 0 && lastRun.capM !== undefined && (
                <p>
                  {generationMeta.droppedByThicknessCap} grid combinations were skipped by the max total wall thickness
                  of {Math.round(lastRun.capM * 1000)} mm.
                </p>
              )}
              {generationMeta && generationMeta.evaluatedCount === 0 && (
                <p className="text-rose-300">
                  No candidate designs fit these limits. Select at least one wall material or raise the wall thickness
                  limit.
                </p>
              )}
              {(lastRun.goal !== goal ||
                lastRun.capM !== maxTotalWallThickness_m ||
                lastRun.target !== targetMinTempC) && (
                <p className="text-amber-300">
                  Settings changed since this run. Run the recommender again to update the ranking.
                </p>
              )}
            </div>
          )}

          {/* Results Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/90 shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-850/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3">Rank</th>
                  <th className="py-3 px-3">Wall Assembly</th>
                  <th className="py-3 px-3">Roof Assembly</th>
                  <th className="py-3 px-3">Dimensions (L×W×H)</th>
                  <th className="py-3 px-2 text-right">U_wall (W/m²K)</th>
                  <th className="py-3 px-2 text-right">Cap. (MJ/K)</th>
                  <th className="py-3 px-3 text-right">Min / Avg / Max (°C)</th>
                  <th className="py-3 px-2 text-right">Swing (°C)</th>
                  <th className="py-3 px-3 text-center">Target Status</th>
                  <th className="py-3 px-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {/* Baseline Row */}
                <tr
                  onClick={() => setSelectedCandidateId(baseline.id)}
                  className={`cursor-pointer transition-colors ${
                    selectedCandidateId === baseline.id
                      ? 'bg-amber-500/15 text-amber-200'
                      : 'bg-slate-850/40 text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  <td className="py-3 px-3 font-bold text-slate-400">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-sans uppercase">
                      Baseline
                    </span>
                  </td>
                  <td className="py-3 px-3 font-sans text-slate-200">{baseline.wallDescription}</td>
                  <td className="py-3 px-3 font-sans text-slate-400">{baseline.roofDescription}</td>
                  <td className="py-3 px-3">{baseline.dimensionsDescription}</td>
                  <td className="py-3 px-2 text-right">{baseline.wallUValue.toFixed(3)}</td>
                  <td className="py-3 px-2 text-right">{(baseline.thermalCapacitance / 1e6).toFixed(2)}</td>
                  <td className="py-3 px-3 text-right">
                    {baseline.min.toFixed(1)} / {baseline.avg.toFixed(1)} / {baseline.peak.toFixed(1)}
                    {!baseline.converged && (
                      <span className="block text-[10px] font-sans text-amber-400">not converged</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right font-bold text-amber-400">
                    {baseline.swing.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-center font-sans">
                    {targetMinTempC !== undefined ? (
                      baseline.meetsTarget ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">
                          Target Met
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px]">
                          Below Target
                        </span>
                      )
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-center font-sans">
                    <span className="text-[11px] text-slate-400 underline">Select</span>
                  </td>
                </tr>

                {/* Top 10 Candidate Rows */}
                {topCandidates.map((cand, idx) => {
                  const isSelected = selectedCandidateId === cand.id;
                  const rank = idx + 1;
                  return (
                    <tr
                      key={cand.id}
                      onClick={() => setSelectedCandidateId(cand.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-amber-500/20 text-amber-100'
                          : 'hover:bg-slate-800/40 text-slate-300'
                      }`}
                    >
                      <td className="py-3 px-3 font-bold text-slate-100">
                        <span
                          className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs ${
                            rank === 1
                              ? 'bg-amber-500 text-slate-950 font-extrabold'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          #{rank}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-sans text-slate-100 font-medium">
                        {cand.wallDescription}
                      </td>
                      <td className="py-3 px-3 font-sans text-slate-400 text-xs">
                        {cand.roofDescription}
                      </td>
                      <td className="py-3 px-3">{cand.dimensionsDescription}</td>
                      <td className="py-3 px-2 text-right">{cand.wallUValue.toFixed(3)}</td>
                      <td className="py-3 px-2 text-right">{(cand.thermalCapacitance / 1e6).toFixed(2)}</td>
                      <td className="py-3 px-3 text-right">
                        {cand.min.toFixed(1)} / {cand.avg.toFixed(1)} / {cand.peak.toFixed(1)}
                        {!cand.converged && (
                          <span className="block text-[10px] font-sans text-amber-400">not converged</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right font-bold text-amber-400">
                        {cand.swing.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-center font-sans">
                        {targetMinTempC !== undefined ? (
                          cand.meetsTarget ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">
                              Target Met
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px]">
                              Below Target
                            </span>
                          )
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center font-sans">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCandidateId(cand.id);
                          }}
                          className={`text-xs px-2 py-1 rounded transition-colors ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950 font-bold'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {isSelected ? 'Viewing' : 'Inspect'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Selected Design Inspection & Side-by-Side 3D Viewer */}
          {selectedCandidate && (
            <div className="p-5 rounded-2xl bg-slate-900 border border-amber-500/30 space-y-4 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <span className="text-[11px] uppercase tracking-wider font-bold text-amber-400">
                    Selected Architectural Inspection &bull; Rank #{selectedRank}
                  </span>
                  <h4 className="text-sm font-bold text-white mt-0.5">
                    {selectedCandidate.wallDescription} &bull; {selectedCandidate.dimensionsDescription}
                  </h4>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleApplyToActive}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-all"
                  >
                    <Check className="w-4 h-4" />
                    <span>Apply to Active Config</span>
                  </button>
                </div>
              </div>

              {applySuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{applySuccessMsg}</span>
                </div>
              )}

              {/* Number-Only Explanation Line (Rule 4) */}
              <div className="p-3.5 rounded-xl bg-slate-850/80 border border-slate-800 text-xs font-mono text-slate-300">
                <div className="text-[11px] font-sans font-bold text-slate-400 mb-1">
                  Computed Physical Metrics &amp; Explanation:
                </div>
                <div>{buildExplanationString(selectedCandidate, lastRun?.goal ?? goal)}</div>
              </div>

              {selectedRank === 1 && selectedEdgeNotes.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Best design sits at the edge of the search grid ({selectedEdgeNotes.join('; ')}). A wider grid might
                    rank higher.
                  </span>
                </div>
              )}

              {/* Side-by-Side 3D Comparison with Baseline */}
              <div className="space-y-2 pt-2">
                <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <Box className="w-4 h-4 text-amber-400" />
                  <span>3D Envelope Comparison: Selected Candidate vs. Active Baseline</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {selectedCandidate.results && (
                    <div className="rounded-xl overflow-hidden border border-amber-500/30 bg-slate-950">
                      <div className="px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-xs font-bold text-amber-300">
                        Rank #{selectedRank} Recommended Design
                      </div>
                      <ShelterViewer
                        config={selectedCandidate.config}
                        simulation={selectedCandidate.results}
                        title={`#${selectedRank} Design`}
                        compact
                      />
                    </div>
                  )}

                  {baseline.results && (
                    <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                      <div className="px-3 py-1.5 bg-slate-850 border-b border-slate-800 text-xs font-bold text-slate-400">
                        Current Baseline Design
                      </div>
                      <ShelterViewer
                        config={baseline.config}
                        simulation={baseline.results}
                        title="Baseline"
                        compact
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Region Showcase Section (Item 4) */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-bold text-slate-100">Regional Climate Showcase</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulates candidate designs across all 3 regional climate presets using respective baseline geometries and local material availability. Each region is ranked by its own design goal, with a total wall thickness of at most 2× its preset wall.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRunShowcase}
            disabled={isShowcaseRunning}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold shadow-sm transition-all"
          >
            {isShowcaseRunning ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>{showcaseProgress || 'Evaluating Showcase...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Run Regional Showcase</span>
              </>
            )}
          </button>
        </div>

        {/* Region Showcase Winners Table & 3D Preview */}
        {showcaseWinners && selectedShowcase && (
          <div className="space-y-6">
            {identicalShowcaseNote && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Notice: {identicalShowcaseNote} share identical winning design assemblies under simulation.</span>
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-850/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-3">Region Preset</th>
                    <th className="py-3 px-3">Design Goal</th>
                    <th className="py-3 px-3">Winning Wall Assembly</th>
                    <th className="py-3 px-3">Winning Roof</th>
                    <th className="py-3 px-3">Dimensions (L×W×H)</th>
                    <th className="py-3 px-2 text-right">U_wall (W/m²K)</th>
                    <th className="py-3 px-3 text-right">Goal metric: winner vs preset design</th>
                    <th className="py-3 px-3 text-right">Min / Avg / Max (°C)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {showcaseWinners.map(({ regionPreset, winner, goal: regionGoal, presetDesign }) => {
                    const info = getGoalInfo(regionGoal);
                    const isViewing = selectedShowcase.regionPreset.id === regionPreset.id;
                    return (
                      <tr
                        key={regionPreset.id}
                        onClick={() => setShowcaseRegionId(regionPreset.id)}
                        className={`cursor-pointer transition-colors ${
                          isViewing ? 'bg-amber-500/10 text-amber-100' : 'hover:bg-slate-850/40 text-slate-300'
                        }`}
                      >
                        <td className="py-3 px-3 font-sans font-bold text-slate-100">{regionPreset.name}</td>
                        <td className="py-3 px-3 font-sans text-slate-300">{info.label}</td>
                        <td className="py-3 px-3 font-sans text-amber-200 font-medium">{winner.wallDescription}</td>
                        <td className="py-3 px-3 font-sans text-slate-400">{winner.roofDescription}</td>
                        <td className="py-3 px-3">{winner.dimensionsDescription}</td>
                        <td className="py-3 px-2 text-right">{winner.wallUValue.toFixed(3)}</td>
                        <td className="py-3 px-3 text-right">
                          <span className="text-emerald-400 font-bold">
                            {candidateGoalMetric(winner, regionGoal).toFixed(2)}
                          </span>
                          <span className="text-slate-500"> vs {candidateGoalMetric(presetDesign, regionGoal).toFixed(2)}</span>
                          <span className="block text-[10px] font-sans text-slate-500">{info.metricLabel}</span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {winner.min.toFixed(1)} / {winner.avg.toFixed(1)} / {winner.peak.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* One full-width viewer with a region switcher */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <Box className="w-4 h-4 text-amber-400" />
                  <span>3D view of the regional winner</span>
                </span>
                <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Region winner">
                  {showcaseWinners.map(({ regionPreset }) => {
                    const isViewing = selectedShowcase.regionPreset.id === regionPreset.id;
                    return (
                      <button
                        key={regionPreset.id}
                        type="button"
                        role="tab"
                        aria-selected={isViewing}
                        onClick={() => setShowcaseRegionId(regionPreset.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          isViewing
                            ? 'bg-amber-500 text-slate-950 border-amber-500'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {shortRegionName(regionPreset.name)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-md">
                <div className="p-3 bg-slate-850 border-b border-slate-800 text-xs space-y-0.5">
                  <span className="font-bold text-slate-200 block">{selectedShowcase.regionPreset.name}</span>
                  <span className="text-[11px] text-amber-400 font-mono block">
                    Goal: {getGoalInfo(selectedShowcase.goal).label} &bull; {selectedShowcase.winner.wallDescription}{' '}
                    &bull; {selectedShowcase.winner.dimensionsDescription}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono block">
                    Min {selectedShowcase.winner.min.toFixed(1)} / Avg {selectedShowcase.winner.avg.toFixed(1)} / Max{' '}
                    {selectedShowcase.winner.peak.toFixed(1)} / Swing {selectedShowcase.winner.swing.toFixed(1)} °C
                    &bull; {selectedShowcase.evaluatedCount} designs evaluated
                  </span>
                  {gridEdgeNotes(selectedShowcase.winner, selectedShowcase.capM).length > 0 && (
                    <span className="text-[11px] text-slate-500 block">
                      At the edge of the search grid:{' '}
                      {gridEdgeNotes(selectedShowcase.winner, selectedShowcase.capM).join('; ')}.
                    </span>
                  )}
                </div>
                {selectedShowcase.winner.results && (
                  <ShelterViewer
                    config={selectedShowcase.winner.config}
                    simulation={selectedShowcase.winner.results}
                    title={shortRegionName(selectedShowcase.regionPreset.name)}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
