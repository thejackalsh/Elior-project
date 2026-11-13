#!/usr/bin/env python3
"""Render animated README SVGs: assets/header.svg, assets/modes.svg.
ELIOR is drawn from Telma Medium outlines (no font loading needed on GitHub).
Needs: pip install fonttools.  Run: python3 scripts/readme_assets.py"""
import os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from xml.sax.saxutils import escape

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
FONT = os.path.join(ROOT, "elior-web/app/fonts/Telma-Medium.ttf")
OUT = os.path.join(ROOT, "assets")
GOLD, BG, MUTE, LINE = "#E0B374", "#0D0D0D", "#8C6A3F", "#2A2A2A"
MONO = "Consolas, 'Courier New', monospace"
EASE = "cubic-bezier(.2,.8,.2,1)"
REDUCE = "@media (prefers-reduced-motion:reduce){.a,.bar,.type{animation:none!important;opacity:1!important;transform:none!important}}"


def glyph_paths(text, size, gap):
    """Place glyphs by ink bounds (Telma advances are loose), return [(x, path)], total width."""
    from fontTools.pens.boundsPen import BoundsPen
    f = TTFont(FONT); gs = f.getGlyphSet(); cmap = f.getBestCmap()
    s = size / f["head"].unitsPerEm
    x, out = 0.0, []
    for ch in text:
        g = cmap[ord(ch)]
        bp = BoundsPen(gs); gs[g].draw(bp)
        xmin, _, xmax, _ = bp.bounds
        pen = SVGPathPen(gs, ntos=lambda v: f"{v:.2f}")
        gs[g].draw(TransformPen(pen, (s, 0, 0, -s, x - xmin * s, 0)))
        out.append((0, pen.getCommands()))
        x += (xmax - xmin) * s + gap
    return out, x - gap


def header():
    W, H, SIZE, TR = 800, 240, 110, 12
    letters, tw = glyph_paths("ELIOR", SIZE, TR)
    x0, base = (W - tw) / 2, 130
    css = (f".a{{opacity:0;animation:drop .875s {EASE} both}}"
           f".bar{{opacity:0;transform-box:fill-box;transform-origin:center;animation:bar .625s {EASE} 1s both}}"
           f".type{{transform-origin:200px 0;animation:type 1.4s steps(34,end) 1.5s both}}"
           "@keyframes drop{from{opacity:0;transform:translateY(-28px)}to{opacity:1;transform:none}}"
           "@keyframes bar{from{opacity:0;transform:scaleX(0)}to{opacity:1;transform:none}}"
           "@keyframes type{from{transform:scaleX(0)}to{transform:none}}" + REDUCE)
    tag = "ASISTEN PENGLIHATAN BERBASIS AI"
    tag_w = 400
    body = "".join(f'<g transform="translate({x0+x:.2f} {base})"><path class="a" style="animation-delay:{i*0.12:.2f}s" d="{d}" fill="{GOLD}"/></g>'
                   for i, (x, d) in enumerate(letters))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-label="ELIOR, asisten penglihatan berbasis AI untuk tunanetra">'
            f"<title>ELIOR</title><style>{css}</style>"
            f'<rect width="{W}" height="{H}" rx="12" fill="{BG}"/>'
            f'<clipPath id="t"><rect class="type" x="{(W-tag_w)/2}" y="176" width="{tag_w}" height="26"/></clipPath>'
            f"{body}"
            f'<rect class="bar" x="{(W-tw)/2}" y="158" width="{tw}" height="2" fill="{GOLD}"/>'
            f'<text clip-path="url(#t)" x="{W/2}" y="194" text-anchor="middle" font-family="{MONO}" font-size="14" letter-spacing="4" '
            f'textLength="{tag_w}" lengthAdjust="spacing" fill="{GOLD}">{escape(tag)}</text></svg>')


MODES = [
    ("Objek", "Deteksi objek + narasi deskriptif", "Server · YOLOv11 → Qwen2.5-VL"),
    ("Uang", "Kenali nominal rupiah, 11 kelas", "On-device · MobileNetV4 TFLite"),
    ("Baca", "OCR teks dari kamera", "On-device · ML Kit"),
    ("Memori", "Simpan dan putar ulang hasil pindaian", "Server · PostgreSQL"),
]


def modes():
    W, PX, AX, SX = 800, 40, 190, 520
    css = (f".lbl{{fill:{MUTE};font-size:12px;letter-spacing:2px}}.name{{fill:{GOLD};font-size:16px;font-weight:700}}"
           f".t{{fill:#e8e8e8;font-size:13px}}.m{{fill:{MUTE};font-size:12px}}.ln{{stroke:{LINE};stroke-width:1}}"
           f".a{{opacity:0;animation:drop 1.2s {EASE} both}}"
           "@keyframes drop{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}" + REDUCE)
    items = [f'<text class="lbl" x="{PX}" y="30">MODE</text><text class="lbl" x="{AX}" y="30">FUNGSI</text><text class="lbl" x="{SX}" y="30">DIJALANKAN DI</text>',
             f'<line class="ln" x1="{PX}" x2="{W-PX}" y1="44" y2="44"/>']
    y = 44
    for n, f, r in MODES:
        items.append(f'<text class="name" x="{PX}" y="{y+34}">{n}</text><text class="t" x="{AX}" y="{y+34}">{escape(f)}</text><text class="m" x="{SX}" y="{y+34}">{escape(r)}</text>')
        y += 52
        items.append(f'<line class="ln" x1="{PX}" x2="{W-PX}" y1="{y}" y2="{y}"/>')
    body = "".join(f'<g class="a" style="animation-delay:{i*0.2:.2f}s">{it}</g>' for i, it in enumerate(items))
    h = y + 8
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{h}" viewBox="0 0 {W} {h}" role="img" aria-label="Empat mode: Objek, Uang, Baca, Memori" font-family="{MONO}">'
            f'<title>Mode ELIOR</title><style>{css}</style><rect width="{W}" height="{h}" rx="12" fill="{BG}"/>{body}</svg>')


if __name__ == "__main__":
    for name, fn in (("header", header), ("modes", modes)):
        open(os.path.join(OUT, f"{name}.svg"), "w", encoding="utf-8").write(fn())
    print("wrote assets/header.svg + assets/modes.svg")
