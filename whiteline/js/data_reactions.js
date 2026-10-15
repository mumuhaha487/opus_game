/* =========================================================
   data_reactions.js —— 跨词条组合效果矩阵（化学反应）
   每条反应：t=[词条…]；on=宿主过滤；name/desc；mod=持续修饰；start/stop/tick=效果脚本
   未登记的组合仍会按“系统层”规则叠加生效（见 tagsys.js 的 composeName）。
   宿主过滤 on：'char' 角色 | 'npc' 非玩家角色 | 'player' | 'item' 物品 | 'door' | 'fixture' | '#id' 指定对象
   ========================================================= */
(function () {
  'use strict';
  const RX = (G.REACTIONS = []);
  const add = (r) => RX.push(r);

  // ============ 物理 × 物理 ============
  add({ id: 'hover', t: ['zerog', 'heavy'], name: '失重铁砧', desc: '沉重与零重力互相拉扯：它悬停在半空，慢慢上下浮沉，像潜水员一样慢动作。', mod: { hover: 0.55 } });
  add({ id: 'waterball', t: ['zerog', 'fluid'], name: '悬浮水球', desc: '液体失去重力，聚成一颗晃悠悠的水球在车厢里飘。碰到谁，谁就被溅一身。', mod: { waterball: true } });
  add({ id: 'maglev', t: ['zerog', 'magnet'], name: '磁悬浮卫星', desc: '它浮上半空，把车厢里所有金属吸成一圈绕着自己转的卫星。', mod: { orbit: true } });
  add({ id: 'bubble', t: ['zerog', 'fragile'], on: (e) => e.id !== 'balloon', name: '肥皂泡', desc: '轻飘飘地升到车顶——“啵”。碎了，词条像雪一样飘落。', once: true,
    start(e, R) { R.after(2.2, () => { if (e.alive) R.shatter(e, '啵！'); }, e); } });
  add({ id: 'hotair', t: ['zerog', 'giant'], name: '热气球', desc: '巨大的东西浮起来，顶在车顶上，挡住了一半灯光。下面的人都抬头看。', mod: { hover: 0.0 }, start(e, R) { R.sayNear(e, 60, ['哇……', '那是什么', '天花板要裂了']); } });
  add({ id: 'dust', t: ['zerog', 'mini'], name: '浮游尘埃', desc: '小得像一粒灰尘，在灯光里打着转飘。', mod: { dust: true } });
  add({ id: 'spacetumble', t: ['zerog', 'roll'], name: '太空翻滚', desc: '在半空中一圈一圈地翻滚，停不下来。', mod: { tumble: true } });
  add({ id: 'ghost', t: ['nocollide', 'zerog'], name: '幽灵', desc: '既不受重力也不受墙壁阻挡——它直直穿过车顶，飘出了车厢。', start(e, R) { R.toCeiling(e); } });
  add({ id: 'sink', t: ['nocollide', 'heavy'], name: '坠穿地板', desc: '又重又没有碰撞——它径直沉进地板，掉到了“床下”。那里是什么都没有渲染的空白。', start(e, R) { R.sinkFloor(e); } });
  add({ id: 'seep', t: ['nocollide', 'fluid'], name: '渗透', desc: '液体穿过一切，渗过墙壁流向隔壁的房间。', mod: { seep: true } });
  add({ id: 'ghostmag', t: ['nocollide', 'magnet'], name: '隔墙磁场', desc: '磁场穿过墙壁——隔壁房间的金属也被吸了过来。', mod: { magnetThroughWalls: true } });
  add({ id: 'glassghost', t: ['nocollide', 'fragile'], name: '无敌的玻璃', desc: '什么也碰不到它，所以它永远不会碎。', say: ['我……无敌了？'] });
  add({ id: 'bigshadow', t: ['nocollide', 'giant'], name: '巨影', desc: '一个半透明的巨大身影重叠在所有东西上。乘客们以为闹鬼了。', start(e, R) { R.panic(e.room, e, 80); } });
  add({ id: 'ferro', t: ['fluid', 'magnet'], name: '磁流体', desc: '水洼竖起一根根尖刺，把附近的金属吞进去。', mod: { ferro: true, swallowMetal: true } });
  add({ id: 'iceshard', t: ['fluid', 'fragile'], name: '薄冰', desc: '液体结成一层脆冰。走在上面的人会滑倒，冰面随即碎裂。', mod: { ice: true, slippery: true } });
  add({ id: 'mercury', t: ['fluid', 'heavy'], name: '水银', desc: '沉重的液体缓缓流动，压碎一切易碎的东西。', mod: { crushFragile: true } });
  add({ id: 'flood', t: ['fluid', 'giant'], name: '漫水', desc: '水漫过了整节车厢的地板：所有人只能蹚着水慢慢走，显示屏也短路了。', mod: { flood: true }, start(e, R) { R.flood(e.room, true); }, stop(e, R) { R.flood(e.room, false); } });
  add({ id: 'drip', t: ['fluid', 'mini'], name: '一滴', desc: '缩成小小的一滴——二十秒后，它就会蒸发。', once: true, start(e, R) { R.after(20, () => { if (e.alive && e.f.fluid && e.f.mini) R.destroy(e, 'vanish', '蒸发了'); }, e); } });
  add({ id: 'liquidmetal', t: ['fluid', 'metal'], name: '液态金属', desc: '一滩会被磁铁吸着走的银色液体。' });
  add({ id: 'waves', t: ['fluid', 'roll'], name: '浪', desc: '液体随列车摇晃来回晃荡，拍打着车厢两端。', mod: { slosh: true } });
  add({ id: 'selfstick', t: ['magnet', 'metal'], name: '自吸', desc: '自己吸自己，然后一头撞上最近的钢板墙——牢牢粘在了上面。', mod: { stickWall: true }, start(e, R) { R.sfx('magnet'); } });
  add({ id: 'magcrush', t: ['magnet', 'fragile'], name: '磁碎', desc: '吸来的金属狠狠砸在它身上——碎了。', once: true, start(e, R) { R.after(1.5, () => { if (e.alive && R.nearMetal(e, 140)) R.shatter(e, '咔嚓'); }, e); } });
  add({ id: 'anchor', t: ['magnet', 'heavy'], name: '磁铁锚', desc: '纹丝不动的磁铁：所有金属都堆在它身边，谁也搬不动。', mod: { anchor: true } });
  add({ id: 'supermag', t: ['magnet', 'giant'], name: '超级磁铁', desc: '磁场覆盖全车厢：吊环都朝它倾斜，车掌口袋里的钥匙也飞了出来。', mod: { magRange: 400 }, start(e, R) { R.keysFly(e); } });
  add({ id: 'selfcrush', t: ['fragile', 'heavy'], name: '自重崩塌', desc: '它承受不住自己的重量——当场碎裂，词条散了一地。', once: true, start(e, R) { R.after(0.6, () => e.alive && R.shatter(e, '咔啦啦')); } });
  add({ id: 'bigglass', t: ['fragile', 'giant'], name: '巨型玻璃', desc: '巨大又易碎。谁不小心碰一下，整个车厢都会听到碎裂声。' });
  add({ id: 'rollchina', t: ['fragile', 'roll'], name: '滚动的瓷器', desc: '一路滚、一路晃，迟早撞上墙。', mod: { rollToBreak: true } });
  add({ id: 'tilt', t: ['heavy', 'giant'], name: '千斤', desc: '车厢朝它那一侧倾斜了：所有会滚的东西都朝它滚过去。', mod: { tiltSource: true } });
  add({ id: 'bowling', t: ['heavy', 'roll'], name: '保龄球', desc: '沉重地滚过车厢，撞倒路上的每一个人。', mod: { bowling: true } });
  add({ id: 'scaleclash', t: ['giant', 'mini'], name: '尺寸冲突', desc: '「スケール矛盾」——它在大与小之间来回跳，像在呼吸。', mod: { flickerScale: true } });
  add({ id: 'clearglass', t: ['clear', 'fragile'], name: '看不见的玻璃', desc: '谁也看不见它，于是谁都会撞上去。' });
  add({ id: 'clearmagnet', t: ['clear', 'magnet'], name: '隐形磁铁', desc: '金属自己朝空无一物的地方飞去——乘客们吓坏了。', start(e, R) { R.sayNear(e, 90, ['罐子自己飞了？！', '闹鬼了……']); } });

  // ============ 时间 × 时间 ============
  add({ id: 'cancel', t: ['fast', 'slow'], name: '时速抵消', desc: '快与慢互相抵消，它以正常速度运动——只是每隔一会儿抽搐一下。', mod: { jitter: true } });
  add({ id: 'fastrewind', t: ['fast', 'reverse'], name: '快退', desc: '最近三十秒的动作被飞快地倒带回去。' });
  add({ id: 'zerotimes', t: ['fast', 'still'], name: '0 × 2 = 0', desc: '静止的东西加速两倍——还是静止。系统在日志里写下：「0 × 2 = 0。」', start(e, R) { R.sys('「0 × 2 = 0」'); } });
  add({ id: 'twitchloop', t: ['fast', 'loop'], name: '抽搐循环', desc: '半秒长的动作被以两倍速无限重复——它在原地剧烈抖动。', mod: { loopLen: 0.5 } });
  add({ id: 'hurrylate', t: ['fast', 'delay'], name: '提前迟到', desc: '它动作飞快，却总是慢五秒才开始。' });
  add({ id: 'thaw', t: ['reverse', 'still'], name: '解冻', desc: '时间从静止的那一刻开始倒流——冻结被“撤销”了，连带着那把锁一起。', once: true, prio: 5,
    start(e, R) { R.sfx('rewind'); R.after(1.0, () => { if (!e.alive) return; R.consumeAll(e, 'still'); R.consumeAll(e, 'lock'); R.consumeAll(e, 'reverse'); R.emit('thaw', e); }, e); } });
  add({ id: 'palindrome', t: ['reverse', 'loop'], name: '回文', desc: '正着播一遍，再倒着播一遍，永无止境。', mod: { pingpong: true } });
  add({ id: 'prophecy', t: ['reverse', 'delay'], name: '预言', desc: '结果比原因早到五秒——它会说出你“即将”对它做的事。', mod: { prophet: true } });
  add({ id: 'freezeloop', t: ['still', 'loop'], name: '定格', desc: '无限次地重复“什么都不做”。' });
  add({ id: 'latefreeze', t: ['still', 'delay'], name: '迟到的静止', desc: '五秒后，它才会停下来。' });
  add({ id: 'echo', t: ['loop', 'delay'], name: '回声', desc: '每隔五秒，把刚才的动作再做一遍。', mod: { echo: true } });
  add({ id: 'replay', t: ['slow', 'reverse'], name: '慢镜回放', desc: '像体育转播一样，慢慢倒放刚才的精彩瞬间。屏幕角落打出「REPLAY」。', mod: { replayBanner: true } });
  add({ id: 'slowloop', t: ['slow', 'loop'], name: '慢循环', desc: '慢悠悠地重复同一个动作，像一台没上够发条的人偶。' });
  add({ id: 'superfast', t: ['fast', 'fast'], name: '超快速', desc: '×4 倍速。连说话都变成了尖细的快进声。' });
  add({ id: 'superslow', t: ['slow', 'slow'], name: '几乎静止', desc: '×¼ 倍速，慢得像一张照片。' });
  add({ id: 'deadstill', t: ['still', 'still'], name: '绝对零度', desc: '静止叠加静止，连“被看见”这件事都暂停了：检札员与侦探都会忽略它。', mod: { unseen: true } });
  add({ id: 'doublerev', t: ['reverse', 'reverse'], name: '负负得正', desc: '倒放再倒放＝正放。什么都没发生——系统却记下了一次“时间异常”。', mod: { normalTime: true } });

  // ============ 计时（炸弹） ============
  add({ id: 'countup', t: ['timer', 'reverse'], name: '倒计时变正计时', desc: '数字开始往上涨——爆炸离我们越来越远。', mod: { timerDir: -1 }, start(e, R) { R.sys('计时器：逆转'); } });
  add({ id: 'hurrybomb', t: ['timer', 'fast'], name: '催命', desc: '计时器以两倍速狂奔。', mod: { timerDir: 2 } });
  add({ id: 'stoptimer', t: ['timer', 'still'], name: '停摆', desc: '计时器停住了——只要它还静止着，就不会爆炸。', mod: { timerDir: 0 } });
  add({ id: 'chien', t: ['timer', 'delay'], name: '遅延証明書', desc: '爆炸被推迟了整整一分钟。广播：「只今、約一分の遅れが出ております」。', once: true,
    start(e, R) { R.game.bombDelay += 60; R.annc('只今、約一分の遅れが出ております。', '本次列车目前晚点约一分钟。'); R.consumeOne(e, 'delay'); } });
  add({ id: 'lastten', t: ['timer', 'loop'], name: '最后十秒', desc: '计时器在 00:10 和 00:01 之间无限循环——永远不会爆炸，只会永远让人心惊肉跳。', mod: { timerLoop: true } });
  add({ id: 'slowbomb', t: ['timer', 'slow'], name: '慢慢来', desc: '计时器半速前进。', mod: { timerDir: 0.5 } });
  add({ id: 'sleepbomb', t: ['bomb', 'sleep'], name: '睡着的炸弹', desc: '“滴……答……呼……”——炸弹睡着了，计时器也跟着停了。', mod: { timerDir: 0 }, say: ['Zzz……滴……'] });

  // ============ 物理 × 时间 ============
  add({ id: 'unfall', t: ['zerog', 'reverse'], name: '坠落倒放', desc: '掉下来的东西，一路升回它原本的位置。', start(e, R) { R.backHome(e); } });
  add({ id: 'rocket', t: ['zerog', 'fast'], name: '火箭', desc: '嗖地一下射向车顶，“咚”地撞上去又弹回来。', mod: { rocket: true }, start(e, R) { R.sfx('float'); } });
  add({ id: 'hang', t: ['zerog', 'still'], name: '悬停', desc: '停在半空，一动不动。' });
  add({ id: 'trampoline', t: ['zerog', 'loop'], name: '蹦床', desc: '上升、落下、上升、落下……', mod: { bounce: true } });
  add({ id: 'rewindghost', t: ['nocollide', 'reverse'], name: '回溯穿越', desc: '沿着三十秒前的轨迹倒退回去——无视墙壁，甚至能退回别的房间。' });
  add({ id: 'blink', t: ['nocollide', 'fast'], name: '闪现', desc: '以四倍速穿过一切，像一道残影。', mod: { speedMul: 2 } });
  add({ id: 'afterimage', t: ['nocollide', 'still'], name: '残像', desc: '一个停在原地、无法触碰的残像。' });
  add({ id: 'backflow', t: ['fluid', 'reverse'], name: '逆流', desc: '液体倒流——它重新聚拢，恢复成原来的形状。', once: true, start(e, R) { R.after(1.2, () => { if (e.alive) { R.consumeAll(e, 'fluid'); R.consumeOne(e, 'reverse'); R.say(e, '……我又是我了。'); } }, e); } });
  add({ id: 'icestatue', t: ['fluid', 'still'], name: '冰雕', desc: '流动停止——液体凝成了一座冰雕。', mod: { ice: true } });
  add({ id: 'torrent', t: ['fluid', 'fast'], name: '激流', desc: '湍急地冲过地板，把小东西统统冲走。', mod: { torrent: true } });
  add({ id: 'waterwheel', t: ['fluid', 'loop'], name: '水车', desc: '流过去、流回来，永远在两点之间往返。', mod: { pingpong: true } });
  add({ id: 'reassemble', t: ['fragile', 'reverse'], name: '碎裂与复原', desc: '它一碎就立刻倒放复原——永远在碎与不碎之间循环，所以永远不会真正碎掉。', mod: { unbreakable: true } });
  add({ id: 'frozenburst', t: ['fragile', 'still'], name: '凝固的爆裂', desc: '碎片停在了飞散的途中，像一件玻璃艺术品。' });
  add({ id: 'fatigue', t: ['fragile', 'fast'], name: '金属疲劳', desc: '加速的时间让它迅速老化——三秒后自己碎了。', once: true, start(e, R) { R.after(3, () => e.alive && R.shatter(e, '啪')); } });
  add({ id: 'antigrav', t: ['heavy', 'reverse'], name: '反重力', desc: '倒放的沉重——它朝天花板“坠落”。', mod: { fallUp: true } });
  add({ id: 'slam', t: ['heavy', 'fast'], name: '重击', desc: '以两倍速砸在地板上，整节车厢一震。', start(e, R) { R.shake(3, 0.5); R.sfx('punch'); } });
  add({ id: 'shrinkback', t: ['giant', 'reverse'], name: '倒放的成长', desc: '变大的过程被倒放——它反而缩小了。', mod: { scaleOverride: 0.5 } });
  add({ id: 'growth', t: ['giant', 'fast'], name: '疯长', desc: '它越长越大……直到模型撑破，炸成一地词条。', mod: { grow: true } });
  add({ id: 'colossus', t: ['giant', 'still'], name: '巨像', desc: '一座巨大的静止雕像，挡住了半条过道。' });
  add({ id: 'repel', t: ['magnet', 'reverse'], name: '斥力', desc: '磁力倒放成了斥力：所有金属都被推开。', mod: { repel: true } });
  add({ id: 'magstorm', t: ['magnet', 'fast'], name: '磁暴', desc: '磁力暴走，金属互相猛撞。', mod: { magPower: 3 } });
  add({ id: 'magfreeze', t: ['magnet', 'still'], name: '磁场定格', desc: '飞向它的金属全都停在了半空。', mod: { magFreeze: true } });
  add({ id: 'pulse', t: ['magnet', 'loop'], name: '脉冲', desc: '磁力一开一关，金属被拉过来又甩出去。', mod: { magPulse: true } });
  add({ id: 'fastroll', t: ['roll', 'fast'], name: '飞滚', desc: '滚得飞快，撞到人就把人绊倒。', mod: { bowling: true } });
  add({ id: 'uphill', t: ['roll', 'reverse'], name: '往高处滚', desc: '它逆着车厢的倾斜往上滚。', mod: { rollUp: true } });

  // ============ 系统 × 其它 ============
  add({ id: 'untouchable', t: ['aggro', 'nocollide'], name: '摸不着的靶子', desc: '所有人都想抓住它，手却一次次穿过去。一群人围着它团团转。' });
  add({ id: 'hightarget', t: ['aggro', 'zerog'], name: '高处的焦点', desc: '大家都聚到它下面仰着头，侦探试着跳起来够它。' });
  add({ id: 'slippery', t: ['aggro', 'fluid'], name: '抓不住', desc: '大家扑向那滩水，扑了一身湿。' });
  add({ id: 'grabbreak', t: ['aggro', 'fragile'], name: '一碰就碎', desc: '第一个抓到它的人，把它捏碎了。', mod: { breakOnTouch: true } });
  add({ id: 'chase', t: ['aggro', 'fast'], name: '追逐战', desc: '它跑，大家追——车厢里上演了一出闹剧。', mod: { flee: true } });
  add({ id: 'invisfocus', t: ['aggro', 'clear'], name: '看不见的焦点', desc: '所有人都“感觉”到这里有什么重要的东西，却怎么也找不到。', say: ['……'], start(e, R) { R.sayNear(e, 120, ['总觉得那边有什么……', '是我的错觉吗']); } });
  add({ id: 'focusoos', t: ['aggro', 'oos'], name: '被无视的焦点', desc: '系统左右为难：“最需要关注的东西”正在“回送中”。巡检卡在它身上——整节车厢这次都被跳过了。', mod: { scanJam: true } });
  add({ id: 'bowchain', t: ['aggro', 'polite'], name: '鞠躬连锁', desc: '大家想靠近它，它先鞠了一躬；大家只好回礼……一车人互相鞠躬，谁都动不了。', start(e, R) { R.bowChain(e.room, 10); } });
  add({ id: 'tiptoe', t: ['aggro', 'sleep'], name: '嘘——', desc: '所有人都踮着脚绕开它，生怕吵醒它。' });
  add({ id: 'publicenemy', t: ['aggro', 'threat'], name: '公敌', desc: '所有人一拥而上。' });
  add({ id: 'speech', t: ['aggro', 'chatty'], name: '街头演讲', desc: '大家围成一圈听它演讲——车厢的另一头空了出来。' });
  add({ id: 'lostfound', t: ['aggro', 'lost'], name: '失物招领', desc: '车掌第一时间赶来认领，侦探也凑过来盯着看。' });
  add({ id: 'ghostpax', t: ['oos', 'passenger'], name: '回送乘客', desc: '一位“不营业”的乘客：坐在那里，却不被计入人数。' });
  add({ id: 'oosbomb', t: ['oos', 'bomb'], name: '回送炸弹', desc: '炸弹停止营业。到点时它只会“噗”地冒一缕烟——不过系统还是会照常重置。', mod: { fizzle: true } });
  add({ id: 'oosdoor', t: ['oos', 'door'], name: '检修开放', desc: '「回送中」的门被打开了，方便检修。', mod: { forceOpen: true } });
  add({ id: 'contradiction', t: ['anomaly', 'oos'], name: '自相矛盾', desc: '“必须处理的异常”与“跳过不查”同时成立——巡检线卡在它身上整整五秒。', mod: { scanStall: true } });
  add({ id: 'suspended', t: ['anomaly', 'crew'], name: '停职审查', desc: '系统给自己的乘务员盖了「異常」章——乘务员的信任被收回了。', start(e, R) { if (e.kind === 'char') R.say(e, '欸？我……被盖章了？'); } });
  add({ id: 'eyesonme', t: ['anomaly', 'aggro'], name: '众矢之的', desc: '它同时是“最可疑”和“已确认异常”——所有检札员都会先冲向它。', mod: { decoyPlus: true } });

  // 复制增殖
  add({ id: 'drunkcrowd', t: ['copy', 'drunk'], on: 'char', name: '醉汉大合唱', desc: '车厢瞬间塞满了打鼾声的醉汉，用肉体堵死了巡逻路线——但系统内存开始告急。', mod: { copyRate: 2.5 } });
  add({ id: 'bombchain', t: ['copy', 'bomb'], name: '连锁炸弹', desc: '纸袋一个变两个、两个变四个。侦探大喊：“哪个才是真的！？”', start(e, R) { R.say(R.get('kuro'), '哪个才是真的！？'); } });
  add({ id: 'confetti', t: ['copy', 'fragile'], name: '纸屑工厂', desc: '复制品一出生就碎，词条碎片撒满地板（但它们都是“复印件”，巡检一来就会消失）。' });
  add({ id: 'balloonsky', t: ['copy', 'zerog'], name: '气球天花板', desc: '复制品一个接一个浮上去，车顶被铺满了。' });
  add({ id: 'floodcopy', t: ['copy', 'fluid'], name: '水漫金山', desc: '水洼不断复制，地板变成了浅滩。' });
  add({ id: 'twocrew', t: ['copy', 'crew'], on: 'char', name: '真假车掌', desc: '两个车掌互相指着对方：“我才是真的！”——乘务员的信任体系崩溃了。', say: ['我才是真的车掌！'] });
  add({ id: 'twodet', t: ['copy', 'detective'], on: 'char', name: '侦探对决', desc: '侦探们开始互相调查：“犯人就是你！”', say: ['犯人……就是你！'] });
  add({ id: 'afteryou', t: ['copy', 'polite'], name: '您先请', desc: '复制品们在过道里互相谦让，“您先请”“不不您先请”，谁也过不去。', mod: { blockAisle: true } });
  add({ id: 'statues', t: ['copy', 'still'], name: '雕像群', desc: '复制出来的全是静止的雕像。' });
  add({ id: 'exponential', t: ['copy', 'loop'], name: '指数爆炸', desc: '复制的动作本身也在被复制——系统立刻拉响了内存警报。', start(e, R) { R.memory(12); } });
  add({ id: 'giantcopy', t: ['copy', 'giant'], name: '车辆超重', desc: '巨大的复制品挤满车厢——「車両重量超過」，列车放慢了速度。', start(e, R) { R.memory(4); } });
  add({ id: 'antswarm', t: ['copy', 'mini'], name: '蚂蚁大军', desc: '一大群迷你复制品在地板上窸窸窣窣地跑。', mod: { copyRate: 2 } });
  add({ id: 'annihilate', t: ['copy', 'erase'], name: '湮灭', desc: '复制品与橡皮互相擦除——复制一个、擦掉一个，最后什么都不剩。', once: true, start(e, R) { R.after(1.5, () => e.alive && R.destroy(e, 'erase', '自我擦除')); } });
  add({ id: 'copyfast', t: ['copy', 'fast'], name: '高速复印', desc: '复制间隔缩短一半。', mod: { copyRate: 2 } });

  // 触碰即删除
  add({ id: 'movingeraser', t: ['erase', 'nocollide'], name: '游走的橡皮', desc: '它穿过一切，也擦掉一切它穿过的东西。', mod: { eraseSweep: true } });
  add({ id: 'ceilinghole', t: ['erase', 'zerog'], name: '天花板的洞', desc: '它浮上车顶，把车顶擦出一个洞——洞外是一片空白的稿纸。', start(e, R) { R.after(2.5, () => e.alive && R.holeInCeiling(e)); } });
  add({ id: 'voidpool', t: ['erase', 'fluid'], name: '空白蔓延', desc: '一滩会“擦除”的液体正在扩散，地板一块块变成空白。', mod: { voidSpread: true } });
  add({ id: 'blackhole', t: ['erase', 'magnet'], name: '黑洞', desc: '把金属吸过来，然后擦掉。', mod: { swallowMetal: true, eraseSwallow: true } });
  add({ id: 'undo', t: ['erase', 'reverse'], name: '撤销删除', desc: '橡皮倒着擦——刚刚被删掉的东西，回来了。', once: true, start(e, R) { R.undoDelete(e); } });
  add({ id: 'safeeraser', t: ['erase', 'still'], name: '封印的橡皮', desc: '静止的橡皮不会擦掉任何东西。', mod: { eraseOff: true } });
  add({ id: 'sleeperaser', t: ['erase', 'sleep'], name: '睡着的橡皮', desc: '它睡着了，暂时不会擦东西。', mod: { eraseOff: true } });
  add({ id: 'erasepatrol', t: ['erase', 'patrol'], on: 'char', name: '清道夫', desc: '一边巡逻，一边擦掉撞到的一切。', mod: { eraseSweep: true } });

  // 锁定
  add({ id: 'unlockrev', t: ['lock', 'reverse'], name: '解锁', desc: '上锁的动作被倒放——锁开了。', once: true, prio: 4, start(e, R) { R.sfx('rewind'); R.after(0.8, () => { R.consumeAll(e, 'lock'); R.consumeOne(e, 'reverse'); if (e.kind === 'door') { e.st.holdT = 25; R.toast('上锁的动作被倒放：门开了。'); } }); } });
  add({ id: 'brittlelock', t: ['lock', 'fragile'], name: '脆锁', desc: '易碎的锁，一碰就碎。', once: true, start(e, R) { R.after(0.8, () => { R.dropAll(e, 'lock'); R.sfx('shatter'); }); } });
  add({ id: 'liquidlock', t: ['lock', 'fluid'], name: '锁不住液体', desc: '液体没法被锁住——【锁定】从它身上滑落下来。', once: true, start(e, R) { R.after(0.6, () => R.dropAll(e, 'lock')); } });

  // 非常
  add({ id: 'doorcock', t: ['emergency', 'door'], name: '非常门把', desc: '相当于拉下了非常门把：门被手动打开了。', mod: { forceOpen: true }, start(e, R) { R.sfx('door'); } });
  add({ id: 'evacuate', t: ['emergency', 'bomb'], name: '紧急疏散', desc: '「爆弾です！」——乘客们一窝蜂逃到车厢另一头。', start(e, R) { R.panic(e.room, e, 400); } });
  add({ id: 'panicrew', t: ['emergency', 'crew'], on: 'char', name: '慌乱的车掌', desc: '车掌自己成了“紧急事态”，在车厢里团团转。', mod: { runAround: true } });
  add({ id: 'wakeup', t: ['emergency', 'sleep'], name: '叫醒服务', desc: '“紧急时刻还睡什么！”——附近睡着的人都被吵醒了。', once: true, start(e, R) { R.wakeNear(e, 80); R.consumeOne(e, 'sleep'); } });

  // 乘务员专用
  add({ id: 'crewbomb', t: ['crewonly', 'bomb'], name: '管辖外', desc: '炸弹成了“乘务员专用”——侦探碰不得它，只能干瞪眼：“……管辖外吗。”', mod: { kuroBlocked: true } });
  add({ id: 'crewseat', t: ['crewonly', 'passenger'], on: 'char', name: '专座', desc: '他成了“乘务员专用”的乘客——只有乘务员能跟他说话。' });

  // 台本角色
  add({ id: 'scriptclash', t: ['scripted', 'scripted'], name: '剧本冲突', desc: '两份台本在同一个人身上打架，互相撕碎了——他第一次脱离了剧本。', once: true, prio: 9,
    start(e, R) {
      R.sfx('glitch');
      if (R.game.act < 3 && !R.game.sandbox) { // 第二幕：系统还很强，会立刻修复冲突
        R.after(0.8, () => { R.sys('台本冲突を検知。修復します。'); const inst = e.tags.find((i) => i.t === 'scripted' && i.o !== e.id); if (!inst) return; e.tags.splice(e.tags.indexOf(inst), 1); if (G.clip.slots.length < G.clip.cap) { G.clip.slots.push(inst); G.ui.refresh(); G.ui.toast('系统修复了台本冲突——你的【台本角色】被弹回了剪贴板。（现在还太早）'); } else R.homeInst(e, inst); G.tags.changed(e); });
        return;
      }
      R.after(0.8, () => { R.consumeAll(e, 'scripted'); R.emit('freed', e); });
    } });
  add({ id: 'rehearsal', t: ['scripted', 'reverse'], name: '倒带排练', desc: '把台本倒着演一遍：沿着剧本路线倒退着走。', mod: { scriptRev: true } });
  add({ id: 'fastscript', t: ['scripted', 'fast'], name: '快进剧本', desc: '他以两倍速演完自己的戏份——台本上的事件提前发生了。', mod: { scriptRate: 2 } });
  add({ id: 'slowscript', t: ['scripted', 'slow'], name: '慢放剧本', desc: '他慢吞吞地演，台本上的事件推迟了。', mod: { scriptRate: 0.5 } });
  add({ id: 'scriptfreeze', t: ['scripted', 'still'], name: '忘词', desc: '演到一半定住了——像一个忘了台词的演员。' });

  // 透明
  add({ id: 'invisbomb', t: ['clear', 'bomb'], name: '隐形炸弹', desc: '侦探找不到炸弹了：“爆弹……消失了？！”他在车厢里来回翻找。', mod: { kuroLost: true } });
  add({ id: 'glassdoor', t: ['clear', 'door'], name: '玻璃门', desc: '门变得透明——乘客们不知道那里有门，一头撞了上去。' });
  add({ id: 'invcrew', t: ['clear', 'crew'], on: 'char', name: '隐形车掌', desc: '谁也看不见车掌，她照样尽职地巡逻。' });
  add({ id: 'poltergeist', t: ['clear', 'threat'], name: '骚灵', desc: '看不见的东西在打人。乘客们惊叫：“谁！？”', mod: {} });
  add({ id: 'voice', t: ['clear', 'chatty'], name: '天之声', desc: '没有身体的声音——大家都以为是车内广播。' });

  // 遗失物
  add({ id: 'carryman', t: ['lost', 'passenger'], on: 'char', name: '人形失物', desc: '车掌试图把一个成年人当作失物搬去失物箱：“这、这是哪位的……失物？”' });
  add({ id: 'lostbomb', t: ['lost', 'bomb'], name: '失物炸弹', desc: '车掌把炸弹当作失物收进了乘务员室。侦探只好追进去找。' });
  add({ id: 'tooheavy', t: ['lost', 'heavy'], name: '搬不动', desc: '“好、好重……！”车掌抱着它寸步难行。', mod: { tooHeavy: true } });
  add({ id: 'floatlost', t: ['lost', 'zerog'], name: '飘走的失物', desc: '车掌踮着脚追一件往上飘的失物。' });
  add({ id: 'lostdoor', t: ['lost', 'door'], name: '捡到一扇门', desc: '车掌一本正经地把整扇门卸下来，当作失物抱走了——门框空了。', mod: { liftable: true } });
  add({ id: 'lostcrew', t: ['lost', 'crew'], on: 'char', name: '自我招领', desc: '车掌认定自己是失物，自己走进了失物箱。', mod: { selfLost: true } });

  // 倒影
  add({ id: 'mirrorme', t: ['reflection', 'passenger'], on: 'char', name: '窗中人', desc: '他走进了车窗的倒影里。——“咦，我怎么在窗户里面？”' });
  add({ id: 'mirrorbomb', t: ['reflection', 'bomb'], name: '镜中炸弹', desc: '炸弹只剩下车窗里的倒影。侦探对着玻璃伸手——摸不到。', mod: { kuroLost: true } });

  // 广播（贴在麦克风上的由 tagsys 统一处理）
  add({ id: 'pa_person', t: ['broadcast', 'chatty'], on: 'char', name: '人肉广播', desc: '他的每一句话都从车顶的扬声器里传出来。' });

  // ============ 心智 × 其它 ============
  add({ id: 'sleepwalk', t: ['sleep', 'patrol'], name: '梦游', desc: '闭着眼睛照常巡逻——什么也看不见。', mod: { sleepwalk: true, blind: true } });
  add({ id: 'dreamfight', t: ['sleep', 'threat'], name: '梦中格斗', desc: '睡梦中挥拳，谁靠近就打谁。', mod: { dreamFight: true } });
  add({ id: 'sleeptalk', t: ['sleep', 'chatty'], name: '梦话', desc: '睡着的人开始说梦话——梦话里全是平时不敢说的秘密。', mod: { sleepTalk: true } });
  add({ id: 'deepsleep', t: ['sleep', 'fast'], name: '深度睡眠', desc: '以两倍速睡觉，鼾声像机关枪。' });
  add({ id: 'lightsleep', t: ['sleep', 'vigilant'], name: '浅眠', desc: '一点风吹草动就睁眼瞪人——你在他附近剪词条，他都会醒。', mod: { lightSleep: true } });
  add({ id: 'floatsleep', t: ['sleep', 'zerog'], name: '浮空睡', desc: '飘在半空中睡觉，冒着一串串泡泡。' });
  add({ id: 'puddlesleep', t: ['sleep', 'fluid'], name: '睡成一滩', desc: '一滩会打鼾声的水。' });
  add({ id: 'sleepbow', t: ['sleep', 'polite'], name: '梦中鞠躬', desc: '睡着了也在点头哈腰。' });
  add({ id: 'drunkfast', t: ['drunk', 'fast'], on: 'char', name: '醉步·疾', desc: '踉踉跄跄却飞快地满车厢乱窜，撞到谁算谁。', mod: { stumble: true } });
  add({ id: 'drunkfist', t: ['drunk', 'threat'], on: 'char', name: '醉拳', desc: '醉汉摆出了醉拳的架势，见人就挥拳（睡着的话，就在梦里挥）。车掌和侦探都冲了过来。', mod: { fightPose: true } });
  add({ id: 'rampage', t: ['drunk', 'threat', 'fast'], on: 'char', name: '醉拳暴走', desc: '高倍速的醉拳疯子满车厢乱窜，撞翻一切，原本的时间轴被彻底打乱。', prio: 8, mod: { rampage: true, fightPose: true, noSleep: true }, start(e, R) { if (e.has('sleep')) { R.consumeAll(e, 'sleep'); R.say(e, '……嗯？！哈——！！'); } R.shake(2, 0.6); R.sys('台本：时间轴偏离'); } });
  add({ id: 'izakaya', t: ['drunk', 'polite'], on: 'char', name: '酒桌礼仪', desc: '一边鞠躬道歉一边给人倒酒——【醉意】会传染给他敬过酒的人。', mod: { pour: true } });
  add({ id: 'rant', t: ['drunk', 'chatty'], on: 'char', name: '醉后吐槽', desc: '大声吐槽课长和加班，附近的人都停下来听。', mod: { rant: true } });
  add({ id: 'drunkcrew', t: ['drunk', 'crew'], on: 'char', name: '微醺车掌', desc: '车掌的广播开始跑调：“下一站……嗯……哪里都行！”——乘务员室的门也忘了锁。', mod: { leaveDoorOpen: true } });
  add({ id: 'drunkdet', t: ['drunk', 'detective'], on: 'char', name: '醉侦探', desc: '他指着罐子大喊：“犯人就是你！”', mod: { wildAccuse: true } });
  add({ id: 'drunkdoor', t: ['drunk', 'door'], name: '醉门', desc: '门晃晃悠悠地一开一合，像在打嗝。', mod: { swayOpen: true } });
  add({ id: 'drunkbomb', t: ['drunk', 'bomb'], name: '打嗝的炸弹', desc: '“滴、嗝、滴”——计时器忽快忽慢。', mod: { timerWobble: true } });
  add({ id: 'skywalk', t: ['drunk', 'zerog'], on: 'char', name: '空中散步', desc: '醉醺醺地在半空中划水。' });
  add({ id: 'violentcrew', t: ['threat', 'crew'], on: 'char', name: '强硬车掌', desc: '“请您下车！”——车掌开始把乘客往外推。' });
  add({ id: 'violentdet', t: ['threat', 'detective'], on: 'char', name: '暴力侦探', desc: '侦探扑倒了离他最近的“嫌疑人”。' });
  add({ id: 'politethreat', t: ['threat', 'polite'], name: '有礼貌的威胁', desc: '“失礼します。”——然后一拳。', mod: { politeHit: true } });
  add({ id: 'glasscannon', t: ['threat', 'fragile'], name: '玻璃大炮', desc: '出拳的同时，自己也碎了。', mod: { breakOnHit: true } });
  add({ id: 'cutethreat', t: ['threat', 'mini'], name: '小小的威胁', desc: '一个气鼓鼓的小东西。谁也不把它当回事：“好可爱……”', mod: { harmless: true } });
  add({ id: 'kaiju', t: ['threat', 'giant'], name: '怪兽', desc: '巨大的威胁——所有人都逃到了车厢另一头。', start(e, R) { R.panic(e.room, e, 400); } });
  add({ id: 'holddoor', t: ['polite', 'crew'], on: 'char', name: '扶门', desc: '车掌鞠了一躬，走到最近的门边替你扶住门：“请。”', mod: { holdDoor: true }, say: ['请。'] });
  add({ id: 'gentleman', t: ['polite', 'detective'], on: 'char', name: '绅士侦探', desc: '“请吧，你先来。”他把调查让给了你。', mod: { yieldCase: true } });
  add({ id: 'bowdoor', t: ['polite', 'door'], name: '自动礼让门', desc: '有人靠近，门就鞠个躬自己打开。', mod: { autoOpen: true } });
  add({ id: 'afteryoubomb', t: ['polite', 'bomb'], name: '礼让的炸弹', desc: '“您先请。”——到点时它礼貌地没有爆炸（系统还是照常重置了）。', mod: { fizzle: true } });
  add({ id: 'keigo', t: ['polite', 'chatty'], name: '敬语地狱', desc: '“哪里哪里”“不敢当不敢当”——靠近的人都被卷进没完没了的客套话里。', mod: { trapTalk: true } });
  add({ id: 'monologue', t: ['chatty', 'detective'], on: 'char', name: '推理独白', desc: '侦探开始滔滔不绝地讲解他的推理——包括他“打算先剪哪根线”。', mod: { monologue: true } });
  add({ id: 'pa_crew', t: ['chatty', 'crew'], on: 'char', name: '广播狂', desc: '车掌不停地广播……连巡检预告都被淹没了。', mod: { drownWarn: true } });
  add({ id: 'talkbomb', t: ['chatty', 'bomb'], name: '会说话的炸弹', desc: '“我是炸弹。顺便一提，我的线要先剪黄、再剪蓝、最后剪红哦。”', mod: { bombTalk: true } });
  add({ id: 'talkdoor', t: ['chatty', 'door'], name: '话多的门', desc: '“要开门吗？要开门吗？”——你跟它搭话，它就开了。', mod: { talkOpen: true } });
  add({ id: 'walkbomb', t: ['patrol', 'bomb'], name: '散步的炸弹', desc: '纸袋自己在过道里来回溜达，侦探在后面追。', mod: { itemWalk: true } });
  add({ id: 'walkdoor', t: ['patrol', 'door'], name: '散步的门', desc: '门沿着墙壁来回滑动——门洞时不时露了出来。', mod: { doorWander: true } });
  add({ id: 'wallpatrol', t: ['patrol', 'nocollide'], on: 'char', name: '穿墙巡逻', desc: '巡逻路线穿过了墙壁，一路走进隔壁车厢。' });
  add({ id: 'guarddoor', t: ['vigilant', 'door'], name: '门卫', desc: '门盯着你：“关系者以外，禁止入内。”', mod: { guard: true } });
  add({ id: 'tamperbomb', t: ['vigilant', 'bomb'], name: '防拆炸弹', desc: '有人靠近，它就数得更快。', mod: { tamper: true } });

  // ============ 规则文字 ============
  add({ id: 'nobomb', t: ['forbid', 'bomb'], name: '禁止爆炸', desc: '贴着「禁止」的炸弹——侦探读了读标签，松了口气：“禁止爆炸……那就放心了。”（系统依旧会准点重置）', mod: { fizzle: true }, start(e, R) { R.say(R.get('kuro'), '禁止爆炸……那就放心了。'); } });
  add({ id: 'nodoor', t: ['forbid', 'door'], name: '禁止成为门', desc: '这扇门被禁止了——它不再是门，只剩一个门洞。', mod: { forceOpen: true, noDoor: true } });
  add({ id: 'nocrew', t: ['forbid', 'crew'], on: 'char', name: '禁止乘务', desc: '「乘务员 禁止」——她低头说了句“失礼了”，退出了这节车厢。', mod: { leaveCar: true } });
  add({ id: 'nosleep', t: ['forbid', 'sleep'], name: '禁止睡觉', desc: '睡不着了。他气呼呼地睁开眼。', mod: { noSleep: true } });
  add({ id: 'nopatrol', t: ['forbid', 'patrol'], name: '禁止巡逻', desc: '巡逻被禁止，她只好原地立正。' });
  add({ id: 'novigil', t: ['forbid', 'vigilant'], name: '禁止警惕', desc: '他再也不会注意到任何异样。', mod: { blind: true } });
  add({ id: 'nowalk', t: ['forbid', 'passenger'], on: 'char', name: '禁止通行', desc: '他被禁止移动了。' });
  add({ id: 'doubleneg', t: ['forbid', 'forbid'], name: '双重否定', desc: '「禁止禁止」＝允许。被它约束的规则全部失效。', prio: 6, mod: { forbidNegated: true } });
  add({ id: 'noscan', t: ['forbid', 'inspector'], on: 'char', name: '禁止检札', desc: '检札员被禁止检札——它垂下手里的印章，原地立正。', mod: { inspectorOff: true } });

  // ============ 身份互贴 ============
  add({ id: 'paxbomb', t: ['bomb', 'passenger'], on: 'char', name: '人体炸弹', desc: '他成了炸弹。侦探凑过来翻他的领带：“线……在哪里？”', start(e, R) { R.say(R.get('kuro'), '线……在哪里？'); } });
  add({ id: 'seatbomb', t: ['passenger', 'bomb'], on: 'item', name: '入座的炸弹', desc: '炸弹找了个空位坐下。车掌来查票：“请出示车票。”——没票，于是被请下了车。', mod: { seekSeat: true } });
  add({ id: 'floatbomb', t: ['bomb', 'zerog'], name: '飘浮炸弹', desc: '炸弹飘在半空，侦探够不着。', mod: { kuroBlocked: true } });
  add({ id: 'liquidbomb', t: ['bomb', 'fluid'], name: '液态炸弹', desc: '炸弹化成一滩危险的液体，顺着车厢的倾斜流向乘务员室的门缝。', mod: { flowTo: 'right' } });
  add({ id: 'doorbomb', t: ['bomb', 'door'], name: '炸弹门', desc: '门成了炸弹——四点半，侦探会照着台本“拆掉”它的锁。', mod: { kuroDefuseDoor: true } });
  add({ id: 'crewbombp', t: ['bomb', 'crew'], on: 'char', name: '炸弹车掌', desc: '车掌广播：“本车掌将于五点整爆炸，敬请谅解。”', say: ['本车掌将于五点整爆炸。'] });
  add({ id: 'selfbomb', t: ['bomb', 'detective'], on: 'char', name: '我即炸弹', desc: '“我自己……就是炸弹吗。”侦探低头看着自己的手。' });
  add({ id: 'touchbomb', t: ['bomb', 'fragile'], name: '一碰就炸', desc: '谁碰它谁倒霉。' });
  add({ id: 'selfcheck', t: ['detective', 'bomb'], on: 'item', name: '自查', desc: '炸弹调查了自己——然后亲手剪断了自己的三根线。系统记录：「侦探が爆弾を解除しました」。', prio: 7, once: true,
    start(e, R) { R.after(2.5, () => { if (e.alive && e.has('detective') && e.has('bomb')) R.emit('selfDefuse', e); }, e); } });
  add({ id: 'drunkdetective', t: ['detective', 'drunk'], on: (e) => e.id === 'tanaka', name: '醉探田中', desc: '田中扶着眼镜（他根本没戴眼镜）开始调查：“嗝……真相只有一个……”' });
  add({ id: 'crewdrunk', t: ['crew', 'drunk'], on: (e) => e.id === 'tanaka', name: '田中车掌', desc: '“下一站——居酒屋前——”他拿着乘务员的身份大摇大摆走进乘务员室睡觉，门也没关。', mod: { leaveDoorOpen: true, goCrew: true } });
  add({ id: 'paxdoor', t: ['passenger', 'door'], on: 'door', name: '坐下的门', desc: '门找了个空位坐下了。门框空了出来。', mod: { forceOpen: true, doorSits: true } });
  add({ id: 'offduty', t: ['passenger', 'crew'], on: (e) => e.kind === 'char' && e.id !== 'nana' && e.id !== 'shiori', name: '下班', desc: '“今天……就到这里吧。”她坐下打起了盹。', mod: { sitDown: true } });
  add({ id: 'paxinsp', t: ['passenger', 'inspector'], on: 'char', name: '变成乘客的检札员', desc: '检札员被当成乘客，只好找个位子坐好。', mod: { sitDown: true, inspectorOff: true } });
  add({ id: 'scriptinsp', t: ['scripted', 'inspector'], on: 'char', name: '无戏可演', desc: '台本里根本没有它的角色——「配役なし」。它消失了。', once: true, start(e, R) { R.after(1, () => e.alive && R.destroy(e, 'erase', '配役なし')); } });
  add({ id: 'aggroinsp', t: ['aggro', 'inspector'], on: 'char', name: '内讧', desc: '其它检札员把它当成了头号目标，冲上去给它盖满了「差戻」章。', mod: { framed: true } });
  add({ id: 'anominsp', t: ['anomaly', 'inspector'], on: 'char', name: '自己人也查', desc: '它身上的「異常」章让同伴们毫不犹豫地对它动手。', mod: { framed: true } });
  add({ id: 'sleepinsp', t: ['sleep', 'inspector'], on: 'char', name: '打盹的检札员', desc: '检札员站着睡着了。', mod: { inspectorOff: true } });
  add({ id: 'loopinsp', t: ['loop', 'inspector'], on: 'char', name: '原地转身', desc: '它永远重复着“转身”这个动作，再也走不出一步。', mod: { inspectorOff: true } });
  add({ id: 'politeinsp', t: ['polite', 'inspector'], on: 'char', name: '谦让的检札员', desc: '“您先请。”——它给所有人让路，对异常视而不见。', mod: { inspectorOff: true } });
  add({ id: 'drunkinsp', t: ['drunk', 'inspector'], on: 'char', name: '醉酒检札', desc: '它醉醺醺地乱盖章——盖到了自己同伴的脸上。', mod: { stampRandom: true } });
  add({ id: 'lostinsp', t: ['lost', 'inspector'], on: 'char', name: '捡到一个检札员', desc: '车掌把检札员当作失物收走了。' });
  add({ id: 'copyinsp', t: ['copy', 'inspector'], on: 'char', name: '内存溢出', desc: '检札员疯狂自我复制——「メモリ不足」。系统强制回收了所有检札员。', start(e, R) { R.memory(10); } });
  add({ id: 'revinsp', t: ['reverse', 'inspector'], on: 'char', name: '倒退回收', desc: '它倒退着走回了出生点，然后被系统回收。', once: true, start(e, R) { R.after(2.5, () => e.alive && R.destroy(e, 'vanish', '回收')); } });
  add({ id: 'player_crew', t: ['crew', 'nana'], name: '冒牌车掌', desc: '你穿上了“乘务员”的身份：乘务员专用的门会为你打开，巡检也会对你说「ヨシ！」。' });
  add({ id: 'player_det', t: ['detective', 'nana'], name: '代号 DET-01', desc: '在系统眼里，你现在就是“侦探”。由你拆弹，系统也只会记录“侦探成功”。' });
  add({ id: 'player_lost', t: ['lost', 'nana'], name: '把自己弄丢了', desc: '你变成了一件失物。车掌会把你捡起来，送进乘务员室的失物箱。' });
  add({ id: 'player_trash', t: ['trash', 'nana'], name: '可回收物', desc: '你成了垃圾。车掌会把你扫进乘务员室的垃圾桶。' });
  add({ id: 'player_metal', t: ['metal', 'nana'], name: '人形铁块', desc: '车顶扬声器里的磁铁把你吸了上去，你贴在车顶动弹不得。' });
  add({ id: 'player_door', t: ['door', 'nana'], name: '我是一扇门', desc: '你成了一扇门。乘客们试着推你。' });
  add({ id: 'player_reflect', t: ['reflection', 'nana'], name: '镜中人', desc: '你走进了车窗的倒影里——巡检不会点名倒影。' });
  add({ id: 'player_oos', t: ['oos', 'nana'], name: '停止营业', desc: '你挂上了「回送」的牌子。巡检会直接跳过你。' });
  add({ id: 'kurofree_talk', t: ['detective', 'polite'], on: (e) => e.id === 'kuro', name: '彬彬有礼的侦探', desc: '他微微欠身：“需要帮忙吗？”' });

  // ============ 第四幕：界面词条 ============
  add({ id: 'deadlock_self', t: ['anomaly', 'whiteline'], name: '自指死锁', desc: '白线开始检查它自己——检查的动作本身就是异常，于是再检查……「スタックオーバーフロー」。', prio: 10, once: true, start(e, R) { R.emit('deadlock', { e, how: 'self' }); } });
  add({ id: 'deadlock_id', t: ['nana', 'undeletable'], name: '身份死锁', desc: '“删除 NPC_07”与“不可删除”同时指向了白线自己。两条最高指令互相卡死。', prio: 10, once: true, start(e, R) { R.emit('deadlock', { e, how: 'id' }); } });
  add({ id: 'deadlock_time', t: ['reverse', 'loop'], on: '#sysclock', name: '回文时钟', desc: '系统的时钟正着走一秒、倒着走一秒——它永远到不了“破棄”的那一刻。', prio: 10, once: true, start(e, R) { R.emit('deadlock', { e, how: 'time' }); } });
  add({ id: 'deadlock_script', t: ['scripted', 'whiteline'], name: '作者入戏', desc: '写台本的人成了台本里的角色。它必须照本宣科，可台本的下一行要它自己来写。', prio: 10, once: true, start(e, R) { R.emit('deadlock', { e, how: 'script' }); } });
  add({ id: 'deadlock_pause', t: ['pause', 'lock'], on: (e) => e.id === 'boss', name: '永久暂停', desc: '暂停，并且锁死。它再也按不下“继续”。', prio: 10, once: true, start(e, R) { R.emit('deadlock', { e, how: 'pause' }); } });
  add({ id: 'deadlock_close', t: ['close', 'whiteline'], name: '关闭白线', desc: '「このウィンドウを閉じますか？」——它自己替自己点了“是”。', prio: 10, once: true, start(e, R) { R.emit('deadlock', { e, how: 'close' }); } });
  add({ id: 'deadlock_lost', t: ['lost', 'whiteline'], name: '失物：系统一台', desc: '车掌恭恭敬敬地把整个系统收进了失物箱。', prio: 10, once: true, start(e, R) { R.emit('deadlock', { e, how: 'lost' }); } });
  add({ id: 'pausewl', t: ['pause', 'whiteline'], name: '暂停', desc: '白线被暂停了十秒——它会自己按下继续。要是能把它锁住就好了……', start(e, R) { R.emit('bossPause', e); } });
  add({ id: 'titleme', t: ['title', 'nana'], name: '主角光环', desc: '你成了这个故事的标题。系统无法删除标题。' });
  add({ id: 'exitdoor', t: ['exit', 'door'], name: '通往出口', desc: '这扇门的另一边，是「出口」。', mod: { exitDoor: true } });
  add({ id: 'countdown_rev', t: ['countdown', 'reverse'], name: '倒数回去', desc: '界面上的倒计时开始往回走。' });

  for (const r of RX) { r.key = r.t.slice().sort().join('+'); r.prio = r.prio || (r.on ? (typeof r.on === 'function' || r.on[0] === '#' ? 3 : 2) : 1); }
  G.REACTION_BY_ID = Object.fromEntries(RX.map((r) => [r.id, r]));
})();
