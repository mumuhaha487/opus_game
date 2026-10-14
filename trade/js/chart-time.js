// 图表说明、刻度和十字线统一北京时间，不依赖用户设备时区。
export function chartDateTime(value) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value * 1000)).replaceAll('-', '/');
}
export function chartTime(value, timeZone = 'Asia/Shanghai', dateOnly = false) {
  const date = typeof value === 'number' ? new Date(value * 1000)
    : typeof value === 'string' ? new Date(value) : new Date(Date.UTC(value.year, value.month - 1, value.day));
  const options = dateOnly ? { year: 'numeric', month: '2-digit', day: '2-digit' }
    : { hour: '2-digit', minute: '2-digit', hour12: false };
  if (timeZone) options.timeZone = timeZone;
  return new Intl.DateTimeFormat('zh-CN', options).format(date);
}
