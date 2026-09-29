// How people move: joint-angle curves of human walking, running and sprinting over one stride (hip, knee, ankle and
// toe, from gait-lab averages), the body parameters that go with each (arm swing, elbow bend, pelvis turn and list,
// the rise and fall of the body, trunk lean), and the facial expressions (brows, mouth corners, lids, jaw).
const D = Math.PI / 180;
const N = 64;

// periodic curve from [% of the stride, degrees] keys (first at 0, last at 100 with the same value) → N samples (rad)
function curve(keys) {
  const out = new Float32Array(N), K = keys, n = K.length;
  for (let i = 0; i < N; i++) {
    const x = (i / N) * 100;
    let j = 0;
    while (j < n - 2 && K[j + 1][0] <= x) j++;
    const p1 = K[j], p2 = K[j + 1];
    const p0 = j > 0 ? K[j - 1] : [K[n - 2][0] - 100, K[n - 2][1]];
    const p3 = j + 2 < n ? K[j + 2] : [K[1][0] + 100, K[1][1]];
    const h = p2[0] - p1[0], t = (x - p1[0]) / h;
    const m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0])) * h, m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0])) * h;
    const t2 = t * t, t3 = t2 * t;
    out[i] = ((2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2) * D;
  }
  return out;
}
// value of a curve at a phase (cycles, any real number)
export function samp(c, ph) {
  ph -= Math.floor(ph);
  const x = ph * N, i = Math.floor(x), f = x - i;
  const a = c[i % N], b = c[(i + 1) % N];
  return a + (b - a) * f;
}

// 0 % = this foot touches down. Walking ~1.4 m/s (toe-off at 62 %), running ~3.5 m/s and sprinting ~7 m/s (toe-off
// at 38 % and 33 %: the rest of the stride is flight and swing). Hip +flexion, knee +flexion, ankle +dorsiflexion,
// toe +extension (the toes bending up as the heel rises).
export const GAIT = {
  walk: {
    hip: curve([[0, 25], [10, 21], [20, 13], [30, 5], [40, -3], [50, -10], [55, -9], [60, -5], [65, 2], [70, 10], [75, 18], [80, 24], [87, 28], [94, 27], [100, 25]]),
    knee: curve([[0, 3], [6, 11], [12, 17], [16, 18], [22, 15], [30, 8], [38, 4], [45, 6], [50, 11], [55, 22], [60, 37], [65, 51], [70, 60], [74, 63], [80, 56], [85, 43], [90, 26], [95, 10], [100, 3]]),
    ankle: curve([[0, 0], [5, -5], [10, -3], [15, 0], [25, 5], [35, 8], [45, 10], [50, 7], [55, 0], [60, -12], [64, -17], [70, -10], [76, -3], [82, 0], [90, 1], [100, 0]]),
    toe: curve([[0, 5], [6, 0], [40, 0], [46, 8], [52, 20], [58, 30], [62, 32], [66, 18], [72, 5], [85, 5], [100, 5]]),
  },
  run: {
    hip: curve([[0, 32], [10, 20], [20, 6], [30, -5], [38, -11], [45, -9], [55, 4], [65, 22], [75, 37], [85, 42], [93, 38], [100, 32]]),
    knee: curve([[0, 20], [8, 33], [16, 40], [24, 34], [32, 22], [38, 17], [45, 28], [55, 58], [65, 85], [72, 95], [80, 86], [88, 60], [95, 33], [100, 20]]),
    ankle: curve([[0, 4], [8, 12], [16, 18], [26, 10], [33, -6], [38, -20], [45, -18], [55, -6], [65, 2], [80, 4], [100, 4]]),
    toe: curve([[0, 0], [25, 4], [32, 18], [38, 28], [44, 12], [52, 0], [100, 0]]),
  },
  sprint: {
    hip: curve([[0, 45], [10, 30], [20, 10], [28, -6], [33, -12], [40, -8], [50, 12], [60, 38], [70, 60], [80, 72], [90, 62], [100, 45]]),
    knee: curve([[0, 25], [8, 38], [15, 42], [22, 33], [30, 20], [35, 18], [42, 40], [52, 85], [62, 115], [70, 125], [78, 110], [88, 70], [95, 40], [100, 25]]),
    ankle: curve([[0, 5], [8, 15], [16, 18], [25, 5], [31, -15], [36, -28], [44, -22], [55, -8], [70, 5], [85, 8], [100, 5]]),
    toe: curve([[0, 0], [22, 5], [28, 20], [34, 32], [40, 12], [48, 0], [100, 0]]),
  },
};
// the rest of the body for each gait (radians / metres for a 1.78 m person): shoulder swing, elbow bend (base, extra
// when the arm comes forward), arm out from the side, pelvis turn and list, forward tilt of the pelvis, trunk lean,
// rise and fall (and where in the stride the body is lowest), sway over the stance foot, how much lower the hips ride
export const GAIT_BODY = {
  walk: { arm: 16 * D, elb0: 16 * D, elbA: 16 * D, abd: 3 * D, pelRot: 4.5 * D, pelRoll: 4 * D, tilt: 0, lean: 2 * D, bob: 0.021, bobPh: 0, lat: 0.018, low: 0 },
  run: { arm: 36 * D, elb0: 80 * D, elbA: 14 * D, abd: 8 * D, pelRot: 7 * D, pelRoll: 4 * D, tilt: 4 * D, lean: 8 * D, bob: 0.038, bobPh: 0.18, lat: 0.007, low: 0.03 },
  sprint: { arm: 55 * D, elb0: 86 * D, elbA: 22 * D, abd: 10 * D, pelRot: 9 * D, pelRoll: 3 * D, tilt: 8 * D, lean: 15 * D, bob: 0.046, bobPh: 0.15, lat: 0.004, low: 0.05 },
};
const BODY_KEYS = Object.keys(GAIT_BODY.walk);
const _gb = {};
export function gaitBody(rb, sb) {
  const W = GAIT_BODY.walk, Rn = GAIT_BODY.run, S = GAIT_BODY.sprint;
  for (const k of BODY_KEYS) { const a = W[k] + (Rn[k] - W[k]) * rb; _gb[k] = a + (S[k] - a) * sb; }
  return _gb;
}

