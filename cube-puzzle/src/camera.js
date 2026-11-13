const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// 自作の簡易オービットカメラ（原点を注視）
export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.yaw = Math.PI / 4;
    this.pitch = 0.5;
    this.zoom = 1;
    this.baseDist = 10;
    this.minPitch = -1.4;
    this.maxPitch = 1.4;
    this.minZoom = 0.6;
    this.maxZoom = 2.5;
  }

  // 立方体全体が画面に収まる距離を計算（縦長・横長どちらにも対応）
  fit(size, aspect) {
    const radius = size * 0.5 * Math.sqrt(3) * 1.08;
    const vfov = (this.camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    this.baseDist = radius / Math.sin(Math.min(vfov, hfov) / 2);
    this.update();
  }

  rotate(dx, dy) {
    this.yaw -= dx * 0.008;
    this.pitch = clamp(this.pitch + dy * 0.008, this.minPitch, this.maxPitch);
    this.update();
  }

  zoomBy(factor) {
    this.zoom = clamp(this.zoom * factor, this.minZoom, this.maxZoom);
    this.update();
  }

  update() {
    const d = this.baseDist / this.zoom;
    const cp = Math.cos(this.pitch);
    this.camera.position.set(
      d * cp * Math.sin(this.yaw),
      d * Math.sin(this.pitch),
      d * cp * Math.cos(this.yaw),
    );
    this.camera.lookAt(0, 0, 0);
  }
}
