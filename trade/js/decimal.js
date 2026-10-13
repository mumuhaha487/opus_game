// 前端输入精度与金额联动的定点工具。
// 规格 0.7、5.2：前端计算只用于输入和展示，成交由服务端决定。
// 按数量步长向下截取，避免 Number 科学计数法进入下单参数。
const SCALE = 10n ** 18n;
export function parseInput(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,14})(\.\d{1,18})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(18, '0'));
}
export function inputString(value, decimals = 8) {
  value = value < 0n ? 0n : value;
  const step = 10n ** BigInt(18 - Math.min(18, decimals));
  value = value / step * step;
  const fraction = (value % SCALE).toString().padStart(18, '0').replace(/0+$/, '');
  return value / SCALE + (fraction ? '.' + fraction : '');
}
export function product(left, right, decimals = 8) {
  const first = parseInput(left), second = parseInput(right);
  return first === null || second === null ? '' : inputString(first * second / SCALE, decimals);
}
export function divide(left, right, decimals) {
  const first = parseInput(left), second = parseInput(right);
  return first === null || !second ? '' : inputString(first * SCALE / second, decimals);
}
export function stepInput(value, decimals, direction) {
  const parsed = parseInput(value) || 0n;
  return inputString(parsed + BigInt(direction) * 10n ** BigInt(18 - decimals), decimals);
}
