import React from 'react';
import { Compass, Code2, AlertTriangle, Globe } from 'lucide-react';
import { useShelter } from '../../context/ShelterContext';

export const Header: React.FC = () => {
  const { config, setIsReviewOpen, validationIssues } = useShelter();

  const errorCount = validationIssues.filter((i) => i.severity === 'error').length;
  const warningCount = validationIssues.filter((i) => i.severity === 'warning').length;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 bg-palette-card/95 border-b border-palette-border backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-palette-violet via-palette-magenta to-palette-pink-red flex items-center justify-center shadow-md">
          <Compass className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-base sm:text-lg font-black tracking-tight text-palette-text-primary flex items-center gap-1.5">
              <span>SHELTER-X</span>
              <span className="text-palette-text-muted font-normal text-xs sm:text-sm">/ ThermoShelter Designer</span>
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-palette-yellow text-palette-page">
              <Globe className="w-3 h-3 text-palette-page" />
              SIH-PS2
            </span>
          </div>
          <p className="text-xs text-palette-text-secondary hidden sm:block">
            Area-Specific Passive Shelter Thermal Comfort Decision Support (Cold Regions / High Altitude)
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className="text-right hidden md:block">
          <span className="text-[11px] text-palette-text-muted block">Active Location Profile</span>
          <span className="text-xs font-semibold text-palette-yellow truncate max-w-[220px] block">
            {config.ambientClimate.regionName}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsReviewOpen(true)}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-palette-violet hover:bg-palette-violet-hover text-palette-text-primary border border-palette-magenta/40 text-xs sm:text-sm font-semibold transition-colors shadow-sm"
          title="Review complete shelter state as formatted JSON"
        >
          <Code2 className="w-4 h-4 text-palette-yellow" />
          <span className="hidden xs:inline">Review Inputs</span>
          {errorCount > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-palette-pink-red text-palette-page font-bold text-xs">
              <AlertTriangle className="w-3 h-3" />
              {errorCount}
            </span>
          )}
          {errorCount === 0 && warningCount > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-palette-yellow text-palette-page font-bold text-xs">
              {warningCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
