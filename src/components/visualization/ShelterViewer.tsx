import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Play,
  Pause,
  RotateCcw,
  Layers,
  Thermometer,
  ArrowUpRight,
  Eye,
  EyeOff,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { ShelterConfig } from '../../types/shelter';
import type { simulateTemperatureOverTime } from '../../lib/thermalEngine';
import { calculateUValueMultiLayer } from '../../lib/thermalEngine';
import {
  DEFAULT_H_INTERIOR,
  DEFAULT_H_EXTERIOR,
  DEFAULT_TIME_STEP_SECONDS,
} from '../../lib/engineDefaults';
import {
  calculateShelterBounds,
  calculateCompassRotationRad,
  calculateLayerOffsets,
  calculateOpeningPlacements,
} from '../../lib/geometry3d';
import { getMaterialAppearance } from '../../lib/materialAppearance';

export type SimulationResult = ReturnType<typeof simulateTemperatureOverTime>;
export type SimulationStep = SimulationResult[number];

export interface ShelterViewerProps {
  config: ShelterConfig;
  simulation: SimulationResult;
  title?: string;
  compact?: boolean;
}

/**
 * Maps a normalized value in [0, 1] to the project palette:
 * Low: Violet (#5003C0) -> Mid: Yellow (#FFD51E) -> High: Pink-red (#FF467A)
 */
function getTemperatureColor(ratio: number): THREE.Color {
  const clamped = Math.max(0, Math.min(1, ratio));
  const cViolet = new THREE.Color(0x5003c0);
  const cYellow = new THREE.Color(0xffd51e);
  const cPinkRed = new THREE.Color(0xff467a);

  if (clamped < 0.5) {
    const t = clamped / 0.5;
    return cViolet.clone().lerp(cYellow, t);
  } else {
    const t = (clamped - 0.5) / 0.5;
    return cYellow.clone().lerp(cPinkRed, t);
  }
}

/**
 * Deep recursive disposal helper for Three.js objects (Mesh, Line, LineSegments, ArrowHelper, Group)
 */
function disposeHierarchy(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if ('geometry' in child && (child as { geometry?: THREE.BufferGeometry }).geometry) {
      (child as { geometry: THREE.BufferGeometry }).geometry.dispose();
    }
    if ('material' in child && (child as { material?: THREE.Material | THREE.Material[] }).material) {
      const mat = (child as { material: THREE.Material | THREE.Material[] }).material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => m.dispose());
      } else if (mat) {
        mat.dispose();
      }
    }
  });
}

function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

