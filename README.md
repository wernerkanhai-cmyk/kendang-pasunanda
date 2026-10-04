# Kendang Pasunanda

Web-app voor het noteren, oefenen en afspelen van Soendanese kendang-ritmes.
Draait als PWA; de notatie is ritmisch (slots per tel) in plaats van op een
notenbalk, en volgt de schrijfwijze die in de Pasundan-traditie gebruikt wordt.

Live: https://kendang-pasunanda1.vercel.app

## Opzetten

```bash
npm install
cp .env.example .env.local   # vul de Supabase-waarden in
npm run dev
```

| Commando | Doet |
|---|---|
| `npm run dev` | ontwikkelserver |
| `npm run build` | productiebuild naar `dist/` |
| `npm run lint` | ESLint |
| `npm test` | unit-tests (vitest) |
| `npm run test:e2e` | Playwright; standaard tegen de live site, overschrijf met `E2E_BASE_URL` |

De ingelogde e2e-flow draait alleen met `E2E_EMAIL` en `E2E_PASSWORD` in de
omgeving; zonder die twee wordt hij overgeslagen.

## Hoe het in elkaar zit

**Packs** (`src/engine/PackRegistry.js`, manifesten in `public/packs/<id>/pack.json`)
leveren de verwisselbare onderdelen. Drie types: `instrument` (klanken en
samples), `voice` (gezongen varianten) en `notation` (het font plus de
koppeling van klank naar teken). Welke packs actief zijn onthoudt de app per
gebruiker in localStorage. `resolveUrl()` laat absolute `https://`-adressen
ongemoeid, dus een pack kan zijn assets ook extern hosten.

**Audio** draait op één AudioContext die bewust nooit opnieuw wordt aangemaakt;
zie `src/engine/SamplePlayer.js`. Dat is geen detail: herhaald sluiten en openen
zet de audio-uitvoer van het browserproces vast, en dat herstelt een refresh
niet.

**Edities** (`src/edition/entitlements.js`) bepalen wat beschikbaar is.
`performance` geeft alleen oefen-/uitvoermodus, `full` ook edit mode. De app
start altijd in practice mode — dat is een bewuste keuze, niet een beperking.

**Opslag** loopt via Supabase. Songs staan in een boom van `songs` → `patterns`
→ `song_lines` → `measures`; snippets en templates in eigen tabellen. De
afscherming per gebruiker komt volledig van RLS-policies, die niet in deze repo
staan. `docs/rls-check.sql` leest ze uit en `docs/backup-export.sql` maakt een
kopie buiten Supabase.

**PDF-export** (`src/utils/export.js`) tekent rechtstreeks op een canvas van
~212 dpi en plaatst dat als afbeelding in de PDF — geen html2canvas. Alles wat
het beeld bepaalt staat als benoemde constante bovenaan het bestand, met de
millimeters erbij: `STROKE` (lijndiktes), `BEAM_TAIL`, `NOTATIE_SCHAAL` en de
tinten voor de telmarkering.

## Werken aan de PDF-export

Wijzigingen daar zijn vrijwel altijd visuele oordelen, en op scherm beoordelen
gaat mis. Render voor en na:

```bash
npx vite --port 5174 --strictPort          # terminal 1
npm run pdf:shot -- tools/out/na.png       # terminal 2
npm run pdf:diff -- tools/out/voor.png tools/out/na.png tools/out/diff.png \
  --box 1470,222,1600,290 --schaal 9
```

`tools/pdfshot.mjs` draait de export headless en vangt het canvas op volle
resolutie af; `tools/pdfdiff.py` legt twee renders uitvergroot naast elkaar en
heeft de bruikbare uitsnedes in zijn docstring staan. Render altijd ook een
volledige regel als regressiecheck — een eerdere beam-wijziging sloopte de
balkjes in de eerste maat zonder dat de gewijzigde maat iets liet zien.

## Branches

Werk gaat op een eigen branch en wordt na een geslaagde build naar `main`
gemerged. `main` deployt rechtstreeks naar productie via Vercel; CI draait lint,
tests en build op elke push.
