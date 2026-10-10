'use strict';
// =====================================================================
//  SPRITES — procedural pixel-art: skeletal rig drawn with vectors,
//  then pixelized (hard alpha + palette snap + outline) and cached.
// =====================================================================
const SPR = {};          // name -> { anims: {anim: {frames, ox, oy, fps, loop}} }
const ANIM_FPS = 24;

const BUILDS = {
  normal: { thigh: 8, shin: 8, torso: 11, upper: 6, fore: 6, headR: 5, hipW: 6, chestW: 8, legW: 4, armW: 3, footL: 4, handR: 1.6 },
  slim: { thigh: 8, shin: 8.5, torso: 10, upper: 5.5, fore: 5.5, headR: 5, hipW: 5.5, chestW: 7, legW: 3.6, armW: 2.8, footL: 4, handR: 1.5 },
  big: { thigh: 8.5, shin: 8, torso: 12.5, upper: 7, fore: 6.5, headR: 5.2, hipW: 8, chestW: 12, legW: 5, armW: 4.4, footL: 5, handR: 3.2 },
  hulk: { thigh: 8, shin: 7, torso: 13, upper: 7, fore: 7, headR: 4.6, hipW: 10, chestW: 15, legW: 6, armW: 5.4, footL: 6, handR: 3.6 },
};

const BASE_POSE = { x: 0, y: 0, lean: 0, head: 0, aF: [80, 60], aB: [100, 80], lF: [82, 95], lB: [98, 90], w: 150, w2: 150, gl: 1, scarf: 175, wave: 0, coat: 110, fx: 0, eye: 1 };

function clonePose(p) {
  const o = {};
  for (const k in p) o[k] = Array.isArray(p[k]) ? p[k].slice() : p[k];
  return o;
}
function lerpPose(a, b, t) {
  const o = {};
  for (const k in a) {
    const va = a[k], vb = b[k];
    if (vb === undefined) { o[k] = Array.isArray(va) ? va.slice() : va; continue; }
    if (Array.isArray(va)) o[k] = va.map((v, i) => v + (vb[i] - v) * t);
    else if (typeof va === 'number') o[k] = va + (vb - va) * t;
    else o[k] = t < 0.5 ? va : vb;
  }
  for (const k in b) if (o[k] === undefined) o[k] = b[k];
  return o;
}
function fullPose(L, partial) {
  const p = clonePose(BASE_POSE);
  if (L && L.stance) Object.assign(p, clonePose(L.stance));
  if (partial) Object.assign(p, clonePose(partial));
  return p;
}
function keyedPose(L, keys, t) {
  if (t <= keys[0][0]) return fullPose(L, keys[0][1]);
  for (let i = 0; i < keys.length - 1; i++) {
    const k0 = keys[i], k1 = keys[i + 1];
    if (t >= k0[0] && t <= k1[0]) {
      const u = (t - k0[0]) / Math.max(0.0001, k1[0] - k0[0]);
      const e = Ease[k1[2] || 'outQuad'] || Ease.outQuad;
      return lerpPose(fullPose(L, k0[1]), fullPose(L, k1[1]), e(u));
    }
  }
  return fullPose(L, keys[keys.length - 1][1]);
}

// ---------- geometry ----------
const _seg = (o, a, l) => ({ x: o.x + Math.cos(a * DEG) * l, y: o.y + Math.sin(a * DEG) * l });
function solveRig(p, B) {
  const J = {};
  let hx = p.x, hy = -(B.thigh + B.shin) + p.y;
  J.hipF = { x: hx + 0.8, y: hy }; J.hipB = { x: hx - 0.8, y: hy };
  J.kF = _seg(J.hipF, p.lF[0], B.thigh); J.anF = _seg(J.kF, p.lF[1], B.shin);
  J.kB = _seg(J.hipB, p.lB[0], B.thigh); J.anB = _seg(J.kB, p.lB[1], B.shin);
  const low = Math.max(J.anF.y, J.anB.y);
  const dy = (-1.6 - low) * (p.gl === undefined ? 1 : p.gl);
  for (const k of ['hipF', 'hipB', 'kF', 'anF', 'kB', 'anB']) J[k].y += dy;
  hy += dy;
  J.hip = { x: hx, y: hy };
  const L = p.lean * DEG;
  J.up = { x: Math.sin(L), y: -Math.cos(L) };
  J.fw = { x: Math.cos(L), y: Math.sin(L) };
  J.neck = { x: hx + J.up.x * B.torso, y: hy + J.up.y * B.torso };
  J.chest = { x: hx + J.up.x * B.torso * 0.62, y: hy + J.up.y * B.torso * 0.62 };
  J.sF = { x: J.neck.x - J.up.x * 1.6 + J.fw.x * 0.6, y: J.neck.y - J.up.y * 1.6 + J.fw.y * 0.6 };
  J.sB = { x: J.sF.x - J.fw.x * 1.6, y: J.sF.y - J.fw.y * 1.6 };
  J.eF = _seg(J.sF, p.aF[0], B.upper); J.hF = _seg(J.eF, p.aF[1], B.fore);
  J.eB = _seg(J.sB, p.aB[0], B.upper); J.hB = _seg(J.eB, p.aB[1], B.fore);
  const HA = (p.lean + p.head) * DEG;
  J.headA = HA;
  J.head = { x: J.neck.x + Math.sin(HA) * (B.headR - 0.6), y: J.neck.y - Math.cos(HA) * (B.headR - 0.6) };
  J.footFa = p.lF[1] - 90; J.footBa = p.lB[1] - 90;
  return J;
}

