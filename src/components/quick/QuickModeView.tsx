import React from 'react';
import { PresetCardPicker } from './PresetCardPicker';
import { GeometrySliders } from './GeometrySliders';
import { QuickMaterialPicker } from './QuickMaterialPicker';

export const QuickModeView: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* 1. Presets */}
      <PresetCardPicker />

      {/* 2. Geometry Sliders */}
      <GeometrySliders />

      {/* 3. Quick Material Selection */}
      <QuickMaterialPicker />
    </div>
  );
};
