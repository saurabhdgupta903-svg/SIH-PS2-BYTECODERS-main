import React, { useRef, useState } from 'react';
import { Upload, Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useShelter } from '../../context/ShelterContext';
import { parseClimateCsv, generateSampleCsv } from '../../utils/csvParser';

export const CsvUploader: React.FC = () => {
  const { setHourlyProfile, config } = useShelter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) {
        setFeedback({ type: 'error', message: 'Uploaded file is empty.' });
        return;
      }

      const res = parseClimateCsv(content);
      if (res.success && res.data) {
        setHourlyProfile(res.data);
        setFeedback({
          type: 'success',
          message: `Successfully loaded 24 hourly climate data points from ${file.name}.`,
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Failed to parse CSV file.',
        });
      }
    };

    reader.onerror = () => {
      setFeedback({ type: 'error', message: 'Failed to read file.' });
    };

    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    const csvData = generateSampleCsv(config.ambientClimate.hourlyProfile);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `climate_profile_${config.ambientClimate.regionName.replace(/\s+/g, '_').toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3 p-4 rounded-xl bg-palette-card border border-palette-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs font-semibold text-palette-text-primary uppercase tracking-wider block">
            CSV Climate Data Import & Export
          </span>
          <p className="text-xs text-palette-text-secondary">
            Columns: <code className="text-palette-yellow font-mono">hour, temperature_C, irradiance_wm2</code>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
            id="climate-csv-input"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-palette-violet hover:bg-palette-violet-hover text-palette-text-primary text-xs font-semibold transition-colors shadow-sm border border-palette-magenta/40"
          >
            <Upload className="w-3.5 h-3.5 text-palette-yellow" />
            <span>Upload CSV</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-palette-raised hover:bg-palette-card text-palette-text-secondary hover:text-palette-text-primary border border-palette-border text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-palette-yellow" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {/* Status Feedback banner */}
      {feedback && (
        <div
          className={`flex items-start gap-2 p-2.5 rounded-lg text-xs border ${
            feedback.type === 'success'
              ? 'bg-palette-raised border-palette-magenta text-palette-text-primary'
              : 'bg-palette-raised border-palette-pink-red text-palette-pink-red'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-palette-yellow shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-palette-pink-red shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-palette-text-muted hover:text-palette-text-primary text-xs"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
};
