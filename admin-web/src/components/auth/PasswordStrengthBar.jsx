import React from 'react';
import { useTranslation } from 'react-i18next';

function evaluatePasswordStrength(password) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 9) score += 1;
  if (/[A-Z]/.test(password) || /[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password) || (/[a-zA-Z]/.test(password) && /[0-9]/.test(password) && password.length >= 8)) {
    score += 1;
  }
  return Math.min(4, score);
}

const BAR_STYLES = [
  'bg-[#E9E4DC] border border-[#0E1114]/10',
  'bg-[#C8102E]',
  'bg-[#960B21]',
  'bg-[#D6A33A]',
  'bg-gradient-to-r from-[#C8102E] to-[#D6A33A]',
];

export default function PasswordStrengthBar({ password }) {
  const { t } = useTranslation();
  const score = evaluatePasswordStrength(password);

  const labels = [
    t('auth.strengthIdle'),
    t('auth.strengthWeak'),
    t('auth.strengthFair'),
    t('auth.strengthGood'),
    t('auth.strengthStrong'),
  ];

  const activeStyle = password ? BAR_STYLES[score] : BAR_STYLES[0];

  return (
    <div className="mt-2 space-y-1.5" aria-live="polite">
      <div className="grid grid-cols-4 gap-1.5">
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              password && idx < score ? activeStyle : BAR_STYLES[0]
            }`}
          />
        ))}
      </div>
      <p className="text-[11px] font-semibold text-[#0E1114]/70">
        {labels[score]}
      </p>
    </div>
  );
}
