# Kendang Pasunanda — Handleiding

Kendang Pasunanda is een webapp voor het invoeren, beluisteren en exporteren van Sundanese kendangpatronen. Je werkt met twee sporen: **Anak** (rechterhand, zwarte symbolen) en **Indung** (linkerhand, rode symbolen).

---

## 1. Het scherm

Het scherm bestaat uit drie hoofdonderdelen:

- **Links** — het Drum Pad (het ronde trommelvenster)
- **Midden** — de Patrooneditor (het notatierooster)
- **Rechts/boven** — de Song-bibliotheek en headercontroles

Het Drum Pad en de transportbalk onderin zijn versleepbaar.

---

## 2. Klanken invoeren

### Via het Drum Pad
Klik op een zone in het trommelplaatje om een klank te laten horen én in te voeren op de geselecteerde positie in het rooster.

| Drum | Zone | Symbool | Toets |
|------|------|---------|-------|
| Ketipung | Tung | N | N |
| Gedug | Dong | C | C |
| Gedug | Ting | X | ? |
| Gedug | Det | V | V |
| Kumpyang | Pling | A | A |
| Kumpyang | Pang | J | J |
| Kumpyang | Ping | ; | ; |
| Kumpyang | Pong | : | : |
| Kumpyang | Plak | L | L |
| Kutiplak | Pak | G | G |
| Kutiplak | Peung | F | F |
| Gong | — | S | S |
| Rust | . | — | . |

### Via het toetsenbord
Zorg dat invoer actief is (✏️ in de toolbar, groen = aan) en druk op de toets in de tabel hierboven.

### Via rechtsklikken
Rechtsklik (of lang indrukken op mobiel) op een cel in het rooster om een klankenmenu te openen. Kies een klank per drum.

### Slepen
Sleep een symbool van de ene cel naar de andere om een noot te verplaatsen.

### Wissen
Selecteer een cel of reeks en druk op **Backspace/Delete**, of gebruik de **Clear**-knop in de toolbar.

---

## 3. Afspelen en opnemen

### Transportbalk
De transportbalk zweeft onderin het scherm en bevat:

| Knop | Functie |
|------|---------|
| ▶ / ■ | Starten / stoppen |
| ● | Opname aan/uit |
| ⏮ | Terug naar begin |
| ◀ | Één maat terug |
| BPM | Tempo — klik om te bewerken, sleep omhoog/omlaag |

**Toetsenbord:** Spatie = Play/Stop

### Live opnemen
1. Zet opname aan (● wordt rood)
2. Druk op Play — er volgt een aftelling van 4 tellen
3. Speel via het toetsenbord of het Drum Pad
4. Druk Spatie om te stoppen

### Kwantiseren (Q-knop)
De **Q**-knop heeft twee functies afhankelijk van de staat:
- **Tijdens afspelen/opnemen**: zet Auto-Quantize aan/uit — live ingespeelde noten snappen automatisch op het raster (knop wordt groen)
- **Wanneer gestopt**: snap de huidige selectie direct naar het raster

---

## 4. De toolbar (tweede rij)

De tweede rij van de toolbar bevat (van links naar rechts):

| Knop | Functie |
|------|---------|
| zoom | Roosterzoom — sleep omhoog/omlaag of klik om te typen |
| Clear | Patroon leegmaken |
| Undo / Redo | Ongedaan maken / opnieuw |
| ☐ | Bereik selecteren |
| ⎘ / ✂ / 📋 / 🗑 | Kopiëren / knippen / plakken / wissen |
| 🎵 (metronoom) | Metronoom aan/uit en modus kiezen (4, 8, 4+play, 8+play, on) |
| ✏️ | Invoer aan/uit |
| 1/4 ▾ | Roosterresolutie kiezen (1/4 t/m 1/16T) |
| 🧲 | Magneet — cursor snabt bij klikken op de geselecteerde roosterresolutie (rood = aan) |
| Q | Kwantiseren (zie boven) |

De rij is horizontaal scrollbaar als de breedte het niet toelaat.

---

## 5. Het rooster begrijpen

Elke maat bestaat uit 4 tellen, elk tel uit 12 slots:
- **Dikke lijnen** = maatstreep
- **Dunne lijnen** = telmomenten
- **Balken boven/onder noten** = achtste- en zestiende-notenverdeling
- **Stippels (·)** = impliciete rusten (automatisch, niet invoerbaar)
- **Gong-blokken** = gele markering waar een gonginslag valt

