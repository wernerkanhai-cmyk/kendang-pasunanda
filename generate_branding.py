"""
Golden Indung branding generator — 48-segment ring design.
Outputs ios_assets/ and web_assets/ in the project root.
Pure Python stdlib, no dependencies.

Design spec:
  Background : #0A1128  (10, 17, 40)
  Gold       : #FFD700  (255, 215, 0)
  Ring       : 48 equal segments (80% fill / 20% gap), anti-aliased
  Glow       : warm gold outer glow (drop-shadow, GLOW_INTENSITY=0.4)
  Centre dot : solid gold fill
"""
import zlib, struct, math, os

BG   = (10, 17, 40)
GOLD = (255, 215, 0)

N_SEGS         = 48
SEG_DEG        = 360.0 / N_SEGS   # 7.5°
FILL_RATIO     = 0.80              # 6.0° fill, 1.5° gap
AA_DEG         = 0.6               # angular anti-alias width
GLOW_INTENSITY = 0.4

BASE = os.path.dirname(os.path.abspath(__file__))
IOS  = os.path.join(BASE, 'ios_assets')
WEB  = os.path.join(BASE, 'web_assets')


# ── PNG helpers ───────────────────────────────────────────────────────────────

def _chunk(tag, data):
    c = tag + data
    return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

def write_png(path, pixels, w, h):
    raw = bytearray()
    for row in pixels:
        raw.append(0)
        for r, g, b in row:
            raw += bytes([r, g, b])
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        f.write(_chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)))
        f.write(_chunk(b'IDAT', zlib.compress(bytes(raw), 6)))
        f.write(_chunk(b'IEND', b''))
    kb = os.path.getsize(path) // 1024 or '<1'
    print(f'  {os.path.relpath(path, BASE)}  ({w}x{h}, {kb} KB)')

def blend(bg, fg, a):
    if a <= 0.0: return bg
    if a >= 1.0: return fg
    return (round(bg[0] + (fg[0] - bg[0]) * a),
            round(bg[1] + (fg[1] - bg[1]) * a),
            round(bg[2] + (fg[2] - bg[2]) * a))


# ── 48-segment alpha ──────────────────────────────────────────────────────────

def seg_alpha(angle_deg):
    """Alpha [0,1] for a given angle in the 48-segment ring pattern."""
    a    = angle_deg % SEG_DEG
    fill = SEG_DEG * FILL_RATIO   # 6.0°
    if a <= fill - AA_DEG:
        return 1.0
    if a <= fill:
        return (fill - a) / AA_DEG
    if a <= fill + AA_DEG:
        return 0.0
    if a >= SEG_DEG - AA_DEG:
        return (a - (SEG_DEG - AA_DEG)) / AA_DEG
    return 0.0


# ── Alpha map ─────────────────────────────────────────────────────────────────

def render_alpha_map(size, circle_r, stroke_w, dot_r):
    cx = cy    = (size - 1) / 2.0
    half_sw    = stroke_w / 2.0
    outer_r    = circle_r + half_sw
    outer_sq   = (outer_r + 1.0) ** 2
    dot_sq     = (dot_r   + 1.0) ** 2
    alpha      = []
    for y in range(size):
        row = []
        dy  = y - cy
        dy2 = dy * dy
        for x in range(size):
            dx = x - cx
            d2 = dx * dx + dy2
            if d2 > outer_sq:
                row.append(0.0)
                continue
            dist   = math.sqrt(d2)
            dot_a  = max(0.0, min(1.0, dot_r - dist + 0.5))
            ring_a = max(0.0, min(1.0, half_sw + 0.5 - abs(dist - circle_r)))
            if ring_a > 0.0:
                ang    = math.degrees(math.atan2(dy, dx)) % 360.0
                ring_a *= seg_alpha(ang)
            row.append(max(dot_a, ring_a))
        alpha.append(row)
    return alpha


# ── Separable box blur (O(N²) for any radius) ─────────────────────────────────

def box_blur(alpha, size, r):
    if r <= 0:
        return alpha
    # horizontal pass
    tmp = [[0.0] * size for _ in range(size)]
    for y in range(size):
        row    = alpha[y]
        prefix = [0.0] * (size + 1)
        for x in range(size):
            prefix[x + 1] = prefix[x] + row[x]
        for x in range(size):
            lo = max(0, x - r); hi = min(size, x + r + 1)
            tmp[y][x] = (prefix[hi] - prefix[lo]) / (hi - lo)
    # vertical pass
    result = [[0.0] * size for _ in range(size)]
    for x in range(size):
        prefix = [0.0] * (size + 1)
        for y in range(size):
            prefix[y + 1] = prefix[y] + tmp[y][x]
        for y in range(size):
            lo = max(0, y - r); hi = min(size, y + r + 1)
            result[y][x] = (prefix[hi] - prefix[lo]) / (hi - lo)
    return result


