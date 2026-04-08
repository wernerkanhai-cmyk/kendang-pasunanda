/**
 * Register the service worker. Only runs in production builds — keeping the
 * SW out of `vite dev` avoids stale-bundle headaches during development.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (reg) => {
        // eslint-disable-next-line no-console
        console.log('[sw] registered with scope', reg.scope);
      },
      (err) => {
        // eslint-disable-next-line no-console
        console.warn('[sw] registration failed', err);
      }
    );
  });
}
