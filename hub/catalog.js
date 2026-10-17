'use strict';
// =====================================================================
//  GAME.INC.RE catalog — every game on the hub and the category it
//  belongs to. The hub renders from this list, the like API reads its
//  ids, and build.mjs checks every entry (category, files, images).
//  A new game = one entry below with a category from CATEGORIES.
// =====================================================================
(function (root) {
  const CATEGORIES = [
    { id: 'action', name: '动作', en: 'ACTION', color: '#e0485e', desc: '拼手感、拼反应，一刀一刀打出来' },
    { id: 'idle', name: '放置', en: 'IDLE', color: '#63c74d', desc: '挂着也在变强，回来就有收获' },
    { id: 'rpg', name: '角色扮演', en: 'RPG', color: '#b55088', desc: '养成、剧情与冒险' },
    { id: 'strategy', name: '策略', en: 'STRATEGY', color: '#0099db', desc: '排兵布阵，算好每一步' },
    { id: 'puzzle', name: '解谜', en: 'PUZZLE', color: '#feae34', desc: '动动脑子，解开机关' },
    { id: 'casual', name: '休闲', en: 'CASUAL', color: '#f6757a', desc: '随手一局，轻松愉快' },
  ];
  const GAMES = [
    {
      id: 'entropy-blade', no: 1, name: '熵刃', en: 'ENTROPY BLADE', href: 'entropy-blade/index.html',
      category: 'action', tags: ['横版动作', '肉鸽', '像素', '东方奇幻'], released: '2026-10-08', accent: '#e0485e',
      cover: 'hub/entropy-blade-cover.png', coverAlt: '熵刃标题画面：落樱古道中对峙的侠客们',
      pitch: '刀、枪、拳、魔弹各成一派的像素横版肉鸽，见切之后连段不停。',
      desc: '在落樱古道、瘴雨沼泽、苍雪寒山、黄沙废城、晶渊回廊与熔铸炉城之间斩开熵潮——每一局的每一关都从两三张地图里抽一张，每张图都有专属敌人和首领。刀、枪、拳、魔弹，每位侠客都有三把武器和自成一派的武学：武技、技能与秘技各有自己的等级上限和独有的进阶效果。看准敌人出手的瞬间闪身触发见切，连按攻击打出见切连段。劫难挑战让高手自选劫数，换取更厚的福缘。',
      facts: [['招式', '290+'], ['武学', '80'], ['地图', '7'], ['首领', '7']],
      cast: [
        { name: '凛', sub: '刀 · 均衡近战', color: '#ff3b5c', img: 'hub/entropy-blade-rin.webp' },
        { name: '伊芙', sub: '魔弹枪 · 远程爆发', color: '#ffd23f', img: 'hub/entropy-blade-eve.webp' },
        { name: '罡', sub: '拳法 · 重装近战', color: '#ff9a3a', img: 'hub/entropy-blade-gao.webp' },
        { name: '澜', sub: '长枪 · 中距控场', color: '#3ee0b0', img: 'hub/entropy-blade-lan.webp' },
      ],
      platforms: ['keyboard', 'gamepad', 'touch'],
      keys: [['A D', '移动（也可用方向键）'], ['J', '攻击 · ↑ / ↓ + J 武技'], ['K', '跳跃 · 二段跳 · 蹬墙跳'], ['L', '冲刺（无敌）'], ['I', '秘技 · ↓ + I 奥义'], ['E', '互动 · 进门'], ['Esc', '暂停 · 构筑与招式表']],
      hint: '手机请横屏 · 支持全屏',
    },
    {
      id: 'tbmh', no: 2, name: '悬赏怪物猎人', en: 'THE BOUNTY MONSTER HUNTER', short: 'TBMH', href: 'tbmh/index.html',
      category: 'idle', tags: ['挂机放置', '刷宝', '像素', 'RPG'], released: '2026-10-10', accent: '#feae34',
      cover: 'hub/tbmh-cover.png', coverAlt: '悬赏怪物猎人：葛雷、伊薇与茉莉组队，在王座指挥厅迎战深渊执政官，通缉令高悬',
      pitch: '组一支赏金猎人小队出征：三幕、四个难度、每关都有首领的像素刷宝长征，还能缩成置顶小窗边干活边打怪。',
      desc: '最多三名英雄组队自动出征：前排扛住怪群，后排放箭施法，牧师为全队治疗、祝福。三幕三十关、四个难度，每关最后一波是关卡首领，第十关的悬赏首领限时决战，再战要交一张通缉令。普通怪、关卡首领和悬赏首领分别掉白、蓝、红三种宝箱，开出十个品质的装备，带随机词条、装饰 / 雕刻 / 铭文插槽和改变打法的传说效果。每名英雄各有等级、装备和九层技能树，主动技能自动释放；魔方负责炼金、合成、制作、镶嵌、雕刻、供奉与铭文；近两百个节点的符文树解锁新的队伍位置、第二技能槽、自动开箱和离线狩猎。',
      facts: [['关卡', '120'], ['怪物', '68'], ['技能', '144'], ['符文', '197']],
      cast: [
        { name: '葛雷', sub: '骑士 · 前排坦克', color: '#e43b44', img: 'hub/tbmh-gray.png', pixel: true },
        { name: '希娅', sub: '游侠 · 远程输出', color: '#feae34', img: 'hub/tbmh-sia.png', pixel: true },
        { name: '伊薇', sub: '法师 · 元素范围', color: '#2ce8f5', img: 'hub/tbmh-ivy.png', pixel: true },
        { name: '茉莉', sub: '牧师 · 治疗增益', color: '#f6757a', img: 'hub/tbmh-molly.png', pixel: true },
        { name: '洛恩', sub: '猎手 · 陷阱弩箭', color: '#c0cbdc', img: 'hub/tbmh-loen.png', pixel: true },
        { name: '布兰', sub: '屠戮者 · 双斧狂战', color: '#f77622', img: 'hub/tbmh-bran.png', pixel: true },
      ],
      platforms: ['mouse', 'touch', 'pip'],
      keys: [['1–8', '切换页签'], ['P', '推进 / 刷关'], ['M', '置顶小窗'], ['滚轮 / 拖动', '滚动列表与符文树']],
      hint: '横屏竖屏都能玩 · Chrome / Edge 可开置顶小窗',
    },
    {
      id: 'whiteline', no: 3, name: '白线以内', en: 'INSIDE THE WHITE LINE', href: 'whiteline/index.html',
      category: 'puzzle', tags: ['规则拼图', '时间循环', '像素', '剧情'], released: '2026-10-15', accent: '#c0432c',
      cover: 'hub/whiteline-cover.png', coverAlt: '白线以内：深夜站台，末班车停靠，少女站在白线后面，站牌写着“04号车厢”',
      pitch: '末班车 04 号车厢里的像素规则拼图：剪下万物身上的词条，贴到别处，在每 60 秒一次的白线巡检之前伪造现场。',
      desc: '凌晨的末班车上，七号醒来时手里只有一本台本。车厢里的每样东西都贴着“词条”：扬声器、广告、气球、门，还有乘客自己。'
        + '把词条剪下来贴到别处，世界就照着新的词条运转；给铁砧同时贴上【沉重】和【零重力】，它会悬在半空慢慢浮沉——这样的化学反应写满了一整本图鉴。'
        + '每 60 秒，白线扫过车厢，把一切改回台本的样子，赶在它到来之前伪造好现场，唤醒车厢里的同伴，同一道难题往往有好几种解法。'
        + '四幕剧情、时间循环，随时可以存档、读档，登录 GAME.INC.RE 账号后存档在所有设备同步。',
      facts: [['词条', '58'], ['化学反应', '240'], ['解法', '37'], ['幕', '4']],
      cast: [
        { name: '七号', sub: '乘客 07', color: '#c0432c', img: 'hub/whiteline-nana.png', pixel: true },
        { name: '栞', sub: '少女', color: '#f0a83a', img: 'hub/whiteline-shiori.png', pixel: true },
        { name: '黑川', sub: '风衣男', color: '#a9967a', img: 'hub/whiteline-kuro.png', pixel: true },
        { name: '白鷺', sub: '车掌', color: '#6f8fb8', img: 'hub/whiteline-shira.png', pixel: true },
        { name: '田中', sub: '醉汉', color: '#d8b24a', img: 'hub/whiteline-tanaka.png', pixel: true },
      ],
      platforms: ['mouse', 'keyboard', 'touch'],
      keys: [['点地面 / ← →', '移动'], ['点对象 / Tab', '选中'], ['点词条 / Ctrl+X', '剪下词条'], ['Ctrl+V / 1–7', '贴上词条'],
        ['空格 / F', '暂停 / 快进'], ['T / H / Q', '台本 / 提示 / 切换角色'], ['Esc', '菜单 · 存档 · 读档']],
      hint: '电脑与手机都能玩 · 菜单里随时存档',
    },
    {
      id: 'edge-acres', no: 4, name: '边角农场', en: 'EDGE ACRES', href: 'edge-acres/index.html',
      category: 'idle', tags: ['放置', '自动化', '种田', '像素'], released: '2026-10-16', accent: '#1ebc73',
      cover: 'hub/edge-acres-cover.webp', coverAlt: '边角农场：农舍、筒仓、温室和蜂箱排成一排，小机器人在田垄间浇水、收割，河水从农场边流过',
      pitch: '贴在屏幕边上的像素农场：退休机器人锈崽带着一队小机器人播种、浇水、收割。你专心干活，它们专心种地。',
      desc: '屏幕底边的一条狭长农场。定好种什么、种在哪，锈崽和浇水、收割、搬运、播种、施肥机器人会把活干完：'
        + '收成送进仓库换成零件，送进转化炉炼成燃料。零件拿去扩建农场、升级机器人，燃料给机器人充电、开拓新的区块、出发去下一张地图。'
        + '六十种作物，还有巨型作物、蜂箱和牧场；沙洲要打深水井，冻土要热能塔解冻，菌林里只有灯光照到的庄稼长得好。'
        + '番茄钟走完时全场丰收，关掉网页再回来会结算离线收益。第一次打开有一步一步的新手教程。登录 GAME.INC.RE 账号后，所有地图的农场在各设备同步，收获量进入本站收获榜。',
      facts: [['作物', '60'], ['地图', '5'], ['机器人', '5 种'], ['离线收益', '8 小时']],
      cast: [
        { name: '锈崽', sub: '退休农用机器人', color: '#f79617', img: 'hub/edge-acres-rusty.png', pixel: true },
        { name: '浇水机器人', sub: '背着水箱巡田', color: '#4d65b4', img: 'hub/edge-acres-water.png', pixel: true },
        { name: '收割机器人', sub: '成熟就收', color: '#b33831', img: 'hub/edge-acres-harvest.png', pixel: true },
        { name: '谷雨', sub: '种子图鉴馆', color: '#1ebc73', img: 'hub/edge-acres-guyu.png', pixel: true },
        { name: '铆钉', sub: '机器人车间', color: '#fb6b1d', img: 'hub/edge-acres-rivet.png', pixel: true },
        { name: '蜜蜡', sub: '蜂箱与浆果丛', color: '#f9c22b', img: 'hub/edge-acres-wax.png', pixel: true },
      ],
      platforms: ['mouse', 'touch', 'pip'],
      keys: [['1–7', '选择 · 开垦 · 播种 · 建造 · 铺路 · 铲除 · 移动'], ['拖动 / 方向键', '移动视野'], ['滚轮 / + -', '缩放'],
        ['P', '置顶小窗'], ['F', '镜头跟随锈崽'], ['H', '显示机器人工作区'], ['Esc', '放下工具 · 关闭面板']],
      hint: '电脑上可以贴在屏幕边、开置顶小窗 · 手机横竖屏都能玩',
      board: { title: '收获榜', note: '按账号所有农场的累计收获排名' },
    },
    {
      id: 'stack-realm', no: 5, name: '叠叠乐大陆', en: 'STACK-REALM', href: 'stack-realm/index.html',
      category: 'strategy', tags: ['卡牌叠放', '生存', '经营', '像素'], released: '2026-10-16', accent: '#e4a672',
      cover: 'hub/stack-realm-cover.webp', coverAlt: '叠叠乐大陆：木架上排着一排卡包，草地桌面上摊开长矛兵、小麦、金币、水果沙拉和小棚屋卡牌',
      pitch: '把卡牌叠在一起就会发生点什么：村民叠在浆果丛上采浆果，叠在树上砍木头。撑过每个月亮的盛宴，让小村庄活下去。',
      desc: '桌面上摊着一堆卡牌：村民、树、石头、浆果丛。把它们叠在一起就开始干活——村民叠在树上砍出木头，木头、石头再叠上一个村民就盖起房子，两个村民住进房子会有孩子。'
        + '每个月亮结束时要让所有人吃饱，金币拿去买新的卡包，卡包里有新的想法、新的地点，也有找上门的野兽和盗贼。'
        + '主大陆之外还有远洋海岛、三个诅咒位面和电气时代的叠叠乐 2000，各有自己的货币、规则和最终首领。开局可选休闲、标准、挑战三档难度，第一局有一步一步的新手教程。'
        + '登录 GAME.INC.RE 账号后，自动存档和三个存档位在各设备同步，完成的任务进入本站任务榜。',
      facts: [['卡牌', '281'], ['配方', '248'], ['任务', '75'], ['世界', '6']],
      cast: [
        { name: '村民', sub: '什么活都能干', color: '#63c74d', img: 'hub/stack-realm-villager.png', pixel: true },
        { name: '机器人', sub: '叠叠乐 2000', color: '#c0cbdc', img: 'hub/stack-realm-robot.png', pixel: true },
        { name: '海盗船长', sub: '远洋海岛', color: '#be4a2f', img: 'hub/stack-realm-pirate_captain.png', pixel: true },
        { name: '贪婪国王', sub: '贪婪之境', color: '#feae34', img: 'hub/stack-realm-greedy_king.png', pixel: true },
        { name: '死神', sub: '死亡之境', color: '#8b9bb4', img: 'hub/stack-realm-reaper.png', pixel: true },
        { name: '大恶魔', sub: '主大陆的首领', color: '#e43b44', img: 'hub/stack-realm-demon.png', pixel: true },
      ],
      platforms: ['mouse', 'keyboard', 'touch'],
      keys: [['拖动卡牌', '叠放 · 开始制作'], ['空格', '暂停'], ['F / Tab', '切换两倍速'], ['M', '世界地图'], ['WASD / 方向键', '移动镜头'],
        ['滚轮 / 0', '缩放 · 看全桌面'], ['Esc', '菜单 · 存档']],
      hint: '电脑与手机都能玩 · 菜单里随时存档',
      board: { title: '任务榜', note: '按完成的任务数排名，任务数相同比月亮数' },
    },
    {
      id: 'iron-line-1917', no: 6, name: '铁血防线', en: 'IRON LINE · 1917', href: 'iron-line-1917/index.html',
      category: 'strategy', tags: ['回合制战棋', '肉鸽', '一战', '像素'], released: '2026-10-16', accent: '#dc9c24',
      cover: 'hub/iron-line-1917-cover.webp', coverAlt: '铁血防线：草地上的 8×8 等距战场，柴油坦克、步兵、教堂钟楼与民房，红框标出敌军下一回合要打的目标',
      pitch: '1917 年的 8×8 战场：敌人下一回合要打哪里都标在地图上。三台柴油战车推、撞、拉，把每一发炮弹引到该去的地方。',
      desc: '一战西线、中东、东线与鲁尔工业区的 8×8 战场。敌军每回合先亮出攻击目标，你的三台柴油战车在它们开火前移动、射击、推开敌人：'
        + '把敌人推进深水，推到同伴的炮口前，或者让它们撞在一起。每一步都能先在沙盘上推演，看清回合结束时的结果再下令。'
        + '战役是一次肉鸽远征：在战区之间选择路线，升级战车，安排驾驶员，购买装备，解放四个战区后进攻梅西讷地下坑道要塞。'
        + '勋章和荣誉币解锁新的连队与驾驶员。新兵训练用两个回合教会全部操作，难度分新兵、老兵、王牌三档。登录 GAME.INC.RE 账号后，战役进度和勋章在各设备同步，战役胜利记入本站战功榜。',
      facts: [['战车', '15'], ['连队', '5'], ['战区', '4 + 1'], ['勋章', '12']],
      cast: [
        { name: '汉斯', sub: '倒戈的装甲兵', color: '#a9b1bf', img: 'hub/iron-line-1917-hans.png', pixel: true },
        { name: '娜塔莉亚', sub: '女子敢死营狙击手', color: '#95a73e', img: 'hub/iron-line-1917-natalia.png', pixel: true },
        { name: '艾萨克', sub: '时间物理学家', color: '#f7f1de', img: 'hub/iron-line-1917-isaac.png', pixel: true },
        { name: '雷诺', sub: '重装工兵', color: '#cfa955', img: 'hub/iron-line-1917-renault.png', pixel: true },
        { name: '伊芙琳', sub: '英国机械师', color: '#e66a2e', img: 'hub/iron-line-1917-evelyn.png', pixel: true },
        { name: '卡尔', sub: '极地导航员', color: '#ffe28a', img: 'hub/iron-line-1917-karl.png', pixel: true },
      ],
      platforms: ['mouse', 'keyboard', 'touch'],
      keys: [['1–4 / Tab', '选择战车'], ['M · Q · W', '移动 · 主武器 · 副武器'], ['U / Ctrl+Z', '撤销移动'], ['H', '参谋部建议'],
        ['Alt', '查看敌军行动顺序'], ['空格 / Enter', '结束回合'], ['Esc', '取消 · 菜单']],
      hint: '手机请横屏 · 电脑上可用键盘操作',
      board: { title: '战功榜', note: '按战役胜利、勋章和战斗胜利排名' },
    },
  ];
  root.HUB_CATALOG = { categories: CATEGORIES, games: GAMES };
})(typeof globalThis !== 'undefined' ? globalThis : window);
