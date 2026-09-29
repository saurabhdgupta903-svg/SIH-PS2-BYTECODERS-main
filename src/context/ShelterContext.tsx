import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type {
  ShelterConfig,
  Material,
  WallLayer,
  ShelterOpening,
  ShelterGeometry,
  AmbientDataPoint,
} from '../types/shelter';
import { DEFAULT_MATERIALS } from '../data/defaultMaterials';
import { REGION_PRESETS } from '../data/regionPresets';
import { validateShelterConfig, type ValidationIssue } from '../utils/validation';

export type AppMode = 'quick' | 'advanced';
export type AppTab = 'inputs' | 'results' | 'compare' | '3d' | 'recommender' | 'sensitivity' | 'report';

interface ShelterContextType {
  config: ShelterConfig;
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  isReviewOpen: boolean;
  setIsReviewOpen: (open: boolean) => void;
  validationIssues: ValidationIssue[];

  // Quick Mode Actions
  loadPreset: (presetId: string) => void;
  setQuickMaterial: (materialId: string) => void;

  // Geometry Actions
  updateGeometry: (updates: Partial<ShelterGeometry>) => void;
  addOpening: (opening: Omit<ShelterOpening, 'id'>) => void;
  updateOpening: (id: string, updates: Partial<ShelterOpening>) => void;
  removeOpening: (id: string) => void;

  // Climate Actions
  updateClimateMeta: (key: 'regionName' | 'latitude' | 'longitude' | 'dateSeasonLabel', value: string | number) => void;
  updateHourlyPoint: (hour: number, field: 'temperature_C' | 'irradiance_wm2', value: number) => void;
  setHourlyProfile: (profile: AmbientDataPoint[]) => void;

  // Material Library Actions
  updateMaterial: (id: string, updates: Partial<Material>) => void;
  addCustomMaterial: (material: Omit<Material, 'id' | 'isDefaultReference' | 'verificationNotice'>) => void;

  // Composite Layers Actions
  setWallLayers: (layers: WallLayer[]) => void;
  addWallLayer: (materialId: string, thickness_m: number) => void;
  updateWallLayer: (id: string, updates: Partial<WallLayer>) => void;
  removeWallLayer: (id: string) => void;

  setRoofLayers: (layers: WallLayer[]) => void;
  addRoofLayer: (materialId: string, thickness_m: number) => void;
  updateRoofLayer: (id: string, updates: Partial<WallLayer>) => void;
  removeRoofLayer: (id: string) => void;

  resetToInitialPreset: () => void;
}

const ShelterContext = createContext<ShelterContextType | null>(null);

/**
 * Generates an initial configuration seeded from the first sample preset.
 * This guarantees the application opens in a fully-populated, ready-to-test state.
 */
function buildInitialConfig(): ShelterConfig {
  const initialPreset = REGION_PRESETS[0]; // Cold high-altitude desert (Ladakh-type demo)
  return {
    ambientClimate: { ...initialPreset.ambientClimate },
    materialsLibrary: DEFAULT_MATERIALS.map((m) => ({ ...m })),
    wallLayers: [
      {
        id: 'wall_layer_default',
        materialId: initialPreset.defaultSingleMaterialId,
        thickness_m: initialPreset.defaultWallThickness_m,
      },
    ],
    roofLayers: [
      {
        id: 'roof_layer_default',
        materialId: initialPreset.defaultSingleMaterialId,
        thickness_m: initialPreset.defaultRoofThickness_m,
      },
    ],
    geometry: {
      shape: initialPreset.defaultGeometry.shape,
      length_m: initialPreset.defaultGeometry.length_m,
      width_m: initialPreset.defaultGeometry.width_m,
      height_m: initialPreset.defaultGeometry.height_m,
      orientation_deg: initialPreset.defaultGeometry.orientation_deg,
      openings: initialPreset.defaultGeometry.openings.map((op) => ({ ...op })),
    },
    activePresetId: initialPreset.id,
  };
}

