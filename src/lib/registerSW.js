/**
 * Register the service worker. Only runs in production builds — keeping the
 * SW out of `vite dev` avoids stale-bundle headaches during development.
 *
 * De app draait op een iPad ook vanaf het beginscherm. Zo'n venster wordt bij
 * het sluiten niet afgebroken maar bevroren: je komt terug in dezelfde pagina
 * van weken geleden en een nieuwe deploy komt nooit binnen. Daarom kijken we
 * bij elke terugkeer naar de voorgrond of er een nieuwe versie klaarstaat, en
 * herladen we één keer zodra die het overneemt.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return;

  // Bij een allereerste installatie is er nog geen controller. Die overname is
  // geen update, dus daar hoort geen herlaadbeurt bij.
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (reg) => {

        console.log('[sw] registered with scope', reg.scope);

        const checkForUpdate = () => { reg.update().catch(() => { /* offline: volgende keer weer */ }); };
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkForUpdate();
        });
        // Vangnet voor een venster dat dagenlang open blijft staan.
        setInterval(checkForUpdate, 60 * 60 * 1000);
      },
      (err) => {

        console.warn('[sw] registration failed', err);
      }
    );
  });
}
