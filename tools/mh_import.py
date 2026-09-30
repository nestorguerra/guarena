#!/usr/bin/env python3
"""The characters' heads come from MakeHuman (CC0: base mesh hm08, targets and system assets by the MakeHuman team,
www.makehumancommunity.org). This reads a folder with

    base.obj                       makehuman/data/3dobjs/base.obj (github.com/makehumancommunity/makehuman)
    basemesh_vertex_groups.json    mpfb2/src/mpfb/data/mesh_metadata (github.com/makehumancommunity/mpfb2)
    targets/<group>/*.target       makehuman/data/targets/...
    sys/                           makehuman_system_assets_cc0.zip unpacked (skins, eyes, eyebrows, eyelashes)

and writes assets/mh/:
    head.bin.gz    the head and neck (render mesh with UVs), every morph target restricted to them, the joints (eyes,
                   lids, jaw...), and the proxies (eyes, eyebrows, eyelashes, hair) bound to the head's vertices
    skin_<name>.webp  each skin's face, ears, neck and mouth packed into one atlas (the mesh's UVs point into it)
    eye_<name>.webp, brow_<name>.webp, lash_<name>.webp, hair_<name>.webp (grey + alpha: tinted in the game)
    mask_hair.png  the hair painted on the skin, in the atlas: R a man's scalp, G a woman's, B a full beard
    mask_face.png  R the lips, G a goatee with its moustache, B the inside of the mouth

    python3 tools/mh_import.py /path/to/makehuman-folder
"""
import gzip, io, json, math, os, re, struct, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'mh')
YCUT = 5.92            # the head and neck: base-mesh vertices above this height (decimetres; the neck base is ~5.9),
NECK_X = 0.64          # and below the ears only the neck's column, not the tops of the shoulders (they would not fit the body)
ATLAS = 1024           # skin atlas size (px)
SKINS = {              # the skins kept (name in the game → file under sys/skins)
    'yf_c': 'young_caucasian_female/young_lightskinned_female_diffuse.png',
    'yf_c2': 'young_caucasian_female2/young_lightskinned_female_diffuse2.png',
    'mf_c': 'middleage_caucasian_female/middleage_lightskinned_female_diffuse.png',
    'of_c': 'old_caucasian_female/old_lightskinned_female_diffuse.png',
    'ym_c': 'young_caucasian_male/young_lightskinned_male_diffuse.png',
    'ym_c2': 'young_caucasian_male2/young_lightskinned_male_diffuse2.png',
    'mm_c': 'middleage_caucasian_male/middleage_lightskinned_male_diffuse.png',
    'om_c': 'old_caucasian_male/old_lightskinned_male_diffuse.png',
    'yf_a': 'young_african_female/young_darkskinned_female_diffuse.png',
    'mf_a': 'middleage_african_female/middleage_darkskinned_female_diffuse.png',
    'of_a': 'old_african_female/old_darkskinned_female_diffuse.png',
    'ym_a': 'young_african_male/young_darkskinned_male_diffuse.png',
    'mm_a': 'middleage_african_male/middleage_darkskinned_male_diffuse.png',
    'om_a': 'old_african_male/old_darkskinned_male_diffuse.png',
    'yf_s': 'young_asian_female/young_lightskinned_female_diffuse3.png',
    'ym_s': 'young_asian_male/young_lightskinned_male_diffuse3.png',
}
EYES = ['brown', 'brownlight', 'green', 'blue', 'grey', 'bluegreen']
BROWS = ['eyebrow001', 'eyebrow002', 'eyebrow003', 'eyebrow004', 'eyebrow005', 'eyebrow008', 'eyebrow009', 'eyebrow010', 'eyebrow011', 'eyebrow012']
LASHES = ['eyelashes01', 'eyelashes02', 'eyelashes03']
HAIRS = ['short01', 'short02', 'short03', 'short04', 'bob02', 'long01', 'ponytail01', 'afro01']
HAIR_TEX = 512         # hair texture size (px)
WEBP = dict(quality=84, method=6)
TARGET_DIRS = ['macrodetails', 'head', 'nose', 'mouth', 'eyes', 'eyebrows', 'chin', 'cheek', 'ears', 'forehead', 'neck']
JOINTS = ['joint-l-eye', 'joint-r-eye', 'joint-l-upperlid', 'joint-r-upperlid', 'joint-l-lowerlid', 'joint-r-lowerlid',
          'joint-jaw', 'joint-mouth', 'joint-head', 'joint-head-2', 'joint-neck']
