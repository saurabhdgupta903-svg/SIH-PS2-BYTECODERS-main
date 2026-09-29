import type {
  AmbientDataPoint,
  Material,
  WallLayer,
  ShelterConfig,
} from '../types/shelter';

/**
 * Formula 1: Solar radiation absorbed by a surface
 * Q_solar = I × A × α × cos(θ)
 *
 * @param irradiance Solar irradiance I (W/m²) — from AmbientDataPoint, varies per time step
 * @param area Surface area exposed to sun A (m²) — derived from ShelterGeometry
 * @param absorptivity Absorptivity of surface material α (0 to 1) — from Material
 * @param incidenceAngleRad Angle of incidence θ between sun rays and surface normal (radians)
 * @returns Solar radiation absorbed by surface Q_solar (W)
 */
export function calculateSolarGain(
  irradiance: number,
  area: number,
  absorptivity: number,
  incidenceAngleRad: number
): number {
  // TODO: NEEDS DOMAIN VALIDATION — cos(incidenceAngleRad) may yield negative values if the sun is below the horizon or behind the surface; solar tracking and horizon clipping are omitted per strict formula specifications.
  return irradiance * area * absorptivity * Math.cos(incidenceAngleRad);
}

/**
 * Formula 2: Net absorbed heat after any glazing transmission loss
 * Q_absorbed = Q_solar × τ
 *
 * @param qSolar Incident solar radiation absorbed by surface Q_solar (W)
 * @param transmittance Transmittance of glazing τ (0 to 1); if no glazing, τ = 1
 * @returns Net absorbed heat Q_absorbed (W)
 */
export function calculateAbsorbedHeat(qSolar: number, transmittance: number): number {
  return qSolar * transmittance;
}

/**
 * Formula 3: Overall heat transfer coefficient (U-value) for a SINGLE layer
 * U = 1 / (1/h_i + L/k + 1/h_o)
 *
 * @param hInterior Interior convective heat transfer coefficient h_i (W/m²·K)
 * @param thickness Layer thickness L (m) — from WallLayer.thickness_m
 * @param conductivity Thermal conductivity of material k (W/m·K) — from Material.conductivity_k
 * @param hExterior Exterior convective heat transfer coefficient h_o (W/m²·K)
 * @returns Overall heat transfer coefficient U (W/m²·K)
 */
export function calculateUValueSingleLayer(
  hInterior: number,
  thickness: number,
  conductivity: number,
  hExterior: number
): number {
  return 1 / (1 / hInterior + thickness / conductivity + 1 / hExterior);
}

/**
 * Formula 4: Overall U-value for MULTI-LAYER composite wall
 * 1/U = 1/h_i + Σ(L_n / k_n) for each layer n + 1/h_o
 *
 * Resolves each WallLayer's materialId against the materials array to get k,
 * sums L/k across all layers, then combines with h_i and h_o.
 *
 * @param hInterior Interior convective heat transfer coefficient h_i (W/m²·K)
 * @param layers Array of composite wall layers
 * @param materials Array of available materials to resolve conductivity_k
 * @param hExterior Exterior convective heat transfer coefficient h_o (W/m²·K)
 * @returns Overall U-value for the multi-layer wall (W/m²·K)
 */
export function calculateUValueMultiLayer(
  hInterior: number,
  layers: WallLayer[],
  materials: Material[],
  hExterior: number
): number {
  let sumLOverK = 0;
  for (const layer of layers) {
    const material = materials.find((m) => m.id === layer.materialId);
    if (!material) {
      throw new Error(`Material with id "${layer.materialId}" not found in materials library`);
    }
    sumLOverK += layer.thickness_m / material.conductivity_k;
  }
  return 1 / (1 / hInterior + sumLOverK + 1 / hExterior);
}

/**
 * Formula 5: Conductive/convective heat loss through a surface
 * Q_loss = U × A × (T_in − T_ambient)
 *
 * @param uValue Overall heat transfer coefficient U (W/m²·K)
 * @param area Surface area A (m²)
 * @param tInside Inside temperature T_in (°C)
 * @param tAmbient Ambient outside temperature T_ambient (°C)
 * @returns Conductive/convective heat loss Q_loss (W)
 */
