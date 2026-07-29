#!/usr/bin/env python3
"""Génère les icônes (PWA + launcher Android) sans dépendance externe.

Dessine une route qui s'éloigne vers l'horizon, avec sa bande centrale
discontinue, sur fond sombre arrondi. Encodeur PNG pur-Python : cette machine
n'a ni Pillow ni pip.
"""
import struct, zlib, math, os, sys

BG = (11, 18, 32)         # #0b1220, le fond des apps
ASPHALTE = (51, 65, 85)   # gris-bleu de la chaussée
BANDE = (245, 179, 1)     # #f5b301, la bande centrale
CIEL = (56, 189, 248)     # #38bdf8, l'accent — sert de halo d'horizon

# Chaussée en perspective : un trapèze qui se resserre vers le haut.
ROUTE = [(0.10, 1.00), (0.38, 0.30), (0.62, 0.30), (0.90, 1.00)]

# Bande centrale : segments de largeur et de hauteur croissantes vers le bas,
# ce qui donne l'impression de profondeur.
def bandes():
    out = []
    y = 0.34
    h = 0.045
    w = 0.012
    while y < 0.98:
        out.append([(0.5 - w, y), (0.5 + w, y), (0.5 + w, min(0.98, y + h)), (0.5 - w, min(0.98, y + h))])
        y += h * 2.0
        h *= 1.30
        w *= 1.30
    return out

BANDES = bandes()


def in_poly(px, py, poly):
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]; xj, yj = poly[j]
        if ((yi > py) != (yj > py)) and \
           (px < (xj - xi) * (py - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def make(size):
    s = size
    rad = s * 0.22
    route = [(x * s, y * s) for (x, y) in ROUTE]
    bandes_px = [[(x * s, y * s) for (x, y) in b] for b in BANDES]
    # Soleil/horizon : un disque derrière le haut de la route.
    hx, hy, hr = 0.5 * s, 0.30 * s, 0.17 * s

    px = bytearray()
    for y in range(s):
        px.append(0)  # filtre 0
        for x in range(s):
            cx = min(max(x, rad), s - rad); cy = min(max(y, rad), s - rad)
            if math.hypot(x - cx, y - cy) > rad:
                px += bytes((0, 0, 0, 0)); continue

            fx, fy = x + 0.5, y + 0.5
            col = BG

            # Halo d'horizon, dégradé vers le fond.
            d = math.hypot(fx - hx, fy - hy)
            if d < hr:
                t = d / hr
                col = tuple(int(CIEL[i] + (BG[i] - CIEL[i]) * t) for i in range(3))

            if in_poly(fx, fy, route):
                col = ASPHALTE
                for b in bandes_px:
                    if in_poly(fx, fy, b):
                        col = BANDE
                        break

            px += bytes((col[0], col[1], col[2], 255))
    return png(s, s, bytes(px))


def png(w, h, raw):
    def chunk(typ, data):
        c = typ + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    idat = zlib.compress(raw, 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def write(path, size):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(make(size))
    print("écrit", path, size)


if __name__ == "__main__":
    base = os.path.dirname(os.path.abspath(__file__))
    write(os.path.join(base, "www/img/icon-192.png"), 192)
    write(os.path.join(base, "www/img/icon-512.png"), 512)
    if "--android" in sys.argv:
        dens = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
        for d, sz in dens.items():
            for name in ("ic_launcher", "ic_launcher_round", "ic_launcher_foreground"):
                write(os.path.join(base, f"android/app/src/main/res/mipmap-{d}/{name}.png"), sz)
