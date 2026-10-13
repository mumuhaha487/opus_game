// 规格 9.2 的数字与本地时间显示，以及安全 DOM 构建工具。
// 行情金额仅在展示时转 Number，账户运算由服务端 BigInt 完成。
// 所有动态文案通过 textContent 或属性赋值写入。
export const element = (tag, text = '', className = '') => {
  const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
};
export function button(text, action, className = '') {
  const node = element('button', text, className); node.type = 'button';
  if (action) node.addEventListener('click', action);
  return node;
}
export function number(value, decimals = 2) {
  if (value === undefined || value === null || value === '' || !Number.isFinite(Number(value))) return '--';
  return Number(value).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
export const price = (value, precision = 1) => number(value, precision);
export const quantity = (value, precision = 6) => number(value, precision);
export const money = value => number(value, 2);
export function percent(value) {
  if (value === undefined || !Number.isFinite(Number(value))) return '--';
  return (Number(value) > 0 ? '+' : '') + Number(value).toFixed(2) + '%';
}
export const direction = value => Number(value) > 0 ? 'up' : Number(value) < 0 ? 'down' : '';
export function large(value) {
  if (value === undefined) return '--';
  for (const [threshold, suffix] of [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']]) {
    if (Math.abs(Number(value)) >= threshold) return (Number(value) / threshold).toFixed(2) + suffix;
  }
  return number(value, 2);
}
const pad = value => String(value).padStart(2, '0');
export function time(value, full = false) {
  const date = new Date(value), clock = [date.getHours(), date.getMinutes(), date.getSeconds()].map(pad).join(':');
  return full ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${clock}` : clock;
}
export function countdown(seconds) {
  seconds = Math.max(0, Math.floor(seconds));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(pad).join(':');
}
export function icon(paths, size = 24, viewBox = '0 0 24 24') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', viewBox); svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true');
  for (const [tag, attributes] of paths) {
    const shape = document.createElementNS(svg.namespaceURI, tag);
    for (const [name, value] of Object.entries(attributes)) shape.setAttribute(name, value);
    svg.append(shape);
  }
  return svg;
}
export const gift = () => {
  const svg = icon([
    ['rect', { x: 3, y: 8, width: 14, height: 4, rx: 1 }],
    ['rect', { x: 4, y: 12, width: 12, height: 6, rx: 1 }],
    ['path', { d: 'M10 8v10M10 8c-2-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3-2-5 1' }],
  ], 20, '0 0 20 20');
  svg.setAttribute('stroke-width', '1.6'); return svg;
};
