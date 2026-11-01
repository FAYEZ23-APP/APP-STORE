import React, { useRef, useState, useEffect } from 'react';

/**
 * OtpInput - Modern, accessible, 6-digit OTP Input for React Web
 * Features full copy-paste splitting, backspace navigation, arrow navigation,
 * and forced LTR layout for consistent digit ordering in RTL and LTR modes.
 */
export default function OtpInput({
  length = 6,
  value = '',
  onChange,
  onComplete,
  disabled = false,
  autoFocus = false,
}) {
  const inputRefs = useRef([]);
  const [focusedIndex, setFocusedIndex] = useState(null);

  const digits = Array.from({ length }, (_, i) => value[i] || '');

  useEffect(() => {
    if (autoFocus && inputRefs.current[0] && !disabled) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus, disabled]);

  const handleChange = (e, index) => {
    if (disabled) return;
    const raw = e.target.value;
    const cleaned = raw.replace(/\D/g, '');

    // Handle full paste inside a single input
    if (cleaned.length > 1) {
      const pasted = cleaned.slice(0, length);
      onChange?.(pasted);
      if (pasted.length === length) {
        onComplete?.(pasted);
        inputRefs.current[length - 1]?.focus();
      } else {
        inputRefs.current[Math.min(pasted.length, length - 1)]?.focus();
      }
      return;
    }

    // Single digit input
    const char = cleaned.slice(-1) || '';
    const currentArray = Array.from({ length }, (_, i) => value[i] || '');
    currentArray[index] = char;
    const nextValue = currentArray.join('').trimEnd();
    onChange?.(nextValue);

    if (char && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (currentArray.every((d) => d !== '') && nextValue.length === length) {
      onComplete?.(nextValue);
    }
  };

  const handleKeyDown = (e, index) => {
    if (disabled) return;

    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        const currentArray = Array.from({ length }, (_, i) => value[i] || '');
        currentArray[index - 1] = '';
        onChange?.(currentArray.join('').trimEnd());
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft') {
      if (index > 0) {
        e.preventDefault();
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowRight') {
      if (index < length - 1) {
        e.preventDefault();
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handlePaste = (e) => {
    if (disabled) return;
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const cleaned = pastedData.replace(/\D/g, '').slice(0, length);

    if (cleaned) {
      onChange?.(cleaned);
      if (cleaned.length === length) {
        onComplete?.(cleaned);
        inputRefs.current[length - 1]?.focus();
      } else {
        inputRefs.current[cleaned.length]?.focus();
      }
    }
  };

  return (
    <div
      dir="ltr"
      className="flex items-center justify-center gap-2 sm:gap-3 my-4 select-none"
    >
      {Array.from({ length }).map((_, index) => {
        const isFilled = Boolean(digits[index]);
        const isFocused = focusedIndex === index;

        return (
          <input
            key={`otp-${index}`}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={index === 0 ? length : 1}
            value={digits[index]}
            disabled={disabled}
            onChange={(e) => handleChange(e, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onPaste={handlePaste}
            onFocus={(e) => {
              setFocusedIndex(index);
              e.target.select();
            }}
            onBlur={() => setFocusedIndex(null)}
            className={`w-11 h-14 sm:w-12 sm:h-16 text-center text-xl sm:text-2xl font-black font-mono rounded-2xl border-2 transition-all outline-none ${
              disabled
                ? 'bg-[#ECE9E6] border-[#ECE9E6] text-slate-400 cursor-not-allowed opacity-60'
                : isFocused
                ? 'bg-white border-[#C8102E] shadow-md shadow-[#C8102E]/20 ring-2 ring-[#C8102E]/20 text-[#C8102E] scale-105'
                : isFilled
                ? 'bg-[#FDF2F4] border-[#C8102E]/50 text-[#C8102E]'
                : 'bg-[#FAF8F5] border-[#ECE9E6] text-[#1F2329] hover:border-[#C8102E]/30'
            }`}
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
          />
        );
      })}
    </div>
  );
}