HELPERS = ['helper-l-eye', 'helper-r-eye', 'helper-l-eyelashes-1', 'helper-l-eyelashes-2', 'helper-r-eyelashes-1',
           'helper-r-eyelashes-2', 'helper-upper-teeth', 'helper-lower-teeth']


def read_obj(path):
    V, VT, F, FG, grp = [], [], [], [], ''
    for line in open(path, encoding='utf-8', errors='replace'):
        if line.startswith('v '): V.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('vt '): VT.append([float(x) for x in line.split()[1:3]])
        elif line.startswith('g '): grp = line.split()[1] if len(line.split()) > 1 else ''
        elif line.startswith('f '):
            F.append([tuple(int(x) - 1 if x else -1 for x in (c.split('/') + ['', ''])[:2]) for c in line.split()[1:]])
            FG.append(grp)
    return V, VT, F, FG


def read_target(path):
    out = {}
    for line in open(path, encoding='utf-8', errors='replace'):
        if not line.strip() or line[0] == '#': continue
        p = line.split()
        out[int(p[0])] = (float(p[1]), float(p[2]), float(p[3]))
    return out


def read_mhclo(path):
    """proxy fitting: per proxy vertex three base vertices, their weights and an offset (scaled by the x/y/z refs)"""
    ref, binds, obj = {}, [], None
    inverts = False
    for line in open(path, encoding='utf-8', errors='replace'):
        s = line.strip()
        if not s or s.startswith('#'): continue
        p = s.split()
        if p[0] in ('x_scale', 'y_scale', 'z_scale'): ref[p[0][0]] = (int(p[1]), int(p[2]), float(p[3]))
        elif p[0] == 'obj_file': obj = p[1]
        elif p[0] == 'verts': inverts = True
        elif p[0] in ('weights', 'delete_verts'): inverts = False
        elif inverts and re.match(r'^-?\d', p[0]):
            if len(p) >= 9: binds.append((int(p[0]), int(p[1]), int(p[2]), float(p[3]), float(p[4]), float(p[5]), float(p[6]), float(p[7]), float(p[8])))
            elif len(p) == 1: binds.append((int(p[0]), int(p[0]), int(p[0]), 1.0, 0.0, 0.0, 0.0, 0.0, 0.0))
    return ref, binds, obj


def islands(faces):
    """faces (lists of uv indices) grouped by shared uv vertices"""
    parent = {}
    def find(a):
        while parent.setdefault(a, a) != a:
            parent[a] = parent[parent[a]]; a = parent[a]
        return a
    for f in faces:
        for t in f[1:]: parent[find(t)] = find(f[0])
    groups = {}
    for i, f in enumerate(faces): groups.setdefault(find(f[0]), []).append(i)
    return list(groups.values())


def raster(rf, tmap, V, N):
    """the base-mesh position under each texel of an N x N atlas (None off the islands)"""
    pos = [None] * (N * N)
    for f in rf:
        P = [V[v] for v, _ in f]
        S = [(tmap[t][0] * N, (1 - tmap[t][1]) * N) for _, t in f]
        for tri in ((0, 1, 2), (0, 2, 3)):
            (ax, ay), (bx, by), (cx, cy) = [S[i] for i in tri]
            pa, pb, pc = [P[i] for i in tri]
            den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(den) < 1e-12: continue
            for yy in range(max(0, int(min(ay, by, cy)) - 1), min(N - 1, int(max(ay, by, cy)) + 1) + 1):
                for xx in range(max(0, int(min(ax, bx, cx)) - 1), min(N - 1, int(max(ax, bx, cx)) + 1) + 1):
                    qx, qy = xx + 0.5, yy + 0.5
                    w1 = ((by - cy) * (qx - cx) + (cx - bx) * (qy - cy)) / den
                    w2 = ((cy - ay) * (qx - cx) + (ax - cx) * (qy - cy)) / den
                    w3 = 1 - w1 - w2
                    if min(w1, w2, w3) < -0.03: continue  # a little overlap: no texel falls between two triangles
                    pos[yy * N + xx] = tuple(w1 * pa[k] + w2 * pb[k] + w3 * pc[k] for k in range(3))
    return pos


def sstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def lerp_table(tab, x):
    if x <= tab[0][0]: return tab[0][1]
    for (x0, y0), (x1, y1) in zip(tab, tab[1:]):
        if x <= x1: return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return tab[-1][1]


def blur(a, N, r=1, passes=2):
    """box blur of an N x N float list (only where the values are defined: None stays None)"""
    for _ in range(passes):
        b = a[:]
        for y in range(N):
            for x in range(N):
                if a[y * N + x] is None: continue
                s = n = 0
                for dy in range(-r, r + 1):
                    yy = y + dy
                    if yy < 0 or yy >= N: continue
                    for dx in range(-r, r + 1):
                        xx = x + dx
                        if 0 <= xx < N and a[yy * N + xx] is not None: s += a[yy * N + xx]; n += 1
                b[y * N + x] = s / n
        a = b
    return a


def hair_masks(V, rf, tmap, lipq, mouthq=(), N=512):
    """hair painted on the skin, in the atlas: R the scalp of a man, G of a woman (the hairline read off the
    dark-haired skins, where the hair is black on brown), B a full beard, A a goatee with its moustache (drawn from the
    face's own landmarks: mouth y ~6.62, nose base ~6.82, chin ~6.2, the ear's front ~z 0.55; decimetres)"""
    pos = raster(rf, tmap, V, N)
    lipset = set()
    for i, p in enumerate(raster(lipq, tmap, V, N)):
        if p is not None: lipset.add(i)
    def scalp(names):
        acc = [None if p is None else 0.0 for p in pos]
        for nm in names:
            im = Image.open(os.path.join(OUT, 'skin_' + nm + '.webp')).convert('L').resize((N, N), Image.LANCZOS)
            L = im.load()
            cheek = sorted(L[i % N, i // N] for i, p in enumerate(pos) if p and p[2] > 1.05 and 6.45 < p[1] < 7.0 and 0.2 < abs(p[0]) < 0.5)
            ref = cheek[len(cheek) // 2] or 1
            for i, p in enumerate(pos):
                if p is None: continue
                x, y, z = p
                # (the brows, eyes, nostrils, lips and a beard's shadow are dark too: hair only above the brows, round
                # the sides and at the back)
                ok = sstep(7.52, 7.62, y) + sstep(0.46, 0.54, abs(x)) * sstep(6.86, 6.94, y) + sstep(0.35, 0.2, z) * sstep(6.3, 6.4, y)
                if ok <= 0: continue
                h = max(0.0, min(1.0, (0.62 - L[i % N, i // N] / ref) / 0.26))
                # (well inside the hair the odd light patch of a texture is still hair)
                inner = max(sstep(8.25, 8.35, y), sstep(0.25, 0.05, z) * sstep(7.1, 7.3, y), sstep(0.62, 0.7, abs(x)) * sstep(7.5, 7.7, y) * sstep(0.7, 0.5, z))
                # the nape: the hair thins out over a couple of centimetres, the line rising behind the ears
                ny = 6.72 + 0.3 * min(1.0, abs(x) / 0.6) ** 2
                nape = 1 + (sstep(ny - 0.1, ny + 0.16, y) - 1) * sstep(0.4, 0.1, z)
                acc[i] += max(min(1.0, ok) * h, inner) * nape / len(names)
        acc = blur(acc, N, 2, 3)
        return [None if a is None else sstep(0.1, 0.75, a) for a in acc]
    R = scalp(['ym_a', 'mm_a', 'om_a'])
    G = scalp(['yf_a', 'mf_a', 'of_a'])
    B, A = [], []
    for i, p in enumerate(pos):
        if p is None: B.append(None); A.append(None); continue
        x, y, z = p; ax = abs(x)
        lip = i in lipset
        # a full beard: below the cheek line (from the sideburn down to the corner of the moustache, under the nose),
        # above the neckline (under the chin, rising to the angle of the jaw), in front of the ear
        yu = lerp_table([(0.0, 6.8), (0.2, 6.8), (0.31, 6.74), (0.44, 6.88), (0.57, 7.0), (0.66, 7.14), (0.8, 7.2)], ax)
        yl = 6.03 + 0.5 * min(1.0, ax / 0.6) ** 2
        up = sstep(yu + 0.09, yu - 0.07, y)  # (soft: a beard thins out up the cheek)
        dn = sstep(yl - 0.07, yl + 0.07, y)
        zf = 0.5 if y > 6.6 else 0.5 + 0.8 * max(0.0, 0.62 - ax) * sstep(6.6, 6.2, y)
        fr = sstep(zf - 0.06, zf + 0.06, z)
        b = up * dn * fr * (0 if lip else 1)
        # goatee and moustache: the upper lip up to the nose and down past the corners, the chin and under the lower lip
        low = 6.55 if ax < 0.2 else 6.49  # (the lips themselves are cut out; the ends droop past the corners)
        wm = 0.23 + 0.08 * sstep(6.8, 6.6, y)  # narrow under the nose, wider over the corners of the mouth
        must = sstep(wm + 0.03, wm - 0.02, ax) * sstep(6.84, 6.8, y) * sstep(low - 0.03, low + 0.01, y) * sstep(1.15, 1.25, z)
        chin = sstep(0.27, 0.2, ax / (1.0 + 0.3 * sstep(6.45, 6.2, y))) * sstep(6.58, 6.54, y) * sstep(6.08, 6.16, y) * sstep(0.95, 1.1, z)
        corner = sstep(0.335, 0.3, ax) * sstep(0.2, 0.24, ax) * sstep(6.66, 6.62, y) * sstep(6.4, 6.46, y) * sstep(1.15, 1.25, z)
        a = max(must, chin, corner) * (0 if lip else 1)
        B.append(b); A.append(a)
    B = blur(B, N, 1, 1); A = blur(A, N, 1, 1)
    Lp = [None if p is None else (1.0 if i in lipset else 0.0) for i, p in enumerate(pos)]
    Lp = blur(Lp, N, 1, 2)
    # the inside of the mouth (in the shade: the shader darkens it)
    mset = set(i for i, p in enumerate(raster(list(mouthq), tmap, V, N)) if p is not None)
    Mo = [None if p is None else (1.0 if i in mset else 0.0) for i, p in enumerate(pos)]
    # fill the gutters between islands with the nearest value (no seams where the texture is sampled across an edge)
    chans = [R, G, B, A, Lp, Mo]
    for _ in range(4):
        for c in chans:
            src = c[:]
            for y in range(N):
                for x in range(N):
                    if src[y * N + x] is not None: continue
                    vals = [src[yy * N + xx] for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)) if 0 <= yy < N and 0 <= xx < N and src[yy * N + xx] is not None]
                    if vals: c[y * N + x] = sum(vals) / len(vals)
    # (no alpha: the page draws images through a canvas, which would lose the colour wherever alpha is 0)
    q8 = lambda c, i: int(round(255 * max(0.0, min(1.0, c[i] or 0.0))))
    img = Image.new('RGB', (N, N)); img.putdata([(q8(R, i), q8(G, i), q8(B, i)) for i in range(N * N)])
    img.save(os.path.join(OUT, 'mask_hair.png'), optimize=True)
    img = Image.new('RGB', (N, N)); img.putdata([(q8(Lp, i), q8(A, i), q8(Mo, i)) for i in range(N * N)])
    img.save(os.path.join(OUT, 'mask_face.png'), optimize=True)
    print('masks', os.path.getsize(os.path.join(OUT, 'mask_hair.png')), os.path.getsize(os.path.join(OUT, 'mask_face.png')), 'bytes')


def eye_colour(im, name):
    """MakeHuman's brown irises are almost red: turned to the browns people have (dark brown, and a hazel for 'light')"""
    if name not in ('brown', 'brownlight'): return im
    import colorsys
    px = im.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b = [c / 255 for c in px[x, y]]
            h, s, v = colorsys.rgb_to_hsv(r, g, b)
            if s < 0.28: continue  # the white of the eye and the pupil keep their colour
            t = min(1.0, (s - 0.28) / 0.15)
            if name == 'brown': h2, s2, v2 = 0.068, s * 0.82, v * 0.8
            else: h2, s2, v2 = 0.098, s * 0.78, v * 0.82
            r2, g2, b2 = colorsys.hsv_to_rgb(h2, s2, v2)
            px[x, y] = tuple(int(round(255 * (c0 + (c1 - c0) * t))) for c0, c1 in ((r, r2), (g, g2), (b, b2)))
    return im


def main(src, only=None):
    os.makedirs(OUT, exist_ok=True)
    do = lambda part: only is None or part in only
    V, VT, F, FG = read_obj(os.path.join(src, 'base.obj'))
    G = json.load(open(os.path.join(src, 'basemesh_vertex_groups.json')))
    grp = lambda n: [i for a, b in G[n] for i in range(a, b + 1)]

    # --- the render mesh: body quads above the cut, and the teeth
    rf = [f for f, g in zip(F, FG) if g == 'body' and all(V[v][1] > YCUT and (abs(V[v][0]) < NECK_X or V[v][1] > 6.35) for v, _ in f)]
    teeth = [f for f, g in zip(F, FG) if g in ('helper-upper-teeth', 'helper-lower-teeth')]
    # --- every base vertex the game needs to morph: the mesh, the helpers the proxies sit on, the joints
    need = set(v for f in rf + teeth for v, _ in f)
    for n in HELPERS + JOINTS: need.update(grp(n))
    proxies = []
    def proxy(kind, name, folder, tex, png):
        ref, binds, objn = read_mhclo(os.path.join(folder, name + '.mhclo'))
        PV, PVT, PF, _ = read_obj(os.path.join(folder, objn))
        assert len(binds) == len(PV), (name, len(binds), len(PV))
        for b in binds: need.update(b[:3])
        for k in ref.values(): need.update(k[:2])
        proxies.append(dict(kind=kind, name=name, ref=ref, binds=binds, V=PV, VT=PVT, F=PF, tex=tex, png=png))
    proxy('eyes', 'high-poly', os.path.join(src, 'sys', 'eyes', 'high-poly'), None, False)
    # the eye's outer shell (the cornea) is mapped to a see-through corner of the texture: left out
    ep = proxies[-1]
    corner = lambda f: all(ep['VT'][t][0] > 0.85 and ep['VT'][t][1] < 0.15 for _, t in f)
    ep['F'] = [f for f in ep['F'] if not corner(f)]  # (the cornea: not drawn in the game)
    for b in BROWS: proxy('brow', b, os.path.join(src, 'sys', 'eyebrows', b), b + '.png', True)
    for l in LASHES: proxy('lash', l, os.path.join(src, 'sys', 'eyelashes', l), l + '.png', True)
    for h in HAIRS:
        folder = os.path.join(src, 'sys', 'hair', h)
        mat = open(os.path.join(folder, h + '.mhmat'), encoding='utf-8', errors='replace').read()
        proxy('hair', h, folder, re.search(r'^diffuseTexture\s+(\S+)', mat, re.M).group(1), True)
    region = sorted(need)
    ridx = {v: i for i, v in enumerate(region)}
    print('region vertices', len(region), 'render quads', len(rf), 'teeth quads', len(teeth))

    # --- the skin atlas: the head's uv islands (face, ears, neck, mouth) packed into ATLAS x ATLAS
    isl = islands([[t for _, t in f] for f in rf])
    boxes = []
    for fs in isl:
        ts = set(t for i in fs for _, t in rf[i])
        us = [VT[t][0] for t in ts]; vs = [VT[t][1] for t in ts]
        boxes.append([min(us), min(vs), max(us), max(vs), fs, ts])
    boxes.sort(key=lambda b: -(b[2] - b[0]) * (b[3] - b[1]))
    for b in boxes: print('island', len(b[4]), 'faces, uv box', [round(x, 3) for x in b[:4]])
    # the big one (the face) takes the left, scaled to the full height; the rest are shelved on the right
    SRC = 2048
    pad = 6
    big = boxes[0]
    sc = (ATLAS - 2 * pad) / ((big[3] - big[1]) * SRC)
    place = []
    bw = (big[2] - big[0]) * SRC * sc
    place.append((big, pad, pad, sc))
    x0, y0, rowh = int(bw + 2 * pad) + pad, pad, 0
    for b in boxes[1:]:
        w, h = (b[2] - b[0]) * SRC * sc, (b[3] - b[1]) * SRC * sc
        if x0 + w > ATLAS - pad: x0, y0, rowh = int(bw + 2 * pad) + pad, y0 + rowh + pad, 0
        place.append((b, x0, y0, sc))
        x0 += int(w) + pad; rowh = max(rowh, int(h) + 1)
    assert y0 + rowh <= ATLAS, 'atlas overflow'
    # uv (source) → atlas uv, per island
    tmap = {}
    for b, px, py, s in place:
        for t in b[5]:
            u, v = VT[t]
            ax = px + (u - b[0]) * SRC * s
            ay = py + (b[3] - v) * SRC * s  # image rows run down
            tmap[t] = (ax / ATLAS, 1 - ay / ATLAS)
    if only == {'layout'}: return dict(V=V, VT=VT, rf=rf, tmap=tmap)  # (for previews)
    means = {}
    for name, rel in (SKINS.items() if do('skins') else []):
        im = Image.open(os.path.join(src, 'sys', 'skins', rel)).convert('RGB')
        assert im.size == (SRC, SRC)
        # background: the skin's own mean colour, so bleeding at island edges stays skin-coloured
        small = im.resize((1, 1), Image.LANCZOS).getpixel((0, 0))
        at = Image.new('RGB', (ATLAS, ATLAS), small)
        for b, px, py, s in place:
            m = 4  # a margin of source pixels around each island
            box = (max(0, int(b[0] * SRC) - m), max(0, int((1 - b[3]) * SRC) - m), min(SRC, int(math.ceil(b[2] * SRC)) + m), min(SRC, int(math.ceil((1 - b[1]) * SRC)) + m))
            crop = im.crop(box)
            w, h = max(1, round(crop.size[0] * s)), max(1, round(crop.size[1] * s))
            crop = crop.resize((w, h), Image.LANCZOS)
            at.paste(crop, (int(round(px - (b[0] * SRC - box[0]) * s)), int(round(py - ((1 - b[3]) * SRC - box[1]) * s))))
        at.save(os.path.join(OUT, 'skin_' + name + '.webp'), 'WEBP', **WEBP)
        # the skin's own colour, to tint it to the person's: the median over the neck (where it meets the sculpted neck
        # and the body, which are the person's colour) with a little of the cheeks, nose and brow (no lips, eyes, hair)
        def median(pick):
            cols = []
            for f in rf:
                for v, t in f:
                    if pick(*V[v]):
                        u, w_ = VT[t]; cols.append(im.getpixel((min(SRC - 1, int(u * SRC)), min(SRC - 1, int((1 - w_) * SRC)))))
            return [sorted(c[k] for c in cols)[len(cols) // 2] / 255 for k in range(3)]
        face = median(lambda x, y, z: z > 1.05 and 6.45 < y < 7.55 and abs(x) < 0.55 and not (abs(y - 6.63) < 0.12 and abs(x) < 0.28) and not (abs(y - 7.28) < 0.1 and 0.12 < abs(x) < 0.5))
        neck = median(lambda x, y, z: 5.95 < y < 6.2 and z > -0.1)
        means[name] = [round(0.75 * n_ + 0.25 * f_, 4) for n_, f_ in zip(neck, face)]
        print('skin', name, 'face', [round(c, 3) for c in face], 'neck', [round(c, 3) for c in neck])
    if do('skins'):
        with open(os.path.join(OUT, 'skins.json'), 'w') as f: json.dump(means, f)
    # eyes, brows, lashes
    for e in (EYES if do('eyes') else []):
        eye_colour(Image.open(os.path.join(src, 'sys', 'eyes', 'materials', e + '_eye.png')).convert('RGB').resize((256, 256), Image.LANCZOS), e).save(os.path.join(OUT, 'eye_' + e + '.webp'), 'WEBP', quality=90, method=6)
    for p in (proxies if do('eyes') else []):
        if not p['png']: continue
        folder = {'brow': 'eyebrows', 'lash': 'eyelashes', 'hair': 'hair'}[p['kind']]
        im = Image.open(os.path.join(src, 'sys', folder, p['name'], p['tex'])).convert('RGBA')
        if p['kind'] == 'hair':
            # grey (its mean over the hair at 0.5, so the game's colour is the hair's average) and the alpha
            im = im.resize((HAIR_TEX, HAIR_TEX), Image.LANCZOS)
            Lh, Ah = im.convert('L'), im.split()[3]
            lp, ap = list(Lh.getdata()), list(Ah.getdata())
            vals = [l for l, a in zip(lp, ap) if a > 128]
            mean = (sum(vals) / len(vals)) if vals else 128
            Lh.putdata([max(0, min(255, int(round(l * 0.5 / max(mean, 1) * 255)))) for l in lp])
            Image.merge('RGBA', (Lh, Lh, Lh, Ah)).save(os.path.join(OUT, 'hair_' + p['name'] + '.webp'), 'WEBP', quality=82, alpha_quality=90, method=6)
        else:
            im.resize((256, 256), Image.LANCZOS).save(os.path.join(OUT, p['kind'] + '_' + p['name'] + '.webp'), 'WEBP', quality=90, alpha_quality=95, method=6)

    # --- landmarks from the islands: where the mouth's inside meets the face is the line of the lips, where each eye
    # socket's lining meets it the rims of the lids
    def centroid(fs):
        vs = set(v for i in fs for v, _ in rf[i])
        return [sum(V[v][k] for v in vs) / len(vs) for k in range(3)], vs
    info = []
    for b in boxes: c, vs = centroid(b[4]); info.append((b, c, vs))
    face_vs = info[0][2]
    mouth = min(info[1:], key=lambda e: abs(e[1][0]) + abs(e[1][1] - 6.6) + (0 if e[1][2] < 1.3 else 5))
    socks = sorted([e for e in info[1:] if abs(e[1][0]) > 0.15 and abs(e[1][1] - 7.28) < 0.3], key=lambda e: -e[1][0])
    lm = {}
    lipline = sorted(v for v in mouth[2] if v in face_vs)
    lm['lm-lipline'] = lipline
    lm['lm-mouthL'] = [max(lipline, key=lambda v: V[v][0])]
    lm['lm-mouthR'] = [min(lipline, key=lambda v: V[v][0])]
    lm['lm-mouthin'] = sorted(mouth[2])
    for (e, sd) in zip(socks, ['L', 'R']):
        rim = sorted(v for v in e[2] if v in face_vs)
        cy = sum(V[v][1] for v in rim) / len(rim)
        lm['lm-lidup' + sd] = [v for v in rim if V[v][1] >= cy]
        lm['lm-liddn' + sd] = [v for v in rim if V[v][1] < cy]
        lm['lm-sock' + sd] = sorted(e[2])
    lm['lm-teethlow'] = sorted(grp('helper-lower-teeth'))
    print('landmarks', {k: len(v) for k, v in lm.items()}, 'mouth corners x', V[lm['lm-mouthL'][0]][0], V[lm['lm-mouthR'][0]][0])
    # the lips (a mask in the atlas): face quads coloured like lips around the mouth, from three light skins
    lipims = [Image.open(os.path.join(src, 'sys', 'skins', SKINS[n])).convert('RGB') for n in ('yf_c', 'ym_c', 'mf_c')]
    def red(v, t):
        u, w = VT[t]; acc = 0
        for im in lipims:
            r, g_, b_ = im.getpixel((min(SRC - 1, int(u * SRC)), min(SRC - 1, int((1 - w) * SRC))))
            acc += (r - (g_ + b_) / 2) / (r + 1)
        return acc / len(lipims)
    my = sum(V[v][1] for v in lipline) / len(lipline)
    face_t = info[0][0][5]
    zone = [f for f in rf if all(t in face_t and abs(V[v][1] - my) < 0.22 and V[v][2] > 1.2 and abs(V[v][0]) < 0.34 for v, t in f)]
    rz = sorted(sum(red(v, t) for v, t in f) / 4 for f in zone)
    thr = rz[int(len(rz) * 0.55)] if rz else 1  # the redder part of the mouth area
    print('lip redness: zone quads', len(zone), 'min', round(rz[0], 3), 'median', round(rz[len(rz) // 2], 3), 'max', round(rz[-1], 3), 'thr', round(thr, 3))
    lipq = [f for f in zone if sum(red(v, t) for v, t in f) / 4 > thr]
    if do('masks'): hair_masks(V, rf, tmap, lipq, [rf[i] for i in mouth[0][4]])
    print('lip quads', len(lipq))
    if not do('head'): return
    for k, vs in lm.items(): need.update(vs)

    # --- the render vertices: one per (vertex, uv) pair
    rv, rvi, ri = [], {}, []
    def rvert(v, t, uv):
        k = (v, t)
        if k not in rvi: rvi[k] = len(rv); rv.append((ridx[v], uv))
        return rvi[k]
    for f in rf:
        q = [rvert(v, t, tmap[t]) for v, t in f]
        ri += [q[0], q[1], q[2], q[0], q[2], q[3]]
    nbody = len(ri)
    for f in teeth:  # the teeth: no skin uvs (a plain enamel colour in the shader)
        q = [rvert(v, -1 - v, (0.0, 0.0)) for v, _ in f]
        ri += [q[0], q[1], q[2], q[0], q[2], q[3]]

    # --- targets, restricted to the region, int8 with a scale each
    tg = []
    for d in TARGET_DIRS:
        folder = os.path.join(src, 'targets', d)
        for fn in sorted(os.listdir(folder)):
            if not fn.endswith('.target'): continue
            if d == 'neck' or re.match(r'head-(age|fat|trans)', fn): continue  # (never used: the macros age and fatten the head, the neck is stitched)
            t = read_target(os.path.join(folder, fn))
            ent = [(ridx[k], dv) for k, dv in t.items() if k in ridx and max(abs(c) for c in dv) > 1e-5]
            if not ent: continue
            mx = max(abs(c) for _, dv in ent for c in dv)
            tg.append((d + '/' + fn[:-7], mx / 127.0, ent))
    print('targets', len(tg), 'entries', sum(len(e) for _, _, e in tg))

    # --- write
    b = io.BytesIO()
    w = lambda fmt, *a: b.write(struct.pack('<' + fmt, *a))
    def s(txt): e = txt.encode(); w('H', len(e)); b.write(e)
    b.write(b'MHH3')
    w('I', len(region))
    for v in region: w('3f', *V[v])
    w('I', len(rv)); w('I', len(ri)); w('I', nbody)
    for r, uv in rv: w('H', r)
    for r, uv in rv: w('2H', int(round(uv[0] * 65535)), int(round(uv[1] * 65535)))
    for i in ri: w('H', i)
    w('H', len(JOINTS) + len(lm))
    for n in JOINTS:
        s(n); ids = [ridx[v] for v in grp(n)]; w('H', len(ids)); [w('H', i) for i in ids]
    for n, vs in lm.items():
        s(n); w('H', len(vs)); [w('H', ridx[v]) for v in vs]
    w('H', len(tg))
    for name, scale, ent in tg:
        s(name); w('f', scale); w('I', len(ent))
        for r, _ in ent: w('H', r)
        for _, dv in ent: w('3b', *[max(-127, min(127, int(round(c / scale)))) for c in dv])
    w('H', len(proxies))
    for p in proxies:
        s(p['kind']); s(p['name'])
        for ax in 'xyz':
            a, c, dist = p['ref'][ax]; w('2Hf', ridx[a], ridx[c], dist)
        # binds: three vertices, their weights and the offset, in int16 (each × the proxy's own scale: a haircut's
        # weights reach well past 0…1)
        w('I', len(p['binds']))
        wsc = max([abs(c) for bd in p['binds'] for c in bd[3:6]] + [1e-6]) / 32767
        osc = max([abs(c) for bd in p['binds'] for c in bd[6:9]] + [1e-6]) / 32767
        w('2f', wsc, osc)
        for bd in p['binds']:
            w('3H', ridx[bd[0]], ridx[bd[1]], ridx[bd[2]])
            w('3h', *[max(-32767, min(32767, int(round(c / wsc)))) for c in bd[3:6]])
            w('3h', *[max(-32767, min(32767, int(round(c / osc)))) for c in bd[6:9]])
        # the proxy's render vertices (vertex, uv) and triangles
        pv, pvi, pi = [], {}, []
        for f in p['F']:
            q = []
            for v, t in f:
                k = (v, t)
                if k not in pvi: pvi[k] = len(pv); pv.append((v, p['VT'][t] if t >= 0 else (0, 0)))
                q.append(pvi[k])
            for j in range(1, len(q) - 1): pi += [q[0], q[j], q[j + 1]]
        w('I', len(pv)); w('I', len(pi))
        for v, uv in pv: w('H', v)
        for v, uv in pv: w('2H', int(round(max(0, min(1, uv[0])) * 65535)), int(round(max(0, min(1, uv[1])) * 65535)))
        for i in pi: w('H', i)
    raw = b.getvalue()
    with gzip.open(os.path.join(OUT, 'head.bin.gz'), 'wb', compresslevel=9) as f: f.write(raw)
    print('head.bin', len(raw), 'bytes; gz', os.path.getsize(os.path.join(OUT, 'head.bin.gz')))
    tot = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print('assets/mh total', tot)


if __name__ == '__main__':
    # --only=masks,eyes,skins,head redoes just those parts (the head needs the targets: the slow part)
    args = [a for a in sys.argv[1:] if not a.startswith('--only=')]
    only = next((set(a[7:].split(',')) for a in sys.argv[1:] if a.startswith('--only=')), None)
    main(args[0] if args else '.', only)
