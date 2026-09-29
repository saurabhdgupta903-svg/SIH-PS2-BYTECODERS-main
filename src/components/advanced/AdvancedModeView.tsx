import React, { useState } from 'react';
import { Globe2, Layers, Box } from 'lucide-react';
import { ClimateTableEditor } from './ClimateTableEditor';
import { MaterialLibraryEditor } from './MaterialLibraryEditor';
import { MultiLayerEditor } from './MultiLayerEditor';
import { GeometryEditor } from './GeometryEditor';

type AdvSection = 'climate' | 'materials' | 'geometry';

export const AdvancedModeView: React.FC = () => {
  const [activeSection, setActiveSection] = useState<AdvSection>('climate');

  return (
    <div className="space-y-6">
      {/* Advanced Mode Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-xl bg-slate-850 border border-slate-750">
        <button
          type="button"
          onClick={() => setActiveSection('climate')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
            activeSection === 'climate'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Globe2 className="w-3.5 h-3.5" />
          <span>Section A: Ambient Climate & 24h Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('materials')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
            activeSection === 'materials'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Section B: Materials & Layer Assemblies</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('geometry')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
            activeSection === 'geometry'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          <span>Section C: Geometry & Fenestrations</span>
        </button>
      </div>

      {/* Section Content */}
      {activeSection === 'climate' && <ClimateTableEditor />}

      {activeSection === 'materials' && (
        <div className="space-y-8">
          <MultiLayerEditor />
          <MaterialLibraryEditor />
        </div>
      )}

      {activeSection === 'geometry' && <GeometryEditor />}
    </div>
  );
};
