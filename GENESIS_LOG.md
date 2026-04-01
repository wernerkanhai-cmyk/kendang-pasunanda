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