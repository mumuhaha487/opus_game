// DESIGN §4.6：图表刻度与十字线共用时区；A股固定北京时间，加密使用浏览器时区。
export function chartTime(value, timeZone, dateOnly = false) {
  const date = typeof value === 'number' ? new Date(value * 1000)
    : typeof value === 'string' ? new Date(value) : new Date(Date.UTC(value.year, value.month - 1, value.day));
  const options = dateOnly ? { year: 'numeric', month: '2-digit', day: '2-digit' }
    : { hour: '2-digit', minute: '2-digit', hour12: false };
  if (timeZone) options.timeZone = timeZone;
  return new Intl.DateTimeFormat('zh-CN', options).format(date);
}
