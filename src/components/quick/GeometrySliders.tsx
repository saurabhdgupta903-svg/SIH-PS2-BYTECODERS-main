import React from 'react';
import { Compass, Box } from 'lucide-react';
import { useShelter } from '../../context/ShelterContext';

export const GeometrySliders: React.FC = () => {
  const { config, updateGeometry } = useShelter();
  const { length_m, width_m, height_m, orientation_deg } = config.geometry;

  const floorArea_m2 = (length_m * width_m).toFixed(1);
  const volume_m3 = (length_m * width_m * height_m).toFixed(1);

  // Compass direction label
  const getCompassDirection = (deg: number): string => {
    if (deg >= 337.5 || deg < 22.5) return 'North (0°)';
    if (deg >= 22.5 && deg < 67.5) return 'North-East (45°)';
    if (deg >= 67.5 && deg < 112.5) return 'East (90°)';
    if (deg >= 112.5 && deg < 157.5) return 'South-East (135°)';
    if (deg >= 157.5 && deg < 202.5) return 'South (180°) - Solar Gain';
    if (deg >= 202.5 && deg < 247.5) return 'South-West (225°)';
    if (deg >= 247.5 && deg < 292.5) return 'West (270°)';
    return 'North-West (315°)';
  };

  return (
    <div className="p-5 rounded-xl bg-palette-card border border-palette-border space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-palette-text-primary flex items-center gap-2">
            <Box className="w-4 h-4 text-palette-yellow" />
            <span>2. Shelter Geometry (Sliders)</span>
          </h3>
          <p className="text-xs text-palette-text-secondary">
            Shape: Rectangular box. Adjust primary physical dimensions and orientation.
          </p>
        </div>

        {/* Real-time Footprint & Volume metrics */}
        <div className="flex items-center gap-3 self-start sm:self-auto font-mono text-xs">
          <div className="px-2.5 py-1 rounded-lg bg-palette-raised border border-palette-border text-palette-text-secondary">
            <span className="text-[10px] text-palette-text-muted block font-sans">Floor Area</span>
            <span className="text-palette-text-primary font-semibold">{floorArea_m2} m²</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-palette-raised border border-palette-border text-palette-text-secondary">
            <span className="text-[10px] text-palette-text-muted block font-sans">Volume</span>
            <span className="text-palette-text-primary font-semibold">{volume_m3} m³</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
        {/* Length Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <label htmlFor="slider-length" className="text-palette-text-secondary font-medium flex items-center gap-1.5">
              <span>Length (m)</span>
            </label>
            <span className="px-2 py-0.5 rounded bg-palette-raised border border-palette-border font-mono text-palette-yellow font-semibold">
              {length_m.toFixed(1)} m
            </span>
          </div>
          <input
            id="slider-length"
            type="range"
            min="2.0"
            max="12.0"
            step="0.5"
            value={length_m}
            onChange={(e) => updateGeometry({ length_m: parseFloat(e.target.value) })}
            className="w-full h-2 bg-palette-raised rounded-lg appearance-none cursor-pointer accent-[#FFD51E]"
          />
          <div className="flex justify-between text-[10px] text-palette-text-muted font-mono">
            <span>2.0m</span>
            <span>Typical: ~4.0m</span>
            <span>12.0m</span>
          </div>
        </div>

        {/* Width Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <label htmlFor="slider-width" className="text-palette-text-secondary font-medium flex items-center gap-1.5">
              <span>Width (m)</span>
            </label>
            <span className="px-2 py-0.5 rounded bg-palette-raised border border-palette-border font-mono text-palette-yellow font-semibold">
              {width_m.toFixed(1)} m
            </span>
          </div>
          <input
            id="slider-width"
            type="range"
            min="2.0"
            max="12.0"
            step="0.5"
            value={width_m}
            onChange={(e) => updateGeometry({ width_m: parseFloat(e.target.value) })}
            className="w-full h-2 bg-palette-raised rounded-lg appearance-none cursor-pointer accent-[#FFD51E]"
          />
          <div className="flex justify-between text-[10px] text-palette-text-muted font-mono">
            <span>2.0m</span>
            <span>Typical: ~3.0m</span>
            <span>12.0m</span>
          </div>
        </div>

        {/* Height Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <label htmlFor="slider-height" className="text-palette-text-secondary font-medium flex items-center gap-1.5">
              <span>Height (m)</span>
            </label>
            <span className="px-2 py-0.5 rounded bg-palette-raised border border-palette-border font-mono text-palette-yellow font-semibold">
              {height_m.toFixed(1)} m
            </span>
          </div>
          <input
            id="slider-height"
            type="range"
            min="2.0"
            max="5.0"
            step="0.1"
            value={height_m}
            onChange={(e) => updateGeometry({ height_m: parseFloat(e.target.value) })}
            className="w-full h-2 bg-palette-raised rounded-lg appearance-none cursor-pointer accent-[#FFD51E]"
          />
          <div className="flex justify-between text-[10px] text-palette-text-muted font-mono">
            <span>2.0m</span>
            <span>Typical: ~2.5m</span>
            <span>5.0m</span>
          </div>
        </div>

        {/* Orientation Azimuth Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <label htmlFor="slider-orientation" className="text-palette-text-secondary font-medium flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-palette-yellow" />
              <span>Orientation (Azimuth)</span>
            </label>
            <span className="px-2 py-0.5 rounded bg-palette-raised border border-palette-border font-mono text-palette-yellow font-semibold">
              {orientation_deg}° &bull; {getCompassDirection(orientation_deg)}
            </span>
          </div>
          <input
            id="slider-orientation"
            type="range"
            min="0"
            max="359"
            step="5"
            value={orientation_deg}
            onChange={(e) => updateGeometry({ orientation_deg: parseInt(e.target.value, 10) })}
            className="w-full h-2 bg-palette-raised rounded-lg appearance-none cursor-pointer accent-[#FFD51E]"
          />
          <div className="flex justify-between text-[10px] text-palette-text-muted font-mono">
            <span>N (0°)</span>
            <span>E (90°)</span>
            <span>S (180°)</span>
            <span>W (270°)</span>
            <span>359°</span>
          </div>
        </div>
      </div>
    </div>
  );
};
