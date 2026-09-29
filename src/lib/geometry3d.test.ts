import assert from 'node:assert/strict';
import {
  calculateShelterBounds,
  calculateCompassRotationRad,
  getHeadingVector,
  calculateLayerOffsets,
  calculateOpeningPlacements,
} from './geometry3d.ts';
import type { ShelterGeometry, ShelterOpening, WallLayer } from '../types/shelter';

console.log('--- TerraShelter 3D Geometry Unit Tests (Hand-Verifiable Arithmetic) ---');

// 1. Shelter bounds
{
  const geom: ShelterGeometry = {
    shape: 'rectangular_box',
    length_m: 4,
    width_m: 3,
    height_m: 2,
    orientation_deg: 0,
    openings: [],
  };
  const bounds = calculateShelterBounds(geom);
  assert.equal(bounds.minX, -2);
  assert.equal(bounds.maxX, 2);
  assert.equal(bounds.minY, 0);
  assert.equal(bounds.maxY, 2);
  assert.equal(bounds.minZ, -1.5);
  assert.equal(bounds.maxZ, 1.5);
  assert.equal(bounds.centerX, 0);
  assert.equal(bounds.centerY, 1);
  assert.equal(bounds.centerZ, 0);
  // diagonal = sqrt(2^2 + 1^2 + 1.5^2) = sqrt(4 + 1 + 2.25) = sqrt(7.25) ≈ 2.69258
  assert.ok(Math.abs(bounds.boundingRadius - Math.sqrt(7.25)) < 1e-6);
  console.log('✓ calculateShelterBounds: exact hand-checkable box coordinates');
}

// 2. Compass azimuth rotation and heading vector (Amendment I)
{
  // 0 deg (North): rad = 0, vector = (0, -1)
  const rad0 = calculateCompassRotationRad(0);
  assert.equal(rad0, 0);
  const head0 = getHeadingVector(0);
  assert.equal(head0.x, 0);
  assert.equal(head0.z, -1);

  // 90 deg (East): rad = -PI/2, vector = (1, 0)
  const rad90 = calculateCompassRotationRad(90);
  assert.ok(Math.abs(rad90 - -Math.PI / 2) < 1e-6);
  const head90 = getHeadingVector(90);
  assert.equal(head90.x, 1);
  assert.equal(head90.z, 0);

  // 180 deg (South): rad = -PI, vector = (0, 1)
  const rad180 = calculateCompassRotationRad(180);
  assert.ok(Math.abs(rad180 - -Math.PI) < 1e-6);
  const head180 = getHeadingVector(180);
  assert.equal(head180.x, 0);
  assert.equal(head180.z, 1);

  // 270 deg (West): rad = -3PI/2, vector = (-1, 0)
  const head270 = getHeadingVector(270);
  assert.equal(head270.x, -1);
  assert.equal(head270.z, 0);

  console.log('✓ calculateCompassRotation & getHeadingVector: exact azimuth vectors (0°=N, 90°=E, 180°=S, 270°=W)');
}

// 3. Layer offsets
{
  const layers: WallLayer[] = [
    { id: 'l1', materialId: 'm1', thickness_m: 0.1 },
    { id: 'l2', materialId: 'm2', thickness_m: 0.2 },
    { id: 'l3', materialId: 'm3', thickness_m: 0.05 },
  ];

  // True scale (1x)
  const res1 = calculateLayerOffsets(layers, 1);
  assert.equal(res1.layers.length, 3);
  assert.equal(res1.totalNominalThickness_m, 0.35);
  assert.equal(res1.totalRenderedThickness_m, 0.35);
  assert.equal(res1.layers[0].outerOffset_m, 0);
  assert.equal(res1.layers[0].innerOffset_m, 0.1);
  assert.equal(res1.layers[1].outerOffset_m, 0.1);
  assert.equal(res1.layers[1].innerOffset_m, 0.3);
  assert.equal(res1.layers[2].outerOffset_m, 0.3);
  assert.equal(res1.layers[2].innerOffset_m, 0.35);

  // 5x exaggerated thickness
  const res5 = calculateLayerOffsets(layers, 5);
  assert.equal(res5.totalNominalThickness_m, 0.35);
  assert.equal(res5.totalRenderedThickness_m, 1.75); // 0.35 * 5
  assert.equal(res5.layers[0].renderedThickness_m, 0.5);
  assert.equal(res5.layers[1].renderedThickness_m, 1.0);
  assert.equal(res5.layers[2].renderedThickness_m, 0.25);

  console.log('✓ calculateLayerOffsets: nominal and exaggerated layer stacking');
}

// 4. Opening placements and clamping detection (Amendment D)
{
  // Normal fitting opening: area 1.2 m² on 4m × 3m × 2.5m wall
  // derived w = sqrt(1.2 / 1.2) = 1.0 m, h = 1.2 * 1 = 1.2 m
  const openings: ShelterOpening[] = [
    { id: 'op1', count: 1, areaEach_m2: 1.2, type: 'plain_glass' },
  ];
  const fitRes = calculateOpeningPlacements(openings, 4, 3, 2.5);
  assert.equal(fitRes.hasAnyClamping, false);
  assert.equal(fitRes.placedOpenings[0].derivedWidth_m, 1.0);
  assert.equal(fitRes.placedOpenings[0].derivedHeight_m, 1.2);
  assert.equal(fitRes.placedOpenings[0].isClamped, false);
  assert.equal(fitRes.placedOpenings[0].warningNotice, undefined);

  // Massive opening that exceeds wall height: area 12 m² on 4m × 3m × 2m wall
  // derived w = sqrt(10) ≈ 3.16m, h = 1.2 * 3.16 ≈ 3.8m > max available height (1.6m)
  const oversizedOpenings: ShelterOpening[] = [
    { id: 'op_big', count: 1, areaEach_m2: 12.0, type: 'open_gap' },
  ];
  const clampRes = calculateOpeningPlacements(oversizedOpenings, 4, 3, 2.0);
  assert.equal(clampRes.hasAnyClamping, true);
  assert.equal(clampRes.placedOpenings[0].isClamped, true);
  assert.ok(clampRes.placedOpenings[0].warningNotice?.includes('drawn size differs from areaEach_m2'));

  console.log('✓ calculateOpeningPlacements: standard sizing and clamping detection with warnings');
}

console.log('\nAll 3D geometry helper tests passed successfully!');