# ── Square icon render ────────────────────────────────────────────────────────

def render_icon(size, circle_r, stroke_w, dot_r, glow_r=0):
    alpha = render_alpha_map(size, circle_r, stroke_w, dot_r)
    glow  = box_blur(alpha, size, glow_r) if glow_r > 0 else None
    pixels = []
    for y in range(size):
        row = []
        for x in range(size):
            a = alpha[y][x]
            g = glow[y][x] * GLOW_INTENSITY * (1.0 - a) if glow else 0.0
            p = blend(BG, GOLD, g)
            row.append(blend(p, GOLD, a))
        pixels.append(row)
    return pixels


# ── OG image: centered icon on branded canvas ─────────────────────────────────

def render_og(out_w, out_h, icon_size, circle_r, stroke_w, dot_r, glow_r):
    icon = render_icon(icon_size, circle_r, stroke_w, dot_r, glow_r)
    ox   = (out_w - icon_size) // 2
    oy   = (out_h - icon_size) // 2
    pixels = []
    for y in range(out_h):
        row = []
        iy  = y - oy
        for x in range(out_w):
            ix = x - ox
            if 0 <= iy < icon_size and 0 <= ix < icon_size:
                row.append(icon[iy][ix])
            else:
                row.append(BG)
        pixels.append(row)
    return pixels


# ── SVG writers ───────────────────────────────────────────────────────────────

def write_svg(path, content):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, 'w') as f:
        f.write(content)
    print(f'  {os.path.relpath(path, BASE)}  (SVG)')

def _dasharray(r):
    circ    = 2 * math.pi * r
    seg_len = circ * FILL_RATIO / N_SEGS
    gap_len = circ / N_SEGS - seg_len
    return f'{seg_len:.3f} {gap_len:.3f}'

def make_logo_transparent_svg():
    da = _dasharray(38)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <!-- Golden Indung — transparent background, 48-segment ring -->
  <defs>
    <filter id="glow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="0" stdDeviation="1.5"
        flood-color="#FFD700" flood-opacity="0.4"/>
    </filter>
  </defs>
  <circle cx="50" cy="50" r="38"
    stroke="#FFD700" stroke-width="2.2"
    stroke-dasharray="{da}"
    fill="none"
    filter="url(#glow)"/>
  <circle cx="50" cy="50" r="6.8"
    fill="#FFD700"
    filter="url(#glow)"/>
</svg>
'''

def make_favicon_svg():
    da = _dasharray(11)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#0A1128"/>
  <circle cx="16" cy="16" r="11"
    stroke="#FFD700" stroke-width="1.5"
    stroke-dasharray="{da}"
    fill="none"/>
  <circle cx="16" cy="16" r="3.5" fill="#FFD700"/>
</svg>
'''


# ── Target definitions ────────────────────────────────────────────────────────
#   (path, size, circle_r, stroke_w, dot_r, glow_r)

IOS_TARGETS = [
    (f'{IOS}/app_store_icon_1024.png', 1024, 390, 12.0, 68.0, 31),
    (f'{IOS}/app_icon_180.png',         180,  68,  4.0, 12.5,  5),
    (f'{IOS}/app_icon_152.png',         152,  57,  3.5, 10.5,  5),
    (f'{IOS}/app_icon_167.png',         167,  63,  3.8, 11.5,  5),
    (f'{IOS}/spotlight_icon_80.png',     80,  29,  2.5,  5.5,  2),
    (f'{IOS}/notification_icon_40.png',  40,  14,  1.5,  2.8,  1),
]


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    print('\n── iOS Assets ──────────────────────────────────')
    for path, size, cr, sw, dr, gr in IOS_TARGETS:
        print(f'  Rendering {size}x{size}...')
        write_png(path, render_icon(size, cr, sw, dr, gr), size, size)

    print('\n── Web Assets ──────────────────────────────────')
    print('  Rendering favicon 32x32...')
    write_png(f'{WEB}/favicon.png',
              render_icon(32, 11, 1.5, 3.5, 1), 32, 32)

    print('  Rendering og_image 1200x630 (icon=500px)...')
    write_png(f'{WEB}/og_image_1200x630.png',
              render_og(1200, 630, 500, 190, 7.0, 33.0, 15), 1200, 630)

    write_svg(f'{WEB}/logo_transparent.svg', make_logo_transparent_svg())
    write_svg(f'{WEB}/favicon.svg',          make_favicon_svg())

    print('\nDone. ios_assets/ and web_assets/ are ready.')
