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
Zorg dat invoer actief is (de schakelaar in de toolbar) en druk op de toets in de tabel hierboven.

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

### Auto-kwantisering
Zet **Auto-Quantize** aan in de toolbar om live ingespeelde noten automatisch op het raster te snappen.

---

## 4. Het rooster begrijpen

Elke maat bestaat uit 4 tellen, elk tel uit 12 slots:
- **Dikke lijnen** = maatstреep
- **Dunne lijnen** = telmomenten
- **Balken boven/onder noten** = achtste- en zestiende-notenverdeling
- **Stippels (·)** = impliciete rusten (automatisch, niet invoerbaar)
- **Gong-blokken** = gele markering waar een gonginslag valt

---

## 5. Patronen en songs beheren

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

## 6. Snippets (losse patronen)

Via de **Snippet-bibliotheek** in de toolbar kun je losse gedeelten opslaan en hergebruiken:
- Selecteer een reeks cellen
- Klik **Snippet opslaan**
- Geef een naam
- Later: klik **Snippet invoegen** om het terug te plaatsen

De snippetbibliotheek kan ook worden geëxporteerd en geïmporteerd als `.kendang`-bestand.

---

## 7. Geluidsopties

### Volume per spoor
Gebruik de schuifregelaars **A** (Anak) en **I** (Indung) in de header om het volume per spoor aan te passen (0–200%).

### Geluidsinstellingen per klank
Klik in het Drum Pad op de tab **⚙️ Geluid**:
- **Volume** per klank (0–4×)
- **Toonhoogte** per klank (−12 tot +12 halve tonen)
- **Alles resetten** naar standaard

### Cursor-synchronisatie (bij Bluetooth of AirPlay)
Als het geluid vertraging heeft ten opzichte van de cursor, gebruik dan de **Cursor sync offset**-schuifregelaar (ook in de ⚙️ Geluid-tab). Schuif naar links (negatief) als het geluid te laat klinkt.

---

## 8. Vox-modus

Wissel tussen **🥁 Kendang** en **🎤 Vox** via de knop in de header. In Vox-modus:
- Worden de trommelnamen gezongen door een stem
- Verschijnt een **V**-knop in de header voor het volume van de stem
- Worden bepaalde combinaties van slagen automatisch als combo herkend (bijv. Dong + Pak = "Bang")

---

## 9. PDF exporteren

Klik op het PDF-icoon om de huidige weergave te exporteren als printbaar PDF. De notatie wordt op ware grootte weergegeven met beams, rusten en gongindicaties.

---

## 10. Zoom

Gebruik de **zoom**-schuifregelaar in de toolbar (links van de Clear-knop) om het rooster groter of kleiner te maken. De knop **↔** past de breedte automatisch aan op 4 maten.

---

## 11. Sneltoetsen

| Toets | Functie |
|-------|---------|
| Spatie | Play / Stop |
| Cmd/Ctrl + Z | Ongedaan maken |
| Cmd/Ctrl + Shift + Z | Opnieuw uitvoeren |
| Backspace / Delete | Selectie wissen |
| N, C, X, V, A, J, ;, :, L, G, F, S | Klank invoeren |

---

*Kendang Pasunanda — gebouwd voor de Sundanese kendang traditie.*
