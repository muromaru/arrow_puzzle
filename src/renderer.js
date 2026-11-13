import * as THREE from 'three';
import { FACES, dirVector } from './arrow.js';

const STROKE = 0.16; // 矢印の線の太さ（セル=1）
const GLOW = 0.44;   // 発光（強調表示）の太さ
const LIFT = 0.012;  // 面から浮かせる量（重なりのちらつき防止。小さいほど貼り付いて見える）
const COLORS = { ink: 0x1d2636, blue: 0x2f6df6, red: 0xe5382b, amber: 0xff9f1a };
const FACE_COLORS = [0xe9eef4, 0xe3e9f0, 0xf1f4f8, 0xdde4ec, 0xeaf0f6, 0xe6ecf3];
const ckey = (x, y, z, f) => `${x},${y},${z},${f}`;

// 折れ線（3D点列 points と、各区間の面の法線 nrm）を平たいリボンにして、先端に矢じりを付ける。d は頭の向き。
function ribbon(points, nrm, d, width, headHalf, tipLen) {
  const pos = [];
  const tri = (a, b, c) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  const hw = width / 2;
  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i];
    const q = points[i + 1];
    const v = q.clone().sub(p);
    if (v.lengthSq() < 1e-10) continue;
    const dir = v.normalize();
    const side = nrm[i].clone().cross(dir).multiplyScalar(hw);
    // 同じ面の折れ角では、角が欠けないよう端を線幅の半分だけ延長する。面をまたぐ継ぎ目は延長しない
    const extA = i === 0 || nrm[i - 1].distanceToSquared(nrm[i]) < 1e-6;
    const extB = i === points.length - 2 || nrm[i + 1].distanceToSquared(nrm[i]) < 1e-6;
    const a = p.clone().addScaledVector(dir, extA ? -hw : 0);
    const b = q.clone().addScaledVector(dir, extB ? hw : 0);
    const a1 = a.clone().add(side);
    const a2 = a.clone().sub(side);
    const b1 = b.clone().add(side);
    const b2 = b.clone().sub(side);
    tri(a1, b1, b2);
    tri(a1, b2, a2);
  }
  const e = points[points.length - 1];
  const side = nrm[nrm.length - 1].clone().cross(d).multiplyScalar(headHalf);
  tri(e.clone().add(side), e.clone().addScaledVector(d, tipLen), e.clone().sub(side));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

