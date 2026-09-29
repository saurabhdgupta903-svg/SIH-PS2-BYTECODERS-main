// Pure closed-form 3D geometry helpers for TerraShelter 3D Visualization
// No side effects, no Three.js dependencies, 100% hand-checkable arithmetic.

import type { ShelterGeometry, ShelterOpening, WallLayer } from '../types/shelter';

/**
 * Bounds of the rectangular shelter envelope.
 * length_m × width_m × height_m defines the exterior outline.
 * Coordinates centered on (X=0, Z=0) with base on the ground plane (Y=0).
 */
export interface ShelterBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  length: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  centerZ: number;
  boundingRadius: number;
}

export function calculateShelterBounds(geometry: ShelterGeometry): ShelterBounds {
  const { length_m, width_m, height_m } = geometry;
  const halfL = length_m / 2;
  const halfW = width_m / 2;

  const minX = -halfL;
  const maxX = halfL;
  const minY = 0;
  const maxY = height_m;
  const minZ = -halfW;
  const maxZ = halfW;

  const centerX = 0;
  const centerY = height_m / 2;
  const centerZ = 0;

  // Diagonal from center to corner: sqrt((L/2)^2 + (H/2)^2 + (W/2)^2)
  const boundingRadius = Math.sqrt(halfL * halfL + (height_m / 2) * (height_m / 2) + halfW * halfW);

  return {
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ,
    length: length_m,
    width: width_m,
    height: height_m,
    centerX,
    centerY,
    centerZ,
    boundingRadius,
  };
}

/**
 * Compass azimuth rotation for orientation_deg.
 * Exact data model definition:
 * "Compass azimuth degrees (0 = North, 90 = East, 180 = South, 270 = West)"
 *
 * In Three.js space:
 * - North is along -Z
 * - East is along +X
 * - South is along +Z
 * - West is along -X
 *
 * Clockwise rotation from North (-Z) around +Y axis:
 * 0°   -> 0 rad      (heading: 0, 0, -1)
 * 90°  -> -PI/2 rad  (heading: 1, 0, 0)
 * 180° -> -PI rad    (heading: 0, 0, 1)
 * 270° -> -3PI/2 rad (heading: -1, 0, 0)
 */
export function calculateCompassRotationRad(orientation_deg: number): number {
  const normalized = ((orientation_deg % 360) + 360) % 360;
  return normalized === 0 ? 0 : -normalized * (Math.PI / 180);
}

export function getHeadingVector(orientation_deg: number): { x: number; z: number } {
  const rad = calculateCompassRotationRad(orientation_deg);
  const rawX = -Math.sin(rad);
  const rawZ = -Math.cos(rad);
  const x = Math.abs(rawX) < 1e-6 ? 0 : Number(rawX.toFixed(4));
  const z = Math.abs(rawZ) < 1e-6 ? 0 : Number(rawZ.toFixed(4));
  return { x, z };
}

/**
 * Layer offset calculations for wall and roof build-ups.
 * Exterior envelope outline is fixed at length_m × width_m × height_m.
 * Layers are drawn inward in schema order:
 * Layer 0 = outermost (exterior face), Layer N-1 = innermost (interior face).
 */
export interface ComputedLayerOffset {
  layerId: string;
  materialId: string;
  nominalThickness_m: number;
  renderedThickness_m: number;
  outerOffset_m: number;
  innerOffset_m: number;
}

export function calculateLayerOffsets(
  layers: WallLayer[],
  exaggerateMultiplier: number = 1
): {
  layers: ComputedLayerOffset[];
  totalNominalThickness_m: number;
  totalRenderedThickness_m: number;
} {
  const mult = Math.max(1, exaggerateMultiplier);
  let currentOffset = 0;
  let totalNominal = 0;

  const result: ComputedLayerOffset[] = layers.map((l) => {
    const nominal = Math.max(0.001, l.thickness_m || 0);
    const rendered = nominal * mult;
    const outer = currentOffset;
    const inner = currentOffset + rendered;
    currentOffset = inner;
    totalNominal += nominal;

    return {
      layerId: l.id,
      materialId: l.materialId,
      nominalThickness_m: Number(nominal.toFixed(4)),
      renderedThickness_m: Number(rendered.toFixed(4)),
      outerOffset_m: Number(outer.toFixed(4)),
      innerOffset_m: Number(inner.toFixed(4)),
    };
  });

  return {
    layers: result,
    totalNominalThickness_m: Number(totalNominal.toFixed(4)),
    totalRenderedThickness_m: Number(currentOffset.toFixed(4)),
  };
}

