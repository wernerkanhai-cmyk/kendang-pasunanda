"""
Generates Golden Indung app icons as PNG files.
Pure Python stdlib only — no dependencies.

Design:
  Background: #0A1128 (10, 17, 40)
  Circle ring: #FFD700 (255, 215, 0)
  Center dot:  #FFD700 (255, 215, 0)
"""
import zlib, struct, math, os

BG   = (10, 17, 40)
GOLD = (255, 215, 0)

# ── PNG writer ────────────────────────────────────────────────────────────────

def _chunk(ctype, data):
    c = ctype + data
    return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

def write_png(path, pixels, w, h):
    raw = bytearray()
    for row in pixels:
        raw.append(0)  # filter type None
        for r, g, b in row:
            raw += bytes([r, g, b])
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        f.write(_chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)))
        f.write(_chunk(b'IDAT', zlib.compress(bytes(raw), 6)))
        f.write(_chunk(b'IEND', b''))
    kb = os.path.getsize(path) // 1024
    print(f'  wrote {path}  ({w}×{h}, {kb} KB)')

# ── Anti-aliased renderer ─────────────────────────────────────────────────────

def blend(bg, fg, a):
    return (round(bg[0] + (fg[0]-bg[0])*a),
            round(bg[1] + (fg[1]-bg[1])*a),
            round(bg[2] + (fg[2]-bg[2])*a))

def render(size, circle_r, stroke_w, dot_r):
    cx = cy = (size - 1) / 2.0
    inner_r  = circle_r - stroke_w / 2
    outer_r  = circle_r + stroke_w / 2
    # Squared bounds for fast skip
    inner_sq = max(0.0, inner_r - 1.0) ** 2
    outer_sq = (outer_r + 1.0) ** 2
    dot_sq   = (dot_r + 1.0) ** 2

    pixels = []
    for y in range(size):
        row = []
        for x in range(size):
            dx = x - cx
            dy = y - cy
            d2 = dx*dx + dy*dy
            near_dot  = d2 <= dot_sq
            near_ring = inner_sq <= d2 <= outer_sq
            if near_dot or near_ring:
                dist  = math.sqrt(d2)
                dot_a = max(0.0, min(1.0, dot_r - dist + 0.5))
                ring_a = max(0.0, min(1.0, stroke_w/2 + 0.5 - abs(dist - circle_r)))
                a = max(dot_a, ring_a)
                row.append(blend(BG, GOLD, a) if a > 0 else BG)
            else:
                row.append(BG)
        pixels.append(row)
    return pixels

# ── Target sizes ──────────────────────────────────────────────────────────────
#   (output_path,            size,  circle_r, stroke_w, dot_r)
TARGETS = [
    ('public/icons/app-icon.png',           1024, 390,  12.0, 68.0),
    ('public/icons/app-icon-ios.png',        180,  68,   4.0, 12.5),
    ('public/icons/apple-touch-icon.png',    180,  68,   4.0, 12.5),
    ('public/icons/icon-192.png',            192,  73,   4.5, 13.5),
    ('public/icons/icon-512.png',            512, 195,   8.5, 36.0),
    ('public/icons/favicon.png',              32,  11,   1.5,  3.5),
]

if __name__ == '__main__':
    base = os.path.dirname(os.path.abspath(__file__))
    for rel_path, size, cr, sw, dr in TARGETS:
        full = os.path.join(base, rel_path)
        print(f'Rendering {size}×{size}...')
        pix = render(size, cr, sw, dr)
        write_png(full, pix, size, size)
    print('\nDone.')
