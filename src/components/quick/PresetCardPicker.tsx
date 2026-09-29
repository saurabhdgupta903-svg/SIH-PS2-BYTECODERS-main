import React from 'react';
import { Check, Sun, Snowflake, CloudSun } from 'lucide-react';
import { useShelter } from '../../context/ShelterContext';
import { REGION_PRESETS } from '../../data/regionPresets';

export const PresetCardPicker: React.FC = () => {
  const { config, loadPreset } = useShelter();

  const getPresetIcon = (id: string) => {
    switch (id) {
      case 'cold_high_altitude_desert':
        return <Snowflake className="w-5 h-5 text-palette-pink-red" />;
      case 'hot_arid_climate':
        return <Sun className="w-5 h-5 text-palette-yellow" />;
      case 'temperate_climate':
      default:
        return <CloudSun className="w-5 h-5 text-palette-magenta" />;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-palette-text-primary">
            1. Climate & Region Presets
          </h3>
          <p className="text-xs text-palette-text-secondary">
            Clicking a preset instantly populates benchmark climate, materials, and geometry defaults.
          </p>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-palette-raised text-palette-yellow border border-palette-border self-start sm:self-auto font-medium">
          Instant State Initialization
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {REGION_PRESETS.map((preset) => {
          const isSelected = config.activePresetId === preset.id;
          const temps = preset.ambientClimate.hourlyProfile.map((p) => p.temperature_C);
          const minTemp = Math.min(...temps);
          const maxTemp = Math.max(...temps);
          const maxSolar = Math.max(...preset.ambientClimate.hourlyProfile.map((p) => p.irradiance_wm2));

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => loadPreset(preset.id)}
              className={`text-left p-4 rounded-xl border transition-all relative flex flex-col justify-between ${
                isSelected
                  ? 'bg-palette-raised border-palette-yellow ring-2 ring-palette-yellow/40 shadow-lg'
                  : 'bg-palette-card hover:bg-palette-raised border-palette-border hover:border-palette-magenta/50'
              }`}
            >
              <div>
                {/* Header with Icon and selection check */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-palette-page border border-palette-border">
                      {getPresetIcon(preset.id)}
                    </div>
                    <span className="text-sm font-bold text-palette-text-primary line-clamp-1">
                      {preset.name}
                    </span>
                  </div>
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-palette-yellow text-palette-page flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  )}
                </div>

                {/* Sample data disclaimer */}
                <div className="mb-2">
                  <span className="inline-block text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded bg-palette-card text-palette-yellow border border-palette-border">
                    {preset.disclaimer}
                  </span>
                </div>

                <p className="text-xs text-palette-text-secondary leading-relaxed mb-3">
                  {preset.climateSummary}
                </p>
              </div>

              {/* Stat badges */}
              <div className="pt-3 border-t border-palette-border flex items-center justify-between text-xs font-mono text-palette-text-secondary">
                <div>
                  <span className="text-[10px] uppercase text-palette-text-muted block font-sans">
                    Diurnal Swing
                  </span>
                  <span className="text-palette-text-primary">
                    {minTemp > 0 ? `+${minTemp}` : minTemp}°C to {maxTemp > 0 ? `+${maxTemp}` : maxTemp}°C
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase text-palette-text-muted block font-sans">
                    Peak Sun
                  </span>
                  <span className="text-palette-yellow font-bold">{maxSolar} W/m²</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