export function calculateHeatLoss(
  uValue: number,
  area: number,
  tInside: number,
  tAmbient: number
): number {
  return uValue * area * (tInside - tAmbient);
}

/**
 * Formula 6: Infiltration heat loss through openings
 * Q_infiltration = V̇ × ρ × c_p × (T_in − T_ambient)
 *
 * @param infiltrationRate Air infiltration rate V̇ (m³/s) — explicit input parameter
 * @param airDensity Air density ρ (kg/m³) — explicit input parameter
 * @param airSpecificHeat Specific heat of air c_p (J/kg·K) — explicit input parameter
 * @param tInside Inside temperature T_in (°C)
 * @param tAmbient Ambient outside temperature T_ambient (°C)
 * @returns Infiltration heat loss Q_infiltration (W)
 */
export function calculateInfiltrationLoss(
  infiltrationRate: number,
  airDensity: number,
  airSpecificHeat: number,
  tInside: number,
  tAmbient: number
): number {
  return infiltrationRate * airDensity * airSpecificHeat * (tInside - tAmbient);
}

/**
 * Formula 7: Radiative heat loss to night sky
 * Q_radiative = ε × σ × A × (T_surface^4 − T_sky^4)
 *
 * Temperatures T_surface and T_sky MUST be in Kelvin.
 * They are converted from °C by adding 273.15 inside this function.
 *
 * @param emissivity Emissivity of surface ε (0 to 1) — from Material.thermalEmissivity
 * @param area Radiating surface area A (m²)
 * @param tSurfaceCelsius Surface temperature T_surface (°C)
 * @param tSkyCelsius Effective sky temperature T_sky (°C)
 * @returns Radiative heat loss to sky Q_radiative (W)
 */
export function calculateRadiativeLoss(
  emissivity: number,
  area: number,
  tSurfaceCelsius: number,
  tSkyCelsius: number
): number {
  // Physical constant: Stefan-Boltzmann constant σ = 5.67 × 10⁻⁸ W/m²·K⁴
  const STEFAN_BOLTZMANN = 5.67e-8;

  // Explicit conversion from Celsius to Kelvin
  const tSurfaceK = tSurfaceCelsius + 273.15;
  const tSkyK = tSkyCelsius + 273.15;

  return emissivity * STEFAN_BOLTZMANN * area * (Math.pow(tSurfaceK, 4) - Math.pow(tSkyK, 4));
}

/**
 * Formula 8: Total thermal capacitance of the shelter
 * C = Σ(m_n × c_n) for each thermal mass element n
 *
 * @param elements Array of mass elements { mass: number (kg), specificHeat: number (J/kg·K) }
 * @returns Total thermal capacitance C (J/K)
 */
export function calculateThermalCapacitance(
  elements: { mass: number; specificHeat: number }[]
): number {
  return elements.reduce((total, el) => total + el.mass * el.specificHeat, 0);
}

/**
 * Formula 9: Temperature prediction over time (explicit Euler time-stepping)
 * T_in(t + Δt) = T_in(t) + (Δt / C) × [Q_absorbed(t) − Q_loss(t) − Q_infiltration(t) − Q_radiative(t)]
 *
 * Takes the FULL ShelterConfig (with its hourlyProfile: AmbientDataPoint[]) and steps forward
 * one time increment at a time, calling Formulas 1, 2, 5, 6, 7 at each step, then applying
 * this formula to get the next T_in.
 *
 * @param config Full ShelterConfig object
 * @param initialTempC Initial inside temperature T_in(0) (°C)
 * @param timeStepSeconds Time step Δt (seconds)
 * @param infiltrationRate Air infiltration rate V̇ (m³/s)
 * @param airDensity Air density ρ (kg/m³)
 * @param airSpecificHeat Specific heat of air c_p (J/kg·K)
 * @param hInterior Interior convective heat transfer coefficient h_i (W/m²·K)
 * @param hExterior Exterior convective heat transfer coefficient h_o (W/m²·K)
 * @param skyTempOffsetC Number of degrees Celsius below ambient for effective sky temperature (T_sky = T_ambient - skyTempOffsetC)
 * @returns Time series of simulated states { time, tempC, qSolar, qLoss, qInfiltration, qRadiative }[]
 */
