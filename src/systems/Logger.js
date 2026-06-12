/* ==========================================================================
   Apex Horizon - Debug-Gated Logger Utility
   ========================================================================== */

const isDebug = typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('debug');

export const Logger = {
  /**
   * Debug-level log. Only outputs when ?debug=1 is in the URL.
   */
  debug(...args) {
    if (isDebug) {
      console.log('[APEX]', ...args);
    }
  },

  /**
   * Warning-level log. Always outputs.
   */
  warn(...args) {
    console.warn('[APEX WARN]', ...args);
  },

  /**
   * Error-level log. Always outputs.
   */
  error(...args) {
    console.error('[APEX ERROR]', ...args);
  }
};
