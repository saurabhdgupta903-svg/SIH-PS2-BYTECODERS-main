import type { AmbientDataPoint } from '../types/shelter';

/**
 * Result structure returned from geocoding queries.
 */
export interface GeocodingResult {
  lat: number;
  lon: number;
  displayName: string;
}

/**
 * Result structure returned by fetchClimateData and fetchRealTimeWeatherData.
 */
export type ClimateFetchResult =
  | { success: true; data: AmbientDataPoint[]; source: string; error: null }
  | { success: false; data: null; source?: string; error: string };

/**
 * Timestamp tracking for OpenStreetMap Nominatim rate limiting.
 * Nominatim usage policy strictly requires maximum 1 request per second.
 */
let lastNominatimRequestTime = 0;

/**
 * Enforces a minimum 1.1s delay between consecutive Nominatim requests.
 */
async function throttleNominatim(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastNominatimRequestTime;
  if (elapsed < 1100) {
    await new Promise((resolve) => setTimeout(resolve, 1100 - elapsed));
  }
  lastNominatimRequestTime = Date.now();
}

/**
 * Searches for global locations matching placeName via OpenStreetMap Nominatim.
 *
 * @param placeName Human-readable location search string (e.g. "Leh, Ladakh")
 * @returns Array of matching GeocodingResults or empty array on no matches/failure
 */
