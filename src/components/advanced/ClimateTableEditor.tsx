import React from 'react';
import { Sun, Thermometer, Globe2, Calendar } from 'lucide-react';
import { useShelter } from '../../context/ShelterContext';
import { CsvUploader } from './CsvUploader';
import { LocationSearch } from './LocationSearch';
import { NumberInput } from '../common/NumberInput';

export const ClimateTableEditor: React.FC = () => {
  const { config, updateClimateMeta, updateHourlyPoint } = useShelter();
  const { regionName, latitude, longitude, dateSeasonLabel, hourlyProfile } =
    config.ambientClimate;

  return (
    <div className="space-y-6">
      {/* 1. Free-text Region and Geographical Metadata */}
      <div className="p-5 rounded-xl bg-palette-card border border-palette-border space-y-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-palette-text-primary flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-palette-yellow" />
            <span>Region & Geographical Metadata</span>
          </h3>
          <p className="text-xs text-palette-text-secondary">
            Region-agnostic definition: specify arbitrary names, coordinates, and seasonal labels.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Region Name (free text) */}
          <div className="space-y-1 md:col-span-2">
            <label htmlFor="input-region-name" className="text-xs font-medium text-palette-text-secondary">
              Region / Location Identifier (Free Text)
            </label>
            <input
              id="input-region-name"
              type="text"
              value={regionName}
              onChange={(e) => updateClimateMeta('regionName', e.target.value)}
              placeholder="e.g. Changthang Plateau, Ladakh / Sonoran Desert / User Site"
              className="w-full px-3 py-2 rounded-lg bg-palette-raised border border-palette-border text-sm text-palette-text-primary placeholder-palette-text-muted focus:outline-none focus:border-palette-yellow transition-colors"
            />
          </div>

          {/* Latitude */}
          <div className="space-y-1">
            <label htmlFor="input-latitude" className="text-xs font-medium text-palette-text-secondary">
              Latitude (° Decimal)
            </label>
            <NumberInput
              id="input-latitude"
              step="0.01"
              min={-90}
              max={90}
              value={latitude}
              onChange={(val) => updateClimateMeta('latitude', val)}
              className="w-full px-3 py-2 rounded-lg bg-palette-raised border border-palette-border text-sm text-palette-text-primary font-mono focus:outline-none focus:border-palette-yellow transition-colors"
            />
          </div>

          {/* Longitude */}
          <div className="space-y-1">
            <label htmlFor="input-longitude" className="text-xs font-medium text-palette-text-secondary">
              Longitude (° Decimal)
            </label>
            <NumberInput
              id="input-longitude"
              step="0.01"
              min={-180}
              max={180}
              value={longitude}
              onChange={(val) => updateClimateMeta('longitude', val)}
              className="w-full px-3 py-2 rounded-lg bg-palette-raised border border-palette-border text-sm text-palette-text-primary font-mono focus:outline-none focus:border-palette-yellow transition-colors"
            />
          </div>

          {/* Date / Season Label */}
          <div className="space-y-1 md:col-span-4">
            <label htmlFor="input-season-label" className="text-xs font-medium text-palette-text-secondary flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-palette-yellow" />
              <span>Date / Season Label</span>
            </label>
            <input
              id="input-season-label"
              type="text"
              value={dateSeasonLabel}
              onChange={(e) => updateClimateMeta('dateSeasonLabel', e.target.value)}
              placeholder="e.g. Design Winter Solstice (Dec 21) / 99% Dry-Bulb Cold Day"
              className="w-full px-3 py-2 rounded-lg bg-palette-raised border border-palette-border text-sm text-palette-text-primary placeholder-palette-text-muted focus:outline-none focus:border-palette-yellow transition-colors"
            />
          </div>
        </div>
      </div>

      {/* 2. Real-Data Climate Lookup */}
      <LocationSearch />

      {/* 3. CSV Upload component */}
      <CsvUploader />

      {/* 4. 24-Row Editable Climate Table */}
      <div className="p-5 rounded-xl bg-palette-card border border-palette-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-palette-text-primary flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-palette-yellow" />
              <span>24-Hour Diurnal Climate Table</span>
            </h3>
            <p className="text-xs text-palette-text-secondary">
              Pre-filled from current state/preset. Directly edit individual hourly ambient temperature and solar irradiance values.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto text-xs font-mono text-palette-text-muted">
            <span>24 Hourly Rows (00:00 - 23:00)</span>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto max-h-[520px] rounded-lg border border-palette-border">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-palette-raised text-palette-text-secondary font-semibold sticky top-0 z-10 border-b border-palette-border shadow-sm">
              <tr>
                <th className="py-2.5 px-4 w-28">Hour</th>
                <th className="py-2.5 px-4 w-32">Time</th>
                <th className="py-2.5 px-4">
                  <div className="flex items-center gap-1.5 text-palette-yellow">
                    <Thermometer className="w-3.5 h-3.5" />
                    <span>Ambient Temp (°C)</span>
                  </div>
                </th>
                <th className="py-2.5 px-4">
                  <div className="flex items-center gap-1.5 text-palette-yellow">
                    <Sun className="w-3.5 h-3.5" />
                    <span>Solar Irradiance (W/m²)</span>
                  </div>
                </th>
                <th className="py-2.5 px-4 text-right text-palette-text-muted">Solar State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-palette-border font-mono text-palette-text-primary">
              {hourlyProfile.map((pt) => {
                const isDaylight = pt.irradiance_wm2 > 0;
                const formattedHour = `${pt.hour.toString().padStart(2, '0')}:00`;

                return (
                  <tr
                    key={pt.hour}
                    className="hover:bg-palette-raised/60 transition-colors"
                  >
                    <td className="py-2 px-4 text-palette-text-secondary font-semibold">
                      Hour {pt.hour}
                    </td>
                    <td className="py-2 px-4 text-palette-text-secondary">
                      {formattedHour}
                    </td>
                    <td className="py-1.5 px-4">
                      <div className="flex items-center gap-2">
                        <NumberInput
                          step="0.5"
                          value={pt.temperature_C}
                          onChange={(val) =>
                            updateHourlyPoint(pt.hour, 'temperature_C', val)
                          }
                          className="w-28 px-2.5 py-1 rounded bg-palette-raised border border-palette-border text-palette-text-primary focus:outline-none focus:border-palette-yellow transition-colors"
                        />
                        <span className="text-palette-text-muted text-[11px] font-sans">°C</span>
                      </div>
                    </td>
                    <td className="py-1.5 px-4">
                      <div className="flex items-center gap-2">
                        <NumberInput
                          step="10"
                          min={0}
                          value={pt.irradiance_wm2}
                          onChange={(val) =>
                            updateHourlyPoint(pt.hour, 'irradiance_wm2', Math.max(0, val))
                          }
                          className="w-28 px-2.5 py-1 rounded bg-palette-raised border border-palette-border text-palette-text-primary focus:outline-none focus:border-palette-yellow transition-colors"
                        />
                        <span className="text-palette-text-muted text-[11px] font-sans">W/m²</span>
                      </div>
                    </td>
                    <td className="py-2 px-4 text-right font-sans">
                      {isDaylight ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-palette-raised text-palette-yellow text-[11px] border border-palette-yellow/30 font-medium">
                          <Sun className="w-3 h-3 text-palette-yellow" />
                          Sunlit
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-palette-raised text-palette-text-muted text-[11px]">
                          Night
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
