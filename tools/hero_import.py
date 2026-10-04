"""The hero's body: the MakeHuman base mesh (hm08, CC0 — www.makehumancommunity.org) below the head, shaped by its
macro targets, rigged on the game's skeleton (the bone names and conventions characters.js animates: every bone's
frame lined up with the body, +x the body's left, +y up, +z ahead; arms hanging at the sides and legs straight when
all rotations are identity), skinned with MakeHuman's own weights (its 163-bone default rig, folded onto ours), and
the facial expression targets for the head. Writes assets/hero/body.bin.gz ('HRB1').

    python3 tools/hero_import.py            (reads .cache/mh: base.obj, rigs/, targets/ — see the README)

The head itself is built in the game from assets/mh (the same base mesh: the seam at the neck matches vertex for vertex).
"""
import gzip, json, math, os, struct, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mhlib import read_obj, read_target, apply_targets, centroid, sub, add, scl, dot, cross, length, norm

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '.cache', 'mh')
OUT = os.path.join(ROOT, 'assets', 'hero')
YCUT, NECK_X = 5.92, 0.64          # the head region of tools/mh_import.py: the body is everything else

# the hero's build (the same numbers go to the head in the game: see HERO_MH in src/hero.js)
HERO = dict(g=1.0, wt=0.44, mu=0.62)
MACROS = {
    'macrodetails/caucasian-male-young': 1.0,
}


def macro_targets(wt, mu):
    lo = lambda x: max(0.0, (0.5 - x) * 2)
    hi = lambda x: max(0.0, (x - 0.5) * 2)
    out = dict(MACROS)
    avgW, avgM = 1 - lo(wt) - hi(wt), 1 - lo(mu) - hi(mu)
    pre = 'macrodetails/universal-male-young-'
    # (as the game's mhdata.js macroWeights: each of weight and muscle on its own against the average)
    if lo(wt): out[pre + 'averagemuscle-minweight'] = avgM * lo(wt)
    if hi(wt): out[pre + 'averagemuscle-maxweight'] = avgM * hi(wt)
    if lo(mu): out[pre + 'minmuscle-averageweight'] = avgW * lo(mu)
    if hi(mu): out[pre + 'maxmuscle-averageweight'] = avgW * hi(mu)
    return out


# ---------------------------------------------------------------- the skeleton
# name, parent, head joint, tail joint (MakeHuman's '<bone>____head' / '____tail' joint names, or a list to average),
# frame kind, the MakeHuman bones whose weights it takes
J = lambda b, e='head': b + '____' + e
def toes(sd, e):
    return [J('toe%d-1.%s' % (i, sd), e) for i in range(1, 6)]
def side(sd):
    s = sd  # 'L' / 'R' in MakeHuman, the same letters in ours
    out = [
        ('clav' + s, 'chest', J('clavicle.' + s), J('clavicle.' + s, 'tail'), 'body', ['clavicle.' + s, 'shoulder01.' + s]),
        ('arm' + s, 'clav' + s, J('upperarm01.' + s), J('lowerarm01.' + s), 'limb', ['upperarm01.' + s, 'upperarm02.' + s]),
        ('fore' + s, 'arm' + s, J('lowerarm01.' + s), J('wrist.' + s), 'limb', ['lowerarm01.' + s, 'lowerarm02.' + s]),
        ('hand' + s, 'fore' + s, J('wrist.' + s), J('finger3-1.' + s), 'hand', ['wrist.' + s, 'metacarpal1.' + s, 'metacarpal2.' + s, 'metacarpal3.' + s, 'metacarpal4.' + s]),
    ]
    for fi, fn in ((2, 'idx'), (3, 'mid'), (4, 'rng'), (5, 'pnk'), (1, 'thb')):
        par = 'hand' + s
        for k in (1, 2, 3):
            b = 'finger%d-%d.%s' % (fi, k, s)
            out.append(('%s%d%s' % (fn, k, s), par, J(b), J(b, 'tail'), 'finger', [b]))
            par = '%s%d%s' % (fn, k, s)
    out += [
        ('thigh' + s, 'hips', J('upperleg01.' + s), J('lowerleg01.' + s), 'limb', ['upperleg01.' + s, 'upperleg02.' + s]),
        ('shin' + s, 'thigh' + s, J('lowerleg01.' + s), J('foot.' + s), 'limb', ['lowerleg01.' + s, 'lowerleg02.' + s]),
        ('foot' + s, 'shin' + s, J('foot.' + s), toes(s, 'head'), 'foot', ['foot.' + s]),
        ('toe' + s, 'foot' + s, toes(s, 'head'), toes(s, 'tail'), 'foot', ['toe%d-%d.%s' % (i, k, s) for i in range(1, 6) for k in (1, 2, 3)]),
    ]
    return out

