import React, { useState } from 'react';
import { Layers, Plus, Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { useShelter } from '../../context/ShelterContext';
import { NumberInput } from '../common/NumberInput';

export const MultiLayerEditor: React.FC = () => {
  const {
    config,
    addWallLayer,
    updateWallLayer,
    removeWallLayer,
    setWallLayers,
    addRoofLayer,
    updateRoofLayer,
    removeRoofLayer,
    setRoofLayers,
  } = useShelter();

  const [draggedWallIdx, setDraggedWallIdx] = useState<number | null>(null);
  const [dragOverWallIdx, setDragOverWallIdx] = useState<number | null>(null);
  const [draggedRoofIdx, setDraggedRoofIdx] = useState<number | null>(null);
  const [dragOverRoofIdx, setDragOverRoofIdx] = useState<number | null>(null);

  const handleWallReorder = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= config.wallLayers.length) return;
    const updated = [...config.wallLayers];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setWallLayers(updated);
  };

  const handleRoofReorder = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= config.roofLayers.length) return;
    const updated = [...config.roofLayers];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setRoofLayers(updated);
  };

  const totalWallThickness_m = config.wallLayers.reduce(
    (acc, l) => acc + (Math.max(0, l.thickness_m) || 0),
    0
  );
  const totalRoofThickness_m = config.roofLayers.reduce(
    (acc, l) => acc + (Math.max(0, l.thickness_m) || 0),
    0
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Composite Wall Stack Editor */}
      <div className="p-5 rounded-xl bg-palette-card border border-palette-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-palette-border">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-palette-text-primary flex items-center gap-2">
              <Layers className="w-4 h-4 text-palette-yellow" />
              <span>Multi-Layer Wall Assembly</span>
            </h3>
            <p className="text-xs text-palette-text-secondary">
              Exterior-to-interior composite layered envelope.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-palette-page border border-palette-border text-palette-yellow font-semibold">
              Total: {(totalWallThickness_m * 1000).toFixed(0)} mm
            </span>
            <button
              type="button"
              onClick={() => {
                const defaultMatId = config.materialsLibrary[0]?.id || 'mud_brick_adobe';
                addWallLayer(defaultMatId, 0.10);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-palette-violet hover:bg-palette-violet-hover text-palette-text-primary text-xs font-semibold transition-colors shrink-0 border border-palette-magenta/40"
            >
              <Plus className="w-3.5 h-3.5 text-palette-yellow" />
              <span>Add Layer</span>
            </button>
          </div>
        </div>

        {/* Wall Layers List */}
        <div className="space-y-2.5">
          {config.wallLayers.length === 0 ? (
            <p className="text-xs text-palette-pink-red italic py-3 text-center">
              No wall layers defined. Add at least one layer.
            </p>
          ) : (
            config.wallLayers.map((layer, idx) => {
              const isDragging = draggedWallIdx === idx;
              const isOver = dragOverWallIdx === idx;
              return (
                <div
                  key={layer.id}
                  draggable
                  onDragStart={(e) => {
                    setDraggedWallIdx(idx);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverWallIdx !== idx) setDragOverWallIdx(idx);
                  }}
                  onDragLeave={() => {
                    if (dragOverWallIdx === idx) setDragOverWallIdx(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedWallIdx !== null && draggedWallIdx !== idx) {
                      handleWallReorder(draggedWallIdx, idx);
                    }
                    setDraggedWallIdx(null);
                    setDragOverWallIdx(null);
                  }}
                  onDragEnd={() => {
                    setDraggedWallIdx(null);
                    setDragOverWallIdx(null);
                  }}
                  className={`group flex items-center gap-2.5 p-3 rounded-lg border transition-all ${
                    isDragging
                      ? 'opacity-40 border-dashed border-palette-yellow bg-palette-page scale-[0.99]'
                      : isOver
                      ? 'border-palette-yellow ring-2 ring-palette-yellow/40 bg-palette-raised shadow-md'
                      : 'bg-palette-raised border-palette-border hover:border-palette-magenta/40'
                  }`}
                >
                  <div
                    className="flex items-center gap-1.5 text-palette-text-muted text-xs font-mono shrink-0 cursor-grab active:cursor-grabbing p-1.5 -ml-1 rounded hover:bg-palette-card hover:text-palette-yellow transition-colors select-none"
                    title="Drag to reorder wall layer"
                  >
                    <GripVertical className="w-4 h-4 text-palette-text-muted group-hover:text-palette-yellow transition-colors" />
                    <span className="font-semibold text-palette-text-primary">L{idx + 1}</span>
                  </div>

                  <div className="flex flex-col -space-y-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleWallReorder(idx, idx - 1)}
                      className="p-0.5 text-palette-text-muted hover:text-palette-yellow disabled:opacity-20 transition-colors"
                      title="Move layer up (outward)"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === config.wallLayers.length - 1}
                      onClick={() => handleWallReorder(idx, idx + 1)}
                      className="p-0.5 text-palette-text-muted hover:text-palette-yellow disabled:opacity-20 transition-colors"
                      title="Move layer down (inward)"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Material Dropdown */}
                  <div className="flex-1">
                    <select
                      value={layer.materialId}
                      onChange={(e) => updateWallLayer(layer.id, { materialId: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded bg-palette-card border border-palette-border text-xs font-medium text-palette-text-primary focus:outline-none focus:border-palette-yellow"
                    >
                      {config.materialsLibrary.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} (k={m.conductivity_k} W/m·K)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Thickness Input */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <NumberInput
                      step="0.01"
                      min={0.005}
                      max={2.0}
                      value={layer.thickness_m}
                      onChange={(val) =>
                        updateWallLayer(layer.id, {
                          thickness_m: Math.max(0.001, val),
                        })
                      }
                      className="w-20 px-2 py-1.5 rounded bg-palette-card border border-palette-border text-xs font-mono text-palette-text-primary text-right focus:outline-none focus:border-palette-yellow"
                    />
                    <span className="text-[11px] text-palette-text-muted">m</span>
                  </div>

                  {/* Delete Layer button */}
                  <button
                    type="button"
                    disabled={config.wallLayers.length <= 1}
                    onClick={() => removeWallLayer(layer.id)}
                    title={config.wallLayers.length <= 1 ? 'At least one wall layer required' : 'Remove layer'}
                    className="p-1.5 rounded text-palette-text-muted hover:text-palette-pink-red hover:bg-palette-card disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Composite Roof Stack Editor */}
      <div className="p-5 rounded-xl bg-palette-card border border-palette-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-palette-border">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-palette-text-primary flex items-center gap-2">
              <Layers className="w-4 h-4 text-palette-yellow" />
              <span>Multi-Layer Roof Assembly</span>
            </h3>
            <p className="text-xs text-palette-text-secondary">
              Exterior-to-interior composite roof deck.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-palette-page border border-palette-border text-palette-yellow font-semibold">
              Total: {(totalRoofThickness_m * 1000).toFixed(0)} mm
            </span>
            <button
              type="button"
              onClick={() => {
                const defaultMatId = config.materialsLibrary[4]?.id || config.materialsLibrary[0]?.id;
                addRoofLayer(defaultMatId, 0.08);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-palette-violet hover:bg-palette-violet-hover text-palette-text-primary text-xs font-semibold transition-colors shrink-0 border border-palette-magenta/40"
            >
              <Plus className="w-3.5 h-3.5 text-palette-yellow" />
              <span>Add Layer</span>
            </button>
          </div>
        </div>

        {/* Roof Layers List */}
        <div className="space-y-2.5">
          {config.roofLayers.length === 0 ? (
            <p className="text-xs text-palette-pink-red italic py-3 text-center">
              No roof layers defined. Add at least one layer.
            </p>
          ) : (
            config.roofLayers.map((layer, idx) => {
              const isDragging = draggedRoofIdx === idx;
              const isOver = dragOverRoofIdx === idx;
              return (
                <div
                  key={layer.id}
                  draggable
                  onDragStart={(e) => {
                    setDraggedRoofIdx(idx);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverRoofIdx !== idx) setDragOverRoofIdx(idx);
                  }}
                  onDragLeave={() => {
                    if (dragOverRoofIdx === idx) setDragOverRoofIdx(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedRoofIdx !== null && draggedRoofIdx !== idx) {
                      handleRoofReorder(draggedRoofIdx, idx);
                    }
                    setDraggedRoofIdx(null);
                    setDragOverRoofIdx(null);
                  }}
                  onDragEnd={() => {
                    setDraggedRoofIdx(null);
                    setDragOverRoofIdx(null);
                  }}
                  className={`group flex items-center gap-2.5 p-3 rounded-lg border transition-all ${
                    isDragging
                      ? 'opacity-40 border-dashed border-palette-yellow bg-palette-page scale-[0.99]'
                      : isOver
                      ? 'border-palette-yellow ring-2 ring-palette-yellow/40 bg-palette-raised shadow-md'
                      : 'bg-palette-raised border-palette-border hover:border-palette-magenta/40'
                  }`}
                >
                  <div
                    className="flex items-center gap-1.5 text-palette-text-muted text-xs font-mono shrink-0 cursor-grab active:cursor-grabbing p-1.5 -ml-1 rounded hover:bg-palette-card hover:text-palette-yellow transition-colors select-none"
                    title="Drag to reorder roof layer"
                  >
                    <GripVertical className="w-4 h-4 text-palette-text-muted group-hover:text-palette-yellow transition-colors" />
                    <span className="font-semibold text-palette-text-primary">L{idx + 1}</span>
                  </div>

                  <div className="flex flex-col -space-y-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleRoofReorder(idx, idx - 1)}
                      className="p-0.5 text-palette-text-muted hover:text-palette-yellow disabled:opacity-20 transition-colors"
                      title="Move layer up (outward)"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === config.roofLayers.length - 1}
                      onClick={() => handleRoofReorder(idx, idx + 1)}
                      className="p-0.5 text-palette-text-muted hover:text-palette-yellow disabled:opacity-20 transition-colors"
                      title="Move layer down (inward)"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Material Dropdown */}
                  <div className="flex-1">
                    <select
                      value={layer.materialId}
                      onChange={(e) => updateRoofLayer(layer.id, { materialId: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded bg-palette-card border border-palette-border text-xs font-medium text-palette-text-primary focus:outline-none focus:border-palette-yellow"
                    >
                      {config.materialsLibrary.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} (k={m.conductivity_k} W/m·K)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Thickness Input */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <NumberInput
                      step="0.01"
                      min={0.005}
                      max={2.0}
                      value={layer.thickness_m}
                      onChange={(val) =>
                        updateRoofLayer(layer.id, {
                          thickness_m: Math.max(0.001, val),
                        })
                      }
                      className="w-20 px-2 py-1.5 rounded bg-palette-card border border-palette-border text-xs font-mono text-palette-text-primary text-right focus:outline-none focus:border-palette-yellow"
                    />
                    <span className="text-[11px] text-palette-text-muted">m</span>
                  </div>

                  {/* Delete Layer button */}
                  <button
                    type="button"
                    disabled={config.roofLayers.length <= 1}
                    onClick={() => removeRoofLayer(layer.id)}
                    title={config.roofLayers.length <= 1 ? 'At least one roof layer required' : 'Remove layer'}
                    className="p-1.5 rounded text-palette-text-muted hover:text-palette-pink-red hover:bg-palette-card disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
