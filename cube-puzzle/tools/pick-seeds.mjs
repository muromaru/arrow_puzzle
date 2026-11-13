// 各レベルに合う乱数の種を探す。使い方: node tools/pick-seeds.mjs
// 条件: 目標の矢印数の85%以上・5面以上を使う・最初から射出できない矢印がある・面をまたぐ矢印がある（cross>0 のとき）。
// 条件を満たす中で、射出の「段数」（同時に射出できる矢印を全部消すのを繰り返した回数）が最大のものを選ぶ。
import { generate, levelParams, LEVEL_COUNT } from '../src/stages.js';
import { buildArrows } from '../src/arrow.js';
import { Puzzle } from '../src/puzzle.js';

function depth(p) {
  let rounds = 0;
  while (p.remaining > 0) {
    const now = [...p.alive].filter((id) => p.canLaunch(id));
    if (!now.length) return Infinity;
    now.forEach((id) => p.launch(id));
    rounds++;
  }
  return rounds;
}

const picked = [];
const used = new Set(); // 同じ種を使い回さない（レベルごとに別の配置にする）
for (let n = 1; n <= LEVEL_COUNT; n++) {
  const L = levelParams(n);
  let best = null;
  for (let seed = 1; seed <= 400; seed++) {
    if (used.has(seed)) continue;
    const arrows = generate(L.size, seed, L);
    if (arrows.length < L.maxArrows * 0.85) continue;
    const built = buildArrows({ size: L.size, arrows });
    const p = new Puzzle(L.size, built);
    if (new Set(p.arrows.map((a) => a.face)).size < 5) continue;
    const blocked = p.arrows.filter((a) => !p.canLaunch(a.id)).length;
    const cross = p.arrows.filter((a) => new Set(a.faces).size > 1).length;
    if (blocked < 1 || (L.cross > 0 && cross < 1) || (L.cross === 0 && cross > 0)) continue;
    if (!p.solve()) continue;
    const d = depth(new Puzzle(L.size, built));
    if (!best || d > best.d || (d === best.d && cross > best.cross)) best = { seed, d, cross, blocked, count: arrows.length };
  }
  if (best) used.add(best.seed);
  picked.push(best ? best.seed : null);
  console.log(`Lv${n} size ${L.size} target ${L.maxArrows}`, best ? JSON.stringify(best) : 'NONE');
}
console.log('SEEDS =', JSON.stringify(picked));
