# Kendang Pasunanda — v2 plan & beslissingen

> Status: levend document. Aangemaakt 2026-06-25. Beschrijft de strategie voor v2
> (uitbreiding van de bestaande app) en de architectuurbeslissingen daarachter.

## 1. Strategie: uitbreiding, geen herbouw

v2 is een **uitbreiding van de huidige webapp** (React 19 + Vite), niet een
herbouw of nieuwe stack. Daarom:

- **Eén repo** behouden — we gooien historie, CI en Vercel-deploy niet weg.
- Branch-model: `main` (productie / App Store) → `dev` (integratie) → `feat/*`
  per losse mogelijkheid.
- **`v1.0`-tag** gezet als anker: de uitgebrachte v1 is altijd terug te halen en
  te hotfixen, ook tijdens v2-werk.

Een aparte repo of "nieuwe stam" is bewust **niet** gekozen — alleen verdedigbaar
bij een wezenlijk andere stack (bv. native iOS/Swift), wat hier niet speelt.

## 2. Editions: Performance vs Full

Twee edities uit **één codebase** — géén aparte branch of repo per editie (dat
zou elke fix/feature verdubbelen). Het onderscheid is een **capability-gate**.

- **Performance**: alleen practice/performance mode. Edit mode is onbereikbaar.
- **Full**: edit mode (+ later MIDI-export/import en pro-packs).

### Architectuur (geïmplementeerd op `feat/editions`)

- `src/edition/entitlements.js` — bron van waarheid. Lost de editie op uit
  (in volgorde): URL-override `?full=1` → `localStorage['kendang.edition']` →
  build-vlag `VITE_EDITION` → default `'performance'`. Levert `caps`:
  `canEdit`, `canExportMidi`, `canUseProPacks`.
- `src/edition/EditionContext.jsx` — `EditionProvider` + `useEdition()` hook
  (zelfde provider+hook-in-één-bestand patroon als `AuthContext`/`i18n`).
- `src/main.jsx` — app gewikkeld in `<EditionProvider>`.
- `src/App.jsx` — edit-unlock (de practice-mode-toggle) staat achter `canEdit`.
  In Performance toont die plek een **"unlock Full"-upsell** (hangslot) en blijft
  `isLocked` geforceerd `true`.

### Levering / verdienmodel: één app + in-app aankoop

Gekozen model: **één app, edit mode ontgrendelen via in-app aankoop (IAP)**.

- De entitlement-**bron** is losgekoppeld van de **levering**: nu een dev-unlock,
  later een echte StoreKit-aankoop die `unlockFull()` aanroept. De rest van de
  app verandert daarbij niet.
- **Belangrijk:** echte App Store-IAP vereist een native laag (StoreKit) via een
  wrapper — een pure PWA kan dat niet zelf. Stap 2 is die koppeling; stap 1 (de
  gate + dev-unlock) staat.

### Testen zonder IAP

- `?full=1` in de URL → ontgrendelt Full (gepersisteerd in localStorage).
- `?full=0` → terug naar Performance.

## 3. Roadmap (feature-branches vanaf `dev`)

| Volgorde | Branch | Inhoud | Status |
|---|---|---|---|
| 1 | `feat/editions` | Performance/Full capability-gate | **klaar** (commit `0afdb77`) |
| 2 | `feat/ui-refresh` | slickere layout | open |
| 3 | `feat/content-packs` | fonts, sample packs, ritme-packs, onomatopee-stemmen | open |
| 4 | `feat/midi-io` | MIDI export + import (Full-only) | open |

**Sequentie-keuze:** editions eerst (fundament dat de rest respecteert), dan de
layout (zodat nieuwe features meteen in de nieuwe look komen), dan content, dan
MIDI. De layout-refresh is het hoogste risico (raakt veel UI) → eventueel achter
een feature-flag.

## 4. Content-packs bouwen op bestaande `PackRegistry`

`src/engine/PackRegistry.js` is al een volwaardig pluggable pack-systeem:
manifesten in `public/packs/<id>/pack.json` (types: instrument / voice /
notation). Nieuwe sample-/ritme-packs en onomatopee-stemmen sluiten hierop aan —
idealiter zónder code te wijzigen, alleen nieuwe manifesten. "Pro packs" kunnen
via `caps.canUseProPacks` Full-only worden gemaakt.

## 5. Werkwijze

- Lange/complexe taken in een **git-worktree** op de feature-branch
  (`git worktree add ../kendang-<naam> feat/<naam>`), zodat `main`/`dev` schoon
  en deploybaar blijven. `node_modules` wordt gedeeld (symlink).
- `main`/`dev` blijven groen; v1 blijft via de `v1.0`-tag bereikbaar.