### Magneet en cursor
Als de magneet (🧲) actief is, snabt de cursor automatisch op de geselecteerde roosterresolutie bij elke klik of aanraking. Dit maakt het makkelijker om precies op een tel of achtste noot te beginnen.

---

## 6. Patronen en songs beheren

### Patronen
Een song bestaat uit meerdere **patronen** (regelblokken). In de linker zijbalk kun je:
- Een nieuw patroon toevoegen (+)
- Een patroon dupliceren
- Patronen omhoog/omlaag verslepen
- Een patroon verwijderen

### Songs opslaan en laden
- **Opslaan**: klik op het opslaan-icoon, geef een naam en map
- **Laden**: kies een song uit de bibliotheek
- **Exporteren**: sla de song op als `.kendang`-bestand (alleen te openen in deze app)
- **Importeren**: laad een `.kendang`-bestand

---

## 7. Snippets (losse patronen)

Via de **Snippet-bibliotheek** in de toolbar kun je losse gedeelten opslaan en hergebruiken:
- Selecteer een reeks cellen
- Klik **Snippet opslaan**
- Geef een naam
- Later: klik **Snippet invoegen** om het terug te plaatsen

De snippetbibliotheek kan ook worden geëxporteerd en geïmporteerd als `.kendang`-bestand.

---

## 8. Geluidsopties

### Volume per spoor
Gebruik de schuifregelaars **A** (Anak) en **I** (Indung) in de header om het volume per spoor aan te passen (0–200%).

### Geluidsinstellingen per klank
Klik in het Drum Pad op de tab **⚙️ Geluid**:
- **Volume** per klank (standaard 3× origineel)
- **Toonhoogte** per klank (−12 tot +12 halve tonen)
- **Alles resetten** naar standaard

### Cursor-synchronisatie (bij Bluetooth of AirPlay)
Als het geluid vertraging heeft ten opzichte van de cursor, gebruik dan de **Cursor sync offset**-schuifregelaar (ook in de ⚙️ Geluid-tab). Schuif naar links (negatief) als het geluid te laat klinkt.

---

## 9. Vox-modus

Wissel tussen **🥁 Kendang** en **🎤 Vox** via de knop in de header. In Vox-modus:
- Worden de trommelnamen gezongen door een stem
- Verschijnt een **V**-knop in de header voor het volume van de stem (standaard 50%)
- Worden bepaalde combinaties van slagen automatisch als combo herkend (bijv. Dong + Pak = "Bang")

---

## 10. PDF exporteren

Klik op het PDF-icoon om de huidige weergave te exporteren als printbaar PDF. De notatie wordt op ware grootte weergegeven met beams, rusten en gongindicaties.

---

## 11. Zoom

Gebruik de **zoom**-knop in de toolbar (links van de Clear-knop) om het rooster groter of kleiner te maken. Sleep omhoog om in te zoomen, omlaag om uit te zoomen, dubbelklik om terug te zetten naar 100%.

---

## 12. Metronoom

Klik op het metronoomicoon (🎵) in de toolbar om de modus te kiezen:

| Modus | Beschrijving |
|-------|-------------|
| off | Metronoom uit |
| 4 | 4 tellen aftelling vóór opname |
| 8 | 8 tellen aftelling vóór opname |
| 4+play | 4 tellen aftelling + metronoom tijdens afspelen |
| 8+play | 8 tellen aftelling + metronoom tijdens afspelen |
| on | Metronoom altijd aan tijdens afspelen |

Het volume van de metronoom is instelbaar via het uitklapmenu. De metronoom is meteen hoorbaar als je hem aanzet terwijl de song speelt.

---

## 13. Gebruik op iPad en iPhone

De app werkt als een **Progressive Web App (PWA)**:
1. Open de app in **Safari**
2. Tik op het **Deel-icoon** (vierkant met pijl omhoog)
3. Kies **"Zet op beginscherm"**
4. Open de app daarna vanuit het beginscherm

De app start dan volledig schermvullend zonder Safari-balk, zowel op iPad als iPhone.

---

## 14. Sneltoetsen

| Toets | Functie |
|-------|---------|
| Spatie | Play / Stop |
| Cmd/Ctrl + Z | Ongedaan maken |
| Cmd/Ctrl + Shift + Z | Opnieuw uitvoeren |
| Backspace / Delete | Selectie wissen |
| N, C, X, V, A, J, ;, :, L, G, F, S | Klank invoeren |

---

*Kendang Pasunanda — gebouwd voor de Sundanese kendang traditie.*
