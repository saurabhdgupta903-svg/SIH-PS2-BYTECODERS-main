import React from 'react';
import { Sliders, LineChart, SplitSquareVertical, Box, Layers, Thermometer, Sparkles, Activity, FileText } from 'lucide-react';
import { useShelter } from '../../context/ShelterContext';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, config } = useShelter();

  const totalWallThickness_mm = Math.round(
    config.wallLayers.reduce((acc, l) => acc + (l.thickness_m || 0), 0) * 1000
  );

  const totalRoofThickness_mm = Math.round(
    config.roofLayers.reduce((acc, l) => acc + (l.thickness_m || 0), 0) * 1000
  );

  return (
    <aside className="w-full md:w-64 bg-palette-card border-r border-palette-border flex flex-col justify-between p-4 shrink-0">
      <div className="space-y-6">
        <div>
          <span className="text-[11px] font-semibold text-palette-text-muted uppercase tracking-wider px-2">
            Navigation
          </span>
          <nav className="mt-2 space-y-1">
            {/* Inputs Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('inputs')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'inputs'
                  ? 'bg-palette-violet text-palette-text-primary border border-palette-magenta/50 shadow-sm'
                  : 'text-palette-text-secondary hover:text-palette-text-primary hover:bg-palette-raised'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Sliders className={`w-4 h-4 ${activeTab === 'inputs' ? 'text-palette-yellow' : 'text-palette-text-muted'}`} />
                <span>Inputs</span>
              </div>
              {activeTab === 'inputs' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-palette-yellow text-palette-page font-bold font-mono">
                  Active
                </span>
              )}
            </button>

            {/* Results Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('results')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'results'
                  ? 'bg-palette-violet text-palette-text-primary border border-palette-magenta/50 shadow-sm'
                  : 'text-palette-text-secondary hover:text-palette-text-primary hover:bg-palette-raised'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <LineChart className={`w-4 h-4 ${activeTab === 'results' ? 'text-palette-yellow' : 'text-palette-text-muted'}`} />
                <span>Results</span>
              </div>
              {activeTab === 'results' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-palette-yellow text-palette-page font-bold font-mono">
                  Active
                </span>
              )}
            </button>

            {/* Compare Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('compare')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'compare'
                  ? 'bg-palette-violet text-palette-text-primary border border-palette-magenta/50 shadow-sm'
                  : 'text-palette-text-secondary hover:text-palette-text-primary hover:bg-palette-raised'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <SplitSquareVertical className={`w-4 h-4 ${activeTab === 'compare' ? 'text-palette-yellow' : 'text-palette-text-muted'}`} />
                <span>Compare</span>
              </div>
              {activeTab === 'compare' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-palette-yellow text-palette-page font-bold font-mono">
                  Active
                </span>
              )}
            </button>

            {/* 3D View Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('3d')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === '3d'
                  ? 'bg-palette-violet text-palette-text-primary border border-palette-magenta/50 shadow-sm'
                  : 'text-palette-text-secondary hover:text-palette-text-primary hover:bg-palette-raised'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Box className={`w-4 h-4 ${activeTab === '3d' ? 'text-palette-yellow' : 'text-palette-text-muted'}`} />
                <span>3D View</span>
              </div>
              {activeTab === '3d' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-palette-yellow text-palette-page font-bold font-mono">
                  Active
                </span>
              )}
            </button>

            {/* Design Recommender Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('recommender')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'recommender'
                  ? 'bg-palette-violet text-palette-text-primary border border-palette-magenta/50 shadow-sm'
                  : 'text-palette-text-secondary hover:text-palette-text-primary hover:bg-palette-raised'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className={`w-4 h-4 ${activeTab === 'recommender' ? 'text-palette-yellow' : 'text-palette-text-muted'}`} />
                <span>Recommender</span>
              </div>
              {activeTab === 'recommender' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-palette-yellow text-palette-page font-bold font-mono">
                  Active
                </span>
              )}
            </button>

            {/* Sensitivity Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('sensitivity')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'sensitivity'
                  ? 'bg-palette-violet text-palette-text-primary border border-palette-magenta/50 shadow-sm'
                  : 'text-palette-text-secondary hover:text-palette-text-primary hover:bg-palette-raised'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Activity className={`w-4 h-4 ${activeTab === 'sensitivity' ? 'text-palette-yellow' : 'text-palette-text-muted'}`} />
                <span>Sensitivity</span>
              </div>
              {activeTab === 'sensitivity' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-palette-yellow text-palette-page font-bold font-mono">
                  Active
                </span>
              )}
            </button>

            {/* Report Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('report')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'report'
                  ? 'bg-palette-violet text-palette-text-primary border border-palette-magenta/50 shadow-sm'
                  : 'text-palette-text-secondary hover:text-palette-text-primary hover:bg-palette-raised'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileText className={`w-4 h-4 ${activeTab === 'report' ? 'text-palette-yellow' : 'text-palette-text-muted'}`} />
                <span>Report</span>
              </div>
              {activeTab === 'report' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-palette-yellow text-palette-page font-bold font-mono">
                  Active
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Live Physical State Card */}
        <div className="p-3.5 rounded-xl bg-palette-raised border border-palette-border space-y-3">
          <span className="text-[11px] font-semibold text-palette-text-muted uppercase tracking-wider block">
            Envelope Status
          </span>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between text-palette-text-secondary">
              <span className="flex items-center gap-1.5 text-palette-text-muted">
                <Box className="w-3.5 h-3.5 text-palette-yellow" />
                Footprint
              </span>
              <span className="font-mono font-medium text-palette-text-primary">
                {(config.geometry.length_m * config.geometry.width_m).toFixed(1)} m²
              </span>
            </div>

            <div className="flex items-center justify-between text-palette-text-secondary">
              <span className="flex items-center gap-1.5 text-palette-text-muted">
                <Layers className="w-3.5 h-3.5 text-palette-magenta" />
                Wall Envelope
              </span>
              <span className="font-mono font-medium text-palette-text-primary">{totalWallThickness_mm} mm</span>
            </div>

            <div className="flex items-center justify-between text-palette-text-secondary">
              <span className="flex items-center gap-1.5 text-palette-text-muted">
                <Layers className="w-3.5 h-3.5 text-palette-magenta" />
                Roof Deck
              </span>
              <span className="font-mono font-medium text-palette-text-primary">{totalRoofThickness_mm} mm</span>
            </div>

            <div className="flex items-center justify-between text-palette-text-secondary">
              <span className="flex items-center gap-1.5 text-palette-text-muted">
                <Thermometer className="w-3.5 h-3.5 text-palette-pink-red" />
                Openings
              </span>
              <span className="font-mono font-medium text-palette-text-primary">
                {config.geometry.openings.reduce((sum, o) => sum + o.count, 0)} apertures
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="pt-4 border-t border-palette-border text-[11px] text-palette-text-muted space-y-1">
        <p className="text-palette-text-secondary font-medium">SHELTER-X v1.0</p>
        <p>Smart India Hackathon &bull; DRDO PS 26051</p>
      </div>
    </aside>
  );
};
