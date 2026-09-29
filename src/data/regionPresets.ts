import { type RegionPreset, SAMPLE_PRESET_NOTICE } from '../types/shelter.ts';

/**
 * SAMPLE UI Convenience Presets for TerraShelter.
 * 
 * CRITICAL ARCHITECTURAL REQUIREMENT:
 * These presets are UI convenience data bundles only.
 * The application logic and thermal processing treat them identically
 * to any user-uploaded CSV or manually typed data, with ZERO special-casing.
 * 
 * ALL PRESETS ARE EXPLICITLY LABELED:
 * "SAMPLE DATA — NOT VALIDATED, FOR DEMO ONLY"
 */
export const REGION_PRESETS: RegionPreset[] = [
  {
    id: 'cold_high_altitude_desert',
    name: 'Cold high-altitude desert (e.g. Ladakh-type climate)',
    climateSummary: 'Extreme diurnal swing, low sub-zero winter temperatures, high clear-sky solar irradiance.',
    disclaimer: SAMPLE_PRESET_NOTICE,
    defaultSingleMaterialId: 'mud_brick_adobe',
    defaultWallThickness_m: 0.40, // 400mm traditional earthen thermal mass
    defaultRoofThickness_m: 0.30, // 300mm insulated mud/timber deck
    defaultGeometry: {
      shape: 'rectangular_box',
      length_m: 4.0,
      width_m: 3.0,
      height_m: 2.5,
      orientation_deg: 180, // Facing South for direct solar aperture gain
      openings: [
        {
          id: 'op_south_window',
          count: 1,
          areaEach_m2: 2.4, // Large southern glazing for solar heat capture
          type: 'plain_glass',
          description: 'South-facing direct solar gain aperture',
        },
        {
          id: 'op_entry_door',
          count: 1,
          areaEach_m2: 1.8,
          type: 'insulated',
          description: 'Airlock/insulated access door',
        },
      ],
    },
    ambientClimate: {
      regionName: 'Cold High-Altitude Desert (Demo Profile)',
      latitude: 34.15, // e.g. ~34.15° N
      longitude: 77.58, // e.g. ~77.58° E
      dateSeasonLabel: 'Representative Winter Solstice Day (January)',
      hourlyProfile: [
        { hour: 0, temperature_C: -14.0, irradiance_wm2: 0 },
        { hour: 1, temperature_C: -15.0, irradiance_wm2: 0 },
        { hour: 2, temperature_C: -15.5, irradiance_wm2: 0 },
        { hour: 3, temperature_C: -16.0, irradiance_wm2: 0 },
        { hour: 4, temperature_C: -16.0, irradiance_wm2: 0 },
        { hour: 5, temperature_C: -15.5, irradiance_wm2: 0 },
        { hour: 6, temperature_C: -14.5, irradiance_wm2: 0 },
        { hour: 7, temperature_C: -12.0, irradiance_wm2: 45 },
        { hour: 8, temperature_C: -8.0, irradiance_wm2: 260 },
        { hour: 9, temperature_C: -4.0, irradiance_wm2: 520 },
        { hour: 10, temperature_C: -1.0, irradiance_wm2: 740 },
        { hour: 11, temperature_C: 1.5, irradiance_wm2: 890 },
        { hour: 12, temperature_C: 3.0, irradiance_wm2: 940 },
        { hour: 13, temperature_C: 3.5, irradiance_wm2: 880 },
        { hour: 14, temperature_C: 2.8, irradiance_wm2: 710 },
        { hour: 15, temperature_C: 0.5, irradiance_wm2: 480 },
        { hour: 16, temperature_C: -2.0, irradiance_wm2: 210 },
        { hour: 17, temperature_C: -5.5, irradiance_wm2: 30 },
        { hour: 18, temperature_C: -8.5, irradiance_wm2: 0 },
        { hour: 19, temperature_C: -10.5, irradiance_wm2: 0 },
        { hour: 20, temperature_C: -11.8, irradiance_wm2: 0 },
        { hour: 21, temperature_C: -12.5, irradiance_wm2: 0 },
        { hour: 22, temperature_C: -13.2, irradiance_wm2: 0 },
        { hour: 23, temperature_C: -13.8, irradiance_wm2: 0 },
      ],
    },
  },
  {
    id: 'hot_arid_climate',
    name: 'Hot arid climate',
    climateSummary: 'High daytime temperatures, intense solar load, moderate overnight cooling swing.',
    disclaimer: SAMPLE_PRESET_NOTICE,
    defaultSingleMaterialId: 'ceb_compressed_earth',
    defaultWallThickness_m: 0.35,
    defaultRoofThickness_m: 0.25,
    defaultGeometry: {
      shape: 'rectangular_box',
      length_m: 4.5,
      width_m: 3.5,
      height_m: 2.8,
      orientation_deg: 90, // E-W axis minimizes extreme east/west solar absorption
      openings: [
        {
          id: 'op_shaded_window',
          count: 2,
          areaEach_m2: 1.2,
          type: 'insulated',
          description: 'Deeply recessed shaded windows',
        },
        {
          id: 'op_entry_door',
          count: 1,
          areaEach_m2: 2.0,
          type: 'plain_glass',
          description: 'Protected courtyard entry door',
        },
      ],
    },
    ambientClimate: {
      regionName: 'Hot Arid Desert Region (Demo Profile)',
      latitude: 26.91,
      longitude: 75.78,
      dateSeasonLabel: 'Representative Peak Summer Day (June)',
      hourlyProfile: [
        { hour: 0, temperature_C: 28.5, irradiance_wm2: 0 },
        { hour: 1, temperature_C: 27.5, irradiance_wm2: 0 },
        { hour: 2, temperature_C: 26.5, irradiance_wm2: 0 },
        { hour: 3, temperature_C: 25.5, irradiance_wm2: 0 },
        { hour: 4, temperature_C: 24.8, irradiance_wm2: 0 },
        { hour: 5, temperature_C: 25.0, irradiance_wm2: 0 },
        { hour: 6, temperature_C: 27.0, irradiance_wm2: 70 },
        { hour: 7, temperature_C: 29.5, irradiance_wm2: 240 },
        { hour: 8, temperature_C: 32.5, irradiance_wm2: 450 },
        { hour: 9, temperature_C: 35.8, irradiance_wm2: 660 },
        { hour: 10, temperature_C: 38.5, irradiance_wm2: 790 },
        { hour: 11, temperature_C: 40.8, irradiance_wm2: 870 },
        { hour: 12, temperature_C: 42.5, irradiance_wm2: 890 },
        { hour: 13, temperature_C: 43.2, irradiance_wm2: 840 },
        { hour: 14, temperature_C: 42.8, irradiance_wm2: 720 },
        { hour: 15, temperature_C: 41.5, irradiance_wm2: 540 },
        { hour: 16, temperature_C: 39.5, irradiance_wm2: 320 },
        { hour: 17, temperature_C: 37.0, irradiance_wm2: 110 },
        { hour: 18, temperature_C: 34.5, irradiance_wm2: 10 },
        { hour: 19, temperature_C: 32.8, irradiance_wm2: 0 },
        { hour: 20, temperature_C: 31.5, irradiance_wm2: 0 },
        { hour: 21, temperature_C: 30.5, irradiance_wm2: 0 },
        { hour: 22, temperature_C: 29.8, irradiance_wm2: 0 },
        { hour: 23, temperature_C: 29.0, irradiance_wm2: 0 },
      ],
    },
  },
  {
    id: 'temperate_climate',
    name: 'Temperate climate',
    climateSummary: 'Moderate seasonal ambient temperatures, balanced solar irradiation, mild diurnal swing.',
    disclaimer: SAMPLE_PRESET_NOTICE,
    defaultSingleMaterialId: 'natural_stone',
    defaultWallThickness_m: 0.25,
    defaultRoofThickness_m: 0.20,
    defaultGeometry: {
      shape: 'rectangular_box',
      length_m: 4.0,
      width_m: 3.0,
      height_m: 2.6,
      orientation_deg: 180,
      openings: [
        {
          id: 'op_standard_window',
          count: 2,
          areaEach_m2: 1.5,
          type: 'plain_glass',
          description: 'Standard double glazed fenestrations',
        },
        {
          id: 'op_door',
          count: 1,
          areaEach_m2: 1.9,
          type: 'plain_glass',
          description: 'Standard exterior door',
        },
      ],
    },
    ambientClimate: {
      regionName: 'Temperate Inland Basin (Demo Profile)',
      latitude: 45.42,
      longitude: 9.19,
      dateSeasonLabel: 'Representative Mid-Spring Day (April)',
      hourlyProfile: [
        { hour: 0, temperature_C: 9.0, irradiance_wm2: 0 },
        { hour: 1, temperature_C: 8.5, irradiance_wm2: 0 },
        { hour: 2, temperature_C: 8.0, irradiance_wm2: 0 },
        { hour: 3, temperature_C: 7.5, irradiance_wm2: 0 },
        { hour: 4, temperature_C: 7.2, irradiance_wm2: 0 },
        { hour: 5, temperature_C: 7.5, irradiance_wm2: 0 },
        { hour: 6, temperature_C: 8.5, irradiance_wm2: 30 },
        { hour: 7, temperature_C: 10.5, irradiance_wm2: 150 },
        { hour: 8, temperature_C: 12.8, irradiance_wm2: 320 },
        { hour: 9, temperature_C: 15.0, irradiance_wm2: 480 },
        { hour: 10, temperature_C: 17.0, irradiance_wm2: 590 },
        { hour: 11, temperature_C: 18.5, irradiance_wm2: 650 },
        { hour: 12, temperature_C: 19.5, irradiance_wm2: 670 },
        { hour: 13, temperature_C: 20.0, irradiance_wm2: 640 },
        { hour: 14, temperature_C: 19.8, irradiance_wm2: 560 },
        { hour: 15, temperature_C: 18.8, irradiance_wm2: 430 },
        { hour: 16, temperature_C: 17.2, irradiance_wm2: 260 },
        { hour: 17, temperature_C: 15.4, irradiance_wm2: 90 },
        { hour: 18, temperature_C: 13.5, irradiance_wm2: 5 },
        { hour: 19, temperature_C: 12.2, irradiance_wm2: 0 },
        { hour: 20, temperature_C: 11.2, irradiance_wm2: 0 },
        { hour: 21, temperature_C: 10.5, irradiance_wm2: 0 },
        { hour: 22, temperature_C: 9.8, irradiance_wm2: 0 },
        { hour: 23, temperature_C: 9.3, irradiance_wm2: 0 },
      ],
    },
  },
];