export const ShelterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<ShelterConfig>(buildInitialConfig);
  const [mode, setMode] = useState<AppMode>('quick');
  const [activeTab, setActiveTab] = useState<AppTab>('inputs');
  const [isReviewOpen, setIsReviewOpen] = useState<boolean>(false);

  // Validation issues calculated reactively
  const validationIssues = useMemo(() => validateShelterConfig(config), [config]);

  // Load Preset: 1-click loads climate, geometry, and default single-layer wall & roof
  const loadPreset = useCallback((presetId: string) => {
    const preset = REGION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    setConfig((prev) => ({
      ...prev,
      ambientClimate: {
        ...preset.ambientClimate,
        hourlyProfile: preset.ambientClimate.hourlyProfile.map((pt) => ({ ...pt })),
      },
      geometry: {
        shape: preset.defaultGeometry.shape,
        length_m: preset.defaultGeometry.length_m,
        width_m: preset.defaultGeometry.width_m,
        height_m: preset.defaultGeometry.height_m,
        orientation_deg: preset.defaultGeometry.orientation_deg,
        openings: preset.defaultGeometry.openings.map((op) => ({ ...op })),
      },
      wallLayers: [
        {
          id: `wall_${Date.now()}`,
          materialId: preset.defaultSingleMaterialId,
          thickness_m: preset.defaultWallThickness_m,
        },
      ],
      roofLayers: [
        {
          id: `roof_${Date.now()}`,
          materialId: preset.defaultSingleMaterialId,
          thickness_m: preset.defaultRoofThickness_m,
        },
      ],
      activePresetId: preset.id,
    }));
  }, []);

  // Quick Material Selector: assigns single-layer default wall and roof
  const setQuickMaterial = useCallback((materialId: string) => {
    setConfig((prev) => {
      const currentWallThickness = prev.wallLayers[0]?.thickness_m || 0.35;
      const currentRoofThickness = prev.roofLayers[0]?.thickness_m || 0.25;

      return {
        ...prev,
        wallLayers: [
          {
            id: `wall_quick_${Date.now()}`,
            materialId,
            thickness_m: currentWallThickness,
          },
        ],
        roofLayers: [
          {
            id: `roof_quick_${Date.now()}`,
            materialId,
            thickness_m: currentRoofThickness,
          },
        ],
        activePresetId: null, // manual override
      };
    });
  }, []);

  // Geometry Updates
  const updateGeometry = useCallback((updates: Partial<ShelterGeometry>) => {
    setConfig((prev) => ({
      ...prev,
      geometry: {
        ...prev.geometry,
        ...updates,
      },
      activePresetId: null, // manual tweak
    }));
  }, []);

  const addOpening = useCallback((opening: Omit<ShelterOpening, 'id'>) => {
    const newOpening: ShelterOpening = {
      ...opening,
      id: `op_${Date.now()}`,
    };
    setConfig((prev) => ({
      ...prev,
      geometry: {
        ...prev.geometry,
        openings: [...prev.geometry.openings, newOpening],
      },
    }));
  }, []);

  const updateOpening = useCallback((id: string, updates: Partial<ShelterOpening>) => {
    setConfig((prev) => ({
      ...prev,
      geometry: {
        ...prev.geometry,
        openings: prev.geometry.openings.map((op) => (op.id === id ? { ...op, ...updates } : op)),
      },
    }));
  }, []);

  const removeOpening = useCallback((id: string) => {
    setConfig((prev) => ({
      ...prev,
      geometry: {
        ...prev.geometry,
        openings: prev.geometry.openings.filter((op) => op.id !== id),
      },
    }));
  }, []);

  // Climate Updates
  const updateClimateMeta = useCallback(
    (key: 'regionName' | 'latitude' | 'longitude' | 'dateSeasonLabel', value: string | number) => {
      setConfig((prev) => ({
        ...prev,
        ambientClimate: {
          ...prev.ambientClimate,
          [key]: value,
        },
        activePresetId: null,
      }));
    },
    []
  );

  const updateHourlyPoint = useCallback(
    (hour: number, field: 'temperature_C' | 'irradiance_wm2', value: number) => {
      setConfig((prev) => ({
        ...prev,
        ambientClimate: {
          ...prev.ambientClimate,
          hourlyProfile: prev.ambientClimate.hourlyProfile.map((pt) =>
            pt.hour === hour ? { ...pt, [field]: value } : pt
          ),
        },
        activePresetId: null,
      }));
    },
    []
  );

  const setHourlyProfile = useCallback((profile: AmbientDataPoint[]) => {
    setConfig((prev) => ({
      ...prev,
      ambientClimate: {
        ...prev.ambientClimate,
        hourlyProfile: profile,
      },
      activePresetId: null,
    }));
  }, []);

  // Material Library Updates
  const updateMaterial = useCallback((id: string, updates: Partial<Material>) => {
    setConfig((prev) => ({
      ...prev,
      materialsLibrary: prev.materialsLibrary.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    }));
  }, []);

  const addCustomMaterial = useCallback(
    (mat: Omit<Material, 'id' | 'isDefaultReference' | 'verificationNotice'>) => {
      const newMaterial: Material = {
        ...mat,
        id: `mat_custom_${Date.now()}`,
        isDefaultReference: false,
        verificationNotice: 'Custom user defined material — verify accuracy before deployment',
      };
      setConfig((prev) => ({
        ...prev,
        materialsLibrary: [...prev.materialsLibrary, newMaterial],
      }));
    },
    []
  );

  // Wall Layer Updates
  const setWallLayers = useCallback((layers: WallLayer[]) => {
    setConfig((prev) => ({ ...prev, wallLayers: layers, activePresetId: null }));
  }, []);

  const addWallLayer = useCallback((materialId: string, thickness_m: number) => {
    const newLayer: WallLayer = {
      id: `wlayer_${Date.now()}`,
      materialId,
      thickness_m,
    };
    setConfig((prev) => ({
      ...prev,
      wallLayers: [...prev.wallLayers, newLayer],
      activePresetId: null,
    }));
  }, []);

  const updateWallLayer = useCallback((id: string, updates: Partial<WallLayer>) => {
    setConfig((prev) => ({
      ...prev,
      wallLayers: prev.wallLayers.map((l) => (l.id === id ? { ...l, ...updates } : l)),
      activePresetId: null,
    }));
  }, []);

  const removeWallLayer = useCallback((id: string) => {
    setConfig((prev) => ({
      ...prev,
      wallLayers: prev.wallLayers.filter((l) => l.id !== id),
      activePresetId: null,
    }));
  }, []);

  // Roof Layer Updates
  const setRoofLayers = useCallback((layers: WallLayer[]) => {
    setConfig((prev) => ({ ...prev, roofLayers: layers, activePresetId: null }));
  }, []);

  const addRoofLayer = useCallback((materialId: string, thickness_m: number) => {
    const newLayer: WallLayer = {
      id: `rlayer_${Date.now()}`,
      materialId,
      thickness_m,
    };
    setConfig((prev) => ({
      ...prev,
      roofLayers: [...prev.roofLayers, newLayer],
      activePresetId: null,
    }));
  }, []);

  const updateRoofLayer = useCallback((id: string, updates: Partial<WallLayer>) => {
    setConfig((prev) => ({
      ...prev,
      roofLayers: prev.roofLayers.map((l) => (l.id === id ? { ...l, ...updates } : l)),
      activePresetId: null,
    }));
  }, []);

  const removeRoofLayer = useCallback((id: string) => {
    setConfig((prev) => ({
      ...prev,
      roofLayers: prev.roofLayers.filter((l) => l.id !== id),
      activePresetId: null,
    }));
  }, []);

  const resetToInitialPreset = useCallback(() => {
    setConfig(buildInitialConfig());
  }, []);

  return (
    <ShelterContext.Provider
      value={{
        config,
        mode,
        setMode,
        activeTab,
        setActiveTab,
        isReviewOpen,
        setIsReviewOpen,
        validationIssues,
        loadPreset,
        setQuickMaterial,
        updateGeometry,
        addOpening,
        updateOpening,
        removeOpening,
        updateClimateMeta,
        updateHourlyPoint,
        setHourlyProfile,
        updateMaterial,
        addCustomMaterial,
        setWallLayers,
        addWallLayer,
        updateWallLayer,
        removeWallLayer,
        setRoofLayers,
        addRoofLayer,
        updateRoofLayer,
        removeRoofLayer,
        resetToInitialPreset,
      }}
    >
      {children}
    </ShelterContext.Provider>
  );
};

export const useShelter = (): ShelterContextType => {
  const context = useContext(ShelterContext);
  if (!context) {
    throw new Error('useShelter must be used within a ShelterProvider');
  }
  return context;
};
