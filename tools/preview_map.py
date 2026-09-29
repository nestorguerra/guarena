#!/usr/bin/env python3
"""Render data/map.json to a PNG for visual QA. Usage: preview_map.py [x0 z0 x1 z1] [scale px/m] [out.png]"""
import json, sys, os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
m = json.load(open(os.path.join(ROOT, 'data', 'map.json'), encoding='utf-8'))
args = sys.argv[1:]
if len(args) >= 4:
    X0, Z0, X1, Z1 = map(float, args[:4])
else:
    X0, Z0, X1, Z1 = [v / 10 for v in m['bounds']]
S = float(args[4]) if len(args) >= 5 else 0.5
OUT = args[5] if len(args) >= 6 else os.path.join(ROOT, 'data', 'preview.png')
W, H = int((X1 - X0) * S), int((Z1 - Z0) * S)
img = Image.new('RGB', (W, H), (214, 200, 160))
d = ImageDraw.Draw(img)

def P(flat):
    return [((flat[i] / 10 - X0) * S, (flat[i + 1] / 10 - Z0) * S) for i in range(0, len(flat), 2)]

COL = {
    'landuse:residential': (226, 222, 212), 'landuse:orchard': (170, 190, 120), 'leisure:park': (150, 200, 120),
    'leisure:pitch': (120, 180, 100), 'amenity:parking': (190, 190, 190), 'landuse:industrial': (205, 195, 205),
    'natural:water': (90, 150, 220), 'landuse:forest': (80, 140, 70), 'landuse:cemetery': (170, 190, 170),
    'leisure:swimming_pool': (60, 170, 230), 'place:square': (235, 225, 200), 'highway:pedestrian': (235, 225, 200),
}
for a in sorted(m['areas'], key=lambda a: 0 if a['k'] == 'landuse:residential' else 1):
    c = COL.get(a['k'], (200, 210, 180))
    pts = P(a['p'])
    if len(pts) >= 3:
        d.polygon(pts, fill=c)
for l in m['lines']:
    pts = P(l['p'])
    col = (60, 120, 220) if l['k'].startswith('water') else (120, 120, 120)
    d.line(pts, fill=col, width=1)
# roads
cls = m['classes']
for e in m['edges']:
    pts = P(e['p'])
    c = cls[e['c']]
    w = max(1, int(e['w'] / 10 * S))
    col = (250, 250, 250) if c not in ('track', 'footway', 'path') else (200, 170, 120)
    if c in ('primary',): col = (255, 210, 120)
    d.line(pts, fill=col, width=w)
for b in m['parts']:
    pts = P(b['p'])
    f = b['f']
    shade = max(60, 170 - f * 28)
    d.polygon(pts, fill=(shade, shade - 10, shade - 20), outline=(40, 30, 30))
# nodes
for p in m['pois']:
    if p['k'].startswith('amenity:place_of_worship') or p['k'].startswith('amenity:townhall'):
        x, z = (p['x'] / 10 - X0) * S, (p['z'] / 10 - Z0) * S
        d.ellipse([x - 4, z - 4, x + 4, z + 4], fill=(220, 30, 30))
img.save(OUT)
print('saved', OUT, W, H)
