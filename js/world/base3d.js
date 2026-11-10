// ===== 特勤处 3D 基地：可自由走动的室内场景 =====
// 参考《三角洲行动》PC 端：冷灰/军绿金属墙、黑色钢梁、白色灯带、
// 深色抛光地面、绿色导引地灯、中央全息沙盘，五个部门设施沿大厅分布。
window.GAME = window.GAME || {};

GAME.Base3D = {
  ROOM: { w: 26, d: 17, h: 4.6 },   // 大厅尺寸
  stations: [],                      // 可交互设施
  colliders: [],                     // 矩形碰撞体
  circles: [],                       // 圆形碰撞体（中央沙盘）
  spin: null,                        // 全息沙盘（每帧旋转）

  // 纯代码贴图：设施铭牌（Canvas 绘制，不依赖外部图片）
  _signTexture: function (group, name, en, lv) {
    var c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = '#08121a'; g.fillRect(0, 0, 512, 256);
    g.strokeStyle = 'rgba(99,216,255,.55)'; g.lineWidth = 4;
    g.strokeRect(10, 10, 492, 236);
    // 顶部部门名
    g.fillStyle = '#6f8b9c';
    g.font = '22px "Microsoft YaHei", sans-serif';
    g.fillText(group, 34, 56);
    // 设施名
    g.fillStyle = '#dff4ff';
    g.font = 'bold 58px "Microsoft YaHei", sans-serif';
    g.fillText(name, 32, 132);
    // 英文
    g.fillStyle = '#7fd6f7';
    g.font = '22px "Segoe UI", sans-serif';
    g.fillText(en, 34, 182);
    // 等级
    if (lv) {
      g.fillStyle = '#f0c161';
      g.font = 'bold 30px "Segoe UI", sans-serif';
      g.textAlign = 'right';
      g.fillText('Lv.' + lv, 472, 132);
      g.textAlign = 'left';
    }
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    return tex;
  },

  // 部门墙面铭牌
  _deptTexture: function (name, en) {
    var c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = '#0a141a'; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = 'rgba(99,216,255,.35)'; g.lineWidth = 3;
    g.strokeRect(6, 6, 500, 116);
    g.fillStyle = '#cfe9f7';
    g.font = 'bold 44px "Microsoft YaHei", sans-serif';
    g.fillText(name, 28, 66);
    g.fillStyle = '#5f7f90';
    g.font = '22px "Segoe UI", sans-serif';
    g.fillText(en, 30, 100);
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  },

  // 建一个部门设施：柜台 + 背板 + 发光铭牌 + 地面光带
  _buildStation: function (parent, cfg) {
    var self = this;
    var group = new THREE.Group();
    group.position.set(cfg.pos[0], 0, cfg.pos[1]);
    group.rotation.y = cfg.rotY;

    var steel = new THREE.MeshStandardMaterial({ color: 0x1b2429, metalness: .75, roughness: .38 });
    var panel = new THREE.MeshStandardMaterial({ color: 0x252f33, metalness: .55, roughness: .55 });

    // 柜台
    var counter = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.95, 0.9), steel);
    counter.position.set(0, 0.475, 0.1);
    counter.castShadow = true; counter.receiveShadow = true;
    group.add(counter);

    // 柜台顶面发光条
    var bar = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.03, 0.04),
      new THREE.MeshBasicMaterial({ color: 0x9fe8ff })
    );
    bar.position.set(0, 0.96, 0.53);
    group.add(bar);

    // 背板
    var back = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.3, 0.14), panel);
    back.position.set(0, 1.9, -0.62);
    group.add(back);

    // 铭牌
    var lv = cfg.dept ? GAME.Base.level(cfg.dept) : 0;
    var sign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 1.25),
      new THREE.MeshBasicMaterial({ map: this._signTexture(cfg.group, cfg.name, cfg.en, lv) })
    );
    sign.position.set(0, 2.3, -0.53);
    group.add(sign);

    // 地面光带
    var glowMat = new THREE.MeshBasicMaterial({
      color: 0x5fd8ff, transparent: true, opacity: .14, depthWrite: false
    });
    var glow = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.0), glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(0, 0.02, 1.1);
    group.add(glow);

    // 设施小灯
    var lamp = new THREE.PointLight(0x8fe6ff, 0.35, 6, 2);
    lamp.position.set(0, 2.6, 0.6);
    group.add(lamp);

    parent.add(group);

    // 碰撞体（按朝向自动换算）
    var alongX = Math.abs(Math.cos(cfg.rotY)) > 0.5;
    var hw = alongX ? 1.45 : 0.75;
    var hd = alongX ? 0.75 : 1.45;
    this.colliders.push({
      minX: cfg.pos[0] - hw, maxX: cfg.pos[0] + hw,
      minZ: cfg.pos[1] - hd, maxZ: cfg.pos[1] + hd
    });

    this.stations.push({
      id: cfg.id, name: cfg.name, dept: cfg.dept || null, action: cfg.action || null,
      x: cfg.pos[0], z: cfg.pos[1], glowMat: glowMat, group: group
    });
  },

  // 搭建整个特勤处大厅
  build: function (scene) {
    this.stations = [];
    this.colliders = [];
    this.circles = [];
    var R = this.ROOM, hw = R.w / 2, hd = R.d / 2;

    // --- 地面 ---
    var floor = new THREE.Mesh(
      new THREE.BoxGeometry(R.w, 0.2, R.d),
      new THREE.MeshStandardMaterial({ color: 0x1a2227, metalness: .62, roughness: .32 })
    );
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    scene.add(floor);

    // 地面网格
    var grid = new THREE.GridHelper(R.w, 26, 0x2c5566, 0x1d3945);
    grid.position.y = 0.012;
    grid.material.transparent = true;
    grid.material.opacity = .45;
    scene.add(grid);

    // --- 墙 / 天花板 ---
    var wallMat = new THREE.MeshStandardMaterial({ color: 0x2a322f, metalness: .2, roughness: .92 });
    var wallGeoX = new THREE.BoxGeometry(R.w, R.h, 0.4);
    var wallGeoZ = new THREE.BoxGeometry(0.4, R.h, R.d);
    var w1 = new THREE.Mesh(wallGeoX, wallMat); w1.position.set(0, R.h / 2, -hd); scene.add(w1);
    var w2 = new THREE.Mesh(wallGeoX, wallMat); w2.position.set(0, R.h / 2, hd); scene.add(w2);
    var w3 = new THREE.Mesh(wallGeoZ, wallMat); w3.position.set(-hw, R.h / 2, 0); scene.add(w3);
    var w4 = new THREE.Mesh(wallGeoZ, wallMat); w4.position.set(hw, R.h / 2, 0); scene.add(w4);

    var ceil = new THREE.Mesh(
      new THREE.BoxGeometry(R.w, 0.3, R.d),
      new THREE.MeshStandardMaterial({ color: 0x121a1e, roughness: .9 })
    );
    ceil.position.y = R.h;
    scene.add(ceil);

    // 黑色钢梁（南北墙）
    var beamMat = new THREE.MeshStandardMaterial({ color: 0x0e1315, metalness: .8, roughness: .4 });
    for (var bx = -10; bx <= 10; bx += 5) {
      [-1, 1].forEach(function (sgn) {
        var beam = new THREE.Mesh(new THREE.BoxGeometry(0.22, R.h, 0.22), beamMat);
        beam.position.set(bx, R.h / 2, sgn * (hd - 0.25));
        scene.add(beam);
      });
    }

    // 天花板白色灯带
    var ledMat = new THREE.MeshBasicMaterial({ color: 0xeaf6ff });
    for (var lz = -6; lz <= 6; lz += 4) {
      var led = new THREE.Mesh(new THREE.BoxGeometry(20, 0.08, 0.3), ledMat);
      led.position.set(0, R.h - 0.18, lz);
      scene.add(led);
    }

    // 墙脚绿色导引光带
    var guideMat = new THREE.MeshBasicMaterial({ color: 0x53e08a });
    var g1 = new THREE.Mesh(new THREE.BoxGeometry(R.w - 1, 0.05, 0.05), guideMat);
    g1.position.set(0, 0.16, -hd + 0.25); scene.add(g1);
    var g2 = g1.clone(); g2.position.z = hd - 0.25; scene.add(g2);
    var g3 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, R.d - 1), guideMat);
    g3.position.set(-hw + 0.25, 0.16, 0); scene.add(g3);
    var g4 = g3.clone(); g4.position.x = hw - 0.25; scene.add(g4);

    // --- 中央全息沙盘 ---
    var table = new THREE.Mesh(
      new THREE.CylinderGeometry(2.15, 2.35, 0.95, 40),
      new THREE.MeshStandardMaterial({ color: 0x1c262b, metalness: .8, roughness: .3 })
    );
    table.position.y = 0.475;
    table.castShadow = true; table.receiveShadow = true;
    scene.add(table);

    var topGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(2.0, 2.0, 0.06, 40),
      new THREE.MeshBasicMaterial({ color: 0x1d4a5a, transparent: true, opacity: .8 })
    );
    topGlass.position.y = 0.97;
    scene.add(topGlass);

    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.0, 0.045, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0x8fe6ff })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 1.0;
    scene.add(ring);

    // 全息体素建筑
    var holo = new THREE.Group();
    [[3.0, 0.4, 2.2, 0.5], [2.0, 1.3, 1.6, 1.55], [1.0, 1.1, 0.9, 2.75]].forEach(function (b) {
      var geo = new THREE.BoxGeometry(b[0], b[1], b[2]);
      var line = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: .9 })
      );
      line.position.y = b[3];
      holo.add(line);
    });
    var core = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xd8f6ff })
    );
    core.position.y = 1.0;
    holo.add(core);
    holo.position.set(0, 1.05, 0);
    scene.add(holo);
    this.spin = holo;

    var holoLight = new THREE.PointLight(0x5fd8ff, 1.1, 11, 2);
    holoLight.position.set(0, 2.6, 0);
    scene.add(holoLight);

    // 沙盘碰撞（圆形）
    this.circles.push({ x: 0, z: 0, r: 2.6 });

    // --- 部门墙面铭牌 ---
    var self = this;
    function wallSign(name, en, x, z, rotY) {
      var m = new THREE.Mesh(
        new THREE.PlaneGeometry(3.4, 0.85),
        new THREE.MeshBasicMaterial({ map: self._deptTexture(name, en) })
      );
      m.position.set(x, 3.55, z);
      m.rotation.y = rotY;
      scene.add(m);
    }
    wallSign('研发部门', 'RESEARCH & DEVELOPMENT', -4.0, -hd + 0.22, 0);
    wallSign('战斗部门', 'COMBAT', hw - 0.22, 0, -Math.PI / 2);
    wallSign('后勤部门', 'LOGISTICS', 4.0, hd - 0.22, Math.PI);
    wallSign('医疗部门', 'MEDICAL', -hw + 0.22, 4.2, Math.PI / 2);

    // --- 五部门设施 ---
    this._buildStation(scene, {
      id: 'tech', dept: 'craft', name: '技术中心', en: 'TECHNICAL', group: '研发部门',
      pos: [-4.0, -hd + 1.0], rotY: 0
    });
    this._buildStation(scene, {
      id: 'collect', dept: 'collect', name: '收藏室', en: 'COLLECTION', group: '研发部门 · 展柜',
      pos: [4.0, -hd + 1.0], rotY: 0
    });
    this._buildStation(scene, {
      id: 'train', dept: 'train', name: '训练中心', en: 'TRAINING', group: '战斗部门',
      pos: [hw - 1.0, -4.2], rotY: -Math.PI / 2
    });
    this._buildStation(scene, {
      id: 'range', dept: 'range', action: 'range', name: '靶场', en: 'RANGE', group: '战斗部门',
      pos: [hw - 1.0, 4.2], rotY: -Math.PI / 2
    });
    this._buildStation(scene, {
      id: 'pharmacy', dept: 'med', name: '制药台', en: 'PHARMACY', group: '医疗部门',
      pos: [-hw + 1.0, 4.2], rotY: Math.PI / 2
    });
    this._buildStation(scene, {
      id: 'stash', action: 'stash', name: '仓库', en: 'STORAGE', group: '后勤部门',
      pos: [4.0, hd - 1.0], rotY: Math.PI
    });
    this._buildStation(scene, {
      id: 'supply', action: 'market', name: '军需处', en: 'QUARTERMASTER', group: '后勤部门',
      pos: [-4.0, hd - 1.0], rotY: Math.PI
    });

    // --- 装饰：军绿色集装箱 + 角落灯光 ---
    var crateMat = new THREE.MeshStandardMaterial({ color: 0x39463a, metalness: .35, roughness: .75 });
    [[-11.2, -7.2], [11.2, -7.2], [11.2, 7.2]].forEach(function (p) {
      var crate = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 1.4), crateMat);
      crate.position.set(p[0], 0.7, p[1]);
      crate.castShadow = true;
      scene.add(crate);
      var edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(crate.geometry),
        new THREE.LineBasicMaterial({ color: 0x141a14 })
      );
      edges.position.copy(crate.position);
      scene.add(edges);
      self.colliders.push({
        minX: p[0] - 1.15, maxX: p[0] + 1.15,
        minZ: p[1] - 0.75, maxZ: p[1] + 0.75
      });
    });

    // 入口地面导引（南门 → 中央沙盘）
    var path = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 5.2),
      new THREE.MeshBasicMaterial({ color: 0x53e08a, transparent: true, opacity: .5 })
    );
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.02, hd - 3.2);
    scene.add(path);

    // --- 灯光 ---
    scene.add(new THREE.AmbientLight(0x9db4c6, 0.55));
    var dir = new THREE.DirectionalLight(0xdfefff, 0.55);
    dir.position.set(6, 12, 5);
    scene.add(dir);
    var fill = new THREE.PointLight(0xbfe6ff, 0.6, 22, 2);
    fill.position.set(0, 4.0, 4);
    scene.add(fill);

    return {
      spawn: { x: 0, z: hd - 2.2 },
      stations: this.stations
    };
  },

  // 每帧：旋转中央全息沙盘
  tick: function (dt) {
    if (this.spin) this.spin.rotation.y += dt * 0.35;
  }
};

