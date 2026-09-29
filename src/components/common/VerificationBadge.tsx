import React from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * Mandatory compliance badge for unvalidated reference values.
 */
export const VerificationBadge: React.FC<Props> = ({ className = '', size = 'sm' }) => {
  const sizeClasses =
    size === 'sm' ? 'text-[11px] px-2 py-0.5 gap-1' : 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <span
      className={`inline-flex items-center rounded border border-amber-500/40 bg-amber-500/10 text-amber-300 font-medium tracking-wide ${sizeClasses} ${className}`}
      title="Default reference value — verify before deployment"
    >
      <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
      <span>Default reference value — verify before deployment</span>
    </span>
  );
};
