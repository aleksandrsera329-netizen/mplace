/**
 * Stage 21 — standalone XSS escape (load if api.js is not present).
 * Prefer loading assets/js/api.js which also defines these.
 */
(function (global) {
  if (typeof global.escapeHtml === 'function') return;

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/`/g, '&#96;');
  }

  global.escapeHtml = escapeHtml;
  global.escapeAttr = escapeAttr;
})(typeof window !== 'undefined' ? window : globalThis);
