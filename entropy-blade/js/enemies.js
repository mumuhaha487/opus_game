'use strict';
// =====================================================================
//  ENEMIES — sprites (3 biome palettes) + base class + AI
// =====================================================================
const EPAL = {
  bug: [
    { body: '#3e4a22', shell: '#5e6e2c', hi: '#a8b84a', leg: '#22260e', eye: '#ffb04a', core: '#ff8a3a' },
    { body: '#1c4456', shell: '#277082', hi: '#5ad8e8', leg: '#0f2836', eye: '#7ff7ff', core: '#7ff7ff' },
    { body: '#46121a', shell: '#741a26', hi: '#c43a3a', leg: '#28080e', eye: '#ffb347', core: '#ffd36a' },
    { body: '#4a5a72', shell: '#7a90b0', hi: '#dff0ff', leg: '#26303e', eye: '#9fe8ff', core: '#bff4ff' },
  ],
  mech: [
    { body: '#f0d08a', shell: '#b8342a', fin: '#3a2014', band: '#ffb04a', eye: '#ff5a2a', lantern: true },
    { body: '#2c5070', shell: '#4a7898', fin: '#1a3448', band: '#45f0ff', eye: '#45f0ff' },
    { body: '#4a1a26', shell: '#6e2a38', fin: '#2a0c14', band: '#e8b84a', eye: '#ffb347' },
    { body: '#d8e4f4', shell: '#5a7aa0', fin: '#2a3a52', band: '#9fd8ff', eye: '#7fd8ff' },
  ],
  beast: [
    { body: '#5a3a28', dark: '#34201a', belly: '#8a6a48', horn: '#efe2c8', eye: '#ffb04a' },
    { body: '#244a5a', dark: '#14303e', belly: '#3e7a8a', horn: '#bff8ff', eye: '#45f0ff' },
    { body: '#4a1a1a', dark: '#2a0a0e', belly: '#7a3020', horn: '#e8b84a', eye: '#ffb347' },
    { body: '#8a96a8', dark: '#4a5466', belly: '#d8e0ea', horn: '#f0f6ff', eye: '#7fd8ff' },
  ],
  robe: [
    { robe: '#5a2a32', robeD: '#33161c', trim: '#ffb04a', eye: '#ffb04a', orb: '#ffd08a' },
    { robe: '#1e4a64', robeD: '#10283a', trim: '#45f0ff', eye: '#7ff7ff', orb: '#9ff8ff' },
    { robe: '#2a0a14', robeD: '#16040a', trim: '#e8b84a', eye: '#ff3048', orb: '#ff6a5a' },
    { robe: '#3a4a6a', robeD: '#222c44', trim: '#bfe6ff', eye: '#9fe8ff', orb: '#dff4ff' },
  ],
  armor: [
    { armor: '#86302a', armorD: '#43181a', trim: '#e0a84a', visor: '#ffb04a', steel: '#dcd4c4', cloth: '#2c2622' },
    { armor: '#35607e', armorD: '#1e3a50', trim: '#45f0ff', visor: '#7ff7ff', steel: '#d8f0ff', cloth: '#16303e' },
    { armor: '#5e2232', armorD: '#36101a', trim: '#e8b84a', visor: '#ffb347', steel: '#e0c8b0', cloth: '#2a0c12' },
    { armor: '#4a5a7a', armorD: '#2a3248', trim: '#bfe6ff', visor: '#9fe8ff', steel: '#e8f0ff', cloth: '#1e2638' },
  ],
};
const BIOME_GLOW = ['#ffa040', '#45f0ff', '#ff3048', '#9fd8ff'];

// ---------- custom (non-rig) sprite bakers ----------
function bakeCustom(name, w, h, ox, oy, defs) {
  const out = { anims: {}, w, h, ox, oy };
  for (const an in defs) {
    const d = defs[an], frames = [];
    const n = d.n || 1;
    for (let i = 0; i < n; i++) {
      const t = d.loop ? i / n : (n === 1 ? 0 : i / (n - 1));
      frames.push(bakeSprite(w, h, x => { x.translate(ox, oy); d.draw(x, t, i); }, { outline: d.outline || '#0a0612' }));
    }
    out.anims[an] = { frames, fps: d.fps || 10, loop: !!d.loop };
  }
  SPR[name] = out;
  return out;
}

