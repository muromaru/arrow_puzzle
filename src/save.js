const KEY = 'cubePuzzle.save.v3';

// セーブデータ: クリア済みステージ番号と、最後に遊んだステージ。保存先が使えなくても動作を止めない。
export function loadProgress(storage = globalThis.localStorage) {
  try {
    const d = JSON.parse(storage.getItem(KEY) || '{}');
    return {
      cleared: Array.isArray(d.cleared) ? d.cleared.filter(Number.isInteger) : [],
      last: Number.isInteger(d.last) ? d.last : 0,
    };
  } catch (e) {
    return { cleared: [], last: 0 };
  }
}

export function saveProgress(progress, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(progress));
  } catch (e) { /* 保存できない環境では何もしない */ }
}
