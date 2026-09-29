import React, { useState } from 'react';
import { X, Copy, Check, Download, AlertTriangle, CheckCircle2, Code2 } from 'lucide-react';
import { useShelter } from '../../context/ShelterContext';

export const ReviewInputsModal: React.FC = () => {
  const { isReviewOpen, setIsReviewOpen, config, validationIssues } = useShelter();
  const [copied, setCopied] = useState(false);

  if (!isReviewOpen) return null;

  const jsonString = JSON.stringify(config, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `shelterx_config_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const errors = validationIssues.filter((i) => i.severity === 'error');
  const warnings = validationIssues.filter((i) => i.severity === 'warning');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-palette-page/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-palette-card border border-palette-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-palette-border bg-palette-card">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-palette-raised border border-palette-border">
              <Code2 className="w-5 h-5 text-palette-yellow" />
            </div>
            <div>
              <h2 className="text-base font-bold text-palette-text-primary">Review Inputs & State Verification</h2>
              <p className="text-xs text-palette-text-secondary">
                SHELTER-X source of truth formatted as JSON &bull; Verified physical boundary constraints
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-palette-raised hover:bg-palette-violet text-palette-text-primary text-xs font-medium border border-palette-border transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-palette-yellow" />
                  <span className="text-palette-yellow font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-palette-yellow" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-palette-raised hover:bg-palette-violet text-palette-text-primary text-xs font-medium border border-palette-border transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-palette-yellow" />
              <span>Download</span>
            </button>

            <button
              type="button"
              onClick={() => setIsReviewOpen(false)}
              className="p-1.5 rounded-lg text-palette-text-muted hover:text-palette-text-primary hover:bg-palette-raised transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Validation Issues Bar */}
        <div className="px-6 py-3 border-b border-palette-border bg-palette-raised/50">
          {errors.length === 0 && warnings.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-palette-text-primary">
              <CheckCircle2 className="w-4 h-4 text-palette-yellow shrink-0" />
              <span>All physical inputs pass validation checks (no negative dimensions, valid ranges).</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {errors.map((err, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-palette-pink-red">
                  <AlertTriangle className="w-4 h-4 text-palette-pink-red shrink-0 mt-0.5" />
                  <span>
                    <strong className="font-mono text-palette-pink-red">{err.field}:</strong> {err.message}
                  </span>
                </div>
              ))}
              {warnings.map((warn, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-palette-yellow">
                  <AlertTriangle className="w-4 h-4 text-palette-yellow shrink-0 mt-0.5" />
                  <span>
                    <strong className="font-mono text-palette-yellow">{warn.field}:</strong> {warn.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* JSON Code Viewer */}
        <div className="flex-1 p-6 overflow-y-auto bg-palette-page font-mono text-xs text-palette-text-secondary">
          <pre className="whitespace-pre-wrap leading-relaxed select-all">
            {jsonString}
          </pre>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 bg-palette-card border-t border-palette-border text-xs text-palette-text-muted">
          <span>Payload ready for thermal calculation engine consumption.</span>
          <button
            type="button"
            onClick={() => setIsReviewOpen(false)}
            className="px-4 py-1.5 rounded-lg bg-palette-violet hover:bg-palette-violet-hover text-palette-text-primary font-semibold transition-colors border border-palette-magenta/40"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