function drawCrawler(x, P, o) {
  const bob = Math.sin(o.t * TAU) * 0.7;
  const cy = -6 + (o.crouch || 0) * 2 + (o.walk ? bob : bob * 0.3) - (o.leap ? 2 : 0);
  for (let i = 0; i < 3; i++) {
    const lx = -5 + i * 5, ph = o.t * TAU + i * 2.1;
    const lift = o.walk ? Math.max(0, Math.sin(ph)) * 2 : 0;
    const fx = o.leap ? lx - 5 : lx - 2 + Math.cos(ph) * (o.walk ? 1.5 : 0);
    x.line(lx, cy + 2, fx, o.leap ? cy + 6 : -1 - lift, 1.4, P.leg);
  }
  x.ell(0, cy, 9, 5.5, 0, P.body);
  x.ell(-1, cy - 2, 8, 4.5, 0, P.shell);
  x.line(-7, cy - 4, 5, cy - 5, 1, P.hi);
  for (let k = 0; k < 3; k++) x.rect(-5 + k * 4, cy - 6, 1, 5, P.body);
  x.circ(8, cy + 1, 3.6, P.body);
  x.rect(9, cy - 0.5, 1.6, 1.6, o.glow ? '#ffffff' : P.eye);
  x.rect(10.8, cy + 1.2, 1, 1, P.eye);
  x.line(10, cy + 3, 12.6, cy + 4.6 + (o.crouch ? 1 : 0), 1, P.hi);
}
// biome 1: floating paper-lantern spirit (提灯鬼)
function drawLantern(x, P, o) {
  const cy = -14 + Math.sin(o.t * TAU) * 1.2;
  const sway = Math.sin(o.t * TAU * 2);
  x.line(0, cy - 9, sway, cy - 13, 1, P.fin);
  x.rect(-4.5, cy - 10, 9, 2.2, P.shell);
  x.rect(-4.5, cy + 7.5, 9, 2.2, P.shell);
  x.ell(0, cy - 1, 7.2, 8.6, 0, P.body);
  x.ell(-2.5, cy - 1, 3.2, 7.6, 0, shade(P.body, 0.25));
  for (let k = 0; k < 4; k++) x.rect(-6.5, cy - 6 + k * 3.4, 13, 0.8, shade(P.body, -0.28));
  x.ell(1.8, cy - 1, 3.4, 2.6, 0, '#2a0a08');
  x.circ(2.4, cy - 1, 1.6, o.glow ? '#ffffff' : P.eye);
  x.poly([[0, cy + 2.5], [3.5, cy + 2.5], [2.5, cy + 6.5 + sway]], '#c8241a');
  x.poly([[-2.5, cy + 9.5], [2.5, cy + 9.5], [sway, cy + 15 + Math.abs(sway) * 2]], P.band);
  x.circ(-9, cy + 1 + sway * 2, 1.4, P.band); x.circ(9, cy - 2 - sway * 2, 1.2, P.band);
}
function drawDrone(x, P, o) {
  if (P.lantern) return drawLantern(x, P, o);
  const cy = -12 + Math.sin(o.t * TAU) * 1;
  const fa = Math.abs(Math.sin(o.t * TAU * 2));
  x.ell(-9, cy, fa * 3 + 1, 6, 0, P.fin);
  x.ell(9, cy, fa * 3 + 1, 6, 0, P.fin);
  x.circ(0, cy, 7.5, P.shell);
  x.circ(-1, cy - 1, 6.4, P.body);
  x.rect(-7, cy - 1, 14, 2, P.band);
  x.circ(2, cy, 3.6, '#120a18');
  x.circ(2.6, cy, 2.3, o.glow ? '#ffffff' : P.eye);
  x.rect(3, cy - 1.4, 1, 1, '#ffffff');
  x.rect(-2, cy + 7, 4, 2, P.band);
  x.line(0, cy - 7, 0, cy - 10, 1, P.shell);
  x.rect(-0.5, cy - 11.5, 1.5, 1.5, P.band);
}
function drawBomber(x, P, o) {
  const bob = o.walk ? Math.abs(Math.sin(o.t * TAU * 2)) * 1.2 : 0;
  const cy = -7 - bob;
  for (let i = 0; i < 2; i++) {
    const ph = o.t * TAU * 2 + i * Math.PI;
    x.line(-3 + i * 6, cy + 4, -3 + i * 6 + (o.walk ? Math.cos(ph) * 2 : 0), -0.5, 1.6, P.leg);
  }
  x.circ(0, cy, 7.2, P.body);
  x.circ(-1.8, cy - 1.8, 4.6, P.shell);
  x.circ(-3, cy - 3.4, 1.4, P.hi);
  x.circ(1.6, cy + 1.2, 3, o.lit ? '#ffffff' : P.core);
  x.line(-2, cy - 7, -3, cy - 11, 1, '#4a6a2a');
  x.poly([[-3, cy - 10], [-7, cy - 13], [-4, cy - 9]], '#6a8a3a');
  x.circ(-3, cy - 11.5, o.lit ? 2 : 1.3, o.lit ? '#ffe14a' : P.core);
  x.rect(5, cy - 2.5, 1.4, 1.4, P.eye);
}
function drawCharger(x, P, o) {
  const run = o.run || 0;
  const ph = o.t * TAU;
  const bob = run ? Math.abs(Math.sin(ph)) * 1.5 : Math.sin(ph) * 0.5;
  const cy = -15 - bob + (o.crouch ? 2 : 0);
  const lean = o.charge ? 0.12 : 0;
  const legs = [[-10, 0], [-7, Math.PI], [7, Math.PI * 0.5], [10, Math.PI * 1.5]];
  legs.forEach(([lx, off], i) => {
    const s = run ? Math.sin(ph + off) : 0;
    const col = i % 2 ? P.dark : P.body;
    const kx = lx + s * 3, ky = cy + 8;
    x.line(lx, cy + 3, kx, ky, 3, col);
    x.line(kx, ky, kx - s * 2 - (o.crouch ? 2 : 0), -1, 2.4, col);
  });
  x.save(); x.rotate(lean);
  x.ell(0, cy, 13, 7.5, 0, P.body);
  for (let k = -9; k <= 6; k += 3) x.poly([[k, cy - 6], [k + 1.5, cy - 10 - (k % 2 ? 1 : 0)], [k + 3, cy - 6]], P.dark);
  x.ell(1, cy + 3.5, 10, 3, 0, P.belly);
  x.ell(13, cy - 1, 6, 5, 0.2, P.body);
  x.rect(15, cy - 0.5, 6, 4.5, P.body);
  x.poly([[12, cy - 4], [19, cy - 13], [22, cy - 12], [15.5, cy - 2]], P.horn);
  x.rect(15.5, cy - 3.2, 2.2, 1.6, o.glow ? '#ffffff' : P.eye);
  x.line(-12, cy - 2, -18, cy - 6 + Math.sin(ph * 2) * 2, 2, P.dark);
  x.restore();
}
function drawCaster(x, P, o) {
  const cy = -26 + Math.sin(o.t * TAU) * 1.5;
  const flow = Math.sin(o.t * TAU * 2);
  x.poly([[-7, cy - 6], [7, cy - 6], [11, cy + 18], [6, cy + 20 + flow], [0, cy + 18], [-6, cy + 21 - flow], [-12, cy + 18]], P.robe);
  x.poly([[-7, cy - 6], [-3, cy - 6], [-6, cy + 18], [-12, cy + 18]], P.robeD);
  x.rect(-0.5, cy + 2, 1, 12, P.trim);
  x.rect(-6, cy + 16, 16, 1, P.trim);
  // sleeves / arms
  const ar = o.cast ? -60 : 30;
  const hx = 6 + Math.cos(ar * DEG) * 9, hy = cy - 2 + Math.sin(ar * DEG) * 9;
  x.line(3, cy - 3, hx, hy, 3.4, P.robe);
  x.circ(hx + 2, hy - 1, o.cast ? 3.4 : 2.4, P.orb);
  // hood
  x.circ(1, cy - 10, 5.6, P.robeD);
  x.poly([[-5, cy - 13], [3, cy - 17], [8, cy - 9], [1, cy - 5], [-5, cy - 7]], P.robe);
  x.circ(3.4, cy - 9, 3, '#07020c');
  x.rect(3, cy - 10, 1.6, 1.1, P.eye); x.rect(5.6, cy - 10, 1.2, 1.1, P.eye);
}

// ---------- humanoid enemy looks ----------
function blade(x, h, ang, len, c) {
  local(x, h, ang, () => {
    x.line(-3, 0, 1, 0, 2, '#2a2030');
    x.rect(1, -1.5, 1.2, 3, c.trim);
    x.poly([[2, -1.4], [len - 3, -1.8], [len, 0.2], [len - 3, 1.6], [2, 1.2]], c.steel);
    x.line(3, 1, len - 3, 1.1, 0.8, shade(c.steel, -0.35));
  });
}
function soldierLook(bi) {
  const c = EPAL.armor[bi];
  return {
    build: BUILDS.normal,
    col: { pants: c.cloth, boot: '#141018', sleeve: c.armor, hand: c.armorD },
    kneePad: c.armorD,
    stance: { lean: 8, aF: [70, 30], aB: [100, 70], w: 20, lF: [68, 100], lB: [112, 92] },
    runArms: s => ({ aF: [75 + 30 * s, 20 + 20 * s], aB: [100 - 30 * s, 60 - 20 * s], w: 30 + 20 * s }),
    airArms: { aF: [10, -30], aB: [140, 120], w: -40 },
    torso(x, J, B, p) {
      drawTorsoBase(x, J, B, this, p, c.armor, c.armorD);
      vEll(x, J.chest.x + J.fw.x, J.chest.y + J.fw.y, 3.5, 3, p.lean * DEG, shade(c.armor, 0.15));
      vLine(x, { x: J.hip.x - J.fw.x * 3, y: J.hip.y - J.fw.y * 3 }, { x: J.hip.x + J.fw.x * 3, y: J.hip.y + J.fw.y * 3 }, 1.4, c.trim);
      vCirc(x, J.sF.x, J.sF.y, 2.8, shade(c.armor, 0.1));
    },
    head(x, J, B, p) {
      local(x, J.head, J.headA / DEG, () => {
        vCirc(x, 0, 0, 5.2, c.armor);
        vPoly(x, [[-5, -3], [-2, -8], [1, -5.5]], c.armorD);
        vPoly(x, [[0.5, -4.5], [-1.5, -10], [2.5, -6.5], [6.5, -10], [4.5, -4.5]], c.trim);
        vRect(x, -6, -1, 3, 5, c.armorD);
        vRect(x, 0.5, -1.2, 5, 2, '#0a0612');
        vRect(x, 1.5, -0.8, 3.8, 1.2, p.eye ? c.visor : '#3a2a3a');
        vRect(x, -5, 2, 6, 2, c.armorD);
      });
    },
    weapon(x, J, B, p) { blade(x, J.hF, p.w, 15, c); },
  };
}
function knightLook(bi) {
  const c = EPAL.armor[bi];
  const sh = shade(c.armor, -0.15);
  return {
    build: BUILDS.big,
    col: { pants: c.armorD, boot: '#121016', sleeve: c.armor, hand: c.armorD },
    kneePad: c.armor,
    stance: { lean: 6, aF: [50, 0], aB: [110, -60], w2: -70, lF: [70, 100], lB: [112, 92] },
    runArms: s => ({ aF: [50, 0], aB: [110 + 10 * s, -60], w2: -70 }),
    weapon2(x, J, B, p) {
      local(x, J.hB, p.w2, () => {
        x.line(-4, 0, 14, 0, 2, '#3a2a20');
        x.rect(10, -4, 7, 8, c.steel); x.rect(10, -4, 7, 1.4, '#ffffff'); x.rect(16, -3, 1.5, 6, shade(c.steel, -0.4));
      });
    },
    torso(x, J, B, p) {
      drawTorsoBase(x, J, B, this, p, c.armor, c.armorD);
      vLine(x, { x: J.chest.x - J.fw.x * 4, y: J.chest.y }, { x: J.chest.x + J.fw.x * 5, y: J.chest.y + J.fw.y * 5 }, 1.2, c.trim);
      vCirc(x, J.sB.x, J.sB.y, 4, sh);
    },
    head(x, J, B, p) {
      local(x, J.head, J.headA / DEG, () => {
        vCirc(x, 0, 0, 5.4, c.armor);
        vPoly(x, [[-3, -4], [-9, -9], [-5, -2]], c.steel);
        vRect(x, 1, -1, 4.6, 1.6, p.eye ? c.visor : '#3a2a3a');
        vRect(x, -2, 2.5, 7, 2.5, c.armorD);
      });
    },
    weapon(x, J, B, p) {
      local(x, J.hF, 0, () => {
        x.rect(-1, -15, 6, 28, sh);
        x.rect(0, -14, 4, 26, c.armor);
        x.rect(1, -14, 1, 26, shade(c.armor, 0.25));
        x.rect(1.5, -4, 2, 6, c.trim);
      });
    },
  };
}
function sniperLook(bi) {
  const c = EPAL.armor[bi];
  return {
    build: BUILDS.slim,
    col: { pants: c.cloth, boot: '#121016', sleeve: c.cloth, hand: c.armorD },
    stance: { lean: 4, aF: [10, 0], aB: [40, -10], w: 0, lF: [70, 100], lB: [112, 92] },
    runArms: s => ({ aF: [60 + 10 * s, 40], aB: [80, 30], w: 40 }),
    back(x, J, B, p) {
      const t = _seg(J.neck, 120 + Math.sin(p.wave * TAU) * 8, 16);
      vPoly(x, [[J.neck.x - 2, J.neck.y], [J.neck.x + 1, J.neck.y + 2], [t.x + 3, t.y], [t.x - 3, t.y - 1]], c.cloth);
    },
    torso(x, J, B, p) { drawTorsoBase(x, J, B, this, p, c.armorD, c.cloth); vLine(x, J.hip, J.neck, 1, c.trim); },
    head(x, J, B, p) {
      local(x, J.head, J.headA / DEG, () => {
        vCirc(x, 0, 0, 5.2, c.cloth);
        vPoly(x, [[-5, -3], [2, -7], [6, -2], [5, 3], [-4, 4]], c.cloth);
        vCirc(x, 2.6, 0.5, 2.6, '#07020c');
        vRect(x, 2.4, -0.4, 2.2, 1.6, p.eye ? c.visor : '#3a2a3a');
      });
    },
    weapon(x, J, B, p) {
      local(x, J.hF, p.w, () => {
        x.rect(-8, -1.5, 30, 3, '#2a2432'); x.rect(-8, -1.5, 30, 1, '#4a4258');
        x.rect(2, -4.5, 8, 2.5, '#1a1620'); x.rect(9, -4, 1.5, 1.5, c.visor);
        x.rect(-8, 1, 5, 3, '#2a2432');
      });
    },
  };
}