// ===== 第一人称漫游：WASD 移动 + 鼠标转头 + E 交互 =====
GAME.BaseWalk = {
  active: false,
  yaw: 0, pitch: 0,
  pos: null,
  near: null,
  el: {},

  begin: function (info, camera) {
    var self = this;
    this.active = true;
    this.camera = camera;
    this.info = info;
    this.yaw = 0;
    this.pitch = 0;
    this.pos = { x: info.spawn.x, z: info.spawn.z };
    this.near = null;

    ['base-hud', 'bw-tip', 'bw-exit', 'bw-range'].forEach(function (id) {
      self.el[id] = document.getElementById(id);
    });
    this.el['base-hud'].classList.remove('hidden');
    this.el['bw-tip'].classList.add('hidden');
    this.el['bw-tip'].innerHTML = '';
    // 按钮：返回大厅 / 直接进靶场（也可以走到靶场设施按 E）
    if (this.el['bw-exit']) this.el['bw-exit'].onclick = function () { GAME.Game.exitBase(); };
    if (this.el['bw-range']) this.el['bw-range'].onclick = function () { GAME.Game.enterRange(); };

    // 指针锁定（点击进入时由用户手势触发）
    GAME.Input.lock();
    this.applyCamera();
  },

  end: function () {
    this.active = false;
    this.near = null;
    if (this.el['base-hud']) {
      this.el['base-hud'].classList.add('hidden');
      this.el['bw-tip'].classList.add('hidden');
    }
  },

  applyCamera: function () {
    this.camera.position.set(this.pos.x, 1.65, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  },

  // 沿一个轴移动并处理碰撞（分轴处理，贴墙时可滑行）
  _moveAxis: function (axis, delta) {
    var R = GAME.Base3D.ROOM;
    var limX = R.w / 2 - 0.55, limZ = R.d / 2 - 0.55;
    this.pos[axis] += delta;
    if (this.pos.x < -limX) this.pos.x = -limX;
    if (this.pos.x > limX) this.pos.x = limX;
    if (this.pos.z < -limZ) this.pos.z = -limZ;
    if (this.pos.z > limZ) this.pos.z = limZ;

    var px = this.pos.x, pz = this.pos.z, r = 0.42;
    var cols = GAME.Base3D.colliders;
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      if (px > c.minX - r && px < c.maxX + r && pz > c.minZ - r && pz < c.maxZ + r) {
        // 推回最近的边
        if (axis === 'x') this.pos.x = delta > 0 ? c.minX - r : c.maxX + r;
        else this.pos.z = delta > 0 ? c.minZ - r : c.maxZ + r;
        px = this.pos.x; pz = this.pos.z;
      }
    }
    // 中央沙盘（圆）
    var circles = GAME.Base3D.circles;
    for (var j = 0; j < circles.length; j++) {
      var cc = circles[j];
      var dx = this.pos.x - cc.x, dz = this.pos.z - cc.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      var min = cc.r + r;
      if (d < min && d > 0.0001) {
        this.pos.x = cc.x + dx / d * min;
        this.pos.z = cc.z + dz / d * min;
      }
    }
  },

  update: function (dt) {
    if (!this.active) return;
    GAME.Base3D.tick(dt);

    // 鼠标转头
    var d = GAME.Input.consumeDelta();
    this.yaw -= d.x * 0.0022;
    this.pitch -= d.y * 0.0022;
    if (this.pitch > 1.1) this.pitch = 1.1;
    if (this.pitch < -1.1) this.pitch = -1.1;

    // WASD 移动
    var fx = 0, fz = 0;
    if (GAME.Input.isDown('KeyW')) fz -= 1;
    if (GAME.Input.isDown('KeyS')) fz += 1;
    if (GAME.Input.isDown('KeyA')) fx -= 1;
    if (GAME.Input.isDown('KeyD')) fx += 1;
    if (fx || fz) {
      var len = Math.sqrt(fx * fx + fz * fz);
      fx /= len; fz /= len;
      var speed = GAME.Input.isDown('ShiftLeft') ? 5.4 : 3.3;
      var sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      // 前方 = (-sin, -cos)，右方 = (cos, -sin)
      var mx = (fx * cos + fz * sin) * speed * dt;
      var mz = (fz * cos - fx * sin) * speed * dt;
      this._moveAxis('x', mx);
      this._moveAxis('z', mz);
    }

    this.applyCamera();
    this.updateNear();
  },

  // 找最近的设施并更新底部提示
  updateNear: function () {
    var best = null, bestD = 3.1;
    var list = GAME.Base3D.stations;
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      var dx = this.pos.x - s.x, dz = this.pos.z - s.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) { bestD = d; best = s; }
    }

    var tip = this.el['bw-tip'];
    if (best !== this.near) {
      // 高亮切换
      if (this.near && this.near.glowMat) this.near.glowMat.opacity = .14;
      if (best && best.glowMat) best.glowMat.opacity = .34;
      this.near = best;
      if (best) {
        var verb = best.action === 'range' ? '进入' : (best.dept ? '查看' : '打开');
        tip.innerHTML = '按 <b>E</b> ' + verb + ' ' + best.name;
        tip.classList.remove('hidden');
      } else {
        tip.classList.add('hidden');
      }
    }
  },

  interact: function () {
    if (!this.active || !this.near) return;
    var s = this.near;
    // 靶场：直接进入可走动的 3D 练枪场景（不再打开 2D 详情页）
    if (s.action === 'range') GAME.Game.enterRange();
    else if (s.dept) GAME.Game.exitBase({ dept: s.dept });
    else if (s.action === 'stash') GAME.Game.exitBase({ tab: 'stash' });
    else if (s.action === 'market') GAME.Game.exitBase({ tab: 'market' });
  }
};
