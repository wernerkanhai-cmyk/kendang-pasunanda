/**
 * Zet een versiestempel in dist/sw.js, ná `vite build`.
 *
 * Waarom dit bestaat: public/sw.js had een vaste versie ('kp-v3'). De naam van
 * de cache hangt aan die versie, dus bij elke deploy bleef de oude shell- en
 * packcache staan — op een iPad die de app van het beginscherm start zag je
 * daardoor nog de vorige versie. Met de commit-hash erin krijgt elke deploy
 * nieuwe cachenamen, ruimt de service worker de oude op, en ziet de browser
 * een gewijzigde sw.js (waardoor hij de update überhaupt oppikt).
 *
 * Draait automatisch mee in `npm run build`.
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const FILE = 'dist/sw.js';

function buildStamp() {
  // Vercel geeft de commit mee als env-variabele; lokaal vragen we het aan git.
  const fromCi = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromCi) return fromCi.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    // Geen git (bv. een tarball-build): dan maar de bouwdatum.
    return new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  }
}

if (!fs.existsSync(FILE)) {
  console.error(`[stamp-sw] ${FILE} bestaat niet — is \`vite build\` wel gedraaid?`);
  process.exit(1);
}

const src = fs.readFileSync(FILE, 'utf8');
const stamp = buildStamp();
const next = src.replace(/const VERSION = '[^']*';/, `const VERSION = 'kp-${stamp}';`);

if (next === src) {
  console.error('[stamp-sw] geen VERSION-regel gevonden in sw.js — stempel niet gezet.');
  process.exit(1);
}

fs.writeFileSync(FILE, next);
console.log(`[stamp-sw] service worker gestempeld als kp-${stamp}`);