// ---------- bake all enemy sprites ----------
function bakeEnemies() {
  for (let bi = 0; bi < 4; bi++) {
    const B = EPAL.bug[bi], M = EPAL.mech[bi], BE = EPAL.beast[bi], R = EPAL.robe[bi];
    bakeCustom('crawler' + bi, 32, 24, 16, 22, {
      idle: { n: 4, loop: true, fps: 6, draw: (x, t) => drawCrawler(x, B, { t }) },
      walk: { n: 6, loop: true, fps: 12, draw: (x, t) => drawCrawler(x, B, { t, walk: true }) },
      windup: { n: 2, loop: true, fps: 16, draw: (x, t, i) => drawCrawler(x, B, { t, crouch: 1, glow: i === 0 }) },
      leap: { n: 1, draw: (x, t) => drawCrawler(x, B, { t, leap: true }) },
      hurt: { n: 1, draw: (x, t) => drawCrawler(x, B, { t: 0.25, crouch: 0.5 }) },
    });
    bakeCustom('drone' + bi, 32, 32, 16, 28, {
      idle: { n: 6, loop: true, fps: 12, draw: (x, t) => drawDrone(x, M, { t }) },
      aim: { n: 2, loop: true, fps: 14, draw: (x, t, i) => drawDrone(x, M, { t, glow: i === 0 }) },
      hurt: { n: 1, draw: x => drawDrone(x, M, { t: 0.1 }) },
    });
    bakeCustom('bomber' + bi, 28, 26, 14, 24, {
      idle: { n: 4, loop: true, fps: 6, draw: (x, t) => drawBomber(x, B, { t }) },
      walk: { n: 4, loop: true, fps: 14, draw: (x, t) => drawBomber(x, B, { t, walk: true }) },
      fuse: { n: 2, loop: true, fps: 14, draw: (x, t, i) => drawBomber(x, B, { t, lit: i === 0 }) },
      hurt: { n: 1, draw: x => drawBomber(x, B, { t: 0 }) },
    });
    bakeCustom('charger' + bi, 56, 40, 26, 37, {
      idle: { n: 4, loop: true, fps: 5, draw: (x, t) => drawCharger(x, BE, { t }) },
      walk: { n: 6, loop: true, fps: 10, draw: (x, t) => drawCharger(x, BE, { t, run: 1 }) },
      windup: { n: 2, loop: true, fps: 12, draw: (x, t, i) => drawCharger(x, BE, { t, crouch: 1, glow: i === 0 }) },
      charge: { n: 4, loop: true, fps: 16, draw: (x, t) => drawCharger(x, BE, { t, run: 1, charge: true, glow: true }) },
      hurt: { n: 1, draw: x => drawCharger(x, BE, { t: 0, crouch: 1 }) },
    });
    bakeCustom('caster' + bi, 48, 56, 24, 52, {
      idle: { n: 6, loop: true, fps: 8, draw: (x, t) => drawCaster(x, R, { t }) },
      cast: { n: 2, loop: true, fps: 10, draw: (x, t) => drawCaster(x, R, { t, cast: true }) },
      hurt: { n: 1, draw: x => drawCaster(x, R, { t: 0 }) },
    });
    const rigDefs = (L, extra) => Object.assign({
      idle: { n: 4, gen: 'idle', loop: true, fps: 6 },
      walk: { n: 8, gen: 'run', loop: true, fps: 10 },
      hurt: { n: 1, gen: 'hurt' },
      fall: { n: 1, gen: 'fall' },
    }, extra);
    const SL = soldierLook(bi);
    bakeRig('soldier' + bi, SL, rigDefs(SL, {
      windup: { n: 1, gen: L => fullPose(L, { lean: -6, aF: [-110, -130], aB: [120, 100], w: -140, lF: [70, 100], lB: [115, 95] }) },
      attack: { n: 3, fps: 20, gen: (L, t) => fullPose(L, { lean: 20 - t * 4, aF: [lerp(-40, 60, t), lerp(-20, 80, t)], aB: [140, 120], w: lerp(-30, 100, t), lF: [50, 95], lB: [125, 100] }) },
      lunge: { n: 1, gen: L => fullPose(L, { lean: 34, aF: [0, 0], aB: [160, 170], w: 0, lF: [20, 85], lB: [150, 140] }) },
    }));
    const KL = knightLook(bi);
    bakeRig('knight' + bi, KL, rigDefs(KL, {
      windup: { n: 1, gen: L => fullPose(L, { lean: -10, aB: [-140, -150], w2: -150, aF: [60, 10] }) },
      attack: { n: 3, fps: 20, gen: (L, t) => fullPose(L, { lean: lerp(-4, 26, t), aB: [lerp(-120, 50, t), lerp(-120, 80, t)], w2: lerp(-120, 85, t), aF: [70, 30], lF: [40, 100], lB: [130, 100] }) },
      guard: { n: 1, gen: L => fullPose(L, { lean: 12, aF: [20, -10], aB: [110, -60], w2: -70 }) },
    }), 96, 72, 48, 64);
    const NL = sniperLook(bi);
    bakeRig('sniper' + bi, NL, rigDefs(NL, {
      aim: { n: 1, gen: L => fullPose(L, { lean: 6, aF: [5, -2], aB: [20, -10], w: -2, lF: [55, 115], lB: [125, 95], y: 1 }) },
      fire: { n: 1, gen: L => fullPose(L, { lean: -6, aF: [-15, -20], aB: [5, -25], w: -20, lF: [62, 110], lB: [118, 95] }) },
    }));
  }
}

