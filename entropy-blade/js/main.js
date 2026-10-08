'use strict';
// =====================================================================
//  MAIN — boot (font + sprite baking), fixed-step loop, title scene
// =====================================================================
const Boot = {
  steps: [
    ['heroes', () => bakeHeroes()],
    ['portraits', () => Portraits.load()],
    ['enemies', () => { bakeEnemies(); bakeEnemies2(); }],
    ['bosses', () => { bakeBosses(); bakeBosses2(); }],
    ['misc', () => bakeMisc()],
    ['bg', () => { for (let i = 0; i < BIOMES.length; i++) buildBackground(i); }],
  ],
  async run() {
    G.state = 'boot';
    G.bootProgress = 0;
    await Text.load();
    for (let i = 0; i < this.steps.length; i++) {
      UI.draw(); Gfx.present(0);
      await new Promise(r => setTimeout(r, 0));
      await this.steps[i][1]();
      G.bootProgress = (i + 1) / this.steps.length;
    }
    G.state = 'title';
    UI.screen = 'press';
    Input.onFirstInput = () => { Sound.unlock(); Sound.resumePending(); };
    const q = new URLSearchParams(location.search);
    if (q.has('auto')) autoStart(q);
  },
};

// debug/testing hook: ?auto&hero=rin&room=combat&biome=1
function autoStart(q) {
  const hero = q.get('hero') || 'rin';
  // hard=fierce:2,edge:1  → 劫难挑战 with those curses
  let trial = null;
  if (q.get('hard')) { trial = {}; for (const t of q.get('hard').split(',')) { const [id, lv] = t.split(':'); trial[id] = +(lv || 1); } }
  startRun(hero, q.get('weapon'), trial);
  // scene=N (0..3) or legacy biome=N
  let scene = q.has('scene') ? +q.get('scene') : SCENES.findIndex(s => s.bi === +(q.get('biome') || 0));
  scene = clamp(scene < 0 ? 0 : scene, 0, SCENES.length - 1);
  G.run.scene = scene; G.run.biome = SCENES[scene].bi;
  const room = q.get('room');
  if (room) enterRoom({ type: room, reward: q.get('reward') || 'bless' });
  const P = G.player;
  if (q.has('god')) G.god = true;
  if (q.get('bless')) for (const id of q.get('bless').split(',')) if (UPG[id]) takeSigil(P, UPG[id]);
  // skills=rin_iai:2,rin_sakura:3   arts=rin_swallow:4   (id[:level])
  if (q.get('skills')) for (const t of q.get('skills').split(',')) { const [id, lv] = t.split(':'); const S = SKILLS[id]; if (S) P.secrets[S.slot] = { id, lv: +(lv || q.get('lv') || 1) }; }
  if (q.get('arts')) for (const t of q.get('arts').split(',')) { const [id, lv] = t.split(':'); const A = ARTS[id]; if (A) P.arts[A.slot] = { id, lv: +(lv || q.get('lv') || 1) }; }
  if (q.get('tech')) for (const t of q.get('tech').split(',')) P.tech[t] = true;
  P.recalc();
  if (q.has('mana') || q.has('energy')) { P.stats.manaRegen = 200; P.mana = P.stats.maxMana; }
  UI.screen = 'title';
}

