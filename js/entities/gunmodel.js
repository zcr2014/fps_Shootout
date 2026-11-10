// ===== 枪械视图模型：按枪型分件建模 + 配件挂载 =====
// 参考《三角洲行动》：M4A1 / AK-12 / SCAR-H / MP5 / Vector / M700 / AWM / P92
// 全部用基础几何体拼装，不依赖外部图片；配色压暗，避免 ACES 曝光后发白。
// 细节件统一用一个 _detail 开关控制，低配设备可以关掉也不影响功能。
window.GAME = window.GAME || {};

GAME.GunModel = {
  detail: true,   // 是否生成额外细节件（螺丝、刻线、护圈等）

  // 一套材质（body 颜色按枪型传入）
  mats: function (color) {
    return {
      body:   new THREE.MeshLambertMaterial({ color: color || 0x121417 }), // 机匣主色
      poly:   new THREE.MeshLambertMaterial({ color: 0x08090a }),          // 聚合物黑
      metal:  new THREE.MeshLambertMaterial({ color: 0x171a1f }),          // 金属灰
      steel:  new THREE.MeshLambertMaterial({ color: 0x2b3138 }),          // 亮钢（小件）
      edge:   new THREE.MeshLambertMaterial({ color: 0x3c434b }),          // 高光棱线
      accent: new THREE.MeshLambertMaterial({ color: 0x2a3037 }),          // 高光件
      rubber: new THREE.MeshLambertMaterial({ color: 0x0a0b0c }),          // 橡胶托底/握把纹
      wood:   new THREE.MeshLambertMaterial({ color: 0x2a1a10 }),          // AK 木质护木
      wood2:  new THREE.MeshLambertMaterial({ color: 0x38230f }),          // 木纹亮条
      glass:  new THREE.MeshLambertMaterial({ color: 0x16283a, emissive: 0x0a1622 }),
      lens:   new THREE.MeshLambertMaterial({ color: 0x0d2233, emissive: 0x123a52 }), // 镜片
      dot:    new THREE.MeshBasicMaterial({ color: 0xff3b2f }),            // 红点
      sleeve: new THREE.MeshLambertMaterial({ color: 0x141a10 }),          // 迷彩袖
      glove:  new THREE.MeshLambertMaterial({ color: 0x08090b })           // 战术手套
    };
  },

  // ---------- 基础几何小工具 ----------
  _part: function (w, h, d, mat, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
  },

  // 圆柱，轴向 Z（默认沿枪管方向）
  _tube: function (r, len, mat, x, y, z, seg) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 12), mat);
    m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z);
    return m;
  },

  // 锥形圆柱，轴向 Z，rFront 朝枪口（-Z）
  _taper: function (rFront, rBack, len, mat, x, y, z, seg) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(rFront, rBack, len, seg || 14), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    return m;
  },

  // 圆柱，轴向 X（横销、调节钮）
  _tubeX: function (r, len, mat, x, y, z, seg) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 10), mat);
    m.rotation.z = Math.PI / 2;
    m.position.set(x, y, z);
    return m;
  },

  // 圆柱，轴向 Y（瞄具调节塔）
  _tubeY: function (r, len, mat, x, y, z, seg) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 10), mat);
    m.position.set(x, y, z);
    return m;
  },

  // 圆环，法线 Z（枪口环、镜筒环）
  _ringZ: function (r, tube, mat, x, y, z) {
    var m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 18), mat);
    m.position.set(x, y, z);
    return m;
  },

  // 圆环，法线 Y（握把防滑环）
  _ringY: function (r, tube, mat, x, y, z) {
    var m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 16), mat);
    m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z);
    return m;
  },

  _ball: function (r, mat, x, y, z, seg) {
    var m = new THREE.Mesh(new THREE.SphereGeometry(r, seg || 8, seg || 8), mat);
    m.position.set(x, y, z);
    return m;
  },

  // 皮卡汀尼导轨：底板 + 一排齿
  _rail: function (g, M, w, y, z0, z1, step) {
    g.add(this._part(w, 0.010, z1 - z0, M.metal, 0, y, (z0 + z1) / 2));
    if (!this.detail) return;
    for (var z = z0 + 0.014; z < z1 - 0.006; z += (step || 0.020)) {
      g.add(this._part(w, 0.006, 0.011, M.steel, 0, y + 0.007, z));
    }
  },

  // 扳机护圈 + 扳机
  _trigger: function (g, M, y, z) {
    var guard = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.004, 6, 14), M.metal);
    guard.rotation.y = Math.PI / 2;
    guard.scale.set(1, 0.92, 1);
    guard.position.set(0, y, z);
    g.add(guard);
    if (!this.detail) return;
    var t = this._part(0.006, 0.022, 0.008, M.steel, 0, y + 0.002, z);
    t.rotation.x = 0.22;
    g.add(t);
  },

  // 握把（含防滑纹与底盖）
  _pistolGrip: function (g, M, x, y, z, rot) {
    var grip = this._part(0.036, 0.13, 0.055, M.poly, x, y, z);
    grip.rotation.x = rot;
    if (this.detail) {
      for (var i = 0; i < 3; i++) {
        grip.add(this._part(0.038, 0.006, 0.038, M.rubber, 0, -0.040 + i * 0.030, -0.018));
      }
      grip.add(this._part(0.040, 0.010, 0.062, M.metal, 0, -0.062, 0));
    }
    g.add(grip);
    return grip;
  },

  // 弹匣（含侧筋与底板），返回弹匣网格
  _magazine: function (g, M, w, h, d, x, y, z, tilt) {
    var mag = this._part(w, h, d, M.poly, x, y, z);
    mag.rotation.x = tilt;
    if (this.detail) {
      mag.add(this._part(w + 0.003, 0.006, d + 0.003, M.steel, 0, h * 0.22, 0));
      mag.add(this._part(w + 0.003, 0.006, d + 0.003, M.steel, 0, -h * 0.16, 0));
      mag.add(this._part(w + 0.008, 0.012, d + 0.010, M.metal, 0, -h / 2 - 0.002, 0));
    }
    g.add(mag);
    return mag;
  },

  // def: 武器定义；opts: { attach:{scope,muzzle,grip,mag}, arms:true, detail:false }
  build: function (def, opts) {
    opts = opts || {};
    this.detail = opts.detail !== false;
    var M = opts.mats || this.mats(def && def.color);
    var g = new THREE.Group();
    var type = (def && def.model) || (def && def.slot === 'secondary' ? 'pistol' : 'ar');
    var anchor = null;

    if (type === 'pistol') anchor = this._pistol(g, M);
    else if (type === 'smg') anchor = this._smg(g, M);
    else if (type === 'vector') anchor = this._vector(g, M);
    else if (type === 'ak') anchor = this._ak(g, M);
    else if (type === 'br') anchor = this._br(g, M);
    else if (type === 'sniper') anchor = this._sniper(g, M);
    else anchor = this._ar(g, M);

    this._attachments(g, M, anchor, opts.attach || {});
    if (opts.arms !== false) g.add(this._arms(M, anchor, type === 'pistol'));
    if (type === 'pistol') g.scale.set(0.85, 0.85, 0.85);
    return g;
  },

  // ---------- 各枪型建模（返回配件挂点）----------
  // M4A1 型突击步枪
  _ar: function (g, M) {
    var i;
    // 上/下机匣与分模线
    g.add(this._part(0.068, 0.074, 0.30, M.body, 0, 0.016, -0.02));
    g.add(this._part(0.066, 0.034, 0.28, M.body, 0, -0.038, -0.02));
    g.add(this._part(0.070, 0.004, 0.30, M.edge, 0, -0.019, -0.02));
    // 顶部皮卡汀尼导轨
    this._rail(g, M, 0.040, 0.057, -0.185, 0.115, 0.022);
    // 抛壳口 + 抛壳挡板 + 辅助推机柄
    g.add(this._part(0.005, 0.030, 0.072, M.steel, 0.035, 0.018, -0.035));
    var deflector = this._part(0.010, 0.026, 0.032, M.metal, 0.040, 0.010, 0.018);
    deflector.rotation.z = 0.42;
    g.add(deflector);
    g.add(this._tubeX(0.008, 0.014, M.steel, 0.040, 0.031, 0.052));
    // 拉机柄 + 锁扣
    g.add(this._part(0.030, 0.014, 0.05, M.metal, 0.046, 0.038, -0.065));
    g.add(this._part(0.014, 0.010, 0.016, M.steel, 0.046, 0.038, -0.096));
    // 快慢机 / 空仓挂机 / 弹匣释放
    g.add(this._tubeX(0.007, 0.012, M.steel, 0.038, -0.020, 0.056));
    g.add(this._part(0.005, 0.016, 0.024, M.steel, -0.036, -0.010, 0.020));
    g.add(this._part(0.010, 0.012, 0.014, M.steel, 0.034, -0.031, 0.008));
    // 扳机组
    this._trigger(g, M, -0.070, 0.056);
    // 护木：主体 + 两侧 M-LOK 槽 + 底部短轨
    g.add(this._part(0.062, 0.074, 0.24, M.body, 0, 0, -0.295));
    for (i = 0; i < 3; i++) {
      g.add(this._part(0.004, 0.018, 0.030, M.poly, 0.032, -0.002, -0.235 - i * 0.058));
      g.add(this._part(0.004, 0.018, 0.030, M.poly, -0.032, -0.002, -0.235 - i * 0.058));
      g.add(this._part(0.030, 0.004, 0.030, M.poly, 0, -0.039, -0.235 - i * 0.058));
    }
    for (i = 0; i < 4; i++) {
      g.add(this._part(0.066, 0.012, 0.010, M.poly, 0, 0.010, -0.385 + i * 0.055));
      g.add(this._part(0.008, 0.016, 0.016, M.metal, 0.033, -0.012, -0.385 + i * 0.055));
    }
    g.add(this._part(0.030, 0.008, 0.170, M.metal, 0, -0.042, -0.300));
    for (i = 0; i < 4; i++) g.add(this._part(0.026, 0.005, 0.010, M.steel, 0, -0.047, -0.360 + i * 0.040));
    // 枪管 + 枪管螺母 + 导气箍 + 导气管
    g.add(this._tube(0.013, 0.24, M.metal, 0, 0.024, -0.53));
    g.add(this._ringZ(0.024, 0.005, M.steel, 0, 0.024, -0.208));
    g.add(this._part(0.030, 0.028, 0.030, M.metal, 0, 0.036, -0.44));
    g.add(this._tube(0.006, 0.16, M.steel, 0, 0.043, -0.360));
    g.add(this._tube(0.020, 0.058, M.metal, 0, 0.024, -0.665));
    g.add(this._ringZ(0.021, 0.004, M.steel, 0, 0.024, -0.638));
    // 准星：支柱 + 两侧护翼
    g.add(this._part(0.008, 0.048, 0.008, M.metal, 0, 0.060, -0.420));
    g.add(this._part(0.005, 0.042, 0.010, M.metal, 0.013, 0.060, -0.420));
    g.add(this._part(0.005, 0.042, 0.010, M.metal, -0.013, 0.060, -0.420));
    // 弹匣井 + 弹匣
    g.add(this._part(0.052, 0.05, 0.10, M.body, 0, -0.072, -0.03));
    g.add(this._part(0.058, 0.012, 0.104, M.metal, 0, -0.094, -0.03));
    this._magazine(g, M, 0.044, 0.16, 0.082, 0, -0.150, -0.005, 0.16);
    // 握把 + 缓冲管 + 伸缩枪托
    this._pistolGrip(g, M, 0, -0.105, 0.095, -0.32);
    g.add(this._tube(0.018, 0.12, M.metal, 0, -0.012, 0.20));
    g.add(this._ringZ(0.019, 0.004, M.steel, 0, -0.012, 0.148));
    g.add(this._part(0.044, 0.070, 0.14, M.body, 0, -0.010, 0.26));
    g.add(this._part(0.050, 0.100, 0.018, M.poly, 0, -0.012, 0.342));
    g.add(this._part(0.046, 0.022, 0.014, M.rubber, 0, -0.012, 0.353));
    g.add(this._part(0.030, 0.014, 0.10, M.body, 0, 0.032, 0.245));
    // 背带环
    g.add(this._ringY(0.010, 0.003, M.steel, 0, -0.050, 0.330));
    return { railY: 0.078, railZ: -0.04, muzzleY: 0.024, muzzleZ: -0.695,
             underY: -0.042, underZ: -0.30, magBottomY: -0.235, magZ: -0.005,
             extW: 0.044, extD: 0.082, magTilt: 0.16 };
  },

  // AK-12：木质护木 + 弯弹匣 + 侧翻枪托
  _ak: function (g, M) {
    var i;
    // 机匣 + 机匣盖
    g.add(this._part(0.070, 0.086, 0.32, M.body, 0, 0.010, -0.02));
    g.add(this._part(0.066, 0.030, 0.32, M.body, 0, -0.046, -0.02));
    g.add(this._part(0.056, 0.022, 0.30, M.metal, 0, 0.064, -0.03));
    for (i = 0; i < 4; i++) g.add(this._part(0.040, 0.006, 0.010, M.poly, 0, 0.077, -0.13 + i * 0.055));
    this._rail(g, M, 0.038, 0.080, -0.160, 0.100, 0.021);
    // 抛壳口 + 拉机柄 + 快慢机
    g.add(this._part(0.005, 0.026, 0.070, M.steel, 0.036, 0.016, -0.030));
    g.add(this._part(0.022, 0.012, 0.040, M.metal, 0.046, 0.030, -0.070));
    g.add(this._part(0.006, 0.014, 0.090, M.steel, 0.038, -0.004, 0.020));
    // 木护木（含木纹亮条）+ 上护木 + 导气管
    g.add(this._part(0.064, 0.070, 0.20, M.wood, 0, -0.004, -0.290));
    for (i = 0; i < 3; i++) {
      g.add(this._part(0.003, 0.052, 0.170, M.wood2, 0.033, -0.004, -0.290));
      g.add(this._part(0.003, 0.052, 0.170, M.wood2, -0.033, -0.004, -0.290));
    }
    g.add(this._part(0.048, 0.028, 0.170, M.wood, 0, 0.042, -0.290));
    g.add(this._part(0.040, 0.030, 0.18, M.metal, 0, 0.010, -0.290));
    // 枪管 + 制退器 + 准星
    g.add(this._tube(0.014, 0.22, M.metal, 0, 0.026, -0.50));
    g.add(this._tube(0.022, 0.062, M.metal, 0, 0.026, -0.655));
    g.add(this._part(0.046, 0.006, 0.014, M.poly, 0, 0.043, -0.648));
    g.add(this._part(0.046, 0.006, 0.014, M.poly, 0, 0.043, -0.628));
    g.add(this._part(0.010, 0.056, 0.010, M.metal, 0, 0.070, -0.400));
    g.add(this._part(0.005, 0.048, 0.010, M.metal, 0.014, 0.070, -0.400));
    g.add(this._part(0.005, 0.048, 0.010, M.metal, -0.014, 0.070, -0.400));
    // 表尺座
    g.add(this._part(0.030, 0.016, 0.036, M.steel, 0, 0.070, -0.140));
    // 弯弹匣：两段折角
    g.add(this._part(0.052, 0.05, 0.10, M.body, 0, -0.075, -0.02));
    var m1 = this._part(0.044, 0.13, 0.078, M.poly, 0, -0.145, -0.005);
    m1.rotation.x = 0.14;
    m1.add(this._part(0.047, 0.006, 0.081, M.steel, 0, 0.030, 0));
    m1.add(this._part(0.047, 0.006, 0.081, M.steel, 0, -0.020, 0));
    g.add(m1);
    var m2 = this._part(0.042, 0.12, 0.072, M.poly, 0, -0.235, 0.022);
    m2.rotation.x = 0.34;
    m2.add(this._part(0.045, 0.008, 0.076, M.metal, 0, -0.056, 0));
    g.add(m2);
    // 握把 + 扳机组
    this._pistolGrip(g, M, 0, -0.105, 0.100, -0.30);
    this._trigger(g, M, -0.070, 0.058);
    // 折叠枪托
    g.add(this._tubeX(0.014, 0.020, M.steel, 0, -0.008, 0.180));
    g.add(this._part(0.042, 0.060, 0.20, M.body, 0, -0.008, 0.250));
    g.add(this._part(0.052, 0.092, 0.022, M.poly, 0, -0.010, 0.360));
    g.add(this._part(0.048, 0.020, 0.016, M.rubber, 0, -0.010, 0.371));
    g.add(this._part(0.026, 0.028, 0.07, M.metal, 0, 0.034, 0.160));
    g.add(this._ringY(0.010, 0.003, M.steel, 0, -0.052, 0.330));
    return { railY: 0.080, railZ: -0.04, muzzleY: 0.026, muzzleZ: -0.69,
             underY: -0.040, underZ: -0.29, magBottomY: -0.295, magZ: 0.005,
             extW: 0.042, extD: 0.074, magTilt: 0.30 };
  },

  // MP5：短护木 + 直弹匣 + 伸缩托
  _smg: function (g, M) {
    var i;
    // 机匣 + 上盖 + 抛壳口
    g.add(this._part(0.060, 0.095, 0.26, M.body, 0, 0, -0.02));
    g.add(this._part(0.050, 0.022, 0.20, M.metal, 0, 0.062, -0.03));
    g.add(this._part(0.005, 0.028, 0.070, M.steel, 0.031, 0.010, -0.030));
    // 拉机柄管 + 拉机柄
    g.add(this._tube(0.014, 0.16, M.metal, 0.0, 0.045, -0.250));
    g.add(this._part(0.020, 0.018, 0.024, M.steel, 0.030, 0.050, -0.300));
    // 圆护木 + 防滑环
    g.add(this._tube(0.030, 0.14, M.body, 0, 0.028, -0.210));
    for (i = 0; i < 4; i++) g.add(this._ringZ(0.030, 0.003, M.steel, 0, 0.028, -0.156 - i * 0.038));
    for (i = 0; i < 3; i++) g.add(this._part(0.004, 0.014, 0.030, M.poly, 0.030, 0.010, -0.170 - i * 0.040));
    // 枪管 + 枪口 + 准星护圈
    g.add(this._tube(0.012, 0.10, M.metal, 0, 0.020, -0.390));
    g.add(this._tube(0.018, 0.040, M.metal, 0, 0.020, -0.455));
    g.add(this._ringZ(0.024, 0.004, M.steel, 0, 0.020, -0.440));
    g.add(this._ringZ(0.020, 0.004, M.metal, 0, 0.052, -0.240));
    g.add(this._part(0.006, 0.036, 0.006, M.steel, 0, 0.052, -0.240));
    // 后照门鼓轮
    g.add(this._tubeX(0.014, 0.030, M.metal, 0, 0.074, -0.110));
    g.add(this._part(0.008, 0.010, 0.008, M.steel, 0, 0.074, -0.126));
    // 直弹匣
    g.add(this._part(0.048, 0.05, 0.09, M.body, 0, -0.070, -0.01));
    var mag = this._part(0.036, 0.185, 0.066, M.poly, 0, -0.155, -0.005);
    mag.rotation.x = 0.06;
    mag.add(this._part(0.039, 0.006, 0.069, M.steel, 0, 0.040, 0));
    mag.add(this._part(0.039, 0.006, 0.069, M.steel, 0, -0.030, 0));
    g.add(mag);
    // 握把 + 扳机组
    this._pistolGrip(g, M, 0, -0.100, 0.100, -0.30);
    this._trigger(g, M, -0.066, 0.050);
    g.add(this._tubeX(0.007, 0.012, M.steel, 0.032, -0.024, 0.056));
    // 伸缩枪托：双杆 + 托板 + 调节孔
    g.add(this._tube(0.010, 0.16, M.metal, -0.020, 0.000, 0.200));
    g.add(this._tube(0.010, 0.16, M.metal, 0.020, 0.000, 0.200));
    g.add(this._part(0.100, 0.070, 0.018, M.poly, 0, -0.005, 0.290));
    g.add(this._part(0.092, 0.020, 0.014, M.rubber, 0, -0.005, 0.300));
    g.add(this._part(0.070, 0.044, 0.010, M.metal, 0, -0.005, 0.196));
    g.add(this._ringY(0.010, 0.003, M.steel, 0, -0.045, 0.278));
    return { railY: 0.074, railZ: -0.03, muzzleY: 0.020, muzzleZ: -0.475,
             underY: -0.030, underZ: -0.21, magBottomY: -0.250, magZ: -0.005,
             extW: 0.036, extD: 0.066, magTilt: 0.06 };
  },

  // Vector：方盒机匣 + 长弹匣 + 折叠托
  _vector: function (g, M) {
    var i;
    // 高机匣 + 侧板棱线
    g.add(this._part(0.062, 0.125, 0.24, M.body, 0, 0.005, -0.03));
    g.add(this._part(0.066, 0.010, 0.232, M.edge, 0, 0.058, -0.03));
    g.add(this._part(0.004, 0.070, 0.200, M.accent, 0.033, -0.005, -0.03));
    g.add(this._part(0.004, 0.070, 0.200, M.accent, -0.033, -0.005, -0.03));
    this._rail(g, M, 0.038, 0.080, -0.150, 0.090, 0.020);
    // 抛壳口 + 拉机柄
    g.add(this._part(0.005, 0.024, 0.060, M.steel, 0.032, 0.030, -0.040));
    g.add(this._part(0.018, 0.012, 0.034, M.metal, 0.042, 0.044, -0.085));
    // 前段 + 侧轨
    g.add(this._part(0.050, 0.070, 0.12, M.body, 0, 0.000, -0.200));
    for (i = 0; i < 3; i++) {
      g.add(this._part(0.004, 0.014, 0.024, M.steel, 0.027, 0.010, -0.240 + i * 0.036));
      g.add(this._part(0.004, 0.014, 0.024, M.steel, -0.027, 0.010, -0.240 + i * 0.036));
    }
    // 枪管 + 枪口螺纹
    g.add(this._tube(0.014, 0.12, M.metal, 0, 0.020, -0.300));
    g.add(this._tube(0.020, 0.040, M.metal, 0, 0.020, -0.375));
    g.add(this._ringZ(0.021, 0.004, M.steel, 0, 0.020, -0.356));
    // 原厂三角前握把
    var fg = this._part(0.034, 0.085, 0.040, M.poly, 0, -0.075, -0.200);
    fg.rotation.x = 0.30;
    fg.add(this._part(0.036, 0.006, 0.042, M.rubber, 0, 0.020, 0));
    g.add(fg);
    // 长直弹匣
    g.add(this._part(0.050, 0.05, 0.09, M.body, 0, -0.080, -0.03));
    var mag = this._part(0.040, 0.21, 0.070, M.poly, 0, -0.175, -0.03);
    mag.rotation.x = 0.04;
    mag.add(this._part(0.043, 0.006, 0.073, M.steel, 0, 0.045, 0));
    mag.add(this._part(0.043, 0.006, 0.073, M.steel, 0, -0.030, 0));
    mag.add(this._part(0.046, 0.012, 0.076, M.metal, 0, -0.102, 0));
    g.add(mag);
    // 握把 + 扳机组
    this._pistolGrip(g, M, 0, -0.100, 0.090, -0.28);
    this._trigger(g, M, -0.064, 0.045);
    g.add(this._tubeX(0.007, 0.012, M.steel, 0.032, -0.020, 0.050));
    // Super V 后坐缓解块
    g.add(this._part(0.048, 0.026, 0.070, M.accent, 0, -0.070, 0.130));
    g.add(this._part(0.044, 0.060, 0.030, M.body, 0, -0.040, 0.155));
    // 折叠托：铰链 + 托杆 + 托板
    g.add(this._tubeX(0.012, 0.018, M.steel, 0, 0.045, 0.170));
    g.add(this._part(0.034, 0.030, 0.16, M.metal, 0, 0.045, 0.160));
    g.add(this._part(0.044, 0.080, 0.018, M.poly, 0, 0.030, 0.240));
    g.add(this._part(0.040, 0.024, 0.014, M.rubber, 0, 0.030, 0.250));
    return { railY: 0.088, railZ: -0.03, muzzleY: 0.020, muzzleZ: -0.395,
             underY: -0.045, underZ: -0.20, magBottomY: -0.285, magZ: -0.03,
             extW: 0.040, extD: 0.070, magTilt: 0.04 };
  },

  // SCAR-H：长机匣 + 大弹匣 + 侧折托
  _br: function (g, M) {
    var i;
    // 上/下机匣
    g.add(this._part(0.074, 0.080, 0.34, M.body, 0, 0.012, -0.02));
    g.add(this._part(0.070, 0.034, 0.30, M.body, 0, -0.042, -0.02));
    g.add(this._part(0.076, 0.004, 0.34, M.edge, 0, -0.023, -0.02));
    this._rail(g, M, 0.044, 0.060, -0.200, 0.120, 0.022);
    // 侧拉机柄（SCAR 标志性）
    g.add(this._part(0.010, 0.016, 0.120, M.metal, 0.046, 0.030, 0.000));
    g.add(this._tubeX(0.010, 0.016, M.steel, 0.054, 0.030, -0.055));
    // 抛壳口 + 导气调节
    g.add(this._part(0.005, 0.026, 0.070, M.steel, 0.037, 0.012, -0.045));
    g.add(this._tubeX(0.012, 0.014, M.steel, 0.036, 0.028, -0.400));
    g.add(this._part(0.014, 0.010, 0.014, M.accent, 0.048, 0.028, -0.400));
    // 护木 + 侧导轨
    g.add(this._part(0.066, 0.080, 0.26, M.body, 0, 0, -0.320));
    for (i = 0; i < 4; i++) {
      g.add(this._part(0.006, 0.018, 0.030, M.poly, 0.034, -0.004, -0.250 - i * 0.058));
      g.add(this._part(0.006, 0.018, 0.030, M.poly, -0.034, -0.004, -0.250 - i * 0.058));
    }
    for (i = 0; i < 4; i++) g.add(this._part(0.070, 0.012, 0.014, M.poly, 0, 0.000, -0.430 + i * 0.060));
    g.add(this._part(0.030, 0.008, 0.180, M.metal, 0, -0.046, -0.330));
    // 枪管 + 制退器
    g.add(this._tube(0.014, 0.30, M.metal, 0, 0.024, -0.600));
    g.add(this._tube(0.022, 0.066, M.metal, 0, 0.024, -0.765));
    g.add(this._part(0.048, 0.006, 0.014, M.poly, 0, 0.042, -0.758));
    g.add(this._part(0.048, 0.006, 0.014, M.poly, 0, 0.042, -0.736));
    g.add(this._ringZ(0.023, 0.005, M.steel, 0, 0.024, -0.726));
    // 准星
    g.add(this._part(0.010, 0.050, 0.010, M.metal, 0, 0.064, -0.470));
    g.add(this._part(0.005, 0.044, 0.010, M.metal, 0.014, 0.064, -0.470));
    g.add(this._part(0.005, 0.044, 0.010, M.metal, -0.014, 0.064, -0.470));
    // 大弹匣
    g.add(this._part(0.056, 0.05, 0.11, M.body, 0, -0.075, -0.02));
    this._magazine(g, M, 0.048, 0.18, 0.090, 0, -0.160, -0.005, 0.16);
    // 握把 + 扳机组
    this._pistolGrip(g, M, 0, -0.108, 0.100, -0.32);
    this._trigger(g, M, -0.072, 0.060);
    // 侧折枪托 + 贴腮板 + 托底
    g.add(this._tubeX(0.014, 0.020, M.steel, 0, -0.005, 0.180));
    g.add(this._part(0.046, 0.070, 0.16, M.body, 0, -0.005, 0.250));
    g.add(this._part(0.056, 0.100, 0.020, M.poly, 0, -0.008, 0.340));
    g.add(this._part(0.052, 0.022, 0.014, M.rubber, 0, -0.008, 0.351));
    g.add(this._part(0.048, 0.020, 0.110, M.accent, 0, 0.040, 0.270));
    g.add(this._tubeX(0.006, 0.010, M.steel, 0.026, 0.048, 0.300));
    g.add(this._ringY(0.010, 0.003, M.steel, 0, -0.050, 0.320));
    return { railY: 0.086, railZ: -0.04, muzzleY: 0.024, muzzleZ: -0.80,
             underY: -0.045, underZ: -0.33, magBottomY: -0.255, magZ: -0.005,
             extW: 0.048, extD: 0.090, magTilt: 0.16 };
  },

  // M700 / AWM：长枪管 + 枪机 + 底盘枪托 + 折叠两脚架
  _sniper: function (g, M) {
    var i;
    // 机匣 + 顶部导轨座
    g.add(this._part(0.062, 0.100, 0.36, M.body, 0, 0, -0.02));
    g.add(this._part(0.056, 0.014, 0.30, M.metal, 0, 0.060, -0.04));
    for (i = 0; i < 5; i++) g.add(this._part(0.058, 0.008, 0.010, M.steel, 0, 0.071, -0.150 + i * 0.048));
    // 加长枪管 + 枪管环 + 枪口制退
    g.add(this._tube(0.015, 0.50, M.metal, 0, 0.022, -0.50));
    g.add(this._ringZ(0.016, 0.003, M.steel, 0, 0.022, -0.330));
    g.add(this._ringZ(0.016, 0.003, M.steel, 0, 0.022, -0.470));
    g.add(this._tube(0.019, 0.020, M.metal, 0, 0.022, -0.760));
    g.add(this._tube(0.024, 0.070, M.metal, 0, 0.022, -0.800));
    g.add(this._part(0.048, 0.006, 0.016, M.poly, 0, 0.040, -0.792));
    g.add(this._part(0.048, 0.006, 0.016, M.poly, 0, 0.040, -0.772));
    // 枪机 + 拉机柄 + 球头
    g.add(this._tubeX(0.014, 0.070, M.accent, 0.040, 0.010, 0.020));
    var bolt = this._part(0.058, 0.012, 0.012, M.accent, 0.058, 0.004, 0.030);
    bolt.rotation.z = -0.20;
    g.add(bolt);
    g.add(this._ball(0.014, M.steel, 0.080, -0.004, 0.032));
    // 抛壳口 + 保险
    g.add(this._part(0.005, 0.020, 0.060, M.steel, 0.032, 0.014, -0.030));
    g.add(this._tubeX(0.008, 0.012, M.steel, 0.034, -0.012, 0.070));
    // 护木 / 前托 + 下方导轨
    g.add(this._part(0.058, 0.070, 0.30, M.body, 0, -0.005, -0.38));
    g.add(this._part(0.008, 0.022, 0.28, M.metal, 0, 0.036, -0.38));
    g.add(this._part(0.026, 0.008, 0.150, M.metal, 0, -0.042, -0.380));
    // 弹匣 + 底板
    g.add(this._part(0.050, 0.05, 0.08, M.body, 0, -0.070, -0.01));
    this._magazine(g, M, 0.042, 0.11, 0.070, 0, -0.115, -0.01, 0.10);
    // 握把 + 扳机组
    this._pistolGrip(g, M, 0, -0.100, 0.100, -0.30);
    this._trigger(g, M, -0.066, 0.055);
    // 底盘枪托 + 可调贴腮板 + 托底
    g.add(this._part(0.050, 0.075, 0.28, M.body, 0, -0.015, 0.270));
    g.add(this._part(0.060, 0.110, 0.022, M.poly, 0, -0.020, 0.410));
    g.add(this._part(0.056, 0.024, 0.016, M.rubber, 0, -0.020, 0.422));
    g.add(this._part(0.052, 0.030, 0.10, M.poly, 0, 0.050, 0.280));
    g.add(this._tubeX(0.005, 0.008, M.steel, 0.026, 0.036, 0.300));
    g.add(this._tubeX(0.005, 0.008, M.steel, -0.026, 0.036, 0.300));
    // 折叠两脚架：铰链 + 双腿 + 脚垫
    g.add(this._tubeX(0.010, 0.070, M.steel, 0, -0.040, -0.420));
    g.add(this._part(0.012, 0.090, 0.012, M.metal, -0.026, -0.085, -0.420));
    g.add(this._part(0.012, 0.090, 0.012, M.metal, 0.026, -0.085, -0.420));
    g.add(this._part(0.022, 0.010, 0.026, M.rubber, -0.026, -0.130, -0.420));
    g.add(this._part(0.022, 0.010, 0.026, M.rubber, 0.026, -0.130, -0.420));
    g.add(this._ringY(0.009, 0.003, M.steel, 0, -0.060, 0.390));
    return { railY: 0.090, railZ: -0.02, muzzleY: 0.022, muzzleZ: -0.835,
             underY: -0.045, underZ: -0.42, magBottomY: -0.180, magZ: -0.01,
             extW: 0.042, extD: 0.070, magTilt: 0.10 };
  },

  // P92 手枪
  _pistol: function (g, M) {
    var i;
    // 套筒 + 防滑刻线（前后两段）
    g.add(this._part(0.050, 0.062, 0.20, M.body, 0, 0.010, -0.04));
    g.add(this._part(0.026, 0.010, 0.090, M.metal, 0, 0.045, -0.010));
    for (i = 0; i < 5; i++) {
      g.add(this._part(0.006, 0.030, 0.005, M.steel, 0.024, 0.010, 0.020 + i * 0.016));
      g.add(this._part(0.006, 0.030, 0.005, M.steel, -0.024, 0.010, 0.020 + i * 0.016));
    }
    for (i = 0; i < 3; i++) {
      g.add(this._part(0.006, 0.026, 0.004, M.steel, 0.024, 0.010, -0.120 + i * 0.014));
      g.add(this._part(0.006, 0.026, 0.004, M.steel, -0.024, 0.010, -0.120 + i * 0.014));
    }
    // 枪身 + 防尘盖 + 附件导轨
    g.add(this._part(0.045, 0.030, 0.16, M.metal, 0, -0.040, -0.04));
    g.add(this._part(0.042, 0.006, 0.14, M.edge, 0, -0.026, -0.04));
    g.add(this._part(0.026, 0.008, 0.080, M.metal, 0, -0.055, -0.095));
    for (i = 0; i < 3; i++) g.add(this._part(0.022, 0.005, 0.008, M.poly, 0, -0.059, -0.120 + i * 0.026));
    // 枪管 + 枪口冠
    g.add(this._tube(0.012, 0.05, M.metal, 0, 0.010, -0.155));
    g.add(this._ringZ(0.012, 0.003, M.steel, 0, 0.010, -0.178));
    // 准星 + 照门（缺口）
    g.add(this._part(0.006, 0.012, 0.008, M.steel, 0, 0.042, -0.130));
    g.add(this._part(0.002, 0.003, 0.002, M.accent, 0, 0.047, -0.130));
    g.add(this._part(0.008, 0.012, 0.008, M.steel, -0.014, 0.043, 0.030));
    g.add(this._part(0.008, 0.012, 0.008, M.steel, 0.014, 0.043, 0.030));
    // 击锤 + 套筒座/分解杆/空仓挂机
    var hammer = this._part(0.014, 0.022, 0.010, M.steel, 0, 0.036, 0.048);
    hammer.rotation.x = -0.35;
    g.add(hammer);
    g.add(this._tubeX(0.006, 0.010, M.steel, 0.026, -0.038, 0.010));
    g.add(this._part(0.005, 0.010, 0.030, M.steel, -0.026, -0.024, -0.020));
    g.add(this._part(0.012, 0.012, 0.010, M.steel, 0.024, -0.026, 0.020));
    // 握把 + 防滑纹 + 弹匣底板
    var grip = this._part(0.042, 0.110, 0.05, M.poly, 0, -0.100, 0.030);
    grip.rotation.x = -0.22;
    for (i = 0; i < 3; i++) grip.add(this._part(0.045, 0.005, 0.032, M.rubber, 0, -0.020 + i * 0.026, 0.010));
    g.add(grip);
    g.add(this._part(0.044, 0.012, 0.052, M.metal, 0, -0.152, 0.045));
    // 扳机护圈 + 扳机
    var guard = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.004, 6, 14), M.metal);
    guard.rotation.y = Math.PI / 2;
    guard.scale.set(1, 0.9, 1);
    guard.position.set(0, -0.058, 0.035);
    g.add(guard);
    g.add(this._part(0.006, 0.020, 0.007, M.steel, 0, -0.052, 0.032));
    return { railY: 0.050, railZ: 0.02, muzzleY: 0.010, muzzleZ: -0.180,
             underY: -0.030, underZ: -0.10, magBottomY: -0.160, magZ: 0.030,
             extW: 0.042, extD: 0.050, magTilt: 0 };
  },

  // ---------- 配件挂载 ----------
  _attachments: function (g, M, a, attach) {
    if (!a) return;
    if (attach.scope) this._scope(g, M, a, attach.scope);
    if (attach.muzzle) this._muzzle(g, M, a, attach.muzzle);
    if (attach.grip) this._grip(g, M, a, attach.grip);
    if (attach.mag) this._magExt(g, M, a, attach.mag);
  },

  // 瞄具：红点 / 全息 / 3 倍 / 8 倍
  _scope: function (g, M, a, id) {
    var y = a.railY, z = a.railZ;
    // 通用一体式底座 + 侧向锁紧扳手
    g.add(this._part(0.040, 0.014, 0.078, M.metal, 0, y + 0.007, z));
    g.add(this._tubeX(0.007, 0.016, M.steel, 0.026, y + 0.007, z));
    g.add(this._part(0.010, 0.020, 0.012, M.steel, 0.036, y + 0.001, z));

    if (id === 'scope_red') {
      // 红点：镜筒 + 前后镜圈 + 物镜 + 红点 + 调节钮
      g.add(this._tube(0.021, 0.062, M.poly, 0, y + 0.042, z));
      g.add(this._ringZ(0.022, 0.004, M.metal, 0, y + 0.042, z - 0.030));
      g.add(this._ringZ(0.022, 0.004, M.metal, 0, y + 0.042, z + 0.030));
      g.add(this._tube(0.019, 0.004, M.lens, 0, y + 0.042, z - 0.033));
      g.add(this._part(0.004, 0.004, 0.002, M.dot, 0, y + 0.042, z - 0.036));
      // 电池仓 + 亮度钮
      g.add(this._part(0.022, 0.016, 0.026, M.poly, 0, y + 0.024, z + 0.018));
      g.add(this._tubeX(0.007, 0.010, M.steel, 0.020, y + 0.042, z + 0.002));
      g.add(this._tubeX(0.005, 0.010, M.steel, -0.020, y + 0.042, z + 0.002));
    } else if (id === 'scope_holo') {
      // 全息：方形遮光罩 + 镜片 + 环形分划 + 按键
      g.add(this._part(0.048, 0.014, 0.070, M.poly, 0, y + 0.024, z));
      g.add(this._part(0.048, 0.008, 0.008, M.metal, 0, y + 0.064, z - 0.032));
      g.add(this._part(0.008, 0.048, 0.008, M.metal, 0.020, y + 0.042, z - 0.032));
      g.add(this._part(0.008, 0.048, 0.008, M.metal, -0.020, y + 0.042, z - 0.032));
      g.add(this._part(0.038, 0.040, 0.003, M.lens, 0, y + 0.042, z - 0.034));
      g.add(this._ringZ(0.014, 0.0015, M.dot, 0, y + 0.042, z - 0.036));
      g.add(this._part(0.004, 0.004, 0.002, M.dot, 0, y + 0.042, z - 0.036));
      g.add(this._part(0.016, 0.010, 0.012, M.steel, 0.020, y + 0.030, z + 0.004));
    } else {
      // 3x / 8x 高倍镜：物镜喇叭口 + 目镜 + 调节塔 + 变倍环 + 双镜环
      var long = id === 'scope_8x';
      var len = long ? 0.220 : 0.160;
      var r = long ? 0.030 : 0.027;
      var cy = y + 0.048;
      g.add(this._tube(r, len, M.poly, 0, cy, z));
      g.add(this._taper(r + 0.008, r, 0.040, M.metal, 0, cy, z - len / 2 - 0.010));
      g.add(this._ringZ(r + 0.009, 0.004, M.steel, 0, cy, z - len / 2 - 0.028));
      g.add(this._tube(r + 0.005, 0.004, M.lens, 0, cy, z - len / 2 - 0.030));
      g.add(this._taper(r + 0.005, r + 0.001, 0.036, M.metal, 0, cy, z + len / 2 + 0.008));
      g.add(this._ringZ(r + 0.006, 0.004, M.steel, 0, cy, z + len / 2 + 0.024));
      // 调节塔（顶部高低 + 右侧风偏）
      g.add(this._tubeY(0.012, 0.020, M.metal, 0, cy + r + 0.010, z));
      g.add(this._ringY(0.012, 0.003, M.steel, 0, cy + r + 0.019, z));
      g.add(this._tubeX(0.012, 0.020, M.metal, 0.024, cy, z - 0.006));
      // 变倍环
      g.add(this._ringZ(r + 0.005, 0.005, M.metal, 0, cy, z + len * 0.18));
      for (var i = 0; i < 6; i++) {
        var ang = i * Math.PI / 3;
        g.add(this._part(0.006, 0.006, 0.008, M.steel,
          Math.cos(ang) * (r + 0.008), cy + Math.sin(ang) * (r + 0.008), z + len * 0.18));
      }
      // 前后镜环
      g.add(this._part(0.040, 0.028, 0.016, M.metal, 0, y + 0.030, z - len / 3));
      g.add(this._part(0.040, 0.028, 0.016, M.metal, 0, y + 0.030, z + len / 3));
      g.add(this._tubeX(0.005, 0.012, M.steel, 0.023, y + 0.022, z - len / 3));
      g.add(this._tubeX(0.005, 0.012, M.steel, 0.023, y + 0.022, z + len / 3));
    }
  },

  // 枪口：补偿器 / 消音器 / 制退器
  _muzzle: function (g, M, a, id) {
    var y = a.muzzleY, z = a.muzzleZ;
    if (id === 'muzzle_supp') {
      // 消音器：筒身 + 分段隔板环 + 前后端盖
      g.add(this._tube(0.026, 0.165, M.poly, 0, y, z - 0.070));
      for (var i = 0; i < 4; i++) {
        g.add(this._ringZ(0.027, 0.0035, M.metal, 0, y, z - 0.030 - i * 0.036));
      }
      g.add(this._tube(0.028, 0.014, M.metal, 0, y, z - 0.150));
      g.add(this._ringZ(0.028, 0.003, M.steel, 0, y, z - 0.156));
      g.add(this._tube(0.018, 0.016, M.steel, 0, y, z + 0.004));
      g.add(this._part(0.030, 0.008, 0.012, M.steel, 0, y + 0.026, z - 0.070));
    } else if (id === 'muzzle_brake') {
      // 制退器：方体 + 三层侧向排气口 + 前端面
      g.add(this._part(0.056, 0.044, 0.066, M.metal, 0, y, z - 0.028));
      g.add(this._part(0.064, 0.010, 0.018, M.poly, 0, y + 0.015, z - 0.048));
      g.add(this._part(0.064, 0.010, 0.018, M.poly, 0, y - 0.015, z - 0.048));
      g.add(this._part(0.064, 0.010, 0.018, M.poly, 0, y + 0.015, z - 0.016));
      g.add(this._part(0.064, 0.010, 0.018, M.poly, 0, y - 0.015, z - 0.016));
      g.add(this._ringZ(0.021, 0.004, M.steel, 0, y, z - 0.060));
      g.add(this._tube(0.016, 0.020, M.steel, 0, y, z + 0.004));
    } else {
      // 补偿器：筒身 + 顶部三孔 + 侧孔
      g.add(this._tube(0.021, 0.062, M.metal, 0, y, z - 0.026));
      for (var j = 0; j < 3; j++) {
        g.add(this._part(0.046, 0.008, 0.012, M.poly, 0, y + 0.012, z - 0.010 - j * 0.017));
      }
      g.add(this._part(0.010, 0.014, 0.016, M.poly, 0.020, y, z - 0.034));
      g.add(this._part(0.010, 0.014, 0.016, M.poly, -0.020, y, z - 0.034));
      g.add(this._ringZ(0.021, 0.0035, M.steel, 0, y, z - 0.056));
    }
  },

  // 前握把：垂直 / 斜角
  _grip: function (g, M, a, id) {
    var y = a.underY, z = a.underZ;
    if (id === 'grip_angled') {
      g.add(this._part(0.040, 0.016, 0.052, M.metal, 0, y - 0.002, z));
      var ang = this._part(0.032, 0.078, 0.040, M.poly, 0, y - 0.032, z - 0.010);
      ang.rotation.x = 0.48;
      ang.add(this._part(0.034, 0.060, 0.006, M.rubber, 0, 0.000, 0.022));
      g.add(ang);
      g.add(this._tubeX(0.005, 0.010, M.steel, 0.018, y - 0.002, z));
    } else {
      // 垂直握把：底座 + 主体 + 三道防滑环 + 底盖 + 螺丝
      g.add(this._part(0.036, 0.016, 0.052, M.metal, 0, y - 0.004, z));
      g.add(this._part(0.030, 0.092, 0.036, M.poly, 0, y - 0.052, z));
      g.add(this._ringY(0.017, 0.003, M.rubber, 0, y - 0.030, z));
      g.add(this._ringY(0.017, 0.003, M.rubber, 0, y - 0.050, z));
      g.add(this._ringY(0.017, 0.003, M.rubber, 0, y - 0.070, z));
      g.add(this._part(0.036, 0.010, 0.042, M.metal, 0, y - 0.100, z));
      g.add(this._tubeX(0.003, 0.006, M.steel, 0.019, y - 0.010, z));
    }
  },

  // 扩容弹匣 / 快速弹匣：在标准弹匣下方接一段
  _magExt: function (g, M, a, id) {
    var h = id === 'mag_quick' ? 0.06 : 0.095;
    var w = a.extW || 0.044, d = a.extD || 0.082;
    var y = a.magBottomY - h / 2 + 0.012;
    var p = this._part(w, h, d, M.poly, 0, y, a.magZ);
    p.rotation.x = a.magTilt || 0.12;
    if (this.detail) {
      // 底盖 + 两道压筋
      p.add(this._part(w + 0.006, 0.012, d + 0.008, M.metal, 0, -h / 2 + 0.004, 0));
      p.add(this._part(w + 0.003, 0.006, d + 0.003, M.steel, 0, h * 0.18, 0));
      p.add(this._part(w + 0.003, 0.006, d + 0.003, M.steel, 0, -h * 0.12, 0));
    }
    g.add(p);
    if (id === 'mag_quick') {
      // 快速弹匣：两侧供弹辅助条 + 观察孔
      g.add(this._part(0.004, 0.045, 0.050, M.accent, w / 2 + 0.002, y - 0.004, a.magZ));
      g.add(this._part(0.004, 0.045, 0.050, M.accent, -w / 2 - 0.002, y - 0.004, a.magZ));
      g.add(this._part(0.004, 0.008, 0.010, M.steel, w / 2 + 0.004, y + 0.012, a.magZ - 0.012));
    }
  },

  // 第一人称双臂（袖子 + 手套 + 手指）
  _arms: function (M, a, pistol) {
    var g = new THREE.Group();
    var underZ = a ? a.underZ : -0.24;
    // 右臂：从画面右下伸向握把
    var rArm = this._part(0.070, 0.070, 0.26, M.sleeve, 0.145, -0.240, 0.16);
    rArm.rotation.set(0.55, -0.38, 0.10);
    g.add(rArm);
    // 袖口收紧环
    g.add(this._part(0.072, 0.012, 0.020, M.glove, 0.108, -0.190, 0.116));
    var rGlove = this._part(0.062, 0.085, 0.10, M.glove, 0.012, -0.108, 0.088);
    rGlove.rotation.x = -0.28;
    g.add(rGlove);
    // 手指 + 手背护板
    g.add(this._part(0.055, 0.022, 0.05, M.glove, 0, -0.118, 0.055));
    g.add(this._part(0.045, 0.020, 0.045, M.glove, 0, -0.078, 0.135));
    g.add(this._part(0.050, 0.014, 0.034, M.accent, 0.006, -0.082, 0.092));
    // 左臂：托住护木（手枪只有单手）
    if (!pistol) {
      var lArm = this._part(0.070, 0.070, 0.28, M.sleeve, -0.105, -0.215, underZ + 0.16);
      lArm.rotation.set(0.50, 0.42, -0.12);
      g.add(lArm);
      g.add(this._part(0.072, 0.012, 0.020, M.glove, -0.070, -0.165, underZ + 0.12));
      var lGlove = this._part(0.058, 0.050, 0.11, M.glove, -0.022, -0.058, underZ + 0.02);
      lGlove.rotation.x = -0.12;
      g.add(lGlove);
      // 左手手指扣在护木下方
      g.add(this._part(0.048, 0.016, 0.060, M.glove, -0.018, -0.040, underZ - 0.015));
      g.add(this._part(0.046, 0.014, 0.030, M.glove, -0.016, -0.020, underZ + 0.040));
      g.add(this._part(0.050, 0.012, 0.032, M.accent, -0.026, -0.048, underZ + 0.010));
    }
    return g;
  }
};
