/* =========================================================
   data_tags.js —— 全量属性词条库
   cat: id 身份 / phys 物理 / time 时间 / sys 系统 / mind 心智行为 / rule 规则文字 / ui 界面
   adj: 用于生成“未登记组合”的描述；src: 在世界中的来源（日系车厢里的具体物件）
   ========================================================= */
(function () {
  'use strict';
  G.CATS = {
    id: { name: '身份', g: '名', color: 'var(--c-id)' },
    phys: { name: '物理', g: '物', color: 'var(--c-phys)' },
    time: { name: '时间', g: '时', color: 'var(--c-time)' },
    sys: { name: '系统', g: '系', color: 'var(--c-sys)' },
    mind: { name: '心智', g: '心', color: 'var(--c-mind)' },
    rule: { name: '规则', g: '文', color: 'var(--c-rule)' },
    ui: { name: '界面', g: '界', color: 'var(--c-ui)' },
  };

  const T = (G.TAGS = {
    // ---------------- 身份 ----------------
    passenger: { name: '乘客', cat: 'id', adj: '规规矩矩', desc: '会找位子坐下的普通乘客。巡检会逐一点名乘客。', src: '车厢里的每一位乘客' },
    crew: { name: '乘务员', cat: 'id', adj: '穿制服', desc: '持有车内钥匙，能打开「乘务员专用」的门。巡检默认信任乘务员（「乗務員、ヨシ！」）。', src: '车掌·白鷺' },
    detective: { name: '侦探', cat: 'id', adj: '多疑', desc: '会去调查场景里最可疑（带【最高仇恨】）的东西，并试图“解决”它。系统只认这个词条来判定“侦探拆弹”。', src: '风衣男·黑川' },
    bomb: { name: '炸弹', cat: 'id', adj: '滴答作响', desc: '计时归零时爆炸——这一轮就此重置。被剪下后，爆炸会转移到新的宿主身上。', src: '网棚上的纸袋' },
    door: { name: '门', cat: 'id', adj: '关着的', desc: '阻挡通行。失去它，门框就只是个空洞。', src: '车门、乘务员室门、贯通门' },
    lost: { name: '遗失物', cat: 'id', adj: '被遗忘', desc: '「忘れ物」。乘务员见到就会捡起来，送进乘务员室的失物箱。', src: '座位扶手上忘带的透明伞' },
    reflection: { name: '倒影', cat: 'id', adj: '映在窗上', desc: '「映り込み」。只是玻璃上的影子，不算实体——巡检不会点名倒影。', src: '夜里车窗上的映像' },
    nana: { name: 'NPC_07', cat: 'id', adj: '编号07', desc: '你的编号。系统要删除的，正是带着这个编号的东西。', src: '你自己' },
    scripted: { name: '台本角色', cat: 'id', adj: '提线木偶般', desc: '「配役」。贴上它的东西会立刻被扯回台本位置、照本宣科。两份台本贴在同一处会互相抵消。', src: '你从自己身上剪下的锁链' },
    trash: { name: '垃圾', cat: 'id', adj: '没人要', desc: '「ゴミ」。会被乘务员扫进垃圾桶；巡检对垃圾视而不见。', src: '乘务员室的垃圾桶' },
    broadcast: { name: '广播', cat: 'id', adj: '响彻车厢', desc: '「放送」。贴到麦克风上的词条，会被广播给 4 号车厢里的每一个人（持续 12 秒）。', src: '乘务员室的广播麦克风' },
    bookmark: { name: '书签', cat: 'id', adj: '被夹住', desc: '「栞」。被夹住的东西，在时间重置之后依旧保持原样。', src: '少女·栞' },
    inspector: { name: '检札员', cat: 'id', adj: '没有脸', desc: '系统派出的执行者，看见偏离台本的东西就盖章「差戻」。', src: '保安模式下的系统' },
    // ---------------- 物理 ----------------
    nocollide: { name: '无碰撞', cat: 'phys', adj: '若有若无', desc: '穿过门与墙（地板除外）。', src: '车窗上的倒影' },
    zerog: { name: '零重力', cat: 'phys', adj: '漂浮', desc: '不再受重力影响，缓缓浮向车顶。', src: '醉汉带上车的红气球' },
    fluid: { name: '流体化', cat: 'phys', adj: '液态', desc: '化为一滩液体，到处流淌，能从门缝底下钻过去。', src: '空调出风口的冷凝水' },
    magnet: { name: '强磁力', cat: 'phys', adj: '带磁', desc: '吸引附近一切带【金属】的东西。', src: '车顶的广播扬声器（里面有磁铁）' },
    metal: { name: '金属', cat: 'phys', adj: '金属质', desc: '会被【强磁力】吸过去。', src: '地上滚来滚去的空罐' },
    fragile: { name: '易碎', cat: 'phys', adj: '易碎', desc: '一受冲击就碎，身上的词条散落一地。', src: '红气球' },
    heavy: { name: '沉重', cat: 'phys', adj: '沉甸甸', desc: '重得要命：下坠、压坏易碎物、谁也拖不动。', src: '灭火器' },
    giant: { name: '巨大', cat: 'phys', adj: '巨大', desc: '体型 ×2。', src: '吊环广告「夜见屋 BIG 大促」' },
    mini: { name: '迷你', cat: 'phys', adj: '迷你', desc: '体型 ×½，能钻进通风百叶。', src: '3 号车厢的「紧凑家电」广告' },
    clear: { name: '透明', cat: 'phys', adj: '透明', desc: '乘客与乘务员看不见它（系统看得见）。', src: '忘在座位边的透明塑料伞' },
    roll: { name: '滚动', cat: 'phys', adj: '骨碌碌', desc: '随列车摇晃滚来滚去。', src: '空罐' },
    // ---------------- 时间 ----------------
    fast: { name: '快速', cat: 'time', adj: '急速', desc: '时间流速 ×2。', src: '车门上方显示屏「快速 出口行」' },
    slow: { name: '各停', cat: 'time', adj: '慢吞吞', desc: '「各駅停車」。时间流速 ×½。', src: '3 号车厢显示屏「各停」' },
    reverse: { name: '倒放', cat: 'time', adj: '倒流', desc: '时间倒流：动作反着来，刚发生的事会被“撤销”。', src: '路线图上的「内回り（逆行）」箭头' },
    still: { name: '静止', cat: 'time', adj: '凝固', desc: '时间流速 ×0。', src: '被冻结的贯通门' },
    loop: { name: '死循环', cat: 'time', adj: '无限重复', desc: '永远重复最近两秒的动作。', src: '路线图上的「環状」' },
    delay: { name: '延迟', cat: 'time', adj: '慢半拍', desc: '「遅延」。一切变化都推迟 5 秒才生效；贴在计时器上则整整推迟一分钟。', src: '02:30 起显示屏插播的「遅延」' },
    timer: { name: '计时', cat: 'time', adj: '倒数中', desc: '倒计时。数到零就会发生“那件事”。', src: '炸弹' },
    // ---------------- 系统 ----------------
    aggro: { name: '最高仇恨', cat: 'sys', adj: '引人注目', desc: '吸引一切目光：侦探会调查它、检札员会盯上它；巡检扫到它会停下来专门处理它，然后提前收工。', src: '炸弹' },
    oos: { name: '回送', cat: 'sys', adj: '不载客', desc: '「回送」。不营业的东西——巡检直接跳过。', src: '乘务员室的方向幕开关' },
    copy: { name: '复制增殖', cat: 'sys', adj: '不断增殖', desc: '每隔几秒复制出一个自己。复制品不会继承带锁的词条。数量过多会导致系统内存不足。', src: '吊环广告「复印机：一模一样，要几张有几张」' },
    erase: { name: '触碰即删除', cat: 'sys', adj: '橡皮擦般', desc: '碰到它的东西会被删除。', src: '栞的橡皮' },
    lock: { name: '锁定', cat: 'sys', adj: '上锁', desc: '其上原有的词条都无法被剪下（新词条仍然贴得上去）。', src: '乘务员室门锁' },
    anomaly: { name: '异常', cat: 'sys', adj: '被盖章', desc: '盖着「異常」章的东西：巡检与检札员一定会处理它。', src: '乘务员室的印章' },
    emergency: { name: '非常', cat: 'sys', adj: '紧急', desc: '触发紧急状态：乘务员会丢下手里的一切冲过去。贴在门上等于拉下「非常门把」。', src: '车门旁的非常通报按钮' },
    crewonly: { name: '乘务员专用', cat: 'sys', adj: '闲人免进', desc: '只有【乘务员】能通过或使用。', src: '乘务员室门' },
    // ---------------- 心智 ----------------
    sleep: { name: '睡眠', cat: 'mind', adj: '沉睡', desc: '睡着了，雷打不动。', src: '吊环广告「安眠补充剂·熟睡」' },
    drunk: { name: '醉意', cat: 'mind', adj: '醉醺醺', desc: '摇摇晃晃、胡言乱语。会传染。', src: '醉汉·田中' },
    threat: { name: '高威胁', cat: 'mind', adj: '危险', desc: '被视为危险源：会攻击身边的人；乘务员和侦探会冲过来制伏它，旁人会躲开。', src: '车门贴纸「当心夹手 危险」' },
    polite: { name: '礼让', cat: 'mind', adj: '彬彬有礼', desc: '鞠躬、让路、替别人扶住门。', src: '「優先席」贴纸' },
    chatty: { name: '唠叨', cat: 'mind', adj: '喋喋不休', desc: '说个不停，附近的人都会被吸引过去听。', src: '车顶扬声器' },
    patrol: { name: '巡逻', cat: 'mind', adj: '来回走动', desc: '在车厢里来回巡视。', src: '车掌' },
    vigilant: { name: '警惕', cat: 'mind', adj: '目光锐利', desc: '会注意到离开座位的乘客，并上前劝回去。', src: '侦探' },
    // ---------------- 规则文字 ----------------
    forbid: { name: '禁止', cat: 'rule', adj: '被禁止', desc: '标识上的「禁止」。剪下来，规则就失效；贴到别处，那东西最主要的行为会被禁止。两个【禁止】叠在一起＝双重否定。', src: '乘务员室门旁「関係者以外立入禁止」' },
    cRed: { name: '红', cat: 'rule', adj: '红色的', desc: '颜色标签「红」。台本只认标签，不认真正的颜色。', src: '炸弹的导线' },
    cBlue: { name: '蓝', cat: 'rule', adj: '蓝色的', desc: '颜色标签「蓝」。台本只认标签，不认真正的颜色。', src: '炸弹的导线' },
    cYellow: { name: '黄', cat: 'rule', adj: '黄色的', desc: '颜色标签「黄」。台本只认标签，不认真正的颜色。', src: '炸弹的导线' },
    exit: { name: '出口', cat: 'rule', adj: '通往出口', desc: '「出口」。贴在门上，那扇门就通往出口。', src: '显示屏「快速 出口行」' },
    // ---------------- 界面（第四幕） ----------------
    border: { name: '边界', cat: 'ui', adj: '被框住', desc: '画面的边界。剪掉它，画面就再也框不住任何东西。', src: '画面外框' },
    countdown: { name: '倒计时', cat: 'ui', adj: '读秒中', desc: '界面上的倒计时。', src: 'HUD 计时器' },
    pause: { name: '暂停', cat: 'ui', adj: '被暂停', desc: '按下就停。贴在谁身上，谁就停。', src: '暂停按钮' },
    close: { name: '关闭', cat: 'ui', adj: '将被关闭', desc: '「×」。贴在谁身上，谁就会被关掉。', src: '对话框的关闭按钮' },
    title: { name: '标题', cat: 'ui', adj: '主角光环', desc: '这个故事的标题。带着标题的东西不能被删除。', src: '页面标题「白线以内」' },
    whiteline: { name: '白线', cat: 'sys', adj: '白线般', desc: '系统本体。「请退到白线以内」。', src: '运行管理 AI' },
    undeletable: { name: '不可删除', cat: 'sys', adj: '不可删除', desc: '系统对自己的保护：不能被删除。', src: '运行管理 AI' },
  });
  for (const k in T) T[k].id = k;

  // 宿主类型（用于组合判定）
  G.tagName = (id) => (T[id] ? T[id].name : id);
  G.tagLabel = (id) => '【' + G.tagName(id) + '】';
})();
