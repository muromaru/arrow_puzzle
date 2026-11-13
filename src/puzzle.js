import { dirVector } from './arrow.js';

const keyOf = (x, y, z, face) => `${x},${y},${z},${face}`;

// ゲームロジック（描画非依存）。
// 矢印は面の上のセル列（面をまたいでもよい）。頭のいる面の上を、頭の向きにまっすぐ面の端まで進んだ先に、別の矢印のセルがあれば射出できない。
// 射出できると、矢印は蛇のように頭から進んで面の外へ出ていく。頭のいる面と別の面の矢印は障害物にならない。
export class Puzzle {
  constructor(size, arrows) {
    this.size = size;
    this.initial = arrows.map((a) => ({ ...a, faces: [...a.faces], cells: a.cells.map((c) => [...c]) })); // リスタート用に初期状態を保存
    this.reset();
  }

  reset() {
    this.arrows = this.initial.map((a) => ({ ...a, faces: [...a.faces], cells: a.cells.map((c) => [...c]), removed: false }));
    this.byId = new Map(this.arrows.map((a) => [a.id, a]));
    this.occ = new Map(); // セル(+面) → その矢印
    for (const a of this.arrows) a.cells.forEach((c, i) => this.occ.set(keyOf(c[0], c[1], c[2], a.faces[i]), a));
    this.alive = new Set(this.arrows.map((a) => a.id));
  }

  get remaining() { return this.alive.size; }
  isCleared() { return this.alive.size === 0; }

  // 頭の前方を面の端までたどり、最初にぶつかるセルと矢印を返す（なければ null）
  trace(id) {
    const a = this.byId.get(id);
    const d = dirVector(a.face, a.dir);
    const h = a.cells[a.cells.length - 1];
    let x = h[0] + d[0], y = h[1] + d[1], z = h[2] + d[2];
    const n = this.size;
    while (x >= 0 && x < n && y >= 0 && y < n && z >= 0 && z < n) {
      const o = this.occ.get(keyOf(x, y, z, a.face));
      if (o) return { arrow: o, cell: [x, y, z] };
      x += d[0]; y += d[1]; z += d[2];
    }
    return null;
  }

  findBlocker(id) {
    const t = this.trace(id);
    return t ? t.arrow : null;
  }

  canLaunch(id) {
    const a = this.byId.get(id);
    return !!a && !a.removed && this.trace(id) === null;
  }

  launch(id) {
    const a = this.byId.get(id);
    if (!a || a.removed) return { ok: false, reason: 'invalid' };
    const t = this.trace(id);
    if (t) return { ok: false, reason: 'blocked', blockerId: t.arrow.id, cell: t.cell };
    a.removed = true;
    a.cells.forEach((c, i) => this.occ.delete(keyOf(c[0], c[1], c[2], a.faces[i])));
    this.alive.delete(id);
    return { ok: true, cleared: this.isCleared() };
  }

  // 全消去できる射出順を返す（不可能なら null）。消去は障害物を減らすだけなので貪欲法で判定できる。
  solve() {
    const p = new Puzzle(this.size, this.initial);
    const order = [];
    let progress = true;
    while (p.remaining > 0 && progress) {
      progress = false;
      for (const id of [...p.alive]) {
        if (p.launch(id).ok) { order.push(id); progress = true; }
      }
    }
    return p.remaining === 0 ? order : null;
  }
}