export async function searchLocations(placeName: string): Promise<GeocodingResult[]> {
  const trimmed = placeName.trim();
  if (!trimmed) {
    return [];
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    console.warn('Network offline: cannot query Nominatim geocoding');
    return [];
  }

  await throttleNominatim();

  try {
    const encoded = encodeURIComponent(trimmed);
    const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=5`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ThermoShelter/1.0 (climate research app)',
      },
    });

    if (!response.ok) {
      console.error(`Nominatim request failed with status: ${response.status} ${response.statusText}`);
      return [];
    }

    const data: unknown = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    interface NominatimItem {
      lat?: string | number;
      lon?: string | number;
      display_name?: string;
    }

    return (data as NominatimItem[])
      .filter((item) => item.lat !== undefined && item.lon !== undefined && item.display_name)
      .map((item) => ({
        lat: parseFloat(String(item.lat)),
        lon: parseFloat(String(item.lon)),
        displayName: String(item.display_name),
      }));
  } catch (err) {
    console.error('Failed to geocode location:', err);
    return [];
  }
}

/**
 * Convenience method returning the top geocoding match for a place name.
 */
export async function fetchLocationCoordinates(placeName: string): Promise<GeocodingResult | null> {
  const results = await searchLocations(placeName);
  return results.length > 0 ? results[0] : null;
}

/**
 * Generates a realistic physical 24h diurnal temperature and solar irradiance cycle
 * derived from latitude and day-night solar geometry as an offline/network fallback.
 */
export function generateSyntheticFallbackDiurnal(lat: number): AmbientDataPoint[] {
  const absLat = Math.min(90, Math.abs(lat));
  // Baseline mean temp based on latitude: Equator ~26°C, Mid-latitudes ~12°C, Arctic ~ -10°C
  const baseMeanTemp = Math.round(26 - (absLat / 90) * 34);
  const diurnalSwing = 14; // Typical diurnal amplitude
  const peakIrradiance = Math.max(100, Math.round(920 * Math.cos((absLat * Math.PI) / 200)));

  const points: AmbientDataPoint[] = [];
  for (let h = 0; h < 24; h++) {
    // Temperature minimum around 05:00, maximum around 15:00
    const tempPhase = ((h - 9) / 24) * 2 * Math.PI;
    const temp = baseMeanTemp + (diurnalSwing / 2) * Math.sin(tempPhase);

    // Solar irradiance: daylight from 06:00 to 18:00 peaking at solar noon (12:00)
    let irr = 0;
    if (h >= 6 && h <= 18) {
      const solarAngle = ((h - 6) / 12) * Math.PI;
      irr = Math.round(peakIrradiance * Math.sin(solarAngle));
    }

    points.push({
      hour: h,
      temperature_C: Number(temp.toFixed(1)),
      irradiance_wm2: irr,
    });
  }
  return points;
}

/**
 * Fetches real-time ambient temperature and solar irradiance for the current 24-hour diurnal cycle
 * from Open-Meteo weather API (with automatic physical fallback if offline or timed out).
 *
 * @param lat Latitude (-90 to 90)
 * @param lon Longitude (-180 to 180)
 * @returns ClimateFetchResult with 24 AmbientDataPoints
 */
export async function fetchRealTimeWeatherData(
  lat: number,
  lon: number
): Promise<ClimateFetchResult> {
  // Open-Meteo provides accurate global real-time hourly temperature (2m) and global solar radiation (W/m²)
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,shortwave_radiation&forecast_days=1&timezone=auto`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Open-Meteo returned HTTP ${response.status}. Using physical fallback model.`);
      return {
        success: true,
        data: generateSyntheticFallbackDiurnal(lat),
        source: 'Physical Diurnal Fallback (Weather Service Unavailable)',
        error: null,
      };
    }

    interface OpenMeteoHourlyResponse {
      hourly?: {
        time?: string[];
        temperature_2m?: number[];
        shortwave_radiation?: number[];
      };
    }

    const json = (await response.json()) as OpenMeteoHourlyResponse;
    const temps = json.hourly?.temperature_2m;
    const radiations = json.hourly?.shortwave_radiation;

    if (!temps || !radiations || temps.length < 24) {
      return {
        success: true,
        data: generateSyntheticFallbackDiurnal(lat),
        source: 'Physical Diurnal Fallback (Incomplete Weather Data)',
        error: null,
      };
    }

    const data: AmbientDataPoint[] = [];
    for (let h = 0; h < 24; h++) {
      const rawTemp = temps[h] ?? 0;
      const rawRad = radiations[h] ?? 0;

      data.push({
        hour: h,
        temperature_C: Number(rawTemp.toFixed(2)),
        irradiance_wm2: Math.max(0, Number(rawRad.toFixed(2))),
      });
    }

    return {
      success: true,
      data,
      source: 'Open-Meteo Real-Time Diurnal Model',
      error: null,
    };
  } catch (err) {
    console.warn(`Weather API request failed (${err}). Using physical diurnal model fallback.`);
    return {
      success: true,
      data: generateSyntheticFallbackDiurnal(lat),
      source: 'Physical Diurnal Fallback (Offline / Network Blip)',
      error: null,
    };
  }
}

/**
 * Expected schema returned by NASA POWER point hourly endpoint.
 */
interface NasaPowerHourlyResponse {
  properties?: {
    parameter?: {
      T2M?: Record<string, number>;
      ALLSKY_SFC_SW_DWN?: Record<string, number>;
    };
  };
  header?: {
    fill_value?: number;
  };
  messages?: string[];
}

/**
 * Fetches 24-hour diurnal ambient temperature and solar irradiance for a specific
 * coordinate and date from the NASA POWER Point Hourly API (with fallback to real-time weather).
 */
export async function fetchClimateData(
  lat: number,
  lon: number,
  dateStr: string
): Promise<ClimateFetchResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      success: false,
      data: null,
      error: 'You appear to be offline. Please verify your internet connection.',
    };
  }

  // Normalize dateStr to YYYYMMDD
  const cleanDate = dateStr.replace(/[^0-9]/g, '');
  if (cleanDate.length !== 8) {
    return {
      success: false,
      data: null,
      error: `Invalid date format "${dateStr}". Expected YYYY-MM-DD.`,
    };
  }

  const todayClean = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  // If the user requested today or a future date, route directly to real-time weather API
  if (cleanDate >= todayClean) {
    return fetchRealTimeWeatherData(lat, lon);
  }

  const url = `https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=T2M,ALLSKY_SFC_SW_DWN&community=RE&longitude=${lon}&latitude=${lat}&start=${cleanDate}&end=${cleanDate}&format=JSON`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      // Graceful fallback to real-time weather
      console.warn(`NASA POWER returned ${response.status}. Falling back to real-time weather service.`);
      return fetchRealTimeWeatherData(lat, lon);
    }

    const data = (await response.json()) as NasaPowerHourlyResponse;
    const t2mMap = data.properties?.parameter?.T2M;
    const swDwnMap = data.properties?.parameter?.ALLSKY_SFC_SW_DWN;
    const fillValue = data.header?.fill_value ?? -999;

    if (!t2mMap || !swDwnMap || Object.keys(t2mMap).length === 0) {
      return fetchRealTimeWeatherData(lat, lon);
    }

    const hourlyProfile: AmbientDataPoint[] = [];

    for (let h = 0; h < 24; h++) {
      const hourStr = String(h).padStart(2, '0');
      const timeKey = `${cleanDate}${hourStr}`;

      const rawTemp = t2mMap[timeKey];
      const rawIrr = swDwnMap[timeKey];

      // Check for NASA missing data fill values (-999)
      if (
        rawTemp === undefined ||
        rawIrr === undefined ||
        rawTemp <= -900 ||
        rawTemp === fillValue ||
        rawIrr <= -900 ||
        rawIrr === fillValue
      ) {
        // Fall back to real-time data instead of failing completely
        return fetchRealTimeWeatherData(lat, lon);
      }

      hourlyProfile.push({
        hour: h,
        temperature_C: Number(rawTemp.toFixed(2)),
        irradiance_wm2: Math.max(0, Number(rawIrr.toFixed(2))),
      });
    }

    return {
      success: true,
      data: hourlyProfile,
      source: `NASA POWER (${dateStr})`,
      error: null,
    };
  } catch (err) {
    console.warn('NASA POWER request encountered error, trying real-time fallback:', err);
    return fetchRealTimeWeatherData(lat, lon);
  }
}