// =====================================================================
//  ENEMY DEFINITIONS
// =====================================================================
const ENEMY_DEFS = {
  crawler: { name: '蚀虫', hp: 34, w: 16, h: 12, speed: 58, kb: 1.3, poise: 0, gold: [2, 4], dmg: 9, spr: 'crawler', cost: 1 },
  soldier: { name: '裂隙兵', hp: 60, w: 14, h: 30, speed: 64, kb: 1, poise: 0, gold: [3, 6], dmg: 12, spr: 'soldier', cost: 2 },
  drone: { name: '浮游眼', hp: 38, w: 16, h: 16, speed: 90, kb: 1.2, poise: 0, gold: [3, 5], dmg: 9, spr: 'drone', cost: 2, flying: true },
  bomber: { name: '爆破虫', hp: 26, w: 14, h: 14, speed: 100, kb: 1.4, poise: 0, gold: [2, 3], dmg: 22, spr: 'bomber', cost: 1.5 },
  charger: { name: '裂角兽', hp: 130, w: 30, h: 22, speed: 52, kb: 0.55, poise: 6, gold: [6, 10], dmg: 18, spr: 'charger', cost: 3.5 },
  knight: { name: '盾卫', hp: 160, w: 20, h: 34, speed: 36, kb: 0.4, poise: 7, gold: [7, 11], dmg: 20, spr: 'knight', cost: 4 },
  sniper: { name: '狙击者', hp: 50, w: 12, h: 30, speed: 72, kb: 1, poise: 0, gold: [5, 8], dmg: 16, spr: 'sniper', cost: 3 },
  caster: { name: '虚咒师', hp: 76, w: 14, h: 30, speed: 70, kb: 0.9, poise: 0, gold: [6, 9], dmg: 12, spr: 'caster', cost: 3.5, flying: true },
};

