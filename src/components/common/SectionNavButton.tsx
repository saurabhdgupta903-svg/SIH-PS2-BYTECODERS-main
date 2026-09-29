import React from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { useShelter, type AppTab } from '../../context/ShelterContext';

interface NextStepConfig {
  nextTab: AppTab;
  label: string;
  sublabel: string;
  isBack?: boolean;
}

const NEXT_STEPS: Record<AppTab, NextStepConfig> = {
  inputs: {
    nextTab: 'results',
    label: 'Generate Results',
    sublabel: 'Run 24h steady-cycle thermal simulation',
  },
  results: {
    nextTab: 'compare',
    label: 'Compare Scenarios',
    sublabel: 'Evaluate design alternatives & wall configurations',
  },
  compare: {
    nextTab: 'sensitivity',
    label: 'Analyze Sensitivity',
    sublabel: 'Inspect parameter sensitivity & impact ranking',
  },
  sensitivity: {
    nextTab: 'recommender',
    label: 'Explore Recommendations',
    sublabel: 'Automated multi-objective design optimization',
  },
  recommender: {
    nextTab: '3d',
    label: 'Explore 3D View',
    sublabel: 'Interactive 3D geometry & thermal envelope inspection',
  },
  '3d': {
    nextTab: 'report',
    label: 'View Engineering Report',
    sublabel: 'Comprehensive audit summary & PDF export',
  },
  report: {
    nextTab: 'inputs',
    label: 'Back to Inputs',
    sublabel: 'Reconfigure envelope geometry & materials',
    isBack: true,
  },
};

export const SectionNavButton: React.FC = () => {
  const { activeTab, setActiveTab } = useShelter();
  const step = NEXT_STEPS[activeTab];

  if (!step) return null;

  const handleClick = () => {
    setActiveTab(step.nextTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="no-print pt-6 pb-2 border-t border-palette-border flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="text-xs text-palette-text-secondary text-center sm:text-left">
        <span>Current section complete?</span>{' '}
        <span className="text-palette-text-primary font-medium">{step.sublabel}</span>
      </div>

      <button
        type="button"
        onClick={handleClick}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-palette-violet hover:bg-palette-violet-hover active:bg-palette-violet text-palette-text-primary font-semibold text-sm border border-palette-magenta/50 shadow-md transition-all group shrink-0"
      >
        {step.isBack ? (
          <>
            <RotateCcw className="w-4 h-4 text-palette-yellow group-hover:-rotate-45 transition-transform" />
            <span>{step.label}</span>
          </>
        ) : (
          <>
            <span>{step.label}</span>
            <ArrowRight className="w-4 h-4 text-palette-yellow group-hover:translate-x-1 transition-transform" />
          </>
        )}
      </button>
    </div>
  );
};
