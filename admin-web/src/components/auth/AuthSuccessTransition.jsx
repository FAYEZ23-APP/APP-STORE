import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';

/**
 * Stage 2 Celebratory 3D Rolling Shopping Cart Transition.
 * IMPORTANT: Rendered ONLY after the backend confirms authentication success
 * and no further verification/2FA step is pending.
 * Does NOT display fake percentage progress representing backend work.
 */
export default function AuthSuccessTransition({ onComplete }) {
  const { t } = useTranslation();
  const completedRef = useRef(false);

  useEffect(() => {
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const delayMs = reducedMotion ? 250 : 950;

    const timer = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
    }, delayMs);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 z-40 rounded-[1.75rem] bg-gradient-to-b from-[#F8F7F4] via-[#F4F0E8] to-[#E9E4DC] text-[#0E1114] border-2 border-[#D6A33A] p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-2xl overflow-hidden"
    >
      <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-60 h-60 rounded-full bg-[#D6A33A]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-1/2 -translate-x-1/2 w-60 h-60 rounded-full bg-[#C8102E]/15 blur-3xl" />

      <div className="relative z-10 flex flex-col items-center justify-center w-full space-y-4">
        <span className="inline-flex items-center gap-2 text-xs font-extrabold px-3.5 py-1.5 rounded-full bg-[#0E1114] text-[#D6A33A] border border-[#D6A33A]/60 shadow-sm">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>{t('auth.enteringStore')}</span>
        </span>

        {/* 3D Rolling Egypt Shop Cart SVG */}
        <div className="relative w-56 h-36 sm:w-64 sm:h-40 flex items-center justify-center select-none">
          <svg viewBox="0 0 280 185" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="egyCartGoldFrame" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F4D58D" />
                <stop offset="50%" stopColor="#D6A33A" />
                <stop offset="100%" stopColor="#9A6D17" />
              </linearGradient>
              <linearGradient id="egyCartCrimson" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#C8102E" />
                <stop offset="100%" stopColor="#960B21" />
              </linearGradient>
              <linearGradient id="egyGoldTrack" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(214,163,58,0)" />
                <stop offset="25%" stopColor="#D6A33A" />
                <stop offset="75%" stopColor="#D6A33A" />
                <stop offset="100%" stopColor="rgba(214,163,58,0)" />
              </linearGradient>
            </defs>

            <rect x="22" y="156" width="236" height="4" rx="2" fill="url(#egyGoldTrack)" />
            <ellipse cx="140" cy="162" rx="74" ry="5" fill="rgba(14,17,20,0.16)" />

            <g>
              <rect x="26" y="88" width="26" height="3" rx="1.5" fill="#D6A33A" className="cart-speed-line" />
              <rect x="16" y="106" width="34" height="3" rx="1.5" fill="#C8102E" className="cart-speed-line" style={{ animationDelay: '0.25s' }} />
              <rect x="30" y="124" width="22" height="3" rx="1.5" fill="#0E1114" opacity="0.4" className="cart-speed-line" style={{ animationDelay: '0.5s' }} />
            </g>

            <g className="cart-chassis-anim">
              <polygon points="84,68 206,68 192,122 96,122" fill="rgba(14,17,20,0.08)" />
              <line x1="112" y1="68" x2="118" y2="122" stroke="rgba(14,17,20,0.22)" strokeWidth="2" />
              <line x1="145" y1="68" x2="145" y2="122" stroke="rgba(14,17,20,0.22)" strokeWidth="2" />
              <line x1="178" y1="68" x2="172" y2="122" stroke="rgba(14,17,20,0.22)" strokeWidth="2" />
              <line x1="90" y1="95" x2="199" y2="95" stroke="rgba(14,17,20,0.22)" strokeWidth="2" />

              <polygon points="84,68 206,68 192,122 96,122" fill="none" stroke="#0E1114" strokeWidth="4.5" strokeLinejoin="round" />
              <polygon points="86,70 204,70 190,120 98,120" fill="none" stroke="url(#egyCartGoldFrame)" strokeWidth="2" strokeLinejoin="round" />

              <rect x="116" y="84" width="58" height="22" rx="6" fill="url(#egyCartCrimson)" stroke="#D6A33A" strokeWidth="1.5" />
              <text x="145" y="98.5" textAnchor="middle" fill="#F8F7F4" fontWeight="900" fontSize="10" fontFamily="Cairo, sans-serif">
                سوق مصر
              </text>

              <path d="M62,50 L78,50 L96,122 L88,136 L194,136" fill="none" stroke="#0E1114" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="54" y="46" width="18" height="8" rx="4" fill="url(#egyCartCrimson)" stroke="#D6A33A" strokeWidth="1.5" />

              <g className="cart-wheel-spin">
                <circle cx="104" cy="146" r="11" fill="#0E1114" stroke="#D6A33A" strokeWidth="2.5" />
                <circle cx="104" cy="146" r="4" fill="#C8102E" />
                <line x1="104" y1="136" x2="104" y2="156" stroke="#F8F7F4" strokeWidth="1.4" />
                <line x1="94" y1="146" x2="114" y2="146" stroke="#F8F7F4" strokeWidth="1.4" />
              </g>

              <g className="cart-wheel-spin">
                <circle cx="182" cy="146" r="11" fill="#0E1114" stroke="#D6A33A" strokeWidth="2.5" />
                <circle cx="182" cy="146" r="4" fill="#C8102E" />
                <line x1="182" y1="136" x2="182" y2="156" stroke="#F8F7F4" strokeWidth="1.4" />
                <line x1="172" y1="146" x2="192" y2="146" stroke="#F8F7F4" strokeWidth="1.4" />
              </g>
            </g>
          </svg>
        </div>

        <p className="text-xs font-bold text-[#0E1114]/75">
          {t('auth.preparingWorkspace')}
        </p>
      </div>
    </div>
  );
}
