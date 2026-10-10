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
      cover: 'hub/tbmh-cover.png', coverAlt: '悬赏怪物猎人：希娅在深渊王座迎战深渊执政官，通缉令高悬',
      pitch: '接下悬赏令，四个难度、九大地域、三百六十关的像素刷宝长征，还能缩成置顶小窗边干活边打怪。',
      desc: '赏金猎人一路自动出征：一波波怪群之后是带光环的头目，第十关通缉令落下，限时砍翻悬赏首领。怪物、头目和首领掉落三种宝箱，开出十个品质的装备——二十三种类型、每种二十一档各有名字，带随机词条、宝石孔和改变打法的传说效果。魔方负责合成、炼金、制作、镶嵌、铭刻、供奉与重铸；金币点亮四十八个节点的符文树；剑盾、双斧、长弓、重弩、法杖、权杖六种流派，换把武器就换一套技能。宠物、公会告示板、贪婪矿井、首领连战与突变试炼轮番登场，离线回来照样有收获。',
      facts: [['关卡', '360'], ['怪物', '70'], ['具名装备', '483'], ['技能', '39']],
      cast: [
        { name: '洛恩', sub: '银发猎人 · 宽檐帽', color: '#c0cbdc', img: 'hub/tbmh-loen.png', pixel: true },
        { name: '希娅', sub: '金发猎手 · 高马尾', color: '#feae34', img: 'hub/tbmh-sia.png', pixel: true },
      ],
      platforms: ['mouse', 'touch', 'pip'],
      keys: [['1–8', '切换页签'], ['P', '推进 / 刷关'], ['M', '置顶小窗'], ['滚轮 / 拖动', '滚动列表与符文树']],
      hint: '横屏竖屏都能玩 · Chrome / Edge 可开置顶小窗',
    },
  ];
  root.HUB_CATALOG = { categories: CATEGORIES, games: GAMES };
})(typeof globalThis !== 'undefined' ? globalThis : window);
