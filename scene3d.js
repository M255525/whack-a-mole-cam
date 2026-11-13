/* ============================================================
 * 體感打地鼠 — 3D 菜園場景（Three.js）
 * 只負責「畫」：地洞、地鼠（臉是可替換的貼圖）、槌子、特效、天色。
 * 遊戲規則與命中判定都在 index.html；這裡提供 pick()（畫面座標→地面座標）
 * 與 screenOf()（地洞上方某高度→畫面座標）給規則端使用。
 * 全部程式產生，無外部素材。
 * ============================================================ */
import * as THREE from 'three';

export const HOLES = [];
const GAP_X = 2.5, GAP_Z = 2.65;
for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) HOLES.push({ x: (c - 1) * GAP_X, z: (r - 1) * GAP_Z });
export const HIT_Y = 1.55;          // 地鼠頭部中心高度（升到最高時）
const HIDE_Y = -2.45;               // 縮回洞裡時的位移（整隻低於地面）

const SKY = {
  day:    { top: 0x5fb4ff, bot: 0xd8f0ff, sun: 0xfff4d6, sunI: 2.1, hemi: 1.0, fog: 0xcfe9ff },
  sunset: { top: 0x5a6fd0, bot: 0xffb27a, sun: 0xffc48a, sunI: 1.7, hemi: 0.85, fog: 0xf5c9a0 },
  fever:  { top: 0x3a1f6e, bot: 0xff6fa8, sun: 0xffb0e0, sunI: 1.5, hemi: 0.8, fog: 0xc77bb0 },
};

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 260);
  const TARGET = new THREE.Vector3(0, 0.6, 0.35);
  const CAM_DIR = new THREE.Vector3(0, 8.6, 6.4).normalize();
  let camDist = 11.5, shakeAmt = 0;

  /* ---------- 天空（漸層球）與光 ---------- */
  const skyU = { top: { value: new THREE.Color(SKY.day.top) }, bot: { value: new THREE.Color(SKY.day.bot) } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: skyU,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y * 2.2 + 0.15, 0.0, 1.0); gl_FragColor = vec4(mix(bot, top, h), 1.0); }',
  }));
  scene.add(sky);
  scene.fog = new THREE.Fog(SKY.day.fog, 40, 150);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x6b8a3a, 1.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4d6, 2.1);
  sun.position.set(6, 12, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 40 });
  sun.shadow.bias = -0.0015;
  scene.add(sun);
  const flash = new THREE.PointLight(0xffaa44, 0, 10);
  scene.add(flash);

  const M = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0 }, o));
  const mesh = (geo, mat, x = 0, y = 0, z = 0, shadow = true) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    if (shadow) { m.castShadow = true; m.receiveShadow = true; }
    return m;
  };
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ---------- 草地、花草 ---------- */
  const grass = mesh(new THREE.PlaneGeometry(260, 260), M(0x6cbf4a), 0, -0.6, 0, false);
  grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true;
  scene.add(grass);
  {
    const tuft = new THREE.ConeGeometry(0.12, 0.45, 4);
    const inst = new THREE.InstancedMesh(tuft, M(0x4f9e35, { flatShading: true }), 700);
    const d = new THREE.Object3D(); let n = 0;
    while (n < 700) {
      const x = rnd(-32, 32), z = rnd(-40, 9);
      if (Math.abs(x) < 5.2 && z > -5 && z < 5) continue;
      d.position.set(x, -0.45, z); d.rotation.set(rnd(-0.3, 0.3), rnd(0, 6), rnd(-0.3, 0.3));
      const s = rnd(0.6, 1.4); d.scale.set(s, s, s); d.updateMatrix(); inst.setMatrixAt(n++, d.matrix);
    }
    scene.add(inst);
    const fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 6, 4), M(0xffffff, { roughness: 0.6 }), 220);
    const cols = [0xff6b8a, 0xffd23f, 0xffffff, 0xb57cff, 0xff8a3d];
    for (let i = 0; i < 220; i++) {
      let x, z; do { x = rnd(-26, 26); z = rnd(-30, 8); } while (Math.abs(x) < 5.2 && z > -5 && z < 5);
      d.position.set(x, -0.38, z); d.rotation.set(0, 0, 0); d.scale.setScalar(rnd(0.7, 1.3)); d.updateMatrix();
      fl.setMatrixAt(i, d.matrix); fl.setColorAt(i, new THREE.Color(cols[i % cols.length]));
    }
    scene.add(fl);
  }

  /* ---------- 木框菜圃（地洞所在的土台） ---------- */
  const soilTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const c = cv.getContext('2d');
    c.fillStyle = '#7a4a2a'; c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i++) {
      c.fillStyle = ['#6a3f22', '#8d5a35', '#5c361d', '#94643d'][i % 4];
      c.globalAlpha = rnd(0.3, 0.8);
      c.beginPath(); c.arc(rnd(0, 256), rnd(0, 256), rnd(0.8, 3.2), 0, Math.PI * 2); c.fill();
    }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
    t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const BED_W = 8.8, BED_D = 8.9;
  const bed = mesh(new THREE.BoxGeometry(BED_W, 0.6, BED_D), [M(0x6e4226), M(0x6e4226), M(0xffffff, { map: soilTex }), M(0x6e4226), M(0x6e4226), M(0x6e4226)], 0, -0.3, 0);
  bed.castShadow = false;
  scene.add(bed);
  const wood = M(0xc68b52), woodDark = M(0x9a6638);
  const plank = (w, d, x, z) => {
    const p = mesh(new THREE.BoxGeometry(w, 0.42, d), wood, x, -0.05, z); scene.add(p);
    const t = mesh(new THREE.BoxGeometry(w + 0.02, 0.06, d + 0.02), woodDark, x, 0.17, z); scene.add(t);
  };
  plank(BED_W + 0.5, 0.35, 0, BED_D / 2 + 0.1);
  plank(BED_W + 0.5, 0.35, 0, -BED_D / 2 - 0.1);
  plank(0.35, BED_D, -BED_W / 2 - 0.1, 0);
  plank(0.35, BED_D, BED_W / 2 + 0.1, 0);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    scene.add(mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.6, 10), woodDark, x * (BED_W / 2 + 0.1), 0.0, z * (BED_D / 2 + 0.1)));
  }

  /* ---------- 地洞 ---------- */
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x140a04 });
  const rimMat = M(0x8a5530, { flatShading: true });
  const aimMat = new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.9 });
  const aimRings = [];
  HOLES.forEach(h => {
    const inner = new THREE.Mesh(new THREE.CircleGeometry(0.74, 32), holeMat);
    inner.rotation.x = -Math.PI / 2; inner.position.set(h.x, 0.012, h.z); scene.add(inner);
    const shade = new THREE.Mesh(new THREE.RingGeometry(0.74, 0.86, 32), new THREE.MeshBasicMaterial({ color: 0x3a2010 }));
    shade.rotation.x = -Math.PI / 2; shade.position.set(h.x, 0.013, h.z); scene.add(shade);
    const rim = mesh(new THREE.TorusGeometry(0.9, 0.17, 8, 28), rimMat, h.x, 0.02, h.z);
    rim.rotation.x = Math.PI / 2; rim.scale.z = 0.7; scene.add(rim);
    const aim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.055, 6, 40), aimMat);
    aim.rotation.x = Math.PI / 2; aim.position.set(h.x, 0.14, h.z); aim.visible = false; scene.add(aim);
    aimRings.push(aim);
  });

  /* ---------- 遠景：柵欄、樹、穀倉、風車、乾草捆、雲 ---------- */
  const fenceMat = M(0xf3ead8);
  for (let x = -24; x <= 24; x += 2) {
    scene.add(mesh(new THREE.BoxGeometry(0.22, 1.3, 0.22), fenceMat, x, 0.05, -12));
  }
  for (const y of [0.15, 0.55]) scene.add(mesh(new THREE.BoxGeometry(48.4, 0.16, 0.12), fenceMat, 0, y, -12));
  const tree = (x, z, s) => {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.22, 0.32, 1.8, 8), M(0x8a5a33), 0, 0.3, 0));
    const leaf = M(0x3f9a3a, { flatShading: true }), leaf2 = M(0x5bb547, { flatShading: true });
    g.add(mesh(new THREE.IcosahedronGeometry(1.25, 0), leaf, 0, 1.9, 0));
    g.add(mesh(new THREE.IcosahedronGeometry(0.95, 0), leaf2, 0.6, 2.5, 0.2));
    g.add(mesh(new THREE.IcosahedronGeometry(0.85, 0), leaf2, -0.6, 2.3, -0.2));
    g.position.set(x, -0.6, z); g.scale.setScalar(s); g.rotation.y = rnd(0, 6);
    scene.add(g);
  };
  [[-9, -6, 1.2], [-12, -15, 1.5], [10, -7, 1.3], [13, -16, 1.6], [-18, -9, 1.4], [18, -10, 1.3], [-7.5, 2, 1.0], [8, 2.5, 1.05], [-22, -20, 1.8], [24, -22, 1.9]]
    .forEach(([x, z, s]) => tree(x, z, s));
  {   // 紅色穀倉
    const g = new THREE.Group();
    const red = M(0xc8392f), white = M(0xfaf6ee), roof = M(0x5b3a2a);
    g.add(mesh(new THREE.BoxGeometry(6, 3.6, 4.5), red, 0, 1.8, 0));
    const r = mesh(new THREE.CylinderGeometry(3.4, 3.4, 4.7, 3, 1), roof, 0, 3.6, 0);
    r.rotation.set(Math.PI / 2, 0, Math.PI / 2); r.scale.set(1, 1, 0.55); g.add(r);
    g.add(mesh(new THREE.BoxGeometry(2.2, 2.4, 0.1), white, 0, 1.2, 2.27));
    g.add(mesh(new THREE.BoxGeometry(2.0, 2.2, 0.12), red, 0, 1.2, 2.29));
    const x1 = mesh(new THREE.BoxGeometry(0.12, 3.0, 0.14), white, 0, 1.2, 2.32); x1.rotation.z = 0.74; g.add(x1);
    const x2 = mesh(new THREE.BoxGeometry(0.12, 3.0, 0.14), white, 0, 1.2, 2.32); x2.rotation.z = -0.74; g.add(x2);
    g.add(mesh(new THREE.BoxGeometry(1.0, 0.8, 0.1), white, 0, 3.5, 2.27));
    g.position.set(-8, -0.6, -20); g.rotation.y = 0.25;
    scene.add(g);
  }
  const windmill = new THREE.Group();
  {
    windmill.add(mesh(new THREE.CylinderGeometry(0.12, 0.25, 6, 6), M(0xb0b6bd, { metalness: 0.4 }), 0, 3, 0));
    const hub = new THREE.Group(); hub.position.set(0, 6, 0.3);
    for (let i = 0; i < 6; i++) {
      const b = mesh(new THREE.BoxGeometry(0.28, 1.8, 0.05), M(i % 2 ? 0xfaf6ee : 0xe0473a), 0, 0.95, 0);
      const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 3; arm.add(b); hub.add(arm);
    }
    hub.add(mesh(new THREE.SphereGeometry(0.22, 10, 8), M(0x555555), 0, 0, 0.05));
    windmill.add(hub); windmill.userData.hub = hub;
    windmill.position.set(11, -0.6, -19); windmill.rotation.y = -0.3;
    scene.add(windmill);
  }
  const hay = M(0xe8c35a);
  [[-6.6, -4.5], [-7.3, -3.1], [6.8, -4.0]].forEach(([x, z]) => {
    const b = mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.1, 18), hay, x, 0.15, z); b.rotation.z = Math.PI / 2; scene.add(b);
  });
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group(), cm = M(0xffffff, { roughness: 1, emissive: 0x666666 });
    for (let k = 0; k < 5; k++) g.add(mesh(new THREE.SphereGeometry(rnd(1.4, 2.4), 10, 8), cm, k * 1.7 - 3.4, rnd(-0.4, 0.5), rnd(-0.6, 0.6), false));
    g.position.set(rnd(-60, 60), rnd(9, 15), rnd(-90, -55)); g.scale.y = 0.65;
    scene.add(g); clouds.push(g);
  }

  /* 蝴蝶：兩片翅膀在場邊飛 */
  const butterflies = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group(), wm = new THREE.MeshBasicMaterial({ color: [0xffe066, 0xff9ad5, 0x9ad8ff, 0xffffff][i], side: THREE.DoubleSide });
    const wl = new THREE.Mesh(new THREE.CircleGeometry(0.22, 10), wm), wr = wl.clone();
    wl.position.x = -0.2; wr.position.x = 0.2;
    const pl = new THREE.Group(), pr = new THREE.Group(); pl.add(wl); pr.add(wr); g.add(pl, pr);
    g.userData = { pl, pr, a: rnd(0, 6), r: rnd(6, 9), sp: rnd(0.2, 0.4), y: rnd(1.2, 2.6) };
    scene.add(g); butterflies.push(g);
  }

  /* ---------- 地鼠 ---------- */
  /* 臉：半球帽，UV 依 x/y 平面投影，讓圓形照片正好貼在臉上不變形 */
  function capGeo(r, ang) {
    const g = new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, ang);
    g.rotateX(Math.PI / 2);                 // 極點轉到 +z（朝前）
    const pos = g.attributes.position, uv = g.attributes.uv, R = r * Math.sin(ang);
    for (let i = 0; i < pos.count; i++) uv.setXY(i, 0.5 + pos.getX(i) / (2 * R), 0.5 + pos.getY(i) / (2 * R));
    uv.needsUpdate = true;
    return g;
  }
  const FACE_GEO = capGeo(0.618, 1.22);
  const blankTex = new THREE.CanvasTexture(document.createElement('canvas'));
  let faceTex = [blankTex];

  const moles = HOLES.map(h => {
    const root = new THREE.Group(); root.position.set(h.x, 0, h.z);
    const lift = new THREE.Group(); root.add(lift);
    const fur = M(0x8b5a3c), furLight = M(0xe6c39a), pink = M(0xf4a3a8);
    const animal = new THREE.Group(); lift.add(animal);
    animal.add(mesh(new THREE.CapsuleGeometry(0.52, 0.75, 6, 18), fur, 0, 0.6, 0));
    const belly = mesh(new THREE.SphereGeometry(0.42, 18, 12), furLight, 0, 0.62, 0.22); belly.scale.set(1, 1.35, 0.7); animal.add(belly);
    const head = mesh(new THREE.SphereGeometry(0.6, 32, 20), fur, 0, HIT_Y, 0); animal.add(head);
    for (const s of [-1, 1]) {
      const ear = mesh(new THREE.SphereGeometry(0.19, 14, 10), fur, s * 0.44, HIT_Y + 0.44, -0.05); ear.scale.z = 0.55; animal.add(ear);
      const ei = mesh(new THREE.SphereGeometry(0.11, 10, 8), pink, s * 0.44, HIT_Y + 0.44, 0.03); ei.scale.z = 0.4; animal.add(ei);
      const paw = mesh(new THREE.SphereGeometry(0.17, 12, 8), furLight, s * 0.34, 0.24, 0.56); paw.scale.set(1.15, 0.75, 1); animal.add(paw);
      for (let k = -1; k <= 1; k++) animal.add(mesh(new THREE.ConeGeometry(0.03, 0.1, 5), M(0xfff8ea), s * 0.34 + k * 0.08, 0.22, 0.72, false));
    }
    const faceMat = new THREE.MeshStandardMaterial({ map: blankTex, roughness: 0.75 });
    const face = new THREE.Mesh(FACE_GEO, faceMat); face.position.y = HIT_Y; animal.add(face);
    // 安全帽
    const helmet = new THREE.Group();
    const yel = M(0xffc21a, { roughness: 0.45 });
    const dome = mesh(new THREE.SphereGeometry(0.66, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), yel, 0, 0, 0); helmet.add(dome);
    helmet.add(mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.06, 28), yel, 0, 0.02, 0.06));
    helmet.add(mesh(new THREE.BoxGeometry(0.1, 0.1, 1.3), M(0xf0a800), 0, 0.62, 0));
    helmet.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 14), M(0xfff6c0, { emissive: 0xfff2a0, emissiveIntensity: 0.6 }), 0, 0.38, 0.55));
    helmet.children[3].rotation.x = Math.PI / 2;
    helmet.position.y = HIT_Y + 0.18; helmet.rotation.x = -0.12;
    animal.add(helmet);
    // 皇冠（黃金地鼠）
    const crown = new THREE.Group();
    const gold = M(0xffcf33, { metalness: 0.8, roughness: 0.25, emissive: 0x553300 });
    crown.add(mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.22, 18, 1, true), gold, 0, 0, 0));
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2;
      crown.add(mesh(new THREE.ConeGeometry(0.08, 0.24, 6), gold, Math.sin(a) * 0.34, 0.2, Math.cos(a) * 0.34));
    }
    crown.add(mesh(new THREE.OctahedronGeometry(0.08), M(0xe0245e, { emissive: 0x700020, roughness: 0.2 }), 0, 0.02, 0.37));
    crown.position.y = HIT_Y + 0.62; crown.rotation.x = -0.15;
    animal.add(crown);
    // 炸彈
    const bomb = new THREE.Group();
    bomb.add(mesh(new THREE.SphereGeometry(0.62, 26, 18), M(0x26262e, { roughness: 0.35, metalness: 0.3 }), 0, 1.2, 0));
    bomb.add(mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.2, 12), M(0x666670, { metalness: 0.6 }), 0, 1.86, 0));
    const fuse = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 6), M(0xc9a26b), 0.08, 2.1, 0); fuse.rotation.z = -0.35; bomb.add(fuse);
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
    spark.position.set(0.17, 2.32, 0); bomb.add(spark);
    for (const s of [-1, 1]) {   // 生氣的白眉毛＋眼睛
      const brow = mesh(new THREE.BoxGeometry(0.24, 0.05, 0.05), M(0xffffff), s * 0.2, 1.42, 0.57, false); brow.rotation.z = s * 0.45; bomb.add(brow);
      bomb.add(mesh(new THREE.SphereGeometry(0.07, 10, 8), M(0xffffff, { emissive: 0x888888 }), s * 0.2, 1.27, 0.58, false));
    }
    lift.add(bomb);
    // 暈眩星星
    const stars = new THREE.Group();
    for (let k = 0; k < 3; k++) stars.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.12), new THREE.MeshBasicMaterial({ color: 0xffe14d })));
    stars.position.y = HIT_Y + 0.85; lift.add(stars);
    root.rotation.y = Math.atan2(-h.x * 0.6, 9);   // 稍微朝向鏡頭
    scene.add(root);
    lift.visible = false;
    return { root, lift, animal, fur, faceMat, face, helmet, crown, bomb, spark, stars, faceIdx: -1 };
  });
  /* 臉朝鏡頭方向微仰 */
  moles.forEach(m => { m.face.rotation.x = -0.42; });

  /* ---------- 槌子 ---------- */
  function makeHammer(color) {
    const root = new THREE.Group();
    const pivot = new THREE.Group(); pivot.position.set(0.55, 0.35, 1.9); root.add(pivot);
    const headLocal = new THREE.Vector3(-0.55, -0.35, -1.9);
    const dir = headLocal.clone().normalize(), len = headLocal.length();
    const handle = mesh(new THREE.CylinderGeometry(0.075, 0.09, len + 0.3, 10), M(0xffd23f), 0, 0, 0);
    handle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    handle.position.copy(dir.clone().multiplyScalar(len / 2 - 0.15)); pivot.add(handle);
    const head = new THREE.Group(); head.position.copy(headLocal); pivot.add(head);
    // 槌頭軸向＝上下：敲到底（θ=0）時正好用底面打下去
    head.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 22), M(color, { roughness: 0.4 }), 0, 0, 0));
    for (const s of [-1, 1]) head.add(mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.16, 22), M(0xffe68a, { roughness: 0.4 }), 0, s * 0.54, 0));
    root.scale.setScalar(0.72);
    root.userData = { pivot };
    root.visible = false;
    scene.add(root);
    return root;
  }
  const hammers = [makeHammer(0xe8452c), makeHammer(0x3b82f6), makeHammer(0xe8452c)];
  const REST = 0.95;

  /* ---------- 粒子 ---------- */
  const parts = [];
  const partGeo = new THREE.IcosahedronGeometry(0.1, 0);
  function burst(i, colors, n = 14, power = 1) {
    const h = HOLES[i];
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ color: colors[k % colors.length], transparent: true }));
      m.position.set(h.x + rnd(-0.3, 0.3), HIT_Y + rnd(-0.2, 0.4), h.z + rnd(-0.3, 0.3));
      const a = rnd(0, Math.PI * 2), sp = rnd(2, 5) * power;
      m.userData = { vx: Math.cos(a) * sp, vy: rnd(3, 7) * power, vz: Math.sin(a) * sp, life: rnd(0.6, 1.0) };
      m.scale.setScalar(rnd(0.7, 1.8) * power);
      scene.add(m); parts.push(m);
    }
  }
  const booms = [];
  function explode(i) {
    const h = HOLES[i];
    burst(i, [0xff8a00, 0xffd23f, 0x444444, 0xff3b1f], 34, 1.4);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9 }));
    ball.position.set(h.x, 1.2, h.z); ball.userData = { t: 0 }; scene.add(ball); booms.push(ball);
    flash.position.set(h.x, 2, h.z); flash.intensity = 60;
    shakeAmt = 0.5;
  }

  /* ---------- 天色 ---------- */
  const cTop = new THREE.Color(), cBot = new THREE.Color(), cSun = new THREE.Color(), cFog = new THREE.Color();
  function lerpSky(a, b, k) {
    cTop.set(a.top).lerp(new THREE.Color(b.top), k); cBot.set(a.bot).lerp(new THREE.Color(b.bot), k);
    cSun.set(a.sun).lerp(new THREE.Color(b.sun), k); cFog.set(a.fog).lerp(new THREE.Color(b.fog), k);
    skyU.top.value.copy(cTop); skyU.bot.value.copy(cBot); sun.color.copy(cSun); scene.fog.color.copy(cFog);
    sun.intensity = a.sunI + (b.sunI - a.sunI) * k; hemi.intensity = a.hemi + (b.hemi - a.hemi) * k;
  }
  let skyK = 0, skyFever = 0;

  /* ---------- 介面 ---------- */
  let W = 1, H = 1, time = 0;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -HIT_Y), hitP = new THREE.Vector3();

  function placeCamera() {
    const aspect = W / H, tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const needW = 5.3 / (tanV * aspect);        // 菜圃（含木框）左右都要入鏡
    camDist = Math.max(12.5, needW);
    camera.position.copy(TARGET).addScaledVector(CAM_DIR, camDist);
    camera.lookAt(TARGET);
  }
  function resize(w, h) {
    W = Math.max(1, w); H = Math.max(1, h);
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    placeCamera();
  }
  /* 畫面座標 → 地鼠頭部高度平面上的 (x, z) */
  function pick(sx, sy) {
    ndc.set(sx / W * 2 - 1, -(sy / H) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hitP)) return null;
    return { x: hitP.x, z: hitP.z };
  }
  const tmpV = new THREE.Vector3();
  function screenOf(i, y = HIT_Y) {
    const h = HOLES[i];
    tmpV.set(h.x, y, h.z).project(camera);
    return { x: (tmpV.x + 1) / 2 * W, y: (1 - tmpV.y) / 2 * H };
  }
  function worldToScreen(x, y, z) { tmpV.set(x, y, z).project(camera); return { x: (tmpV.x + 1) / 2 * W, y: (1 - tmpV.y) / 2 * H }; }
  function setFaces(canvases) {
    faceTex.forEach(t => { if (t !== blankTex) t.dispose(); });
    faceTex = canvases.map(cv => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; });
    if (!faceTex.length) faceTex = [blankTex];
    moles.forEach(m => { m.faceIdx = -1; });
  }
  const ease = k => 1 - Math.pow(1 - k, 3);

  /* state: { moles: [{kind, face, up, hitT, knockT, helmet}], hammers: [{x,z,swingT,show,color}], aim: Set, phase (0..1), fever (bool) } */
  function render(dt, state) {
    time += dt;
    // 天色：前半白天 → 傍晚，最後衝刺切到狂熱紫
    const wantK = Math.min(1, Math.max(0, ((state.phase || 0) - 0.4) / 0.5));
    skyK += (wantK - skyK) * Math.min(1, dt * 1.5);
    skyFever += ((state.fever ? 1 : 0) - skyFever) * Math.min(1, dt * 2);
    if (skyFever > 0.01) {
      lerpSky(SKY.day, SKY.sunset, skyK);
      const base = { top: cTop.getHex(), bot: cBot.getHex(), sun: cSun.getHex(), fog: cFog.getHex(), sunI: sun.intensity, hemi: hemi.intensity };
      lerpSky(base, SKY.fever, skyFever);
    } else lerpSky(SKY.day, SKY.sunset, skyK);

    // 地鼠
    moles.forEach((m, i) => {
      const s = state.moles[i];
      if (!s || s.up <= 0.001) { m.lift.visible = false; return; }
      m.lift.visible = true;
      const isBomb = s.kind === 'bomb';
      m.animal.visible = !isBomb; m.bomb.visible = isBomb;
      let y = HIDE_Y * (1 - ease(Math.min(1, s.up)));
      if (s.up >= 1 && s.hitT < 0) y += Math.sin(time * 7 + i) * 0.035;
      m.lift.position.y = y;
      // 被打：壓扁再彈回
      let sq = 0;
      if (s.hitT >= 0) sq = Math.max(0, 1 - s.hitT / 0.35);
      if (s.knockT >= 0 && s.knockT < 0.25) sq = Math.max(sq, 0.6 * (1 - s.knockT / 0.25));
      m.lift.scale.set(1 + 0.22 * sq, 1 - 0.32 * sq, 1 + 0.22 * sq);
      if (isBomb) {
        m.spark.scale.setScalar(0.8 + Math.random() * 0.7);
        m.spark.material.color.setHex(Math.random() < 0.5 ? 0xffd23f : 0xff6a00);
        m.bomb.rotation.z = Math.sin(time * 9) * 0.06;
        return;
      }
      m.helmet.visible = s.kind === 'helmet' && s.helmet > 0;
      m.crown.visible = s.kind === 'gold';
      m.fur.color.setHex(s.kind === 'gold' ? 0xf2b632 : 0x8b5a3c);
      m.fur.emissive.setHex(s.kind === 'gold' ? 0x3a2600 : 0x000000);
      if (m.crown.visible) m.crown.rotation.y = time * 1.5;
      const fi = Math.min(faceTex.length - 1, Math.max(0, s.face | 0));
      if (m.faceIdx !== fi) { m.faceMat.map = faceTex[fi]; m.faceMat.needsUpdate = true; m.faceIdx = fi; }
      const red = s.hitT >= 0 ? Math.max(0, 1 - s.hitT / 0.5) : 0;
      m.faceMat.color.setRGB(1, 1 - red * 0.45, 1 - red * 0.45);
      m.stars.visible = s.hitT >= 0;
      if (m.stars.visible) m.stars.children.forEach((st, k) => {
        const a = time * 6 + k * Math.PI * 2 / 3;
        st.position.set(Math.cos(a) * 0.55, Math.sin(a * 2) * 0.05, Math.sin(a) * 0.55);
        st.rotation.y = time * 8;
      });
    });

    aimRings.forEach((r, i) => {
      r.visible = !!(state.aim && state.aim.has(i));
      if (r.visible) { r.scale.setScalar(1 + Math.sin(time * 10) * 0.04); }
    });

    // 槌子
    hammers.forEach((hm, k) => {
      const hs = state.hammers && state.hammers[k];
      if (!hs || !hs.show) { hm.visible = false; return; }
      hm.visible = true;
      hm.position.set(hs.x, HIT_Y + 0.95, hs.z);   // 槌頭底面約在地鼠頭頂
      let th = REST;
      if (hs.swingT >= 0) {
        const t = hs.swingT;
        th = t < 0.07 ? REST * (1 - t / 0.07) - 0.08 * (t / 0.07) : t < 0.3 ? -0.08 + (REST + 0.08) * ease((t - 0.07) / 0.23) : REST;
      } else th = REST + Math.sin(time * 3 + k) * 0.04;
      hm.userData.pivot.rotation.x = th;
    });

    // 粒子
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i], u = p.userData;
      u.life -= dt; u.vy -= 14 * dt;
      p.position.x += u.vx * dt; p.position.y += u.vy * dt; p.position.z += u.vz * dt;
      p.material.opacity = Math.max(0, u.life * 1.5);
      if (u.life <= 0 || p.position.y < -0.5) { scene.remove(p); p.material.dispose(); parts.splice(i, 1); }
    }
    for (let i = booms.length - 1; i >= 0; i--) {
      const b = booms[i]; b.userData.t += dt;
      const t = b.userData.t;
      b.scale.setScalar(0.5 + t * 6); b.material.opacity = Math.max(0, 0.9 - t * 2.4);
      if (t > 0.4) { scene.remove(b); b.material.dispose(); b.geometry.dispose(); booms.splice(i, 1); }
    }
    flash.intensity *= Math.pow(0.02, dt);

    // 環境動畫
    windmill.userData.hub.rotation.z += dt * 1.2;
    clouds.forEach((c, i) => { c.position.x += dt * (0.4 + i * 0.07); if (c.position.x > 75) c.position.x = -75; });
    butterflies.forEach(b => {
      const u = b.userData, a = u.a + time * u.sp;
      b.position.set(Math.cos(a) * u.r, u.y + Math.sin(time * 2 + u.a) * 0.4, Math.sin(a) * u.r * 0.5 - 3.5);
      b.rotation.y = -a;
      const f = Math.sin(time * 18 + u.a) * 0.9;
      u.pl.rotation.y = f; u.pr.rotation.y = -f;
    });

    // 鏡頭晃動
    placeCamera();
    if (shakeAmt > 0.001) {
      camera.position.x += (Math.random() - 0.5) * shakeAmt;
      camera.position.y += (Math.random() - 0.5) * shakeAmt;
      shakeAmt *= Math.pow(0.001, dt);
    }
    renderer.render(scene, camera);
  }

  return {
    resize, render, pick, screenOf, worldToScreen, setFaces, HOLES,
    refreshFaces: () => faceTex.forEach(t => { t.needsUpdate = true; }),
    burst: (i, cols, n, p) => burst(i, cols, n, p), explode,
    shake: a => { shakeAmt = Math.max(shakeAmt, a); },
    _debug: { scene, camera, moles, hammers },
  };
}