// facial expressions: brow lift (m), brow knit (rad, + inner ends down), smile (m, corners up and out, − down), mouth
// wide/narrow (m), lid squint (rad, − wide open), jaw open (rad)
export const FACES = {
  neutral: { lift: 0, knit: 0, smile: 0, wide: 0, squint: 0, jaw: 0 },
  happy: { lift: 0.0012, knit: -0.04, smile: 0.0032, wide: 0.0016, squint: 0.13, jaw: 0.02 },
  grin: { lift: 0.0018, knit: -0.05, smile: 0.0042, wide: 0.0026, squint: 0.2, jaw: 0.06 },
  angry: { lift: -0.0024, knit: 0.22, smile: -0.0014, wide: 0.0008, squint: 0.1, jaw: 0.0 },
  scared: { lift: 0.0036, knit: -0.18, smile: -0.0012, wide: 0.0018, squint: -0.07, jaw: 0.07 },
  sad: { lift: 0.0008, knit: -0.24, smile: -0.0024, wide: -0.0006, squint: 0.05, jaw: 0.0 },
  surprise: { lift: 0.0042, knit: -0.05, smile: 0, wide: -0.0012, squint: -0.08, jaw: 0.12 },
  pain: { lift: -0.0016, knit: 0.26, smile: -0.0006, wide: 0.003, squint: 0.3, jaw: 0.07 },
  effort: { lift: -0.0012, knit: 0.16, smile: -0.0004, wide: 0.0024, squint: 0.16, jaw: 0.015 },
  doubt: { lift: 0.0024, knit: 0.05, smile: -0.001, wide: -0.0008, squint: 0.04, jaw: 0 },
};
export const FACE_KEYS = Object.keys(FACES.neutral);
