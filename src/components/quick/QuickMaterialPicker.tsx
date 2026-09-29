import React from 'react';
import { Layers, Check } from 'lucide-react';
import { useShelter } from '../../context/ShelterContext';
import { VerificationBadge } from '../common/VerificationBadge';

export const QuickMaterialPicker: React.FC = () => {
  const { config, setQuickMaterial } = useShelter();

  // Selected material in Quick Mode is determined by wallLayers[0]
  const currentMaterialId = config.wallLayers[0]?.materialId || '';

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-palette-text-primary flex items-center gap-2">
            <Layers className="w-4 h-4 text-palette-yellow" />
            <span>3. Primary Envelope Material</span>
          </h3>
          <p className="text-xs text-palette-text-secondary">
            Clicking a material assigns it as a single-layer wall and roof default.
          </p>
        </div>
        {config.materialsLibrary.some((m) => m.isDefaultReference) && <VerificationBadge />}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {config.materialsLibrary.map((material) => {
          const isSelected = currentMaterialId === material.id;

          return (
            <button
              key={material.id}
              type="button"
              onClick={() => setQuickMaterial(material.id)}
              className={`text-left p-3.5 rounded-xl border transition-all relative flex flex-col justify-between ${
                isSelected
                  ? 'bg-palette-raised border-palette-yellow ring-2 ring-palette-yellow/40 shadow-md'
                  : 'bg-palette-card hover:bg-palette-raised border-palette-border hover:border-palette-magenta/50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="text-xs font-bold text-palette-text-primary line-clamp-1">
                    {material.name}
                  </span>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-palette-yellow text-palette-page flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-palette-text-secondary line-clamp-2 leading-relaxed mb-3">
                  {material.description || 'Thermophysical envelope material.'}
                </p>
              </div>

              {/* Physical properties with units */}
              <div className="pt-2.5 border-t border-palette-border space-y-1 font-mono text-[11px] text-palette-text-secondary">
                <div className="flex justify-between items-center">
                  <span className="text-palette-text-muted font-sans text-[10px]">k (W/m·K)</span>
                  <span className="font-semibold text-palette-yellow">{material.conductivity_k}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-palette-text-muted font-sans text-[10px]">Density</span>
                  <span className="text-palette-text-primary">{material.density} kg/m³</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-palette-text-muted font-sans text-[10px]">Specific Heat</span>
                  <span className="text-palette-text-primary">{material.specificHeat_c} J/kg·K</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-palette-text-muted font-sans text-[10px]">Absorptivity α</span>
                  <span className="text-palette-text-primary">{material.solarAbsorptivity}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-palette-text-muted font-sans text-[10px]">Emissivity ε</span>
                  <span className="text-palette-text-primary">{material.thermalEmissivity}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
