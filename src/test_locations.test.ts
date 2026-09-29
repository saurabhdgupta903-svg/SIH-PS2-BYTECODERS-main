import assert from 'node:assert/strict';
import { fetchRealTimeWeatherData } from './lib/climateApi.ts';
import { simulateSteadyCycle } from './lib/simulateSteadyCycle.ts';
import { DEFAULT_MATERIALS } from './data/defaultMaterials.ts';
import { REGION_PRESETS } from './data/regionPresets.ts';
import type { ShelterConfig } from './types/shelter.ts';

function buildShelter(preset = REGION_PRESETS[0]): ShelterConfig {
  return {
    ambientClimate: { ...preset.ambientClimate },
    materialsLibrary: DEFAULT_MATERIALS.map((m) => ({ ...m })),
    wallLayers: [
      {
        id: 'wall_layer_default',
        materialId: preset.defaultSingleMaterialId,
        thickness_m: preset.defaultWallThickness_m,
      },
    ],
    roofLayers: [
      {
        id: 'roof_layer_default',
        materialId: preset.defaultSingleMaterialId,
        thickness_m: preset.defaultRoofThickness_m,
      },
    ],
    geometry: {
      shape: preset.defaultGeometry.shape,
      length_m: preset.defaultGeometry.length_m,
      width_m: preset.defaultGeometry.width_m,
      height_m: preset.defaultGeometry.height_m,
      orientation_deg: preset.defaultGeometry.orientation_deg,
      openings: preset.defaultGeometry.openings.map((op) => ({ ...op })),
    },
    activePresetId: preset.id,
  };
}

async function runTest() {
  console.log('\n--- Verifying Real-Time Weather & 3 Core Thermal Outputs Across 3 Global Sites ---');
  const shelter = buildShelter();
  const locations = [
    { name: 'Leh, Ladakh (High-Altitude Cold Desert)', lat: 34.1526, lon: 77.5771 },
    { name: 'Shimla, India (Sub-Himalayan Cold Climate)', lat: 31.1048, lon: 77.1734 },
    { name: 'Phoenix, Arizona (Hot Arid Desert Outside Ladakh)', lat: 33.4484, lon: -112.0740 }
  ];

  for (const loc of locations) {
    const weather = await fetchRealTimeWeatherData(loc.lat, loc.lon);
    assert.strictEqual(weather.success, true, `Weather failed for ${loc.name}: ${weather.error}`);
    assert.ok(weather.data && weather.data.length === 24, `Invalid weather points for ${loc.name}`);

    // Update shelter config with this location's real-time diurnal hourly profile
    const testConfig: ShelterConfig = {
      ...shelter,
      ambientClimate: {
        regionName: loc.name,
        latitude: loc.lat,
        longitude: loc.lon,
        dateSeasonLabel: 'Real-Time 24h Diurnal',
        hourlyProfile: weather.data,
      },
    };

    // Run steady-cycle simulation
    const result = simulateSteadyCycle(
      testConfig,
      3600,   // timeStepSeconds
      0.0005, // infiltrationRate
      1.225,  // airDensity
      1005,   // airSpecificHeat
      7.69,   // hInterior
      25.0,   // hExterior
      6       // skyTempOffsetC
    );

    assert.strictEqual(result.series.length, 24);
    assert.strictEqual(result.converged, true);

    // Compute the 3 REQUIRED thermal outputs:
    // (1) Predicted Indoor Temperature
    const insideTemps = result.series.map((s) => s.tempC);
    const ambTemps = weather.data.map((p) => p.temperature_C);
    const meanInside = insideTemps.reduce((s, t) => s + t, 0) / 24;
    const peakInside = Math.max(...insideTemps);
    const minInside = Math.min(...insideTemps);
    const meanAmb = ambTemps.reduce((s, t) => s + t, 0) / 24;
    const deltaT = meanInside - meanAmb;

    // (2) Solar Thermal Energy Generated (Wh & kWh)
    const solarThermalWh = result.series.reduce((sum, s) => sum + s.qSolar, 0);
    const solarThermalKWh = solarThermalWh / 1000;

    // (3) Heat Flow Over Defined 24h Period (Ambient vs Shelter difference & Heat Loss Wh / kWh)
    const heatFlowLossWh = result.series.reduce((sum, s) => sum + s.qLoss, 0);
    const heatFlowLossKWh = heatFlowLossWh / 1000;

    assert.ok(Number.isFinite(meanInside), 'Mean inside temp must be finite');
    assert.ok(Number.isFinite(solarThermalKWh), 'Solar thermal kWh must be finite');
    assert.ok(Number.isFinite(heatFlowLossKWh), 'Heat flow loss kWh must be finite');

    console.log(`\n======================================================`);
    console.log(`Site: ${loc.name}`);
    console.log(`Data Source: ${weather.source}`);
    console.log(`Simulation Status: Converged in ${result.daysSimulated} day(s) (residual: ${result.residualC.toFixed(4)}°C)`);
    console.log(`------------------------------------------------------`);
    console.log(`OUTPUT 1 - PREDICTED INDOOR TEMPERATURE:`);
    console.log(`   Mean Inside: ${meanInside.toFixed(2)} °C (Ambient Mean: ${meanAmb.toFixed(2)} °C, ΔT: ${deltaT > 0 ? '+' : ''}${deltaT.toFixed(2)} °C)`);
    console.log(`   Min / Max Inside: ${minInside.toFixed(2)} °C / ${peakInside.toFixed(2)} °C`);
    console.log(`OUTPUT 2 - SOLAR THERMAL ENERGY GENERATED:`);
    console.log(`   Daily Total: ${solarThermalWh.toFixed(1)} Wh (${solarThermalKWh.toFixed(2)} kWh)`);
    console.log(`OUTPUT 3 - HEAT FLOW OVER 24H PERIOD (AMBIENT VS SHELTER):`);
    console.log(`   Total Heat Flow Loss: ${heatFlowLossWh.toFixed(1)} Wh (${heatFlowLossKWh.toFixed(2)} kWh)`);
    console.log(`   Average Heat Flow Rate: ${(heatFlowLossWh / 24).toFixed(1)} W`);
  }

  console.log(`\n✓ All 3 global test locations passed with full thermal verification!\n`);
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