// ---------- vector primitives ----------
// (x is a PixCtx — see gfx.js)
function vLine(x, a, b, w, col) { x.line(a.x, a.y, b.x, b.y, w, col); }
function vPoly(x, pts, col) { x.poly(pts, col); }
function vCirc(x, cx, cy, r, col) { x.circ(cx, cy, r, col); }
function vEll(x, cx, cy, rx, ry, rot, col) { x.ell(cx, cy, rx, ry, rot, col); }
function vRect(x, rx, ry, w, h, col) { x.rect(rx, ry, w, h, col); }
// draw in a local frame: origin o, rotated by angle (deg)
function local(x, o, angDeg, fn) { x.save(); x.translate(o.x, o.y); x.rotate(angDeg * DEG); fn(); x.restore(); }

// ---------- humanoid renderer ----------
function drawLeg(x, J, B, L, front, p) {
  const hip = front ? J.hipF : J.hipB, k = front ? J.kF : J.kB, an = front ? J.anF : J.anB;
  const c = L.col;
  const pants = front ? c.pants : shade(c.pants, -0.3);
  const boot = front ? c.boot : shade(c.boot, -0.3);
  vLine(x, hip, k, B.legW, pants);
  const mid = { x: (k.x + an.x) / 2, y: (k.y + an.y) / 2 };
  vLine(x, k, mid, B.legW - 0.4, L.shinCol ? (front ? L.shinCol : shade(L.shinCol, -0.3)) : pants);
  vLine(x, mid, an, B.legW - 0.3, boot);
  const fa = front ? J.footFa : J.footBa;
  const toe = _seg(an, fa, B.footL);
  vLine(x, an, toe, Math.max(2.4, B.legW - 1), boot);
  if (L.kneePad) vCirc(x, k.x, k.y, B.legW * 0.55, front ? L.kneePad : shade(L.kneePad, -0.3));
}
function drawArm(x, J, B, L, front, p) {
  const s = front ? J.sF : J.sB, e = front ? J.eF : J.eB, h = front ? J.hF : J.hB;
  const c = L.col;
  const sl = front ? c.sleeve : shade(c.sleeve, -0.3);
  vLine(x, s, e, B.armW, sl);
  const fore = L.foreCol ? (front ? L.foreCol : shade(L.foreCol, -0.3)) : sl;
  vLine(x, e, h, B.armW - 0.3, fore);
  const hand = front ? c.hand : shade(c.hand, -0.3);
  vCirc(x, h.x, h.y, B.handR, hand);
  if (L.gauntlet) {
    const g = front ? L.gauntlet : shade(L.gauntlet, -0.3);
    const mid = { x: (e.x * 0.35 + h.x * 0.65), y: (e.y * 0.35 + h.y * 0.65) };
    vLine(x, mid, h, B.armW + 1.4, g);
    vCirc(x, h.x, h.y, B.handR + 0.6, g);
    if (L.gauntletGlow) vCirc(x, h.x, h.y, 1.2, front ? L.gauntletGlow : shade(L.gauntletGlow, -0.2));
  }
}
function drawTorsoBase(x, J, B, L, p, col, colD) {
  const n = J.fw, hip = J.hip, nk = J.neck;
  const hw = B.hipW / 2, cw = B.chestW / 2;
  vPoly(x, [
    [hip.x - n.x * hw, hip.y - n.y * hw], [hip.x + n.x * hw, hip.y + n.y * hw],
    [nk.x + n.x * cw - J.up.x * 1, nk.y + n.y * cw - J.up.y * 1], [nk.x - n.x * cw - J.up.x * 1, nk.y - n.y * cw - J.up.y * 1],
  ], col);
  vEll(x, nk.x - J.up.x * 1.5, nk.y - J.up.y * 1.5, cw, 2.2, p.lean * DEG, col);
  if (colD) { // back shading strip
    vPoly(x, [
      [hip.x - n.x * hw, hip.y - n.y * hw], [hip.x - n.x * (hw - 2), hip.y - n.y * (hw - 2)],
      [nk.x - n.x * (cw - 2), nk.y - n.y * (cw - 2)], [nk.x - n.x * cw, nk.y - n.y * cw],
    ], colD);
  }
}
function drawHumanoid(x, p, L) {
  const B = L.build;
  const J = solveRig(p, B);
  if (L.preBack) L.preBack(x, J, B, p);
  if (L.weapon2) L.weapon2(x, J, B, p);
  if (!L.noBackArm) drawArm(x, J, B, L, false, p);
  if (!L.noLegs) drawLeg(x, J, B, L, false, p);
  if (L.back) L.back(x, J, B, p);
  if (!L.noLegs) drawLeg(x, J, B, L, true, p);
  L.torso(x, J, B, p);
  L.head(x, J, B, p);
  if (L.weaponUnder) L.weapon(x, J, B, p);
  if (!L.noFrontArm) drawArm(x, J, B, L, true, p);
  if (!L.weaponUnder && L.weapon) L.weapon(x, J, B, p);
  if (L.post) L.post(x, J, B, p);
  return J;
}
function lookPalette(L) {
  const set = new Set();
  for (const k in L.col) {
    const c = L.col[k];
    set.add(c); set.add(shade(c, -0.3));
  }
  if (L.extraPal) for (const c of L.extraPal) set.add(c);
  return [...set];
}

