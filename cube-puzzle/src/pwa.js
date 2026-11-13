// PWA: Service Worker の登録（本番ビルドのみ）。失敗してもゲームは通常どおり動く。
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      await navigator.serviceWorker.ready;
      // 初回表示で読み込んだ全ファイルを、オフライン用にキャッシュさせる
      const urls = performance.getEntriesByType('resource').map((e) => e.name).concat(location.href);
      const worker = reg.active || navigator.serviceWorker.controller;
      if (worker) worker.postMessage({ type: 'cache', urls });
    } catch (e) { /* 登録に失敗しても何もしない */ }
  });
}
