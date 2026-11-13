const TAP_THRESHOLD = 8; // px。これ未満の移動はタップ扱い

// タッチ/マウス共通（Pointer Events）。1本指ドラッグ=回転、2本指ピンチ=ズーム、移動が小さければタップ。
export class InputController {
  constructor(el, { onRotate, onZoom, onTap }) {
    this.el = el;
    this.onRotate = onRotate;
    this.onZoom = onZoom;
    this.onTap = onTap;
    this.pointers = new Map();
    this.moved = 0;
    this.multi = false;
    this.lastPinch = 0;

    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', (e) => this.cancel(e));
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.onZoom(Math.exp(-e.deltaY * 0.001));
    }, { passive: false });
    // iOS Safari のページ全体ピンチを抑止
    for (const t of ['gesturestart', 'gesturechange', 'gestureend']) {
      document.addEventListener(t, (e) => e.preventDefault());
    }
  }

  pinchDistance() {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  down(e) {
    this.el.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) {
      this.moved = 0;
      this.multi = false;
    } else if (this.pointers.size === 2) {
      this.multi = true;
      this.lastPinch = this.pinchDistance();
    }
  }

  move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;

    if (this.pointers.size === 1) {
      this.moved += Math.hypot(dx, dy);
      if (this.moved >= TAP_THRESHOLD) this.onRotate(dx, dy);
    } else if (this.pointers.size === 2) {
      const d = this.pinchDistance();
      if (this.lastPinch > 0) this.onZoom(d / this.lastPinch);
      this.lastPinch = d;
    }
  }

  up(e) {
    const wasSingle = this.pointers.size === 1 && !this.multi;
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (wasSingle && p && this.moved < TAP_THRESHOLD) {
      this.onTap(e.clientX, e.clientY);
    }
  }

  cancel(e) {
    this.pointers.delete(e.pointerId);
  }
}