// ---------- shared part drawers ----------
function drawScarf(x, start, ang, len, wave, width, col, colD) {
  // wavy tapered ribbon flowing along `ang`
  const n = 6;
  let prev = { x: start.x, y: start.y };
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    const a = ang + Math.sin(wave * TAU + u * 4) * 14 * u;
    const pt = { x: prev.x + Math.cos(a * DEG) * len / n, y: prev.y + Math.sin(a * DEG) * len / n };
    vLine(x, prev, pt, Math.max(1.4, width * (1 - u * 0.55)), i % 2 && colD ? colD : col);
    prev = pt;
  }
  return prev;
}
function katana(x, h, ang, len, c) {
  local(x, h, ang, () => {
    vLine(x, { x: -3.5, y: 0 }, { x: 1, y: 0 }, 2, c.hilt);
    vLine(x, { x: 1, y: -2 }, { x: 1, y: 2 }, 1.6, c.guard || '#c9a14a');
    vPoly(x, [[1.5, -1], [len - 2, -1], [len + 1, 0.4], [len - 2, 1.1], [1.5, 1.1]], c.blade);
    vLine(x, { x: 2, y: 0.9 }, { x: len - 2, y: 0.9 }, 0.9, c.bladeE);
  });
}
// long spear held at the front hand: shaft behind and ahead of the grip, leaf head, a tassel hanging from the collar
function spear(x, h, ang, c, o = {}) {
  const fwd = o.fwd || 19, back = o.back || 11, hl = o.headL || 7, a = ang * DEG;
  local(x, h, ang, () => {
    vLine(x, { x: -back, y: 0 }, { x: fwd - 2, y: 0 }, o.thick || 1.6, c.shaft);
    vLine(x, { x: -back + 1, y: -0.5 }, { x: fwd - 3, y: -0.5 }, 0.5, c.shaftH);
    vRect(x, -back - 1.2, -1.1, 1.8, 2.2, c.cap);
    if (o.halberd) vPoly(x, [[fwd - 1.5, -1.2], [fwd + 2.5, -1.4], [fwd + 4, -4.6], [fwd + 1.6, -6.2], [fwd + 1, -3.4], [fwd - 1.2, -2.6]], c.head);
    vPoly(x, [[fwd - 1.4, -1.5], [fwd + 2, -1.8], [fwd + hl, 0], [fwd + 2, 1.8], [fwd - 1.4, 1.5]], c.head);
    vLine(x, { x: fwd, y: 0 }, { x: fwd + hl - 1, y: 0 }, 0.7, c.headE);
    vRect(x, fwd - 2.8, -1.5, 1.4, 3, c.collar);
  });
  // the tassel hangs straight down from the collar whatever the spear's angle
  const bx = h.x + Math.cos(a) * (fwd - 2.2), by = h.y + Math.sin(a) * (fwd - 2.2), sw = Math.sin((o.wave || 0) * TAU) * 1.3;
  vPoly(x, [[bx - 1.1, by], [bx + 1.2, by], [bx + 1.7 + sw, by + 4.4], [bx - 1.5 + sw, by + 4.8]], c.tassel);
  vRect(x, bx - 0.4 + sw * 0.6, by + 1.2, 1, 2.8, c.tasselD);
}
function pistol(x, h, ang, c, big) {
  local(x, h, ang, () => {
    vRect(x, -1, -1.6, big ? 9 : 7, 2.8, c.gun);
    vRect(x, 0, -1.6, big ? 6 : 4, 1, c.gunH || shade(c.gun, 0.35));
    vRect(x, -1.5, 0.6, 2.4, 3.2, c.gunD || shade(c.gun, -0.35));
    vRect(x, big ? 7 : 5, -0.9, 2, 1.4, c.gold || '#ffcc4d');
  });
}