/**
 * Opening placement and dimension derivation on the default (front) wall.
 * Default wall is the front face (+Z wall, facing viewer).
 * Sizing derived from areaEach_m2 assuming standard proportional rectangle (1:1.2 w:h).
 * Clamped if dimensions exceed available wall envelope, triggering visible warning.
 */
export interface PlacedOpening {
  id: string;
  type: ShelterOpening['type'];
  description?: string;
  nominalAreaEach_m2: number;
  count: number;
  derivedWidth_m: number;
  derivedHeight_m: number;
  clampedWidth_m: number;
  clampedHeight_m: number;
  isClamped: boolean;
  drawnAreaEach_m2: number;
  warningNotice?: string;
  positions: { x: number; y: number; z: number }[];
}

export function calculateOpeningPlacements(
  openings: ShelterOpening[],
  length_m: number,
  width_m: number,
  height_m: number
): {
  placedOpenings: PlacedOpening[];
  hasAnyClamping: boolean;
} {
  let hasAnyClamping = false;
  const frontZ = width_m / 2;
  const maxAvailableHeight = Math.max(0.5, height_m - 0.4); // 0.2m header and footer margin
  const maxAvailableWidth = Math.max(0.5, length_m - 0.4);

  // Total aperture count on front wall
  const totalItems = openings.reduce((sum, op) => sum + (op.count || 0), 0);
  let globalIndex = 0;

  const placedOpenings: PlacedOpening[] = openings.map((op, opIdx) => {
    const count = Math.max(1, op.count || 1);
    const area = Math.max(0.01, op.areaEach_m2 || 0.1);

    // Standard rectangular window ratio: w = sqrt(A / 1.2), h = 1.2 * w
    const derivedW = Math.sqrt(area / 1.2);
    const derivedH = 1.2 * derivedW;

    // Check clamping against wall boundaries
    const clampedH = Math.min(derivedH, maxAvailableHeight);
    // Allow spacing between openings along length
    const maxItemWidth = totalItems > 0 ? (maxAvailableWidth / totalItems) * 0.8 : maxAvailableWidth;
    const clampedW = Math.min(derivedW, maxItemWidth);

    const drawnArea = clampedW * clampedH;
    const isClamped = drawnArea < area * 0.95 || clampedW < derivedW * 0.95 || clampedH < derivedH * 0.95;

    if (isClamped) {
      hasAnyClamping = true;
    }

    const warningNotice = isClamped
      ? `drawn size differs from areaEach_m2 (drawn: ${clampedW.toFixed(2)}m × ${clampedH.toFixed(2)}m = ${drawnArea.toFixed(2)}m², specified: ${area.toFixed(2)}m²)`
      : undefined;

    // Distribute positions along front wall (X axis from -L/2 to +L/2)
    const positions: { x: number; y: number; z: number }[] = [];
    for (let c = 0; c < count; c++) {
      const stepFraction = totalItems > 1 ? (globalIndex + 0.5) / totalItems : 0.5;
      const x = -length_m / 2 + 0.2 + stepFraction * (length_m - 0.4);
      const y = Math.max(0.2, (height_m - clampedH) / 2);
      positions.push({
        x: Number(x.toFixed(3)),
        y: Number(y.toFixed(3)),
        z: Number((frontZ + 0.01).toFixed(3)), // slightly in front to avoid z-fighting
      });
      globalIndex++;
    }

    return {
      id: op.id || `op_${opIdx}`,
      type: op.type,
      description: op.description,
      nominalAreaEach_m2: area,
      count,
      derivedWidth_m: Number(derivedW.toFixed(3)),
      derivedHeight_m: Number(derivedH.toFixed(3)),
      clampedWidth_m: Number(clampedW.toFixed(3)),
      clampedHeight_m: Number(clampedH.toFixed(3)),
      isClamped,
      drawnAreaEach_m2: Number(drawnArea.toFixed(3)),
      warningNotice,
      positions,
    };
  });

  return {
    placedOpenings,
    hasAnyClamping,
  };
}