export function simulateTemperatureOverTime(
  config: ShelterConfig,
  initialTempC: number,
  timeStepSeconds: number,
  infiltrationRate: number,
  airDensity: number,
  airSpecificHeat: number,
  hInterior: number,
  hExterior: number,
  skyTempOffsetC: number
): {
  time: number;
  tempC: number;
  qSolar: number;
  qAbsorbed: number;
  qLoss: number;
  qInfiltration: number;
  qRadiative: number;
}[] {
  if (timeStepSeconds <= 0) {
    throw new Error('timeStepSeconds must be greater than zero');
  }

  const profile: AmbientDataPoint[] = config.ambientClimate.hourlyProfile ?? [];
  if (profile.length === 0) {
    return [];
  }

  // Derive envelope areas from ShelterGeometry
  const { length_m, width_m, height_m } = config.geometry;
  const roofArea = length_m * width_m;
  const wallGrossArea = 2 * (length_m + width_m) * height_m;
  const totalArea = wallGrossArea + roofArea;

  // Multi-layer envelope U-values
  let uWall = 0;
  if (config.wallLayers.length > 0) {
    uWall = calculateUValueMultiLayer(hInterior, config.wallLayers, config.materialsLibrary, hExterior);
  }

  let uRoof = 0;
  if (config.roofLayers.length > 0) {
    uRoof = calculateUValueMultiLayer(hInterior, config.roofLayers, config.materialsLibrary, hExterior);
  }

  // Overall combined U-value weighted by area
  // TODO: NEEDS DOMAIN VALIDATION — opening conduction heat loss and whether opening areas should be subtracted from wall gross area are not specified in the current types or formulas.
  const overallUA = uWall * wallGrossArea + uRoof * roofArea;
  const uOverall = totalArea > 0 ? overallUA / totalArea : 0;

  // Exterior surface material properties (derived from outermost roof layer)
  const extRoofLayer = config.roofLayers[0];
  const extRoofMaterial = extRoofLayer
    ? config.materialsLibrary.find((m) => m.id === extRoofLayer.materialId)
    : undefined;
  const absorptivity = extRoofMaterial?.solarAbsorptivity ?? 0;
  const emissivity = extRoofMaterial?.thermalEmissivity ?? 0;

  // Glazing transmittance
  // TODO: NEEDS DOMAIN VALIDATION — Glazing transmittance tau is not present in ShelterConfig, ShelterOpening, or Material types. Defaulting tau = 1 (no glazing transmission loss / opaque absorption) per Formula 2 specification.
  const transmittance = 1;

  // Solar incidence angle
  // TODO: NEEDS DOMAIN VALIDATION — Solar incidence angle theta is not provided in AmbientDataPoint or ShelterConfig; currently assuming normal incidence (incidenceAngleRad = 0, cos(0) = 1) on horizontal roof surface.
  const incidenceAngleRad = 0;

  // Compute thermal capacitance C from envelope layers and indoor air
  const capacitanceElements: { mass: number; specificHeat: number }[] = [];

  for (const layer of config.wallLayers) {
    const mat = config.materialsLibrary.find((m) => m.id === layer.materialId);
    if (mat) {
      const volume = wallGrossArea * layer.thickness_m;
      capacitanceElements.push({
        mass: mat.density * volume,
        specificHeat: mat.specificHeat_c,
      });
    }
  }

  for (const layer of config.roofLayers) {
    const mat = config.materialsLibrary.find((m) => m.id === layer.materialId);
    if (mat) {
      const volume = roofArea * layer.thickness_m;
      capacitanceElements.push({
        mass: mat.density * volume,
        specificHeat: mat.specificHeat_c,
      });
    }
  }

  // TODO: NEEDS DOMAIN VALIDATION — Clarify whether indoor air volume capacitance should be included alongside envelope thermal mass in total capacitance C.
  const airVolume = length_m * width_m * height_m;
  capacitanceElements.push({
    mass: airVolume * airDensity,
    specificHeat: airSpecificHeat,
  });

  const totalCapacitance = calculateThermalCapacitance(capacitanceElements);
  if (totalCapacitance <= 0) {
    throw new Error('Total thermal capacitance must be greater than zero');
  }

  // Explicit Euler time stepping forward
  const totalDurationSeconds = profile.length * 3600;
  const totalSteps = Math.max(1, Math.floor(totalDurationSeconds / timeStepSeconds));
  let currentTemp = initialTempC;

  const results: {
    time: number;
    tempC: number;
    qSolar: number;
    qAbsorbed: number;
    qLoss: number;
    qInfiltration: number;
    qRadiative: number;
  }[] = [];

  for (let step = 0; step < totalSteps; step++) {
    const time = step * timeStepSeconds;
    const hourIndex = Math.min(Math.floor(time / 3600), profile.length - 1);
    const ambientPoint = profile[hourIndex];
    const tAmbient = ambientPoint.temperature_C;
    const irradiance = ambientPoint.irradiance_wm2;

    // Formula 1: Solar radiation absorbed by surface
    const qSolar = calculateSolarGain(irradiance, roofArea, absorptivity, incidenceAngleRad);

    // Formula 2: Net absorbed heat after any glazing transmission loss
    const qAbsorbed = calculateAbsorbedHeat(qSolar, transmittance);

    // Formula 5: Conductive/convective heat loss through surface
    const qLoss = calculateHeatLoss(uOverall, totalArea, currentTemp, tAmbient);

    // Formula 6: Infiltration heat loss through openings
    const qInfiltration = calculateInfiltrationLoss(
      infiltrationRate,
      airDensity,
      airSpecificHeat,
      currentTemp,
      tAmbient
    );

    // Formula 7: Radiative heat loss to night sky
    // TODO: NEEDS DOMAIN VALIDATION — In a single-node lumped capacitance model, interior temperature T_in is used as surface temperature T_surface since surface node temperatures are not separately solved.
    // TODO: NEEDS DOMAIN VALIDATION — Radiative heat loss to sky is calculated for the horizontal roof surface area facing the sky. Sky view factors for vertical walls are not defined.
    const tSkyCelsius = tAmbient - skyTempOffsetC;
    const qRadiative = calculateRadiativeLoss(emissivity, roofArea, currentTemp, tSkyCelsius);

    // Store state before taking forward step
    results.push({
      time,
      tempC: currentTemp,
      qSolar,
      qAbsorbed,
      qLoss,
      qInfiltration,
      qRadiative,
    });

    // Formula 9: Explicit Euler step
    const netHeatFlow = qAbsorbed - qLoss - qInfiltration - qRadiative;
    currentTemp = currentTemp + (timeStepSeconds / totalCapacitance) * netHeatFlow;
  }

  return results;
}