// =====================================================================
//  HERO LOOKS
// =====================================================================
const LOOKS = {};

LOOKS.rin = {
  build: BUILDS.normal,
  col: {
    skin: '#f3d3bb', hair: '#eef1fb', hairD: '#9fa7c4', coat: '#221d33', coatH: '#3b3556', red: '#e8334f', redD: '#931a33',
    pants: '#2a2539', boot: '#151220', blade: '#f4f8ff', bladeE: '#ff5a76', hilt: '#3a2630', guard: '#d4a94e', eye: '#ff2f55',
    sleeve: '#221d33', hand: '#f3d3bb', belt: '#5a4434',
  },
  stance: { lean: 6, aF: [72, 40], aB: [105, 80], lF: [70, 100], lB: [108, 92], w: 28, scarf: 145, coat: 112 },
  runArms: (s) => ({ aF: [120, 150], aB: [90 - 45 * s, 40 - 30 * s], w: 172 }),
  airArms: { aF: [20, -40], aB: [150, 120], w: -60 },
  fallArms: { aF: [-20, -60], aB: [170, 140], w: -100 },
  dashArms: { aF: [150, 175], aB: [160, 175], w: 178 },
  back(x, J, B, p) {
    const c = this.col;
    // scarf
    drawScarf(x, { x: J.neck.x - 1, y: J.neck.y + 0.5 }, p.scarf, 15, p.wave, 3.4, c.red, c.redD);
    // coat tails
    const tail = _seg({ x: J.hip.x - 1, y: J.hip.y - 1 }, p.coat, 11);
    vPoly(x, [[J.hip.x - 3, J.hip.y - 3], [J.hip.x + 2, J.hip.y - 1], [tail.x + 2, tail.y], [tail.x - 2.5, tail.y - 0.5]], '#191526');
    vLine(x, { x: tail.x - 2.5, y: tail.y - 0.5 }, { x: tail.x + 2, y: tail.y }, 1, c.redD);
  },
  torso(x, J, B, p) {
    const c = this.col;
    drawTorsoBase(x, J, B, this, p, c.coat, '#171324');
    // red trim + belt
    vLine(x, { x: J.hip.x + J.fw.x * 2.4, y: J.hip.y + J.fw.y * 2.4 }, { x: J.neck.x + J.fw.x * 3, y: J.neck.y + J.fw.y * 3 }, 1, c.red);
    vLine(x, { x: J.hip.x - J.fw.x * 3 - J.up.x * -1, y: J.hip.y - J.fw.y * 3 + J.up.y * 1 }, { x: J.hip.x + J.fw.x * 3 + J.up.x, y: J.hip.y + J.fw.y * 3 + J.up.y }, 1.6, c.belt);
    // scarf wrap at neck
    vEll(x, J.neck.x, J.neck.y + 0.5, 3.4, 2, p.lean * DEG, c.red);
  },
  head(x, J, B, p) {
    const c = this.col, r = B.headR;
    local(x, J.head, J.headA / DEG, () => {
      vCirc(x, 0, 0, r, c.skin);
      // hair mass
      vPoly(x, [[4.6, -1], [5.4, -3.6], [3, -6.2], [-0.5, -6.8], [-4, -6], [-8.5, -6.6], [-6, -3.6], [-9.5, -2.2], [-6, -0.6], [-8.4, 2.6], [-4.6, 2], [-3.5, 4.6], [-1, 1], [1.4, -1.2], [2.5, 0.8], [3.6, -1.4]], c.hair);
      vPoly(x, [[-4, -6], [-8.5, -6.6], [-6, -3.6], [-9.5, -2.2], [-6, -0.6], [-4.5, -3]], c.hairD);
      // fringe spike over eye
      vPoly(x, [[5, -2.5], [6.2, 0.6], [3.6, -0.8]], c.hair);
      // eye
      vRect(x, 2.2, -0.6, 1.4, 2, p.eye ? c.eye : c.skin);
      vRect(x, 2.2, -1.2, 1.6, 0.7, '#3a2630');
    });
  },
  weapon(x, J, B, p) { katana(x, J.hF, p.w, this.bladeLen || 17, this.col); },
};

