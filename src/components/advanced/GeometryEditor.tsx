import React, { useState } from 'react';
import { Box, Plus, Trash2, Compass, DoorOpen, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { useShelter } from '../../context/ShelterContext';
import type { ShelterOpeningType } from '../../types/shelter';
import { NumberInput } from '../common/NumberInput';

export const GeometryEditor: React.FC = () => {
  const { config, updateGeometry, addOpening, updateOpening, removeOpening } = useShelter();
  const { shape, length_m, width_m, height_m, orientation_deg, openings } = config.geometry;

  // Drag-and-drop state for openings
  const [draggedOpeningIdx, setDraggedOpeningIdx] = useState<number | null>(null);
  const [dragOverOpeningIdx, setDragOverOpeningIdx] = useState<number | null>(null);

  const handleOpeningReorder = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= openings.length) return;
    const updated = [...openings];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    updateGeometry({ openings: updated });
  };

  // New opening quick state
  const [newCount, setNewCount] = useState(1);
  const [newArea, setNewArea] = useState(1.5);
  const [newType, setNewType] = useState<ShelterOpeningType>('plain_glass');
  const [newDesc, setNewDesc] = useState('Window aperture');
  const [showAddOpening, setShowAddOpening] = useState(false);

  // Geometric calculations with NaN protection
  const safeLength = Number.isFinite(length_m) && length_m > 0 ? length_m : 4;
  const safeWidth = Number.isFinite(width_m) && width_m > 0 ? width_m : 3;
  const safeHeight = Number.isFinite(height_m) && height_m > 0 ? height_m : 2.5;

  const floorArea_m2 = safeLength * safeWidth;
  const grossWallArea_m2 = 2 * (safeLength * safeHeight + safeWidth * safeHeight);
  const totalOpeningsArea_m2 = openings.reduce(
    (acc, op) => acc + (Math.max(0, op.count) || 0) * (Math.max(0, op.areaEach_m2) || 0),
    0
  );
  const netWallArea_m2 = Math.max(0, grossWallArea_m2 - totalOpeningsArea_m2);
  const windowToWallRatio_pct =
    grossWallArea_m2 > 0 ? (totalOpeningsArea_m2 / grossWallArea_m2) * 100 : 0;

  const handleAddOpeningSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addOpening({
      count: Math.max(1, Math.round(newCount) || 1),
      areaEach_m2: Math.max(0.01, newArea || 0.1),
      type: newType,
      description: newDesc.trim() || 'Aperture',
    });
    setShowAddOpening(false);
  };

  return (
    <div className="space-y-6">
      {/* 1. Rectangular Box Primary Geometry */}
      <div className="p-5 rounded-xl bg-palette-card border border-palette-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-palette-border">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-palette-text-primary flex items-center gap-2">
              <Box className="w-4 h-4 text-palette-yellow" />
              <span>Envelope Geometry & Dimensions</span>
            </h3>
            <p className="text-xs text-palette-text-secondary">
              Form factor and orientation. Rectangular box model (structured for future shape extensions).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded bg-palette-raised border border-palette-border text-palette-text-secondary font-mono">
              Shape: <span className="text-palette-yellow font-semibold">{shape}</span>
            </span>
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label htmlFor="adv-length" className="text-xs font-medium text-palette-text-secondary">Length (m)</label>
            <div className="flex items-center gap-1.5">
              <NumberInput
                id="adv-length"
                step="0.1"
                min={0.5}
                value={safeLength}
                onChange={(val) => updateGeometry({ length_m: Math.max(0.1, val) })}
                className="w-full px-3 py-2 rounded-lg bg-palette-raised border border-palette-border text-sm font-mono text-palette-text-primary focus:outline-none focus:border-palette-yellow"
              />
              <span className="text-xs text-palette-text-muted">m</span>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="adv-width" className="text-xs font-medium text-palette-text-secondary">Width (m)</label>
            <div className="flex items-center gap-1.5">
              <NumberInput
                id="adv-width"
                step="0.1"
                min={0.5}
                value={safeWidth}
                onChange={(val) => updateGeometry({ width_m: Math.max(0.1, val) })}
                className="w-full px-3 py-2 rounded-lg bg-palette-raised border border-palette-border text-sm font-mono text-palette-text-primary focus:outline-none focus:border-palette-yellow"
              />
              <span className="text-xs text-palette-text-muted">m</span>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="adv-height" className="text-xs font-medium text-palette-text-secondary">Height (m)</label>
            <div className="flex items-center gap-1.5">
              <NumberInput
                id="adv-height"
                step="0.1"
                min={0.5}
                value={safeHeight}
                onChange={(val) => updateGeometry({ height_m: Math.max(0.1, val) })}
                className="w-full px-3 py-2 rounded-lg bg-palette-raised border border-palette-border text-sm font-mono text-palette-text-primary focus:outline-none focus:border-palette-yellow"
              />
              <span className="text-xs text-palette-text-muted">m</span>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="adv-orientation" className="text-xs font-medium text-palette-text-secondary flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-palette-yellow" />
              <span>Orientation Azimuth (°)</span>
            </label>
            <div className="flex items-center gap-1.5">
              <NumberInput
                id="adv-orientation"
                step="1"
                min={0}
                max={359}
                value={orientation_deg}
                onChange={(val) =>
                  updateGeometry({ orientation_deg: Math.min(359, Math.max(0, Math.round(val))) })
                }
                className="w-full px-3 py-2 rounded-lg bg-palette-raised border border-palette-border text-sm font-mono text-palette-text-primary focus:outline-none focus:border-palette-yellow"
              />
              <span className="text-xs text-palette-text-muted">°</span>
            </div>
          </div>
        </div>

        {/* Derived Geometry Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 font-mono text-xs">
          <div className="p-2.5 rounded-lg bg-palette-raised border border-palette-border text-palette-text-secondary">
            <span className="text-[10px] text-palette-text-muted block font-sans">Floor Footprint</span>
            <span className="font-semibold text-palette-text-primary">{floorArea_m2.toFixed(1)} m²</span>
          </div>
          <div className="p-2.5 rounded-lg bg-palette-raised border border-palette-border text-palette-text-secondary">
            <span className="text-[10px] text-palette-text-muted block font-sans">Gross Wall Area</span>
            <span className="font-semibold text-palette-text-primary">{grossWallArea_m2.toFixed(1)} m²</span>
          </div>
          <div className="p-2.5 rounded-lg bg-palette-raised border border-palette-border text-palette-text-secondary">
            <span className="text-[10px] text-palette-text-muted block font-sans">Net Solid Wall</span>
            <span className="font-semibold text-palette-text-primary">{netWallArea_m2.toFixed(1)} m²</span>
          </div>
          <div className="p-2.5 rounded-lg bg-palette-raised border border-palette-border text-palette-text-secondary">
            <span className="text-[10px] text-palette-text-muted block font-sans">Glazing / Aperture %</span>
            <span className="font-semibold text-palette-yellow">{windowToWallRatio_pct.toFixed(1)} %</span>
          </div>
        </div>
      </div>

      {/* 2. Openings / Apertures Manager */}
      <div className="p-5 rounded-xl bg-palette-card border border-palette-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-palette-border">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-palette-text-primary flex items-center gap-2">
              <DoorOpen className="w-4 h-4 text-palette-yellow" />
              <span>Fenestrations & Openings</span>
            </h3>
            <p className="text-xs text-palette-text-secondary">
              Windows, doors, and ventilation apertures. Types: plain glass, insulated, open gap.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddOpening((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-palette-violet hover:bg-palette-violet-hover text-palette-text-primary text-xs font-semibold transition-colors shadow-sm shrink-0 border border-palette-magenta/40"
          >
            <Plus className="w-3.5 h-3.5 text-palette-yellow" />
            <span>{showAddOpening ? 'Cancel' : 'Add Opening'}</span>
          </button>
        </div>

        {/* Add Opening Form */}
        {showAddOpening && (
          <form
            onSubmit={handleAddOpeningSubmit}
            className="p-4 rounded-xl bg-palette-raised border border-palette-yellow/40 space-y-3"
          >
            <div className="text-xs font-semibold text-palette-yellow">New Fenestration / Opening</div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-palette-text-secondary">Description</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="e.g. South window / Skylight"
                  className="w-full px-2.5 py-1.5 rounded bg-palette-card border border-palette-border text-xs text-palette-text-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-palette-text-secondary">Count</label>
                <NumberInput
                  min={1}
                  step={1}
                  value={newCount}
                  onChange={(val) => setNewCount(Math.max(1, Math.round(val)))}
                  className="w-full px-2.5 py-1.5 rounded bg-palette-card border border-palette-border text-xs font-mono text-palette-text-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-palette-text-secondary">Area Each (m²)</label>
                <NumberInput
                  step="0.1"
                  min={0.05}
                  value={newArea}
                  onChange={(val) => setNewArea(Math.max(0.01, val))}
                  className="w-full px-2.5 py-1.5 rounded bg-palette-card border border-palette-border text-xs font-mono text-palette-text-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-palette-text-secondary">Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as ShelterOpeningType)}
                  className="w-full px-2.5 py-1.5 rounded bg-palette-card border border-palette-border text-xs text-palette-text-primary"
                >
                  <option value="plain_glass">Plain glass</option>
                  <option value="insulated">Insulated</option>
                  <option value="open_gap">Open gap</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded bg-palette-violet hover:bg-palette-violet-hover text-palette-text-primary text-xs font-semibold border border-palette-magenta/50"
              >
                Save Opening
              </button>
            </div>
          </form>
        )}

        {/* Existing Openings List */}
        <div className="space-y-2.5">
          {openings.length === 0 ? (
            <div className="p-4 rounded-lg bg-palette-raised border border-palette-border text-center text-xs text-palette-text-muted">
              No openings defined. The shelter envelope has no windows or ventilation gaps.
            </div>
          ) : (
            openings.map((op, idx) => {
              const isDragging = draggedOpeningIdx === idx;
              const isOver = dragOverOpeningIdx === idx;
              return (
                <div
                  key={op.id}
                  draggable
                  onDragStart={(e) => {
                    setDraggedOpeningIdx(idx);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverOpeningIdx !== idx) setDragOverOpeningIdx(idx);
                  }}
                  onDragLeave={() => {
                    if (dragOverOpeningIdx === idx) setDragOverOpeningIdx(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedOpeningIdx !== null && draggedOpeningIdx !== idx) {
                      handleOpeningReorder(draggedOpeningIdx, idx);
                    }
                    setDraggedOpeningIdx(null);
                    setDragOverOpeningIdx(null);
                  }}
                  onDragEnd={() => {
                    setDraggedOpeningIdx(null);
                    setDragOverOpeningIdx(null);
                  }}
                  className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border transition-all ${
                    isDragging
                      ? 'opacity-40 border-dashed border-palette-yellow bg-palette-page scale-[0.99]'
                      : isOver
                      ? 'border-palette-yellow ring-2 ring-palette-yellow/40 bg-palette-raised shadow-md'
                      : 'bg-palette-raised border border-palette-border hover:border-palette-magenta/40'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <div
                      className="flex items-center gap-1 text-palette-text-muted text-xs font-mono shrink-0 cursor-grab active:cursor-grabbing p-1.5 -ml-1 rounded hover:bg-palette-card hover:text-palette-yellow transition-colors select-none"
                      title="Drag to reorder opening"
                    >
                      <GripVertical className="w-4 h-4 text-palette-text-muted group-hover:text-palette-yellow transition-colors" />
                    </div>

                    <div className="flex flex-col -space-y-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleOpeningReorder(idx, idx - 1)}
                        className="p-0.5 text-palette-text-muted hover:text-palette-yellow disabled:opacity-20 transition-colors"
                        title="Move opening up"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === openings.length - 1}
                        onClick={() => handleOpeningReorder(idx, idx + 1)}
                        className="p-0.5 text-palette-text-muted hover:text-palette-yellow disabled:opacity-20 transition-colors"
                        title="Move opening down"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-palette-text-primary">
                          {op.description || 'Opening'}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-palette-card text-palette-yellow border border-palette-border">
                          {op.type.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-[11px] text-palette-text-secondary mt-0.5 font-mono">
                        Total aperture: {(op.count * op.areaEach_m2).toFixed(2)} m²
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-palette-text-muted">Qty:</span>
                      <NumberInput
                        min={1}
                        step={1}
                        value={op.count}
                        onChange={(val) =>
                          updateOpening(op.id, { count: Math.max(1, Math.round(val)) })
                        }
                        className="w-14 px-2 py-1 rounded bg-palette-card border border-palette-border text-palette-text-primary font-mono text-center text-xs"
                      />
                    </div>

                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-palette-text-muted">m² ea:</span>
                      <NumberInput
                        step="0.1"
                        min={0.05}
                        value={op.areaEach_m2}
                        onChange={(val) =>
                          updateOpening(op.id, {
                            areaEach_m2: Math.max(0.01, val),
                          })
                        }
                        className="w-16 px-2 py-1 rounded bg-palette-card border border-palette-border text-palette-text-primary font-mono text-center text-xs"
                      />
                    </div>

                    <div className="text-xs">
                      <select
                        value={op.type}
                        onChange={(e) =>
                          updateOpening(op.id, { type: e.target.value as ShelterOpeningType })
                        }
                        className="px-2 py-1 rounded bg-palette-card border border-palette-border text-palette-text-primary text-xs"
                      >
                        <option value="plain_glass">Plain glass</option>
                        <option value="insulated">Insulated</option>
                        <option value="open_gap">Open gap</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeOpening(op.id)}
                      className="p-1.5 rounded text-palette-text-muted hover:text-palette-pink-red hover:bg-palette-card transition-colors"
                      title="Remove opening"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
