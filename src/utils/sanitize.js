// src/utils/sanitize.js
// Minimal HTML-escaping for user-provided text.
// Purpose: prevent HTML/JS injection when text is later rendered in admin/history views.

export function sanitizeText(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);

  // Fast path: nothing to escape
  if (!/[&<>"'`]/.test(str)) return str;

  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}

// Sanitizes only string fields of a plain object (shallow).
export function sanitizeObjectStrings(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [...obj] : { ...obj };
  Object.keys(out).forEach((k) => {
    if (typeof out[k] === 'string') out[k] = sanitizeText(out[k]);
  });
  return out;
}