/**
 * Formula 10: Comparative efficiency score (for later material comparison)
 * η = (∫Q_absorbed dt − ∫(Q_loss + Q_infiltration + Q_radiative) dt) / ∫Q_solar dt
 *
 * Approximates the integrals as simple sums over the time-stepped results from Formula 9
 * (sum of each Q value across all time steps, multiplied by timeStepSeconds).
 *
 * @param timeSeriesResults Output from simulateTemperatureOverTime
 * @param qSolarSeries Array of incident solar radiation values across all time steps
 * @returns Efficiency score η
 */
export function calculateEfficiencyScore(
  timeSeriesResults: ReturnType<typeof simulateTemperatureOverTime>,
  qSolarSeries: number[]
): number {
  if (timeSeriesResults.length === 0 || qSolarSeries.length === 0) {
    return 0;
  }

  const timeStepSeconds =
    timeSeriesResults.length > 1
      ? timeSeriesResults[1].time - timeSeriesResults[0].time
      : 1;

  let sumQAbsorbed = 0;
  let sumQLoss = 0;
  let sumQInfiltration = 0;
  let sumQRadiative = 0;

  for (const step of timeSeriesResults) {
    sumQAbsorbed += step.qAbsorbed;
    sumQLoss += step.qLoss;
    sumQInfiltration += step.qInfiltration;
    sumQRadiative += step.qRadiative;
  }

  let sumQSolar = 0;
  for (const q of qSolarSeries) {
    sumQSolar += q;
  }

  const integralQAbsorbed = sumQAbsorbed * timeStepSeconds;
  const integralLosses = (sumQLoss + sumQInfiltration + sumQRadiative) * timeStepSeconds;
  const integralQSolar = sumQSolar * timeStepSeconds;

  if (integralQSolar === 0) {
    return 0;
  }

  return (integralQAbsorbed - integralLosses) / integralQSolar;
}
