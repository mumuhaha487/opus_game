/* =========================================================
   main.js —— 启动：载入素材与字体 → 标题画面 → 新游戏 / 继续 / 自由实验 / 章节
   ========================================================= */
(function () {
  'use strict';
  const M = (G.main = {});

  async function boot() {
    try {
      G.gfx.init(document.getElementById('cv'));
      await G.gfx.load();
      try { await Promise.race([document.fonts.load('12px PixelZH', '白线以内'), new Promise((r) => setTimeout(r, 2500))]); await document.fonts.ready; } catch (e) { /* ignore */ }
      G.dlg.init();
      G.ui.init();
      G.input.init();
      document.getElementById('app').classList.remove('booting');
      G.ui.showTitle();
      G.ui.layout();
      if (G.DEBUG) window.__G = G;
      // 游戏中读档：页面重新载入后直接进入选中的存档
      let pending = null;
      try { pending = JSON.parse(sessionStorage.getItem('wl_pending_load')); sessionStorage.removeItem('wl_pending_load'); } catch (e) { pending = null; }
      if (pending && pending.act) {
        // 重新载入后没有用户手势，声音在第一次点按 / 按键时恢复
        const wake = () => G.audio.init();
        window.addEventListener('pointerdown', wake, { once: true }); window.addEventListener('keydown', wake, { once: true });
        M.continueGame(pending); return;
      }
      if (/[?&]auto=(\w+)/.test(location.search)) { const m = location.search.match(/[?&]auto=(\w+)/)[1]; if (m === 'new') M.newGame(); if (m.startsWith('act')) M.chapter(+m.slice(3)); if (m === 'sandbox') M.sandbox(); }
    } catch (e) {
      console.error(e);
      document.getElementById('boot-msg').textContent = '载入失败：' + e.message;
    }
  }

  function enterGame() {
    document.getElementById('title').classList.add('hidden');
    document.getElementById('game').classList.remove('hidden');
    G.ui.layout();
    setTimeout(G.ui.layout, 50);
    G.game.start();
  }

  M.newGame = async function () {
    G.store.del('wl_save');
    G.story.flags = {}; G.story.done = {}; G.story.used = {};
    G.game.sandbox = false;
    enterGame();
    await G.story.startAct(1);
  };

  M.continueGame = async function (save) {
    G.story.flags = save.flags || {}; G.story.done = save.done || {}; G.story.used = save.used || {};
    G.clip.slots = (save.clip || []).map((c) => G.mkInst(c.t, c.o));
    G.clip.cap = save.cap || 3;
    G.game.loopNo = save.loopNo || 4097; G.game.fails = save.fails || 4096;
    G.game.sandbox = false;
    enterGame();
    G.audio.init();
    if (save.act === 1 && !G.story.done.a1_bomb) { await G.story.startAct(1, { quick: true }); if (G.story.flags.bookletRead) { G.ui.unlockScript(); G.story.setObj('a1_bomb'); } }
    else await G.story.startAct(Math.max(2, save.act), { quick: false });
  };

  // 读档：标题画面直接进入；游戏进行中先重新载入页面，避免两局的计时与场景叠在一起
  M.loadSave = function (save) {
    if (!save || !save.act) return;
    if (!document.getElementById('game').classList.contains('hidden')) {
      try { sessionStorage.setItem('wl_pending_load', JSON.stringify(save)); } catch (e) { return; }
      location.reload();
      return;
    }
    M.continueGame(save);
  };

  // 章节选择：为后面的章节补齐前置状态
  M.chapter = async function (act) {
    const S = G.story;
    S.flags = {}; S.done = {}; S.used = {};
    G.clip.slots = []; G.clip.cap = 3; G.game.loopNo = 4096 + act; G.game.fails = 4095 + act;
    if (act >= 2) { G.clip.slots = [G.mkInst('scripted', 'nana')]; S.flags.bookletRead = true; Object.assign(S.done, { a1_wake: 1, a1_book: 1, a1_bomb: 1, a1_void: 1 }); }
    if (act >= 3) { Object.assign(S.done, { a2_try: 1, a2_scan: 1, a2_crew: 1, a2_monitor: 1, a2_survive: 1 }); S.flags.monitorSeen = true; }
    if (act >= 4) { S.flags.shioriFree = true; S.flags.security = true; S.flags.kuroFree = false; Object.assign(S.done, { a3_gate: 1, a3_free: 1, a3_talk: 1, a3_det: 1 }); G.clip.cap = 7; G.clip.slots.push(G.mkInst('anomaly', 'stamp')); }
    enterGame();
    G.audio.init();
    if (act === 1) { await S.startAct(1); return; }
    await S.startAct(act);
  };

  // 自由实验：所有车厢与词条，没有巡检
  M.sandbox = async function () {
    const S = G.story;
    S.flags = { shioriFree: true, bookletRead: true, car03Thawed: false, noScan: true }; S.done = {};
    G.game.sandbox = true; G.game.sandboxNoScan = true;
    G.clip.slots = []; G.clip.cap = 8;
    enterGame();
    G.audio.init();
    G.game.act = 3;
    G.ui.lockFeatures(3);
    G.game.buildWorld(); G.game.t = 0; G.scan.reset(); G.game.room = 'car04';
    G.ui.enableSwap(true);
    G.audio.ambient(true, 0.6); G.audio.music('night');
    for (const k in G.TAGS) G.meta.tagsSeen[k] = 1;
    G.ui.setObjective('自由实验：打开「图鉴 → 词条库」，双击任意词条放进剪贴板。炸弹不会重置（可在菜单里重来）。');
    G.game.bombDelay = 1e6;
    G.ui.toast('自由实验模式：没有巡检，没有爆炸。尽情组合吧。');
  };

  window.addEventListener('load', boot);
})();
