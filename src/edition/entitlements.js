/**
 * entitlements — bron van waarheid voor de app-editie (Performance vs Full).
 *
 * Dit is bewust losgekoppeld van HOE een Full-licentie verkregen wordt. Nu komt
 * de editie uit een dev-/test-bron; later voedt een echte StoreKit in-app
 * aankoop dezelfde localStorage-sleutel ('kendang.edition') en verandert er aan
 * de rest van de app niets.
 *
 * Editions:
 *   'performance'  → alleen practice/performance mode (edit mode niet bereikbaar)
 *   'full'         → edit mode + (later) MIDI-export/import en pro-packs
 */

export const EDITIONS = ['performance', 'full'];
const STORAGE_KEY = 'kendang.edition';

/** Veilige localStorage-helpers (kan ontbreken in private mode / SSR). */
const readStored = () => {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
};
const writeStored = (edition) => {
  try { localStorage.setItem(STORAGE_KEY, edition); } catch { /* genegeerd */ }
};

/**
 * Bepaal de huidige editie. Prioriteit:
 *   1. URL-override (?full=1 / ?edition=full)  — dev/test, wordt gepersisteerd
 *   2. Gepersisteerde waarde in localStorage    — dev-unlock of (later) StoreKit
 *   3. Build-time vlag VITE_EDITION             — voor aparte builds, indien ooit
 *   4. Default: 'performance'                   — veilige, vergrendelde standaard
 */
export const resolveEdition = () => {
  // 1. URL-override (handig om Full te testen zonder IAP).
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('full')) {
      writeStored(params.get('full') === '0' ? 'performance' : 'full');
    } else if (params.has('edition') && EDITIONS.includes(params.get('edition'))) {
      writeStored(params.get('edition'));
    }
  } catch { /* geen window */ }

  // 2. Gepersisteerde editie.
  const stored = readStored();
  if (EDITIONS.includes(stored)) return stored;

  // 3. Build-time editie (alleen relevant bij aparte builds).
  const build = import.meta.env?.VITE_EDITION;
  if (EDITIONS.includes(build)) return build;

  // 4. Default.
  return 'performance';
};

/** Persisteer een editie (gebruikt door de upsell/dev-unlock; later door StoreKit). */
export const persistEdition = (edition) => {
  if (EDITIONS.includes(edition)) writeStored(edition);
};

/**
 * Capabilities die uit een editie volgen. Eén plek — overal in de app
 * gebruik je `caps.canEdit` etc., nooit de ruwe editie-string.
 */
export const capsFor = (edition) => {
  const full = edition === 'full';
  return {
    edition,
    canEdit: true,        // SLOT TIJDELIJK ERAF — edit mode altijd bereikbaar. Zet terug op `full` om weer te vergrendelen.
    canExportMidi: full,  // toekomstig: MIDI import/export
    canUseProPacks: full, // toekomstig: pro sample-/ritme-packs
  };
};
