import React from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

/**
 * Accessible Modal Wrapper Component (WEB-009)
 * Provides WCAG compliant modal behavior:
 * - role="dialog" and aria-modal="true"
 * - Keyboard focus trap (Tab / Shift+Tab)
 * - Dismiss on Escape key
 * - Clean backdrop blur and accessibility labels
 */
export default function AccessibleModal({
  isOpen,
  onClose,
  title,
  ariaLabel,
  maxWidth = 'max-w-md',
  children,
  className = '',
}) {
  const containerRef = useFocusTrap(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || (typeof title === 'string' ? title : 'نافذة تفاعلية / Modal Dialog')}
        tabIndex={-1}
        className={`bg-white rounded-3xl ${maxWidth} w-full p-6 shadow-2xl border border-slate-200 outline-none ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
