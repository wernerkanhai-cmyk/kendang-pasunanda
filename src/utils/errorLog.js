/**
 * Centralized error reporting for Kendang Pasunanda.
 * Collects errors in-memory for diagnostics; no external service required.
 */

const MAX_ENTRIES = 50;
const log = [];

const entry = (level, context, message, detail) => {
  const rec = { ts: new Date().toISOString(), level, context, message, detail: detail ?? null };
  log.push(rec);
  if (log.length > MAX_ENTRIES) log.shift();
  if (import.meta.env.DEV) {
    const fn = level === 'error' ? console.error : console.warn;
    fn(`[${context}] ${message}`, detail ?? '');
  }
};

export const errorLog = {
  warn:  (context, message, detail) => entry('warn',  context, message, detail),
  error: (context, message, detail) => entry('error', context, message, detail),
  /** Returns a copy of the recent error log (for support/debug exports). */
  dump:  () => [...log],
  /** Returns a plain-text summary for inclusion in bug reports. */
  report: () => log.map(r => `${r.ts} [${r.level.toUpperCase()}] ${r.context}: ${r.message}${r.detail ? ' — ' + String(r.detail) : ''}`).join('\n'),
};