BONES = [
    ('root', None, None, None, 'body', []),
    ('hips', 'root', J('spine05'), J('spine04'), 'body', ['root', 'spine05', 'pelvis.L', 'pelvis.R']),
    ('spine', 'hips', J('spine04'), J('spine03'), 'body', ['spine04']),
    ('spine2', 'spine', J('spine03'), J('spine02'), 'body', ['spine03']),
    ('chest', 'spine2', J('spine02'), J('spine01', 'tail'), 'body', ['spine02', 'spine01', 'breast.L', 'breast.R']),
    ('neck', 'chest', J('neck01'), J('neck03', 'tail'), 'body', ['neck01', 'neck02', 'neck03']),
    ('head', 'neck', 'joint-head', J('head', 'tail'), 'body', ['head']),
] + side('L') + side('R')


def main():
    V, VT, F, FG = read_obj(os.path.join(SRC, '3dobjs', 'base.obj'))
    sk = json.load(open(os.path.join(SRC, 'rigs', 'default.mhskel'), encoding='utf-8'))
    W = json.load(open(os.path.join(SRC, 'rigs', 'default_weights.mhw'), encoding='utf-8'))['weights']
    # --- shape: the macro targets for the hero's build
    tw = macro_targets(HERO['wt'], HERO['mu'])
    targets = []
    for name, w in tw.items():
        p = os.path.join(SRC, 'targets', name + '.target')
        if not os.path.exists(p):
            print('missing target', name); continue
        targets.append((read_target(p), w))
    P = apply_targets(V, targets)
    print('targets', {k: round(v, 3) for k, v in tw.items()})
    # --- joints (MakeHuman's joint cubes, morphed with the body)
    joints = dict(sk['joints'])
    obj_groups = {}
    for f, g in zip(F, FG):
        if g.startswith('joint-'):
            obj_groups.setdefault(g, set()).update(v for v, _ in f)
    for g, s in obj_groups.items():
        joints.setdefault(g, sorted(s))
    def jpos(spec):
        if isinstance(spec, list):
            ps = [jpos(s) for s in spec]
            return [sum(p[i] for p in ps) / len(ps) for i in range(3)]
        return centroid(P, joints[spec])
    # decimetres, origin at the hips → metres, the soles on the ground
    body = [f for f, g in zip(F, FG) if g == 'body']
    head_faces = set(i for i, f in enumerate(body) if all(V[v][1] > YCUT and (abs(V[v][0]) < NECK_X or V[v][1] > 6.35) for v, _ in f))
    bfaces = [f for i, f in enumerate(body) if i not in head_faces]
    hfaces = [f for i, f in enumerate(body) if i in head_faces]
    floor = min(P[v][1] for f in bfaces for v, _ in f)
    M = lambda p: [p[0] * 0.1, (p[1] - floor) * 0.1, p[2] * 0.1]
    # --- bones: heads/tails, bind frames, rest offsets in the game's convention
    pos, tail = {}, {}
    for name, par, h, t, kind, _ in BONES:
        if h is None:
            pos[name] = [0.0, 0.0, 0.0]; tail[name] = [0.0, 0.1, 0.0]
        else:
            pos[name] = M(jpos(h)); tail[name] = M(jpos(t))
    def frame(name, kind):
        """bind rotation (columns x, y, z) of a bone in model space"""
        h, t = pos[name], tail[name]
        if kind == 'body':
            return [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
        if kind == 'foot':
            # aligned with the body, turned to the way the foot points (heel to toes, level)
            fwd = sub(tail['toe' + name[-1]], pos['foot' + name[-1]])
            z = norm([fwd[0], 0.0, fwd[2]]); y = [0.0, 1.0, 0.0]; x = cross(y, z)
            return [x, y, z]
        y = norm(sub(h, t))  # the bone runs down its −y
        if kind == 'limb':
            # x: the hinge between the upper and lower bone (elbow, knee), the same for both, so a turn of the lower
            # one about its own x is a pure bend (elbows forward about −x, knees back about +x, as characters.js has
            # them). The elbow's hinge is the normal to the arm's plane (MakeHuman's arms rest bent); the legs rest
            # almost straight, so the knee's is simply the body's left-right axis
            sd = name[-1]
            if name[:-1] in ('arm', 'fore'):
                u = norm(sub(pos['fore' + sd], pos['arm' + sd])); l = norm(sub(pos['hand' + sd], pos['fore' + sd]))
                a = cross(u, l)
                x = norm(a) if length(a) > 1e-3 else [1.0, 0.0, 0.0]
                if x[0] < 0:
                    x = scl(x, -1)  # (the body's left way, on both arms)
            else:
                x = [1.0, 0.0, 0.0]
            x = norm(sub(x, scl(y, dot(x, y))))
            z = cross(x, y)
            return [x, y, z]
        # hand and fingers: z towards the index finger's side (ahead when the arm hangs), x = y × z
        sd = name[-1]
        zi = sub(pos['idx1' + sd], pos['pnk1' + sd])
        z = norm(sub(zi, scl(y, dot(zi, y))))
        x = cross(y, z)
        return [x, y, z]
    R = {}
    for name, par, h, t, kind, _ in BONES:
        R[name] = frame(name, kind)
    def mT(m):  # transpose (inverse of a rotation given by columns)
        return [[m[0][0], m[1][0], m[2][0]], [m[0][1], m[1][1], m[2][1]], [m[0][2], m[1][2], m[2][2]]]
    def mv(cols, v):  # matrix (columns) × vector
        return [cols[0][i] * v[0] + cols[1][i] * v[1] + cols[2][i] * v[2] for i in range(3)]
    def mvT(cols, v):  # inverse rotation × vector
        return [dot(cols[0], v), dot(cols[1], v), dot(cols[2], v)]
    def mmT(a, b):  # a^T b (both as columns) → columns of the local rotation
        return [mvT(a, b[k]) for k in range(3)]
    def quat(cols):
        m00, m10, m20 = cols[0]; m01, m11, m21 = cols[1]; m02, m12, m22 = cols[2]
        tr = m00 + m11 + m22
        if tr > 0:
            s = math.sqrt(tr + 1.0) * 2; w = 0.25 * s; x = (m21 - m12) / s; y = (m02 - m20) / s; z = (m10 - m01) / s
        elif m00 > m11 and m00 > m22:
            s = math.sqrt(1.0 + m00 - m11 - m22) * 2; w = (m21 - m12) / s; x = 0.25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s
        elif m11 > m22:
            s = math.sqrt(1.0 + m11 - m00 - m22) * 2; w = (m02 - m20) / s; x = (m01 + m10) / s; y = 0.25 * s; z = (m12 + m21) / s
        else:
            s = math.sqrt(1.0 + m22 - m00 - m11) * 2; w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = 0.25 * s
        n = math.sqrt(w * w + x * x + y * y + z * z)
        return [x / n, y / n, z / n, w / n]
    bones_out = []
    for name, par, h, t, kind, _ in BONES:
        if par is None:
            off = pos[name]; lr = R[name]
        else:
            off = mvT(R[par], sub(pos[name], pos[par]))
            lr = mmT(R[par], R[name])
        bones_out.append((name, par, off, quat(lr)))
    # --- skin weights: MakeHuman's per-bone lists folded onto ours (anything left over goes to the nearest bone up)
    take = {}
    for name, par, h, t, kind, src in BONES:
        for s in src:
            take[s] = name
    def owner(mb):
        b = mb
        while b and b not in take:
            b = sk['bones'][b]['parent'] if b in sk['bones'] else None
        return take.get(b, 'head')
    bi = {b[0]: i for i, b in enumerate(BONES)}
    acc = {}
    for mb, lst in W.items():
        ob = bi[owner(mb)]
        for v, w in lst:
            d = acc.setdefault(v, {})
            d[ob] = d.get(ob, 0.0) + w
    # --- the body mesh (no head), its own vertex numbering; normals across the whole body (and the head, for the seam)
    used = sorted(set(v for f in bfaces for v, _ in f))
    idx = {v: i for i, v in enumerate(used)}
    nrm = {}
    for f in bfaces + hfaces:
        a, b, c, d = [P[v] for v, _ in f]
        n = cross(sub(c, a), sub(d, b))
        for v, _ in f:
            q = nrm.setdefault(v, [0.0, 0.0, 0.0]); q[0] += n[0]; q[1] += n[1]; q[2] += n[2]
    tri = []
    for f in bfaces:
        q = [idx[v] for v, _ in f]
        tri += [q[0], q[1], q[2], q[0], q[2], q[3]]
    ring = sorted(set(v for f in bfaces for v, _ in f) & set(v for f in hfaces for v, _ in f))
    # per-vertex part codes (for clothes and hidden-skin culling in the game): which hero bone weighs most
    out = bytearray(b'HRB1')
    put = lambda fmt, *a: out.extend(struct.pack('<' + fmt, *a))
    def pstr(s):
        b = s.encode('utf-8'); put('B', len(b)); out.extend(b)
    put('fff', HERO['g'], HERO['wt'], HERO['mu'])
    put('f', floor * 0.1)  # (where the base mesh's origin sits above the ground, m — the head is placed the same way)
    put('H', len(bones_out))
    for name, par, off, q in bones_out:
        pstr(name); put('h', bi[par] if par else -1); put('fff', *off); put('ffff', *q)
    nv = len(used)
    put('I', nv)
    for v in used:
        put('fff', *M(P[v]))
    for v in used:
        n = norm(nrm[v])
        put('bbb', *[max(-127, min(127, int(round(c * 127)))) for c in n])
    for v in used:
        d = acc.get(v, {bi['hips']: 1.0})
        top = sorted(d.items(), key=lambda kv: -kv[1])[:4]
        s = sum(w for _, w in top) or 1
        q = [int(round(w / s * 255)) for _, w in top]
        q[0] += 255 - sum(q)
        while len(top) < 4:
            top.append((0, 0)); q.append(0)
        put('BBBB', *[b for b, _ in top]); put('BBBB', *q)
    for v in used:
        put('H', v)  # the base mesh's own index (expressions, the seam, the clothes' masks)
    put('I', len(tri))
    for t in tri:
        put('H', t)
    put('I', len(ring))
    for v in ring:
        put('H', idx[v])
    # --- the face's expression units (morph targets on the head's base vertices, int16 × scale)
    exdir = os.path.join(SRC, 'targets', 'expression', 'units', 'caucasian')
    names = sorted(n[:-7] for n in os.listdir(exdir) if n.endswith('.target'))
    tg = {n: read_target(os.path.join(exdir, n + '.target')) for n in names}
    # where each vertex they move sits on the unmorphed base mesh (the game finds its head's vertices by it: the head
    # build keeps that position per vertex), metres, as the head build stores it (y from 0.7 m)
    allv = sorted(set(v for t in tg.values() for v in t))
    put('I', len(allv))
    for v in allv:
        put('H', v); put('fff', V[v][0] * 0.1, (V[v][1] - 7) * 0.1, V[v][2] * 0.1)
    put('H', len(names))
    for n in names:
        t = tg[n]
        mx = max((abs(c) for d in t.values() for c in d), default=0.0) or 1e-6
        sc = mx / 32767.0
        pstr(n); put('f', sc * 0.1); put('I', len(t))
        for v in sorted(t):
            put('H', v)
        for v in sorted(t):
            put('hhh', *[int(round(c / sc)) for c in t[v]])
    os.makedirs(OUT, exist_ok=True)
    data = gzip.compress(bytes(out), 9)
    open(os.path.join(OUT, 'body.bin.gz'), 'wb').write(data)
    h = pos['head']; ft = pos['footL']
    print('bones', len(bones_out), 'verts', nv, 'tris', len(tri) // 3, 'ring', len(ring), 'expressions', len(names))
    print('height (top of head ~)', round((max(P[v][1] for f in hfaces for v, _ in f) - floor) * 0.1, 3), 'm; hips', [round(c, 3) for c in pos['hips']], 'head', [round(c, 3) for c in h])
    print('raw', len(out), 'gz', len(data))
    # a readable copy of the skeleton for the tools
    json.dump({'bones': [{'name': n, 'parent': p, 'off': o, 'rot': q, 'pos': pos[n], 'tail': tail[n]} for (n, p, o, q) in bones_out]},
              open(os.path.join(OUT, 'rig.json'), 'w'), indent=0)


if __name__ == '__main__':
    main()
