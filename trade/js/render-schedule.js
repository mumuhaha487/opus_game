// DESIGN §7：接收行情与DOM更新分离，快组500ms、图表1000ms、列表2000ms。
export class RenderSchedule {
  constructor() { this.last = { fast: -Infinity, chart: -Infinity, lists: -Infinity }; }
  run(timestamp, callbacks) {
    for (const [group, interval] of [['fast', 500], ['chart', 1000], ['lists', 2000]]) {
      if (timestamp - this.last[group] < interval) continue;
      this.last[group] = timestamp; callbacks[group]();
    }
  }
}
