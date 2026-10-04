"""MakeHuman data (CC0, www.makehumancommunity.org) for the tools, in plain Python: the base mesh, targets, vertex
groups, skeleton files (.mhskel) and their weights (.mhw), proxies (.mhclo).

The base mesh hm08 is in decimetres, y up, facing +z. Helper geometry (joint cubes, proxy fitting helpers) shares the
vertex list with the body; faces carry the group they belong to.
"""
import json, math, os, re


def read_obj(path):
    V, VT, F, FG, grp = [], [], [], [], ''
    for line in open(path, encoding='utf-8', errors='replace'):
        if line.startswith('v '):
            V.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('vt '):
            VT.append([float(x) for x in line.split()[1:3]])
        elif line.startswith('g '):
            grp = line.split()[1] if len(line.split()) > 1 else ''
        elif line.startswith('f '):
            F.append([tuple(int(x) - 1 if x else -1 for x in (c.split('/') + ['', ''])[:2]) for c in line.split()[1:]])
            FG.append(grp)
    return V, VT, F, FG


def read_target(path):
    out = {}
    for line in open(path, encoding='utf-8', errors='replace'):
        if not line.strip() or line[0] == '#':
            continue
        p = line.split()
        out[int(p[0])] = (float(p[1]), float(p[2]), float(p[3]))
    return out


def apply_targets(V, targets):
    """targets: [(delta dict, weight)] → new vertex list"""
    P = [v[:] for v in V]
    for d, w in targets:
        if not w:
            continue
        for i, (x, y, z) in d.items():
            p = P[i]
            p[0] += x * w; p[1] += y * w; p[2] += z * w
    return P


def macro_weights(gender, age, eth, weight=0.5, muscle=0.5, height=0.5, prop=0.5):
    """MakeHuman's macro modifiers → target file stems (as the game's mhdata.js, plus height and proportions).
    gender 0 woman … 1 man; age in years (25 young … 90 old); eth {african, asian, caucasian}; the rest 0 … 1"""
    out = {}
    t = max(0.0, min(1.0, (age - 25) / 65.0))
    ages = {'young': 1 - t, 'old': t}
    gs = {'male': gender, 'female': 1 - gender}
    for e in ('african', 'asian', 'caucasian'):
        for g, gw in gs.items():
            for a, aw in ages.items():
                w = eth.get(e, 0) * gw * aw
                if w > 1e-4:
                    out['macrodetails/%s-%s-%s' % (e.capitalize(), g, a)] = w
    lo = lambda x: max(0.0, (0.5 - x) * 2)
    hi = lambda x: max(0.0, (x - 0.5) * 2)
    mus = {'minmuscle': lo(muscle), 'averagemuscle': 1 - lo(muscle) - hi(muscle), 'maxmuscle': hi(muscle)}
    wts = {'minweight': lo(weight), 'averageweight': 1 - lo(weight) - hi(weight), 'maxweight': hi(weight)}
    for g, gw in gs.items():
        for a, aw in ages.items():
            k = gw * aw
            if k < 1e-4:
                continue
            for m, mw in mus.items():
                for w_, ww in wts.items():
                    kk = k * mw * ww
                    if kk < 1e-4:
                        continue
                    out['macrodetails/universal-%s-%s-%s-%s' % (g, a, m, w_)] = kk
                    if abs(height - 0.5) > 1e-3:
                        hn = 'maxheight' if height > 0.5 else 'minheight'
                        out['macrodetails-height/%s-%s-%s-%s-%s' % (g, a, m, w_, hn)] = kk * abs(height - 0.5) * 2
                    if prop > 0.5:
                        out['macrodetails-proportions/%s-%s-%s-%s-idealproportions' % (g, a, m, w_)] = kk * (prop - 0.5) * 2
                    elif prop < 0.5:
                        out['macrodetails-proportions/%s-%s-%s-%s-uncommonproportions' % (g, a, m, w_)] = kk * (0.5 - prop) * 2
    return out


def centroid(P, ids):
    n = float(len(ids))
    return [sum(P[i][0] for i in ids) / n, sum(P[i][1] for i in ids) / n, sum(P[i][2] for i in ids) / n]


def read_mhskel(path):
    return json.load(open(path, encoding='utf-8'))


def read_mhw(path):
    d = json.load(open(path, encoding='utf-8'))
    return d.get('weights', d)


# ---------------------------------------------------------------- small vector helpers
def sub(a, b): return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
def add(a, b): return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
def scl(a, k): return [a[0] * k, a[1] * k, a[2] * k]
def dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def cross(a, b): return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
def length(a): return math.sqrt(dot(a, a))
def norm(a):
    l = length(a) or 1.0
    return [a[0] / l, a[1] / l, a[2] / l]
