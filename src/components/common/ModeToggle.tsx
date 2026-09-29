import React from 'react';
import { Zap, SlidersHorizontal } from 'lucide-react';
import { useShelter } from '../../context/ShelterContext';

export const ModeToggle: React.FC = () => {
  const { mode, setMode } = useShelter();

  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-4 rounded-xl bg-palette-card border border-palette-border shadow-sm backdrop-blur-sm">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider font-semibold text-palette-yellow">
            Configuration Mode
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-palette-raised text-palette-text-secondary font-mono whitespace-nowrap">
            Shared Underlying Physical State
          </span>
        </div>
        <p className="text-sm text-palette-text-secondary mt-0.5">
          {mode === 'quick'
            ? 'Quick Mode: 1-click presets, slider adjustments, and visual material cards.'
            : 'Advanced Mode: Full 24-hr profile editing, CSV import, multi-layer walls, and custom materials.'}
        </p>
      </div>

      <div className="inline-flex p-1 rounded-lg bg-palette-raised border border-palette-border shrink-0 self-start">
        <button
          type="button"
          onClick={() => setMode('quick')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-sm font-medium transition-all ${
            mode === 'quick'
              ? 'bg-palette-violet text-palette-text-primary shadow-sm font-semibold'
              : 'text-palette-text-secondary hover:text-palette-text-primary hover:bg-palette-card'
          }`}
        >
          <Zap className={`w-4 h-4 ${mode === 'quick' ? 'text-palette-yellow' : 'text-palette-text-muted'}`} />
          <span>Quick Mode</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('advanced')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-sm font-medium transition-all ${
            mode === 'advanced'
              ? 'bg-palette-magenta text-palette-text-primary shadow-sm font-semibold'
              : 'text-palette-text-secondary hover:text-palette-text-primary hover:bg-palette-card'
          }`}
        >
          <SlidersHorizontal className={`w-4 h-4 ${mode === 'advanced' ? 'text-palette-yellow' : 'text-palette-text-muted'}`} />
          <span>Advanced Mode</span>
        </button>
      </div>
    </div>
  );
};