export const ShelterViewer: React.FC<ShelterViewerProps> = ({
  config,
  simulation,
  title,
  compact = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Three.js instances ref
  const threeRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    animFrameId: number | null;
    shelterGroup: THREE.Group;
    cutawayPlanes: THREE.Plane[];
    bounds: ReturnType<typeof calculateShelterBounds>;
  } | null>(null);

  // Playback & Scrubber State
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1); // 1x, 2x, 5x

  // Visualization Feature Toggles
  const [showTemperatureTint, setShowTemperatureTint] = useState<boolean>(true);
  const [showCutaway, setShowCutaway] = useState<boolean>(false);
  const [exaggerateThickness, setExaggerateThickness] = useState<boolean>(false);
  const [showHeatFlow, setShowHeatFlow] = useState<boolean>(true);
  const [showDesignPanel, setShowDesignPanel] = useState<boolean>(!compact);
  const [webglAvailable] = useState<boolean>(() => checkWebGLSupport());

  const stepCount = simulation.length;
  const currentStep: SimulationStep | undefined = simulation[currentStepIndex];

  // Derive hour label and ambient temperature from configuration and simulation step
  const { hourDisplay, ambientTemp } = useMemo(() => {
    if (!currentStep) return { hourDisplay: '00:00', ambientTemp: 0 };
    const h = Math.floor(currentStep.time / DEFAULT_TIME_STEP_SECONDS) % (config.ambientClimate.hourlyProfile.length || 24);
    const ambient = config.ambientClimate.hourlyProfile[h]?.temperature_C ?? 0;
    return {
      hourDisplay: `${String(h).padStart(2, '0')}:00`,
      ambientTemp: ambient,
    };
  }, [currentStep, config.ambientClimate.hourlyProfile]);

  // Temperature extrema across the entire simulation run
  const { minInsideTemp, maxInsideTemp, tempRangeIsZero } = useMemo(() => {
    if (!simulation || simulation.length === 0) {
      return { minInsideTemp: 0, maxInsideTemp: 0, tempRangeIsZero: true };
    }
    const temps = simulation.map((s) => s.tempC);
    const minT = Math.min(...temps);
    const maxT = Math.max(...temps);
    return {
      minInsideTemp: minT,
      maxInsideTemp: maxT,
      tempRangeIsZero: Math.abs(maxT - minT) < 1e-4,
    };
  }, [simulation]);

  // Maximum heat-flow across all three series (for common honest scaling)
  const commonMaxHeatFlow = useMemo(() => {
    if (!simulation || simulation.length === 0) return 1;
    let maxVal = 1e-6;
    for (const s of simulation) {
      maxVal = Math.max(maxVal, Math.abs(s.qLoss), Math.abs(s.qInfiltration), Math.abs(s.qRadiative));
    }
    return maxVal;
  }, [simulation]);

  // Geometry calculations
  const bounds = useMemo(() => calculateShelterBounds(config.geometry), [config.geometry]);
  const thicknessMultiplier = exaggerateThickness ? 5 : 1;
  const wallLayerOffsets = useMemo(
    () => calculateLayerOffsets(config.wallLayers, thicknessMultiplier),
    [config.wallLayers, thicknessMultiplier]
  );
  const roofLayerOffsets = useMemo(
    () => calculateLayerOffsets(config.roofLayers, thicknessMultiplier),
    [config.roofLayers, thicknessMultiplier]
  );
  const openingPlacements = useMemo(
    () =>
      calculateOpeningPlacements(
        config.geometry.openings,
        config.geometry.length_m,
        config.geometry.width_m,
        config.geometry.height_m
      ),
    [config.geometry]
  );

  // U-Values computed via exact engine functions
  const { wallUValue, roofUValue } = useMemo(() => {
    let uWall = 0;
    let uRoof = 0;
    if (config.wallLayers.length > 0) {
      try {
        uWall = calculateUValueMultiLayer(
          DEFAULT_H_INTERIOR,
          config.wallLayers,
          config.materialsLibrary,
          DEFAULT_H_EXTERIOR
        );
      } catch {
        uWall = 0;
      }
    }
    if (config.roofLayers.length > 0) {
      try {
        uRoof = calculateUValueMultiLayer(
          DEFAULT_H_INTERIOR,
          config.roofLayers,
          config.materialsLibrary,
          DEFAULT_H_EXTERIOR
        );
      } catch {
        uRoof = 0;
      }
    }
    return { wallUValue: uWall, roofUValue: uRoof };
  }, [config.wallLayers, config.roofLayers, config.materialsLibrary]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying || stepCount === 0) return;
    const intervalMs = Math.max(150, 1000 / playSpeed);
    const timer = setInterval(() => {
      setCurrentStepIndex((prev) => (prev + 1) % stepCount);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isPlaying, playSpeed, stepCount]);

  // Setup Three.js Scene and Renderer
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas || !webglAvailable) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.shadowMap.enabled = false;
      renderer.localClippingEnabled = true; // For Cutaway / Section view
    } catch {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0620); // Dark violet page neutral #0D0620

    // Perspective Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );

    // Initial camera positioning based on bounding radius
    const dist = bounds.boundingRadius * 2.8;
    camera.position.set(dist * 0.8, dist * 0.65, dist * 0.9);

    // OrbitControls
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(bounds.centerX, bounds.centerY, bounds.centerZ);
    controls.minDistance = bounds.boundingRadius * 0.5;
    controls.maxDistance = bounds.boundingRadius * 8.0;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.update();

    // Lighting tuned for the dark violet palette
    const ambientLight = new THREE.AmbientLight(0xf4efff, 0.75);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight1.position.set(20, 30, 20);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xb9aedb, 0.45);
    dirLight2.position.set(-20, 15, -20);
    scene.add(dirLight2);

    // Ground Plane & Subtle Violet Grid
    const groundSize = Math.max(25, bounds.boundingRadius * 5);
    const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x160b30, // #160B30 dark card neutral
      roughness: 0.95,
      metalness: 0.0,
      depthWrite: true,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    scene.add(ground);

    const grid = new THREE.GridHelper(groundSize, 25, 0x5003c0, 0x1f1240);
    grid.position.y = 0;
    scene.add(grid);

    // 3D Compass & North Indicator on Ground Plane
    const compassGroup = new THREE.Group();
    compassGroup.position.set(-bounds.length / 2 - 2, 0.02, bounds.width / 2 + 2);

    // Compass Ring
    const ringGeo = new THREE.RingGeometry(0.7, 0.8, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x5003c0, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    compassGroup.add(ring);

    // North Pointer Arrow (#FF467A Pink-Red)
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 0.75);
    arrowShape.lineTo(0.18, 0.1);
    arrowShape.lineTo(-0.18, 0.1);
    arrowShape.closePath();
    const arrowGeo = new THREE.ShapeGeometry(arrowShape);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xff467a, side: THREE.DoubleSide });
    const northPointer = new THREE.Mesh(arrowGeo, arrowMat);
    northPointer.rotation.x = -Math.PI / 2;
    compassGroup.add(northPointer);

    // Rotate compass ring to match orientation_deg
    compassGroup.rotation.y = calculateCompassRotationRad(config.geometry.orientation_deg);
    scene.add(compassGroup);

    // Cutaway Clipping Planes
    const cutPlaneX = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
    const cutPlaneZ = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
    const cutawayPlanes = [cutPlaneX, cutPlaneZ];

    // Root Group for Shelter Meshes
    const shelterGroup = new THREE.Group();
    scene.add(shelterGroup);

    // Animation Loop
    let animFrameId: number | null = null;
    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container || !renderer) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(container);

    threeRef.current = {
      scene,
      camera,
      renderer,
      controls,
      animFrameId,
      shelterGroup,
      cutawayPlanes,
      bounds,
    };

    return () => {
      resizeObserver.disconnect();
      if (animFrameId !== null) cancelAnimationFrame(animFrameId);
      controls.dispose();

      // Completely dispose scene hierarchy to prevent memory leaks
      disposeHierarchy(scene);
      renderer.dispose();
      threeRef.current = null;
    };
  }, [config.geometry, bounds, webglAvailable]);

  // Re-build 3D Shelter Meshes whenever geometry, layers, cutaway, tint, or time step changes
  useEffect(() => {
    if (!threeRef.current) return;
    const { shelterGroup, cutawayPlanes } = threeRef.current;

    // Properly dispose all child geometries/materials to prevent GPU/RAM memory leaks
    while (shelterGroup.children.length > 0) {
      const child = shelterGroup.children[0];
      shelterGroup.remove(child);
      disposeHierarchy(child);
    }

    const { length_m, width_m, height_m } = config.geometry;
    const activeCutawayPlanes = showCutaway ? cutawayPlanes : [];

    // Calculate temperature tint color
    let tintColor: THREE.Color | null = null;
    if (showTemperatureTint && currentStep) {
      const ratio = tempRangeIsZero
        ? 0.5
        : (currentStep.tempC - minInsideTemp) / (maxInsideTemp - minInsideTemp);
      tintColor = getTemperatureColor(ratio);
    }

    // 1. Render Composite Wall Layers (extending inward from exterior outline)
    wallLayerOffsets.layers.forEach((layer) => {
      const matAppearance = getMaterialAppearance(layer.materialId);
      const layerColor = tintColor ?? new THREE.Color(matAppearance.color);

      const wallMaterial = new THREE.MeshStandardMaterial({
        color: layerColor,
        roughness: matAppearance.roughness,
        metalness: matAppearance.metalness,
        side: THREE.DoubleSide,
        clippingPlanes: activeCutawayPlanes,
        clipShadows: false,
      });

      const shellL = Math.max(0.1, length_m - 2 * layer.outerOffset_m);
      const shellW = Math.max(0.1, width_m - 2 * layer.outerOffset_m);
      const shellH = Math.max(0.1, height_m - layer.outerOffset_m);

      const wallGeo = new THREE.BoxGeometry(shellL, shellH, shellW);
      const wallMesh = new THREE.Mesh(wallGeo, wallMaterial);
      wallMesh.position.set(0, shellH / 2, 0);
      shelterGroup.add(wallMesh);
    });

    // 2. Render Composite Roof Layers
    roofLayerOffsets.layers.forEach((layer) => {
      const matAppearance = getMaterialAppearance(layer.materialId);
      const layerColor = tintColor ?? new THREE.Color(matAppearance.color);

      const roofMaterial = new THREE.MeshStandardMaterial({
        color: layerColor,
        roughness: matAppearance.roughness,
        metalness: matAppearance.metalness,
        side: THREE.DoubleSide,
        clippingPlanes: activeCutawayPlanes,
      });

      const roofL = length_m;
      const roofW = width_m;
      const roofH = layer.renderedThickness_m;

      const roofGeo = new THREE.BoxGeometry(roofL, roofH, roofW);
      const roofMesh = new THREE.Mesh(roofGeo, roofMaterial);
      roofMesh.position.set(0, height_m - layer.outerOffset_m - roofH / 2, 0);
      shelterGroup.add(roofMesh);
    });

    // 3. Render Openings
    openingPlacements.placedOpenings.forEach((op) => {
      const opAppearance = getMaterialAppearance(op.type === 'plain_glass' ? 'glass' : undefined);
      const isGlass = op.type === 'plain_glass';
      const isOpen = op.type === 'open_gap';

      const opMaterial = new THREE.MeshStandardMaterial({
        color: isOpen ? 0x0d0620 : opAppearance.color,
        roughness: opAppearance.roughness,
        metalness: opAppearance.metalness,
        transparent: isGlass,
        opacity: isGlass ? 0.45 : 1.0,
        side: THREE.DoubleSide,
        clippingPlanes: activeCutawayPlanes,
      });

      op.positions.forEach((pos) => {
        const opGeo = new THREE.PlaneGeometry(op.clampedWidth_m, op.clampedHeight_m);
        const opMesh = new THREE.Mesh(opGeo, opMaterial);
        opMesh.position.set(pos.x, pos.y + op.clampedHeight_m / 2, pos.z);
        shelterGroup.add(opMesh);

        // Frame line for clarity
        const edges = new THREE.EdgesGeometry(opGeo);
        const lineMat = new THREE.LineBasicMaterial({
          color: 0xffd51e, // Yellow frame accent
          clippingPlanes: activeCutawayPlanes,
        });
        const wireframe = new THREE.LineSegments(edges, lineMat);
        wireframe.position.copy(opMesh.position);
        shelterGroup.add(wireframe);
      });
    });

    // 4. Render 3D Heat-Flow Vectors (Palette Colors)
    if (showHeatFlow && currentStep) {
      const baseMaxArrowLen = Math.max(1.5, bounds.boundingRadius * 0.7);

      const flows = [
        {
          name: 'Conduction',
          value: currentStep.qLoss,
          color: 0xff467a, // Pink-red for envelope heat loss
          anchorX: bounds.length / 2 + 1.2,
          anchorY: bounds.height / 2,
          anchorZ: 0,
          dir: new THREE.Vector3(1, 0, 0),
        },
        {
          name: 'Infiltration',
          value: currentStep.qInfiltration,
          color: 0xffd51e, // Yellow for infiltration flow
          anchorX: 0,
          anchorY: 0.5,
          anchorZ: bounds.width / 2 + 1.2,
          dir: new THREE.Vector3(0, 0, 1),
        },
        {
          name: 'Radiative',
          value: currentStep.qRadiative,
          color: 0xab03a9, // Magenta for nocturnal sky radiation
          anchorX: 0,
          anchorY: bounds.height + 0.6,
          anchorZ: 0,
          dir: new THREE.Vector3(0, 1, 0),
        },
      ];

      flows.forEach((f) => {
        const isGain = f.value < 0;
        const absVal = Math.abs(f.value);
        const length = (absVal / commonMaxHeatFlow) * baseMaxArrowLen;
        if (length < 0.05) return;

        const direction = isGain ? f.dir.clone().negate() : f.dir.clone();
        const origin = new THREE.Vector3(f.anchorX, f.anchorY, f.anchorZ);

        const arrowHelper = new THREE.ArrowHelper(
          direction.normalize(),
          origin,
          length,
          f.color,
          Math.min(0.4, length * 0.35),
          Math.min(0.25, length * 0.25)
        );
        shelterGroup.add(arrowHelper);
      });
    }
  }, [
    config.geometry,
    wallLayerOffsets,
    roofLayerOffsets,
    openingPlacements,
    showCutaway,
    showTemperatureTint,
    currentStep,
    minInsideTemp,
    maxInsideTemp,
    tempRangeIsZero,
    showHeatFlow,
    commonMaxHeatFlow,
    bounds,
  ]);

  // Camera preset handlers
  const handleResetCamera = useCallback(() => {
    if (!threeRef.current) return;
    const { camera, controls } = threeRef.current;
    const dist = bounds.boundingRadius * 2.8;
    camera.position.set(dist * 0.8, dist * 0.65, dist * 0.9);
    controls.target.set(bounds.centerX, bounds.centerY, bounds.centerZ);
    controls.update();
  }, [bounds]);

  const handleSetPresetView = useCallback(
    (preset: 'front' | 'top' | 'iso') => {
      if (!threeRef.current) return;
      const { camera, controls } = threeRef.current;
      const dist = bounds.boundingRadius * 2.8;

      if (preset === 'front') {
        camera.position.set(0, bounds.centerY, dist);
      } else if (preset === 'top') {
        camera.position.set(0, dist * 1.5, 0.001);
      } else if (preset === 'iso') {
        camera.position.set(dist * 0.8, dist * 0.8, dist * 0.8);
      }
      controls.target.set(bounds.centerX, bounds.centerY, bounds.centerZ);
      controls.update();
    },
    [bounds]
  );

  return (
    <div className="space-y-4">
      {title && (
        <h3 className="text-sm font-bold text-palette-text-primary">{title}</h3>
      )}
      {/* 3D View Container */}
      <div className="relative w-full rounded-2xl bg-palette-page border border-palette-border overflow-hidden shadow-2xl">
        {/* Canvas Stage */}
        <div ref={containerRef} className="relative w-full h-[480px] sm:h-[560px]">
          <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

          {/* WebGL Fallback Message */}
          {!webglAvailable && (
            <div className="absolute inset-0 flex items-center justify-center p-6 bg-palette-page/90 text-center">
              <div className="max-w-md p-6 rounded-xl bg-palette-card border border-palette-pink-red text-palette-pink-red space-y-2">
                <AlertTriangle className="w-8 h-8 text-palette-pink-red mx-auto" />
                <h4 className="font-bold text-sm">WebGL Acceleration Unavailable</h4>
                <p className="text-xs text-palette-text-secondary">
                  Your browser environment does not support WebGL 3D rendering. Please enable hardware acceleration in your browser settings to view the parametric 3D model.
                </p>
              </div>
            </div>
          )}

          {/* Top-Left Status Overlay */}
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 max-w-sm">
            <div className="px-3 py-2 rounded-xl bg-palette-card/90 backdrop-blur-md border border-palette-border text-xs shadow-lg space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-palette-text-primary flex items-center gap-1.5">
                  <Thermometer className="w-3.5 h-3.5 text-palette-pink-red" />
                  <span>Diurnal State Readout</span>
                </span>
                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-palette-yellow text-palette-page font-bold">
                  Step {currentStepIndex + 1}/{stepCount}
                </span>
              </div>
              <p className="font-mono text-xs text-palette-text-primary">
                Hour {hourDisplay} &mdash; Inside{' '}
                <strong className="text-palette-pink-red">
                  {currentStep ? currentStep.tempC.toFixed(1) : '--'}°C
                </strong>{' '}
                &mdash; Ambient{' '}
                <strong className="text-palette-yellow">{ambientTemp.toFixed(1)}°C</strong>
              </p>
            </div>

            {/* Warning if any opening had to be clamped */}
            {openingPlacements.hasAnyClamping && (
              <div className="px-3 py-1.5 rounded-lg bg-palette-raised/90 border border-palette-yellow text-[11px] text-palette-yellow flex items-center gap-1.5 shadow">
                <AlertTriangle className="w-3.5 h-3.5 text-palette-yellow shrink-0" />
                <span>drawn size differs from areaEach_m2</span>
              </div>
            )}
          </div>

          {/* Top-Right Camera Controls */}
          <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-palette-card/90 backdrop-blur-md border border-palette-border p-1.5 rounded-xl shadow-lg text-xs">
            <button
              type="button"
              onClick={handleResetCamera}
              className="px-2.5 py-1 rounded-lg bg-palette-raised hover:bg-palette-violet text-palette-text-primary text-[11px] font-medium transition-colors flex items-center gap-1"
              title="Reset View"
            >
              <RotateCcw className="w-3 h-3 text-palette-yellow" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetPresetView('front')}
              className="px-2 py-1 rounded-lg bg-palette-raised hover:bg-palette-violet text-palette-text-secondary hover:text-palette-text-primary text-[11px] font-medium transition-colors"
            >
              Front
            </button>
            <button
              type="button"
              onClick={() => handleSetPresetView('top')}
              className="px-2 py-1 rounded-lg bg-palette-raised hover:bg-palette-violet text-palette-text-secondary hover:text-palette-text-primary text-[11px] font-medium transition-colors"
            >
              Top
            </button>
            <button
              type="button"
              onClick={() => handleSetPresetView('iso')}
              className="px-2 py-1 rounded-lg bg-palette-raised hover:bg-palette-violet text-palette-text-secondary hover:text-palette-text-primary text-[11px] font-medium transition-colors"
            >
              Iso
            </button>
          </div>

          {/* Bottom Temperature Tint Color Legend */}
          {showTemperatureTint && (
            <div className="absolute bottom-28 left-4 z-10 px-3 py-2 rounded-xl bg-palette-card/90 backdrop-blur-md border border-palette-border text-[11px] text-palette-text-secondary shadow-lg space-y-1">
              <div className="flex justify-between items-center text-[10px] font-mono text-palette-text-muted">
                <span>Min {minInsideTemp.toFixed(1)}°C</span>
                <span className="font-semibold text-palette-text-primary">Temperature Tint</span>
                <span>Max {maxInsideTemp.toFixed(1)}°C</span>
              </div>
              <div className="w-48 h-2.5 rounded-full bg-gradient-to-r from-[#5003C0] via-[#FFD51E] to-[#FF467A] border border-palette-border" />
              <p className="text-[10px] text-palette-text-muted leading-tight">
                Lumped model: one inside temperature for the whole shelter.
              </p>
            </div>
          )}

          {/* Bottom-Right 3D Toggles Toolbar */}
          <div className="absolute bottom-16 right-4 z-10 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowTemperatureTint(!showTemperatureTint)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors backdrop-blur-md shadow-lg flex items-center gap-1.5 ${
                showTemperatureTint
                  ? 'bg-palette-violet text-palette-text-primary border-palette-magenta'
                  : 'bg-palette-card/90 text-palette-text-secondary border-palette-border hover:bg-palette-raised'
              }`}
            >
              {showTemperatureTint ? <Eye className="w-3.5 h-3.5 text-palette-yellow" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>Temperature Tint</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCutaway(!showCutaway)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors backdrop-blur-md shadow-lg flex items-center gap-1.5 ${
                showCutaway
                  ? 'bg-palette-violet text-palette-text-primary border-palette-magenta'
                  : 'bg-palette-card/90 text-palette-text-secondary border-palette-border hover:bg-palette-raised'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-palette-yellow" />
              <span>Cutaway / Section</span>
            </button>

            {showCutaway && (
              <button
                type="button"
                onClick={() => setExaggerateThickness(!exaggerateThickness)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors backdrop-blur-md shadow-lg flex items-center gap-1.5 ${
                  exaggerateThickness
                    ? 'bg-palette-magenta text-palette-text-primary border-palette-magenta'
                    : 'bg-palette-card/90 text-palette-text-secondary border-palette-border hover:bg-palette-raised'
                }`}
              >
                <span>5× Exaggerated Thickness</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowHeatFlow(!showHeatFlow)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors backdrop-blur-md shadow-lg flex items-center gap-1.5 ${
                showHeatFlow
                  ? 'bg-palette-violet text-palette-text-primary border-palette-magenta'
                  : 'bg-palette-card/90 text-palette-text-secondary border-palette-border hover:bg-palette-raised'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-palette-pink-red" />
              <span>Heat Flow Overlay</span>
            </button>
          </div>

          {/* Bottom Playback & Scrubber Controls */}
          <div className="absolute bottom-0 inset-x-0 bg-palette-card/95 backdrop-blur-md border-t border-palette-border px-4 py-2.5 flex items-center gap-4 z-20">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 rounded-lg bg-palette-yellow hover:bg-palette-yellow-hover text-palette-page font-bold transition-colors shadow"
              title={isPlaying ? 'Pause Simulation' : 'Play Simulation'}
            >
              {isPlaying ? <Pause className="w-4 h-4 text-palette-page" /> : <Play className="w-4 h-4 ml-0.5 text-palette-page" />}
            </button>

            {/* Slider */}
            <div className="flex-1 flex items-center gap-3">
              <span className="text-[11px] font-mono text-palette-text-secondary min-w-[36px]">
                {hourDisplay}
              </span>
              <input
                type="range"
                min="0"
                max={Math.max(0, stepCount - 1)}
                value={currentStepIndex}
                onChange={(e) => {
                  setCurrentStepIndex(parseInt(e.target.value, 10));
                  setIsPlaying(false);
                }}
                className="flex-1 h-2 bg-palette-raised rounded-lg appearance-none cursor-pointer accent-[#FFD51E]"
              />
              <span className="text-[11px] font-mono text-palette-text-secondary min-w-[40px]">
                {stepCount > 0 ? `${stepCount}h` : '0h'}
              </span>
            </div>

            {/* Speed Control */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-[10px] text-palette-text-muted uppercase">Speed:</span>
              {[1, 2, 5].map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => setPlaySpeed(speed)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                    playSpeed === speed
                      ? 'bg-palette-violet text-palette-yellow border border-palette-magenta font-bold'
                      : 'text-palette-text-secondary hover:text-palette-text-primary'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Heat Flow Rate Breakdown */}
      {showHeatFlow && currentStep && (
        <div className="p-4 rounded-xl bg-palette-card border border-palette-border space-y-2">
          <div className="flex items-center justify-between text-xs pb-1 border-b border-palette-border">
            <span className="font-semibold text-palette-text-primary flex items-center gap-1.5">
              <ArrowUpRight className="w-3.5 h-3.5 text-palette-pink-red" />
              <span>Instantaneous Heat Flow Rates at Hour {hourDisplay}</span>
            </span>
            <span className="text-[10px] text-palette-text-muted font-mono">
              Common scale max: {Math.round(commonMaxHeatFlow)} W
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-palette-raised border border-palette-pink-red/30">
              <span className="text-[10px] text-palette-pink-red uppercase block font-sans font-semibold">
                Envelope Conduction (Q_loss)
              </span>
              <span className="text-sm font-bold text-palette-text-primary">
                {Math.round(currentStep.qLoss)} W {currentStep.qLoss < 0 ? '(gain)' : ''}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-palette-raised border border-palette-yellow/30">
              <span className="text-[10px] text-palette-yellow uppercase block font-sans font-semibold">
                Infiltration Loss (Q_infil)
              </span>
              <span className="text-sm font-bold text-palette-text-primary">
                {Math.round(currentStep.qInfiltration)} W {currentStep.qInfiltration < 0 ? '(gain)' : ''}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-palette-raised border border-palette-magenta/30">
              <span className="text-[10px] text-palette-magenta uppercase block font-sans font-semibold">
                Nocturnal Sky Radiation (Q_rad)
              </span>
              <span className="text-sm font-bold text-palette-text-primary">
                {Math.round(currentStep.qRadiative)} W {currentStep.qRadiative < 0 ? '(gain)' : ''}
              </span>
            </div>
          </div>
          <p className="text-[10px] text-palette-text-muted">
            Heat flow arrows represent total shelter-level rates from engine output; per-surface breakdowns are unmodeled.
          </p>
        </div>
      )}

      {/* Layer Callout & Design Info Panel */}
      <div className="p-4 rounded-xl bg-palette-card border border-palette-border space-y-3">
        <button
          type="button"
          onClick={() => setShowDesignPanel(!showDesignPanel)}
          className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-palette-text-secondary hover:text-palette-text-primary"
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-palette-yellow" />
            <span>Design & Layer Assembly Specifications</span>
          </div>
          {showDesignPanel ? <ChevronUp className="w-4 h-4 text-palette-yellow" /> : <ChevronDown className="w-4 h-4 text-palette-yellow" />}
        </button>

        {showDesignPanel && (
          <div className="space-y-4 pt-2 border-t border-palette-border text-xs">
            <p className="text-[11px] text-palette-text-muted italic">
              Dimensions (L: {Number(config.geometry.length_m.toFixed(2))}m &times; W: {Number(config.geometry.width_m.toFixed(2))}m &times; H: {Number(config.geometry.height_m.toFixed(2))}m) define exterior envelope outline; layer thickness extends inward.
            </p>

            {/* Performance U-Values */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-palette-raised border border-palette-border">
                <span className="text-[10px] text-palette-text-secondary uppercase block font-semibold">Wall Assembly U-Value</span>
                <span className="text-sm font-bold font-mono text-palette-yellow">
                  {wallUValue.toFixed(3)} W/m²·K
                </span>
                <span className="text-[10px] text-palette-text-muted block mt-0.5 font-mono">
                  {config.wallLayers.length} composite layer{config.wallLayers.length === 1 ? '' : 's'} (
                  {(wallLayerOffsets.totalNominalThickness_m * 1000).toFixed(0)} mm total)
                </span>
              </div>
              <div className="p-3 rounded-lg bg-palette-raised border border-palette-border">
                <span className="text-[10px] text-palette-text-secondary uppercase block font-semibold">Roof Deck U-Value</span>
                <span className="text-sm font-bold font-mono text-palette-yellow">
                  {roofUValue.toFixed(3)} W/m²·K
                </span>
                <span className="text-[10px] text-palette-text-muted block mt-0.5 font-mono">
                  {config.roofLayers.length} composite layer{config.roofLayers.length === 1 ? '' : 's'} (
                  {(roofLayerOffsets.totalNominalThickness_m * 1000).toFixed(0)} mm total)
                </span>
              </div>
            </div>

            {/* Layer Stack Table */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-palette-text-secondary block">
                Layer order as listed
              </span>
              <div className="overflow-x-auto rounded-lg border border-palette-border">
                <table className="w-full text-left text-[11px] font-mono">
                  <thead className="bg-palette-raised text-palette-text-secondary uppercase text-[10px] font-sans">
                    <tr>
                      <th className="px-3 py-1.5">Assembly</th>
                      <th className="px-3 py-1.5">Layer</th>
                      <th className="px-3 py-1.5">Material</th>
                      <th className="px-3 py-1.5">Thickness</th>
                      <th className="px-3 py-1.5">Conductivity (k)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-palette-border text-palette-text-primary">
                    {config.wallLayers.map((l, i) => {
                      const mat = config.materialsLibrary.find((m) => m.id === l.materialId);
                      const app = getMaterialAppearance(l.materialId);
                      return (
                        <tr key={l.id} className="hover:bg-palette-raised/60">
                          <td className="px-3 py-1 text-palette-text-secondary font-sans">Wall</td>
                          <td className="px-3 py-1">Layer {i + 1}</td>
                          <td className="px-3 py-1 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: app.color }} />
                            <span>{mat?.name ?? l.materialId}</span>
                            {app.legendNote && <span className="text-[9px] text-palette-text-muted italic">({app.legendNote})</span>}
                          </td>
                          <td className="px-3 py-1">{(l.thickness_m * 1000).toFixed(0)} mm ({l.thickness_m.toFixed(3)} m)</td>
                          <td className="px-3 py-1">{mat ? `${mat.conductivity_k} W/m·K` : '--'}</td>
                        </tr>
                      );
                    })}
                    {config.roofLayers.map((l, i) => {
                      const mat = config.materialsLibrary.find((m) => m.id === l.materialId);
                      const app = getMaterialAppearance(l.materialId);
                      return (
                        <tr key={l.id} className="hover:bg-palette-raised/60">
                          <td className="px-3 py-1 text-palette-text-secondary font-sans">Roof</td>
                          <td className="px-3 py-1">Layer {i + 1}</td>
                          <td className="px-3 py-1 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: app.color }} />
                            <span>{mat?.name ?? l.materialId}</span>
                            {app.legendNote && <span className="text-[9px] text-palette-text-muted italic">({app.legendNote})</span>}
                          </td>
                          <td className="px-3 py-1">{(l.thickness_m * 1000).toFixed(0)} mm ({l.thickness_m.toFixed(3)} m)</td>
                          <td className="px-3 py-1">{mat ? `${mat.conductivity_k} W/m·K` : '--'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
