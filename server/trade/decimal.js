// Worker 定点十进制运算，内部统一使用 18 位 BigInt。
// 外部金额只接收规范的非负十进制字符串（规格 5.2）。
// 舍入显式指定方向，支持内部有符号的结算运算。
export const SCALE = 10n ** 18n;
export function parse(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,14})(\.\d{1,18})?$/.test(value)) {
    throw { status: 400, code: 'bad_request' };
  }
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(18, '0'));
}
export function quotient(numerator, denominator, mode) {
  if (!['floor', 'ceil', 'half'].includes(mode) || denominator === 0n) throw { status: 400, code: 'bad_request' };
  if (denominator < 0n) { numerator = -numerator; denominator = -denominator; }
  const result = numerator / denominator, remainder = numerator % denominator;
  if (!remainder) return result;
  if (mode === 'floor') return result - (remainder < 0n ? 1n : 0n);
  if (mode === 'ceil') return result + (remainder > 0n ? 1n : 0n);
  return result + ((remainder < 0n ? -remainder : remainder) * 2n >= denominator ? (remainder < 0n ? -1n : 1n) : 0n);
}
export const add = (left, right) => left + right;
export const sub = (left, right) => left - right;
export const mul = (left, right, mode) => quotient(left * right, SCALE, mode);
export const div = (left, right, mode) => quotient(left * SCALE, right, mode);
export const cmp = (left, right) => left < right ? -1 : left > right ? 1 : 0;
export const min = (left, right) => left < right ? left : right;
export const max = (left, right) => left > right ? left : right;
export function roundTo(value, decimals, mode) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw { status: 400, code: 'bad_request' };
  const step = 10n ** BigInt(18 - decimals);
  return quotient(value, step, mode) * step;
}
export function toStr(value, decimals) {
  if (decimals !== undefined) value = roundTo(value, decimals, 'half');
  const negative = value < 0n;
  const magnitude = negative ? -value : value;
  const fraction = (magnitude % SCALE).toString().padStart(18, '0').replace(/0+$/, '');
  return (negative ? '-' : '') + magnitude / SCALE + (fraction ? '.' + fraction : '');
}
export const credit = value => roundTo(value, 8, 'floor');
export const debit = value => roundTo(value, 8, 'ceil');
