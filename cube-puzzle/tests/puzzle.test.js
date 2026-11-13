import test from 'node:test';
import assert from 'node:assert/strict';
import { Puzzle } from '../src/puzzle.js';
import { buildArrows, FACES } from '../src/arrow.js';
import { STAGES, levelParams, newStage, validStage } from '../src/stages.js';

const make = (size, arrows) => new Puzzle(size, buildArrows({ size, arrows }));
const puzzleOf = (s) => new Puzzle(s.size, buildArrows(s));

const crossCount = (s) => s.arrows.filter((a) => new Set(a.path.map((c) => c[3] ?? a.face)).size > 1).length;

function depth(p) { // 同時に射出できる矢印を全部消すのを繰り返した回数
  let rounds = 0;
  while (p.remaining > 0) {
    const now = [...p.alive].filter((id) => p.canLaunch(id));
    assert.ok(now.length > 0);
    now.forEach((id) => p.launch(id));
    rounds++;
  }
  return rounds;
}

test('30レベル: 名前・サイズ・すべてクリア可能・5面以上を使う', () => {
  assert.equal(STAGES.length, 30);
  STAGES.forEach((s, i) => {
    assert.equal(s.name, `Lv${i + 1}`);
    assert.equal(s.size, levelParams(i + 1).size);
    const p = puzzleOf(s);
    assert.ok(new Set(p.arrows.map((a) => a.face)).size >= 5, s.id);
    const order = p.solve();
    assert.ok(order, s.id);
    assert.equal(order.length, s.arrows.length);
  });
  const sizes = STAGES.map((s) => s.size);
  assert.deepEqual(sizes, [...sizes].sort((x, y) => x - y)); // 立方体は小さい順
  assert.deepEqual([sizes[0], sizes[29]], [3, 8]);
});

test('矢印の数・長さがレベルの設定に収まり、Lv1以外は面をまたぐ矢印を含む', () => {
  STAGES.forEach((s, i) => {
    const L = levelParams(i + 1);
    assert.ok(s.arrows.length <= L.maxArrows && s.arrows.length >= L.maxArrows * 0.85, s.id);
    const lens = s.arrows.map((a) => a.path.length);
    assert.ok(Math.min(...lens) >= L.minLen && Math.max(...lens) <= L.maxLen, s.id);
    if (i === 0) assert.equal(crossCount(s), 0);
    else assert.ok(crossCount(s) >= 1, s.id);
  });
});

test('射出順序が必要で、レベルごとに別の配置になっている', () => {
  for (const s of STAGES) {
    const p = puzzleOf(s);
    const blocked = p.arrows.filter((a) => !p.canLaunch(a.id)).length;
    assert.ok(blocked >= 1 && blocked < s.arrows.length, `${s.id}: ${blocked}`);
  }
  assert.equal(new Set(STAGES.map((s) => JSON.stringify(s.arrows))).size, 30);
  assert.ok(depth(puzzleOf(STAGES[29])) > depth(puzzleOf(STAGES[0])));
});

test('面をまたぐ矢印: 同じセルで面が変わり、またいだ後の向きで射出方向が決まる', () => {
  const snake = { path: [[2, 0, 3, '+z'], [3, 0, 3, '+z'], [3, 0, 3, '+x'], [3, 0, 2, '+x']] };
  const p = make(4, [snake, [3, 0, 0, '+x', 'up'], [0, 0, 3, '+z', 'right']]);
  const a = p.arrows[0];
  assert.deepEqual([a.face, a.dir, a.faces.length], ['+x', 'right', 4]);
  assert.equal(p.launch(0).blockerId, 1); // 頭 (3,0,2) の前方 (3,0,1),(3,0,0)
  assert.equal(p.launch(2).blockerId, 0); // +z 面の矢印の前方に、折れ線の +z 側の胴体 (2,0,3)
  assert.equal(p.launch(1).ok, true);
  assert.equal(p.launch(0).ok, true);
  assert.equal(p.launch(2).ok, true);
});

test('不正な面またぎは拒否される（セルが違う・平行な面）', () => {
  assert.throws(() => make(4, [{ path: [[3, 0, 3, '+z'], [3, 1, 3, '+x']] }]));
  assert.throws(() => make(4, [{ path: [[3, 0, 3, '+z'], [0, 0, 3, '-x']] }]));
  assert.throws(() => make(4, [{ path: [[0, 0, 3, '+z'], [0, 0, 0, '-z']] }]));
});

test('solve() の順序を実際に射出すると、全消去でクリアになる', () => {
  const p = puzzleOf(STAGES[29]);
  let last;
  for (const id of p.solve()) last = p.launch(id);
  assert.equal(last.ok, true);
  assert.equal(last.cleared, true);
  assert.equal(p.remaining, 0);
});

