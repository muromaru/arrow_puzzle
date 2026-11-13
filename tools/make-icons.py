"""アイコン生成（標準ライブラリのみ）。使い方: python3 tools/make-icons.py"""
import zlib, struct, math, pathlib

BG, TOP, LEFT, RIGHT = (26, 34, 48), (207, 227, 234), (74, 106, 138), (63, 125, 134)
R, C30 = 0.34, math.cos(math.pi / 6)
P = {
    'T': (0.5, 0.5 - R), 'UR': (0.5 + R * C30, 0.5 - R / 2), 'LR': (0.5 + R * C30, 0.5 + R / 2),
    'B': (0.5, 0.5 + R), 'LL': (0.5 - R * C30, 0.5 + R / 2), 'UL': (0.5 - R * C30, 0.5 - R / 2), 'C': (0.5, 0.5),
}
FACES = [
    ([P['T'], P['UR'], P['C'], P['UL']], TOP),
    ([P['UL'], P['C'], P['B'], P['LL']], LEFT),
    ([P['C'], P['UR'], P['LR'], P['B']], RIGHT),
]

def inside(poly, x, y):
    sign = 0
    for i in range(len(poly)):
        ax, ay = poly[i]; bx, by = poly[(i + 1) % len(poly)]
        c = (bx - ax) * (y - ay) - (by - ay) * (x - ax)
        if c == 0: continue
        if sign == 0: sign = 1 if c > 0 else -1
        elif (c > 0) != (sign > 0): return False
    return True

def color_at(x, y):
    for poly, col in FACES:
        if inside(poly, x, y): return col
    return BG

def render(size, ss=2):
    rows = []
    for j in range(size):
        row = bytearray([0])
        for i in range(size):
            acc = [0, 0, 0]
            for sj in range(ss):
                for si in range(ss):
                    c = color_at((i + (si + 0.5) / ss) / size, (j + (sj + 0.5) / ss) / size)
                    for k in range(3): acc[k] += c[k]
            row += bytes(v // (ss * ss) for v in acc)
        rows.append(bytes(row))
    return rows

def write_png(path, size):
    raw = b''.join(render(size))
    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    png = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))
    pathlib.Path(path).write_bytes(png)

out = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'icons'
for name, s in [('icon-192.png', 192), ('icon-512.png', 512), ('apple-touch-icon.png', 180)]:
    write_png(out / name, s)
