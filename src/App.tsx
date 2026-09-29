import React from 'react';
import { ShelterProvider, useShelter } from './context/ShelterContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { ModeToggle } from './components/common/ModeToggle';
import { QuickModeView } from './components/quick/QuickModeView';
import { AdvancedModeView } from './components/advanced/AdvancedModeView';
import { ResultsView } from './components/results/ResultsView';
import { CompareView } from './components/compare/CompareView';
import { ThreeDView } from './components/visualization/ThreeDView';
import { RecommenderView } from './components/recommender/RecommenderView';
import { SensitivityView } from './components/sensitivity/SensitivityView';
import { ReportView } from './components/report/ReportView';
import { ReviewInputsModal } from './components/review/ReviewInputsModal';
import { SectionNavButton } from './components/common/SectionNavButton';
import { Sparkles, Code2 } from 'lucide-react';

const ShelterWorkspace: React.FC = () => {
  const { mode, activeTab, setIsReviewOpen, config } = useShelter();

  return (
    <div className="min-h-screen flex flex-col bg-palette-page text-palette-text-primary selection:bg-palette-violet selection:text-palette-text-primary">
      {/* Top Application Header */}
      <Header />

      {/* Main Workspace Body: Sidebar + Dynamic Main Area */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Navigation Sidebar */}
        <Sidebar />

        {/* Primary Content Stage */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          {activeTab === 'inputs' && (
            <>
              {/* Mode Toggle at top of Inputs */}
              <ModeToggle />

              {/* Informational banner */}
              <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-palette-card border border-palette-border text-xs text-palette-text-secondary">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-palette-yellow" />
                  <span>
                    Active Profile:{' '}
                    <strong className="text-palette-text-primary">{config.ambientClimate.regionName}</strong> &bull;{' '}
                    {config.ambientClimate.dateSeasonLabel}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsReviewOpen(true)}
                  className="text-palette-yellow hover:underline underline-offset-2 flex items-center gap-1 font-mono font-medium"
                >
                  <Code2 className="w-3 h-3" />
                  <span>View JSON Payload</span>
                </button>
              </div>

              {/* View Switcher */}
              {mode === 'quick' ? <QuickModeView /> : <AdvancedModeView />}
            </>
          )}

          {activeTab === 'results' && <ResultsView />}

          {activeTab === 'compare' && <CompareView />}

          {activeTab === '3d' && <ThreeDView />}

          {activeTab === 'recommender' && <RecommenderView />}

          {activeTab === 'sensitivity' && <SensitivityView />}

          {activeTab === 'report' && <ReportView />}

          {/* Contextual navigation stepper button */}
          <SectionNavButton />
        </main>
      </div>

      {/* Review Inputs JSON Modal */}
      <ReviewInputsModal />
    </div>
  );
};

export default function App() {
  return (
    <ShelterProvider>
      <ShelterWorkspace />
    </ShelterProvider>
  );
}
