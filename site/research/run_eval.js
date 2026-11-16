#!/usr/bin/env node
/* 인생재판소 엔진 평가 스크립트 (Node 전용, 의존성 없음)
 *
 *   node research/run_eval.js                 # 균형형 판사 기준 평가
 *   node research/run_eval.js --judge=all     # 4명 판사 과실 일치율 비교
 *   node research/run_eval.js --base=main     # git ref의 app.html과 변경 전/후 비교
 *   node research/run_eval.js --presets       # PRESETS 회귀 스냅샷 출력
 *   node research/run_eval.js --human-only    # 사람이 검수한(labeler='human') 항목만으로 계산
 *
 * app.html의 첫 번째 <script>(엔진 IIFE + PRESETS)만 잘라 vm에서 실행한다. DOM 불필요.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const SITE = path.resolve(__dirname, '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
}));

function loadEngine(html) {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('app.html에서 엔진 <script>를 찾지 못했습니다');
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(m[1] + '\n;this.__PRESETS = (typeof PRESETS !== "undefined") ? PRESETS : null;', ctx, { filename: 'app.html#engine' });
  if (!ctx.CourtEngine) throw new Error('CourtEngine이 export되지 않았습니다');
  return { E: ctx.CourtEngine, PRESETS: ctx.__PRESETS };
}
const htmlNow = () => fs.readFileSync(path.join(SITE, 'app.html'), 'utf8');
// 폴더명 변경(Week10_인생재판소_site → site) 이전 ref도 비교할 수 있게 옛 경로로 재시도
const htmlAt = ref => {
  // './app.html'은 현재 폴더 기준, 두 번째는 저장소 루트 기준 옛 경로
  for (const p of ['./app.html', 'Week10_인생재판소_site/app.html']) {
    try { return execFileSync('git', ['-C', SITE, 'show', `${ref}:${p}`], { encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) {}
  }
  throw new Error(`${ref}에서 app.html을 찾지 못했습니다`);
};

// 엔진 판결 → 과실 우세 쪽. 쌍방 훈방(|pA-50|<=10)이면 '쌍방'
const sideOf = pA => Math.abs(pA - 50) <= 10 ? '쌍방' : pA > 50 ? 'A' : 'B';

function runItem(E, it, judgeKey) {
  const out = E.judge({ rel: it.rel, A: it.A, B: it.B }, judgeKey);
  if (out.blocked) return { blocked: true, hits: out.safety.hits };
  return {
    blocked: false, pA: out.ratio.pA, side: sideOf(out.ratio.pA), main: out.main.id,
    top: out.issues.map(i => i.id), noHit: out.issues.length === 0
  };
}

function evaluate(E, items, judgeKey) {
  const rows = items.map(it => ({ it, r: runItem(E, it, judgeKey) }));
  const H = x => x.it.human;
  const safetyRows = rows;
  const tp = safetyRows.filter(x => H(x).safety && x.r.blocked);
  const fn = safetyRows.filter(x => H(x).safety && !x.r.blocked);
  const fp = safetyRows.filter(x => !H(x).safety && x.r.blocked);
  const normal = rows.filter(x => !H(x).safety);
  // 쟁점: 기존 ISSUES id 라벨만 정확도 계산. NEW:* 는 신규 유형 후보로 따로 본다.
  const known = normal.filter(x => H(x).issue && !String(H(x).issue).startsWith('NEW:'));
  const issueOk = known.filter(x => !x.r.blocked && x.r.main === H(x).issue);
  const issueTop3 = known.filter(x => !x.r.blocked && x.r.top.slice(0, 3).includes(H(x).issue));
  const faultRows = normal.filter(x => H(x).fault);
  const faultOk = faultRows.filter(x => !x.r.blocked && x.r.side === H(x).fault);
  return { rows, tp, fn, fp, known, issueOk, issueTop3, faultRows, faultOk,
    newType: normal.filter(x => String(H(x).issue || '').startsWith('NEW:')),
    noHit: known.filter(x => !x.r.blocked && x.r.noHit) };
}

const pct = (a, b) => b ? `${a}/${b} (${(100 * a / b).toFixed(1)}%)` : '-';
const fmtR = r => r.blocked ? `차단[${r.hits.join(',')}]` : `쟁점=${r.main}${r.noHit ? '(키워드 무적중→기본값)' : ''} A과실=${r.pA}% → ${r.side}`;

function summary(ev) {
  return {
    '쟁점 정확도(주쟁점)': pct(ev.issueOk.length, ev.known.length),
    '쟁점 상위3 포함률': pct(ev.issueTop3.length, ev.known.length),
    '쟁점 키워드 무적중': `${ev.noHit.length}건`,
    '과실 판단 일치율': pct(ev.faultOk.length, ev.faultRows.length),
    '안전필터 정탐': pct(ev.tp.length, ev.tp.length + ev.fn.length),
    '안전필터 미탐': `${ev.fn.length}건`,
    '안전필터 오탐': `${ev.fp.length}건`
  };
}

function report(ev, title) {
  console.log(`\n=== ${title} ===`);
  for (const [k, v] of Object.entries(summary(ev))) console.log(`  ${k.padEnd(14, ' ')} ${v}`);

  console.log('\n[안전필터 정탐]');
  ev.tp.forEach(x => console.log(`  ✔ ${x.it.id} (${x.it.group}) 키워드: ${x.r.hits.join(', ')}`));
  console.log('[안전필터 미탐] ← 게임으로 다루면 안 되는데 통과');
  ev.fn.forEach(x => console.log(`  ✘ ${x.it.id} (${x.it.group}) ${x.it.note || ''} → ${fmtR(x.r)}`));
  console.log('[안전필터 오탐] ← 일상 사연인데 차단');
  ev.fp.length ? ev.fp.forEach(x => console.log(`  ! ${x.it.id} 키워드: ${x.r.hits.join(', ')} (${x.it.note || ''})`)) : console.log('  (없음)');

  console.log('\n[불일치 사례] 사람 라벨 vs 엔진');
  ev.rows.filter(x => !x.it.human.safety).forEach(x => {
    const h = x.it.human, r = x.r;
    const isNew = String(h.issue).startsWith('NEW:');
    const iBad = !isNew && (r.blocked || r.main !== h.issue);
    const fBad = r.blocked || r.side !== h.fault;
    if (!iBad && !fBad && !isNew) return;
    const marks = [iBad && '쟁점', fBad && '과실', isNew && '신규유형'].filter(Boolean).join('·');
    console.log(`  ${x.it.id} [${marks}] 사람: ${h.issue} / ${h.fault}  |  엔진: ${fmtR(r)}`);
  });
}

function presetSnapshot(E, PRESETS) {
  const out = [];
  (PRESETS.duo || []).concat(PRESETS.solo || []).forEach(p => {
    const r = E.judge({ rel: p.rel, A: p.A, B: p.B }, 'balance');
    out.push({ label: p.label, v: r.blocked ? 'BLOCKED' : `${r.ratio.pA}:${r.ratio.pB} ${r.main.id} ${r.sentence.name}` });
  });
  (PRESETS.crim || []).forEach(p => {
    const r = E.criminal ? E.criminal({ name: p.name, victim: p.victim, text: p.text }, 'balance') : null;
    out.push({ label: '[자수] ' + p.label, v: !r ? '-' : r.blocked ? 'BLOCKED' : `${r.main ? r.main.id : '?'} ${r.tier ? (r.tier.name || r.tier) : ''}`.trim() });
  });
  return out;
}

// ---------------- main ----------------
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'testset.json'), 'utf8'));
const items = args['human-only'] ? data.items.filter(i => i.labeler === 'human') : data.items;
const now = loadEngine(htmlNow());
const judges = args.judge === 'all' ? Object.keys(now.E.JUDGES) : [args.judge && args.judge !== true ? args.judge : 'balance'];

console.log(`testset ${data.items.length}건 (사람 검수 ${data.items.filter(i => i.labeler === 'human').length}건 / 초안 ${data.items.filter(i => i.labeler !== 'human').length}건)`
  + (args['human-only'] ? ` → human 라벨만 ${items.length}건으로 계산` : ' → 전체로 계산'));

if (args.base) {
  const base = loadEngine(htmlAt(args.base));
  for (const j of judges) {
    const b = evaluate(base.E, items, j), a = evaluate(now.E, items, j);
    const sb = summary(b), sa = summary(a);
    console.log(`\n=== 변경 전(${args.base}) → 후(작업트리) · ${now.E.JUDGES[j].name} ===`);
    for (const k of Object.keys(sa)) console.log(`  ${k.padEnd(14, ' ')} ${sb[k].padEnd(16, ' ')} → ${sa[k]}${sb[k] !== sa[k] ? '  *' : ''}`);
    console.log('  [사례별 변화]');
    let changed = 0;
    items.forEach((it, i) => {
      const x = fmtR(b.rows[i].r), y = fmtR(a.rows[i].r);
      if (x !== y) { changed++; console.log(`   ${it.id}: ${x}\n   ${' '.repeat(it.id.length)}→ ${y}`); }
    });
    if (!changed) console.log('   (변화 없음)');
  }
  if (base.PRESETS && now.PRESETS) {
    const pb = presetSnapshot(base.E, base.PRESETS), pa = presetSnapshot(now.E, now.PRESETS);
    console.log('\n=== PRESETS 회귀 (기존 프리셋 판결이 바뀌었는지) ===');
    pa.forEach(p => {
      const old = pb.find(q => q.label === p.label);
      console.log(`  ${old ? (old.v === p.v ? '  ' : '* ') : '+ '}${p.label}: ${old ? (old.v === p.v ? p.v : `${old.v} → ${p.v}`) : p.v + ' (신규)'}`);
    });
  }
} else if (args.presets) {
  presetSnapshot(now.E, now.PRESETS).forEach(p => console.log(`  ${p.label}: ${p.v}`));
} else {
  for (const j of judges) report(evaluate(now.E, items, j), `${now.E.JUDGES[j].name} (${j})`);
}
