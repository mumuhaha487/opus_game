import { GameKeys } from '../hub/keys-ui.js';
// DESIGN §5 / PLATFORM §6：网页会话管理密钥；样例只展示，所有动态文本使用 textContent。
import { documentationExamples } from './examples.js';
const byId = id => document.getElementById(id);
const element = (tag, text = '', className = '') => {
  const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
};
const button = (text, action, className = 'ghost px') => {
  const node = element('button', text, className); node.type = 'button'; node.addEventListener('click', action); return node;
};
async function copy(text, control) {
  try { await navigator.clipboard.writeText(text); control.textContent = '已复制'; }
  catch { control.textContent = '请选择文字复制'; }
}
GameKeys.mount(byId('keys'), { project: null });

// PLATFORM §6.6：目录与接口示例；展示来自第二轮真实本地响应，代码中的凭据均为占位符。
const docs = byId('docs-body'), navigation = byId('docs-nav');
function section(id, title, paragraphs = []) {
  const link = element('a', title); link.href = '#' + id; navigation.append(link);
  const node = element('section', '', 'doc-section'); node.id = id;
  node.append(element('h2', title, 'px'), ...paragraphs.map(text => element('p', text))); docs.append(node); return node;
}
function codeBlock(parent, label, content) {
  const box = element('div', '', 'doc-code'), pre = element('pre'), code = element('code', content);
  pre.append(code); box.append(button('复制', event => copy(content, event.target)), pre);
  parent.append(element('h4', label, 'px'), box);
}
function sample(parent, entry) {
  const details = element('details', '', 'doc-sample');
  details.append(element('summary', entry.label + ' · HTTP ' + entry.response.status));
  codeBlock(details, 'curl', entry.curl.join('\n'));
  if (entry.requestJsonForCurl) codeBlock(details, 'request.json', JSON.stringify(entry.requestJsonForCurl, null, 2));
  codeBlock(details, 'Python requests', entry.python.join('\n'));
  codeBlock(details, '响应 JSON', JSON.stringify(entry.response.body, null, 2));
  if (Object.keys(entry.response.headers).length) codeBlock(details, '响应头',
    Object.entries(entry.response.headers).map(([name, value]) => name + ': ' + value).join('\n'));
  parent.append(details);
}
const auth = section('authentication', '鉴权与权限', [
  '基址：https://game.inc.re/api/v1/。在服务端使用 Authorization: Bearer <API_KEY> 调用。',
  '读取权限用于余额、行情、委托与成交；交易权限用于下单、撤单、划转和合约操作。',
  '接口只认 API Key；同时携带 Cookie 时也按 Key 认证。第三方网页受同源策略限制，AI Agent 应在服务端调用。',
  '签到、密钥管理、账号操作、游戏存档和点赞使用网站会话。创建密钥时确认使用须知；密钥只在生成时显示一次。',
]);
codeBlock(auth, '鉴权头', 'Authorization: Bearer <API_KEY>');
section('limits', '额度与轮询', [
  '每个 Key 每分钟 GET 10 次、POST 10 次，分别计数；每个 Key 每天 1500 次，每个账号每天 3000 次。',
  '每日额度按北京时间重置。建议每 30–60 秒轮询一次；收到 429 时按 Retry-After 等待后再试。',
  '响应包含 X-RateLimit-Limit、X-RateLimit-Remaining、X-Request-Id，以及每日 Key 和账号剩余额度头。',
  '分钟额度采用近似计数；每日额度按批次合并，分布式调用会有少量计数误差。',
  '网页和 API 合计每日最多 500 笔委托；账号交易类 POST 共用每分钟 40 次上限。',
  '成功 GET 调用记录每 Key 每分钟采样一次；POST 和错误调用逐次记录，保留最近 100 条。',
]);
const errors = section('errors', '错误与重试', [
  '错误统一返回 { error, message }。记录 X-Request-Id 可帮助定位调用；限流返回 Retry-After。',
  '401：Key 无效、到期或撤销；403：权限不足或需要确认使用须知；404：接口或资源不存在。',
  '409：密钥数量上限、委托冲突；422：参数或交易规则不满足；429：分钟、每日调用或委托额度用尽。',
  '503：行情、汇率或服务暂时不可用，稍后重试；413：请求体过大；415：媒体类型错误；405：方法不支持。',
  '下单 clientId 必填。重试同一次意图时沿用 clientId；新的交易意图使用新的 clientId。',
]);
sample(errors, documentationExamples.examples[3]); sample(errors, documentationExamples.examples[8]);
sample(errors, documentationExamples.examples[26]);
const groups = [
  ['key-lifecycle', '网页密钥管理', [0, 4, 5, 24, 25], [
    'GET /api/keys 列表，POST /api/keys 创建，GET /api/keys/log?id= 调用记录，POST /api/keys/revoke 撤销。',
    '使用同源 Cookie 会话；创建要求登录密码、exchange 项目、read 或 read+trade 权限、30/90/180 天有效期和免责确认。',
    '每个账号最多 5 个有效密钥。以下创建响应已脱敏，实际创建响应另含只返回一次的 key 字段。',
  ]],
  ['account', '账户与估值', [1, 15, 23], [
    'GET /api/v1/account · read。返回钱包 USD、原生子账户余额、持仓可卖数量、仓位与 totalUSD / totalCNY。',
    '读取会触发结算（2 秒节流）。汇率不可用时保留原生余额，相关估值为 null；partial 表示结算仍需继续。',
  ]],
  ['quote', '行情报价', [2, 7], [
    'GET /api/v1/quote · read。market=crypto 或 ashare，symbol=BTC_USDT 或 sh600519。',
    '返回 last、bid、ask、time；A 股另含 limitUp、limitDown、status。行情来自服务端公开数据源。',
  ]],
  ['orders', '委托与下单', [10, 12, 9, 17, 20], [
    'GET /api/v1/orders · read。status=open 或 history；market=crypto_spot、crypto_futures、ashare。',
    'POST /api/v1/orders · trade。market 与 clientId 必填；股票用 code，加密用 symbol；side=buy/sell、type=market/limit。',
    '限价单填写 price，数量用十进制字符串 qty；现货市价买单也可用 quoteQty。合约支持 leverage、reduceOnly、tp、sl。',
    'A 股 qty 为整数股：主板/创业板买入整百股，科创板至少 200 股；T+1，非交易时段只接收限价预埋。',
    '交易时段为北京时间 09:30–11:30、13:00–15:00；撮合、费用、每日上限与网站相同。',
  ]],
  ['cancel', '撤销委托', [11], ['POST /api/v1/orders/cancel · trade。提交 market 和委托 id；撤销后释放未成交部分冻结资金。']],
  ['trades', '成交记录', [18], ['GET /api/v1/trades · read。market 可筛选 crypto_spot、crypto_futures 或 ashare。']],
  ['transfer', '账户划转', [6, 13, 14, 16], [
    'POST /api/v1/transfer · trade。from、to 为 wallet / spot / futures / ashare，amount 使用来源账户的单位。',
    'USD 与 USDT 按 1:1；涉及 A 股 CNY 时按服务端汇率换算，换汇费 0.2%。响应含 rate、rateTime、fee、received。',
  ]],
  ['futures', '合约管理', [19, 21, 22], [
    'POST /api/v1/futures/leverage、/tpsl、/close · trade。设置杠杆、仓位止盈止损与平仓。',
    'leverage 提交 symbol、leverage；tpsl 提交 symbol、tp、sl；close 提交 symbol、type、clientId（限价另含 price）。',
  ]],
];
for (const [id, title, indices, paragraphs] of groups) {
  const node = section(id, title, paragraphs);
  for (const index of indices) sample(node, documentationExamples.examples[index]);
}
const agent = section('agent', 'AI Agent 示例', [
  'Python 示例每 60 秒查询余额和报价，余额满足条件时提交一次模拟买单。先在网站签到并划入现货账户。',
  '仅需安装 requests；os、time、uuid 为 Python 标准库。将密钥放入环境变量 GAME_API_KEY。',
  '此示例演示调用流程，仅供教学练习。运行前按自己的练习目标调整判断与下单条件。',
]);
codeBlock(agent, 'Python · 16 行', documentationExamples.agentLoopPython.join('\n'));
docs.append(element('p', '示例采集于 ' + documentationExamples.capturedAt + '，来自本地 dev 与真实公开行情，凭据已脱敏。', 'doc-source'));
const sky = byId('sky');
for (let index = 0; index < (innerWidth < 600 ? 18 : 36); index++) {
  const star = element('i'); if (Math.random() < 0.15) star.className = 'b';
  star.style.left = (Math.random() * 100).toFixed(2) + '%'; star.style.top = (Math.random() * 55).toFixed(2) + '%';
  star.style.animationDelay = (Math.random() * 4).toFixed(2) + 's'; sky.append(star);
}
