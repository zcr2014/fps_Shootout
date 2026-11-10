// ===== 地图构建：地面、灯光、可进入的楼房、掩体、围墙 =====
window.GAME = window.GAME || {};

GAME.Map = {
  obstacles: [],      // 所有障碍物的 Box3，用于碰撞与遮挡
  meshes: [],         // 障碍物网格，用于玩家子弹射线检测
  half: 0,            // 地图半长
  buildings: [],      // { x, z, w, d, foot:Box3, interior:Box3 }
  interiors: [],      // 一楼内部区域（用于放容器）
  interiors2: [],     // 二楼内部区域
  platforms: [],      // 可站立的楼板 { minX, maxX, minZ, maxZ, y }
  ramps: [],          // 楼梯斜坡 { minX, maxX, minZ, maxZ, yLow, yHigh }
  doors: [],          // 门 { pivot, base, swing, open, locked, tier, box, cx, cz }
  lockedRooms: [],    // 二楼锁定房间 { box:Box3, tier, cx, cz, y }

  build: function (scene, def) {
    var U = GAME.Utils;
    var size = def.size;
    this.half = size / 2;
    this.obstacles = [];
    this.meshes = [];
    this.buildings = [];
    this.interiors = [];
    this.interiors2 = [];
    this.platforms = [];
    this.ramps = [];
    this.doors = [];
    this.lockedRooms = [];

    // --- 氛围：雾气 + 渐变天空穹顶 + 太阳光晕 ---
    scene.background = new THREE.Color(def.bg);
    scene.fog = new THREE.Fog(def.bg, def.fogNear, def.fogFar);
    this._buildSky(scene, def);

    // --- 灯光：压低环境光、加强太阳，得到更接近真实照片的光比 ---
    scene.add(new THREE.HemisphereLight(0xd6e6ff, 0x404a32, 0.46));
    scene.add(new THREE.AmbientLight(0xffffff, 0.07));
    var sun = new THREE.DirectionalLight(0xfff0cf, 1.32);
    sun.position.set(60, 100, 40);
    sun.castShadow = true;
    sun.shadow.camera.left = -this.half; sun.shadow.camera.right = this.half;
    sun.shadow.camera.top = this.half; sun.shadow.camera.bottom = -this.half;
    sun.shadow.camera.near = 10; sun.shadow.camera.far = this.half * 3;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.target.position.set(0, 0, 0);
    scene.add(sun.target);
    scene.add(sun);

    // --- 地面：程序化泥地/草地纹理，替换原来的纯色 + 网格线 ---
    this.concreteTex = this._concreteTexture();
    // 混凝土凹凸：砌缝 + 颗粒，让墙面不是一块平板
    this.concreteBump = this._bumpTexture(256, 256, 0.7, 64);
    this.concreteBump.wrapS = this.concreteBump.wrapT = THREE.RepeatWrapping;
    this.concreteBump.repeat.set(2, 2);
    this.tex = {
      wood: this._woodTexture(),
      metal: this._metalTexture(),
      med: this._medTexture(),
      bark: this._barkTexture()
    };
    var groundTex = this._groundTexture(def);
    groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
    var gRepeat = Math.max(4, size / 26);
    groundTex.repeat.set(gRepeat, gRepeat);
    groundTex.encoding = THREE.sRGBEncoding;
    // 凹凸贴图：让泥地/草地有真实的起伏颗粒，而不是一张平贴图
    var groundBump = this._bumpTexture(256, 256, 0.9, 0);
    groundBump.wrapS = groundBump.wrapT = THREE.RepeatWrapping;
    groundBump.repeat.set(gRepeat, gRepeat);
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshPhongMaterial({
        map: groundTex, bumpMap: groundBump, bumpScale: 0.10,
        shininess: 1, specular: 0x050505
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // --- 两条沥青路（十字交叉，纯视觉不挡路）---
    var roadTex = this._roadTexture();
    roadTex.repeat.set(1, Math.max(6, Math.round(size / 14)));
    var roadMat = new THREE.MeshPhongMaterial({
      map: roadTex, shininess: 8, specular: 0x15181c
    });
    var roadNS = new THREE.Mesh(new THREE.PlaneGeometry(7, size), roadMat);
    roadNS.rotation.x = -Math.PI / 2;
    roadNS.position.y = 0.03;
    roadNS.receiveShadow = true;
    scene.add(roadNS);
    // 东西向：同一块 7×size 平面绕世界 Y 轴转 90°，保证贴图条纹沿路面方向
    var roadEW = new THREE.Mesh(new THREE.PlaneGeometry(7, size), roadMat);
    roadEW.rotation.x = -Math.PI / 2;
    roadEW.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    roadEW.position.y = 0.05;
    roadEW.receiveShadow = true;
    scene.add(roadEW);

    // 十字路口补一块纯沥青，盖住两条路交叠处的白边与双黄线
    var junction = new THREE.Mesh(
      new THREE.PlaneGeometry(7.2, 7.2),
      new THREE.MeshPhongMaterial({ color: 0x34373b, shininess: 7, specular: 0x121418 })
    );
    junction.rotation.x = -Math.PI / 2;
    junction.position.y = 0.075;
    junction.receiveShadow = true;
    scene.add(junction);

    // --- 边界围墙 ---
    var self = this;
    var wallDefs = [
      { x: 0, z: -this.half, w: size, d: 1 },
      { x: 0, z: this.half, w: size, d: 1 },
      { x: -this.half, z: 0, w: 1, d: size },
      { x: this.half, z: 0, w: 1, d: size }
    ];
    var wallMat = new THREE.MeshPhongMaterial({
      color: 0x575d64, map: this.concreteTex,
      bumpMap: this.concreteBump, bumpScale: 0.05,
      shininess: 2, specular: 0x050505
    });
    wallDefs.forEach(function (wd) {
      var wall = new THREE.Mesh(new THREE.BoxGeometry(wd.w, 6, wd.d), wallMat);
      wall.position.set(wd.x, 3, wd.z);
      wall.castShadow = true; wall.receiveShadow = true;
      scene.add(wall);
      self.obstacles.push(new THREE.Box3().setFromObject(wall));
      self.meshes.push(wall);
    });

    // --- 先盖楼，再放零散掩体（避免掩体压进楼里）---
    this._buildBuildings(scene, def);

    // --- 零散建筑 / 掩体 ---
    var boxColors = [0x2a2114, 0x1b2027, 0x26110f, 0x1e251d];
    for (var i = 0; i < def.obstacles; i++) {
      for (var attempt = 0; attempt < 40; attempt++) {
        var w = U.rand(3, 10), d = U.rand(3, 10), h = U.rand(2, 7);
        var x = U.rand(-this.half + 8, this.half - 8);
        var z = U.rand(-this.half + 8, this.half - 8);
        if (Math.abs(x) < 8 && Math.abs(z) < 8) x += 16; // 别堵出生点
        var testBox = new THREE.Box3(
          new THREE.Vector3(x - w / 2 - 2, 0, z - d / 2 - 2),
          new THREE.Vector3(x + w / 2 + 2, h, z + d / 2 + 2)
        );
        if (this._insideAnyBuildingBox(testBox)) continue;

        var box = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          new THREE.MeshPhongMaterial({
            color: boxColors[U.randInt(0, boxColors.length - 1)],
            map: this.concreteTex,
            bumpMap: this.concreteBump, bumpScale: 0.05,
            shininess: 2, specular: 0x050505
          })
        );
        box.position.set(x, h / 2, z);
        box.castShadow = true; box.receiveShadow = true;
        scene.add(box);
        this.obstacles.push(new THREE.Box3().setFromObject(box));
        this.meshes.push(box);
        break;
      }
    }

    // --- 油桶装饰（锈迹金属贴图）---
    var barrelGeo = new THREE.CylinderGeometry(0.6, 0.6, 1.4, 12);
    var barrelMat = new THREE.MeshLambertMaterial({ color: 0x3a1610, map: this.tex.metal });
    for (var j = 0; j < def.barrels; j++) {
      for (var t2 = 0; t2 < 20; t2++) {
        var p = U.randomFreePos(this.half, this.obstacles, 0.7);
        if (this._insideAnyBuilding(p.x, p.z)) continue;
        var barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.position.set(p.x, 0.7, p.z);
        barrel.castShadow = true;
        scene.add(barrel);
        this.obstacles.push(new THREE.Box3().setFromObject(barrel));
        this.meshes.push(barrel);
        break;
      }
    }

    // --- 植被、岩石、草丛与远景山丘 ---
    this._addVegetation(scene, def);
    // --- 场景细节道具：路灯、木箱、沙袋、轮胎堆、水泥路障 ---
    this._addProps(scene, def);
  },

  // ---------- 场景细节道具（让地图不再空旷）----------
  _addProps: function (scene, def) {
    var U = GAME.Utils, self = this, half = this.half;

    // 路灯：沿十字路两侧布置，灯罩自发光
    var poleMat = new THREE.MeshPhongMaterial({ color: 0x2b3036, shininess: 20, specular: 0x2a2f36 });
    var lampMat = new THREE.MeshLambertMaterial({ color: 0xffe6b0, emissive: 0xffcf7a, emissiveIntensity: 0.9 });
    var poleGeo = new THREE.CylinderGeometry(0.11, 0.14, 6.4, 8);
    var armGeo = new THREE.BoxGeometry(1.5, 0.12, 0.12);
    var lampGeo = new THREE.BoxGeometry(0.62, 0.16, 0.30);
    var lampSpots = [];
    for (var z = -half + 26; z <= half - 26; z += 34) {
      lampSpots.push({ x: -5.9, z: z, dir: 1 });
      lampSpots.push({ x: 5.9, z: z + 17, dir: -1 });
    }
    lampSpots.forEach(function (s) {
      var pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(s.x, 3.2, s.z);
      pole.castShadow = true;
      scene.add(pole);
      var arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.set(s.x + s.dir * 0.75, 6.25, s.z);
      scene.add(arm);
      var lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(s.x + s.dir * 1.45, 6.16, s.z);
      scene.add(lamp);
      self.obstacles.push(new THREE.Box3().setFromObject(pole));
    });

    // 木箱堆：用木头纹理，随机朝向与大小
    var woodMat = new THREE.MeshLambertMaterial({ color: 0x2c2114, map: this.tex.wood });
    var woodMat2 = new THREE.MeshLambertMaterial({ color: 0x21180e, map: this.tex.wood });
    var crateCount = 0;
    for (var a = 0; a < 140 && crateCount < 18; a++) {
      var p = U.randomFreePos(half - 8, this.obstacles, 1.3);
      if (this._insideAnyBuilding(p.x, p.z)) continue;
      var sc = U.rand(0.8, 1.35);
      var crate = new THREE.Mesh(new THREE.BoxGeometry(sc, sc, sc), crateCount % 3 ? woodMat : woodMat2);
      crate.position.set(p.x, sc / 2, p.z);
      crate.rotation.y = U.rand(0, Math.PI * 2);
      crate.castShadow = true; crate.receiveShadow = true;
      scene.add(crate);
      this.obstacles.push(new THREE.Box3().setFromObject(crate));
      this.meshes.push(crate);
      crateCount++;
    }

    // 沙袋掩体：三层交错堆叠
    var bagMat = new THREE.MeshLambertMaterial({ color: 0x2f2a1c });
    var bagGeo = new THREE.BoxGeometry(0.62, 0.26, 0.36);
    for (var w2 = 0; w2 < 7; w2++) {
      var sp = U.randomFreePos(half - 10, this.obstacles, 2.2);
      if (this._insideAnyBuilding(sp.x, sp.z)) continue;
      var rot = U.rand(0, Math.PI);
      var wallG = new THREE.Group();
      for (var row = 0; row < 3; row++) {
        var n = (row % 2) ? 4 : 5;
        for (var b = 0; b < n; b++) {
          var bag = new THREE.Mesh(bagGeo, bagMat);
          bag.position.set((b - (n - 1) / 2) * 0.64, 0.15 + row * 0.27, 0);
          bag.rotation.y = U.rand(-0.06, 0.06);
          bag.castShadow = true; bag.receiveShadow = true;
          wallG.add(bag);
        }
      }
      wallG.position.set(sp.x, 0, sp.z);
      wallG.rotation.y = rot;
      scene.add(wallG);
      this.obstacles.push(new THREE.Box3().setFromObject(wallG));
    }

    // 轮胎堆：三只橡胶胎叠放
    var tireMat = new THREE.MeshLambertMaterial({ color: 0x1b1c1e });
    var tireGeo = new THREE.TorusGeometry(0.48, 0.16, 8, 18);
    for (var t = 0; t < 9; t++) {
      var tp = U.randomFreePos(half - 8, this.obstacles, 1.0);
      if (this._insideAnyBuilding(tp.x, tp.z)) continue;
      for (var k = 0; k < 3; k++) {
        var tire = new THREE.Mesh(tireGeo, tireMat);
        tire.rotation.x = Math.PI / 2;
        tire.position.set(tp.x, 0.16 + k * 0.24, tp.z);
        tire.castShadow = true;
        scene.add(tire);
      }
      this.obstacles.push(new THREE.Box3(
        new THREE.Vector3(tp.x - 0.6, 0, tp.z - 0.6),
        new THREE.Vector3(tp.x + 0.6, 0.8, tp.z + 0.6)
      ));
    }

    // 水泥路障：两侧带反光条
    var barrierMat = new THREE.MeshPhongMaterial({ color: 0x2f312d, shininess: 4, specular: 0x080808 });
    var stripeMat = new THREE.MeshLambertMaterial({ color: 0x565650 });
    for (var q = 0; q < 5; q++) {
      var bp = U.randomFreePos(half - 9, this.obstacles, 2.0);
      if (this._insideAnyBuilding(bp.x, bp.z)) continue;
      var bg = new THREE.Group();
      var base = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.85, 0.62), barrierMat);
      base.position.y = 0.43; base.castShadow = true; base.receiveShadow = true;
      bg.add(base);
      for (var s2 = -1; s2 <= 1; s2 += 2) {
        var stripe = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.64), stripeMat);
        stripe.position.set(s2 * 0.75, 0.62, 0);
        bg.add(stripe);
      }
      bg.position.set(bp.x, 0, bp.z);
      bg.rotation.y = U.rand(0, Math.PI);
      scene.add(bg);
      this.obstacles.push(new THREE.Box3().setFromObject(bg));
    }
  },

  // ---------- 天空：渐变穹顶 + 太阳光晕 ----------
  _buildSky: function (scene, def) {
    var skyGeo = new THREE.SphereGeometry(this.half * 1.35, 32, 16);
    var skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(def.skyTop || 0x31517a) },
        bottomColor: { value: new THREE.Color(def.bg) },
        exponent: { value: 0.55 }
      },
      vertexShader: [
        'varying vec3 vWorldPosition;',
        'void main() {',
        '  vec4 wp = modelMatrix * vec4(position, 1.0);',
        '  vWorldPosition = wp.xyz;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 topColor;',
        'uniform vec3 bottomColor;',
        'uniform float exponent;',
        'varying vec3 vWorldPosition;',
        'void main() {',
        '  float h = normalize(vWorldPosition).y;',
        '  float t = pow(max(h, 0.0), exponent);',
        '  gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);',
        '  #include <tonemapping_fragment>',
        '  #include <encodings_fragment>',
        '}'
      ].join('\n'),
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    });
    var sky = new THREE.Mesh(skyGeo, skyMat);
    sky.renderOrder = -1;
    scene.add(sky);

    // 太阳光晕（贴图用 Canvas 现画一个径向渐变）
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,246,214,0.95)');
    grad.addColorStop(0.25, 'rgba(255,226,150,0.55)');
    grad.addColorStop(0.6, 'rgba(255,190,110,0.16)');
    grad.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    var glowTex = new THREE.CanvasTexture(c);
    glowTex.encoding = THREE.sRGBEncoding;
    var sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false
    }));
    var dir = new THREE.Vector3(60, 100, 40).normalize();
    sprite.position.copy(dir.multiplyScalar(this.half * 1.15));
    var sc = this.half * 0.45;
    sprite.scale.set(sc, sc, 1);
    scene.add(sprite);
  },

  // ---------- 程序化混凝土纹理（墙面）----------
  _concreteTexture: function () {
    var c = document.createElement('canvas');
    c.width = c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = '#d6d6d6';
    g.fillRect(0, 0, 256, 256);
    // 颗粒
    for (var i = 0; i < 4200; i++) {
      var a = Math.random() * 0.28;
      g.fillStyle = (Math.random() > 0.5 ? 'rgba(255,255,255,' : 'rgba(0,0,0,') + a + ')';
      g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
    }
    // 大块斑驳
    for (var k = 0; k < 10; k++) {
      var rx = Math.random() * 256, ry = Math.random() * 256, rr = 14 + Math.random() * 34;
      var rg = g.createRadialGradient(rx, ry, 0, rx, ry, rr);
      rg.addColorStop(0, 'rgba(0,0,0,0.10)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(rx, ry, rr, 0, Math.PI * 2); g.fill();
    }
    // 模板砌缝
    g.strokeStyle = 'rgba(0,0,0,0.16)';
    g.lineWidth = 2;
    for (var y = 0; y <= 256; y += 64) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke();
    }
    g.strokeStyle = 'rgba(0,0,0,0.09)';
    g.lineWidth = 1;
    for (var row = 0; row < 4; row++) {
      var off = (row % 2) ? 32 : 0;
      for (var x = off; x <= 256; x += 64) {
        g.beginPath(); g.moveTo(x, row * 64); g.lineTo(x, row * 64 + 64); g.stroke();
      }
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  },

  // ---------- 程序化凹凸贴图（灰度噪点，用于 bumpMap）----------
  _bumpTexture: function (w, h, strength, seamGap) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.fillStyle = '#808080';
    g.fillRect(0, 0, w, h);
    var n = Math.floor(w * h * 0.28);
    for (var i = 0; i < n; i++) {
      var a = 0.10 + Math.random() * 0.22 * strength;
      g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,' + a + ')' : 'rgba(0,0,0,' + a + ')';
      var s = 1 + Math.random() * 2;
      g.fillRect(Math.random() * w, Math.random() * h, s, s);
    }
    // 坑洼
    for (var k = 0; k < 8; k++) {
      var rx = Math.random() * w, ry = Math.random() * h, rr = 4 + Math.random() * 14;
      var rg = g.createRadialGradient(rx, ry, 0, rx, ry, rr);
      rg.addColorStop(0, 'rgba(0,0,0,' + (0.18 * strength) + ')');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(rx, ry, rr, 0, Math.PI * 2); g.fill();
    }
    // 接缝/裂纹
    if (seamGap) {
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = 1.5;
      for (var y = 0; y < h; y += seamGap) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
      }
    }
    return new THREE.CanvasTexture(c);
  },

  // ---------- 程序化地面纹理（泥土 / 草地）----------
  _groundTexture: function (def) {
    var c = document.createElement('canvas');
    c.width = c.height = 256;
    var g = c.getContext('2d');
    var base = new THREE.Color(def.ground).multiplyScalar(0.5);
    g.fillStyle = '#' + base.getHexString();
    g.fillRect(0, 0, 256, 256);
    // 细颗粒
    for (var i = 0; i < 5200; i++) {
      var a = Math.random() * 0.18;
      g.fillStyle = (Math.random() > 0.55 ? 'rgba(190,190,175,' : 'rgba(0,0,0,') + a + ')';
      var s = 1 + Math.random() * 2;
      g.fillRect(Math.random() * 256, Math.random() * 256, s, s);
    }
    // 干草 / 裸露泥土斑块
    for (var k = 0; k < 22; k++) {
      var rx = Math.random() * 256, ry = Math.random() * 256, rr = 14 + Math.random() * 40;
      var rg = g.createRadialGradient(rx, ry, 0, rx, ry, rr);
      rg.addColorStop(0, Math.random() > 0.5 ? 'rgba(64,52,30,0.30)' : 'rgba(0,0,0,0.18)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(rx, ry, rr, 0, Math.PI * 2); g.fill();
    }
    return new THREE.CanvasTexture(c);
  },

  // ---------- 程序化木箱纹理（灰白底，靠材质颜色染色）----------
  _woodTexture: function () {
    if (this._woodTexCache) return this._woodTexCache;
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = '#cfc4b0';
    g.fillRect(0, 0, 128, 128);
    // 竖向木板条
    for (var i = 0; i < 128; i += 21) {
      g.fillStyle = 'rgba(0,0,0,' + (0.06 + Math.random() * 0.08) + ')';
      g.fillRect(i, 0, 21, 128);
      g.strokeStyle = 'rgba(60,42,26,0.5)';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke();
      // 木纹丝
      g.strokeStyle = 'rgba(90,70,50,0.25)';
      g.lineWidth = 1;
      for (var k = 0; k < 5; k++) {
        var y0 = Math.random() * 128;
        g.beginPath();
        g.moveTo(i + 2, y0);
        g.bezierCurveTo(i + 8, y0 + 6, i + 13, y0 - 6, i + 19, y0 + 3);
        g.stroke();
      }
    }
    // 横向框架条（箱子外框）
    g.fillStyle = 'rgba(70,50,30,0.35)';
    g.fillRect(0, 0, 128, 10);
    g.fillRect(0, 118, 128, 10);
    // 颗粒磨损
    for (var j = 0; j < 500; j++) {
      g.fillStyle = 'rgba(0,0,0,' + Math.random() * 0.12 + ')';
      g.fillRect(Math.random() * 128, Math.random() * 128, 1.5, 1.5);
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    this._woodTexCache = tex;
    return tex;
  },

  // ---------- 程序化锈迹金属纹理 ----------
  _metalTexture: function () {
    if (this._metalTexCache) return this._metalTexCache;
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = '#b8bcc2';
    g.fillRect(0, 0, 128, 128);
    // 锈斑
    for (var i = 0; i < 14; i++) {
      var rx = Math.random() * 128, ry = Math.random() * 128, rr = 4 + Math.random() * 14;
      var rg = g.createRadialGradient(rx, ry, 0, rx, ry, rr);
      rg.addColorStop(0, 'rgba(150,80,30,0.45)');
      rg.addColorStop(0.7, 'rgba(120,60,25,0.2)');
      rg.addColorStop(1, 'rgba(120,60,25,0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(rx, ry, rr, 0, Math.PI * 2); g.fill();
    }
    // 横向加强箍（阴影条）
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(0, 30, 128, 8);
    g.fillRect(0, 90, 128, 8);
    // 划痕
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = 1;
    for (var k = 0; k < 10; k++) {
      var x0 = Math.random() * 128, y0 = Math.random() * 128;
      g.beginPath(); g.moveTo(x0, y0);
      g.lineTo(x0 + Math.random() * 24 - 12, y0 + Math.random() * 24 - 12);
      g.stroke();
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    this._metalTexCache = tex;
    return tex;
  },

  // ---------- 医疗箱纹理：白底红十字 ----------
  _medTexture: function () {
    if (this._medTexCache) return this._medTexCache;
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = '#e8e8e8';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(0,0,0,0.08)';
    for (var i = 0; i < 300; i++) {
      g.fillRect(Math.random() * 128, Math.random() * 128, 1.5, 1.5);
    }
    // 红十字（占中间）
    g.fillStyle = '#c0392b';
    g.fillRect(52, 26, 24, 76);
    g.fillRect(26, 52, 76, 24);
    // 边框
    g.strokeStyle = 'rgba(0,0,0,0.3)';
    g.lineWidth = 6;
    g.strokeRect(3, 3, 122, 122);
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    this._medTexCache = tex;
    return tex;
  },

  // ---------- 树皮纹理：竖向深浅条纹 ----------
  _barkTexture: function () {
    if (this._barkTexCache) return this._barkTexCache;
    var c = document.createElement('canvas');
    c.width = 64; c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = '#8a7050';
    g.fillRect(0, 0, 64, 128);
    for (var i = 0; i < 64; i += 6) {
      g.fillStyle = 'rgba(40,28,16,' + (0.15 + Math.random() * 0.25) + ')';
      g.fillRect(i + Math.random() * 2, 0, 3 + Math.random() * 2, 128);
    }
    // 横向裂纹
    for (var k = 0; k < 8; k++) {
      var y0 = Math.random() * 128;
      g.strokeStyle = 'rgba(30,20,10,0.4)';
      g.beginPath();
      g.moveTo(Math.random() * 20, y0);
      g.lineTo(30 + Math.random() * 30, y0 + Math.random() * 6 - 3);
      g.stroke();
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    tex.encoding = THREE.sRGBEncoding;
    this._barkTexCache = tex;
    return tex;
  },

  // ---------- 沥青路纹理（64 宽 × 256 长，中线沿 v 方向虚线）----------
  _roadTexture: function () {
    if (this._roadTexCache) return this._roadTexCache;
    var c = document.createElement('canvas');
    c.width = 64; c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = '#3b3e42';
    g.fillRect(0, 0, 64, 256);
    // 沥青颗粒
    for (var i = 0; i < 1600; i++) {
      var a = Math.random() * 0.16;
      g.fillStyle = (Math.random() > 0.5 ? 'rgba(255,255,255,' : 'rgba(0,0,0,') + a + ')';
      g.fillRect(Math.random() * 64, Math.random() * 256, 1.5, 1.5);
    }
    // 轮胎磨痕（两条深色带）
    g.fillStyle = 'rgba(0,0,0,0.16)';
    g.fillRect(18, 0, 6, 256);
    g.fillRect(40, 0, 6, 256);
    // 黄色中线虚线
    g.fillStyle = '#d9b13c';
    for (var y = 0; y < 256; y += 64) {
      g.fillRect(31, y, 2, 34);
    }
    // 路缘白线
    g.fillStyle = 'rgba(230,230,230,0.65)';
    g.fillRect(1, 0, 2, 256);
    g.fillRect(61, 0, 2, 256);
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    this._roadTexCache = tex;
    return tex;
  },

  // ---------- 植被 / 岩石 / 草丛 / 远景山丘 ----------
  _addVegetation: function (scene, def) {
    var U = GAME.Utils, self = this, half = this.half;
    var treeCount = def.trees || Math.round(def.size / 7);
    var trunkMat = new THREE.MeshLambertMaterial({ color: 0x241b12, map: GAME.Map.tex.bark });
    var leafMat = new THREE.MeshLambertMaterial({ color: 0x16260f });
    var leafMat2 = new THREE.MeshLambertMaterial({ color: 0x111e0c });
    var trunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 3.2, 6);
    var crownGeo = new THREE.IcosahedronGeometry(1.55, 0);

    for (var i = 0; i < treeCount; i++) {
      var p = U.randomFreePos(half, this.obstacles, 1.4);
      if (!p || this._insideAnyBuilding(p.x, p.z)) continue;
      var trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(p.x, 1.6, p.z);
      trunk.castShadow = true;
      scene.add(trunk);
      var s = U.rand(1.0, 1.5);
      var crown = new THREE.Mesh(crownGeo, (i % 3 === 0) ? leafMat2 : leafMat);
      crown.scale.set(s, s * 0.85, s);
      crown.position.set(p.x, 3.4 + s * 0.6, p.z);
      crown.castShadow = true;
      scene.add(crown);
      // 第二层树冠：错开一点，轮廓更自然
      var crown2 = new THREE.Mesh(crownGeo, (i % 2 === 0) ? leafMat : leafMat2);
      crown2.scale.set(s * 0.72, s * 0.6, s * 0.72);
      crown2.position.set(p.x + s * 0.55, 3.1 + s * 0.4, p.z - s * 0.35);
      crown2.castShadow = true;
      scene.add(crown2);
      this.obstacles.push(new THREE.Box3(
        new THREE.Vector3(p.x - 0.34, 0, p.z - 0.34),
        new THREE.Vector3(p.x + 0.34, 3.4, p.z + 0.34)
      ));
    }

    // 岩石
    var rockGeo = new THREE.IcosahedronGeometry(1, 0);
    var rockMat = new THREE.MeshLambertMaterial({ color: 0x2a2c27 });
    var rockCount = def.rocks || 16;
    for (var r = 0; r < rockCount; r++) {
      var rp = U.randomFreePos(half, this.obstacles, 1.2);
      if (!rp || this._insideAnyBuilding(rp.x, rp.z)) continue;
      var rock = new THREE.Mesh(rockGeo, rockMat);
      var rs = U.rand(0.5, 1.4);
      rock.scale.set(rs, rs * 0.6, rs * U.rand(0.8, 1.2));
      rock.position.set(rp.x, rs * 0.32, rp.z);
      rock.rotation.y = U.rand(0, Math.PI);
      rock.castShadow = true; rock.receiveShadow = true;
      scene.add(rock);
      this.obstacles.push(new THREE.Box3().setFromObject(rock));
    }

    // 草丛（InstancedMesh，一次绘制）
    var grassGeo = new THREE.ConeGeometry(0.28, 0.7, 4);
    var grassMat = new THREE.MeshLambertMaterial({ color: 0x16240f });
    var grass = null;
    try {
      grass = new THREE.InstancedMesh(grassGeo, grassMat, 150);
    } catch (e) { grass = null; }
    if (grass) {
      var dummy = new THREE.Object3D();
      var placed = 0;
      for (var gi = 0; gi < 150; gi++) {
        var gp = U.randomFreePos(half, this.obstacles, 0.6);
        if (!gp || this._insideAnyBuilding(gp.x, gp.z)) continue;
        var gs = 0.6 + Math.random() * 0.9;
        dummy.position.set(gp.x, 0.3 * gs, gp.z);
        dummy.rotation.y = Math.random() * Math.PI;
        dummy.scale.set(gs, gs, gs);
        dummy.updateMatrix();
        grass.setMatrixAt(placed, dummy.matrix);
        placed++;
      }
      grass.count = placed;
      grass.instanceMatrix.needsUpdate = true;
      scene.add(grass);
    }

    // 远景山丘：边界外的剪影，被雾气柔化
    var hillMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(def.bg) });
    for (var h = 0; h < 9; h++) {
      var ang = (h / 9) * Math.PI * 2 + 0.28;
      var dist = half + 20 + Math.random() * 40;
      var hill = new THREE.Mesh(
        new THREE.ConeGeometry(30 + Math.random() * 22, 15 + Math.random() * 12, 7),
        hillMat
      );
      hill.position.set(Math.cos(ang) * dist, 4, Math.sin(ang) * dist);
      hill.rotation.y = Math.random() * Math.PI;
      scene.add(hill);
    }
  },

  // ---------- 可进入的楼房 ----------
  _buildBuildings: function (scene, def) {
    var U = GAME.Utils;
    var half = this.half;
    var wanted = def.buildings || 0;
    var corners = [
      { x: -half + 14, z: -half + 14 },
      { x: half - 14, z: half - 14 },
      { x: half - 14, z: -half + 14 },
      { x: -half + 14, z: half - 14 }
    ];

    for (var attempt = 0; attempt < 200 && this.buildings.length < wanted; attempt++) {
      var w = U.rand(16, 24), d = U.rand(14, 19);
      var x = U.rand(-half + w / 2 + 6, half - w / 2 - 6);
      var z = U.rand(-half + d / 2 + 6, half - d / 2 - 6);

      // 避开出生点
      if (U.dist2D({ x: x, z: z }, { x: 0, z: 0 }) < 30) continue;
      // 避开撤离点所在的四个角落
      var bad = false;
      for (var ci = 0; ci < corners.length; ci++) {
        if (U.dist2D({ x: x, z: z }, corners[ci]) < 26) { bad = true; break; }
      }
      if (bad) continue;

      // 避开已有楼房
      var foot = new THREE.Box3(
        new THREE.Vector3(x - w / 2 - 6, 0, z - d / 2 - 6),
        new THREE.Vector3(x + w / 2 + 6, 4, z + d / 2 + 6)
      );
      var overlap = false;
      for (var bi = 0; bi < this.buildings.length; bi++) {
        if (this.buildings[bi].foot.intersectsBox(foot)) { overlap = true; break; }
      }
      if (overlap) continue;

      this._createBuilding(scene, x, z, w, d, def.lockTier || 'blue');
    }
  },

  // 造一栋两层建筑：一楼四面墙留门洞 + 可开合的门板，
  // 室内楼梯通往二楼，二楼有隔壁房间（锁门需要房卡）与家具装饰
  _createBuilding: function (scene, x, z, w, d, lockTier) {
    var U = GAME.Utils;
    var self = this;
    var h1 = 5, t = 0.6, gap = 4.5;
    var y2 = h1 + 0.3;                 // 二楼地面高度
    var h2 = 4;                        // 二楼墙高
    var mat = new THREE.MeshPhongMaterial({
      color: 0x4e545b, map: this.concreteTex,
      bumpMap: this.concreteBump, bumpScale: 0.05, shininess: 2, specular: 0x050505
    });
    var mat2 = new THREE.MeshPhongMaterial({
      color: 0x454b52, map: this.concreteTex,
      bumpMap: this.concreteBump, bumpScale: 0.05, shininess: 2, specular: 0x050505
    });
    var slabMat = new THREE.MeshPhongMaterial({
      color: 0x3c424a, map: this.concreteTex,
      bumpMap: this.concreteBump, bumpScale: 0.04, shininess: 3, specular: 0x070707
    });
    var doorSide = U.randInt(0, 3);    // 0北 1南 2西 3东

    // 内墙面
    var iW = x - w / 2 + t, iE = x + w / 2 - t;
    var iN = z - d / 2 + t, iS = z + d / 2 - t;

    function addBox(cx, cy, cz, ww, hh, dd, material, solid) {
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, dd), material);
      mesh.position.set(cx, cy, cz);
      mesh.castShadow = true; mesh.receiveShadow = true;
      scene.add(mesh);
      if (solid !== false) {
        self.obstacles.push(new THREE.Box3().setFromObject(mesh));
        self.meshes.push(mesh);
      }
      return mesh;
    }

    // ---- 一楼墙（留门洞）----
    var sides = [
      { horiz: true, pos: -d / 2, len: w },
      { horiz: true, pos: d / 2, len: w },
      { horiz: false, pos: -w / 2, len: d },
      { horiz: false, pos: w / 2, len: d }
    ];
    for (var i = 0; i < sides.length; i++) {
      var s = sides[i];
      if (i === doorSide) {
        var segLen = (s.len - gap) / 2;
        var off = gap / 2 + segLen / 2;
        if (s.horiz) {
          addBox(x - off, h1 / 2, z + s.pos, segLen, h1, t, mat);
          addBox(x + off, h1 / 2, z + s.pos, segLen, h1, t, mat);
        } else {
          addBox(x + s.pos, h1 / 2, z - off, t, h1, segLen, mat);
          addBox(x + s.pos, h1 / 2, z + off, t, h1, segLen, mat);
        }
      } else {
        if (s.horiz) addBox(x, h1 / 2, z + s.pos, s.len, h1, t, mat);
        else addBox(x + s.pos, h1 / 2, z, t, h1, s.len, mat);
      }
    }

    // ---- 一楼门板（靠近自动打开）----
    var dw = gap - 0.2, dh = 4.4;
    if (doorSide === 0) this._makeDoor(scene, { px: x - gap / 2, pz: z - d / 2, base: 0, width: dw, height: dh });
    if (doorSide === 1) this._makeDoor(scene, { px: x - gap / 2, pz: z + d / 2, base: 0, width: dw, height: dh });
    if (doorSide === 2) this._makeDoor(scene, { px: x - w / 2, pz: z + gap / 2, base: Math.PI / 2, width: dw, height: dh });
    if (doorSide === 3) this._makeDoor(scene, { px: x + w / 2, pz: z - gap / 2, base: -Math.PI / 2, width: dw, height: dh });

    // ---- 二楼楼板：东侧留出 3.4m 宽的楼梯井 ----
    var stripW = 3.4;
    var stripMinX = iE - stripW;
    var slabW = stripMinX - iW;
    var slabCx = (iW + stripMinX) / 2;
    var slabD = iS - iN;
    addBox(slabCx, h1 + 0.15, (iN + iS) / 2, slabW, 0.3, slabD, slabMat, false);
    this.platforms.push({ minX: iW, maxX: stripMinX, minZ: iN, maxZ: iS, y: y2 });

    // ---- 楼梯（东侧，由南向北上升）----
    var stairBottomZ = iS - 1.0, stairTopZ = iN + 1.0;
    var stepN = 10, rise = y2 / stepN;
    var stepD = (stairBottomZ - stairTopZ) / stepN;
    var stairW = stripW - 0.5;
    var stairCx = (stripMinX + iE) / 2;
    for (var st = 0; st < stepN; st++) {
      var sz = stairBottomZ - stepD * (st + 0.5);
      var sh = rise * (st + 1);
      addBox(stairCx, sh / 2, sz, stairW, sh, stepD + 0.02, slabMat, false);
    }
    // 楼梯栏杆
    var railMat = new THREE.MeshLambertMaterial({ color: 0x3f4650 });
    addBox(stripMinX + 0.08, h1 / 2 + 1.1, (iN + iS) / 2, 0.12, 2.2, slabD, railMat, false);
    this.ramps.push({
      minX: stripMinX, maxX: iE, minZ: stairTopZ, maxZ: stairBottomZ,
      yLow: 0.25, yHigh: y2
    });

    // ---- 二楼外墙 ----
    addBox(x, y2 + h2 / 2, z - d / 2 + t / 2, w, h2, t, mat2);
    addBox(x, y2 + h2 / 2, z + d / 2 - t / 2, w, h2, t, mat2);
    addBox(x - w / 2 + t / 2, y2 + h2 / 2, z, t, h2, d, mat2);
    addBox(x + w / 2 - t / 2, y2 + h2 / 2, z, t, h2, d, mat2);
    // 二楼外沿栏板（楼梯井开口处）
    addBox(stairCx, y2 + 0.55, iS - 0.1, stairW + 1.2, 1.0, 0.25, railMat, false);

    // ---- 屋顶封板 + 外立面窗户（纯装饰，只做视觉体积）----
    addBox(x, y2 + h2 + 0.15, z, w + 0.6, 0.3, d + 0.6, slabMat, false);
    addBox(x, y2 + h2 - 0.1, z, w - 1.4, 0.2, d - 1.4, slabMat, false);
    var glassMat = new THREE.MeshLambertMaterial({ color: 0x33434f, emissive: 0x0b1a22 });
    var frameMat = new THREE.MeshLambertMaterial({ color: 0x3d444d });
    var oN = z - d / 2 - 0.33, oS = z + d / 2 + 0.33;
    var oW = x - w / 2 - 0.33, oE = x + w / 2 + 0.33;
    for (var wf = 0; wf < 2; wf++) {
      var wy = wf === 0 ? 2.9 : y2 + 2.2;
      var wz1 = z - d / 4, wz2 = z + d / 4;
      // 南北立面
      addBox(x - w / 4, wy, oN, 2.0, 1.4, 0.1, frameMat, false);
      addBox(x - w / 4, wy, oN - 0.03, 1.7, 1.1, 0.1, glassMat, false);
      addBox(x + w / 4, wy, oN, 2.0, 1.4, 0.1, frameMat, false);
      addBox(x + w / 4, wy, oN - 0.03, 1.7, 1.1, 0.1, glassMat, false);
      addBox(x - w / 4, wy, oS, 2.0, 1.4, 0.1, frameMat, false);
      addBox(x - w / 4, wy, oS + 0.03, 1.7, 1.1, 0.1, glassMat, false);
      addBox(x + w / 4, wy, oS, 2.0, 1.4, 0.1, frameMat, false);
      addBox(x + w / 4, wy, oS + 0.03, 1.7, 1.1, 0.1, glassMat, false);
      // 东西立面
      addBox(oW, wy, wz1, 0.1, 1.4, 2.0, frameMat, false);
      addBox(oW - 0.03, wy, wz1, 0.1, 1.1, 1.7, glassMat, false);
      addBox(oW, wy, wz2, 0.1, 1.4, 2.0, frameMat, false);
      addBox(oW - 0.03, wy, wz2, 0.1, 1.1, 1.7, glassMat, false);
      addBox(oE, wy, wz1, 0.1, 1.4, 2.0, frameMat, false);
      addBox(oE + 0.03, wy, wz1, 0.1, 1.1, 1.7, glassMat, false);
      addBox(oE, wy, wz2, 0.1, 1.4, 2.0, frameMat, false);
      addBox(oE + 0.03, wy, wz2, 0.1, 1.1, 1.7, glassMat, false);
    }

    // ---- 二楼锁定房间（西北角，需要房卡）----
    var roomW = Math.min(7.5, slabW - 2), roomD = Math.min(6, slabD - 2);
    var rMinX = iW + 0.3, rMaxX = rMinX + roomW;
    var rMinZ = iN + 0.3, rMaxZ = rMinZ + roomD;
    var roomH = 3;
    var lockMat = new THREE.MeshLambertMaterial({ color: 0x6d6250 });
    // 东墙整面
    addBox(rMaxX, y2 + roomH / 2, (rMinZ + rMaxZ) / 2, 0.4, roomH, roomD, lockMat);
    // 南墙留门洞
    var dg2 = 2.4, segW = (roomW - dg2) / 2;
    addBox(rMinX + segW / 2, y2 + roomH / 2, rMaxZ, segW, roomH, 0.4, lockMat);
    addBox(rMaxX - segW / 2, y2 + roomH / 2, rMaxZ, segW, roomH, 0.4, lockMat);
    // 锁门门板
    this._makeDoor(scene, {
      px: (rMinX + rMaxX) / 2 - dg2 / 2, pz: rMaxZ, base: 0,
      width: dg2 - 0.2, height: 2.8, y0: y2,
      locked: true, tier: lockTier, swing: 1.5
    });
    // 锁房内的桌子（装饰，不挡容器位）
    addBox((rMinX + rMaxX) / 2, y2 + 0.45, rMinZ + 0.9, 2.2, 0.9, 0.9,
      new THREE.MeshLambertMaterial({ color: 0x5a4a35 }));

    var roomBox = new THREE.Box3(
      new THREE.Vector3(rMinX, y2, rMinZ),
      new THREE.Vector3(rMaxX, y2 + roomH, rMaxZ)
    );
    this.lockedRooms.push({
      box: roomBox, tier: lockTier,
      cx: (rMinX + rMaxX) / 2, cz: (rMinZ + rMaxZ) / 2, y: y2,
      minX: rMinX, maxX: rMaxX, minZ: rMinZ, maxZ: rMaxZ
    });

    // ---- 内部装饰 ----
    this._decorate(scene, x, z, w, d, iW, iE, iN, iS, stripMinX, y2);

    // ---- 区域记录 ----
    var interior = new THREE.Box3(
      new THREE.Vector3(iW + 1.2, 0, iN + 1.2),
      new THREE.Vector3(Math.min(iE, stripMinX) - 1.2, h1, iS - 1.2)
    );
    var interior2 = new THREE.Box3(
      new THREE.Vector3(iW + 1.2, y2, iN + 1.2),
      new THREE.Vector3(stripMinX - 1.2, y2, iS - 1.2)
    );
    var foot = new THREE.Box3(
      new THREE.Vector3(x - w / 2 - 1, 0, z - d / 2 - 1),
      new THREE.Vector3(x + w / 2 + 1, y2 + h2, z + d / 2 + 1)
    );
    this.buildings.push({ x: x, z: z, w: w, d: d, foot: foot, interior: interior });
    this.interiors.push(interior);
    this.interiors2.push(interior2);
  },

  // 室内家具/灯/窗（纯装饰，少量可碰撞）
  _decorate: function (scene, x, z, w, d, iW, iE, iN, iS, stripMinX, y2) {
    var self = this;
    var woodMat = new THREE.MeshLambertMaterial({ color: 0x5e4a33 });
    var metalMat = new THREE.MeshLambertMaterial({ color: 0x4a525c });
    var crateMat = new THREE.MeshLambertMaterial({ color: 0x6d5738 });

    function box(cx, cy, cz, ww, hh, dd, mt, solid) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, dd), mt);
      m.position.set(cx, cy, cz);
      m.castShadow = true; m.receiveShadow = true;
      scene.add(m);
      if (solid) { self.obstacles.push(new THREE.Box3().setFromObject(m)); self.meshes.push(m); }
      return m;
    }

    // 一楼桌子 + 木箱
    var safeE = Math.min(iE, stripMinX) - 2;
    box(iW + 2.2, 0.48, (iN + iS) / 2 - 2.5, 1.8, 0.96, 0.9, woodMat, false);
    box(safeE - 1.2, 0.55, iN + 2.0, 1.1, 1.1, 1.1, crateMat, true);
    box(safeE - 1.2, 1.55, iN + 2.0, 0.9, 0.9, 0.9, crateMat, true);
    box(iW + 1.2, 1.0, (iN + iS) / 2 + 3.0, 0.5, 2.0, 2.4, metalMat, true);

    // 吊灯（暖色点光，每栋楼一个）
    var lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe0a0 })
    );
    lamp.position.set((iW + Math.min(iE, stripMinX)) / 2, 4.1, (iN + iS) / 2);
    scene.add(lamp);
    box(lamp.position.x, 4.45, lamp.position.z, 0.06, 0.7, 0.06, metalMat, false);
    var light = new THREE.PointLight(0xffcf8a, 0.55, 16, 2);
    light.position.set(lamp.position.x, 4.0, lamp.position.z);
    scene.add(light);

    // 一楼窗（薄板贴墙，微发光）
    var winMat = new THREE.MeshBasicMaterial({ color: 0x9fc3d8, transparent: true, opacity: 0.35 });
    for (var k = 0; k < 4; k++) {
      var wx = iW + 2 + k * ((iE - iW - 4) / 3);
      box(wx, 2.8, iN + 0.35, 1.8, 1.3, 0.06, winMat, false);
      box(wx, 2.8, iS - 0.35, 1.8, 1.3, 0.06, winMat, false);
    }

    // 二楼家具
    box((iW + stripMinX) / 2, y2 + 0.25, iS - 2.0, 2.0, 0.5, 0.8, woodMat, false);
    box(iW + 1.4, y2 + 0.55, iN + 3.0, 1.1, 1.1, 1.1, crateMat, true);
    // 屋顶空调箱
    box(x + w / 2 - 3, y2 + 4 + 0.45, z, 2.2, 0.9, 1.6, metalMat, false);
  },

  // 门：pivot 绕 Y 轴旋转，关门时占碰撞盒
  _makeDoor: function (scene, o) {
    var y0 = o.y0 || 0;
    var swing = o.swing === undefined ? -1.5 : o.swing;
    var mat = new THREE.MeshLambertMaterial({ color: o.locked ? 0x6f6038 : 0x6f5941 });
    var pivot = new THREE.Group();
    pivot.position.set(o.px, y0 + o.height / 2, o.pz);
    pivot.rotation.y = o.base;

    var leaf = new THREE.Mesh(new THREE.BoxGeometry(o.width, o.height, 0.14), mat);
    leaf.position.x = o.width / 2;
    leaf.castShadow = true; leaf.receiveShadow = true;
    pivot.add(leaf);
    scene.add(pivot);
    this.meshes.push(leaf);

    if (o.locked) {
      var goldMat = new THREE.MeshLambertMaterial({ color: 0xd9a520, emissive: 0x6a4c06 });
      var strip = new THREE.Mesh(new THREE.BoxGeometry(o.width * 0.6, 0.2, 0.18), goldMat);
      strip.position.set(0, o.height / 2 - 0.5, 0);
      leaf.add(strip);
    }

    // 关门状态的碰撞盒（沿门板方向展开）
    var dx = Math.cos(o.base), dz = -Math.sin(o.base);
    var x2 = o.px + dx * o.width, z2 = o.pz + dz * o.width;
    var box = new THREE.Box3(
      new THREE.Vector3(Math.min(o.px, x2) - 0.12, y0, Math.min(o.pz, z2) - 0.12),
      new THREE.Vector3(Math.max(o.px, x2) + 0.12, y0 + o.height, Math.max(o.pz, z2) + 0.12)
    );
    this.obstacles.push(box);

    this.doors.push({
      pivot: pivot, base: o.base, swing: swing, angle: 0, open: false,
      locked: !!o.locked, tier: o.tier || null, y0: y0, height: o.height,
      cx: (o.px + x2) / 2, cz: (o.pz + z2) / 2,
      box: box, savedMin: box.min.clone(), savedMax: box.max.clone()
    });
  },

  // 开门/关门时切换碰撞盒
  _applyDoorBox: function (dr) {
    if (dr.open) {
      dr.box.min.set(99999, 99999, 99999);
      dr.box.max.set(99999.1, 99999.1, 99999.1);
    } else {
      dr.box.min.copy(dr.savedMin);
      dr.box.max.copy(dr.savedMax);
    }
  },

  // 每帧更新门：普通门靠近自开、远离自关；返回附近尚未解锁的锁门
  updateDoors: function (dt, pos) {
    var U = GAME.Utils;
    var nearestLocked = null, best = 3.0;
    for (var i = 0; i < this.doors.length; i++) {
      var dr = this.doors[i];
      var dist = U.dist2D(pos, { x: dr.cx, z: dr.cz });
      if (Math.abs((pos.y || 0) - dr.y0) > 2.2) dist = 999;

      if (dr.locked) {
        if (dist < best) { best = dist; nearestLocked = dr; }
      } else if (dist < 2.7 && !dr.open) {
        dr.open = true; this._applyDoorBox(dr);
      } else if (dist > 3.4 && dr.open) {
        dr.open = false; this._applyDoorBox(dr);
      }

      var target = dr.open ? dr.swing : 0;
      dr.angle += (target - dr.angle) * Math.min(1, dt * 9);
      dr.pivot.rotation.y = dr.base + dr.angle;
    }
    return nearestLocked;
  },

  // 用房卡开锁门
  tryOpenDoor: function (dr, player) {
    if (!dr || !dr.locked) return false;
    if (!player.useCard(dr.tier)) return false;
    dr.locked = false;
    dr.open = true;
    this._applyDoorBox(dr);
    return true;
  },

  // 某坐标的地面高度（二楼楼板 / 楼梯斜坡取最高）
  // curY：只有高出当前脚下不超过 0.7m 的平面才算「可踩上去」，避免从一楼直接瞬移到二楼
  heightAt: function (x, z, curY) {
    if (curY === undefined) curY = Infinity;
    var U = GAME.Utils;
    var h = 0;
    for (var i = 0; i < this.platforms.length; i++) {
      var p = this.platforms[i];
      if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ &&
          p.y - curY <= 0.7 && p.y > h) h = p.y;
    }
    for (var j = 0; j < this.ramps.length; j++) {
      var r = this.ramps[j];
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
        var t = (r.maxZ - z) / (r.maxZ - r.minZ);
        var y = r.yLow + (r.yHigh - r.yLow) * U.clamp(t, 0, 1);
        if (y - curY <= 0.7 && y > h) h = y;
      }
    }
    return h;
  },

  _insideLockedRoom: function (x, z) {
    for (var i = 0; i < this.lockedRooms.length; i++) {
      var r = this.lockedRooms[i];
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) return true;
    }
    return false;
  },

  _insideAnyBuildingBox: function (box) {
    for (var i = 0; i < this.buildings.length; i++) {
      if (this.buildings[i].foot.intersectsBox(box)) return true;
    }
    return false;
  },

  _insideAnyBuilding: function (x, z) {
    for (var i = 0; i < this.buildings.length; i++) {
      var f = this.buildings[i].foot;
      if (x > f.min.x && x < f.max.x && z > f.min.z && z < f.max.z) return true;
    }
    return false;
  }
};
