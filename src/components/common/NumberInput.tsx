import React, { useState, useEffect, useRef } from 'react';

export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | string | undefined | null;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number | string;
  fallbackValue?: number;
  allowEmpty?: boolean;
}

function formatInitial(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '';
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num) || !Number.isFinite(num)) return '';
  return String(num);
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  min,
  max,
  step = 'any',
  fallbackValue,
  allowEmpty = false,
  className,
  onBlur,
  onFocus,
  onKeyDown,
  ...rest
}) => {
  const [text, setText] = useState<string>(() => formatInitial(value));
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const textRef = useRef<string>(text);
  textRef.current = text;

  // Sync external value when not focused
  useEffect(() => {
    if (!isFocused) {
      setText(formatInitial(value));
    }
  }, [value, isFocused]);

  const commit = () => {
    const trimmed = textRef.current.trim();
    if (trimmed === '') {
      if (allowEmpty) {
        setText('');
        return;
      }
      const fallback =
        fallbackValue !== undefined && Number.isFinite(fallbackValue)
          ? fallbackValue
          : typeof value === 'number' && Number.isFinite(value)
          ? value
          : min !== undefined && Number.isFinite(min)
          ? min
          : 0;
      setText(String(fallback));
      onChange(fallback);
      return;
    }

    let parsed = parseFloat(trimmed);
    if (isNaN(parsed) || !Number.isFinite(parsed)) {
      const fallback =
        fallbackValue !== undefined && Number.isFinite(fallbackValue)
          ? fallbackValue
          : typeof value === 'number' && Number.isFinite(value)
          ? value
          : min !== undefined && Number.isFinite(min)
          ? min
          : 0;
      setText(String(fallback));
      onChange(fallback);
      return;
    }

    if (min !== undefined && parsed < min) {
      parsed = min;
    }
    if (max !== undefined && parsed > max) {
      parsed = max;
    }

    // Format clean representation
    setText(String(parsed));
    onChange(parsed);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    commit();
    if (onBlur) {
      onBlur(e);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    if (onFocus) {
      onFocus(e);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    // Allow typing numbers, minus, dot, etc.
    setText(nextVal);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setText(formatInitial(value));
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const numStep = typeof step === 'number' ? step : parseFloat(String(step) || '1') || 1;
      const direction = e.key === 'ArrowUp' ? 1 : -1;
      const currentNum = parseFloat(text);
      const base = isNaN(currentNum) || !Number.isFinite(currentNum)
        ? typeof value === 'number' && Number.isFinite(value)
          ? value
          : 0
        : currentNum;
      let next = base + direction * numStep;
      const stepDecimals = (String(step).split('.')[1] || '').length;
      next = parseFloat(next.toFixed(Math.max(stepDecimals, 4)));
      if (min !== undefined && next < min) next = min;
      if (max !== undefined && next > max) next = max;
      setText(String(next));
      onChange(next);
      e.preventDefault();
    }
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
      {...rest}
    />
  );
};
