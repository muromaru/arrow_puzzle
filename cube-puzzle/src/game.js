import { Puzzle } from './puzzle.js';
import { buildArrows } from './arrow.js';
import { STAGES, newStage } from './stages.js';
import { loadProgress, saveProgress } from './save.js';

// ゲーム全体の管理: ロジック(Puzzle)・描画(Renderer)・UI・セーブをつなぐ
export class Game {
  constructor({ renderer, cam, ui }) {
    this.renderer = renderer;
    this.cam = cam;
    this.ui = ui;
    this.stageIndex = 0;
    this.puzzle = null;
    this.progress = loadProgress();
  }

  start() {
    const last = this.progress.last;
    this.loadStage(last >= 0 && last < STAGES.length ? last : 0);
  }

  // 固定のレベルを開く。同じ番号を指定すると、初期状態からやり直しになる
  loadStage(i) {
    this.load(i, STAGES[i]);
  }

  // 「新しい問題」: 今のレベルと同じ難易度で、クリア可能と確認できた新しい配置に差し替える
  regenerate() {
    const st = newStage(this.stageIndex + 1);
    if (st) this.load(this.stageIndex, st);
  }

  load(i, stage) {
    this.stageIndex = i;
    this.puzzle = new Puzzle(stage.size, buildArrows(stage));
    this.renderer.build(stage.size, this.puzzle.arrows);
    this.cam.fit(stage.size, this.renderer.camera.aspect);
    this.ui.setStage(i);
    this.syncUI();
    this.progress.last = i;
    saveProgress(this.progress);
  }

  restart() {
    this.puzzle.reset();
    this.renderer.build(this.puzzle.size, this.puzzle.arrows);
    this.syncUI();
  }

  next() {
    if (this.stageIndex + 1 < STAGES.length) this.loadStage(this.stageIndex + 1);
  }

  syncUI() {
    this.ui.setCount(this.puzzle.remaining);
    this.ui.setCleared(this.progress.cleared);
    this.ui.hideClear();
  }

  onCleared() {
    if (!this.progress.cleared.includes(this.stageIndex)) this.progress.cleared.push(this.stageIndex);
    saveProgress(this.progress);
    this.ui.setCleared(this.progress.cleared);
    setTimeout(() => {
      if (!this.puzzle.isCleared()) return;
      this.renderer.celebrate();
      this.ui.showClear(this.stageIndex + 1 < STAGES.length, this.stageIndex + 1);
    }, 350);
  }

  tap(x, y) {
    if (this.puzzle.isCleared()) return;
    const id = this.renderer.pick(x, y);
    if (id === null) return;
    const r = this.puzzle.launch(id);
    if (r.ok) {
      this.renderer.launch(id);
      this.ui.setCount(this.puzzle.remaining);
      if (r.cleared) this.onCleared();
    } else if (r.reason === 'blocked') {
      this.renderer.flashBlocked(id, r.blockerId, r.cell);
      if (navigator.vibrate) navigator.vibrate([25, 30, 25]); // 対応端末のみ振動
    }
  }
}