class Enemy extends Ent {
  constructor(type, x, y, o = {}) {
    const D = ENEMY_DEFS[type] || o.def;
    super(x, y, D.w, D.h);
    this.type = type; this.D = D;
    this.bi = G.room ? G.room.bi : 0;
    this.spr = SPR[D.spr + this.bi] || SPR[D.spr];
    const diff = G.run ? G.run.diff : { hp: 1, dmg: 1 };
    this.elite = !!o.elite;
    const H = G.run && G.run.hard;
    this.maxHp = this.hp = Math.round(D.hp * diff.hp * (this.elite ? 2.6 * (H ? H.eliteHp : 1) : 1));
    this.dmgMul = diff.dmg * (this.elite ? 1.3 : 1);
    this.speedMul = this.elite ? 1.15 : 1;
    this.state = 'idle'; this.stT = 0; this.st = newStatus();
    this.poiseDmg = 0; this.face = G.player && G.player.x < x ? -1 : 1;
    this.spawning = !o.noSpawn; this.spawnT = 0.8;
    this.anim = 'idle'; this.animT = rand(0, 1);
    this.cd = rand(0.6, 1.6); this.tele = 0; this.shield = 0;
    this.flying = !!D.flying;
    this.hoverY = y;
    if (this.elite) {
      this.affix = o.affix || pick(['shield', 'swift', 'volatile', 'regen']);
      if (this.affix === 'shield') this.shield = this.maxHp * 0.5;
      if (this.affix === 'swift') this.speedMul = 1.45;
    }
    if (this.spawning) { Sound.play('spawn', { x }); }
  }
  get boss() { return false; }
  takenMult(h) {
    let m = 1;
    if (this.st.vulnT > 0) m *= 1.2;
    if (this.state === 'stun') m *= 1.25;
    return m;
  }
  frame() { return animFrame(this.spr, this.anim, this.animT); }
  setState(s, anim) { this.state = s; this.stT = 0; if (anim) this.setAnim(anim); }
  setAnim(a) { if (this.anim !== a) { this.anim = a; this.animT = 0; } }
  telegraph(t = 0.45) { this.tele = t; Sound.play('warn', { x: this.x }); }
  attackBox(rel, dmg, dur, o = {}) { return Combat.box(this, 'e', rel, { dmg: dmg * this.dmgMul, chill: o.chill }, dur, o); }
  shot(x, y, ang, sp, o = {}) {
    const pr = new Proj(Object.assign({ team: 'e', x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: 3, dmg: (o.dmg || this.D.dmg) * this.dmgMul, kind: 'orb', c: BIOME_GLOW[this.bi], c2: '#ffffff', life: 4 }, o));
    pr.dmg = (o.dmg || this.D.dmg) * this.dmgMul;
    G.projs.push(pr);
    return pr;
  }
  toTarget() { const p = G.player; if (!p || p.dead) return null; return { dx: p.x - this.x, dy: p.y - this.y, d: Math.abs(p.x - this.x), p }; }
  faceTarget() { const t = this.toTarget(); if (t && Math.abs(t.dx) > 2) this.face = sign(t.dx); }
  onHurt(h, dmg, srcX, blocked) {
    if (this.dead) return;
    if (blocked) { this.vx = h.dir * 70; return; }
    if (this.held) return;
    if (this.D.preHurt && this.D.preHurt(this, h)) return;
    if (this.D.poise > 0 || this.armorNow) {
      this.poiseDmg += h.heavy ? 3 : (h.launch ? 2 : 1);
      if (this.poiseDmg < (this.D.poise || 4) * (this.elite ? 1.5 : 1)) { this.vx += h.dir * (h.kx || 0) * 0.12; return; }
      this.poiseDmg = 0;
      FX.text(this.x, this.y - this.h - 6, '破防', '#ffd36a', { size: 8 });
    }
    this.cancelAttack();
    this.state = 'hurt'; this.stT = 0;
    this.hurtDur = (h.stun || 0.3) * (this.D.stunMul || 1);
    this.vx = h.dir * (h.kx || 0) * this.D.kb;
    const kb = Math.min(1, this.D.kb);
    if (h.launch || !this.onGround || (h.ky || 0) > 0) this.vy = (h.ky || 0) * kb * (this.flying ? 0.6 : 1);
    else if ((h.ky || 0) < -100) this.vy = (h.ky || 0) * 0.35 * kb;
    this.setAnim('hurt');
  }
  cancelAttack() {
    this.tele = 0;
    for (const b of Combat.boxes) if (b.owner === this) b.life = 0;
  }
  die(h) {
    if (this.dead) return;
    this.dead = true;
    const fr = this.frame();
    FX.disintegrate(fr, this.spr.ox, this.spr.oy, this.x, this.y, this.face < 0, BIOME_GLOW[this.bi], h && h.heavy ? 1.6 : 1);
    FX.flash(this.x, this.cy, 14, '#ffffff', 0.1);
    FX.ring(this.x, this.cy, 4, 22, BIOME_GLOW[this.bi], 0.3, 2);
    Sound.play('enemyDie', { x: this.x });
    this.cancelAttack();
    const [g0, g1] = this.D.gold;
    dropCoins(this.x, this.cy, Math.round(randi(g0, g1) * (this.elite ? 3 : 1)));
    if (chance(0.035 + (this.elite ? 0.25 : 0))) G.pickups.push(new Pickup('heal', this.x, this.cy));
    if (this.elite && this.affix === 'volatile') later(0.35, () => explodeE(this.x, this.cy, 38, 14 * this.dmgMul));
    if (this.onDeath) this.onDeath();
    if (this.D.onDeath) this.D.onDeath(this);
    this.hidden = false; this.intangible = false;
    G.onEnemyKilled(this);
  }
  update(dt) {
    if (this.spawning) {
      this.spawnT -= dt;
      if (Math.random() < 0.6) FX.add({ k: 'px', x: this.x + rand(-12, 12), y: this.y - rand(0, 4), vx: 0, vy: -rand(40, 90), life: 0.4, s: 2, c: BIOME_GLOW[this.bi], glow: true, add: true, shrink: true });
      if (this.spawnT <= 0) { this.spawning = false; FX.flash(this.x, this.cy, 12, BIOME_GLOW[this.bi], 0.15); FX.ring(this.x, this.y - 2, 4, 20, BIOME_GLOW[this.bi], 0.3, 2, 0.35); }
      return;
    }
    if (this.dead) return;
    tickStatus(this, dt);
    if (this.dead) return;
    this.flash -= dt; this.tele -= dt;
    if (this.held) { this.vx = 0; this.vy = 0; this.animT += dt; this.setAnim('hurt'); return; }
    this.poiseDmg = Math.max(0, this.poiseDmg - dt * 1.2);
    if (this.elite && this.affix === 'regen' && G.time - (this.lastHitT || 0) > 3) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.04 * dt);
    const frozen = this.st.stun > 0;
    if (frozen && this.state !== 'hurt') { this.cancelAttack(); }
    const slow = frozen ? 0 : 1 - Math.min(0.6, this.st.slow);
    const sdt = dt * slow * (G.run && G.run.hard ? G.run.hard.enemySpeed : 1);
    this.stT += sdt; this.cd -= sdt;
    this.animT += sdt;
    if (!frozen && !(G.cine > 0)) {
      if (this.state === 'hurt') {
        if (this.stT >= this.hurtDur && (this.onGround || this.flying || this.stT > 1.6)) { this.state = 'idle'; this.stT = 0; this.cd = Math.max(this.cd, 0.35); }
      } else if (G.player && !G.player.dead) this.ai(sdt);
      else { this.vx = approach(this.vx, 0, 400 * dt); this.setAnim('idle'); }
    } else if (frozen) this.vx = approach(this.vx, 0, 300 * dt);
    // physics
    if (this.flying && this.state !== 'hurt' && !frozen) {
      // flyers manage their own vy in ai
    } else {
      const g = this.state === 'hurt' && !this.onGround ? 0.55 : 1;
      this.vy = Math.min(this.vy + GRAV * g * dt, this.state === 'hurt' ? 300 : 520);
      if (this.flying && this.state === 'hurt') this.vy *= 0.92;
    }
    if (this.onGround && this.state === 'hurt') this.vx = approach(this.vx, 0, 500 * dt);
    if (this.flying && frozen) { this.vy = Math.min(this.vy + GRAV * dt, 400); }
    moveBody(this, dt, G.room);
  }
  // ---------- drawing ----------
  draw(ctx, gctx, cx, cy) {
    const x = this.x - cx, y = this.y - cy;
    if (x < -80 || x > W + 80 || y < -100 || y > H + 100) return;
    if (this.hidden) { if (this.drawExtra) this.drawExtra(ctx, gctx, x, y); return; }
    const glow = BIOME_GLOW[this.bi];
    if (this.spawning) {
      const k = 1 - this.spawnT / 0.8;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = glow; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, y - 1, 16 * k + 2, 4 * k + 1, 0, 0, TAU); ctx.stroke();
      gctx.fillStyle = glow; gctx.globalAlpha = 0.6; gctx.beginPath(); gctx.ellipse(x, y - 1, 16 * k + 2, 5, 0, 0, TAU); gctx.fill(); gctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      if (k > 0.6) drawFrame(ctx, this.frame(), this.spr.ox, this.spr.oy, x, y, this.face < 0, { tint: glow, alpha: (k - 0.6) / 0.4 });
      return;
    }
    const fr = this.frame();
    // shadow
    if (!this.flying) {
      ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
      const gy = G.room.floorBelow(this.x, this.y - 2) - cy;
      ctx.fillRect(Math.round(x - this.w / 2), Math.round(gy - 1), Math.round(this.w), 2);
      ctx.globalAlpha = 1;
    }
    if (this.elite) {
      const ec = this.affix === 'shield' ? '#7fd8ff' : this.affix === 'swift' ? '#ffe14a' : this.affix === 'volatile' ? '#ff6a2a' : '#6aff8a';
      const a = 0.55 + 0.25 * Math.sin(G.time * 6);
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawFrame(ctx, fr, this.spr.ox, this.spr.oy, x + ox, y + oy, this.face < 0, { tint: ec, alpha: a });
      drawFrame(gctx, fr, this.spr.ox, this.spr.oy, x, y, this.face < 0, { tint: ec, alpha: 0.5 });
    }
    const st = this.st;
    const o = { white: this.flash > 0 };
    if (!o.white) {
      if (this.tele > 0 && Math.floor(G.time * 16) % 2) { o.blend = '#ff3048'; o.blendAmt = 0.5; }
      else if (st.stun > 0) { o.blend = '#ffe9a0'; o.blendAmt = 0.25; }
      else if (st.slowT > 0) { o.blend = '#9ab8ff'; o.blendAmt = 0.3; }
      else if (G.witchT > 0) { o.blend = '#6a7aff'; o.blendAmt = 0.25; }
    }
    if (this.blink) o.alpha = this.blink;
    drawFrame(ctx, fr, this.spr.ox, this.spr.oy, x, y, this.face < 0, o);
    if (st.stun > 0) for (let i = 0; i < 3; i++) {
      const a = G.time * 7 + i * TAU / 3;
      ctx.fillStyle = '#ffe14a'; ctx.fillRect(Math.round(x + Math.cos(a) * 8), Math.round(y - this.h - 4 + Math.sin(a) * 2), 2, 2);
    }
    if (st.mark > 0) {
      const my = y - this.h - 16 + Math.sin(G.time * 6);
      ctx.fillStyle = '#ff4a6a';
      ctx.beginPath(); ctx.moveTo(x, my - 3); ctx.lineTo(x + 3, my); ctx.lineTo(x, my + 3); ctx.lineTo(x - 3, my); ctx.fill();
      gctx.fillStyle = '#ff4a6a'; gctx.fillRect(x - 3, my - 3, 6, 6);
    }
    if (this.shield > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(127,216,255,0.7)';
      ctx.beginPath(); ctx.arc(x, y - this.h / 2, Math.max(this.w, this.h) * 0.75, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (this.tele > 0) {
      Text.draw(ctx, '!', x, y - this.h - 14 - Math.sin(G.time * 20), { size: 12, color: '#ff3048', outline: '#200008', align: 'center' });
      gctx.fillStyle = '#ff3048'; gctx.fillRect(x - 2, y - this.h - 14, 4, 10);
    }
    if (this.drawExtra) this.drawExtra(ctx, gctx, x, y);
    // health bar
    if ((this.hp < this.maxHp || this.elite) && !this.dead) {
      const bw = Math.max(16, Math.min(34, this.w + 8)), by = y - this.h - 7;
      ctx.fillStyle = '#12081c'; ctx.fillRect(Math.round(x - bw / 2) - 1, Math.round(by) - 1, bw + 2, 4);
      ctx.fillStyle = '#3a1020'; ctx.fillRect(Math.round(x - bw / 2), Math.round(by), bw, 2);
      ctx.fillStyle = this.elite ? '#ffd23f' : '#ff3b5c';
      ctx.fillRect(Math.round(x - bw / 2), Math.round(by), Math.max(1, Math.round(bw * this.hp / this.maxHp)), 2);
      if (this.shield > 0) { ctx.fillStyle = '#7fd8ff'; ctx.fillRect(Math.round(x - bw / 2), Math.round(by) - 2, Math.round(bw * Math.min(1, this.shield / (this.maxHp * 0.5))), 1); }
      if (this.elite) {
        const name = { shield: '护盾', swift: '迅捷', volatile: '自爆', regen: '再生' }[this.affix] || '';
        Text.draw(ctx, '精英·' + name, x, by - 11, { size: 8, color: '#ffd23f', outline: '#12081c', align: 'center' });
      }
    }
  }
}

