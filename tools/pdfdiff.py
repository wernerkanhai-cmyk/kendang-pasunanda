#!/usr/bin/env python3
"""
Legt twee renders van tools/pdfshot.mjs naast elkaar, uitvergroot.

Waarom uitvergroten: de canvas is ~212 dpi, dus een verschil van 2 px is op ware
grootte nauwelijks te zien terwijl het op papier wel degelijk telt. Op 6-9x met
NEAREST (geen interpolatie) zie je exact welke pixels veranderd zijn.

Gebruik:
    python3 tools/pdfdiff.py voor.png na.png uit.png --box 1470,222,1600,290 --schaal 9

--box is de uitsnede in canvas-pixels: links,boven,rechts,onder. Laat je 'm weg,
dan krijg je de hele pagina verkleind — handig als regressiecheck.

Handige uitsnedes (bij de standaard testregel in pdfshot.mjs):
    hele eerste regel   55,220,1700,300    schaal 2
    maat 2, zestienden  462,222,582,285    schaal 9
    maat 3, triolen     872,222,992,285    schaal 9
    maat 4, losse 16e   1470,222,1600,290  schaal 9

Let op: beams staan BOVEN de glyphs, rond y = 234. Een uitsnede die op 240
begint mist ze — dat kostte me een ronde.

Vereist Pillow (pip install pillow).
"""
import argparse
from PIL import Image, ImageDraw

p = argparse.ArgumentParser()
p.add_argument("voor"); p.add_argument("na"); p.add_argument("uit")
p.add_argument("--box", help="links,boven,rechts,onder in canvas-pixels")
p.add_argument("--schaal", type=int, default=6)
p.add_argument("--labels", default="VOOR|NA",
               help="twee labels gescheiden door | (niet door een komma: die komt "
                    "in getallen als '1,35' voor)")
a = p.parse_args()

box = tuple(int(v) for v in a.box.split(",")) if a.box else None

# Te weinig labels mag nooit stilletjes een afbeelding laten vallen — zip() zou
# dan afkappen op de kortste lijst en je kreeg een halve vergelijking terug
# zonder waarschuwing.
labels = a.labels.split("|")
paden = (a.voor, a.na)
if len(labels) < len(paden):
    labels += [f"#{i + 1}" for i in range(len(labels), len(paden))]
LAB = 28

beelden = []
for pad, label in zip(paden, labels):
    im = Image.open(pad).convert("RGB")
    if box:
        im = im.crop(box)
        im = im.resize((im.width * a.schaal, im.height * a.schaal), Image.NEAREST)
    else:
        im.thumbnail((700, 1000), Image.LANCZOS)
    beelden.append((label, im))

w, h = beelden[0][1].size
uit = Image.new("RGB", (w, (h + LAB) * 2 + 8), "white")
d = ImageDraw.Draw(uit)
y = 0
for label, im in beelden:
    d.rectangle([0, y, w, y + LAB], fill="#1e293b")
    d.text((8, y + 8), label, fill="white")
    uit.paste(im, (0, y + LAB))
    y += h + LAB + 8
uit.save(a.uit)
print(f"geschreven: {a.uit} ({uit.width}x{uit.height})")