// title scene: parallax city + hero on a rooftop
const TitleScene = { x: 0 };
function renderTitleWorld(dt) {
  const ctx = Gfx.wctx, gctx = Gfx.gctx;
  gctx.clearRect(0, 0, W, H);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  TitleScene.x += dt * 22;
  const bi = UI.screen === 'select' || UI.screen === 'trial' ? [0, 3, 1][UI.heroSel] : 0;
  drawBackground(ctx, gctx, bi, TitleScene.x, 0, G.rtime, H);
  drawWeather(ctx, gctx, bi, TitleScene.x, 0, G.rtime, dt, false);
  if (UI.screen === 'press' || UI.screen === 'title') {
    // grassy cliff edge overlooking the pass
    ctx.fillStyle = '#1f1714'; ctx.fillRect(0, 226, W, 44);
    ctx.fillStyle = '#33261f'; ctx.fillRect(0, 226, W, 6);
    ctx.fillStyle = '#4f8030'; ctx.fillRect(0, 226, W, 2);
    ctx.fillStyle = '#8cc850'; ctx.fillRect(0, 226, W, 1);
    for (let x = 0; x < W; x += 3) { const h = (x * 7919 % 5); ctx.fillStyle = h > 2 ? '#8cc850' : '#4f8030'; ctx.fillRect(x, 226 - h % 3, 1, h % 3 + 1); }
    ctx.fillStyle = '#4a3c34'; for (let x = 10; x < W; x += 37) ctx.fillRect(x, 236 + (x % 9), 5, 3);
    const spr = SPR.rin;
    if (spr) {
      const fr = animFrame(spr, 'idle', G.rtime);
      drawFrame(ctx, fr, spr.ox, spr.oy, 96, 226, false);
      gctx.globalAlpha = 0.25; drawFrame(gctx, fr, spr.ox, spr.oy, 96, 226, false, { tint: '#ff3b5c' }); gctx.globalAlpha = 1;
      const e = SPR.eve, g = SPR.gao;
      if (e) drawFrame(ctx, animFrame(e, 'idle', G.rtime + 0.4), e.ox, e.oy, 380, 226, true, { blend: '#0a0414', blendAmt: 0.45 });
      if (g) drawFrame(ctx, animFrame(g, 'idle', G.rtime + 0.8), g.ox, g.oy, 420, 226, true, { blend: '#0a0414', blendAmt: 0.45 });
    }
  }
  drawWeather(ctx, gctx, bi, TitleScene.x, 0, G.rtime, dt, true);
  ctx.drawImage(Gfx.vignette, 0, 0);
}

// ---------- main loop ----------
let lastT = performance.now(), acc = 0;
function step(dt) {
  if (G.freeze > 0 && G.state === 'play' && !G.overlay && !G.trans) {
    G.freeze--;
    Cam.update(dt);
    return; // keep pressed keys buffered through hitstop
  }
  Input.pollPad();
  G.rtime += dt;
  UI.update(dt);
  updTransition(dt);
  if (G.state === 'play' && !G.trans) {
    if (G.overlay) { /* paused by overlay */ }
    else {
      if (Input.hit('pause') && !G.player.dead) { G.overlay = { kind: 'pause', t: 0 }; UI.pauseSel = 0; Sound.play('confirm'); }
      else updatePlay(dt);
    }
  } else if (G.state === 'play' && G.trans) {
    FX.update(dt); Cam.update(dt);
  } else if (G.state === 'gameover' || G.state === 'victory') {
    FX.update(dt * 0.3);
  }
  Input.endStep();
}
function frame(now) {
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (dt > 0.25) dt = 0.25;
  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 5) { step(STEP); acc -= STEP; n++; }
  if (n >= 5) acc = 0;
  render(dt);
  requestAnimationFrame(frame);
}
function render(dt) {
  const glow = Save.data.settings.glow;
  if (G.state === 'boot') { UI.draw(); Gfx.present(0); return; }
  if (G.state === 'title') renderTitleWorld(dt);
  else if (G.room && G.player) renderWorld();
  UI.draw();
  Gfx.present(glow);
}

window.addEventListener('load', () => {
  Boot.run().catch(e => { console.error(e); document.title = 'BOOT ERROR'; });
  requestAnimationFrame(frame);
});
window.addEventListener('error', e => { console.error('runtime error', e.message, e.filename, e.lineno); });
// auto-pause when the window loses focus
window.addEventListener('blur', () => {
  if (G.state === 'play' && !G.overlay && !G.trans && G.player && !G.player.dead) { G.overlay = { kind: 'pause', t: 0 }; UI.pauseSel = 0; }
});