test('前方に矢印があると射出できず、ぶつかる矢印とセルが分かる', () => {
  const p = make(3, [[0, 0, 2, '+z', 'right'], [1, 0, 2, '+z', 'up']]);
  const r = p.launch(0);
  assert.deepEqual([r.ok, r.reason, r.blockerId, r.cell], [false, 'blocked', 1, [1, 0, 2]]);
  assert.equal(p.remaining, 2);
  assert.equal(p.launch(1).ok, true);
  assert.equal(p.launch(0).ok, true);
});

test('折れ線の矢印: 頭の向きは最後の1歩で決まり、前方を塞ぐセルは胴体でもよい', () => {
  // 頭 (1,1,4) は上向き。前方 (1,3,4) に別の矢印がある
  const a = { face: '+z', path: [[0, 0, 4], [1, 0, 4], [1, 1, 4]] };
  const p = make(5, [a, [1, 3, 4, '+z', 'left'], [0, 2, 4, '+z', 'down']]);
  assert.equal(p.arrows[0].dir, 'up');
  assert.equal(p.launch(0).blockerId, 1);
  // 別の矢印 [0,2,4] は下向きで、(0,1,4),(0,0,4) へ進む。(0,0,4) は折れ線の胴体なので塞がれる
  assert.equal(p.launch(2).blockerId, 0);
  p.launch(1);
  assert.equal(p.launch(0).ok, true);
  assert.equal(p.launch(2).ok, true); // 胴体ごと消えたので通れる
});

test('消去済みの矢印は障害物にならない', () => {
  const p = make(3, [[0, 0, 2, '+z', 'right'], [2, 0, 2, '+z', 'up']]);
  assert.equal(p.canLaunch(0), false);
  p.launch(1);
  assert.equal(p.canLaunch(0), true);
});

test('別の面の矢印は同じセルにあっても障害物にならない', () => {
  const p = make(3, [[0, 0, 2, '+z', 'right'], [2, 0, 2, '+x', 'up']]);
  assert.equal(p.canLaunch(0), true);
});

test('面ごとの方向: +x 面の right は -z 方向', () => {
  const p = make(3, [[2, 1, 2, '+x', 'right'], [2, 1, 0, '+x', 'up']]);
  assert.equal(p.launch(0).blockerId, 1);
});

test('射出方向が互いに塞ぎ合う配置はクリア不可能と判定される', () => {
  const p = make(5, [
    [0, 0, 4, '+z', 'right'], [4, 0, 4, '+z', 'up'],
    [4, 4, 4, '+z', 'left'], [0, 4, 4, '+z', 'down'],
  ]);
  assert.equal(p.solve(), null);
});

test('reset() で初期状態に戻り、solve() は状態を壊さない', () => {
  const s = STAGES[0];
  const p = puzzleOf(s);
  p.solve();
  assert.equal(p.remaining, s.arrows.length);
  p.launch(p.solve()[0]);
  assert.equal(p.remaining, s.arrows.length - 1);
  p.reset();
  assert.equal(p.remaining, s.arrows.length);
});

test('存在しない・消去済みのIDは invalid', () => {
  const p = make(3, [[1, 0, 2, '+z', 'up']]);
  assert.equal(p.launch(99).reason, 'invalid');
  p.launch(0);
  assert.equal(p.launch(0).reason, 'invalid');
});

test('不正な折れ線は拒否される（非隣接・重複・面外）', () => {
  assert.throws(() => make(5, [{ face: '+z', path: [[0, 0, 4], [2, 0, 4]] }]));
  assert.throws(() => make(5, [{ face: '+z', path: [[0, 0, 4], [1, 0, 4], [0, 0, 4]] }]));
  assert.throws(() => make(5, [{ face: '+z', path: [[0, 0, 4], [0, 0, 3]] }]));
  assert.ok(FACES['+z']);
});

test('新しい問題: どのレベルでも、毎回別の配置で、全消去できると確認済みのものが返る', () => {
  const mk = (seed) => { let x = seed; return () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; };
  for (const n of [1, 5, 10, 17, 24, 30]) {
    const a = newStage(n, mk(11));
    const b = newStage(n, mk(99));
    for (const st of [a, b]) {
      assert.ok(st, `Lv${n}`);
      assert.equal(st.size, levelParams(n).size);
      assert.ok(puzzleOf(st).solve(), `Lv${n}`);
    }
    assert.notEqual(JSON.stringify(a.arrows), JSON.stringify(b.arrows), `Lv${n}`);
  }
});

test('validStage は条件に合わない種を弾く（クリア不可能なものは返さない）', () => {
  let rejected = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const st = validStage(10, seed);
    if (st === null) rejected++;
    else assert.ok(puzzleOf(st).solve());
  }
  assert.ok(rejected > 0);
});
