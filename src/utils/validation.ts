import type { ShelterConfig } from '../types/shelter';

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validates a ShelterConfig instance for physical sanity and constraints.
 * Basic validation rules:
 * - Dimensions must be positive non-zero numbers
 * - Sane temperature ranges (-60°C to +70°C)
 * - Solar irradiance >= 0 W/m²
 * - Orientation 0° to 359°
 * - Thermophysical material properties must be physically sane
 * - Layer thicknesses must be > 0
 */
export function validateShelterConfig(config: ShelterConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 1. Geometry Validation
  const { length_m, width_m, height_m, orientation_deg, openings } = config.geometry;

  if (length_m <= 0) {
    issues.push({
      field: 'geometry.length_m',
      message: 'Shelter length must be strictly greater than 0 meters.',
      severity: 'error',
    });
  }
  if (width_m <= 0) {
    issues.push({
      field: 'geometry.width_m',
      message: 'Shelter width must be strictly greater than 0 meters.',
      severity: 'error',
    });
  }
  if (height_m <= 0) {
    issues.push({
      field: 'geometry.height_m',
      message: 'Shelter height must be strictly greater than 0 meters.',
      severity: 'error',
    });
  }
  if (orientation_deg < 0 || orientation_deg >= 360) {
    issues.push({
      field: 'geometry.orientation_deg',
      message: 'Orientation azimuth must be between 0° and 359°.',
      severity: 'error',
    });
  }

  // Calculate gross wall area for rectangular box: 2 * (L*H + W*H)
  const grossWallArea_m2 = 2 * (length_m * height_m + width_m * height_m);
  let totalOpeningsArea_m2 = 0;

  openings.forEach((op, idx) => {
    if (op.count < 0) {
      issues.push({
        field: `openings[${idx}].count`,
        message: `Opening #${idx + 1}: Count cannot be negative.`,
        severity: 'error',
      });
    }
    if (op.areaEach_m2 < 0) {
      issues.push({
        field: `openings[${idx}].areaEach_m2`,
        message: `Opening #${idx + 1}: Area cannot be negative.`,
        severity: 'error',
      });
    }
    totalOpeningsArea_m2 += (op.count || 0) * (op.areaEach_m2 || 0);
  });

  if (grossWallArea_m2 > 0 && totalOpeningsArea_m2 > grossWallArea_m2) {
    issues.push({
      field: 'geometry.openings',
      message: `Total openings area (${totalOpeningsArea_m2.toFixed(1)} m²) exceeds total wall area (${grossWallArea_m2.toFixed(1)} m²).`,
      severity: 'error',
    });
  } else if (grossWallArea_m2 > 0 && totalOpeningsArea_m2 > grossWallArea_m2 * 0.6) {
    issues.push({
      field: 'geometry.openings',
      message: `Total openings area represents over 60% of total wall area (${totalOpeningsArea_m2.toFixed(1)} m² / ${grossWallArea_m2.toFixed(1)} m²). Verify feasibility.`,
      severity: 'warning',
    });
  }

  // 2. Ambient Climate Validation
  const { hourlyProfile, latitude, longitude } = config.ambientClimate;

  if (latitude < -90 || latitude > 90) {
    issues.push({
      field: 'ambientClimate.latitude',
      message: 'Latitude must be between -90° and +90°.',
      severity: 'error',
    });
  }
  if (longitude < -180 || longitude > 180) {
    issues.push({
      field: 'ambientClimate.longitude',
      message: 'Longitude must be between -180° and +180°.',
      severity: 'error',
    });
  }

  if (!hourlyProfile || hourlyProfile.length !== 24) {
    issues.push({
      field: 'ambientClimate.hourlyProfile',
      message: `Climate diurnal profile must have exactly 24 hourly values (current: ${hourlyProfile ? hourlyProfile.length : 0}).`,
      severity: 'error',
    });
  } else {
    hourlyProfile.forEach((pt) => {
      if (pt.temperature_C < -60 || pt.temperature_C > 70) {
        issues.push({
          field: `hourlyProfile[${pt.hour}].temperature_C`,
          message: `Hour ${pt.hour}: Temperature ${pt.temperature_C}°C is outside realistic terrestrial limits (-60°C to +70°C).`,
          severity: 'warning',
        });
      }
      if (pt.irradiance_wm2 < 0) {
        issues.push({
          field: `hourlyProfile[${pt.hour}].irradiance_wm2`,
          message: `Hour ${pt.hour}: Solar irradiance cannot be negative (${pt.irradiance_wm2} W/m²).`,
          severity: 'error',
        });
      }
      if (pt.irradiance_wm2 > 1400) {
        issues.push({
          field: `hourlyProfile[${pt.hour}].irradiance_wm2`,
          message: `Hour ${pt.hour}: Solar irradiance (${pt.irradiance_wm2} W/m²) exceeds typical solar constant (~1361 W/m²).`,
          severity: 'warning',
        });
      }
    });
  }

  // 3. Materials Library Validation
  const materialIds = new Set<string>();
  config.materialsLibrary.forEach((m) => {
    materialIds.add(m.id);

    if (m.conductivity_k <= 0) {
      issues.push({
        field: `material[${m.id}].conductivity_k`,
        message: `Material '${m.name}': Thermal conductivity must be > 0 W/m·K.`,
        severity: 'error',
      });
    }
    if (m.density <= 0) {
      issues.push({
        field: `material[${m.id}].density`,
        message: `Material '${m.name}': Density must be > 0 kg/m³.`,
        severity: 'error',
      });
    }
    if (m.specificHeat_c <= 0) {
      issues.push({
        field: `material[${m.id}].specificHeat_c`,
        message: `Material '${m.name}': Specific heat capacity must be > 0 J/kg·K.`,
        severity: 'error',
      });
    }
    if (m.solarAbsorptivity < 0 || m.solarAbsorptivity > 1) {
      issues.push({
        field: `material[${m.id}].solarAbsorptivity`,
        message: `Material '${m.name}': Solar absorptivity α must be between 0 and 1.`,
        severity: 'error',
      });
    }
    if (m.thermalEmissivity < 0 || m.thermalEmissivity > 1) {
      issues.push({
        field: `material[${m.id}].thermalEmissivity`,
        message: `Material '${m.name}': Thermal emissivity ε must be between 0 and 1.`,
        severity: 'error',
      });
    }
  });

  // 4. Wall & Roof Layers Validation
  if (config.wallLayers.length === 0) {
    issues.push({
      field: 'wallLayers',
      message: 'At least one wall layer is required.',
      severity: 'error',
    });
  }
  config.wallLayers.forEach((layer, idx) => {
    if (!materialIds.has(layer.materialId)) {
      issues.push({
        field: `wallLayers[${idx}]`,
        message: `Wall Layer #${idx + 1}: Referencing missing material id '${layer.materialId}'.`,
        severity: 'error',
      });
    }
    if (layer.thickness_m <= 0) {
      issues.push({
        field: `wallLayers[${idx}].thickness_m`,
        message: `Wall Layer #${idx + 1}: Thickness must be > 0 m.`,
        severity: 'error',
      });
    }
  });

  if (config.roofLayers.length === 0) {
    issues.push({
      field: 'roofLayers',
      message: 'At least one roof layer is required.',
      severity: 'error',
    });
  }
  config.roofLayers.forEach((layer, idx) => {
    if (!materialIds.has(layer.materialId)) {
      issues.push({
        field: `roofLayers[${idx}]`,
        message: `Roof Layer #${idx + 1}: Referencing missing material id '${layer.materialId}'.`,
        severity: 'error',
      });
    }
    if (layer.thickness_m <= 0) {
      issues.push({
        field: `roofLayers[${idx}].thickness_m`,
        message: `Roof Layer #${idx + 1}: Thickness must be > 0 m.`,
        severity: 'error',
      });
    }
  });

  return issues;
}
