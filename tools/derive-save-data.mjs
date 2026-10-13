// PLATFORM §5.3：从真实客户端数据推导服务端快照；测试重新生成并比较，避免常量漂移。
import vm from 'node:vm';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function derive() {
  const entropy = {};
  const source = file => readFileSync(path.join(root, file), 'utf8');
  const talents = source('entropy-blade/js/upgrades.js').split('const TALENTS = ')[1].split(';')[0];
  vm.runInNewContext(source('entropy-blade/js/trials.js') + '\nconst TALENTS = ' + talents + ';\n'
    + 'globalThis.result = { pts: trialPoints(Object.fromEntries(CURSES.map(c => [c.id, c.pts.length]))),'
    + ' talents: Object.fromEntries(TALENTS.map(t => [t.id, Array.from({length:t.max},(_,i)=>t.cost(i))])) };', entropy);
  const ctx = {};
  vm.runInNewContext(source('tbmh/js/core.js') + '\n' + source('tbmh/js/data.js') + '\n' + source('tbmh/js/state.js')
    + '\nglobalThis.result = { levels: LEVELS, exp: Array.from({length:99},(_,i)=>expNeed(i+1)),'
    + ' grades: GRADES.map(g=>g.alch), runes: Object.fromEntries(RUNE_SPEC.map(n=>[n.id,'
    + ' Array.from({length:n.max},(_,i)=>runeCost(n,i))])), mats: Object.fromEntries(MAT_IDS.map(id=>[id,'
    + ' ({gem:15,part:12,scroll:40,ore:10,coin:400,stone:0}[MATS[id].kind]||0)*3**(MATS[id].grade||0)])),'
    + ' runeMax: Object.fromEntries(ACCT_KEYS.map(k=>[k,RUNE_SPEC.reduce((a,n)=>a+(RUNE_KINDS[n.kind].eff[k]||0)*n.max,0)])),'
    + ' mobGold: Math.max(...Object.values(MONSTERS).map(m=>m.gold)),'
    + ' mobExp: Math.max(...Object.values(MONSTERS).map(m=>m.exp)), rates: LEVELS.map((acts,d)=>acts.flatMap((levels,ai)'
    + '=>levels.map((L,si)=>{ const st=stageDef(ai+1,si+1), W=stageWaves(d,ai+1,si+1);'
    + 'const gold=Math.max(0,...st.mobs.map(id=>MONSTERS[id].gold)), exp=Math.max(0,...st.mobs.map(id=>MONSTERS[id].exp));'
    + 'return {L,kills:W.kills,gold:CURVE.gold(L)*DIFFS[d].gold*(W.kills*gold*ELITE.gold+ACT_BOSS_MUL.gold),'
    + 'exp:CURVE.exp(L)*DIFFS[d].exp*(W.kills*exp*ELITE.exp+ACT_BOSS_MUL.exp)};}))),'
    + ' partyFactors: Object.fromEntries(["gold","exp"].map(k=>{const r=RUNE_SPEC.reduce((a,n)=>'
    + 'a+(RUNE_KINDS[n.kind].eff[k]||0)*n.max,0), pets=Object.values(PETS).reduce((a,p)=>a+(p.eff[k]||0),0);'
    + 'const aff=AFFIXES[k].r[1], gear=SLOTS.length*(aff*2.08*(1+100/150)+3*0.04*6.4'
    + '+2*partValue(k,9)+2*inscribeValue(k,9)+0.6);'
    + 'const skill=Object.values(PASSIVES).filter(p=>p.stat===k).reduce((a,p)=>a+p.per*p.max,0);'
    + 'return [k,1+r+pets+PARTY_MAX*(gear+skill)];})) };', ctx);
  return { entropy: { ...entropy.result, scenes: 4, depth: 7, crystalsPerRun: (4 * 6 * 9 + 4 * 10 + 78 + 40) * 4 },
    hunter: ctx.result };
}
function compact(value, depth = 0) {
  const padding = '  '.repeat(depth), short = JSON.stringify(value);
  if (padding.length + short.length < 118) return short;
  if (Array.isArray(value) && value.every(item => typeof item === 'number')) {
    const rows = []; let chunk = [];
    for (const item of value) {
      if (JSON.stringify([...chunk, item]).length + padding.length > 118) { rows.push(chunk); chunk = []; }
      chunk.push(item);
    }
    if (chunk.length) rows.push(chunk);
    return '[\n' + rows.map(row => padding + '  ...' + JSON.stringify(row)).join(',\n') + '\n' + padding + ']';
  }
  const rows = Array.isArray(value) ? value.map(item => compact(item, depth + 1))
    : Object.entries(value).map(([key, item]) => JSON.stringify(key) + ': ' + compact(item, depth + 1));
  const delimiters = Array.isArray(value) ? ['[', ']'] : ['{', '}'];
  return delimiters[0] + '\n' + rows.map(row => padding + '  ' + row).join(',\n') + '\n' + padding + delimiters[1];
}
export function render() {
  return '// PLATFORM §5.3：真实游戏推导快照；构建逐值检查，来源见REPORT-2。\n'
    + '// 生成：node tools/derive-save-data.mjs；长数组以逐行子数组展开，保持140字符行宽。\n'
    + 'export const SAVE_DATA = ' + compact(derive()) + ';\n';
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(path.join(root, 'server/games/plausibility-data.js'), render());
}
