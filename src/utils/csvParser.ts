import type { AmbientDataPoint } from '../types/shelter';

export interface CsvParseResult {
  success: boolean;
  data?: AmbientDataPoint[];
  error?: string;
}

/**
 * Parses CSV text containing 24-hour climate data.
 * Expected columns: hour, temperature_C, irradiance_wm2
 */
export function parseClimateCsv(csvContent: string): CsvParseResult {
  try {
    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      return {
        success: false,
        error: 'CSV must contain a header row and at least 24 data rows.',
      };
    }

    const header = lines[0].toLowerCase().split(',').map((h) => h.trim());
    const hourIdx = header.findIndex((h) => h === 'hour' || h.includes('hr'));
    const tempIdx = header.findIndex((h) => h.includes('temp') || h === 'temperature_c');
    const irrIdx = header.findIndex((h) => h.includes('irradiance') || h.includes('solar') || h === 'irradiance_wm2');

    if (hourIdx === -1 || tempIdx === -1 || irrIdx === -1) {
      return {
        success: false,
        error:
          'Header row must include "hour", "temperature_C", and "irradiance_wm2" (or recognizable variants).',
      };
    }

    const dataPoints: AmbientDataPoint[] = [];
    const seenHours = new Set<number>();

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      if (parts.length < 3) continue;

      const hour = parseInt(parts[hourIdx], 10);
      const temperature_C = parseFloat(parts[tempIdx]);
      const irradiance_wm2 = parseFloat(parts[irrIdx]);

      if (isNaN(hour) || hour < 0 || hour > 23) {
        return {
          success: false,
          error: `Row ${i + 1}: Invalid hour '${parts[hourIdx]}'. Hour must be an integer between 0 and 23.`,
        };
      }

      if (isNaN(temperature_C)) {
        return {
          success: false,
          error: `Row ${i + 1}: Invalid temperature '${parts[tempIdx]}'. Must be a valid number.`,
        };
      }

      if (isNaN(irradiance_wm2) || irradiance_wm2 < 0) {
        return {
          success: false,
          error: `Row ${i + 1}: Invalid irradiance '${parts[irrIdx]}'. Irradiance must be a non-negative number.`,
        };
      }

      if (seenHours.has(hour)) {
        return {
          success: false,
          error: `Duplicate data row for hour ${hour}.`,
        };
      }

      seenHours.add(hour);
      dataPoints.push({ hour, temperature_C, irradiance_wm2 });
    }

    if (dataPoints.length !== 24) {
      return {
        success: false,
        error: `CSV must contain exactly 24 hours (0 to 23). Found ${dataPoints.length} valid entries.`,
      };
    }

    // Ensure sorted by hour 0..23
    dataPoints.sort((a, b) => a.hour - b.hour);

    return {
      success: true,
      data: dataPoints,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to parse CSV: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Generates sample CSV template string for export/download.
 */
export function generateSampleCsv(dataPoints?: AmbientDataPoint[]): string {
  const rows = ['hour,temperature_C,irradiance_wm2'];
  if (dataPoints && dataPoints.length === 24) {
    dataPoints.forEach((pt) => {
      rows.push(`${pt.hour},${pt.temperature_C.toFixed(1)},${pt.irradiance_wm2.toFixed(1)}`);
    });
  } else {
    for (let h = 0; h < 24; h++) {
      rows.push(`${h},0.0,0.0`);
    }
  }
  return rows.join('\n');
}