LOOKS.eve = {
  build: BUILDS.slim,
  col: {
    skin: '#f6dac8', hair: '#ffd86e', hairD: '#d39a3c', coat: '#2f56c8', coatH: '#5b84ff', white: '#eef3fb', skirt: '#1f2e6e',
    pants: '#262b48', boot: '#e9eef8', gun: '#cfd5e2', gunD: '#5d6478', gold: '#ffcc4d', eye: '#39c9ff', ribbon: '#ff5577',
    sleeve: '#2f56c8', hand: '#f6dac8',
  },
  stance: { lean: 2, aF: [40, 0], aB: [60, 20], lF: [74, 96], lB: [104, 92], w: 0, w2: 10, scarf: 115 },
  runArms: (s) => ({ aF: [40 + 12 * s, 5], aB: [60 - 12 * s, 25], w: 5, w2: 20 }),
  airArms: { aF: [20, -20], aB: [130, 110], w: -20, w2: 110 },
  dashArms: { aF: [150, 170], aB: [165, 178], w: 170, w2: 178 },
  shinCol: '#262b48',
  back(x, J, B, p) {
    const c = this.col;
    // twin tails
    local(x, J.head, J.headA / DEG, () => {
      const a = p.scarf;
      drawScarf(x, { x: -4, y: -3 }, a, 12, p.wave, 4.2, c.hair, c.hairD);
      drawScarf(x, { x: -2, y: -4.5 }, a - 12, 10, p.wave + 0.3, 3.6, c.hairD);
    });
  },
  torso(x, J, B, p) {
    const c = this.col;
    // skirt
    const n = J.fw, hp = J.hip;
    vPoly(x, [[hp.x - n.x * 3.5 - J.up.x * -1.5, hp.y - n.y * 3.5 + 1.5], [hp.x + n.x * 3.5, hp.y + n.y * 3.5 + 1.5], [hp.x + n.x * 5.5, hp.y + 5], [hp.x - n.x * 6.5, hp.y + 5]], c.skirt);
    drawTorsoBase(x, J, B, this, p, c.coat, '#22408f');
    vLine(x, { x: J.chest.x + J.fw.x * 2, y: J.chest.y + J.fw.y * 2 - 2 }, { x: J.neck.x + J.fw.x * 2.5, y: J.neck.y + J.fw.y * 2.5 }, 2, c.white);
    vLine(x, { x: J.hip.x - J.fw.x * 3, y: J.hip.y - 1 }, { x: J.hip.x + J.fw.x * 3, y: J.hip.y - 1 }, 1.2, c.gold);
  },
  head(x, J, B, p) {
    const c = this.col, r = B.headR;
    local(x, J.head, J.headA / DEG, () => {
      vCirc(x, 0, 0, r, c.skin);
      vPoly(x, [[5.2, -1.2], [4.8, -4.4], [2, -6.4], [-2, -6.6], [-5.6, -4.6], [-6.2, -0.5], [-5.4, 3.5], [-3.4, 4.6], [-2, 1], [0.5, -1.5], [2, 0.2], [3.4, -1.6], [4.4, 1.6]], c.hair);
      vPoly(x, [[-2, -6.6], [-5.6, -4.6], [-6.2, -0.5], [-4.2, -2.6]], c.hairD);
      // ribbon
      vPoly(x, [[-3.5, -6.5], [-6.5, -8.5], [-5.6, -5.4], [-8.4, -5.2], [-4.4, -4.6]], c.ribbon);
      vRect(x, 2.3, -0.4, 1.4, 2, p.eye ? c.eye : c.skin);
      vRect(x, 2.2, -1, 1.6, 0.6, '#5a3a20');
    });
  },
  weapon2(x, J, B, p) { pistol(x, J.hB, p.w2, { gun: shade(this.col.gun, -0.25), gold: this.col.gold }); },
  weapon(x, J, B, p) { pistol(x, J.hF, p.w, this.col, p.big || this.bigGun); },
};