// =====================================================================
//  AI per type
// =====================================================================
Enemy.prototype.ai = function (dt) { AI[this.type](this, dt); };
const AI = {
  crawler(e, dt) {
    const t = e.toTarget();
    switch (e.state) {
      case 'idle': case 'walk': {
        e.faceTarget();
        if (t.d < 90 && Math.abs(t.dy) < 40 && e.cd <= 0 && e.onGround) { e.setState('windup', 'windup'); e.telegraph(0.45); e.vx = 0; break; }
        const want = t.d > 18 ? e.face * e.D.speed * e.speedMul : 0;
        if (!canWalk(e, e.face, G.room) && e.onGround) { e.vx = 0; if (e.cd <= 0 && Math.abs(t.dy) < 60) { e.setState('windup', 'windup'); e.telegraph(0.45); } }
        else e.vx = approach(e.vx, want, 500 * dt);
        e.setAnim(Math.abs(e.vx) > 5 ? 'walk' : 'idle');
        break;
      }
      case 'windup':
        e.vx = 0;
        if (e.stT > 0.45) {
          e.setState('leap', 'leap');
          e.vx = e.face * clamp(t.d * 2.2, 120, 240); e.vy = -260;
          e.attackBox([-10, -14, 22, 16], e.D.dmg, 0.9);
          Sound.play('jump', { x: e.x, pitch: 0.6 });
        }
        break;
      case 'leap':
        if (e.onGround && e.stT > 0.1) { e.cancelAttack(); e.setState('recover', 'idle'); e.vx = 0; }
        break;
      case 'recover':
        e.vx = approach(e.vx, 0, 600 * dt);
        if (e.stT > 0.6) { e.setState('walk'); e.cd = rand(1.2, 2.2); }
        break;
      default: e.setState('walk');
    }
  },
  soldier(e, dt) {
    const t = e.toTarget();
    switch (e.state) {
      case 'idle': case 'walk': {
        e.faceTarget();
        if (t.d < 36 && Math.abs(t.dy) < 30 && e.cd <= 0) { e.setState('windup', 'windup'); e.telegraph(0.5); e.vx = 0; break; }
        if (e.bi >= 1 && t.d > 70 && t.d < 150 && Math.abs(t.dy) < 20 && e.cd <= 0 && chance(0.02)) { e.setState('lwind', 'windup'); e.telegraph(0.45); e.vx = 0; break; }
        const want = t.d > 28 ? e.face * e.D.speed * e.speedMul : 0;
        if (!canWalk(e, e.face, G.room) && e.onGround) e.vx = 0;
        else e.vx = approach(e.vx, want, 500 * dt);
        e.setAnim(Math.abs(e.vx) > 5 ? 'walk' : 'idle');
        break;
      }
      case 'windup':
        e.vx = 0;
        if (e.stT > 0.5) {
          e.setState('attack', 'attack');
          e.vx = e.face * 110;
          e.attackBox([-2, -34, 40, 32], e.D.dmg, 0.12);
          FX.slash(e.x + e.face * 6, e.y - 18, { r: 20, a0: -110, a1: 70, th: 6, c: BIOME_GLOW[e.bi], f: e.face, dur: 0.18, sy: 0.9 });
          Sound.play('slash', { x: e.x, pitch: 0.8 });
        }
        break;
      case 'lwind':
        e.vx = 0;
        if (e.stT > 0.45) {
          e.setState('lunge', 'lunge');
          e.vx = e.face * 300;
          e.attackBox([-2, -30, 34, 26], e.D.dmg, 0.3);
          Sound.play('dash', { x: e.x, pitch: 0.8 });
        }
        break;
      case 'lunge':
        if (Math.random() < 0.7) FX.ghost(e.frame(), e.spr.ox, e.spr.oy, e.x, e.y, e.face < 0, BIOME_GLOW[e.bi], 0.2, 0.4);
        if (e.stT > 0.3 || e.hitWall) { e.setState('recover', 'idle'); }
        break;
      case 'attack':
        e.vx = approach(e.vx, 0, 900 * dt);
        if (e.stT > 0.25) e.setState('recover', 'idle');
        break;
      case 'recover':
        e.vx = approach(e.vx, 0, 900 * dt);
        if (e.stT > 0.55) { e.setState('walk'); e.cd = rand(1.0, 1.8); }
        break;
      default: e.setState('walk');
    }
  },
  drone(e, dt) {
    const t = e.toTarget();
    const side = e.x < t.p.x ? -1 : 1;
    const tx = t.p.x + side * 95, ty = t.p.y - 70 + Math.sin(G.time * 2 + e.id) * 10;
    e.faceTarget();
    switch (e.state) {
      case 'idle':
        e.vx = approach(e.vx, clamp((tx - e.x) * 2, -e.D.speed, e.D.speed) * e.speedMul, 300 * dt);
        e.vy = approach(e.vy, clamp((ty - e.y) * 2, -80, 80), 300 * dt);
        e.setAnim('idle');
        if (e.cd <= 0 && G.room.los(e.x, e.cy, t.p.x, t.p.cy)) { e.setState('aim', 'aim'); e.telegraph(0.6); }
        break;
      case 'aim':
        e.vx = approach(e.vx, 0, 300 * dt); e.vy = approach(e.vy, 0, 300 * dt);
        if (e.stT > 0.6) {
          const a = Math.atan2(t.p.cy - e.cy, t.p.x - e.x);
          const n = e.bi >= 1 ? 3 : 1;
          for (let i = 0; i < n; i++) e.shot(e.x + Math.cos(a) * 8, e.cy + Math.sin(a) * 8, a + (i - (n - 1) / 2) * 0.28, 140 + e.bi * 15);
          Sound.play('laser', { x: e.x });
          e.vx = -Math.cos(a) * 60;
          e.setState('idle', 'idle'); e.cd = rand(2.0, 2.8);
        }
        break;
      default:
        e.setState('idle');
    }
  },
  bomber(e, dt) {
    const t = e.toTarget();
    switch (e.state) {
      case 'idle': case 'walk': {
        e.faceTarget();
        if (dist(e.x, e.cy, t.p.x, t.p.cy) < 34) { e.setState('fuse', 'fuse'); e.telegraph(0.6); Sound.play('charge', { x: e.x, pitch: 2 }); break; }
        const can = canWalk(e, e.face, G.room) || !e.onGround;
        e.vx = approach(e.vx, can ? e.face * e.D.speed * e.speedMul : 0, 700 * dt);
        if (!can && e.onGround && Math.abs(t.dy) > 20 && e.cd <= 0) { e.vy = -330; e.vx = e.face * 90; e.cd = 1; }
        e.setAnim('walk');
        break;
      }
      case 'fuse':
        e.vx = approach(e.vx, 0, 300 * dt);
        if (e.stT > 0.6) {
          e.boom = true;
          explodeE(e.x, e.cy, 40, e.D.dmg * e.dmgMul, { hurtsEnemies: 0, self: e });
          e.hp = 0; e.die({});
        }
        break;
      default: e.setState('walk');
    }
  },
  charger(e, dt) {
    const t = e.toTarget();
    switch (e.state) {
      case 'idle': case 'walk': {
        e.faceTarget();
        if (Math.abs(t.dy) < 40 && t.d < 260 && t.d > 30 && e.cd <= 0) { e.setState('windup', 'windup'); e.telegraph(0.7); e.vx = 0; Sound.play('charge', { x: e.x }); break; }
        const want = t.d > 40 ? e.face * e.D.speed * e.speedMul : 0;
        e.vx = canWalk(e, e.face, G.room) ? approach(e.vx, want, 300 * dt) : 0;
        e.setAnim(Math.abs(e.vx) > 5 ? 'walk' : 'idle');
        break;
      }
      case 'windup':
        e.vx = 0;
        if (Math.random() < 0.3) FX.dust(e.x - e.face * 10, e.y, 1, -e.face);
        if (e.stT > 0.7) {
          e.setState('charge', 'charge'); e.armorNow = true; e.cx0 = e.x;
          e.chargeBox = e.attackBox([-4, -24, 34, 24], e.D.dmg, 2);
        }
        break;
      case 'charge':
        e.vx = e.face * 330 * e.speedMul;
        if (Math.random() < 0.6) FX.dust(e.x - e.face * 12, e.y, 1, -e.face);
        if (e.hitWall || Math.abs(e.x - e.cx0) > 300 || e.stT > 1.3 || !groundAhead(e, e.face, G.room)) {
          if (e.chargeBox) e.chargeBox.life = 0;
          e.armorNow = false;
          if (e.hitWall) { Cam.shake(0.25); Sound.play('stomp', { x: e.x }); FX.debris(e.x + e.face * 14, e.y - 10, ['#a08a7a', '#605048'], 6); }
          e.setState('stun', 'hurt'); e.vx = -e.face * 60;
        }
        break;
      case 'stun':
        e.vx = approach(e.vx, 0, 300 * dt);
        if (Math.random() < 0.2) FX.add({ k: 'px', x: e.x + Math.cos(G.time * 8) * 8, y: e.y - e.h - 4 + Math.sin(G.time * 8) * 2, vx: 0, vy: 0, life: 0.1, s: 2, c: '#ffe14a', glow: true });
        if (e.stT > 1.1) { e.setState('walk'); e.cd = rand(2, 3); }
        break;
      default: e.setState('walk');
    }
  },
  knight(e, dt) {
    const t = e.toTarget();
    switch (e.state) {
      case 'idle': case 'walk': {
        e.faceTarget();
        if (t.d < 48 && Math.abs(t.dy) < 34 && e.cd <= 0) { e.setState('windup', 'windup'); e.telegraph(0.75); e.vx = 0; break; }
        const want = t.d > 34 ? e.face * e.D.speed * e.speedMul : 0;
        e.vx = canWalk(e, e.face, G.room) ? approach(e.vx, want, 300 * dt) : 0;
        e.setAnim(Math.abs(e.vx) > 4 ? 'walk' : 'guard');
        break;
      }
      case 'windup':
        e.vx = 0;
        if (e.stT > 0.75) {
          e.setState('attack', 'attack');
          e.attackBox([-4, -46, 52, 46], e.D.dmg, 0.14);
          const fx = e.x + e.face * 30;
          FX.shock(fx, e.y, BIOME_GLOW[e.bi], 30);
          FX.debris(fx, e.y - 2, ['#a08a7a', '#605048', BIOME_GLOW[e.bi]], 6);
          Sound.play('stomp', { x: e.x }); Cam.shake(0.25);
          later(0.05, () => { if (!e.dead) eShockwave(e, fx, e.y, e.face, e.D.dmg * 0.6 * e.dmgMul); });
        }
        break;
      case 'attack':
        if (e.stT > 0.3) e.setState('recover', 'idle');
        break;
      case 'recover':
        if (e.stT > 0.9) { e.setState('walk'); e.cd = rand(1.4, 2.2); }
        break;
      default: e.setState('walk');
    }
  },
  sniper(e, dt) {
    const t = e.toTarget();
    switch (e.state) {
      case 'idle': case 'walk': {
        e.faceTarget();
        if (t.d < 110 && e.onGround) {
          const away = -sign(t.dx) || 1;
          if (groundAhead(e, away, G.room)) { e.vx = approach(e.vx, away * e.D.speed * e.speedMul, 500 * dt); e.face = away; e.setAnim('walk'); }
          else { e.vx = 0; e.faceTarget(); if (e.cd <= 0) { e.setState('aim', 'aim'); e.telegraph(0.3); } }
          if (e.cd <= -1 && chance(0.02)) { e.vy = -300; e.vx = away * 140; }
        } else if (t.d > 280) {
          e.vx = groundAhead(e, e.face, G.room) ? approach(e.vx, e.face * e.D.speed, 500 * dt) : 0;
          e.setAnim('walk');
        } else {
          e.vx = approach(e.vx, 0, 600 * dt); e.setAnim('idle');
          if (e.cd <= 0) { e.setState('aim', 'aim'); }
        }
        break;
      }
      case 'aim': {
        e.vx = 0; e.faceTarget();
        if (e.stT < 1.0) { e.aimX = t.p.x; e.aimY = t.p.cy; }
        if (e.stT > 0.95 && !e.warned) { e.warned = true; e.telegraph(0.35); }
        if (e.stT > 1.3) {
          e.warned = false;
          const sx = e.x + e.face * 18, sy = e.y - 21;
          const a = Math.atan2(e.aimY - sy, e.aimX - sx);
          // 苍雪寒山 冰弓手: frost arrows chill on hit
          e.shot(sx, sy, a, 560, { kind: 'bullet', r: 2, len: 16, c: BIOME_GLOW[e.bi], life: 1.2, chill: e.bi === 3 ? 1.6 : 0 });
          if (e.bi === 3) for (const da of [-0.12, 0.12]) e.shot(sx, sy, a + da, 520, { kind: 'bullet', r: 1.6, len: 12, c: '#dff4ff', life: 1.0, chill: 1.0, dmg: e.D.dmg * 0.6 });
          Sound.play('laser', { x: e.x, pitch: 0.6 });
          FX.flash(sx, sy, 6, '#ffffff', 0.08);
          e.setState('recover', 'fire'); e.vx = -e.face * 60;
        }
        break;
      }
      case 'recover':
        e.vx = approach(e.vx, 0, 400 * dt);
        if (e.stT > 0.7) { e.setState('walk'); e.cd = rand(1.4, 2.2); }
        break;
      default: e.setState('walk');
    }
  },
  caster(e, dt) {
    const t = e.toTarget();
    switch (e.state) {
      case 'idle': {
        e.faceTarget();
        const tx = t.p.x - sign(t.dx || 1) * 120, ty = t.p.y - 30;
        e.vx = approach(e.vx, clamp((tx - e.x) * 1.5, -e.D.speed, e.D.speed), 200 * dt);
        e.vy = approach(e.vy, clamp((ty - e.y) * 1.5, -60, 60) + Math.sin(G.time * 3 + e.id) * 10, 200 * dt);
        e.setAnim('idle');
        if (e.cd <= 0) {
          const r = Math.random();
          if (r < 0.3 || t.d < 60) { e.setState('tpout'); Sound.play('teleport', { x: e.x }); }
          else if (r < 0.65) { e.setState('cast', 'cast'); e.telegraph(0.7); e.castKind = 'orbs'; }
          else { e.setState('cast', 'cast'); e.telegraph(0.6); e.castKind = 'rune'; }
        }
        break;
      }
      case 'cast':
        e.vx = approach(e.vx, 0, 300 * dt); e.vy = approach(e.vy, 0, 300 * dt);
        if (Math.random() < 0.5) FX.add({ k: 'px', x: e.x + e.face * 10 + rand(-6, 6), y: e.cy - 4 + rand(-6, 6), vx: 0, vy: -30, life: 0.3, s: 2, c: BIOME_GLOW[e.bi], glow: true, add: true });
        if (e.stT > 0.7) {
          if (e.castKind === 'orbs') {
            for (let i = 0; i < 3; i++) {
              const a = Math.atan2(t.p.cy - e.cy, t.p.x - e.x) + (i - 1) * 0.5;
              e.shot(e.x + e.face * 10, e.cy - 4, a, 95, { homing: 1.3, life: 4, r: 3.5 });
            }
            Sound.play('void', { x: e.x });
          } else {
            const rx = t.p.x, ry = G.room.floorBelow(t.p.x, t.p.y - 4);
            FX.circle(rx, ry, 18, BIOME_GLOW[e.bi], 0.9, { sy: 0.3, a: 0.5, pulse: true, layer: 0 });
            Sound.play('warn', { x: rx });
            later(0.9, () => {
              FX.add({ k: 'beam', x: rx, y: ry, len: 140, w: 16, ang: -Math.PI / 2, c: BIOME_GLOW[e.bi], life: 0.35 });
              Sound.play('thunder', { x: rx, pitch: 1.5 });
              Cam.shake(0.15);
              const p = G.player;
              if (p && Math.abs(p.x - rx) < 16 && p.y > ry - 140 && p.y <= ry + 2) hurtPlayer(18 * e.dmgMul, rx);
            });
          }
          e.setState('idle', 'idle'); e.cd = rand(2.2, 3.2);
        }
        break;
      case 'tpout':
        e.blink = 1 - e.stT / 0.3; e.intangible = true; e.vx = 0; e.vy = 0;
        if (e.stT > 0.3) {
          const side = chance(0.5) ? -1 : 1;
          e.x = clamp(t.p.x + side * rand(90, 140), 3 * TILE, G.room.pw - 3 * TILE);
          e.y = t.p.y - rand(20, 50);
          if (G.room.solidPx(e.x, e.y - 10)) e.y = t.p.y - 10;
          e.setState('tpin'); Sound.play('teleport', { x: e.x, pitch: 1.3 });
          FX.burst(e.x, e.cy, { n: 12, c: [BIOME_GLOW[e.bi], '#ffffff'], sp: [30, 90], glow: true });
        }
        break;
      case 'tpin':
        e.blink = e.stT / 0.3; e.intangible = false;
        if (e.stT > 0.3) { e.blink = 0; e.setState('idle'); e.cd = rand(0.4, 0.9); }
        break;
      default: e.setState('idle');
    }
  },
};
Enemy.prototype.blocks = function (h, srcX) {
  if (this.type === 'monk') {
    // 霜僧: spinning staff deflects anything from the front
    if (this.state !== 'spin' || h.src === 'ult' || h.dot || h.breakGuard) return false;
    return sign(srcX - this.x) === this.face;
  }
  if (this.type !== 'knight') return false;
  if (this.state === 'attack' || this.state === 'recover' || this.state === 'hurt' || this.st.stun > 0) return false;
  if (h.src === 'ult' || h.dot || h.breakGuard || h.src === 'counter') return false;
  if (h.heavy && chance(0.5)) return false;
  return sign(srcX - this.x) === this.face;
};
Enemy.prototype.drawExtra = function (ctx, gctx, x, y) {
  if (this.type === 'sniper' && this.state === 'aim') {
    const sx = x + this.face * 18, sy = y - 21;
    const ax = this.aimX - Cam.rx, ay = this.aimY - Cam.ry;
    const a = Math.atan2(ay - sy, ax - sx);
    const lock = this.stT > 1.0;
    ctx.globalAlpha = lock ? (Math.floor(G.time * 30) % 2 ? 0.9 : 0.4) : 0.45;
    ctx.strokeStyle = lock ? '#ffffff' : BIOME_GLOW[this.bi]; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a) * 400, sy + Math.sin(a) * 400); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (this.type === 'bomber' && this.state === 'fuse') {
    Light.add(this.x, this.cy, 50 + this.stT * 60, '#ff6a2a', 1);
  }
  if (EXTRA_DRAW[this.type]) EXTRA_DRAW[this.type](this, ctx, gctx, x, y);
};
const EXTRA_DRAW = {};

