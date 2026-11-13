import { Renderer } from './renderer.js';
import { CameraController } from './camera.js';
import { InputController } from './input.js';
import { UI } from './ui.js';
import { Game } from './game.js';
import { STAGES } from './stages.js';

const canvas = document.getElementById('view');
const renderer = new Renderer(canvas);
const cam = new CameraController(renderer.camera);

let game;
const ui = new UI({
  count: STAGES.length,
  onStage: (i) => game.loadStage(i),
  onNext: () => game.next(),
  onReset: () => game.regenerate(),
});
game = new Game({ renderer, cam, ui });

renderer.resize();
game.start();

window.addEventListener('resize', () => {
  const aspect = renderer.resize();
  cam.fit(game.puzzle.size, aspect);
});

new InputController(canvas, {
  onRotate: (dx, dy) => cam.rotate(dx, dy),
  onZoom: (f) => cam.zoomBy(f),
  onTap: (x, y) => game.tap(x, y),
});

function loop(now) {
  renderer.update(now);
  renderer.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
