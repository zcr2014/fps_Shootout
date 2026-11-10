// ===== 靶场：可自由走动的室内射击训练场 =====
// 从特勤处「靶场」设施按 E 进入：鼠标瞄准、左键射击、右键开镜，
// 打中靶纸/钢靶按环数与距离计分；B 打开装备台可免费换所有枪和配件。
window.GAME = window.GAME || {};

GAME.Range = {
  active: false,
  scene: null, camera: null,
  yaw: 0, pitch: 0,
  recoilPitch: 0, recoilYaw: 0, bloom: 0, shotSeq: 0,
  pos: null,
  gun: null, gunKick: 0,
  ads: 0, adsWant: false,
  mag: 0, fireCd: 0, reloading: false, reloadT: 0,
  score: 0, shots: 0, hits: 0, streak: 0,
  weaponId: 'm4a1', weaponDef: null, stats: null,
  attach: {},
  targets: [], boards: [], hitMeshes: [],
  raycaster: null, muzzle: null,
  panelOpen: false,
  el: {},
  _oldPress: {},

  begin: function (scene, camera) {
    var self = this;
    this.active = true;
    this.scene = scene;
    this.camera = camera;
    this.yaw = 0; this.pitch = 0;
    this.recoilPitch = 0; this.recoilYaw = 0; this.bloom = 0; this.shotSeq = 0;
    this.pos = { x: 0, z: 8.2 };
    this.score = 0; this.shots = 0; this.hits = 0; this.streak = 0;
    this.fireCd = 0; this.reloading = false; this.reloadT = 0;
    this.ads = 0; this.adsWant = false; this.gunKick = 0;
    this.panelOpen = false;
    this.targets = []; this.boards = []; this.hitMeshes = [];

    camera.fov = 75;
    camera.updateProjectionMatrix();

    // 隐藏上一局/大厅残留的玩家枪模与刀，避免叠在靶场枪上
    var p = GAME.Player;
    [p.gun, p.gun2, p.knife].forEach(function (o) { if (o) o.visible = false; });
    if (p.muzzleLight) p.muzzleLight.intensity = 0;

    GAME.Bullets.init(scene); // 复用弹道/弹着点特效
    this._buildRoom();
    this._buildTargets();
    this._buildGun();

    this._cacheEl();
    this.el.hud.classList.remove('hidden');
    this.el.panel.classList.add('hidden');
    this._bindUi();
    this._updateHud();

    // 靶场按键：R 换弹 / B 装备台
    this._oldPress.KeyR = GAME.Input.onPress['KeyR'];
    this._oldPress.KeyB = GAME.Input.onPress['KeyB'];
    GAME.Input.onPress['KeyR'] = function () { self.startReload(); };
    GAME.Input.onPress['KeyB'] = function () { self.togglePanel(); };

    // 鼠标左键按下立即开一枪（全自动武器由 update 里的按住连发接管）
    this._onDown = function (e) {
      if (e.button !== 0 || self.panelOpen) return;
      if (e.target && e.target.tagName === 'BUTTON') return;
      self.fire();
    };
    window.addEventListener('mousedown', this._onDown);

    this.applyCamera();
    GAME.Input.lock();
  },

  end: function () {
    this.active = false;
    this.panelOpen = false;
    if (GAME.HUD.scope) GAME.HUD.scope(null, 0);
    if (this.el.hud) this.el.hud.classList.add('hidden');
    if (this.el.panel) this.el.panel.classList.add('hidden');
    if (this.gun && this.gun.parent) this.gun.parent.remove(this.gun);
    this.gun = null;
    if (this.muzzle && this.muzzle.parent) this.muzzle.parent.remove(this.muzzle);
    this.muzzle = null;
    // 恢复玩家原本的按键回调
    if (this._oldPress.KeyR) GAME.Input.onPress['KeyR'] = this._oldPress.KeyR;
    else delete GAME.Input.onPress['KeyR'];
    if (this._oldPress.KeyB) GAME.Input.onPress['KeyB'] = this._oldPress.KeyB;
    else delete GAME.Input.onPress['KeyB'];
    if (this._onDown) window.removeEventListener('mousedown', this._onDown);
    this._onDown = null;
  },

  _cacheEl: function () {
    var self = this;
    ['range-hud', 'range-panel', 'rg-score', 'rg-acc', 'rg-shots', 'rg-weapon', 'rg-attach',
     'rg-ammo', 'rg-mag', 'rg-hit', 'rg-back', 'rg-open', 'rp-close', 'rp-guns', 'rp-attach'].forEach(function (id) {
      self.el[id] = document.getElementById(id);
    });
    this.el.hud = this.el['range-hud'];
    this.el.panel = this.el['range-panel'];
  },

  _bindUi: function () {
    var self = this;
    this.el['rg-back'].onclick = function () { GAME.Game.exitRange(); };
    this.el['rg-open'].onclick = function () { self.togglePanel(true); };
    this.el['rp-close'].onclick = function () { self.togglePanel(false); };
  },

  // ---------- 场景 ----------
  _buildRoom: function () {
    var scene = this.scene, i;

    var floor = new THREE.Mesh(
      new THREE.BoxGeometry(16, 0.2, 42),
      new THREE.MeshStandardMaterial({ color: 0x1b2126, metalness: .35, roughness: .78 })
    );
    floor.position.set(0, -0.1, -8);
    floor.receiveShadow = true;
    scene.add(floor);
    this.hitMeshes.push(floor);

    var wallMat = new THREE.MeshStandardMaterial({ color: 0x2a3238, metalness: .2, roughness: .9 });
    var sideGeo = new THREE.BoxGeometry(0.4, 5, 42);
    var wl = new THREE.Mesh(sideGeo, wallMat); wl.position.set(-8, 2.5, -8); scene.add(wl);
    var wr = new THREE.Mesh(sideGeo, wallMat); wr.position.set(8, 2.5, -8); scene.add(wr);

    // 挡弹墙：厚钢板 + 沙袋 + 斜向导流板
    var back = new THREE.Mesh(
      new THREE.BoxGeometry(16, 5, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x24292b, metalness: .8, roughness: .45 })
    );
    back.position.set(0, 2.5, -28.5);
    scene.add(back);
    this.hitMeshes.push(back);

    var steel = new THREE.MeshStandardMaterial({ color: 0x15191b, metalness: .85, roughness: .4 });
    for (i = -3; i <= 3; i++) {
      var plate = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.7, 0.12), steel);
      plate.position.set(i * 2.2, 1.0, -27.9);
      scene.add(plate);
    }
    var sand = new THREE.MeshStandardMaterial({ color: 0x3a3a2c, roughness: .95 });
    for (i = -6; i <= 6; i += 1.5) {
      var bag = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.42, 0.6), sand);
      bag.position.set(i, 0.21, -27.4);
      scene.add(bag);
    }
    var deflector = new THREE.Mesh(new THREE.BoxGeometry(16, 0.14, 1.6), steel);
    deflector.position.set(0, 3.8, -27.6);
    deflector.rotation.x = -0.5;
    scene.add(deflector);

    // 天花板 + 灯带
    var ceil = new THREE.Mesh(
      new THREE.BoxGeometry(16, 0.3, 42),
      new THREE.MeshStandardMaterial({ color: 0x101619, roughness: .9 })
    );
    ceil.position.set(0, 5, -8);
    scene.add(ceil);
    var ledMat = new THREE.MeshBasicMaterial({ color: 0xdff2ff });
    for (i = 0; i < 6; i++) {
      var led = new THREE.Mesh(new THREE.BoxGeometry(10, 0.08, 0.24), ledMat);
      led.position.set(0, 4.8, 2 - i * 6);
      scene.add(led);
    }

    // 射击位柜台 + 隔板
    var counter = new THREE.Mesh(
      new THREE.BoxGeometry(15, 1.0, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x20272b, metalness: .55, roughness: .5 })
    );
    counter.position.set(0, 0.5, 7.4);
    scene.add(counter);
    var top = new THREE.Mesh(
      new THREE.BoxGeometry(15.2, 0.06, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x30383c, metalness: .7, roughness: .35 })
    );
    top.position.set(0, 1.03, 7.4);
    scene.add(top);

    var partMat = new THREE.MeshStandardMaterial({ color: 0x1a2125, metalness: .4, roughness: .7 });
    [-5.2, -2.6, 0, 2.6, 5.2].forEach(function (x, idx) {
      if (idx === 0) return;
      var part = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.35, 1.1), partMat);
      part.position.set(x, 1.7, 8.0);
      scene.add(part);
    });

    // 射击距离线 + 地面导光条
    var lineMat = new THREE.MeshBasicMaterial({ color: 0x6fe0a0, transparent: true, opacity: .55 });
    [-2, -8, -14, -20].forEach(function (z) {
      var line = new THREE.Mesh(new THREE.BoxGeometry(15, 0.02, 0.06), lineMat);
      line.position.set(0, 0.012, z);
      scene.add(line);
    });

    // 距离铭牌（画布贴图）
    var self = this;
    [[10, -2], [16, -8], [22, -14], [28, -20]].forEach(function (info) {
      var m = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 0.55),
        new THREE.MeshBasicMaterial({
          map: self._labelTex(info[0] + ' m'),
          transparent: true
        })
      );
      m.position.set(-7.78, 2.4, info[1]);
      m.rotation.y = Math.PI / 2;
      scene.add(m);
    });

    // 灯光
    scene.add(new THREE.AmbientLight(0xdfe9f2, 0.55));
    var sun = new THREE.DirectionalLight(0xffffff, 0.7);
    sun.position.set(3, 9, 5);
    scene.add(sun);
    for (i = 0; i < 3; i++) {
      var lamp = new THREE.PointLight(0xcfe8ff, 0.55, 18, 2);
      lamp.position.set(0, 4.4, 1 - i * 10);
      scene.add(lamp);
    }
    var warm = new THREE.PointLight(0xffcf87, 0.5, 10, 2);
    warm.position.set(0, 2.2, 7.6);
    scene.add(warm);
  },

  // 画布文字贴图
  _labelTex: function (text) {
    var c = document.createElement('canvas');
    c.width = 256; c.height = 96;
    var g = c.getContext('2d');
    g.fillStyle = 'rgba(8,18,22,.85)';
    g.fillRect(0, 0, 256, 96);
    g.strokeStyle = 'rgba(99,216,255,.6)';
    g.lineWidth = 4;
    g.strokeRect(4, 4, 248, 88);
    g.fillStyle = '#dff4ff';
    g.font = 'bold 52px "Microsoft YaHei", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 128, 50);
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  },

  // 靶纸贴图：白底黑环 + 橙色靶心
  _paperTex: function () {
    var c = document.createElement('canvas');
    c.width = 256; c.height = 320;
    var g = c.getContext('2d');
    g.fillStyle = '#e9e4d6'; g.fillRect(0, 0, 256, 320);
    g.strokeStyle = '#20262b'; g.lineWidth = 6;
    g.strokeRect(8, 8, 240, 304);
    var cx = 128, cy = 170;
    var rings = [[112, '#1b2024'], [94, '#e9e4d6'], [76, '#1b2024'],
                 [58, '#e9e4d6'], [42, '#1b2024'], [26, '#e0712a'], [10, '#ffd54a']];
    rings.forEach(function (r) {
      g.beginPath();
      g.fillStyle = r[1];
      g.arc(cx, cy, r[0], 0, Math.PI * 2);
      g.fill();
    });
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  },

  _buildTargets: function () {
    var paperMat = new THREE.MeshLambertMaterial({ map: this._paperTex(), side: THREE.DoubleSide });
    // 三列 × 两排靶纸
    var lanes = [-4.8, 0, 4.8];
    var rows = [-6, -14];
    for (var r = 0; r < rows.length; r++) {
      for (var l = 0; l < lanes.length; l++) {
        this._makePaper(lanes[l], rows[r], rows[r] * -1 + 8, paperMat);
      }
    }
    // 远处钢靶（倒下式）
    this._makeSteel(-2.6, -20);
    this._makeSteel(2.6, -20);
    this._makeSteel(-1.2, -24);
    this._makeSteel(1.2, -24);
  },

  _makePaper: function (x, z, dist, mat) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    var metal = new THREE.MeshStandardMaterial({ color: 0x20262a, metalness: .6, roughness: .5 });
    var base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.7), metal);
    base.position.y = 0.04; g.add(base);
    var post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.9, 0.07), metal);
    post.position.y = 0.5; g.add(post);

    var pivot = new THREE.Group();
    pivot.position.y = 0.95;
    g.add(pivot);
    var board = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.92), mat);
    board.position.y = 0.5;
    pivot.add(board);
    var frame = new THREE.Mesh(new THREE.BoxGeometry(0.80, 0.98, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x2b3236, metalness: .5, roughness: .6 }));
    frame.position.set(0, 0.5, -0.03);
    pivot.add(frame);

    var t = {
      group: g, pivot: pivot, board: board, down: false, timer: 0,
      basePoints: 4, mult: dist >= 20 ? 1.6 : 1.2, kind: 'paper'
    };
    board.userData.target = t;
    this.targets.push(t);
    this.boards.push(board);
    this.scene.add(g);
  },

  _makeSteel: function (x, z) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    var metal = new THREE.MeshStandardMaterial({ color: 0x23292c, metalness: .7, roughness: .45 });
    var base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.09, 0.8), metal);
    base.position.y = 0.045; g.add(base);
    var post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.8, 0.09), metal);
    post.position.y = 0.45; g.add(post);

    var pivot = new THREE.Group();
    pivot.position.y = 0.85;
    g.add(pivot);
    var plate = new THREE.Mesh(
      new THREE.CircleGeometry(0.36, 24),
      new THREE.MeshLambertMaterial({ color: 0xd98032 })
    );
    plate.position.y = 0.36;
    pivot.add(plate);
    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.36, 0.024, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd54a })
    );
    ring.position.set(0, 0.36, 0.01);
    pivot.add(ring);

    var t = {
      group: g, pivot: pivot, board: plate, down: false, timer: 0,
      basePoints: 6, mult: 2.0, kind: 'steel'
    };
    plate.userData.target = t;
    this.targets.push(t);
    this.boards.push(plate);
    this.scene.add(g);
  },

  // ---------- 枪械 ----------
  _buildGun: function () {
    // 进靶场默认给一把带配件的 M4A1，先让玩家爽一下
    this.weaponId = 'm4a1';
    this.attach = { scope: 'scope_red', muzzle: 'muzzle_comp', grip: 'grip_vert', mag: 'mag_ext' };
    this._applyGun();

    this.raycaster = new THREE.Raycaster();
    this.raycaster.camera = this.camera;

    this.muzzle = new THREE.PointLight(0xffd9a0, 0, 9);
    this.muzzle.position.set(0.22, -0.16, -0.86);
    this.camera.add(this.muzzle);
  },

  _applyGun: function () {
    if (this.gun && this.gun.parent) this.gun.parent.remove(this.gun);
    this.weaponDef = GAME.Items.get(this.weaponId) || GAME.Items.get('m4a1');
    this.stats = GAME.Items.weaponStats(this.weaponDef, this.attach);
    this.gun = GAME.GunModel.build(this.weaponDef, { arms: true, attach: this.attach });
    this.gun.position.set(0.24, -0.22, -0.55);
    this.camera.add(this.gun);
    this.mag = this.stats.mag;
    this.reloading = false;
    this.reloadT = 0;
    this._updateHud();
  },

  startReload: function () {
    if (!this.active || this.reloading || this.mag >= this.stats.mag) return;
    this.reloading = true;
    this.reloadT = this.stats.reload;
    GAME.Audio.reload();
  },

  // ---------- 装备台 ----------
  togglePanel: function (force) {
    var open = force === undefined ? !this.panelOpen : !!force;
    if (open === this.panelOpen) return;
    this.panelOpen = open;
    this.el.panel.classList.toggle('hidden', !open);
    if (open) {
      this._renderPanel();
      GAME.Input.unlock();
    } else {
      GAME.Input.lock();
    }
  },

  _renderPanel: function () {
    var self = this;
    var guns = '';
    GAME.Items.buyable.forEach(function (id) {
      var d = GAME.Items.get(id);
      if (!d || d.cat !== 'weapon' || d.slot !== 'primary') return;
      guns += '<button class="rp-gun' + (id === self.weaponId ? ' active' : '') + '" data-gun="' + id + '">' +
        '<b>' + d.name + '</b><em>' + d.damage + ' 伤害 · ' + d.mag + ' 发 · ' + d.range + 'm</em></button>';
    });
    this.el['rp-guns'].innerHTML = guns;
    this.el['rp-guns'].onclick = function (e) {
      var b = e.target.closest ? e.target.closest('[data-gun]') : null;
      if (!b) return;
      self.weaponId = b.getAttribute('data-gun');
      self._applyGun();
      self._renderPanel();
      GAME.Audio.pickup();
    };

    var html = '';
    GAME.Items.attachKinds.forEach(function (kind) {
      html += '<div class="rp-row"><span class="rp-kind">' + GAME.Items.attachLabels[kind] + '</span><div class="rp-chips">';
      html += '<button class="rp-chip' + (!self.attach[kind] ? ' active' : '') +
        '" data-kind="' + kind + '" data-attach="">不装</button>';
      for (var id in GAME.Items.defs) {
        var d = GAME.Items.defs[id];
        if (d.cat !== 'attach' || d.attach !== kind) continue;
        html += '<button class="rp-chip' + (self.attach[kind] === id ? ' active' : '') +
          '" data-kind="' + kind + '" data-attach="' + id + '">' + d.name + '</button>';
      }
      html += '</div></div>';
    });
    this.el['rp-attach'].innerHTML = html;
    this.el['rp-attach'].onclick = function (e) {
      var b = e.target.closest ? e.target.closest('[data-kind]') : null;
      if (!b) return;
      self.attach[b.getAttribute('data-kind')] = b.getAttribute('data-attach') || null;
      self._applyGun();
      self._renderPanel();
      GAME.Audio.pickup();
    };
  },

  // ---------- 射击 ----------
  fire: function () {
    var w = this.stats;
    if (this.reloading) return;
    if (this.mag <= 0) {
      GAME.Audio.empty();
      this.startReload();
      return;
    }
    this.mag--;
    this.shots++;
    this.fireCd = Math.max(0.04, w.interval);
    // 后坐：镜头抬升 + 左右摆动，停火后回正
    var rc = (w.recoil || 1);
    var recAds = 1 - this.ads * 0.4;
    this.gunKick = Math.min(1.4, rc * recAds);
    this.shotSeq++;
    this.recoilPitch += 0.009 * rc * recAds * (0.85 + Math.random() * 0.3);
    var side = (this.shotSeq % 2 ? 1 : -1);
    this.recoilYaw += (side * 0.0032 + (Math.random() - 0.5) * 0.0035) * rc * recAds;
    this.bloom = Math.min(0.030, this.bloom + 0.0022 * rc);
    if (this.muzzle) this.muzzle.intensity = w.suppressed ? 1.4 : 3.0;
    if (w.suppressed && GAME.Audio.shootSupp) GAME.Audio.shootSupp();
    else GAME.Audio.shoot();

    var origin = this.camera.position.clone();
    var dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    var spread = ((w.spread || 0.006) + this.bloom) * (1 - this.ads * 0.72);
    var ang = Math.random() * Math.PI * 2;
    var mg = spread * Math.sqrt(Math.random());
    var right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    var up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    dir.addScaledVector(right, Math.cos(ang) * mg).addScaledVector(up, Math.sin(ang) * mg).normalize();

    this.raycaster.set(origin, dir);
    this.raycaster.far = 70;
    var hits = this.raycaster.intersectObjects(this.boards.concat(this.hitMeshes), true);
    var endPoint = origin.clone().addScaledVector(dir, 70);
    var scored = false;

    if (hits.length > 0) {
      var hit = hits[0];
      endPoint = hit.point.clone();
      var obj = hit.object;
      var t = obj && obj.userData ? obj.userData.target : null;
      if (t && !t.down) {
        var center = new THREE.Vector3();
        t.board.getWorldPosition(center);
        var dd = hit.point.distanceTo(center);
        var base = t.kind === 'steel' ? 6 : (dd < 0.055 ? 10 : dd < 0.13 ? 8 : dd < 0.21 ? 6 : 4);
        var pts = Math.round(base * (t.mult || 1) + this.streak);
        this.score += pts;
        this.hits++;
        this.streak = Math.min(10, this.streak + 1);
        this._showHit('+' + pts);
        this._knockDown(t);
        GAME.Audio.hit();
        scored = true;
      } else {
        // 打空：连击清零，挡弹墙冒火花
        this.streak = 0;
        GAME.Bullets.addImpact(hit.point, 0xffd54a);
      }
    } else {
      this.streak = 0;
    }
    if (!scored && hits.length > 0) this.streak = 0;

    GAME.Bullets.addTracer(
      origin.clone().addScaledVector(dir, 0.5),
      endPoint
    );
    // 后坐：镜头轻微上跳，配件越好跳得越少
    this.pitch += 0.0045 * (w.recoil || 1);
    this.yaw += (Math.random() - 0.5) * 0.003 * (w.recoil || 1);
    this._updateHud();
  },

  _knockDown: function (t) {
    t.down = true;
    t.timer = 2.2;
  },

  _showHit: function (txt) {
    var el = this.el['rg-hit'];
    if (!el) return;
    el.textContent = txt;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  },

  _updateHud: function () {
    if (!this.el['rg-score']) return;
    this.el['rg-score'].textContent = this.score;
    this.el['rg-shots'].textContent = this.shots;
    this.el['rg-acc'].textContent = (this.shots ? Math.round(this.hits / this.shots * 100) : 0) + '%';
    this.el['rg-weapon'].textContent = this.weaponDef ? this.weaponDef.name : '—';
    this.el['rg-ammo'].textContent = this.mag;
    this.el['rg-mag'].textContent = this.stats ? this.stats.mag : 0;
    var names = [];
    GAME.Items.attachKinds.forEach(function (k) {
      var d = this.attach[k] ? GAME.Items.get(this.attach[k]) : null;
      names.push(GAME.Items.attachLabels[k] + '·' + (d ? d.name : '无'));
    }, this);
    this.el['rg-attach'].textContent = names.join('  ');
  },

  // ---------- 每帧 ----------
  applyCamera: function () {
    this.camera.position.set(this.pos.x, 1.65, this.pos.z);
    this.camera.rotation.set(this.pitch + this.recoilPitch, this.yaw + this.recoilYaw, 0, 'YXZ');
  },

  update: function (dt) {
    if (!this.active) return;
    var I = GAME.Input, U = GAME.Utils;
    // 后坐回正 / 连发散布收敛
    var recDecay = Math.pow(0.10, dt);
    this.recoilPitch *= recDecay;
    this.recoilYaw *= recDecay;
    this.bloom = Math.max(0, this.bloom - dt * 0.05);
    this.applyCamera();

    if (this.panelOpen) {
      if (GAME.HUD.scope) GAME.HUD.scope(null, 0);
      if (this.muzzle) this.muzzle.intensity = Math.max(0, this.muzzle.intensity - dt * 30);
      GAME.Bullets.update(dt, { alive: false }, function () {});
      return;
    }

    // 视角
    var d = I.consumeDelta();
    var sens = 0.0022 * (1 - this.ads * 0.55);
    this.yaw -= d.x * sens;
    this.pitch -= d.y * sens;
    this.pitch = U.clamp(this.pitch, -1.35, 1.35);

    // 在射击位附近小范围移动
    var mx = 0, mz = 0;
    if (I.isDown('KeyW')) mz -= 1;
    if (I.isDown('KeyS')) mz += 1;
    if (I.isDown('KeyA')) mx -= 1;
    if (I.isDown('KeyD')) mx += 1;
    if (mx || mz) {
      var len = Math.sqrt(mx * mx + mz * mz);
      mx /= len; mz /= len;
      var spd = 2.6 * (1 - this.ads * 0.4);
      var sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      this.pos.x += (mx * cos + mz * sin) * spd * dt;
      this.pos.z += (-mx * sin + mz * cos) * spd * dt;
      this.pos.x = U.clamp(this.pos.x, -5.5, 5.5);
      this.pos.z = U.clamp(this.pos.z, 8.0, 9.4);
    }

    // 开镜与视野
    this.adsWant = I.mouseR && !this.reloading;
    this.ads += ((this.adsWant ? 1 : 0) - this.ads) * Math.min(1, dt * 13);
    var baseFov = 75, adsFov = (this.stats && this.stats.adsFov) || 54;
    var targetFov = baseFov + (adsFov - baseFov) * this.ads;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 13);
      this.camera.updateProjectionMatrix();
    }

    // 瞄具分划：装镜并开镜时显示镜内视野
    if (GAME.HUD.scope) GAME.HUD.scope(this.attach.scope || null, this.ads);

    // 换弹
    if (this.reloading) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        this.reloading = false;
        this.mag = this.stats.mag;
        this._updateHud();
      }
    }

    // 开火
    this.fireCd -= dt;
    if (I.mouseDown && this.fireCd <= 0 && !this.reloading) this.fire();

    // 枪模姿态：腰射在右下，开镜居中；装镜时下沉让出镜内视野
    if (this.gun) {
      var k = this.ads, kick = this.gunKick;
      var drop = this.attach.scope ? k * k : 0;
      this.gun.position.set(
        0.245 * (1 - k),
        -0.225 + 0.175 * k - kick * 0.012 - drop * 0.52,
        -0.55 - 0.14 * k + kick * 0.025 - drop * 0.18
      );
      this.gun.rotation.set(-kick * 0.05, 0.05 * (1 - k), 0);
    }
    if (this.gunKick > 0) this.gunKick = Math.max(0, this.gunKick - dt * 5);
    if (this.muzzle) this.muzzle.intensity = Math.max(0, this.muzzle.intensity - dt * 30);

    // 靶子：倒下 / 复位
    for (var i = 0; i < this.targets.length; i++) {
      var t = this.targets[i];
      if (t.timer > 0) {
        t.timer -= dt;
        if (t.timer <= 0) t.down = false;
      }
      var want = t.down ? -1.45 : 0;
      var cur = t.pivot.rotation.x;
      if (Math.abs(cur - want) > 0.01) {
        t.pivot.rotation.x = cur + (want - cur) * Math.min(1, dt * 9);
      }
    }

    GAME.Bullets.update(dt, { alive: false }, function () {});
    this.applyCamera();
  }
};
