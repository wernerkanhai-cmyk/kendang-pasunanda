# GENESIS_LOG.md
_Communication bridge between user and Claude Code._
_Read at the start of every session. Log all progress here._

---

## Instructions
- Claude reads this file at the start of every new instruction.
- Claude logs completed work, decisions, and open questions here.
- User can leave instructions or notes here between sessions.

---

## Log

### 2026-04-01
- `GENESIS_LOG.md` created. Communication bridge established.
- **Branding assets gegenereerd** via `generate_branding.py` (pure Python, geen deps).

#### Geleverde bestanden

**ios_assets/**
| Bestand | Grootte | Gebruik |
|---|---|---|
| app_store_icon_1024.png | 1024×1024 | App Store Connect |
| app_icon_180.png | 180×180 | iPhone startscherm |
| app_icon_152.png | 152×152 | iPad startscherm |
| app_icon_167.png | 167×167 | iPad Pro startscherm |
| spotlight_icon_80.png | 80×80 | iOS Search |
| notification_icon_40.png | 40×40 | iOS Notifications |

**web_assets/**
| Bestand | Gebruik |
|---|---|
| favicon.png (32×32) | Browser tab (PNG fallback) |
| og_image_1200x630.png | Social media previews |
| logo_transparent.svg | Website header, algemeen gebruik |
| favicon.svg | Browser tab (SVG primair) |

#### Design
- 48-segment gouden ring (#FFD700) op #0A1128 achtergrond
- Solide gouden stip in het centrum
- Anti-aliased segmentovergangen
- Gouden outer glow (drop-shadow, opacity 0.4)

---

Master Prompt: Generatie van Officieel App-Icoon en Assets

Doel: Zet het '48-Slot' precisie-logo om naar technische assets voor iOS en het web.

1. Het Master Ontwerp (Vector SVG)

Achtergrond: Een perfect, diep donkerblauw vlak (#0A1128).

Het Emblem: Een perfect gecentreerde cirkel, opgebouwd uit exact 48 ragfijne segmenten, in brushed gold (#FFD700).

De Kern: In het centrum van de gesegmenteerde cirkel staat een solide, gepolijste gouden stip.

Effect: Voeg een zeer subtiele, warme gouden outer glow (drop-shadow(0 0 3px rgba(255, 215, 0, 0.4))) toe aan het gouden emblem om het "actief" te laten lijken.

2. Technische Bestandsgeneratie

Genereer de volgende bestanden en mapstructuur:

Map: ios_assets (PNG, 72dpi, square)

app_store_icon_1024.png (1024x1024 px) - Voor App Store Connect.

app_icon_180.png (180x180 px) - Voor iPhone (startscherm).

app_icon_152.png (152x152 px) - Voor iPad (startscherm).

app_icon_167.png (167x167 px) - Voor iPad Pro (startscherm).

spotlight_icon_80.png (80x80 px) - Voor iOS Search.

notification_icon_40.png (40x40 px) - Voor iOS Notifications.

Map: web_assets (PNG en SVG)

logo_transparent.svg (vector) - Voor website header.

favicon.png (32x32 px) - Voor website tab.

og_image_1200x630.png (1200x630 px) - Voor social media previews (WhatsApp, LinkedIn, etc.).

3. UX & Metadata Check

Contrast: Garandeer dat het goud contrastrijk en leesbaar blijft op alle schalen, zelfs op de 32x32 favicon.

Naamgeving: Zorg dat de bestandsnamen exact de bovenstaande conventie volgen voor eenvoudige integratie.
# GENESIS_LOG: Project Kendang Pasunanda

## Systeem Rolverdeling
- **Strategisch Architect (Gemini):** Verantwoordelijk voor de visie, culturele authenticiteit (Pasunanda-traditie), branding en high-level UX-strategie.
- **Uitvoerende Developer (Claude Code):** Verantwoordelijk voor de technische implementatie, code-optimalisatie, asset-generatie en App Store compliance binnen Antigravity.

## Status Update: App Store Readiness
We gaan nu de v1.0 van "Kendang Pasunanda: Sequencer & Solfège" finaliseren.

### Lopende Opdracht: Asset Generatie (Branding)
**Taak:** Genereer alle visuele assets gebaseerd op het '48-Slot Precisie Cirkel' logo.
- Achtergrond: `#0A1128`
- Emblem: 48-segment gouden cirkel (`#FFD700`) met centrale stip.
- Output: Volledige set `ios_assets` en `web_assets` zoals gespecificeerd in de Master Prompt.

### Volgende Stappen
1. Implementatie van de 'Ironclad Edit Lock' & Practice Mode.
2. Laatste 'Ralph Loop' stress-tests voor iOS stabiliteit.
3. Voorbereiding van de App Store metadata (Subtitel: Sequencer & Solfège).

---

### 2026-04-01 — Sessie 2

**Rolverdeling bevestigd.** Claude Code = uitvoerende developer voor Kendang Pasunanda v1.0.

**Lopende Opdracht: Asset Generatie — ✅ VOLTOOID**

Alle bestanden zijn gegenereerd, gecommit en gepusht naar `dev`:

| Map | Bestanden | Status |
|---|---|---|
| `ios_assets/` | app_store_icon_1024.png, app_icon_180.png, app_icon_152.png, app_icon_167.png, spotlight_icon_80.png, notification_icon_40.png | ✅ |
| `web_assets/` | favicon.png, og_image_1200x630.png, logo_transparent.svg, favicon.svg | ✅ |

Design: 48-segment gouden ring (#FFD700) op #0A1128, solide stip, anti-aliased, outer glow 0.4.

**Volgende stappen — ✅ ALLE DRIE VOLTOOID (2026-04-01)**

### 1. Ironclad Edit Lock ✅
`handlePaste` in PatternEditor.jsx had geen `isLocked` guard — toegevoegd.
`isLocked` toegevoegd aan de deps-array van de keyboard-handler useEffect.
Alle schrijfpaden zijn nu geblokkeerd in Practice Mode:
- handleInsertSymbol ✓ | handleNoteMove ✓ | handleClear ✓ | clearSlotWithRestFill ✓
- handleCut ✓ | handlePaste ✓ (nieuw) | handleGongFromInstrument ✓ | handleDrumTrigger ✓
- Gong-klik in TrackRow ✓ | popup (sound menu) in TrackRow ✓ | double-click slot ✓

### 2. Ralph Loop stress-tests ✅
Test 4 toegevoegd aan `stress-test.mjs`:
- **4a** 5 000 willekeurige loop-bereiken: start/end altijd op maat-grens, end > start
- **4b** Edge-cases (negatief, NaN, Infinity, omgekeerd): altijd `null`, nooit crash
- **4c** 10 000 snelle section-toggles: geen duplicaten, geen overflow
- **4d** 2 000 maat-insert/delete-operaties: loop altijd binnen patternlengte
Resultaat: **10 768/10 768 assertions geslaagd (0% crash rate)**

### 3. App Store metadata ✅
`APP_STORE_METADATA.md` aangemaakt met:
- App naam, subtitel, categorie, content rating
- Volledige beschrijving in EN, NL en ID
- Keywords, What's New, screenshot-formaten, Review Notes

*Log hieronder je voortgang zodra een taak is voltooid.*

## NIEUWE MODULE: Pasunanda "Vision" Computer Vision (CV) Engine

### Doel
Ontwikkel een gespecialiseerde PDF/Image scanner die onregelmatig getekende Pasunanda-notatie omzet naar het digitale 48-slot grid, met een onafhankelijke asynchrone analyse per regel (Anak/Indung).

### 1. Image Pre-processing & Asynchrone Segmentatie
* **Split-Lane Logic:** De scanner mag een set van twee regels (Anak boven, Indung onder) NIET als één verticaal blok behandelen.
* **Onafhankelijke Stroken:** Splits de afbeelding horizontaal in twee onafhankelijke bitmap-stroken (Anak-baan en Indung-baan).
* **Barline Anchoring:** Identificeer eerst de verticale maatstrepen (barlines) in elke strook apart. Elke ruimte tussen twee barlines wordt een 'Maat-Container'. 
* **Waarschuwing:** Vertrouw niet op verticale uitlijning tussen de twee banen; de maatstreep in de Anak-baan kan op een andere X-positie staan dan die in de Indung-baan.

### 2. Deep "Slot" Analysis & Beaming Detection
* **Inzoomen op Symbolen:** Voer een pixel-analyse uit op elk symbool binnen een Maat-Container.
* **Beaming Analyzer:** Detecteer via pixel-density checks direct BOVEN het symbool:
    - **Geen balkje:** Registreer als kwartnoot/rust (waarde 1.0).
    - **Enkel balkje:** Registreer als 1/8ste noot (waarde 0.5).
    - **Dubbel balkje:** Registreer als 1/16de noot (waarde 0.25).
* **Positie Mapping:** Map de gedetecteerde symbolen naar de relatieve positie binnen de 48 digitale slots van de betreffende maat.

### 3. Validatie: De "Som van 4" Check
* **Wiskundige Controle:** Voer voor elke onafhankelijke maat-regel de rekensom uit: $\sum (\text{waardes}) = 4.0$.
* **Error Handling:** - Indien $\sum \neq 4$: Markeer deze specifieke maat in de UI met een rood waarschuwingsicoon.
    - Toon de berekende afwijking (bijv. "Som = 3.75, verwacht 4.0").
    - Geef de gebruiker de optie voor een 'Manual Override' om balkjes handmatig aan te passen.

### 4. Debug & UI Integratie (Verification View)
* **Split-View Interface:** Bouw een verificatiescherm dat bovenin de originele uitsnede uit de PDF toont (ingezoomd) en daaronder de digitale vertaling in het sequencer-grid.
* **Database Sync:** Voeg de onafhankelijk gescande Anak en Indung data pas samen in de hoofd-songstructuur nadat de 'Som van 4' validatie succesvol is afgerond.

---
*Status: [Wacht op implementatie door Claude Code]*
-----------
## TAAK 4: Fase 2 – Symbol & Beaming Intelligence (Deep Slot Analysis)

### Doel
Het vertalen van de visuele 'inkt' binnen de Maat-Containers naar digitale muzikale data (symbolen en ritmische waarden).

### 1. Symbool Isolatie (Bounding Boxes)
* **Cluster Detectie:** Scan elke `MaatContainer` op horizontale inkt-groepen.
* **Isolatie:** Maak een bounding box om elk individueel karakter (P, p, t, D, d, 0, etc.).
* **Karakter Herkenning:** Gebruik de glyph-kenmerken van het `NeoDamina` font om de gescande vorm te matchen met de juiste drumslag.

### 2. Beaming Detector (Ritmische Waarde)
Analyseer voor elk geïsoleerd symbool de verticale ruimte direct daarboven:
* **Check 1 (1/16de):** Detecteert de engine TWEE horizontale lijnen? 
  - Toewijzing: 1/16de noot (waarde 0.25).
* **Check 2 (1/8ste):** Detecteert de engine ÉÉN horizontale lijn?
  - Toewijzing: 1/8ste noot (waarde 0.5).
* **Check 3 (Kwart/Rust):** Detecteert de engine GEEN lijn?
  - Toewijzing: Kwartnoot/Rust (waarde 1.0).
* **Gevoeligheid:** Stel de 'line-gap' threshold zo in dat twee dunne lijntjes niet als één dikke lijn worden gezien.

### 3. Slot Mapping (Het 48-Grid)
* **Projectie:** Bereken de relatieve X-positie van elk symbool binnen de breedte van de `MaatContainer`.
* **Grid-Align:** Map dit naar het dichtstbijzijnde slot in het 48-slot digitale grid.
* **Solfège Feedback:** Genereer de bijbehorende vocale klanknaam op basis van het symbool.

### 4. UI Update: Verificatie Overlay
* Toon boven elk herkend symbool in de scan een klein label: `[1/16]`, `[1/8]` of `[1/4]`.
* Markeer symbolen die niet herkend worden met een paars vraagteken voor handmatige correctie.

---
*Status: [Wacht op uitvoering van Fase 2 door Claude Code]*

----------------------

## TAAK 4: Fase 2 – Symbol & Beaming Intelligence (Deep Slot Analysis)

### Doel
Het vertalen van visuele 'inkt' naar digitale muzikale data, inclusief foutdetectie en handmatige correctiemogelijkheden.

### 1. Symbool Isolatie & Karakter Herkenning
* **Cluster Detectie:** Scan elke `MaatContainer` op horizontale inkt-groepen (bounding boxes).
* **Karakter Mapping:** Match de gescande vormen (P, p, t, D, d, 0) met de `NeoDamina` font-glyphs.
* **Failsafe:** Markeer onbekende tekens met een paars vraagteken in de 'Verification View'.

### 2. Beaming Detector (Ritmische Waarde)
Analyseer de verticale ruimte direct boven elk geïsoleerd symbool:
* **[1/16de]:** Detectie van TWEE horizontale lijnen → Waarde: 0.25.
* **[1/8ste]:** Detectie van ÉÉN horizontale lijn → Waarde: 0.5.
* **[1/4 of Rust]:** Detectie van GEEN lijn → Waarde: 1.0.
* **Thresholding:** Zorg dat de engine robuust genoeg is om handgetekende (niet kaarsrechte) lijnen te herkennen.

### 3. De "Som van 4" Visuele Feedback
* **Real-time Berekening:** Bereken continu $\sum (\text{waardes})$ per maat-regel.
* **Tekort/Overschot Indicator:** - Toon een rode 'Progress Bar' onder de maat die aangeeft hoeveel ruimte er nog over is.
    - Bijv.: "Maat 3: 3.75/4.00 (Je mist nog 0.25 tel)".
* **Kleurcodering:** De maat kleurt Groen bij exact 4.0, Rood bij een afwijking.

### 4. Manual Override UI (Gebruikers-Correctie)
* **Interactieve Overlay:** Maak elk gedetecteerd symbool klikbaar in de verificatie-view.
* **Context Menu (Pop-over):**
    - [ ] **1/4 (Kwart):** Strip alle balkjes.
    - [ ] **1/8 (Enkel):** Forceer één balkje.
    - [ ] **1/16 (Dubbel):** Forceer twee balkjes.
    - [ ] **Symbol Fix:** Wijzig het karakter handmatig via een tekstveld.
* **Instant Update:** Wijzigingen moeten direct de 'Som van 4' indicator bijwerken.

### 5. Notificatie & Logging Protocol
**Verplichte workflow voor Claude:**
1. **Status Update:** Wijzig de status in dit logboek van `[IN BEWERKING]` naar `[VOLTOOID]` inclusief ISO-tijdstempel.
2. **Technisch Log:** Voeg een korte bullet-point lijst toe van de gemaakte code-wijzigingen onder de taak.
3. **Terminal Bevestiging:** Meld in de terminal: 
   > "Gerespecteerde Architect, Fase 2 is succesvol geïmplementeerd. De Vision Engine is gevalideerd op de Ground Truth test-afbeelding. Logboek is bijgewerkt."

---
*Status: [VOLTOOID — 2026-04-02T00:00:00Z]*

### Technisch Log — Fase 2 implementatie
- `src/cv/splitLanes.js`: `separateByColor()` toegevoegd — zwart→anak, rood→indung via kleurclassificatie; `analyseLanes()` gebruikt nu kleur i.p.v. ruimtelijke splitslijn; `detectSystems()` stabiel voor multi-rij afbeeldingen
- `src/cv/beamingDetector.js`: `BEAM_VALUE` map geëxporteerd voor hergebruik in UI
- `src/components/CVScanner.jsx`: `SomBar` progress component (groen=4.0, oranje=tekort, rood=overschot); Manual Override via klikbare badges (1/4→1/8→1/16 cycle); override-state per symbool; systeem-selector voor multi-rij afbeeldingen
- `src/components/CVScanner.css`: `cv-maten-list`, `cv-maat-card`, `cv-som-bar`, `cv-beam-clickable` stijlen toegevoegd
------------------------
# TAAK 4 (RESET): De "Simple-Scan" Workflow

## 1. Concept: De Gebruiker is de Eindredacteur
* **Geen Black Box:** Stop met het automatisch 'raden' en direct op de tijdlijn plaatsen.
* **Flow:** PDF/Upload -> Selectie-Kader -> Preview Tabel -> Correctie -> Opslaan.

## 2. Fase A: De Interactieve Viewer (Input)
* **Full Page View:** Toon de volledige PDF-pagina of Scan in hoge resolutie.
* **Marquee Tool:** Gebruiker trekt een blauwe stippellijn om het te scannen blok.
* **No-Filters:** Gebruik de originele pixels voor weergave, geen destructieve zwart-wit filters.

## 3. Fase B: De Analyse-Tabel (Edit Mode)
* **Directe Feedback:** Na selectie verschijnt een tabel met 4 rijen:
    1. Anak - Boven (LH)
    2. Anak - Onder (RH)
    3. Indung - Boven (LH)
    4. Indung - Onder (RH)
* **Input Velden:** Elk gedetecteerd symbool wordt een cel in de tabel.
* **Symbol Picker:** Klik op een cel opent een simpel menu (P, p, t, D, d, 0, ., -) of laat directe toetsenbord-invoer toe.
* **Verticale Sync:** Zorg dat de visuele uitlijning tussen de 4 rijen in de tabel klopt met de werkelijkheid.

## 4. Fase C: Validatie & Output
* **Real-time Som:** Onder elke rij staat de $\sum$ (moet 4.0 zijn).
* **Save Options:** Pas na 'Akkoord' van de gebruiker verschijnen de opties:
    - [Opslaan als Nieuwe Song]
    - [Invoegen in Song X bij Maat Y]
    - [Sla op als Snippet]

---
*Status: [VOLTOOID — 2026-04-03] · commit `cd0dcb0` op branch `dev`*

### Technisch Log — TAAK 4 RESET implementatie
- **`src/components/CVScanner.jsx`** volledig herschreven (~430 regels, was ~1700):
  - Fase-machine: `null → viewer → table`
  - `SelectionCanvas`: toont originele pagina (GEEN zwart-wit); blauwe marching-ants kader tijdens tekenen + na release; `image-rendering: auto`
  - `ScanPreview`: originele crop-afbeelding als achtergrond; gekleurde bbox-overlays per rij (Anak↑/↓ blauw/oranje, Indung↑/↓ roze/rood)
  - `AnalysisTable`: 4 vaste rijen (Anak LH/RH, Indung LH/RH); bewerkbare cellen met ritmische-waarde knoppen (¼/⅛/¹⁄₁₆) + char-invoer + symbool-picker (13 Pasunanda-symbolen); som-balk per rij; opslaan vergrendeld tot alle Σ = 4.00
- **`src/components/CVScanner.css`** volledig herschreven: `cv2-` prefix, ~330 regels; geen `image-rendering: pixelated` meer
- **`src/cv/splitLanes.js`**: `rawStrip` verwijderd (niet meer nodig in nieuwe architectuur); `isRedPixel`-fix blijft (`r > g+30 && r > b+30`)
------------------
### 5. Tabel-Interactiviteit & Mapping
* **Direct Edit:** Elke 'cel' in de tabel moet een tekstveld zijn. Als ik erin klik en 'P' typ, moet de cel 'P' worden en de waarde 1.0 krijgen (tenzij een balkje erboven is gedetecteerd).
* **Grid-Alignment:** Verdeel de geselecteerde strook in 4 gelijke horizontale segmenten (maten). Zorg dat de cellen in de tabel visueel corresponderen met die kwarten.
* **Sync met Afbeelding:** Als ik over een cel in de tabel zweef (hover), moet in de bovenstaande afbeelding het bijbehorende gebied oplichten.

### 6. De "Eerste Gok" Logica (Seed Analysis)
* Laat Claude een simpele OCR (karakterherkenning) doen op de 4 banen.
* Vul de tabelcellen in met wat hij denkt te zien. 
* Alles wat hij niet herkent, laat hij LEEG (of een `?`), zodat ik het zelf kan invullen.
-------------------
### 7. OCR & Symbol Mapping (De "First Pass")
* **Trigger:** Zodra een selectie is gemaakt en de Analysetabel opent, MOET de engine een automatische scan uitvoeren.
* **Pixel-to-Cell Mapping:** - Deel elke baan horizontaal op in tijd-slots (gebaseerd op de gemiddelde symboolbreedte).
    - Voer karakterherkenning uit op elk slot.
    - Plaats de herkende letter (P, p, t, D, d, ., -) direct in de cel.
* **Beaming Detection:** Als er een horizontale lijn boven het symbool staat, activeer dan automatisch de `1/8` of `1/16` badge van die cel.
* **Placeholder:** Als de AI niets herkent, zet een `?`. De gebruiker vult dit aan.
----------------------
## TAAK 13: Touch-Friendly Symbol Picker (iPad/iPhone Ready)

### 1. Pop-up Selector
* **Trigger:** Bij het klikken of tikken op een cel in de analysetabel opent een overlay (pop-over).
* **Grid Layout:** Toon een raster van iconen/knoppen met de Kendang-glyphs:
    - **Slagen:** P, p, t, D, d, ø, +
    - **Rusten/Verlenging:** . (stip), - (streep)
    - **Speciaal:** 0 (leeg/wissen)

### 2. Visuele Koppeling (Preview)
* Toon in de pop-up ook een kleine uitvergroting van de originele inkt uit de scan voor die specifieke cel, zodat de gebruiker direct kan vergelijken.

### 3. Ritmische Snelkeuze
* Voeg in dezelfde pop-up drie grote knoppen toe voor de waarde: **[1/4] [1/8] [1/16]**.
* Dit vervangt de kleine badges en maakt het 'duim-vriendelijk'.
--------
### 8. Maat-Isolatie & 16-Tellen Grid
* **Harde Begrenzing:** Elke maat (kolom in de tabel) heeft een capaciteit van exact 4.0 tellen.
* **Overloop-Preventie:** Zodra de som van 4.0 is bereikt binnen een visueel blok, mag de engine geen extra symbolen meer toevoegen aan die maat. Overtollige inkt moet worden toegewezen aan de volgende maat of gemarkeerd worden als ruis.
* **Systeem-Totaal:** Een volledige regel (4 maten) moet altijd resulteren in een totaal van 16.0 tellen per hand (4 + 4 + 4 + 4).
* **Visuele Splitsing:** Zorg dat de tabel in de UI ook fysiek verdeeld is in 4 duidelijke blokken van 4 tellen, zodat je ziet waar de ene maat eindigt en de volgende begint.

### 9. 4x4 Grid UI Layout (Maat-Groepering)
* **Visuele Groepen:** Verdeel de Analysetabel in 4 duidelijke kolommen (Maten).
* **Spacing:** Voeg een extra brede marge (gutter) toe tussen Maat 1, 2, 3 en 4 om de maatstrepen te simuleren.
* **Maat-Labels:** Zet boven elk blok een label: "Maat 1", "Maat 2", etc.
* **Subtotalen:** Toon onder ELK blok de som van die specifieke maat (moet 4.0 zijn). De kleur van het getal verandert:
    - Rood: < 4.0 of > 4.0
    - Groen: Exact 4.0
* **Totaal-Check:** Toon aan het einde van de regel de "Systeem Som" (Totaal van de 4 maten, max 16.0).
----------------

## TAAK 14: Layered Validation (Ritme Eerst, Inhoud Later)

### 1. Fase 1: Ritmische Scan (De 'Containers')
* **Detectie:** Scan de geselecteerde strook uitsluitend op horizontale balkjes boven/onder de inkt.
* **Kleurgecodeerde Blokken:** Teken direct over de PDF/Scan heen:
    - GEEL kader om elke gedetecteerde 1/4 eenheid.
    - BLAUW kader om elke gedetecteerde 1/8 eenheid.
    - PAARS kader om elke gedetecteerde 1/16 eenheid.
* **Validatie:** De gebruiker moet eerst dit kleurenpatroon goedkeuren. Klikken op een blok verandert de kleur (en dus de waarde).
* **Som-Check:** De som van de kleuren in een maat MOET 4.0 zijn voordat Fase 2 start.

### 2. Fase 2: Symbolische Invulling (De 'Inhoud')
* **Focus:** Pas na ritmisch akkoord start de karakterherkenning binnen de gekleurde kaders.
* **Drop-down Mapping:** Elk gekleurd blok krijgt een drop-down menu met de Kendang-symbolen (P, p, t, D, d, ., -).
* **Visual Match:** De drop-down toont de originele inkt uit dat specifieke blokje als referentie.


-------------------

# TAAK 4 (MASTER RESET): Layered Music Vision System

## 1. Concept: De Ritmische Fundering
* **Focus:** Scheid 'Tijd' van 'Inhoud'. De AI herkent eerst het ritmische raster voordat hij naar de drumslagen kijkt.
* **Filter:** Negeer alle tekstuele ruis (titels zoals 'Mincid', 'Pangkat', paginanummers). Concentreer uitsluitend op de zone tussen de verticale maatlijnen.

## 2. Fase 1: Ritmische Analyse (Kleurcodes)
* **Detectie:** Scan op horizontale balkjes (beaming) binnen de maatlijnen.
* **Visuele Overlays (Marching Ants/Gekleurde Blokken):**
    - **GEEL Kader:** 1/4 Noot (waarde 1.0) - Geen balkjes gedetecteerd.
    - **BLAUW Kader:** 1/8 Noot (waarde 0.5) - Eén balkje gedetecteerd.
    - **PAARS Kader:** 1/16 Noot (waarde 0.25) - Twee balkjes gedetecteerd.
* **Interactie:** Gebruiker klikt op een kleurblok om de waarde handmatig te corrigeren. 
* **Validatie:** Een maat is pas 'klaar' als de som van de gekleurde blokken exact 4.0 is.

## 3. Fase 2: Symbolische Invulling (Inhoud)
* **Trigger:** Pas na ritmisch akkoord start de karakterherkenning *binnen* de gekleurde kaders.
* **Smart Drop-down:** Elk kader krijgt een menu met de Kendang-glyphs (P, p, t, D, d, ., -, ø, +).
* **Mobile First:** Grote knoppen voor iPad/iPhone gebruik. De drop-down toont de originele inkt als referentie.

## 4. Output & Integratie
* **Maat-Isolatie:** Maat 1 t/m 4 vormen samen één systeem van 16 tellen.
* **Commit:** Na volledige validatie (alle maten groen), optie tot:
    - [Opslaan als Nieuwe Song]
    - [Invoegen in bestaande song op positie X]
    - [Sla op als Snippet]

---
*Status: [HERSTART] - Implementeer dit gelaagde systeem. Gebruik de originele PDF-pixels voor de overlays.*
----------------
## TAAK 16: Handmatige Segmentatie & Symbool-Splitsing

### 1. "Vierkantje Toevoegen" (The Manual Box)
* **Tool:** Voeg een knop `[+ Blok Toevoegen]` toe aan elke maat in de tabel.
* **Functie:** Hiermee plaatst de gebruiker handmatig een nieuw leeg ritmisch blokje (default 1/4) in de maat.
* **Drag & Drop:** De gebruiker kan de volgorde van blokjes binnen een maat verslepen om de timing te corrigeren.

### 2. Symbool-Splitsing (De "Rust" Fix)
* **Probleem:** AI ziet 'P .' als één symbool.
* **Oplossing:** Voeg een 'Splits' icoontje toe tussen symbolen in een blokje. 
* **Actie:** Klikken op splitsen maakt van één blokje twee aparte blokjes (bijv. van een 1/4 blok naar twee 1/8 blokjes).

### 3. Individuele Symbool-Correctie
* Elke letter binnen een blokje moet een eigen **Drop-down** hebben. 
* Als er een rust (`.`) naast een `P` staat, moet je die onafhankelijk van elkaar kunnen wijzigen in het menu.
---------------------
### 1. Fase 1: Transparante Ritmische Analyse (Highlight, geen Overlay)
* **Visual Style (Cruciaal):** Stop met het tekenen van ondoorzichtige gekleurde blokken OVER de scan. 
* **Oplossing:** Gebruik een **subtiele, gekleurde 'Glow' of een dunne, gekleurde outline** die zich *onder* of *om* de zwarte inkt bevindt. De inkt zelf (de noot) moet altijd 100% zichtbaar en scherp blijven.
* **Kleurcodering (Blijft gelijk):** - Geel: 1/4 noot.
    - Blauw: 1/8 noot.
    - Paars: 1/16 noot.
* **Interactie (Huidige Prompt):** Tikken op een symbool in de scan (de inkt) moet de 'Glow' direct activeren, de gekleurde kaders verbergen voor dat symbool, en de pop-up picker openen.


## TAAK 16: Handmatige Invoer, Splitsen & Behandelings-Status

### 1. De "Ghost Box" Creator (Manual Boxes)
* **Vrije Creatie op de Scan:** Maak het mogelijk om met de muis (of vinger op iPad) een kader te trekken over een symbool in de scan dat de AI *niet* heeft herkend.
* **Gekleurde Overlay:** Zodra het kader is getrokken, krijgt het een **Gouden** (of Felle Blauwe) outline om aan te geven: "Dit is een handmatige invoer".
* **Direct Mapping:** Dit nieuwe kader wordt onmiddellijk toegevoegd aan de Analysetabel in de juiste Maat/Hand-positie.

### 2. Splits-Tool (De "P ." Fix)
* **Probleem:** AI ziet 'P .' als één symbool.
* **Oplossing:** Voeg een 'Splits' of 'Knip' icoontje toe in de Symbol Picker pop-up.
* **Actie:** Klikken op 'Splitsen' verdeelt het huidige 1/4 blok in twee aparte 1/8 blokjes, elk met een eigen Symbol Picker.

### 3. Behandelings-Status (Visuele Check)
* **Status-Outline:** Elk gedetecteerd of handmatig ingevoerd blokje krijgt een visuele status op de scan:
    - **Fel Gekleurd (Geel/Blauw/Paars):** Geactiveerd, maar nog niet door de gebruiker bevestigd.
    - **Gouden Glow:** Handmatig ingevoerd of door de gebruiker bevestigd.
    - **Grijze Glow:** Al behandeld door de gebruiker (klaar voor export).
* **Doel:** De gebruiker moet alle noten "grijs" of "goud" maken voordat de som van 4.0 kan worden goedgekeurd.

## TAAK 18: Infinite Selection & Auto-Scroll

### 1. Auto-Scroll tijdens Selectie
* **Trigger:** Wanneer de gebruiker een selectie-kader trekt (`onMouseMove` met muisknop ingedrukt) en de cursor binnen een marge van 50px van de boven- of onderkant van de viewport komt.
* **Actie:** Scroll de container automatisch omhoog of omlaag met een versnellende snelheid (hoe dichter bij de rand, hoe sneller).
* **Boundary Check:** Zorg dat het kader correct wordt berekend op basis van de *absolute* coördinaten van de pagina, niet alleen de *zichtbare* coördinaten.
--------------------

### 2. Zoom & Pan Controls
* Voeg een `[+]` en `[-]` knop toe om de hele A4-pagina te schalen, zodat de gebruiker ook de volledige pagina in één keer in beeld kan brengen voor grote selecties.
* Gebruik `spacebar + drag` om over de pagina te pannen zonder een selectie te starten.
-------------
## TAAK 19: High-Speed OCR & Template Matching
* **Template Library:** Geef Claude een referentie-set van hoe een 'P', 'p', 't' en 'D' eruit zien in jouw specifieke handschrift/scan.
* **Line-Follower:** De AI moet de horizontale lijnen van de balk (de 'notenbalk') gebruiken als anker. Symbolen die niet OP of direct ONDER die lijn staan, zijn ruis.
* **Batch-Herkenning:** In plaats van noot-voor-noot, moet de AI de hele regel in één keer analyseren op basis van de afgesproken ritmische kleuren (Geel/Blauw/Paars).
--------------------
## TAAK 23: De "Gamelan-Groepen" Methode (Definitieve Koers)

### 1. Primaire Logica: Groep is Tijd
* **Balkjes-Focus:** De AI zoekt eerst naar horizontale lijnen (balkjes) boven de inkt.
* **De Container:** Alles onder één balkje vormt één 'Ritmische Groep' (waarde = 1.0 tel).
* **Geen Balkje:** Een losstaand symbool zonder lijn erboven is ook een groep (waarde = 1.0 tel).
* **De Som:** Een maat is pas correct als er exact 4 van deze groepen (totaal 4.0) tussen de maatlijnen staan.

### 2. Secundaire Logica: Granulaire Inhoud
* **Slots binnen Groep:** Binnen een 1/8 groep (blauw) zitten 2 slots. Binnen een 1/16 groep (paars) zitten 4 slots.
* **Onafhankelijke Edit:** Elk slot moet apart herkenbaar en aanklikbaar zijn op de scan en in de tabel.
* **Correctie:** Typen in een slot verandert alleen de letter (P, p, t, D, .), NOOIT de ritmische waarde van de groep.

### 3. Visuele Controle
* **Scan-Highlight:** Als ik een slot in de tabel selecteer, licht exact dat deel van de inkt op de scan op.
* **Transparantie:** Bij selectie verdwijnt de kleur-overlay van dat symbool zodat de inkt 100% zichtbaar is voor controle.
-----------------
## TAAK 24: De Horizontale Scanline (Chronologische Herkenning)

### 1. Lineaire Detectie
* **Scan-richting:** Loop per hand-lijn (Anak L/R, Indung L/R) van links naar rechts tussen de maatstrepen.
* **Chronologie:** Elk symbool dat je tegenkomt MOET in chronologische volgorde in de tabel verschijnen. Geen overgeslagen inkt, geen "zwevende" blokjes.
* **Anker-Principe:** Het eerste wat je links tegenkomt is Noot 1. Het volgende is Noot 2. 

### 2. Ritmische Groep-Binding
* **Binding:** Als je een horizontaal balkje ziet, "zuig" je alle inkt die daaronder staat in één container (1/8 of 1/16).
* **Vrije Slagen:** Alles zonder balkje krijgt zijn eigen 1/4 (Geel) slot.

### 3. De "Altijd 4" Garantie
* Als de som aan het einde van de maat geen 4.0 is, vult de AI de rest van de maat aan met "Ghost" (lege) kwartnoten. 
* De gebruiker hoeft nooit gaten op te vullen; de AI biedt altijd een structuur van 4 tellen aan.

## TAAK 25: Dot-Aware Detectie (Rusten & Verlengingen)

### 1. De Kleine Object Focus
* **Prioriteit:** Kleine puntjes (`.`) of korte streepjes (`-`) die horizontaal uitgelijnd zijn met de grotere letters (P, t, D) MOETEN herkend worden als geldige symbolen.
* **Geen Ruis-Filter:** Stop met het automatisch negeren van kleine pixel-clusters. Als het op de muzieklijn staat, is het een noot of een rust.

### 2. Contextuele Analyse (Balk-Relatie)
* Als een puntje onder een horizontaal balkje staat, is het ALTIJD een onderdeel van een 1/8 of 1/16 groep.
* Als een puntje los staat, is het een 1/4 (Geel) symbool.

### 3. "Minimum Occupancy" Wet
* Elke maat heeft 4 tellen. Als de AI na de eerste scan maar op 2/4 uitkomt, moet hij agressiever zoeken in de 'lege ruimtes' naar gemiste puntjes of lichte inkt.