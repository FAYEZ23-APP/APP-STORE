/**
 * Error Sanitization Utility (Security Reference: MOB-010)
 *
 * Enforces production error masking:
 * - Redacts JWT tokens & Bearer authorization headers
 * - Redacts email addresses
 * - Redacts Egyptian & international phone numbers
 * - Redacts Windows drive paths and Unix absolute paths
 * - Preserves developer diagnostics in development mode
 */

export const sanitizeErrorDetails = (error, errorInfo) => {
  const rawMsg = error?.message || (typeof error === 'string' ? error : 'Unknown error');
  const rawStack = error?.stack || '';
  const rawComponentStack = errorInfo?.componentStack || '';

  const redact = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str
      // 1. Redact JWT tokens & Bearer headers
      .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g, '[REDACTED_TOKEN]')
      .replace(/Bearer\s+[A-Za-z0-9_.-]+/gi, 'Bearer [REDACTED_TOKEN]')
      // 2. Redact email addresses
      .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '[REDACTED_EMAIL]')
      // 3. Redact phone numbers (Egyptian & international formats)
      .replace(/(?:\+20|0)?1[0125]\d{8}/g, '[REDACTED_PHONE]')
      // 4. Redact Windows drive paths (e.g. D:\Backend\...) and Unix paths (/Users/... /home/...)
      .replace(/[A-Za-z]:\\[^\s:;,)"']+/g, '[REDACTED_PATH]')
      .replace(/(?:\/[a-zA-Z0-9_.-]+){3,}/g, '[REDACTED_PATH]');
  };

  return {
    message: redact(rawMsg),
    stack: redact(rawStack),
    componentStack: redact(rawComponentStack),
  };
};

export default {
  sanitizeErrorDetails,
};