function eShockwave(e, x, y, dir, dmg) {
  const col = BIOME_GLOW[e.bi];
  const b = Combat.area('e', x - 8, y - 14, 16, 14, { dmg }, 0.6, { owner: e, face: dir });
  addZone({
    x, y, life: 0.6,
    upd(z, dt) {
      z.x += dir * 220 * dt; b.x = z.x - 8;
      if (Math.random() < 0.7) FX.add({ k: 'px', x: z.x + rand(-3, 3), y: y - rand(0, 6), vx: dir * rand(10, 40), vy: -rand(40, 120), g: 500, life: rand(0.2, 0.35), s: 2, c: pick([col, '#c8b8a0']), shrink: true, glow: true });
      if (G.room.solidPx(z.x + dir * 8, y - 4) || !G.room.solidPx(z.x, y + 4)) { z.life = 0; b.life = 0; }
    },
    drawFn(ctx, gctx, x2, y2, z) {
      const a = z.life / 0.6;
      ctx.fillStyle = rgba(col, 0.7 * a);
      ctx.beginPath(); ctx.moveTo(x2 - dir * 10, y2); ctx.lineTo(x2, y2 - 12 * a); ctx.lineTo(x2 + dir * 5, y2); ctx.closePath(); ctx.fill();
      gctx.fillStyle = col; gctx.globalAlpha = a; gctx.fillRect(x2 - 6, y2 - 10, 12, 10); gctx.globalAlpha = 1;
    },
  });
}