// 折れ線の弧長 from〜to の部分を切り出す（区間ごとの法線も一緒に返す）
function slice(points, nrm, from, to) {
  const out = { pts: [], nrm: [] };
  let acc = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i];
    const q = points[i + 1];
    const len = p.distanceTo(q);
    const s0 = acc;
    const s1 = acc + len;
    acc = s1;
    if (len < 1e-9 || s1 <= from) continue;
    if (s0 >= to) break;
    const ta = (Math.max(from, s0) - s0) / len;
    const tb = (Math.min(to, s1) - s0) / len;
    if (!out.pts.length) out.pts.push(p.clone().lerp(q, ta));
    out.pts.push(p.clone().lerp(q, tb));
    out.nrm.push(nrm[i]);
  }
  return out;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    this.gl.setClearColor(new THREE.Color(bg || '#dfe6ee'));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.5, 120);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(3, 6, 4);
    this.scene.add(sun);

    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.mats = {};
    for (const [k, c] of Object.entries(COLORS)) {
      this.mats[k] = new THREE.MeshBasicMaterial({
        color: c, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      });
    }
    this.raycaster = new THREE.Raycaster();
    this.recs = new Map();  // arrow.id → 描画用データ（内部データとは別管理）
    this.cells = new Map(); // セル(+面) → arrow.id（タップ判定用。射出済みは消える）
    this.fx = [];
    this.size = 3;
  }

  // 立方体と矢印を作り直す
  build(size, arrows) {
    this.size = size;
    this.group.clear();
    this.recs.clear();
    this.cells.clear();
    this.fx = [];
    this.group.rotation.y = 0;
    this.group.scale.setScalar(1);

    const faceMats = FACE_COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
    const body = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), faceMats);
    this.group.add(body);
    this.group.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(body.geometry),
      new THREE.LineBasicMaterial({ color: 0x1d2636 }),
    ));

    const off = (size - 1) / 2;
    const lift = 0.5 + LIFT;
    const nOf = (f) => new THREE.Vector3(...FACES[f].n);
    const ctr = (c) => new THREE.Vector3(c[0] - off, c[1] - off, c[2] - off);
    for (const a of arrows) {
      const n = nOf(a.face); // 頭のいる面の法線
      const d = new THREE.Vector3(...dirVector(a.face, a.dir));
      const pts = [ctr(a.cells[0]).addScaledVector(nOf(a.faces[0]), lift)];
      const nrm = [];
      for (let i = 1; i < a.cells.length; i++) {
        const na = nOf(a.faces[i - 1]);
        const nb = nOf(a.faces[i]);
        const c = ctr(a.cells[i]);
        if (a.faces[i] !== a.faces[i - 1]) {
          // 面をまたぐ: 前の面を辺（面の端）までたどり、ごく短い斜めの帯で辺をまたいで、次の面を続ける
          pts.push(c.clone().addScaledVector(na, lift).addScaledVector(nb, 0.5));
          nrm.push(na);
          pts.push(c.clone().addScaledVector(na, 0.5).addScaledVector(nb, lift));
          nrm.push(na.clone().add(nb).normalize());
        }
        pts.push(c.clone().addScaledVector(nb, lift));
        nrm.push(nb);
      }
      if (pts.length === 1) { // 1セルの矢印は短い軸を付ける
        pts.unshift(pts[0].clone().addScaledVector(d, -0.35));
        nrm.push(n);
      }
      let len = 0;
      for (let i = 0; i < pts.length - 1; i++) len += pts[i].distanceTo(pts[i + 1]);
      const E = size + 2; // 射出時に頭が進む距離（面の外まで出きる長さ）
      const full = [...pts, pts[pts.length - 1].clone().addScaledVector(d, E)];
      const fullN = [...nrm, n];
      const mesh = new THREE.Mesh(ribbon(pts, nrm, d, STROKE, 0.27, 0.5), this.mats.ink);
      this.group.add(mesh);
      this.recs.set(a.id, { id: a.id, face: a.face, n, d, pts, nrm, full, fullN, len, E, mesh, glow: null, cells: a.cells, faces: a.faces });
      a.cells.forEach((c, i) => this.cells.set(ckey(c[0], c[1], c[2], a.faces[i]), a.id));
    }
  }

  // 画面座標 → 矢印ID（なければ null）。タップ位置を立方体の面に当て、近くのセルにある矢印を選ぶ。
  pick(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    this.group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.group.matrixWorld).invert();
    const ray = this.raycaster.ray.clone().applyMatrix4(inv);
    const n = this.size;
    const h = n / 2;
    const hit = ray.intersectBox(new THREE.Box3(new THREE.Vector3(-h, -h, -h), new THREE.Vector3(h, h, h)), new THREE.Vector3());
    if (!hit) return null;
    const hv = [hit.x, hit.y, hit.z];
    let axis = 0;
    let best = Infinity;
    for (let i = 0; i < 3; i++) {
      const dd = Math.abs(Math.abs(hv[i]) - h);
      if (dd < best) { best = dd; axis = i; }
    }
    const face = (hv[axis] > 0 ? '+' : '-') + 'xyz'[axis];
    const free = [0, 1, 2].filter((i) => i !== axis);
    const off = (n - 1) / 2;
    const base = hv.map((c) => Math.min(n - 1, Math.max(0, Math.floor(c + h))));
    let bestId = null;
    let bestD = 0.75; // 線が細いので、近くのセルまで許容する
    for (let da = -1; da <= 1; da++) {
      for (let db = -1; db <= 1; db++) {
        const c = [0, 0, 0];
        c[axis] = hv[axis] > 0 ? n - 1 : 0;
        c[free[0]] = base[free[0]] + da;
        c[free[1]] = base[free[1]] + db;
        if (c.some((v) => v < 0 || v >= n)) continue;
        const id = this.cells.get(ckey(c[0], c[1], c[2], face));
        if (id === undefined) continue;
        const dist = Math.hypot(hv[free[0]] - (c[free[0]] - off), hv[free[1]] - (c[free[1]] - off));
        if (dist < bestD) { bestD = dist; bestId = id; }
      }
    }
    return bestId;
  }

  makeGlow(r, color, opacity) {
    const m = new THREE.Mesh(
      ribbon(r.pts, r.nrm, r.d, GLOW, 0.4, 0.5),
      new THREE.MeshBasicMaterial({
        color: COLORS[color], transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      }),
    );
    this.group.add(m);
    return m;
  }

  dropGlow(r) {
    if (!r.glow) return;
    this.group.remove(r.glow);
    r.glow.geometry.dispose();
    r.glow.material.dispose();
    r.glow = null;
  }

  // 指定した矢印に関わる進行中の演出を打ち切る（見た目を元に戻す）
  cancelFx(ids) {
    this.fx = this.fx.filter((f) => {
      if (f.touches && f.touches.some((i) => ids.includes(i))) { f.finish(); return false; }
      return true;
    });
  }

  // 射出: 青く発光し、蛇のように頭から素早く進んで面の外へ出ていく
  launch(id) {
    const r = this.recs.get(id);
    this.cancelFx([id]);
    r.cells.forEach((c, i) => this.cells.delete(ckey(c[0], c[1], c[2], r.faces[i])));
    r.mesh.material = this.mats.blue;
    r.glow = this.makeGlow(r, 'blue', 0.4);
    const setGeo = (mesh, seg, w, hh, tip) => {
      mesh.geometry.dispose();
      mesh.visible = seg.pts.length >= 2;
      if (mesh.visible) mesh.geometry = ribbon(seg.pts, seg.nrm, r.d, w, hh, tip);
    };
    this.fx.push({
      type: 'launch', touches: [id], t0: performance.now(), dur: 120 + r.E * 22,
      tick: (p) => {
        const s = r.E * (0.35 * p + 0.65 * p * p); // 最初から動き出し、だんだん加速する
        const seg = slice(r.full, r.fullN, s, s + r.len);
        setGeo(r.mesh, seg, STROKE, 0.27, 0.5);
        setGeo(r.glow, seg, GLOW, 0.4, 0.5);
        r.glow.material.opacity = 0.4 * (1 - 0.5 * p);
      },
      finish: () => {
        this.group.remove(r.mesh);
        r.mesh.geometry.dispose();
        this.dropGlow(r);
      },
    });
  }

  // 射出不可: ぶつかる所まで蛇のように進み、衝突の火花と赤い発光のあと、元の位置へ戻る。
  // ぶつかった相手の矢印も橙に光る。
  flashBlocked(id, blockerId, cell) {
    const r = this.recs.get(id);
    const b = blockerId !== undefined && blockerId !== id ? this.recs.get(blockerId) : null;
    this.cancelFx([id, blockerId]);
    r.mesh.material = this.mats.red;
    r.glow = this.makeGlow(r, 'red', 0.55);
    if (b) {
      b.mesh.material = this.mats.amber;
      b.glow = this.makeGlow(b, 'amber', 0.55);
    }

    // 進む距離: 頭の矢じりの先が、ぶつかる矢印の線に触れるところまで
    const head = r.cells[r.cells.length - 1];
    const k = cell ? Math.abs(cell[0] - head[0]) + Math.abs(cell[1] - head[1]) + Math.abs(cell[2] - head[2]) : 1;
    const travel = Math.max(0.15, k - 0.6);
    const fwd = 90 + 24 * travel;   // 突進（加速しながら）
    const hold = 40;                // ぶつかった瞬間の間
    const back = 160 + 30 * travel; // 元の位置へ戻る
    const tImpact = fwd;
    const tBack = fwd + hold;
    const tEnd = tBack + back;
    const dur = Math.max(800, tEnd + 300);

    // 火花: ぶつかった位置から面に沿って放射状に飛ばす（衝突の瞬間に始まる）
    const N = 20;
    const off = (this.size - 1) / 2;
    const origin = cell
      ? new THREE.Vector3(cell[0] - off, cell[1] - off, cell[2] - off).addScaledVector(r.n, 0.5 + LIFT + 0.05)
      : r.pts[r.pts.length - 1].clone();
    const U = new THREE.Vector3(...FACES[r.face].u);
    const V = new THREE.Vector3(...FACES[r.face].v);
    const vel = [];
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2 + Math.random() * 0.3;
      const sp = 0.9 + Math.random() * 1.3;
      vel.push(new THREE.Vector3()
        .addScaledVector(U, Math.cos(ang) * sp)
        .addScaledVector(V, Math.sin(ang) * sp)
        .addScaledVector(r.n, 0.8));
    }
    const buf = new Float32Array(N * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(buf, 3));
    const pm = new THREE.PointsMaterial({
      color: 0xff5a2c, size: 5 * this.gl.getPixelRatio(), sizeAttenuation: false, transparent: true, depthWrite: false, opacity: 0,
    });
    const sparks = new THREE.Points(geo, pm);
    sparks.frustumCulled = false;
    this.group.add(sparks);

    const setGeo = (mesh, seg, w, hh, tip) => {
      mesh.geometry.dispose();
      mesh.visible = seg.pts.length >= 2;
      if (mesh.visible) mesh.geometry = ribbon(seg.pts, seg.nrm, r.d, w, hh, tip);
    };
    const side = r.n.clone().cross(r.d);
    let lastS = 0;
    this.fx.push({
      type: 'blocked', touches: [id, blockerId], t0: performance.now(), dur,
      tick: (p) => {
        const t = p * dur;
        let sl; // 頭が進んだ距離
        if (t < tImpact) { const q = t / fwd; sl = travel * q * q; }
        else if (t < tBack) sl = travel;
        else if (t < tEnd) { const q = (t - tBack) / back; sl = travel * (1 - q) * (1 - q); }
        else sl = 0;
        if (sl !== lastS) {
          lastS = sl;
          const seg = slice(r.full, r.fullN, sl, sl + r.len);
          setGeo(r.mesh, seg, STROKE, 0.27, 0.5);
          setGeo(r.glow, seg, GLOW, 0.4, 0.5);
        }
        const qi = t < tImpact ? 0 : Math.min(1, (t - tImpact) / (dur - tImpact)); // 衝突からの経過
        const lat = 0.06 * (1 - qi) * Math.sin(qi * Math.PI * 10); // 衝突の余韻の横揺れ
        r.mesh.position.copy(side).multiplyScalar(lat);
        r.glow.position.copy(r.mesh.position);
        const pulse = 0.5 + 0.5 * Math.abs(Math.sin(qi * Math.PI * 4));
        r.glow.material.opacity = t < tImpact ? 0.55 : 0.65 * (1 - qi) * pulse;
        if (b && b.glow) b.glow.material.opacity = t < tImpact ? 0.55 : 0.6 * (1 - qi) * (0.5 + 0.5 * Math.abs(Math.sin(qi * Math.PI * 3)));
        for (let i = 0; i < N; i++) {
          buf[i * 3] = origin.x + vel[i].x * qi * 0.7;
          buf[i * 3 + 1] = origin.y + vel[i].y * qi * 0.7;
          buf[i * 3 + 2] = origin.z + vel[i].z * qi * 0.7;
        }
        geo.attributes.position.needsUpdate = true;
        pm.opacity = t < tImpact ? 0 : 1 - qi;
      },
      finish: () => {
        r.mesh.geometry.dispose();
        r.mesh.geometry = ribbon(r.pts, r.nrm, r.d, STROKE, 0.27, 0.5); // 元の形に戻す
        r.mesh.visible = true;
        r.mesh.material = this.mats.ink;
        r.mesh.position.set(0, 0, 0);
        this.dropGlow(r);
        if (b) {
          if (b.mesh.material === this.mats.amber) b.mesh.material = this.mats.ink;
          this.dropGlow(b);
        }
        this.group.remove(sparks);
        geo.dispose();
        pm.dispose();
      },
    });
  }

  // クリア演出: 立方体が一回転しながら少し膨らむ
  celebrate() {
    this.fx.push({
      type: 'cheer', t0: performance.now(), dur: 900,
      tick: (p) => {
        const e = 1 - Math.pow(1 - p, 3);
        this.group.rotation.y = Math.PI * 2 * e;
        this.group.scale.setScalar(1 + 0.12 * Math.sin(p * Math.PI));
      },
      finish: () => { this.group.rotation.y = 0; this.group.scale.setScalar(1); },
    });
  }

  update(now) {
    this.fx = this.fx.filter((f) => {
      const p = Math.min(1, Math.max(0, (now - f.t0) / f.dur));
      f.tick(p);
      if (p >= 1) { f.finish(); return false; }
      return true;
    });
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.gl.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    return w / h;
  }

  render() {
    this.gl.render(this.scene, this.camera);
  }
}