LOOKS.gao = {
  build: BUILDS.big,
  col: {
    skin: '#c88a5f', hair: '#ff7b2c', hairD: '#c2431b', vest: '#3a5d43', vestD: '#2a4432', pants: '#4a3b30', boot: '#211a17',
    metal: '#8c93a3', metalD: '#555b6b', glow: '#ffb84a', band: '#e33b3b', eye: '#ffd56a', belt: '#7a5a2a', sleeve: '#c88a5f', hand: '#c88a5f',
  },
  gauntlet: '#8c93a3', gauntletGlow: '#ffb84a',
  stance: { lean: 8, aF: [70, -25], aB: [85, -30], lF: [60, 105], lB: [118, 92], scarf: 165 },
  runArms: (s) => ({ aF: [70 + 25 * s, -20 + 20 * s], aB: [85 - 25 * s, -20 - 20 * s] }),
  airArms: { aF: [10, -40], aB: [120, 160] },
  dashArms: { aF: [20, -10], aB: [40, -20] },
  back(x, J, B, p) {
    const c = this.col;
    local(x, J.head, J.headA / DEG, () => {
      drawScarf(x, { x: -4.5, y: -2 }, p.scarf, 9, p.wave, 2.4, c.band);
    });
  },
  torso(x, J, B, p) {
    const c = this.col;
    drawTorsoBase(x, J, B, this, p, c.skin, shade(c.skin, -0.25));
    // vest
    const n = J.fw, hp = J.hip, nk = J.neck;
    vPoly(x, [[hp.x - n.x * 4.5, hp.y - n.y * 4.5], [hp.x + n.x * 1, hp.y + n.y * 1], [nk.x - n.x * 0.5, nk.y - n.y * 0.5], [nk.x - n.x * 6.5, nk.y - n.y * 6.5]], c.vest);
    vPoly(x, [[hp.x + n.x * 3.5, hp.y + n.y * 3.5], [hp.x + n.x * 4.6, hp.y + n.y * 4.6], [nk.x + n.x * 6, nk.y + n.y * 6], [nk.x + n.x * 4.4, nk.y + n.y * 4.4]], c.vest);
    // abs line
    vLine(x, { x: hp.x + n.x * 2.2 + J.up.x * 2, y: hp.y + n.y * 2.2 + J.up.y * 2 }, { x: J.chest.x + n.x * 2.6, y: J.chest.y + n.y * 2.6 }, 0.8, shade(c.skin, -0.3));
    vLine(x, { x: hp.x - n.x * 5, y: hp.y - n.y * 5 + 1 }, { x: hp.x + n.x * 5, y: hp.y + n.y * 5 + 1 }, 2.4, c.belt);
    vRect(x, hp.x + n.x * 1 - 1, hp.y + n.y * 1, 2.6, 2.4, c.glow);
  },
  head(x, J, B, p) {
    const c = this.col, r = B.headR;
    local(x, J.head, J.headA / DEG, () => {
      vCirc(x, 0, 0.4, r, c.skin);
      vRect(x, 0.5, 2, 4.5, 3, c.skin); // jaw
      vPoly(x, [[4.8, -2], [6.4, -5.4], [3, -5], [2.6, -8.8], [0, -5.8], [-2.4, -9.6], [-3, -5.6], [-6.6, -7.6], [-5.6, -3.4], [-8.4, -1.6], [-5.2, -0.2], [-6, 2.6], [-3, 1], [0, -2.6], [3.2, -2.4]], c.hair);
      vPoly(x, [[-2.4, -9.6], [-3, -5.6], [-6.6, -7.6], [-5.6, -3.4], [-8.4, -1.6], [-4.4, -2.6], [-1.2, -5]], c.hairD);
      vLine(x, { x: -4.6, y: -2.6 }, { x: 4.8, y: -2.2 }, 1.4, c.band);
      vRect(x, 2.3, -0.8, 1.6, 1.6, p.eye ? c.eye : c.skin);
      vRect(x, 1.8, -1.6, 2.6, 0.7, '#2a1a10');
    });
  },
  weapon: null,
};
LOOKS.gao.col.sleeve = LOOKS.gao.col.skin;

