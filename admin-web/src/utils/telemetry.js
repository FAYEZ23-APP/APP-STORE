/**
 * Operational Telemetry & Diagnostic Logging (WEB-011)
 * Provides production-safe error recording that maintains failure visibility
 * across client error boundaries and unexpected API rejections without exposing
 * internal implementation details in the browser console.
 */
export const reportClientError = (error, context = {}) => {
  const payload = {
    message: error?.message || String(error),
    stack: error?.stack ? error.stack.slice(0, 500) : null,
    context,
    url: typeof window !== 'undefined' ? window.location.pathname : '',
    timestamp: new Date().toISOString(),
  };

  if (import.meta.env.DEV) {
    // In development mode, output diagnostic details to console for developer visibility
    // eslint-disable-next-line no-console
    console.error('[Telemetry Client Error]:', payload);
    return;
  }

  // In production, asynchronously deliver diagnostic report via beacon/fetch
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/security/csp-reports',
        JSON.stringify({ 'client-error': payload })
      );
    }
  } catch {
    // Telemetry reporting should never throw or disrupt user flow
  }
};

export default reportClientError;
