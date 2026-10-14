// 美股可交易名单（白名单），浏览器与 Worker 共用。代码 + 腾讯交易所后缀 + 中文名 + 分组。
// 名单外的代码一律拒绝；指数只用于展示。后缀用于腾讯分时/K 线接口（例如 usAAPL.OQ）。
(function (root) {
  const rows = [
    // 科技
    ['AAPL', 'OQ', '苹果', 'tech'], ['MSFT', 'OQ', '微软', 'tech'], ['NVDA', 'OQ', '英伟达', 'tech'],
    ['GOOGL', 'OQ', '谷歌-A', 'tech'], ['AMZN', 'OQ', '亚马逊', 'tech'], ['META', 'OQ', 'Meta', 'tech'],
    ['TSLA', 'OQ', '特斯拉', 'tech'], ['AVGO', 'OQ', '博通', 'tech'], ['ORCL', 'N', '甲骨文', 'tech'],
    ['ADBE', 'OQ', 'Adobe', 'tech'], ['CRM', 'N', '赛富时', 'tech'], ['AMD', 'OQ', '超威半导体', 'tech'],
    ['INTC', 'OQ', '英特尔', 'tech'], ['QCOM', 'OQ', '高通', 'tech'], ['TXN', 'OQ', '德州仪器', 'tech'],
    ['CSCO', 'OQ', '思科', 'tech'], ['IBM', 'N', 'IBM', 'tech'], ['NFLX', 'OQ', '奈飞', 'tech'],
    ['ASML', 'OQ', '阿斯麦', 'tech'], ['TSM', 'N', '台积电', 'tech'], ['ARM', 'OQ', '安谋', 'tech'],
    ['SMCI', 'OQ', '超微电脑', 'tech'], ['PLTR', 'OQ', 'Palantir', 'tech'], ['SNOW', 'N', 'Snowflake', 'tech'],
    ['SHOP', 'OQ', 'Shopify', 'tech'], ['UBER', 'N', '优步', 'tech'], ['ABNB', 'OQ', '爱彼迎', 'tech'],
    ['PYPL', 'OQ', 'PayPal', 'tech'], ['COIN', 'OQ', 'Coinbase', 'tech'], ['MSTR', 'OQ', 'Strategy', 'tech'],
    ['MU', 'OQ', '美光科技', 'tech'], ['DELL', 'N', '戴尔科技', 'tech'],
    // 金融
    ['JPM', 'N', '摩根大通', 'finance'], ['V', 'N', 'Visa', 'finance'],
    ['MA', 'N', '万事达', 'finance'], ['BAC', 'N', '美国银行', 'finance'], ['WFC', 'N', '富国银行', 'finance'],
    ['GS', 'N', '高盛', 'finance'], ['MS', 'N', '摩根士丹利', 'finance'], ['C', 'N', '花旗集团', 'finance'],
    ['AXP', 'N', '美国运通', 'finance'],
    // 医药
    ['UNH', 'N', '联合健康', 'health'], ['LLY', 'N', '礼来', 'health'], ['JNJ', 'N', '强生', 'health'],
    ['PFE', 'N', '辉瑞', 'health'], ['MRK', 'N', '默沙东', 'health'], ['ABBV', 'N', '艾伯维', 'health'],
    ['NVO', 'N', '诺和诺德', 'health'],
    // 消费与工业能源
    ['WMT', 'OQ', '沃尔玛', 'consumer'], ['COST', 'OQ', '好市多', 'consumer'], ['PG', 'N', '宝洁', 'consumer'],
    ['KO', 'N', '可口可乐', 'consumer'], ['PEP', 'OQ', '百事可乐', 'consumer'], ['MCD', 'N', '麦当劳', 'consumer'],
    ['NKE', 'N', '耐克', 'consumer'], ['DIS', 'N', '迪士尼', 'consumer'], ['SBUX', 'OQ', '星巴克', 'consumer'],
    ['HD', 'N', '家得宝', 'consumer'], ['BA', 'N', '波音', 'industry'], ['CAT', 'N', '卡特彼勒', 'industry'],
    ['GE', 'N', 'GE 航空航天', 'industry'], ['XOM', 'N', '埃克森美孚', 'industry'], ['CVX', 'N', '雪佛龙', 'industry'],
    ['T', 'N', '美国电话电报', 'industry'], ['VZ', 'N', '威瑞森通信', 'industry'],
    // 中概股
    ['BABA', 'N', '阿里巴巴', 'china'], ['PDD', 'OQ', '拼多多', 'china'], ['JD', 'OQ', '京东', 'china'],
    ['BIDU', 'OQ', '百度', 'china'], ['NIO', 'N', '蔚来', 'china'], ['LI', 'OQ', '理想汽车', 'china'],
    ['XPEV', 'N', '小鹏汽车', 'china'], ['NTES', 'OQ', '网易', 'china'], ['BILI', 'OQ', '哔哩哔哩', 'china'],
    ['TME', 'N', '腾讯音乐', 'china'], ['TCOM', 'OQ', '携程', 'china'],
    // ETF
    ['SPY', 'AM', '标普500 ETF', 'etf'], ['QQQ', 'OQ', '纳指100 ETF', 'etf'], ['DIA', 'AM', '道琼斯 ETF', 'etf'],
    ['IWM', 'AM', '罗素2000 ETF', 'etf'], ['VOO', 'AM', '标普500 ETF-Vanguard', 'etf'], ['ARKK', 'AM', '方舟创新 ETF', 'etf'],
    ['GLD', 'AM', '黄金 ETF', 'etf'], ['TLT', 'OQ', '20年期美债 ETF', 'etf'], ['SOXX', 'OQ', '费城半导体 ETF', 'etf'],
  ];
  const universe = rows.map(([ticker, exchange, name, group]) => ({ ticker, exchange, name, group, tencent: 'us' + ticker }));
  root.US_UNIVERSE = Object.freeze(universe.map(Object.freeze));
  root.US_GROUPS = Object.freeze([['all', '全部'], ['tech', '科技'], ['china', '中概股'], ['finance', '金融'],
    ['health', '医药'], ['consumer', '消费'], ['industry', '工业能源'], ['etf', 'ETF']]);
  root.US_INDICES = Object.freeze([['DJI', '道琼斯'], ['IXIC', '纳斯达克'], ['INX', '标普500']]);
})(globalThis);