LOOKS.lan = {
  build: BUILDS.normal,
  col: {
    skin: '#f2d4b8', hair: '#1e3c42', hairD: '#0f2328', robe: '#21987f', robeD: '#155f50', inner: '#eef8f2', trim: '#e8c45a',
    band: '#3ee0b0', pants: '#24303c', boot: '#151a22', bracer: '#4a5a68', eye: '#2ee0b0', sleeve: '#21987f', hand: '#f2d4b8',
    shaft: '#5a3a28', shaftH: '#8c6444', cap: '#c9a14a', collar: '#c9a14a', head: '#e8f2f8', headE: '#7ff0d0', tassel: '#e8334f', tasselD: '#9a1f36',
  },
  foreCol: '#4a5a68',
  stance: { lean: 6, aF: [45, 15], aB: [75, 35], w: -14, lF: [66, 100], lB: [114, 92], scarf: 160, coat: 112 },
  runArms: (s) => ({ aF: [100 + 10 * s, 140], aB: [70 - 30 * s, 30 - 20 * s], w: 172 }),
  airArms: { aF: [20, -30], aB: [140, 110], w: -40 },
  fallArms: { aF: [-10, -50], aB: [160, 130], w: -70 },
  dashArms: { aF: [10, 0], aB: [30, 10], w: 0 },
  back(x, J, B, p) {
    const c = this.col;
    // high ponytail and the ends of the jade hair band
    local(x, J.head, J.headA / DEG, () => {
      drawScarf(x, { x: -3.5, y: -5.5 }, p.scarf - 8, 13, p.wave, 3.6, c.hair, c.hairD);
      drawScarf(x, { x: -2.5, y: -4.6 }, p.scarf + 6, 8, p.wave + 0.35, 1.6, c.band);
    });
    // robe tails split at the back
    const t1 = _seg({ x: J.hip.x - 1, y: J.hip.y - 1 }, p.coat, 12), t2 = _seg({ x: J.hip.x - 1, y: J.hip.y - 1 }, p.coat - 16, 10);
    vPoly(x, [[J.hip.x - 3, J.hip.y - 3], [J.hip.x + 2, J.hip.y - 1], [t1.x + 2, t1.y], [t1.x - 2.5, t1.y - 0.5]], c.robeD);
    vPoly(x, [[J.hip.x - 2, J.hip.y - 2], [J.hip.x + 1, J.hip.y], [t2.x + 1.5, t2.y], [t2.x - 2, t2.y - 0.4]], c.robe);
    vLine(x, { x: t1.x - 2.5, y: t1.y - 0.5 }, { x: t1.x + 2, y: t1.y }, 1, c.trim);
  },
  torso(x, J, B, p) {
    const c = this.col, n = J.fw;
    drawTorsoBase(x, J, B, this, p, c.robe, c.robeD);
    // white inner robe showing at the crossed collar
    vPoly(x, [[J.neck.x + n.x * 1.2, J.neck.y + n.y * 1.2 - 0.5], [J.neck.x + n.x * 3.6, J.neck.y + n.y * 3.6], [J.chest.x + n.x * 2.6, J.chest.y + n.y * 2.6]], c.inner);
    vLine(x, { x: J.neck.x + n.x * 3.4, y: J.neck.y + n.y * 3.4 }, { x: J.chest.x + n.x * 1.4, y: J.chest.y + n.y * 1.4 }, 0.8, c.trim);
    // gold sash
    vLine(x, { x: J.hip.x - n.x * 3.4, y: J.hip.y - n.y * 3.4 - 0.5 }, { x: J.hip.x + n.x * 3.4, y: J.hip.y + n.y * 3.4 - 0.5 }, 1.8, c.trim);
    vRect(x, J.hip.x + n.x * 2 - 0.8, J.hip.y + n.y * 2, 1.6, 3, c.tassel);
  },
  head(x, J, B, p) {
    const c = this.col, r = B.headR;
    local(x, J.head, J.headA / DEG, () => {
      vCirc(x, 0, 0, r, c.skin);
      // swept-back hair, a long side lock in front of the ear, the ponytail's root on top
      vPoly(x, [[4.8, -1.6], [5.4, -4.2], [2.6, -6.4], [-1.5, -6.9], [-5.2, -5.4], [-6.4, -1.6], [-5.6, 2.4], [-3.4, 4.4], [-2.6, 0.6], [-0.6, -1.8], [1.6, -0.6], [2.8, -2.2], [3.8, 0.6]], c.hair);
      vPoly(x, [[-1.5, -6.9], [-5.2, -5.4], [-6.4, -1.6], [-4.4, -3.4]], c.hairD);
      vPoly(x, [[-3.8, -6.6], [-1.2, -8.4], [0.6, -6.8]], c.hair);
      vLine(x, { x: -4.4, y: -5.6 }, { x: -1.4, y: -7.4 }, 1.2, c.band);
      vPoly(x, [[4.6, -2.4], [5.6, 1.4], [3.8, -0.4]], c.hair);
      vRect(x, 2.3, -0.6, 1.4, 2, p.eye ? c.eye : c.skin);
      vRect(x, 2.1, -1.2, 1.8, 0.7, '#14262a');
    });
  },
  weapon(x, J, B, p) { spear(x, J.hF, p.w, this.col, Object.assign({ wave: p.wave }, this.spearO)); },
};

