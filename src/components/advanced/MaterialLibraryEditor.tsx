import React, { useState } from 'react';
import { Layers, Plus, Sparkles } from 'lucide-react';
import { useShelter } from '../../context/ShelterContext';
import { VerificationBadge } from '../common/VerificationBadge';
import { NumberInput } from '../common/NumberInput';

export const MaterialLibraryEditor: React.FC = () => {
  const { config, updateMaterial, addCustomMaterial } = useShelter();
  const [showAddForm, setShowAddForm] = useState(false);

  // New material form state
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newK, setNewK] = useState('0.80');
  const [newRho, setNewRho] = useState('1800');
  const [newC, setNewC] = useState('850');
  const [newAlpha, setNewAlpha] = useState('0.70');
  const [newEpsilon, setNewEpsilon] = useState('0.90');

  const handleCreateMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const parsedK = parseFloat(newK);
    const parsedRho = parseFloat(newRho);
    const parsedC = parseFloat(newC);
    const parsedAlpha = parseFloat(newAlpha);
    const parsedEpsilon = parseFloat(newEpsilon);

    addCustomMaterial({
      name: newName.trim(),
      description: newDesc.trim() || 'User defined custom material',
      conductivity_k: Number.isFinite(parsedK) && parsedK > 0 ? parsedK : 0.5,
      density: Number.isFinite(parsedRho) && parsedRho > 0 ? parsedRho : 1500,
      specificHeat_c: Number.isFinite(parsedC) && parsedC > 0 ? parsedC : 800,
      solarAbsorptivity: Math.min(1, Math.max(0, Number.isFinite(parsedAlpha) ? parsedAlpha : 0.7)),
      thermalEmissivity: Math.min(1, Math.max(0, Number.isFinite(parsedEpsilon) ? parsedEpsilon : 0.9)),
      isCustom: true,
    } as any);

    setNewName('');
    setNewDesc('');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 rounded-xl bg-palette-card border border-palette-border">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-palette-text-primary flex items-center gap-2">
            <Layers className="w-4 h-4 text-palette-yellow" />
            <span>Thermophysical Material Library</span>
          </h3>
          <p className="text-xs text-palette-text-secondary mt-0.5">
            Full editing of physical constants for envelope calculation. Seeded materials use verified empirical reference figures (ASHRAE / ISO 10456).
          </p>
        </div>

        <div className="flex items-center gap-3">
          {config.materialsLibrary.some((m) => m.isDefaultReference) && <VerificationBadge />}
          <button
            type="button"
            onClick={() => setShowAddForm((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-palette-violet hover:bg-palette-violet-hover text-palette-text-primary text-xs font-semibold transition-colors shadow-sm shrink-0 border border-palette-magenta/40"
          >
            <Plus className="w-3.5 h-3.5 text-palette-yellow" />
            <span>{showAddForm ? 'Cancel' : 'Add Material'}</span>
          </button>
        </div>
      </div>

      {/* Add Custom Material Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreateMaterial}
          className="p-5 rounded-xl bg-palette-card border border-palette-yellow/40 space-y-4 shadow-xl"
        >
          <div className="flex items-center gap-2 text-palette-yellow text-sm font-semibold">
            <Sparkles className="w-4 h-4" />
            <span>Add Custom Material</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-palette-text-secondary">Material Name</label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Rammed Earth / Expanded Cork"
                className="w-full px-3 py-1.5 rounded-lg bg-palette-raised border border-palette-border text-xs text-palette-text-primary focus:outline-none focus:border-palette-yellow"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-palette-text-secondary">Description</label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Brief composition or source description"
                className="w-full px-3 py-1.5 rounded-lg bg-palette-raised border border-palette-border text-xs text-palette-text-primary focus:outline-none focus:border-palette-yellow"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono text-xs">
            <div className="space-y-1">
              <label className="text-[11px] font-sans text-palette-text-muted">k (W/m·K)</label>
              <NumberInput
                step="0.01"
                min={0.001}
                required
                value={newK}
                onChange={(val) => setNewK(String(val))}
                className="w-full px-2.5 py-1.5 rounded bg-palette-raised border border-palette-border text-palette-text-primary focus:border-palette-yellow focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-sans text-palette-text-muted">Density (kg/m³)</label>
              <NumberInput
                step="1"
                min={1}
                required
                value={newRho}
                onChange={(val) => setNewRho(String(val))}
                className="w-full px-2.5 py-1.5 rounded bg-palette-raised border border-palette-border text-palette-text-primary focus:border-palette-yellow focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-sans text-palette-text-muted">c (J/kg·K)</label>
              <NumberInput
                step="1"
                min={1}
                required
                value={newC}
                onChange={(val) => setNewC(String(val))}
                className="w-full px-2.5 py-1.5 rounded bg-palette-raised border border-palette-border text-palette-text-primary focus:border-palette-yellow focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-sans text-palette-text-muted">Absorptivity α (0-1)</label>
              <NumberInput
                step="0.01"
                min={0}
                max={1}
                required
                value={newAlpha}
                onChange={(val) => setNewAlpha(String(val))}
                className="w-full px-2.5 py-1.5 rounded bg-palette-raised border border-palette-border text-palette-text-primary focus:border-palette-yellow focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-sans text-palette-text-muted">Emissivity ε (0-1)</label>
              <NumberInput
                step="0.01"
                min={0}
                max={1}
                required
                value={newEpsilon}
                onChange={(val) => setNewEpsilon(String(val))}
                className="w-full px-2.5 py-1.5 rounded bg-palette-raised border border-palette-border text-palette-text-primary focus:border-palette-yellow focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 rounded-lg bg-palette-raised text-palette-text-secondary text-xs hover:text-palette-text-primary border border-palette-border"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg bg-palette-violet hover:bg-palette-violet-hover text-palette-text-primary text-xs font-semibold border border-palette-magenta/40"
            >
              Save Custom Material
            </button>
          </div>
        </form>
      )}

      {/* Materials List */}
      <div className="space-y-4">
        {config.materialsLibrary.map((mat) => (
          <div
            key={mat.id}
            className="p-4 rounded-xl bg-palette-card border border-palette-border hover:border-palette-magenta/40 transition-colors space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-palette-border">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-palette-text-primary">{mat.name}</h4>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-palette-page text-palette-text-secondary border border-palette-border">
                    ID: {mat.id}
                  </span>
                </div>
                {mat.description && (
                  <p className="text-xs text-palette-text-secondary mt-0.5">{mat.description}</p>
                )}
              </div>

              {/* Tag notice if unverified */}
              {mat.isDefaultReference && mat.verificationNotice && (
                <div className="self-start sm:self-auto">
                  <VerificationBadge />
                </div>
              )}
            </div>

            {/* Editable Fields Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono text-xs">
              {/* Thermal Conductivity */}
              <div className="space-y-1">
                <label className="text-[11px] font-sans text-palette-text-muted block">
                  Thermal Cond. k (W/m·K)
                </label>
                <NumberInput
                  step="0.01"
                  min={0.001}
                  value={mat.conductivity_k}
                  onChange={(val) =>
                    updateMaterial(mat.id, {
                      conductivity_k: Math.max(0.001, val),
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-palette-raised border border-palette-border text-palette-yellow font-bold focus:outline-none focus:border-palette-yellow"
                />
              </div>

              {/* Density */}
              <div className="space-y-1">
                <label className="text-[11px] font-sans text-palette-text-muted block">
                  Density ρ (kg/m³)
                </label>
                <NumberInput
                  step="10"
                  min={1}
                  value={mat.density}
                  onChange={(val) =>
                    updateMaterial(mat.id, {
                      density: Math.max(1, val),
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-palette-raised border border-palette-border text-palette-text-primary focus:outline-none focus:border-palette-yellow"
                />
              </div>

              {/* Specific Heat */}
              <div className="space-y-1">
                <label className="text-[11px] font-sans text-palette-text-muted block">
                  Specific Heat c (J/kg·K)
                </label>
                <NumberInput
                  step="10"
                  min={1}
                  value={mat.specificHeat_c}
                  onChange={(val) =>
                    updateMaterial(mat.id, {
                      specificHeat_c: Math.max(1, val),
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-palette-raised border border-palette-border text-palette-text-primary focus:outline-none focus:border-palette-yellow"
                />
              </div>

              {/* Absorptivity */}
              <div className="space-y-1">
                <label className="text-[11px] font-sans text-palette-text-muted block">
                  Absorptivity α (0-1)
                </label>
                <NumberInput
                  step="0.01"
                  min={0}
                  max={1}
                  value={mat.solarAbsorptivity}
                  onChange={(val) =>
                    updateMaterial(mat.id, {
                      solarAbsorptivity: Math.min(1, Math.max(0, val)),
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-palette-raised border border-palette-border text-palette-text-primary focus:outline-none focus:border-palette-yellow"
                />
              </div>

              {/* Emissivity */}
              <div className="space-y-1">
                <label className="text-[11px] font-sans text-palette-text-muted block">
                  Emissivity ε (0-1)
                </label>
                <NumberInput
                  step="0.01"
                  min={0}
                  max={1}
                  value={mat.thermalEmissivity}
                  onChange={(val) =>
                    updateMaterial(mat.id, {
                      thermalEmissivity: Math.min(1, Math.max(0, val)),
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-palette-raised border border-palette-border text-palette-text-primary focus:outline-none focus:border-palette-yellow"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
