import React, { useEffect, useRef, useState } from 'react';

/**
 * 3D Perspective Stage & Ambient Backdrop for Egypt Shop Authentication.
 * Provides smooth mouse/touch 3D tilt on desktop/tablet and disables heavy
 * 3D transforms on mobile viewports or when prefers-reduced-motion is enabled.
 */
export default function Auth3DStage({
  children,
  maxWidthClass = 'max-w-[500px]',
  bagPulseKey = 0,
  lockPulseKey = 0,
}) {
  const tiltRef = useRef(null);
  const bagLayerRef = useRef(null);
  const lockLayerRef = useRef(null);
  const [bagReacting, setBagReacting] = useState(false);
  const [lockEngaged, setLockEngaged] = useState(false);

  useEffect(() => {
    if (!bagPulseKey) return;
    setBagReacting(true);
    const timer = setTimeout(() => setBagReacting(false), 580);
    return () => clearTimeout(timer);
  }, [bagPulseKey]);

  useEffect(() => {
    if (!lockPulseKey) return;
    setLockEngaged(true);
    const timer = setTimeout(() => setLockEngaged(false), 540);
    return () => clearTimeout(timer);
  }, [lockPulseKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const smallScreen = window.innerWidth < 768;
    if (reducedMotion || smallScreen) return undefined;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let rafId = null;

    const updatePointer = (clientX, clientY) => {
      const el = tiltRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const normX = Math.max(-1.25, Math.min(1.25, (clientX - centerX) / (rect.width / 2)));
      const normY = Math.max(-1.25, Math.min(1.25, (clientY - centerY) / (rect.height / 2)));

      targetY = normX * 6.5;
      targetX = -normY * 5.5;

      const relX = ((clientX - rect.left) / rect.width) * 100;
      const relY = ((clientY - rect.top) / rect.height) * 100;
      el.style.setProperty('--mouse-x', `${relX}%`);
      el.style.setProperty('--mouse-y', `${relY}%`);
    };

    const handleMouseMove = (e) => updatePointer(e.clientX, e.clientY);
    const handleMouseLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    const tick = () => {
      currentX += (targetX - currentX) * 0.1;
      currentY += (targetY - currentY) * 0.1;

      if (tiltRef.current) {
        tiltRef.current.style.transform = `rotateX(${currentX.toFixed(2)}deg) rotateY(${currentY.toFixed(2)}deg)`;
      }

      const px = currentY * 1.35;
      const py = -currentX * 1.35;
      if (bagLayerRef.current) {
        bagLayerRef.current.style.transform = `translate3d(${(px * 1.15).toFixed(1)}px, ${(py * 1.15).toFixed(1)}px, 70px)`;
      }
      if (lockLayerRef.current) {
        lockLayerRef.current.style.transform = `translate3d(${(px * 1.2).toFixed(1)}px, ${(py * 1.1).toFixed(1)}px, 75px)`;
      }

      rafId = window.requestAnimationFrame(tick);
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);
    rafId = window.requestAnimationFrame(tick);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center w-full py-4 sm:py-8">
      {/* Ambient Crimson & Gold Orbs + Subtle Depth Particles */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden="true">
        <div className="absolute -top-28 end-1/5 w-80 h-80 sm:w-[440px] sm:h-[440px] rounded-full bg-[#960B21]/30 blur-[120px]" />
        <div className="absolute -bottom-24 start-1/5 w-80 h-80 sm:w-[400px] sm:h-[400px] rounded-full bg-[#D6A33A]/15 blur-[120px]" />
        <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full border border-[#D6A33A]/10" />
        <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[740px] h-[740px] rounded-full border border-[#C8102E]/10" />
        <span className="gold-dust hidden sm:block absolute top-[18%] end-[14%] w-2 h-2 rounded-full bg-[#D6A33A] shadow-[0_0_12px_#D6A33A]" />
        <span
          className="gold-dust hidden sm:block absolute top-[28%] start-[16%] w-1.5 h-1.5 rounded-full bg-[#C8102E] shadow-[0_0_10px_#C8102E]"
          style={{ animationDelay: '1.4s' }}
        />
        <span
          className="gold-dust hidden sm:block absolute bottom-[22%] end-[20%] w-1.5 h-1.5 rounded-full bg-[#D6A33A] shadow-[0_0_12px_#D6A33A]"
          style={{ animationDelay: '2.6s' }}
        />
      </div>

      {/* 3D Perspective Stage */}
      <div className={`perspective-stage relative z-20 w-full ${maxWidthClass} mx-auto`}>
        {/* Minimal 3D Shopping Bag Accent (Desktop/Tablet only) */}
        <div
          ref={bagLayerRef}
          aria-hidden="true"
          className="hidden md:block float-3d-layer pointer-events-none absolute -top-7 -end-10 z-30 select-none"
          style={{ transform: 'translateZ(70px)' }}
        >
          <div className={`anim-float-a w-16 h-16 drop-shadow-[0_14px_22px_rgba(0,0,0,0.65)] ${bagReacting ? 'bag-react' : ''}`}>
            <svg viewBox="0 0 64 64" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="egyBagGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#C8102E" />
                  <stop offset="100%" stopColor="#960B21" />
                </linearGradient>
              </defs>
              <path d="M22 22 C22 12, 42 12, 42 22" fill="none" stroke="#D6A33A" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M13 22 H51 L55 55 C55 57.5 53 59 50.5 59 H13.5 C11 59 9 57.5 9 55 Z" fill="url(#egyBagGrad)" stroke="#D6A33A" strokeWidth="2" />
              <path d="M32 31 L34.8 36.6 L41 37.5 L36.5 41.8 L37.6 48 L32 45 L26.4 48 L27.5 41.8 L23 37.5 L29.2 36.6 Z" fill="#D6A33A" />
            </svg>
          </div>
        </div>

        {/* Minimal 3D Security Lock Accent (Desktop/Tablet only) */}
        <div
          ref={lockLayerRef}
          aria-hidden="true"
          className="hidden md:block float-3d-layer pointer-events-none absolute -bottom-6 -start-9 z-30 select-none"
          style={{ transform: 'translateZ(75px)' }}
        >
          <div className={`anim-float-d w-14 h-14 drop-shadow-[0_14px_22px_rgba(0,0,0,0.65)] ${lockEngaged ? 'lock-engaged' : ''}`}>
            <svg viewBox="0 0 64 64" className="w-full h-full overflow-visible">
              <path d="M21 28 V21 C21 14 43 14 43 21 V28" fill="none" stroke="#D6A33A" strokeWidth="4" strokeLinecap="round" />
              <rect x="14" y="28" width="36" height="28" rx="8" fill="#0E1114" stroke="#D6A33A" strokeWidth="2" />
              <circle cx="32" cy="40" r="4" fill="#D6A33A" />
              <rect x="30.5" y="43" width="3" height="6" rx="1.5" fill="#C8102E" />
            </svg>
          </div>
        </div>

        {/* Interactive Tilt Wrapper */}
        <div ref={tiltRef} className="tilt-wrapper relative">
          {children}
        </div>
      </div>
    </div>
  );
}
