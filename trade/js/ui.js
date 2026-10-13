// DESIGN §4.3：公共标题、分段、涨跌标签、徽标及安全表格；中文只用系统字体。
import { element, button, percent, direction } from './format.js';
export function title(english, chinese) {
  const row = element('div', '', 'panel-title');
  row.append(element('span', english, 'px-label'), element('b', chinese)); return row;
}
export function segment(options, onSelect, selected = options[0][0]) {
  const row = element('div', '', 'seg');
  for (const [value, label] of options) row.append(button(label, () => {
    for (const control of row.children) control.classList.toggle('selected', control.dataset.value === String(value));
    onSelect(value);
  }, String(value) === String(selected) ? 'selected' : ''));
  [...row.children].forEach((control, index) => { control.dataset.value = options[index][0]; }); return row;
}
export function change(value) { return element('span', percent(value), 'chg ' + direction(value)); }
export function badge(name, code, type = '') {
  const node = element('span', name?.[0] || code?.[0] || '?', 'badge-circle');
  const colors = ['--blue', '--amber', '--purple', '--green', '--red'];
  const hash = [...(code || '')].reduce((total, char) => total + char.charCodeAt(0), 0);
  node.style.background = 'var(' + (type.startsWith('GP-A') ? type.includes('KCB') ? '--purple'
    : type.includes('CYB') ? '--amber' : '--blue' : colors[hash % colors.length]) + ')'; return node;
}
export function table(labels, rows) {
  const node = element('table'), head = element('thead'), heading = element('tr'), body = element('tbody');
  labels.forEach(label => heading.append(element('th', label))); head.append(heading); node.append(head, body);
  for (const values of rows) {
    const row = element('tr');
    for (const value of values) {
      const cell = element('td'); cell.append(value instanceof Node ? value : document.createTextNode(String(value ?? '--')));
      row.append(cell);
    }
    body.append(row);
  }
  const scroll = element('div', '', 'table-scroll'); scroll.append(node); return scroll;
}
export function spark(values, color = 'var(--gold)') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 160 32'); svg.setAttribute('class', 'spark');
  const points = values.filter(Number.isFinite), low = Math.min(...points), range = Math.max(...points) - low || 1;
  if (points.length < 2) return svg;
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', points.map((value, index) => (index ? 'L' : 'M') + (index * 160 / (points.length - 1))
    + ',' + (30 - (value - low) * 28 / range)).join(' '));
  path.setAttribute('fill', 'none'); path.setAttribute('stroke', color); path.setAttribute('stroke-width', '1.5');
  svg.append(path); return svg;
}
