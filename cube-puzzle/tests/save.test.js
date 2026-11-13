import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProgress, saveProgress } from '../src/save.js';

const fake = (init) => {
  const m = new Map(init ? [['cubePuzzle.save.v3', init]] : []);
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) };
};

test('保存したデータをそのまま読み出せる', () => {
  const st = fake();
  saveProgress({ cleared: [0, 2], last: 1 }, st);
  assert.deepEqual(loadProgress(st), { cleared: [0, 2], last: 1 });
});

test('データがない場合は初期値', () => {
  assert.deepEqual(loadProgress(fake()), { cleared: [], last: 0 });
});

test('壊れたデータ・不正な値でも例外にならず初期値/除外', () => {
  assert.deepEqual(loadProgress(fake('{broken')), { cleared: [], last: 0 });
  assert.deepEqual(loadProgress(fake('{"cleared":[1,"x",null],"last":"a"}')), { cleared: [1], last: 0 });
});

test('保存先が使えなくても例外にならない', () => {
  assert.doesNotThrow(() => saveProgress({ cleared: [], last: 0 }, undefined));
  assert.deepEqual(loadProgress(undefined), { cleared: [], last: 0 });
});