// =====================================================================
//  GENERIC PROCEDURAL ANIMS (idle / run / air / dash / hurt / dead)
// =====================================================================
function addA(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
const GEN = {
  idle(L, t) {
    const s = Math.sin(t * TAU), st = L.stance;
    return fullPose(L, {
      y: s * 0.6, lean: st.lean + s * 1.2, head: -s * 2,
      aF: addA(st.aF, [s * 3, s * 5]), aB: addA(st.aB, [-s * 3, -s * 4]), w: st.w + s * 3, w2: (st.w2 || 0) + s * 3,
      wave: t, scarf: st.scarf + s * 6, coat: st.coat + s * 4,
    });
  },
  run(L, t) {
    const ph = t * TAU, s = Math.sin(ph), c = Math.cos(ph), st = L.stance;
    const leg = (q) => {
      const ss = Math.sin(q), cc = Math.cos(q);
      const th = 90 - 42 * ss;
      return [th, th + 20 + 75 * Math.max(0, cc)];
    };
    const arms = L.runArms ? L.runArms(s, c) : { aF: [90 + 45 * s, 40 + 30 * s], aB: [90 - 45 * s, 40 - 30 * s] };
    return fullPose(L, Object.assign({
      lean: 14 + (st.runLean || 0), head: -6, lF: leg(ph), lB: leg(ph + Math.PI), wave: t * 2, scarf: 178 - 6 * c, coat: 150 + 10 * s,
    }, arms));
  },
  jump(L, t) {
    const st = L.stance;
    return fullPose(L, Object.assign({ gl: 0, y: -1, lean: 6, head: -6, lF: [40, 115], lB: [105, 160], scarf: 120 + t * 20, coat: 100, wave: t }, L.airArms || {}));
  },
  fall(L, t) {
    return fullPose(L, Object.assign({ gl: 0, y: -1, lean: 2, head: 4, lF: [70, 100], lB: [110, 125], scarf: 230 - t * 20, coat: 250, wave: t * 2 }, L.fallArms || L.airArms || {}));
  },
  dash(L, t) {
    return fullPose(L, Object.assign({ gl: 0, y: -2, lean: 34, head: -14, lF: [25, 95], lB: [150, 140], scarf: 182, coat: 175, wave: t * 3 }, L.dashArms || { aF: [150, 170], aB: [160, 175] }));
  },
  hurt(L, t) {
    return fullPose(L, { gl: 1, lean: -22, head: 18, aF: [-30 + t * 20, -60], aB: [-50, -80], lF: [60, 100], lB: [120, 120], scarf: 150, coat: 80, eye: 0, w: -60, w2: -80 });
  },
  dead(L, t) {
    return fullPose(L, { gl: 1, y: 0, lean: -80 * Math.min(1, t * 1.2), head: 30, aF: [-150, -170], aB: [-130, -160], lF: [10, 20], lB: [-10, 0], scarf: 180, coat: 90, eye: 0, w: -170 });
  },
  land(L) {
    return fullPose(L, { lean: 16, y: 0, lF: [30, 130], lB: [140, 105], head: -6 });
  },
};

// Bake a set of animations for a rig look.
// defs: { name: { n, gen:'idle'|fn(t), loop, fps } | { keys, dur } }
function bakeRig(name, L, defs, w = 80, h = 64, ox = 40, oy = 56, scale = 1) {
  const pal = null;
  const out = { anims: {}, w, h, ox, oy };
  for (const an in defs) {
    const d = defs[an];
    const frames = [];
    if (d.keys) {
      const n = Math.max(2, Math.ceil(d.dur * ANIM_FPS) + 1);
      for (let i = 0; i < n; i++) {
        const t = Math.min(d.dur, i / ANIM_FPS);
        const pose = keyedPose(L, d.keys, t);
        frames.push(bakeSprite(w, h, x => { x.translate(ox, oy); x.scale(scale, scale); drawHumanoid(x, pose, L); }, { palette: pal, outline: L.outline }));
      }
      out.anims[an] = { frames, fps: ANIM_FPS, loop: false, timed: true };
    } else {
      const n = d.n || 1;
      for (let i = 0; i < n; i++) {
        const t = d.loop ? i / n : (n === 1 ? 0 : i / (n - 1));
        const pose = typeof d.gen === 'function' ? d.gen(L, t, i) : GEN[d.gen](L, t);
        frames.push(bakeSprite(w, h, x => { x.translate(ox, oy); x.scale(scale, scale); drawHumanoid(x, pose, L); }, { palette: pal, outline: L.outline }));
      }
      out.anims[an] = { frames, fps: d.fps || 10, loop: !!d.loop };
    }
  }
  SPR[name] = out;
  return out;
}

// pick a frame from an anim given elapsed time
function animFrame(spr, anim, t) {
  const a = spr.anims[anim] || spr.anims.idle;
  const n = a.frames.length;
  let i = Math.floor(t * a.fps);
  i = a.loop ? ((i % n) + n) % n : Math.min(n - 1, Math.max(0, i));
  return a.frames[i];
}
