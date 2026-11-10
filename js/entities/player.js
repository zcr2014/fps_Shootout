// ===== 玩家：第一人称视角、移动、射击、换弹、治疗、背包 =====
window.GAME = window.GAME || {};

GAME.Player = {
  camera: null,
  pos: null,
  yaw: 0, pitch: 0,
  hp: 0, alive: true,
  ammo: 0, reloading: false, reloadTimer: 0, shootCooldown: 0,
  primary: null,       // 主武器定义
  secondary: null,     // 副武器定义（null 表示没带）
  slot: 1,             // 当前手持：1 主武器 / 2 副武器 / 3 近战
  ammoBy: { 1: 0, 2: 0 }, // 每个枪位各自的弹匣余弹
  weapon: null,        // 当前枪械定义
  melee: null,         // 当前近战武器（刀皮）定义
  helmet: null,        // 当前头盔定义
  armor: null,         // 当前护甲定义
  bagDef: null,        // 当前背包定义（null 表示只有口袋）
  bagCols: 2, bagRows: 2, // 局内背包格子尺寸
  armorReduce: 0,      // 躯干减伤比例
  helmetReduce: 0,     // 头部减伤比例
  equipWeight: 0,      // 已装备重量（武器+护甲+头盔+背包）
  meds: 0,             // 本局携带的急救包
  bag: [],             // 本局拾取的物品 [{ id, x, y }]（矩形装箱）
  cards: [],           // 本局携带的房卡 [{ id, uses }]
  lootValue: 0,        // 背包估值
  kills: 0,
  weight: 0,           // 当前总负重（装备+背包）
  operator: null,      // 当前干员定义（data/operators.js）
  maxHp: 100,          // 生命上限（干员特性可能加成）
  weightLimit: 20,     // 负重上限（干员特性可能加成）
  weightOver: 30,      // 超重硬上限（干员特性可能加成）
  safeItems: [],       // 局内保险箱：存进去的东西阵亡也不丢
  SAFE_MAX: 6,         // 局内保险箱上限（按件数）
  skillCd: 0,          // 干员技能冷却剩余秒数
  exoT: 0,             // 红狼动力外骨骼剩余秒数
  buffT: 0,            // 威龙动力辅助系统加速剩余秒数
  bobPhase: 0,         // 走路头部摆动相位
  // --- 姿态：站 / 蹲 / 趴 ---
  stance: 'stand',     // stand / crouch / prone
  eyeH: 1.65,          // 当前眼高（平滑插值到目标值）
  jumpY: 0,            // 离地高度（跳跃用）
  velY: 0,             // 竖直速度
  onGround: true,
  landBump: 0,         // 落地镜头下沉量
  // --- 探头与开镜 ---
  lean: 0,             // 当前侧身量 -1(左) ~ 1(右)，平滑
  ads: 0,              // 开镜进度 0(腰射) ~ 1(完全开镜)
  adsWant: false,
  swayX: 0, swayY: 0,  // 枪械摆动（鼠标惯性）
  muzzleLight: null,   // 枪口火光（复用，避免频繁创建）
  gun: null, gun2: null, gunKick: 0,
  recoilPitch: 0, recoilYaw: 0,   // 镜头后坐偏移（会回正）
  bloom: 0, shotSeq: 0,           // 连发散布累积 / 射击序号（左右交替上跳）
  knife: null,         // 近战视图模型（挂在相机上，切到 3 号位或挥砍时显示）
  swingT: 0,           // 挥刀动画进度 0~1（0 表示收起）
  meleeCooldown: 0,    // 挥刀冷却
  meleeRequest: false, // V 键请求，下一帧处理
  _raycaster: null,

  // setup = { weaponId, secondaryId, meleeId, helmetId, armorId, bagId, meds, cards, operator }
  init: function (camera, scene, setup) {
    var C = GAME.Config;
    this.camera = camera;
    this.pos = new THREE.Vector3(0, 0, 0);
    this.yaw = 0; this.pitch = 0;

    // --- 干员：决定生命上限/负重上限/技能 ---
    this.operator = setup.operator || GAME.Operators.get(GAME.Operators.DEFAULT);
    var op = this.operator, pw = GAME.Operators.passiveOf(op);
    this._pw = pw; // 被动数值缓存（runMul / medMul 等）
    this.maxHp = C.PLAYER_HP + (pw.hpBonus || 0);
    this.weightLimit = C.WEIGHT_LIMIT + (pw.limitBonus || 0);
    this.weightOver = C.WEIGHT_OVER + (pw.limitBonus || 0);
    // 特勤处设施加成（训练中心/靶场/医疗站）
    var bb = GAME.Base ? GAME.Base.bonus() : { hp: 0, speed: 0, weight: 0, med: 0 };
    this.maxHp += bb.hp;
    this.weightLimit += bb.weight;
    this.weightOver += bb.weight;
    this.baseSpeedMul = 1 + bb.speed;
    this.medBonus = bb.med;
    this.skillCd = 0; this.exoT = 0; this.buffT = 0;
    this.bobPhase = 0;
    this.stance = 'stand'; this.eyeH = C.EYE_HEIGHT;
    this.jumpY = 0; this.velY = 0; this.onGround = true; this.landBump = 0;
    this.lean = 0; this.ads = 0; this.adsWant = false; this.swayX = 0; this.swayY = 0;
    this.recoilPitch = 0; this.recoilYaw = 0; this.bloom = 0; this.shotSeq = 0;
    this.hp = this.maxHp; this.alive = true;

    // 枪械基础定义 + 已装配的配件（配件效果在 _applyStats 里合成）
    this.primaryDef = GAME.Items.get(setup.weaponId) || GAME.Items.get(C.DEFAULT_WEAPON);
    this.secondaryDef = setup.secondaryId ? GAME.Items.get(setup.secondaryId) : null;
    this.attach1 = setup.attach1 || {};
    this.attach2 = setup.attach2 || {};
    this._applyStats();
    this.slot = 1;
    this.weapon = this.primary;
    this.ammoBy = { 1: this.primary.mag, 2: this.secondary ? this.secondary.mag : 0 };
    this.melee = GAME.Items.get(setup.meleeId) || GAME.Items.get('knife');
    this.helmet = setup.helmetId ? GAME.Items.get(setup.helmetId) : null;
    this.armor = setup.armorId ? GAME.Items.get(setup.armorId) : null;
    this.bagDef = setup.bagId ? GAME.Items.get(setup.bagId) : null;
    // 背包容量：装备的背包决定；没背包只有口袋
    this.bagCols = this.bagDef ? this.bagDef.gridW : C.POCKET_COLS;
    this.bagRows = this.bagDef ? this.bagDef.gridH : C.POCKET_ROWS;
    this.armorReduce = this.armor ? this.armor.reduce : 0;
    this.helmetReduce = this.helmet ? this.helmet.reduce : 0;
    this.equipWeight = (this.primary.weight || 0) +
                       (this.secondary ? this.secondary.weight : 0) +
                       (this.melee ? this.melee.weight : 0) +
                       (this.armor ? this.armor.weight : 0) +
                       (this.helmet ? this.helmet.weight : 0) +
                       (this.bagDef ? this.bagDef.weight : 0) +
                       this._attachWeight(this.attach1) + this._attachWeight(this.attach2);
    this.meds = setup.meds || 0;
    this.cards = setup.cards || [];
    this.weight = this.equipWeight;

    this.ammo = this.primary.mag;
    this.reloading = false; this.reloadTimer = 0; this.shootCooldown = 0;
    this.bag = []; this.lootValue = 0; this.kills = 0;
    this.safeItems = [];
    this._raycaster = new THREE.Raycaster();
    // Sprite（敌人标记/太阳光晕）参与射线检测时必须有相机，否则 r128 会报错
    this._raycaster.camera = camera;

    // 枪模型：分件精细建模（机匣/护木/枪管/消焰器/弹匣/握把/枪托/瞄具）+ 双臂手套
    this._buildGuns();

    // 近战刀模型：刀皮只改刀身/握把颜色，属性完全一致
    this._buildKnife();
    this.updateWeaponView();

    // 枪口火光（挂在相机上，射击时短暂点亮，平时熄灭）
    if (this.muzzleLight && this.muzzleLight.parent) this.muzzleLight.parent.remove(this.muzzleLight);
    this.muzzleLight = new THREE.PointLight(0xffd9a0, 0, 9);
    this.muzzleLight.position.set(0.28, -0.2, -1.1);
    camera.add(this.muzzleLight);

    var self = this;
    GAME.Input.onPress['KeyR'] = function () { self.startReload(); };
    GAME.Input.onPress['KeyH'] = function () { self.useMedkit(); };
    GAME.Input.onPress['KeyV'] = function () { self.meleeRequest = true; };
    GAME.Input.onPress['KeyX'] = function () { self.useSkill(); };  // 干员技能（原 Q，Q/E 让给探头）
    GAME.Input.onPress['Space'] = function () { self.tryJump(); };
    GAME.Input.onPress['KeyZ'] = function () { self.toggleProne(); };
    GAME.Input.onPress['Digit1'] = function () { self.switchTo(1); };
    GAME.Input.onPress['Digit2'] = function () { self.switchTo(2); };
    GAME.Input.onPress['Digit3'] = function () { self.switchTo(3); };
    GAME.Input.onPress['KeyG'] = function () {}; // 预留
  },

  // ---------- 姿态：跳 / 蹲 / 趴 ----------
  tryJump: function () {
    if (!this.alive) return;
    if (this.stance === 'prone') { this.stance = 'crouch'; return; } // 趴着按跳先起身
    if (this.stance === 'crouch' ) { this.stance = 'stand'; }        // 蹲着按跳先站起
    if (!this.onGround) return;
    this.velY = 5.0;
    this.onGround = false;
    GAME.Audio.jump && GAME.Audio.jump();
  },

  // Z：趴下 / 起身（趴下时按蹲键也能站起来）
  toggleProne: function () {
    if (!this.alive) return;
    if (this.stance === 'prone') this.stance = 'crouch';
    else { this.stance = 'prone'; this.adsWant = false; }
  },

  update: function (dt, enemies, hooks) {
    if (!this.alive) return;
    var C = GAME.Config, U = GAME.Utils, I = GAME.Input;
    this._enemies = enemies; // 技能需要敌人列表（Q 释放时用）

    // --- 视角（开镜后灵敏度降低，视野更稳）---
    var d = I.consumeDelta();
    var sens = 0.0022 * (1 - this.ads * 0.55);
    this.yaw -= d.x * sens;
    this.pitch -= d.y * sens;
    this.pitch = U.clamp(this.pitch, -1.42, 1.42);

    // 鼠标惯性 → 枪身摆动（腰射明显，开镜几乎没有）
    this.swayX = U.clamp(this.swayX - d.x * 0.00005, -0.03, 0.03);
    this.swayY = U.clamp(this.swayY - d.y * 0.00005, -0.03, 0.03);
    var swayDecay = Math.pow(0.02, dt);
    this.swayX *= swayDecay; this.swayY *= swayDecay;

    // --- 技能计时器 ---
    this.skillCd = Math.max(0, this.skillCd - dt);
    this.exoT = Math.max(0, this.exoT - dt);
    this.buffT = Math.max(0, this.buffT - dt);
    if (this.muzzleLight) this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 30);

    // --- 蹲（按住 Ctrl）：趴着时按 Ctrl 先起身蹲 ---
    var crouchHeld = I.isDown('ControlLeft') || I.isDown('ControlRight') || I.isDown('KeyC');
    if (crouchHeld) {
      if (this.stance !== 'crouch') this.stance = 'crouch';
    } else if (this.stance === 'crouch') {
      this.stance = 'stand';
    }

    // --- 探头（按住 Q 左 / E 右）：趴下不能探头 ---
    var leanWant = (I.isDown('KeyE') ? 1 : 0) + (I.isDown('KeyQ') ? -1 : 0);
    if (this.stance === 'prone') leanWant = 0;
    this.lean += (leanWant - this.lean) * Math.min(1, dt * 11);
    if (Math.abs(this.lean) < 0.008) this.lean = 0;

    // --- 开镜（按住右键）---
    this.adsWant = I.mouseR && this.slot !== 3 && !this.reloading &&
                   this.stance !== 'prone';
    this.ads += ((this.adsWant ? 1 : 0) - this.ads) * Math.min(1, dt * 15);

    // --- 移动 ---
    var pw = this._pw || {};
    var running = (I.isDown('ShiftLeft') || I.isDown('ShiftRight')) && this.stance === 'stand';
    var over = this.weight > this.weightLimit;
    // 超重减速（乌鲁鲁特性可减半惩罚）
    var mul = over ? C.WEIGHT_SLOW * (pw.slowMul || 1) : 1;
    // 红狼动力外骨骼：冲刺速度 +30%
    var runBoost = (this.exoT > 0 && running) ? 1.3 : 1;
    var base = running ? C.PLAYER_RUN * (pw.runMul || 1) * runBoost : C.PLAYER_SPEED;
    var stanceMul = this.stance === 'prone' ? 0.34 : (this.stance === 'crouch' ? (pw.crouchMul || 0.55) : 1);
    var speed = base * (pw.speedMul || 1) * (this.baseSpeedMul || 1) * mul * stanceMul *
                (1 - this.ads * (pw.adsPenalty || 0.35));
    // 威龙动力辅助系统：使用战术装备后短暂加速
    if (this.buffT > 0) speed *= 1.15;
    var mx = 0, mz = 0;
    if (I.isDown('KeyW')) mz -= 1;
    if (I.isDown('KeyS')) mz += 1;
    if (I.isDown('KeyA')) mx -= 1;
    if (I.isDown('KeyD')) mx += 1;
    if (mx !== 0 || mz !== 0) {
      var len = Math.sqrt(mx * mx + mz * mz);
      mx /= len; mz /= len;
      var sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      this.pos.x += (mx * cos + mz * sin) * speed * dt;
      this.pos.z += (-mx * sin + mz * cos) * speed * dt;
      // 走路头部摆动（越快摆越快，蹲/趴时更小）
      this.bobPhase += dt * speed * 1.7;
    }

    // --- 碰撞与边界（按姿态决定身体高度：趴下能钻矮缝）---
    var bodyH = this.stance === 'prone' ? 0.6 : (this.stance === 'crouch' ? 1.2 : 1.9);
    U.resolveCircleCollision(this.pos, C.PLAYER_RADIUS, GAME.Map.obstacles,
      this.pos.y + this.jumpY, this.pos.y + this.jumpY + bodyH);
    var lim = GAME.Map.half - 1.2;
    this.pos.x = U.clamp(this.pos.x, -lim, lim);
    this.pos.z = U.clamp(this.pos.z, -lim, lim);

    // --- 地面高度（二楼楼板 / 楼梯斜坡）---
    var groundY = GAME.Map.heightAt ? GAME.Map.heightAt(this.pos.x, this.pos.z, this.pos.y) : 0;
    this.pos.y += (groundY - this.pos.y) * Math.min(1, dt * 12);

    // --- 跳跃物理（重力 + 落地缓冲）---
    if (!this.onGround) {
      this.velY -= 16 * dt;
      this.jumpY += this.velY * dt;
      if (this.jumpY <= 0) {
        var impact = Math.min(1, Math.abs(this.velY) / 8);
        this.jumpY = 0; this.velY = 0; this.onGround = true;
        this.landBump = impact * 0.11;
        if (GAME.Audio.land) GAME.Audio.land();
      }
    }
    this.landBump = Math.max(0, this.landBump - dt * 0.55);

    // --- 相机：眼高随姿态过渡 + 探头侧移/侧倾 + 走路头摆 + 落地下沉 ---
    var eyeTarget = this.stance === 'prone' ? 0.42 : (this.stance === 'crouch' ? 1.15 : C.EYE_HEIGHT);
    this.eyeH += (eyeTarget - this.eyeH) * Math.min(1, dt * 12);

    var moving = (mx !== 0 || mz !== 0) && this.onGround;
    var bobAmp = this.stance === 'prone' ? 0.012 : (this.stance === 'crouch' ? 0.022 : 0.035);
    var bobY = moving ? Math.sin(this.bobPhase) * bobAmp * (1 - this.ads * 0.65) : 0;
    var leanOff = this.lean * (0.20 + this.ads * 0.14); // 开镜探头幅度更大
    this.camera.position.set(
      this.pos.x + Math.cos(this.yaw) * leanOff,
      this.pos.y + this.jumpY + this.eyeH + bobY - this.landBump,
      this.pos.z - Math.sin(this.yaw) * leanOff
    );
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);
    this.camera.rotateZ(-this.lean * 0.17); // 侧身时画面轻微倾斜（真实探头感）

    // --- 后坐力：镜头抬升 + 左右摆动，停火后自动回正 ---
    var recDecay = Math.pow(0.10, dt);
    this.recoilPitch *= recDecay;
    this.recoilYaw *= recDecay;
    this.bloom = Math.max(0, this.bloom - dt * 0.05);
    this.camera.rotateX(this.recoilPitch);
    this.camera.rotateY(this.recoilYaw);

    // --- 视野：跑步更广，开镜收窄 ---
    var adsFov = (this.weapon && this.weapon.adsFov) || 52;
    var baseFov = running ? 80 : 75;
    var targetFov = baseFov + (adsFov - baseFov) * this.ads;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 14);
      this.camera.updateProjectionMatrix();
    }

    // --- 枪械姿态：腰射 ↔ 开镜平滑过渡，含鼠标摆动、后坐、换弹动作 ---
    if (this.gun) this._poseGun(this.gun, 1);
    if (this.gun2) this._poseGun(this.gun2, 2);

    // --- 瞄具分划：装了镜并开镜时，显示镜内视野与准星 ---
    if (GAME.HUD.scope) {
      var sc = this.slot === 2 ? (this.attach2 || {}).scope : (this.attach1 || {}).scope;
      GAME.HUD.scope(sc || null, this.ads);
    }

    // 枪口火光跟着枪口走
    if (this.muzzleLight) {
      var mPistol = this._isPistolSlot();
      var mLocal = mPistol
        ? { x: 0.20 * (1 - this.ads), y: -0.175 + 0.13 * this.ads, z: -0.72 - 0.02 * this.ads }
        : { x: 0.245 * (1 - this.ads), y: -0.205 + 0.20 * this.ads, z: -1.05 - 0.05 * this.ads };
      this.muzzleLight.position.set(mLocal.x, mLocal.y, mLocal.z);
    }

    // --- 换弹 ---
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.ammo = this.weapon.mag;
        this.ammoBy[this.slot] = this.ammo;
      }
    }

    // --- 后座衰减（位移由 _poseGun 统一应用，避免与开镜插值打架）---
    if (this.gunKick > 0) this.gunKick = Math.max(0, this.gunKick - dt * 6);

    // --- 近战挥刀 ---
    this.meleeCooldown -= dt;
    if (this.meleeRequest) {
      this.meleeRequest = false;
      this.meleeAttack(enemies, hooks);
    }
    if (this.swingT > 0) {
      this.swingT += dt / 0.30; // 约 0.3 秒一刀
      if (this.swingT >= 1) {
        this.swingT = 0;
        this.updateWeaponView();
      } else {
        var sp = this.swingT, k = Math.sin(sp * Math.PI);
        this.knife.position.set(0.30 - 0.50 * sp, -0.30 + 0.12 * k, -0.5 - 0.08 * k);
        this.knife.rotation.set(0.15 - 0.45 * k, -0.85 + 1.7 * sp, 0.25 - 0.7 * sp);
      }
    } else if (this.slot === 3) {
      // 手持刀时的持刀姿态
      this.knife.position.set(0.26, -0.28, -0.46);
      this.knife.rotation.set(0.2, -0.85, 0.3);
    }

    // --- 攻击（指针锁定时才生效，避免点界面走火）---
    this.shootCooldown -= dt;
    if (I.locked && I.mouseDown) {
      if (this.slot === 3) {
        // 手持刀：左键挥砍
        if (this.meleeCooldown <= 0) this.meleeAttack(enemies, hooks);
      } else if (!this.reloading && this.shootCooldown <= 0) {
        this.shoot(enemies, hooks);
      }
    }
  },

  shoot: function (enemies, hooks) {
    if (this.ammo <= 0) { GAME.Audio.empty(); this.shootCooldown = 0.3; return; }
    var w = this.weapon;

    this.ammo--;
    this.ammoBy[this.slot] = this.ammo;
    // 动力外骨骼期间射速 +20%
    this.shootCooldown = w.interval * (this.exoT > 0 ? 0.83 : 1);
    // 后坐：基础后坐 × 枪口配件 × 干员特性；蹲/趴与开镜都会更稳
    var rc = (w.recoil || 1) * ((this._pw && this._pw.recoilMul) || 1);
    var recStance = this.stance === 'prone' ? 0.5 : (this.stance === 'crouch' ? 0.72 : 1);
    var recAds = 1 - this.ads * 0.4;
    this.gunKick = rc * recStance;
    this.shotSeq++;
    // 垂直上跳（带随机）+ 水平左右摆（单双发交替，连发时逐渐扩大）
    this.recoilPitch += 0.009 * rc * recStance * recAds * (0.85 + Math.random() * 0.3);
    var side = (this.shotSeq % 2 ? 1 : -1);
    this.recoilYaw += (side * 0.0032 + (Math.random() - 0.5) * 0.0035) * rc * recStance * recAds;
    // 连发散布累积（停火后慢慢收回来）
    this.bloom = Math.min(0.030, this.bloom + 0.0022 * rc);
    if (this.muzzleLight) this.muzzleLight.intensity = w.suppressed ? 1.2 : 2.6;
    if (w.suppressed) GAME.Audio.shootSupp && GAME.Audio.shootSupp(); else GAME.Audio.shoot();

    var origin = this.camera.position.clone();
    var dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    // 散布：枪械基础散布 + 连发累积，配件/开镜/蹲/趴都会更准
    var spread = ((w.spread || 0.006) + this.bloom) * (1 - this.ads * 0.72);
    if (this.stance === 'crouch') spread *= 0.85;
    else if (this.stance === 'prone') spread *= 0.68;
    if (spread > 0) {
      var ang = Math.random() * Math.PI * 2;
      var mag = spread * Math.sqrt(Math.random());
      var right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
      var up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
      dir.addScaledVector(right, Math.cos(ang) * mag).addScaledVector(up, Math.sin(ang) * mag).normalize();
    }
    this._raycaster.set(origin, dir);
    this._raycaster.far = w.range;

    var targets = [];
    for (var i = 0; i < enemies.length; i++) {
      if (enemies[i].alive) targets.push(enemies[i].group);
    }
    targets = targets.concat(GAME.Map.meshes);

    var hits = this._raycaster.intersectObjects(targets, true);
    var endPoint = origin.clone().addScaledVector(dir, w.range);

    if (hits.length > 0) {
      var hit = hits[0];
      endPoint = hit.point;
      var obj = hit.object;
      // 命中火花：打中敌人冒红血雾，打中墙体冒尘土
      GAME.Bullets.addImpact(hit.point, obj && obj.userData.enemy ? 0xff5252 : 0xd9c9a0);
      while (obj && !obj.userData.enemy) obj = obj.parent;
      if (obj && obj.userData.enemy) {
        var enemy = obj.userData.enemy;
        var died = enemy.takeDamage(w.damage);
        // 露娜特性「目标分析」：命中即标记
        if (!died && this._pw && this._pw.lunaMark) enemy.mark(this._pw.lunaMark, 'luna');
        GAME.Audio.hit();
        GAME.HUD.hitMarker();
        if (died && hooks && hooks.onKill) hooks.onKill(enemy);
      }
    }

    // 枪口位置跟随开镜姿态（开镜时枪居中、枪管抬高）
    var k = this.ads;
    var muzzle = this._isPistolSlot()
      ? new THREE.Vector3(0.20 * (1 - k), -0.175 + 0.16 * k, -0.72 - 0.03 * k).applyMatrix4(this.camera.matrixWorld)
      : new THREE.Vector3(0.245 * (1 - k), -0.205 + 0.21 * k, -1.04 - 0.06 * k).applyMatrix4(this.camera.matrixWorld);
    GAME.Bullets.addTracer(muzzle, endPoint);
  },

  // 切换手持：1 主武器 / 2 副武器 / 3 近战
  switchTo: function (slot) {
    if (!this.alive || slot === this.slot) return;
    if (slot === 2 && !this.secondary) {
      GAME.HUD.killFeed('没有副武器（按 1 回主武器）');
      return;
    }
    this.ammoBy[this.slot] = this.ammo;
    this.slot = slot;
    this.reloading = false; this.reloadTimer = 0;
    this.gunKick = 0;
    if (slot !== 3) {
      this.weapon = slot === 2 ? this.secondary : this.primary;
      this.ammo = this.ammoBy[slot];
    }
    this.updateWeaponView();
    GAME.Audio.pickup();
  },

  // 按当前手持显示对应的视图模型
  updateWeaponView: function () {
    var swinging = this.swingT > 0;
    if (this.gun) this.gun.visible = (this.slot === 1 && !swinging);
    if (this.gun2) this.gun2.visible = (this.slot === 2 && !swinging);
    if (this.knife) this.knife.visible = (this.slot === 3 || swinging);
  },

  // 重建近战刀视图模型（换刀皮时调用，只变配色）
  _buildKnife: function () {
    if (this.knife && this.knife.parent) this.knife.parent.remove(this.knife);
    var meleeDef = this.melee || GAME.Items.get('knife');
    var bladeMat = new THREE.MeshLambertMaterial({ color: meleeDef.bladeColor || 0xc7d0d9 });
    bladeMat.color.multiplyScalar(0.12); // 同上：压低亮度，避免曝光后发白
    if (meleeDef.emissive) bladeMat.emissive.setHex(meleeDef.emissive);
    var gripMat = new THREE.MeshLambertMaterial({ color: meleeDef.gripColor || 0x2a2a2a });
    gripMat.color.multiplyScalar(0.12);
    this.knife = new THREE.Group();
    var handle = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.16), gripMat);
    handle.position.set(0, 0, 0.04);
    var guard = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.025, 0.02), gripMat);
    guard.position.set(0, 0, -0.05);
    var blade = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.07, 0.34), bladeMat);
    blade.position.set(0, 0.005, -0.24);
    this.knife.add(handle); this.knife.add(guard); this.knife.add(blade);
    this.knife.position.set(0.30, -0.30, -0.5);
    this.knife.visible = false;
    this.camera.add(this.knife);
    this.swingT = 0; this.meleeCooldown = 0; this.meleeRequest = false;
    this.updateWeaponView();
  },

  // 把基础枪械定义与配件合成有效属性（开火 / 开镜 / 换弹都读这一份）
  _applyStats: function () {
    this.primary = GAME.Items.weaponStats(this.primaryDef, this.attach1);
    this.secondary = this.secondaryDef ? GAME.Items.weaponStats(this.secondaryDef, this.attach2) : null;
    if (this.slot === 2 && this.secondary) this.weapon = this.secondary;
    else if (this.slot !== 3 && this.primary) this.weapon = this.primary;
  },

  // 配件带来的额外负重
  _attachWeight: function (map) {
    var w = 0;
    if (!map) return 0;
    for (var k in map) {
      var d = map[k] && GAME.Items.get(map[k]);
      if (d && d.weight) w += d.weight;
    }
    return w;
  },

  // 重建两把枪的视图模型（出击 / 换枪 / 换配件时调用）
  _buildGuns: function () {
    if (this.gun && this.gun.parent) this.gun.parent.remove(this.gun);
    if (this.gun2 && this.gun2.parent) this.gun2.parent.remove(this.gun2);
    this.gun = this.primaryDef
      ? GAME.GunModel.build(this.primaryDef, { arms: true, attach: this.attach1 })
      : null;
    this.gun2 = this.secondaryDef
      ? GAME.GunModel.build(this.secondaryDef, { arms: true, attach: this.attach2 })
      : null;
    if (this.gun) this.camera.add(this.gun);
    if (this.gun2) this.camera.add(this.gun2);
    this.updateWeaponView();
  },

  // 指定枪位是不是手枪（决定枪位与枪口偏移）
  _isPistolSlot: function (slot) {
    var s = slot || this.slot;
    var w = s === 2 ? this.secondary : this.primary;
    return !!w && w.slot === 'secondary';
  },

  // 腰射 ↔ 开镜的枪位插值：含鼠标摆动、后坐、换弹动作、探头侧倾
  _poseGun: function (group, slot) {
    if (!group) return;
    var k = this.ads;
    var isP = this._isPistolSlot(slot);
    var hipX = isP ? 0.170 : 0.255;
    var hipY = isP ? -0.150 : -0.225;
    var hipZ = isP ? -0.430 : -0.500;
    var adsX = 0;
    var adsY = isP ? -0.055 : -0.105;
    var adsZ = isP ? -0.255 : -0.215;
    var swayMul = 1 - k * 0.92;

    var px = hipX + (adsX - hipX) * k + this.swayX * swayMul;
    var py = hipY + (adsY - hipY) * k + this.swayY * swayMul;
    var pz = hipZ + (adsZ - hipZ) * k + this.gunKick * 0.10;

    // 换弹：枪下沉并向内翻，蹲姿略微下沉
    if (this.reloading) { py -= 0.07; pz += 0.03; }
    if (this.stance === 'crouch') py -= 0.01;

    // 装镜后开镜：把枪模沉到画面下方，避免挡住镜内视野（分划由 HUD 绘制）
    var scAttr = (slot === 2 ? this.attach2 : this.attach1) || {};
    if (scAttr.scope) {
      py -= k * k * 0.52;
      pz -= k * k * 0.18;
    }

    group.position.set(px, py, pz);
    group.rotation.set(
      (1 - k) * -0.015 + this.swayY * 0.9 * swayMul + this.gunKick * 0.18 * (1 - k * 0.5) +
        (this.reloading ? -0.35 : 0),
      (1 - k) * 0.055 + (isP ? (1 - k) * 0.17 : 0) + this.swayX * 0.9 * swayMul + (this.reloading ? 0.25 : 0),
      (1 - k) * -0.02 + (this.reloading ? 0.30 : 0) - this.lean * 0.10
    );
  },

  // ---------- 局内换装：把背包里的装备直接穿上（旧装备放回背包）----------

  // 从背包取出第 idx 件（不算负重钳制），返回条目；不改动时请回滚
  _takeFromBag: function (idx) {
    var e = this.bag[idx];
    if (!e) return null;
    this.bag.splice(idx, 1);
    var d = GAME.Items.get(e.id);
    this.lootValue = Math.max(0, this.lootValue - d.price);
    this._recalcWeight();
    return e;
  },

  // 往背包塞一件（找空位+计重计价），塞不下返回 false 且不改动
  _stashItem: function (id) {
    var pos = this._findBagPos(id);
    if (!pos) return false;
    var d = GAME.Items.get(id);
    this.bag.push({ id: id, x: pos.x, y: pos.y });
    this.lootValue += d.price;
    this._recalcWeight();
    return true;
  },

  // 负重 = 装备重量 + 背包内物品重量（装备/背包变动后统一重算，避免增量误差）
  _recalcWeight: function () {
    var eq = 0;
    if (this.primary) eq += this.primary.weight || 0;
    if (this.secondary) eq += this.secondary.weight || 0;
    if (this.melee) eq += this.melee.weight || 0;
    if (this.armor) eq += this.armor.weight || 0;
    if (this.helmet) eq += this.helmet.weight || 0;
    if (this.bagDef) eq += this.bagDef.weight || 0;
    eq += this._attachWeight(this.attach1) + this._attachWeight(this.attach2);
    this.equipWeight = Math.round(eq * 100) / 100;
    var w = eq;
    for (var i = 0; i < this.bag.length; i++) {
      w += (GAME.Items.get(this.bag[i].id).weight || 0);
    }
    this.weight = Math.max(0, Math.round(w * 100) / 100);
  },

  // 装备枪械（按物品的 slot 自动进主/副武器位）
  equipWeaponFromBag: function (idx) {
    var e = this._takeFromBag(idx);
    if (!e) return { ok: false, msg: '物品不存在' };
    var def = GAME.Items.get(e.id);
    var isSec = def.slot === 'secondary';
    var old = isSec ? this.secondary : this.primary;
    var oldDef = isSec ? this.secondaryDef : this.primaryDef;
    var oldAttach = isSec ? this.attach2 : this.attach1;
    var oldFree = !isSec && GAME.Game.raidGear && GAME.Game.raidGear.weaponFree;
    var attach = GAME.Profile ? GAME.Profile.getAttach(def.id) : {};
    var slotNo = isSec ? 2 : 1;

    if (isSec) { this.secondaryDef = def; this.attach2 = attach; }
    else { this.primaryDef = def; this.attach1 = attach; }
    this._applyStats();
    this.ammoBy[slotNo] = (isSec ? this.secondary : this.primary).mag;
    if (this.slot === slotNo) {
      this.weapon = isSec ? this.secondary : this.primary;
      this.ammo = this.weapon.mag;
      this.reloading = false; this.reloadTimer = 0;
    }
    this._recalcWeight();
    this._buildGuns(); // 换枪后重建视图模型（枪型/配件都跟着变）

    // 旧枪放回背包（出击带的免费白板枪不算资产，不用回包）
    if (old && !oldFree && !this._stashItem(old.id)) {
      // 背包放不下旧枪 → 整体回滚
      this._stashItem(def.id);
      if (isSec) { this.secondaryDef = oldDef; this.attach2 = oldAttach; }
      else { this.primaryDef = oldDef; this.attach1 = oldAttach; }
      this._applyStats();
      this.ammoBy[slotNo] = old.mag;
      if (this.slot === slotNo) { this.weapon = old; this.ammo = this.ammoBy[slotNo]; }
      this._recalcWeight();
      this._buildGuns();
      return { ok: false, msg: '背包放不下旧枪，无法更换' };
    }

    // 同步局内装备记录（结算按局内实际穿戴算）
    if (GAME.Game.raidGear) {
      if (isSec) GAME.Game.raidGear.secondaryId = def.id;
      else { GAME.Game.raidGear.weaponId = def.id; GAME.Game.raidGear.weaponFree = false; }
    }
    return { ok: true, msg: '已换上 ' + def.name };
  },

  // 穿上护甲
  equipArmorFromBag: function (idx) {
    var e = this._takeFromBag(idx);
    if (!e) return { ok: false, msg: '物品不存在' };
    var def = GAME.Items.get(e.id);
    var old = this.armor;
    this.armor = def;
    this.armorReduce = def.reduce;
    this._recalcWeight();
    if (old && !this._stashItem(old.id)) {
      // 回滚：换回旧护甲，新护甲塞回背包
      this.armor = old; this.armorReduce = old.reduce;
      this._recalcWeight();
      this._stashItem(def.id);
      return { ok: false, msg: '背包放不下旧护甲，无法更换' };
    }
    if (GAME.Game.raidGear) GAME.Game.raidGear.armorId = def.id;
    return { ok: true, msg: '已穿上 ' + def.name + '（减伤 ' + Math.round(def.reduce * 100) + '%）' };
  },

  // 戴上头盔
  equipHelmetFromBag: function (idx) {
    var e = this._takeFromBag(idx);
    if (!e) return { ok: false, msg: '物品不存在' };
    var def = GAME.Items.get(e.id);
    var old = this.helmet;
    this.helmet = def;
    this.helmetReduce = def.reduce;
    this._recalcWeight();
    if (old && !this._stashItem(old.id)) {
      this.helmet = old; this.helmetReduce = old.reduce;
      this._recalcWeight();
      this._stashItem(def.id);
      return { ok: false, msg: '背包放不下旧头盔，无法更换' };
    }
    if (GAME.Game.raidGear) GAME.Game.raidGear.helmetId = def.id;
    return { ok: true, msg: '已戴上 ' + def.name + '（减伤 ' + Math.round(def.reduce * 100) + '%）' };
  },

  // 更换背包：现有物资要在新背包里重新装箱，装不下就整体回滚
  equipBagFromBag: function (idx) {
    var e = this._takeFromBag(idx);
    if (!e) return { ok: false, msg: '物品不存在' };
    var def = GAME.Items.get(e.id);
    var old = this.bagDef;

    // 试装箱：把现有物品全部摆进新背包
    var placed = this._repackAll(def.gridW, def.gridH);
    if (!placed) {
      this._stashItem(def.id);
      return { ok: false, msg: '新背包装不下现有物资，无法更换' };
    }
    // 旧背包本身也要能放进新背包
    if (old) {
      var s = GAME.Items.size(old.id);
      var found = false;
      for (var y = 0; y + s.h <= def.gridH && !found; y++) {
        for (var x = 0; x + s.w <= def.gridW && !found; x++) {
          var ok = true;
          for (var k = 0; k < placed.length; k++) {
            var pe = placed[k], ps = GAME.Items.size(pe.id);
            if (x < pe.x + ps.w && x + s.w > pe.x && y < pe.y + ps.h && y + s.h > pe.y) { ok = false; break; }
          }
          if (ok) { placed.push({ id: old.id, x: x, y: y }); found = true; }
        }
      }
      if (!found) {
        this._stashItem(def.id);
        return { ok: false, msg: '旧背包放不进新背包，无法更换' };
      }
      this.lootValue += old.price; // 旧背包回流成战利品
    }

    // 提交：换背包定义 + 重排后的物品
    this.bagDef = def;
    this.bagCols = def.gridW;
    this.bagRows = def.gridH;
    this.bag = placed;
    this._recalcWeight();
    if (GAME.Game.raidGear) GAME.Game.raidGear.bagId = def.id;
    return { ok: true, msg: '已换上 ' + def.name + '（' + def.gridW + '×' + def.gridH + ' 格）' };
  },

  // 把当前背包所有物品重新装进 cols×rows 的网格，装不下返回 null
  _repackAll: function (cols, rows) {
    var placed = [];
    var items = this.bag.slice();
    for (var i = 0; i < items.length; i++) {
      var s = GAME.Items.size(items[i].id);
      var found = false;
      for (var y = 0; y + s.h <= rows && !found; y++) {
        for (var x = 0; x + s.w <= cols && !found; x++) {
          var ok = true;
          for (var k = 0; k < placed.length; k++) {
            var pe = placed[k], ps = GAME.Items.size(pe.id);
            if (x < pe.x + ps.w && x + s.w > pe.x && y < pe.y + ps.h && y + s.h > pe.y) { ok = false; break; }
          }
          if (ok) { placed.push({ id: items[i].id, x: x, y: y }); found = true; }
        }
      }
      if (!found) return null;
    }
    return placed;
  },

  // 装备刀皮（近战属性不变，只换外观；绑定匕首不占背包）
  equipMeleeFromBag: function (idx) {
    var e = this._takeFromBag(idx);
    if (!e) return { ok: false, msg: '物品不存在' };
    var def = GAME.Items.get(e.id);
    var old = this.melee;
    this.melee = def;
    this._buildKnife();
    this._recalcWeight();
    if (!old.bound && !this._stashItem(old.id)) {
      // 回滚
      this.melee = old;
      this._buildKnife();
      this._recalcWeight();
      this._stashItem(def.id);
      return { ok: false, msg: '背包放不下旧刀皮，无法更换' };
    }
    if (GAME.Game.raidGear) GAME.Game.raidGear.meleeId = def.id;
    return { ok: true, msg: '已装备 ' + def.name };
  },

  // ---------- 局内保险箱：存进去的东西阵亡也不丢 ----------

  // 把背包第 idx 件存入局内保险箱
  safeStore: function (idx) {
    var e = this.bag[idx];
    if (!e) return { ok: false, msg: '物品不存在' };
    if (this.safeItems.length >= this.SAFE_MAX) {
      return { ok: false, msg: '局内保险箱已满（' + this.SAFE_MAX + ' 件）' };
    }
    this._takeFromBag(idx);
    this.safeItems.push({ id: e.id });
    return { ok: true, msg: '已存入保险箱（阵亡也不会丢失）' };
  },

  // 从局内保险箱取出第 i 件
  safeTake: function (i) {
    var e = this.safeItems[i];
    if (!e) return { ok: false, msg: '没有这件物品' };
    if (!this.canFit(e.id)) return { ok: false, msg: '背包放不下，先腾点空间' };
    this.safeItems.splice(i, 1);
    this._stashItem(e.id);
    return { ok: true, msg: '已取出 ' + GAME.Items.get(e.id).name };
  },

  // V 键快速挥刀 / 手持刀时左键挥砍：小范围扇形判定，命中最近的敌人
  meleeAttack: function (enemies, hooks) {
    if (!this.alive || this.meleeCooldown > 0) return;
    var m = this.melee;
    this.meleeCooldown = m.interval || 0.75;
    this.swingT = 0.001;
    this.updateWeaponView();
    GAME.Audio.slash();

    // 水平朝向：本地 -Z 经过 yaw 旋转后的方向
    var fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    var best = null, bestDist = 1e9;
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e.alive) continue;
      var dx = e.pos.x - this.pos.x;
      var dz = e.pos.z - this.pos.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > m.range || Math.abs(e.pos.y - this.pos.y) > 2.2) continue;
      if (dist > 0.001 && (dx * fx + dz * fz) / dist < 0.35) continue; // 约 ±69° 扇形
      if (dist < bestDist) { bestDist = dist; best = e; }
    }

    if (best) {
      var died = best.takeDamage(m.damage);
      GAME.Audio.hit();
      GAME.HUD.hitMarker();
      if (died && hooks && hooks.onKill) hooks.onKill(best);
    } else {
      GAME.Audio.empty();
    }
  },

  startReload: function () {
    if (this.reloading || !this.alive) return;
    if (this.slot === 3) return; // 手持刀不换弹
    if (!this.weapon) return;
    if (this.ammo >= this.weapon.mag) return;
    this.reloading = true;
    this.reloadTimer = this.weapon.reload;
    GAME.Audio.reload();
  },

  // 按 H 使用急救包
  useMedkit: function () {
    if (!this.alive || this.meds <= 0) {
      if (this.alive) GAME.HUD.killFeed('没有急救包了');
      return;
    }
    if (this.hp >= this.maxHp) {
      GAME.HUD.killFeed('生命值已满');
      return;
    }
    var heal = GAME.Items.get('medkit').heal *
               ((this._pw && this._pw.medMul) || 1) * (1 + (this.medBonus || 0));
    this.meds--;
    this.hp = Math.min(this.maxHp, this.hp + heal);
    GAME.Audio.pickup();
    GAME.HUD.killFeed('使用急救包 +' + Math.round(heal) + ' HP');
  },

  // ---------- 背包（矩形装箱，和仓库同一套规则）----------
  bagTotal: function () { return this.bagCols * this.bagRows; },

  bagUsed: function () {
    var n = 0;
    for (var i = 0; i < this.bag.length; i++) {
      var s = GAME.Items.size(this.bag[i].id);
      n += s.w * s.h;
    }
    return n;
  },

  bagFree: function () { return this.bagTotal() - this.bagUsed(); },

  _bagRectFree: function (x, y, w, h) {
    for (var i = 0; i < this.bag.length; i++) {
      var e = this.bag[i];
      var es = GAME.Items.size(e.id);
      if (x < e.x + es.w && x + w > e.x && y < e.y + es.h && y + h > e.y) return false;
    }
    return true;
  },

  _findBagPos: function (itemId) {
    var s = GAME.Items.size(itemId);
    for (var y = 0; y + s.h <= this.bagRows; y++) {
      for (var x = 0; x + s.w <= this.bagCols; x++) {
        if (this._bagRectFree(x, y, s.w, s.h)) return { x: x, y: y };
      }
    }
    return null;
  },

  // 这件物品现在装得进背包吗（格子+超重硬限制）
  canFit: function (itemId) {
    var w = GAME.Items.get(itemId).weight || 0;
    if (this.weight + w > this.weightOver) return false;
    return !!this._findBagPos(itemId);
  },

  // 拾取物品进背包，返回是否成功
  pickItem: function (itemId) {
    if (!this.canFit(itemId)) return false;
    var pos = this._findBagPos(itemId);
    var d = GAME.Items.get(itemId);
    this.bag.push({ id: itemId, x: pos.x, y: pos.y });
    this.lootValue += d.price;
    this._recalcWeight();
    return true;
  },

  // 从背包里丢弃第 i 件（丢到地上），返回被丢的条目
  removeAt: function (i) {
    var e = this.bag[i];
    if (!e) return null;
    this.bag.splice(i, 1);
    var d = GAME.Items.get(e.id);
    this._recalcWeight();
    this.lootValue = Math.max(0, this.lootValue - d.price);
    return e;
  },

  // ---------- 房卡 ----------
  cardFor: function (tier) {
    for (var i = 0; i < this.cards.length; i++) {
      var c = this.cards[i];
      if (c.uses > 0 && GAME.Items.keyTier(c.id) === tier) return c;
    }
    return null;
  },

  // 消耗一次房卡，用完即消失
  useCard: function (tier) {
    var c = this.cardFor(tier);
    if (!c) return false;
    c.uses--;
    if (c.uses <= 0) {
      for (var i = 0; i < this.cards.length; i++) {
        if (this.cards[i] === c) { this.cards.splice(i, 1); break; }
      }
    }
    return true;
  },

  takeDamage: function (d) {
    if (!this.alive) return;
    // 护甲与头盔的减伤按乘法叠加（躯干+头部防护）
    var real = d * (1 - this.armorReduce) * (1 - this.helmetReduce);
    // 牧羊人特性「声波防御」：受到伤害降低
    if (this._pw && this._pw.dmgMul) real *= this._pw.dmgMul;
    this.hp = Math.max(0, this.hp - real);
    GAME.Audio.hurt();
    GAME.HUD.damageFlash();
    if (this.hp <= 0) this.alive = false;
  },

  // 击杀回调：红狼外骨骼充能
  onOperatorKill: function () {
    if (!this.alive || !this.operator || this.operator.id !== 'redwolf' || this.exoT <= 0) return;
    this.exoT = Math.min(12, this.exoT + 2);
    this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.2);
    GAME.HUD.killFeed('外骨骼充能：回复 20% 生命，持续时间 +2 秒');
  },

  // ---------- 干员战术装备（X）----------
  useSkill: function () {
    if (!this.alive) return;
    if (this.skillCd > 0) {
      GAME.HUD.killFeed(this.operator.skill.name + ' 冷却中（' + this.skillCd.toFixed(1) + ' 秒）');
      return;
    }
    var op = this.operator;
    this.skillCd = op.skill.cd;
    var enemies = this._enemies || [];
    var dir = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    var origin = this.camera.position.clone();

    switch (op.id) {
      case 'redwolf': // 动力外骨骼
        this.exoT = 8;
        GAME.Audio.dash();
        GAME.HUD.killFeed('动力外骨骼启动：冲刺 +30% · 射速 +20%');
        break;
      case 'stinger': // 蜂巢治疗
        GAME.Skills.spawnDrone(this, 8, 7);
        GAME.Audio.heal();
        GAME.HUD.killFeed('治疗无人机已放出');
        break;
      case 'luna': // 侦察箭
        GAME.Skills.spawnArrow(origin.addScaledVector(dir, 0.5), dir, 6, 15, enemies);
        GAME.Audio.slash();
        break;
      case 'vyron': // 磁吸炸弹 + 动力辅助系统
        GAME.Skills.spawnBomb(origin.addScaledVector(dir, 0.6), dir, 1.6, 6, 80, enemies);
        this.buffT = 4;
        GAME.Audio.dash();
        GAME.HUD.killFeed('磁吸炸弹已投出 · 动力辅助加速 4 秒');
        break;
      case 'shepherd': // 声波瘫痪
        GAME.Skills.sonicPulse(this.pos, 14, 5, enemies);
        GAME.HUD.killFeed('声波瘫痪：敌人减速 50% · 射速 -40%');
        break;
      case 'hackclaw': // 信号解码器
        GAME.Skills.scanSignals(this.pos, 40, enemies, 3, 10, 3);
        GAME.HUD.killFeed('信号解码：锁定最近 3 名敌人');
        break;
      case 'uluru': // 巡飞弹
        GAME.Skills.spawnLoiter(origin.addScaledVector(dir, 0.8), dir, enemies);
        GAME.Audio.dash();
        GAME.HUD.killFeed('巡飞弹已发射');
        break;
      default:
        this.skillCd = 0;
    }
  },

  // 搜索一个容器的耗时（干员特性可调整）
  searchTime: function () {
    return GAME.Config.SEARCH_TIME * ((this._pw && this._pw.searchMul) || 1);
  },

  // 当前手持武器信息（HUD 用）
  hpPct: function () {
    return Math.max(0, this.hp / this.maxHp);
  }
};
