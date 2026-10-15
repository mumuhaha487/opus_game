/* =========================================================
   data_world.js —— 房间、角色、场景互动物体清单
   坐标为 384×256 逻辑像素；x 为中心，y 为脚底（固定物为包围盒）
   ========================================================= */
(function () {
  'use strict';

  // ---------- 角色 ----------
  G.CHARS = {
    nana: { name: '七号', full: '乘客07 · 七号', pt: 'pt_nana', pose: { stand: 'nana_stand', sit: 'nana_sit', walk: 'nana_walk' }, speed: 46, voice: 1.0 },
    kuro: { name: '黑川', full: '风衣男 · 黑川', pt: 'pt_kuro', pose: { stand: 'kuro_stand', sit: 'kuro_sit', crouch: 'kuro_crouch' }, speed: 40, voice: 0.8 },
    tanaka: { name: '田中', full: '醉汉 · 田中', pt: 'pt_tanaka', pose: { stand: 'tanaka_stand', sit: 'tanaka_sit', fight: 'tanaka_fight' }, speed: 32, voice: 0.85 },
    shira: { name: '白鷺', full: '车掌 · 白鷺', pt: 'pt_shira', pose: { stand: 'shira_stand', sit: 'shira_sit', bow: 'shira_bow' }, speed: 40, voice: 1.2 },
    shiori: { name: '栞', full: '少女 · 栞', pt: 'pt_shiori', pose: { stand: 'shiori_stand', sit: 'shiori_sit', reach: 'shiori_reach' }, speed: 44, voice: 1.3 },
    insp: { name: '检札员', full: '检札员（系统）', pt: 'pt_system', pose: { stand: 'insp_stand' }, speed: 34, voice: 0.6 },
  };

  // ---------- 房间 ----------
  G.ROOMS = {
    car04: {
      id: 'car04', name: '4号车厢', bg: 'bg_car04', zoom: 1, walkY: 206, sitY: 185, floorY: 206, ceilY: 34, minX: 10, maxX: 374,
      exits: [
        { side: 'left', x: 16, door: 'gangway04', to: 'car03', toX: 352 },
        { side: 'right', x: 362, door: 'crewdoor', to: 'crew', toX: 100 },
      ],
      lights: [[52, 24], [128, 24], [256, 24], [352, 24]],
    },
    crew: {
      id: 'crew', name: '乘务员室', bg: 'bg_crew2', bgOff: { x: 38, y: 20 }, diorama: true, zoom: 1, walkY: 200, sitY: 190, floorY: 200, ceilY: 24, minX: 74, maxX: 330,
      exits: [{ side: 'left', x: 84, door: 'crewdoor_in', to: 'car04', toX: 340 }],
      lights: [],
    },
    car03: {
      id: 'car03', name: '3号车厢', bg: 'bg_car03', zoom: 1, walkY: 214, sitY: 201, floorY: 214, ceilY: 34, minX: 10, maxX: 372,
      exits: [{ side: 'right', x: 360, door: 'gangway03', to: 'car04', toX: 30 }],
      lights: [],
    },
    void: { id: 'void', name: '剪贴板', bg: null, zoom: 1, walkY: 170, sitY: 170, floorY: 170, ceilY: 20, minX: 40, maxX: 344, exits: [], lights: [] },
    dawn: { id: 'dawn', name: '出口站', bg: 'bg_dawn', zoom: 1, walkY: 236, sitY: 236, floorY: 236, ceilY: 0, minX: 150, maxX: 370, exits: [], lights: [] },
  };

  // ---------- 场景互动物体清单 ----------
  // tags: 字符串，或 {t, lock:true} 表示带锁（无法剪下）
  const L = (t) => ({ t, lock: true });

  G.WORLD = {};

  G.WORLD.car04 = function (S) {
    const act = S.act;
    const list = [
      // —— 角色 ——
      { id: 'nana', kind: 'char', char: 'nana', room: 'car04', x: 118, pose: 'sit', face: 1, brain: 'player', home: { room: 'car04', x: 118, pose: 'sit' },
        tags: act === 1 ? ['passenger', L('nana'), 'sleep', 'scripted'] : ['passenger', act >= 4 ? 'nana' : L('nana')],
        canon: ['passenger', 'nana', 'scripted'],
        desc: '你。系统的测试假人「乘客07」。胸口印着撞击测试用的黑黄标记。' },
      { id: 'kuro', kind: 'char', char: 'kuro', room: 'car04', x: 66, pose: 'sit', face: 1, brain: 'kuro',
        tags: S.flags.kuroFree ? ['detective', 'vigilant'] : ['detective', L('scripted'), 'vigilant'],
        desc: '穿米色风衣的男人。眼神锐利，像是一直在等什么事情发生。' },
      { id: 'tanaka', kind: 'char', char: 'tanaka', room: 'car04', x: 272, pose: 'sit', face: -1, brain: 'tanaka',
        tags: ['passenger', 'drunk', 'sleep'],
        desc: '喝得烂醉的上班族，抱着一升瓶睡得正香。领带歪到了肩膀上。' },
      { id: 'shira', kind: 'char', char: 'shira', room: 'crew', x: 220, pose: 'stand', face: -1, brain: 'shira',
        tags: ['crew', 'patrol'],
        desc: '年轻的女车掌。白手套一尘不染，动作像教科书一样标准。' },
      // —— 物品 ——
      { id: 'bomb', kind: 'item', sprite: 'bag', room: 'car04', x: 270, y: 72, support: 'rack', name: '纸袋',
        tags: ['bomb', L('timer'), 'aggro'],
        desc: '「夜见屋百货」的纸袋，放在网棚上。里面传出细微的“滴答”声。', inspect: 'bomb' },
      { id: 'umbrella', kind: 'item', sprite: 'umbrella', room: 'car04', x: 156, y: 183, support: 'hook', name: '透明伞',
        tags: ['lost', 'clear'],
        desc: '有人忘在扶手上的透明塑料伞。日本的电车里，一年能捡到几十万把。' },
      { id: 'can', kind: 'item', sprite: 'can', room: 'car04', x: 206, y: 230, name: '空罐',
        tags: ['metal', 'roll'],
        desc: '一个空的咖啡罐，随着车厢摇晃骨碌碌地滚。' },
      { id: 'balloon', kind: 'item', sprite: 'balloon', room: 'car04', x: 238, y: 112, tether: { x: 236, y: 160 }, name: '红气球',
        tags: ['zerog', 'fragile'],
        desc: '系在扶手上的红气球。大概是田中从哪个酒会上带回来的。' },
      { id: 'extinguisher', kind: 'item', sprite: 'extinguisher', room: 'car04', x: 346, y: 184, name: '灭火器',
        tags: ['heavy', 'metal'],
        desc: '车厢尽头的灭火器。很重。' },
      { id: 'puddle', kind: 'item', sprite: null, room: 'car04', x: 196, y: 238, name: '冷凝水', draw: 'puddle', w: 18, h: 6,
        tags: ['fluid'],
        desc: '空调出风口一滴一滴落下的冷凝水，在地板上积成一小滩。' },
      // —— 固定物 ——
      { id: 'speaker', kind: 'fixture', room: 'car04', x: 104, y: 14, w: 14, h: 8, draw: 'speaker', name: '车顶扬声器',
        tags: ['magnet', 'chatty'], desc: '车顶的广播扬声器。纸盆后面是一块不小的磁铁。' },
      { id: 'lcd', kind: 'fixture', printed: true, room: 'car04', x: 160, y: 62, w: 64, h: 15, draw: 'lcd', name: '车门上方显示屏',
        tags: ['fast', act >= 4 ? 'exit' : L('exit')], desc: '橙色的 LED 显示屏：「快速 出口行」。' },
      { id: 'routemap', kind: 'fixture', printed: true, room: 'car04', x: 164, y: 137, w: 26, h: 13, draw: 'routemap', name: '路线图',
        tags: ['reverse', 'loop'], desc: '贴在车门上的夜见线路线图。环状线，箭头标着「外回り」与「内回り」。', inspect: 'routemap' },
      { id: 'danger', kind: 'fixture', printed: true, room: 'car04', x: 201, y: 138, w: 15, h: 11, draw: 'danger', name: '当心夹手贴纸',
        tags: ['threat'], desc: '「指をはさまないよう ご注意ください」——当心夹手。右上角一个大大的「危険」。' },
      { id: 'yusen', kind: 'fixture', printed: true, room: 'car04', x: 333, y: 90, w: 12, h: 15, draw: 'yusen', name: '优先席贴纸',
        tags: ['polite'], desc: '「優先席」：请把座位让给有需要的人。' },
      { id: 'ebutton', kind: 'fixture', printed: true, room: 'car04', x: 151, y: 104, w: 7, h: 11, draw: 'ebutton', name: '非常通报按钮',
        tags: ['emergency'], desc: '「非常通報ボタン」：紧急时按下，乘务员会马上赶来。' },
      { id: 'crewsign', kind: 'fixture', room: 'car04', x: 352, y: 126, w: 24, h: 12, draw: 'crewsign', name: '门牌',
        tags: ['forbid'], desc: '「関係者以外立入禁止」——非相关人员禁止入内。' },
      { id: 'crewdoor', kind: 'door', room: 'car04', x: 347, y: 77, w: 35, h: 101, draw: 'crewdoor', name: '乘务员室门', exit: 'right', vent: true,
        tags: [L('door'), L('lock'), 'crewonly'], desc: '通往乘务员室的门。门下方有一排通风百叶。', rule: 'crewsign' },
      { id: 'gangway04', kind: 'door', room: 'car04', x: 0, y: 70, w: 31, h: 108, draw: 'gangway', name: '贯通门', exit: 'left',
        tags: [L('door'), act >= 3 ? 'still' : L('still')], desc: '通往 3 号车厢的贯通门。透过小窗看过去……那边的一切都一动不动。' },
      { id: 'reflection', kind: 'fixture', printed: true, room: 'car04', x: 56, y: 88, w: 88, h: 42, draw: 'reflection', name: '车窗倒影',
        tags: ['reflection', 'nocollide'], desc: '隧道里一片漆黑，车窗变成了镜子，映出车厢里的人影。' },
      { id: 'ad_big', kind: 'fixture', printed: true, room: 'car04', x: 42, y: 30, w: 30, h: 30, draw: 'ad', ad: 'big', name: '吊环广告·夜见屋',
        tags: ['giant'], desc: '「夜见屋百货 秋季大感谢祭——全场 BIG 尺寸！」' },
      { id: 'ad_copy', kind: 'fixture', printed: true, room: 'car04', x: 129, y: 32, w: 32, h: 28, draw: 'ad', ad: 'copy', name: '吊环广告·复印机',
        tags: ['copy'], desc: '「新款复印机——一模一样，要几张有几张。」' },
      { id: 'ad_sleep', kind: 'fixture', printed: true, room: 'car04', x: 308, y: 30, w: 30, h: 31, draw: 'ad', ad: 'sleep', name: '吊环广告·安眠',
        tags: ['sleep'], desc: '「安眠补充剂『熟睡』——一颗下去，雷打不动。」' },
      { id: 'env04', kind: 'env', room: 'car04', x: 3, y: 3, w: 30, h: 13, draw: 'plate', plate: '4号車', name: '4号车厢',
        tags: [], desc: '你所在的车厢。也是这场测试唯一“完整生成”的车厢。' },
    ];
    if (act === 1) {
      list.push({ id: 'booklet', kind: 'item', sprite: 'booklet', room: 'car04', x: 136, y: 160, support: 'seat', name: '台本',
        tags: [], desc: '座位上的一本薄薄的册子。封面写着：「夜見線・終電 台本（第4096稿）」。', inspect: 'booklet' });
    }
    return list;
  };

  G.WORLD.crew = function (S) {
    return [
      { id: 'crewdoor_in', kind: 'door', room: 'crew', x: 62, y: 45, w: 53, h: 123, draw: 'none', name: '门（车厢侧）', exit: 'left', tags: [], desc: '回 4 号车厢的门。从里面可以直接打开。' },
      { id: 'mic', kind: 'fixture', printed: true, room: 'crew', x: 145, y: 64, w: 16, h: 36, draw: 'none', name: '广播麦克风', tags: ['broadcast'],
        desc: '车内广播用的话筒。贴在它身上的词条，会通过扬声器广播给 4 号车厢里的每一个人。' },
      { id: 'monitor', kind: 'fixture', room: 'crew', x: 166, y: 94, w: 31, h: 21, draw: 'monitor', name: '运行监视器', tags: [],
        desc: '一块单色小屏幕，上面滚动着车辆状态。', inspect: 'monitor' },
      { id: 'stamp', kind: 'item', sprite: 'stamp', room: 'crew', x: 136, y: 98, support: 'desk', name: '印章', tags: ['anomaly'],
        desc: '红色橡皮章。印面上刻着一个字：「異」。' },
      { id: 'signroll', kind: 'fixture', printed: true, room: 'crew', x: 123, y: 80, w: 12, h: 17, draw: 'none', name: '方向幕开关', tags: ['oos'],
        desc: '切换列车方向幕的旋钮。当前档位：「回送」。（这辆车，本来就不该载客。）' },
      { id: 'rearwin', kind: 'fixture', room: 'crew', x: 204, y: 54, w: 87, h: 60, draw: 'none', name: '后窗', tags: [], desc: '车尾的窗。隧道向后延伸……', inspect: 'rearwin' },
      { id: 'crewbag', kind: 'fixture', room: 'crew', x: 304, y: 58, w: 28, h: 54, draw: 'none', name: '车掌的包', tags: [], desc: '车掌的公文包。里面整整齐齐：时刻表、白手套的替换装、一本写满了字的笔记。', inspect: 'crewbag' },
      { id: 'trashbin', kind: 'fixture', printed: true, room: 'crew', x: 284, y: 139, w: 22, h: 32, draw: 'none', name: '垃圾桶', tags: ['trash'], desc: '不锈钢垃圾桶。' },
      { id: 'lostbox', kind: 'fixture', room: 'crew', x: 302, y: 149, w: 27, h: 26, draw: 'lostbox', name: '失物箱', tags: [], desc: '纸箱上写着「忘れ物」。' },
      { id: 'envcrew', kind: 'env', room: 'crew', x: 3, y: 3, w: 48, h: 13, draw: 'plate', plate: '乗務員室', name: '乘务员室', tags: [], desc: '狭小的乘务员室，像一个悬在黑暗里的盒子。' },
    ];
  };

  G.WORLD.car03 = function (S) {
    const freed = S.flags.shioriFree;
    const list = [
      { id: 'env03', kind: 'env', room: 'car03', x: 3, y: 3, w: 30, h: 13, draw: 'plate', plate: '3号車', name: '3号车厢',
        tags: [S.flags.car03Thawed ? 'oos' : L('still'), 'oos'].filter((v, i) => !(S.flags.car03Thawed && i === 0)), desc: '整节车厢被冻结在某一瞬间。灰尘悬在半空，报纸停在下落途中。' },
      { id: 'gangway03', kind: 'door', room: 'car03', x: 344, y: 62, w: 38, h: 142, draw: 'none', name: '贯通门', exit: 'right', tags: [], desc: '回 4 号车厢。' },
      { id: 'eraser', kind: 'item', sprite: 'eraser', room: 'car03', x: 300, y: 150, frozenAir: true, name: '橡皮', tags: ['erase', 'still'],
        desc: '从书包里掉出来的橡皮，停在半空中。' },
      { id: 'can03', kind: 'item', sprite: 'can', room: 'car03', x: 196, y: 120, frozenAir: true, name: '悬空的罐子', tags: ['metal', 'still'], desc: '停在半空的罐子。' },
      { id: 'paper03', kind: 'item', sprite: 'newspaper', room: 'car03', x: 96, y: 128, frozenAir: true, name: '报纸', tags: ['still', 'chatty'], desc: '一份停在下落途中的晚报。头版标题：「夜見線、今夜も定刻運行」。' },
      { id: 'lcd03', kind: 'fixture', printed: true, room: 'car03', x: 130, y: 61, w: 44, h: 12, draw: 'lcd03', name: '显示屏', tags: ['slow'], desc: '「各停 白紙行」——这节车厢的显示屏和隔壁不一样。' },
      { id: 'ad_mini', kind: 'fixture', printed: true, room: 'car03', x: 36, y: 32, w: 44, h: 32, draw: 'ad', ad: 'mini', name: '吊环广告·紧凑家电', tags: ['mini'], desc: '「紧凑家电节——小一点，聪明一点。」' },
      { id: 'ebutton03', kind: 'fixture', printed: true, room: 'car03', x: 332, y: 112, w: 7, h: 11, draw: 'ebutton', name: '非常通报按钮', tags: ['emergency'], desc: '少女的指尖离它只有一厘米。' },
      { id: 'ph1', kind: 'char', char: 'tanaka', placeholder: true, room: 'car03', x: 40, pose: 'sit', face: 1, brain: null, name: '未生成乘客', tags: [L('still')], desc: '灰色的、没有细节的人形。系统懒得为它们生成长相。' },
      { id: 'ph2', kind: 'char', char: 'kuro', placeholder: true, room: 'car03', x: 230, pose: 'sit', face: 1, brain: null, name: '未生成乘客', tags: [L('still')], desc: '灰色的、没有细节的人形。' },
      { id: 'ph3', kind: 'char', char: 'shira', placeholder: true, room: 'car03', x: 158, pose: 'stand', face: -1, brain: null, name: '未生成乘客', tags: [L('still')], desc: '灰色的、没有细节的人形，抓着吊环。' },
    ];
    if (!freed) list.push({ id: 'shiori', kind: 'char', char: 'shiori', room: 'car03', x: 318, pose: 'reach', face: 1, brain: 'shiori', frozenGirl: true,
      tags: ['passenger', L('still'), L('lock'), 'bookmark'], desc: '穿水手服的少女，伸手去按非常按钮——就在那一刻被冻住了。' });
    return list;
  };

  // 每个房间的编号牌位置等装饰，用于点击房间本身
})();
