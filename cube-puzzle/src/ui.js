// 画面UI（DOM操作のみ）
export class UI {
  constructor({ count, onStage, onNext, onReset, perPage = 10 }) {
    this.total = count;
    this.per = perPage;
    this.pages = Math.ceil(count / perPage);
    this.page = 0;
    this.current = 0;
    this.cleared = [];
    this.countEl = document.getElementById('count');
    this.lvEl = document.getElementById('lv');
    this.clearEl = document.getElementById('clear');
    this.clearText = document.getElementById('clear-text');
    this.nextBtn = document.getElementById('next');
    this.pagePrev = document.getElementById('pagePrev');
    this.pageNext = document.getElementById('pageNext');

    // 画面下部のレベルボタン（1ページ perPage 個）
    const box = document.getElementById('levels');
    this.btns = [];
    for (let k = 0; k < perPage; k++) {
      const b = document.createElement('button');
      b.addEventListener('click', () => onStage(Number(b.dataset.i)));
      box.appendChild(b);
      this.btns.push(b);
    }
    this.pagePrev.addEventListener('click', () => { this.page = Math.max(0, this.page - 1); this.render(); });
    this.pageNext.addEventListener('click', () => { this.page = Math.min(this.pages - 1, this.page + 1); this.render(); });
    this.nextBtn.addEventListener('click', onNext);
    document.getElementById('reset').addEventListener('click', onReset);
  }

  render() {
    this.btns.forEach((b, k) => {
      const i = this.page * this.per + k;
      b.hidden = i >= this.total;
      b.dataset.i = String(i);
      b.textContent = String(i + 1) + (this.cleared.includes(i) ? ' ✓' : '');
      b.classList.toggle('on', i === this.current);
    });
    this.pagePrev.disabled = this.page === 0;
    this.pageNext.disabled = this.page >= this.pages - 1;
  }

  setCount(n) { this.countEl.textContent = String(n); }

  setStage(i) {
    this.current = i;
    this.page = Math.floor(i / this.per); // 開いたレベルのあるページを表示する
    this.lvEl.textContent = `Lv${i + 1}`;
    this.render();
  }

  // クリア済みレベルには ✓ を付ける
  setCleared(list) {
    this.cleared = list;
    this.render();
  }

  showClear(hasNext, level) {
    this.clearText.textContent = `Lv${level} クリア！`;
    this.nextBtn.hidden = !hasNext;
    this.clearEl.hidden = false;
  }

  hideClear() { this.clearEl.hidden = true; }
}
