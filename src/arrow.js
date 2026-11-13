// 描画に依存しない矢印データ定義（Three.jsを使わない）。
// 面ごとの法線 n、面内の右方向 u、上方向 v（いずれも整数ベクトル。u × v = n）。
export const FACES = {
  '+x': { n: [1, 0, 0],  u: [0, 0, -1], v: [0, 1, 0] },
  '-x': { n: [-1, 0, 0], u: [0, 0, 1],  v: [0, 1, 0] },
  '+y': { n: [0, 1, 0],  u: [1, 0, 0],  v: [0, 0, -1] },
  '-y': { n: [0, -1, 0], u: [1, 0, 0],  v: [0, 0, 1] },
  '+z': { n: [0, 0, 1],  u: [1, 0, 0],  v: [0, 1, 0] },
  '-z': { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
};

// 面内の4方向
export const DIRS = ['up', 'right', 'down', 'left'];

const neg = (a) => a.map((c) => (c === 0 ? 0 : -c));

export function dirVector(face, dir) {
  const f = FACES[face];
  if (!f) throw new Error(`unknown face: ${face}`);
  switch (dir) {
    case 'up': return [...f.v];
    case 'down': return neg(f.v);
    case 'right': return [...f.u];
    case 'left': return neg(f.u);
    default: throw new Error(`unknown dir: ${dir}`);
  }
}

// セル a → 隣接セル b の面内方向（隣接していなければ null）
export function dirBetween(face, a, b) {
  const dv = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  for (const dir of DIRS) {
    const d = dirVector(face, dir);
    if (d[0] === dv[0] && d[1] === dv[1] && d[2] === dv[2]) return dir;
  }
  return null;
}

// セル(x,y,z)が、指定した面の表層にあるか
export function isOnFace(size, x, y, z, face) {
  const { n } = FACES[face];
  const c = [x, y, z];
  for (let i = 0; i < 3; i++) {
    if (n[i] === 1) return c[i] === size - 1;
    if (n[i] === -1) return c[i] === 0;
  }
  return false;
}

const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

// 面 face の上で、ベクトル v が表す方向（なければ null）
export function dirOfVector(face, v) {
  return DIRS.find((d) => same(dirVector(face, d), v)) ?? null;
}

// 矢印 = 面の上のセル列（最後が頭）。面をまたぐときは「同じセルで面だけが変わる」。
// cells[i] は3D整数座標、faces[i] はそのセルでの面。face / dir は頭の面と向き。
export function createArrow(id, faces, cells, dir) {
  return { id, face: faces[faces.length - 1], faces, cells, dir, removed: false };
}

// 1歩の移動ベクトル: 同じ面なら座標の差。面をまたぐ歩は、前の面の法線と逆向きに進む。
export function stepVector(fromFace, from, toFace, to) {
  return fromFace === toFace ? [to[0] - from[0], to[1] - from[1], to[2] - from[2]]
    : FACES[fromFace].n.map((c) => (c === 0 ? 0 : -c));
}

// ステージ定義 → 矢印データ。不正なデータは例外にする。矢印の書き方は3通り:
//   [x, y, z, 面, 方向]                          … 1セルの矢印
//   { face, path: [[x,y,z], ...] }               … 1つの面の上の折れ線
//   { path: [[x,y,z,面], ...] }                  … 面をまたぐ折れ線（またぐ所は同じセルで面だけ変える）
export function buildArrows(stage) {
  const { size, arrows } = stage;
  return arrows.map((e, i) => {
    const bad = (m) => new Error(`arrow ${i}: ${m}`);
    const tuple = Array.isArray(e);
    const items = tuple ? [[e[0], e[1], e[2], e[3]]] : e.path.map((c) => (c.length === 4 ? c : [...c, e.face]));
    if (items.length === 0) throw bad('empty path');
    const cells = [];
    const faces = [];
    const seen = new Set();
    items.forEach((c, k) => {
      const cell = c.slice(0, 3);
      const face = c[3];
      if (!FACES[face]) throw bad(`unknown face ${face}`);
      if (cell.length !== 3 || !cell.every(Number.isInteger) || cell.some((v) => v < 0 || v >= size)) throw bad('coordinate out of range');
      if (!isOnFace(size, cell[0], cell[1], cell[2], face)) throw bad(`cell is not on face ${face}`);
      if (seen.has(c.join())) throw bad('duplicate cell');
      seen.add(c.join());
      if (k > 0) {
        const pc = cells[k - 1];
        const pf = faces[k - 1];
        const ok = pf === face ? dirBetween(face, pc, cell) !== null
          : same(pc, cell) && FACES[pf].n.every((v, j) => v * FACES[face].n[j] === 0);
        if (!ok) throw bad('cells are not connected');
      }
      cells.push(cell);
      faces.push(face);
    });
    const n = cells.length;
    const dir = tuple ? e[4]
      : n > 1 ? dirOfVector(faces[n - 1], stepVector(faces[n - 2], cells[n - 2], faces[n - 1], cells[n - 1])) : e.dir;
    if (!DIRS.includes(dir)) throw bad(`unknown dir ${dir}`);
    return createArrow(i, faces, cells, dir);
  });
}
