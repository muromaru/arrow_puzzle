import { FACES, DIRS, dirVector, buildArrows } from './arrow.js';
import { Puzzle } from './puzzle.js';

// ステージ生成: 乱数の種(seed)から折れ線の矢印を敷き詰める。同じ seed なら必ず同じ配置になる。
// 矢印は立方体の表面を歩く折れ線で、cross の確率で面の境界をまたぐ。
// 「あとから置く矢印は、頭の前方に既存の矢印がない」ように置くので、置いた順の逆に射出すれば必ず全消去できる。
// （あとから置いた矢印が、先に置いた矢印の前方を塞ぐため、射出順序を考える必要が出る）
function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FACE_KEYS = Object.keys(FACES);
const negate = (v) => v.map((c) => (c === 0 ? 0 : -c));
const eq = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const faceByNormal = (v) => FACE_KEYS.find((f) => eq(FACES[f].n, v));

export function generate(size, seed, { minLen, maxLen, maxArrows, cross = 0, maxFails = 400 }) {
  const rand = rng(seed);
  const occ = new Set();
  const key = (c, f) => `${c.join()}:${f}`;
  const inR = (c) => c.every((v) => v >= 0 && v < size);
  // 1歩の移動ベクトル（面をまたぐ歩は、前の面の法線と逆向き）
  const stepVec = (a, b) => (a.face === b.face ? b.cell.map((v, i) => v - a.cell[i]) : negate(FACES[a.face].n));
  const arrows = [];
  let fails = 0;
  let turn = 0;
  while (arrows.length < maxArrows && fails < maxFails) {
    const face = FACE_KEYS[turn++ % FACE_KEYS.length]; // 6面を順番に使う
    const len = minLen + Math.floor(rand() * (maxLen - minLen + 1));
    const start = FACES[face].n.map((c) => (c !== 0 ? (c > 0 ? size - 1 : 0) : Math.floor(rand() * size)));
    if (occ.has(key(start, face))) { fails++; continue; }
    let cur = { cell: start, face };
    const path = [cur];
    const own = new Set([key(start, face)]);
    let hv = dirVector(face, DIRS[Math.floor(rand() * 4)]);
    while (path.length < len) {
      if (rand() > 0.62) hv = dirVector(cur.face, DIRS[Math.floor(rand() * 4)]); // たまに曲がる
      const base = Math.max(0, DIRS.findIndex((d) => eq(dirVector(cur.face, d), hv)));
      let moved = false;
      for (let t = 0; t < 4 && !moved; t++) {
        const w = dirVector(cur.face, DIRS[(base + t) % 4]);
        const nc = cur.cell.map((v, i) => v + w[i]);
        let nxt;
        let nhv;
        if (inR(nc)) {
          nxt = { cell: nc, face: cur.face };
          nhv = w;
        } else { // 面の端: cross の確率で、隣の面へ折れ曲がってまたぐ
          if (rand() >= cross) continue;
          nxt = { cell: [...cur.cell], face: faceByNormal(w) };
          nhv = negate(FACES[cur.face].n);
        }
        if (occ.has(key(nxt.cell, nxt.face)) || own.has(key(nxt.cell, nxt.face))) continue;
        path.push(nxt);
        own.add(key(nxt.cell, nxt.face));
        cur = nxt;
        hv = nhv;
        moved = true;
      }
      if (!moved) break;
    }
    if (path.length < minLen) { fails++; continue; }
    const rev = [...path].reverse();
    const heads = rand() < 0.5 ? [path, rev] : [rev, path]; // どちらの端を頭にするか
    const ok = heads.find((p) => {
      const h = p[p.length - 1];
      const v = stepVec(p[p.length - 2], h);
      for (let c = h.cell.map((x, i) => x + v[i]); inR(c); c = c.map((x, i) => x + v[i])) {
        if (occ.has(key(c, h.face)) || own.has(key(c, h.face))) return false;
      }
      return true;
    });
    if (!ok) { fails++; continue; }
    ok.forEach((it) => occ.add(key(it.cell, it.face)));
    arrows.push({ path: ok.map((it) => [...it.cell, it.face]) });
    fails = 0;
  }
  return arrows;
}

// レベル 1〜30。5レベルごとに立方体が1段大きくなり（3→8）、各段の中で矢印が増えていく。
// 矢印は長くなり、面をまたぐ矢印も増える。
export const LEVEL_COUNT = 30;

export function levelParams(n) {
  const t = Math.floor((n - 1) / 5); // 段（0〜5）
  const j = (n - 1) % 5;             // 段の中の順番（0〜4）
  const size = 3 + t;
  const minLen = 2 + Math.floor(t * 0.9);
  const maxLen = minLen + 1 + t + (j >= 2 ? 1 : 0);
  const fill = 0.3 + 0.12 * j; // 表面のうち矢印で埋める割合の目安
  const maxArrows = n === 1 ? 8 : Math.max(5, Math.round((6 * size * size * fill) / ((minLen + maxLen) / 2)));
  const cross = n === 1 ? 0 : Math.min(0.5, 0.12 + 0.05 * t + 0.03 * j); // 面をまたぐ確率
  return { size, minLen, maxLen, maxArrows, cross };
}

// 各レベルの乱数の種（tools/pick-seeds.mjs で、クリア可能で、射出順序が必要になる配置を選んだもの）
const SEEDS = [1, 301, 134, 146, 172, 395, 131, 293, 338, 11, 326, 346, 232, 380, 83, 164, 61, 153, 20, 398, 41, 288, 60, 6, 42, 177, 194, 19, 208, 39];

export const STAGES = SEEDS.map((seed, i) => {
  const L = levelParams(i + 1);
  return { id: `lv${i + 1}`, name: `Lv${i + 1}`, size: L.size, arrows: generate(L.size, seed, L) };
});

// レベル n（1〜30）の問題を、指定した種で作る。条件を満たし、かつ全消去できることを確認できたときだけ返す（だめなら null）。
// 条件: 目標の矢印数の85%以上・5面以上を使う・最初から射出できない矢印がある・面をまたぐ矢印がある（cross>0 のとき）。
export function validStage(n, seed) {
  const L = levelParams(n);
  const arrows = generate(L.size, seed, L);
  if (arrows.length < L.maxArrows * 0.85) return null;
  const p = new Puzzle(L.size, buildArrows({ size: L.size, arrows }));
  if (new Set(p.arrows.map((a) => a.face)).size < 5) return null;
  const blocked = p.arrows.filter((a) => !p.canLaunch(a.id)).length;
  const cross = p.arrows.filter((a) => new Set(a.faces).size > 1).length;
  if (blocked < 1 || (L.cross > 0 && cross < 1) || (L.cross === 0 && cross > 0)) return null;
  if (!p.solve()) return null; // クリア可能であることを内部で確認
  return { id: `lv${n}`, name: `Lv${n}`, size: L.size, arrows };
}

// 「新しい問題」: 種をランダムに選び、確認に通った問題だけを返す
export function newStage(n, random = Math.random) {
  for (let t = 0; t < 300; t++) {
    const st = validStage(n, 1 + Math.floor(random() * 2147483646));
    if (st) return st;
  }
  return null;
}
