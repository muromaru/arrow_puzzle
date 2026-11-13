import test from 'node:test';
import assert from 'node:assert/strict';
import { FACES, DIRS, dirVector, buildArrows } from '../src/arrow.js';
import { STAGES } from '../src/stages.js';

const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

test('各面で u × v = n（右手系）', () => {
  for (const [name, f] of Object.entries(FACES)) {
    assert.deepEqual(cross(f.u, f.v).map((c) => c + 0), f.n, name);
  }
});

test('4方向ベクトルは面に沿い（法線と直交）、単位長', () => {
  for (const face of Object.keys(FACES)) {
    for (const dir of DIRS) {
      const d = dirVector(face, dir);
      const n = FACES[face].n;
      assert.equal(d[0] * n[0] + d[1] * n[1] + d[2] * n[2], 0);
      assert.equal(Math.abs(d[0]) + Math.abs(d[1]) + Math.abs(d[2]), 1);
    }
  }
});

test('全ステージのデータが検証を通る', () => {
  for (const s of STAGES) assert.doesNotThrow(() => buildArrows(s), s.id);
});

test('面上にないセルは拒否される', () => {
  assert.throws(() => buildArrows({ size: 4, arrows: [[1, 1, 1, '+x', 'up']] }));
});