// =====================================================================
//  PICKUPS — coins, heal orbs
// =====================================================================
class Pickup extends Ent {
  constructor(kind, x, y, value = 1) {
    super(x, y, 6, 6);
    this.kind = kind; this.value = value; this.t = 0;
    this.vx = rand(-90, 90); this.vy = rand(-240, -120);
    this.noPlat = false;
  }
  update(dt) {
    this.t += dt;
    const p = G.player;
    if (p && !p.dead && this.t > 0.45) {
      const dx = p.x - this.x, dy = p.cy - (this.y - 3);
      const d = Math.hypot(dx, dy);
      if (d < (this.kind === 'coin' || this.kind === 'soul' ? 400 : 60) || this.t > 2.5) {
        const sp = Math.min(600, 150 + this.t * 300);
        this.vx = dx / d * sp; this.vy = dy / d * sp;
        this.x += this.vx * dt; this.y += this.vy * dt;
        if (d < 10) return this.collect(p);
        return true;
      }
    }
    this.vy = Math.min(this.vy + GRAV * dt, 400);
    this.vx *= Math.pow(0.2, dt);
    moveBody(this, dt, G.room);
    if (this.onGround) this.vx *= 0.8;
    return true;
  }
  collect(p) {
    if (this.kind === 'coin') {
      const v = Math.round(this.value * p.stats.goldMul);
      G.run.gold += v; G.stats.gold += v;
      Sound.play('coin', { x: this.x, pitch: rand(0.95, 1.15) });
      FX.add({ k: 'px', x: p.x, y: p.cy, vx: 0, vy: -40, life: 0.2, s: 2, c: '#ffd23f', glow: true });
    } else if (this.kind === 'heal') {
      p.heal(Math.round(p.maxHp * 0.12));
    } else if (this.kind === 'soul') {
      p.heal(2, true); p.gainMana(6);
      FX.burst(p.x, p.cy, { n: 6, c: ['#c88aff', '#ffffff'], sp: [20, 60], glow: true });
      Sound.play('pickup', { x: p.x, pitch: 1.8 });
    }
    return false;
  }
  draw(ctx, gctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy - 3);
    if (this.kind === 'coin') {
      const ph = Math.floor(this.t * 12 + this.id) % 4;
      const w = [4, 3, 1, 3][ph];
      ctx.fillStyle = '#7a4a10'; ctx.fillRect(x - w / 2 - 0.5 | 0, y - 2, w + 1, 5);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - w / 2 | 0, y - 2, w, 4);
      ctx.fillStyle = '#fff6b0'; ctx.fillRect(x - w / 2 | 0, y - 2, 1, 1);
      gctx.fillStyle = '#ffb000'; gctx.fillRect(x - 2, y - 3, 4, 5);
    } else if (this.kind === 'soul') {
      const f = Math.sin(this.t * 14);
      ctx.fillStyle = '#c88aff'; ctx.fillRect(x - 2, y - 2, 4, 4); ctx.fillRect(x - 1, y - 5 + Math.round(f), 2, 3);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 1, 2, 2);
      gctx.fillStyle = '#c88aff'; gctx.fillRect(x - 4, y - 6, 8, 10);
    } else {
      const s = 1 + 0.15 * Math.sin(this.t * 8);
      ctx.fillStyle = '#ff3b5c';
      ctx.fillRect(x - 3 * s | 0, y - 2, 3, 3); ctx.fillRect(x, y - 2, 3 * s | 0, 3); ctx.fillRect(x - 2, y, 4, 2); ctx.fillRect(x - 1, y + 2, 2, 1);
      ctx.fillStyle = '#ffd0d8'; ctx.fillRect(x - 2, y - 1, 1, 1);
      gctx.fillStyle = '#ff3b5c'; gctx.fillRect(x - 4, y - 4, 8, 8);
      Light.add(this.x, this.y, 40, '#ff3b5c', 0.6);
    }
  }
}
function dropCoins(x, y, n) {
  const big = Math.floor(n / 5);
  for (let i = 0; i < big; i++) G.pickups.push(new Pickup('coin', x, y, 5));
  for (let i = 0; i < n - big * 5; i++) G.pickups.push(new Pickup('coin', x, y, 1));
}
