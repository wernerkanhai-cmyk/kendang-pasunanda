/**
 * Rendert de PDF-export headless en schrijft het canvas weg als PNG.
 *
 * Waarom dit bestaat: vrijwel elke wijziging aan src/utils/export.js is een
 * visueel oordeel — lijndikte, afstand tot de maatstreep, hoe ver een beam
 * doorloopt. Blind aanpassen gaat mis. Met dit script render je voor én na en
 * leg je ze naast elkaar (zie tools/pdfdiff.py).
 *
 * Gebruik:
 *   1) npx vite --port 5174 --strictPort        # in een tweede terminal
 *   2) node tools/pdfshot.mjs tools/out/na.png
 *
 * Voor een "voor"-plaatje: zet je wijziging even weg met `git stash`, render
 * opnieuw naar een andere bestandsnaam, en haal 'm terug met `git stash pop`.
 *
 * De truc zit in stap 3 hieronder: we onderscheppen canvas.toDataURL() in
 * plaats van de PDF op te vangen. Dat levert het canvas op volle resolutie
 * (1754x2480, ~212 dpi). Via de PDF werkt niet bruikbaar — de rasteraars op
 * macOS geven 72 dpi terug en daarmee is 0,3 mm niet te beoordelen.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.PDFSHOT_BASE || 'http://localhost:5174';
const OUT  = process.argv[2];

// Extra export-instellingen als JSON, bijvoorbeeld om een optie aan te zetten:
//   PDFSHOT_SETTINGS='{"beatShading":true}' node tools/pdfshot.mjs out.png
let EXTRA = {};
if (process.env.PDFSHOT_SETTINGS) {
  try {
    EXTRA = JSON.parse(process.env.PDFSHOT_SETTINGS);
  } catch (err) {
    console.error(`PDFSHOT_SETTINGS is geen geldige JSON: ${err.message}`);
    process.exit(1);
  }
}

if (!OUT) {
  console.error('Gebruik: node tools/pdfshot.mjs <uitvoer.png>');
  process.exit(1);
}

// De notatiepack-gegevens staan normaal in public/packs/neodamina-werner/pack.json
// en worden runtime door de app geladen. Hier geven we ze direct mee, zodat het
// script geen ingelogde sessie nodig heeft.
const PACK = {
  id: 'neodamina-werner',
  font: { family: 'Kendang', url: 'fonts/NeoDamina Werner edit.ttf' },
  restGlyph: '.',
  soundToGlyph: {
    tung: 'N', dong: 'C', ting: '?', det: 'V', dededet: 'S', pling: 'A',
    pang: 'J', ping: ';', pong: ':', plak: 'L', pak: 'G', peung: 'F',
  },
};

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.error('  [browser]', m.text()); });
await page.goto(BASE, { waitUntil: 'domcontentloaded' });

const b64 = await page.evaluate(async ({ pack, extra }) => {
  // 1. Notatiefont injecteren. De app doet dit normaal via de PackRegistry;
  //    zonder deze stap rendert het canvas blokjes in plaats van glyphs.
  const ff = new FontFace(pack.font.family, `url("/${pack.font.url}")`);
  await ff.load();
  document.fonts.add(ff);

  // 2. De export opent een previewvenster en start anders een download —
  //    allebei onbruikbaar headless.
  window.open = () => null;
  const origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {};

  // 3. Het canvas op volle resolutie afvangen (zie kop van dit bestand).
  let pagePng = null;
  const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function (...a) {
    const d = origToDataURL.apply(this, a);
    if (!pagePng) pagePng = d;   // alleen de eerste pagina
    return d;
  };

  // 4. Testregel die de lastige gevallen dekt. Pas dit aan als je iets anders
  //    wilt beoordelen; houd de bestaande gevallen erin als regressiecheck.
  const N = 192; // 4 maten van 48 slots
  const empty = () => Array.from({ length: N }, (_, i) => ({ top: '', bottom: i % 12 === 0 ? '.' : '' }));
  const put = (arr, idx, hand, sound) => { arr[idx] = { ...arr[idx], [hand]: sound }; };

  const anak = empty(), indung = empty();
  // maat 1 — achtsten, beide handen
  for (let i = 0; i < 48; i += 6) put(anak, i, i % 12 === 0 ? 'bottom' : 'top', i % 12 === 0 ? 'dong' : 'pak');
  // maat 2 — zestienden, levert beams op twee niveaus
  for (let i = 48; i < 96; i += 3) put(anak, i, i % 6 === 0 ? 'bottom' : 'top', i % 6 === 0 ? 'tung' : 'ping');
  // maat 3 — 8T-triolen; de onderhand blijft leeg, dus die krijgt kwartrust-stippen
  for (let t = 96; t < 144; t += 12) for (const o of [0, 4, 8]) put(anak, t + o, 'top', 'pak');
  // maat 4 — ijl. Tel 3 (slots 168-179) heeft BEWUST maar één slag, op positie 9.
  // Dat geval brak het vaakst: twee rustregels vuurden er, en de beams liepen
  // er ruim voorbij.
  put(anak, 144, 'bottom', 'dong');
  put(anak, 162, 'top', 'plak');
  put(anak, 177, 'top', 'pak');
  put(anak, 180, 'bottom', 'det');
  // indung — rustiger onderlaag
  for (let i = 0; i < N; i += 12) put(indung, i, 'bottom', i % 48 === 0 ? 'dong' : 'tung');
  for (let i = 54; i < 96; i += 6) put(indung, i, 'top', 'pang');

  const song = [{
    id: 'p1',
    name: 'Testregel — lijndikte, beams en rusten',
    anak, indung,
    gong: [0, 96],
    tempoTrack: [], tempoTrackEnabled: false,
    annotations: { 0: 'bukaan', 2: 'triolen' },
  }];

  const mod = await import('/src/utils/export.js');
  await mod.exportSequencerToPDF(song, 'Proefpagina', { notationPack: pack, ...extra });

  HTMLAnchorElement.prototype.click = origClick;
  HTMLCanvasElement.prototype.toDataURL = origToDataURL;
  if (!pagePng) throw new Error('geen canvas afgevangen — is exportSequencerToPDF gewijzigd?');
  return pagePng.split(',')[1];
}, { pack: PACK, extra: EXTRA });

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.from(b64, 'base64'));
console.log(`geschreven: ${OUT} (${fs.statSync(OUT).size} bytes)`);
await browser.close();
