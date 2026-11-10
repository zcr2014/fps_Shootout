// ===== 敌人 AI：巡逻 → 追击 → 攻击 的状态机 =====
window.GAME = window.GAME || {};

GAME.Enemy = {
  // 生成一个敌人，def 为地图配置（决定强度）
  create: function (scene, pos, def) {
    var C = GAME.Config;
    var stats = {
      hp: def.enemyHp,
      speed: def.enemySpeed,
      view: 26,
      attackRange: 18,
      fireInterval: 1.3,
      bulletSpeed: 22,
      damage: def.enemyDmg,
      accuracy: def.enemyAccuracy
    };
    // 人形模型：头/头盔/面罩、躯干/战术背心/弹匣袋、双臂、双腿、分件步枪
    // （每个敌人独立材质，受击时才能只让自己闪白）
    var bodyMat = new THREE.MeshLambertMaterial({ color: 0x5d5340 });  // 深卡其作战服
    var gearMat = new THREE.MeshLambertMaterial({ color: 0x2f3a2f });  // 战术背心/头盔
    var skinMat = new THREE.MeshLambertMaterial({ color: 0xd8a882 });  // 面部肤色
    var darkMat = new THREE.MeshLambertMaterial({ color: 0x1b1d20 });
    var metalMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
    var bootMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
    var patchMat = new THREE.MeshLambertMaterial({ color: 0xd23c2e }); // 红色臂章

    var mkBox = function (w, h, d, mat, x, y, z) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      return m;
    };

    var group = new THREE.Group();
    // 躯干：制服 + 战术背心 + 胸前弹匣袋 + 腰带 + 肩甲
    group.add(mkBox(0.52, 0.50, 0.30, bodyMat, 0, 1.35, 0));
    group.add(mkBox(0.44, 0.30, 0.34, gearMat, 0, 1.38, 0));
    group.add(mkBox(0.10, 0.14, 0.05, gearMat, -0.13, 1.30, -0.17));
    group.add(mkBox(0.10, 0.14, 0.05, gearMat, 0.00, 1.30, -0.17));
    group.add(mkBox(0.10, 0.14, 0.05, gearMat, 0.13, 1.30, -0.17));
    group.add(mkBox(0.46, 0.14, 0.30, gearMat, 0, 1.05, 0));
    group.add(mkBox(0.62, 0.12, 0.30, bodyMat, 0, 1.55, 0));
    // 红色臂章（远处也能一眼认出是敌人）
    group.add(mkBox(0.035, 0.10, 0.10, patchMat, 0.265, 1.42, 0));
    group.add(mkBox(0.035, 0.10, 0.10, patchMat, -0.265, 1.42, 0));

    // 头部：脸 + 战术头盔 + 护目面罩
    group.add(mkBox(0.26, 0.27, 0.26, skinMat, 0, 1.72, 0));
    group.add(mkBox(0.34, 0.17, 0.35, gearMat, 0, 1.83, -0.01));
    group.add(mkBox(0.24, 0.11, 0.06, darkMat, 0, 1.70, -0.14));

    // 双腿（髋部为转轴，走路时前后摆动）
    var legs = [];
    [1, -1].forEach(function (s) {
      var leg = new THREE.Group();
      leg.position.set(0.14 * s, 0.95, 0);
      leg.add(mkBox(0.18, 0.44, 0.20, bodyMat, 0, -0.22, 0));     // 大腿
      leg.add(mkBox(0.15, 0.40, 0.17, bodyMat, 0, -0.62, 0));     // 小腿
      leg.add(mkBox(0.17, 0.12, 0.28, bootMat, 0, -0.87, -0.04)); // 战术靴
      group.add(leg);
      legs.push(leg);
    });

    // 双臂（肩部为转轴）：右臂握枪，左臂托护木
    var arms = [];
    [1, -1].forEach(function (s) {
      var arm = new THREE.Group();
      arm.position.set(0.32 * s, 1.50, 0);
      arm.add(mkBox(0.15, 0.30, 0.16, bodyMat, 0, -0.15, 0));     // 上臂
      arm.add(mkBox(0.13, 0.28, 0.14, bodyMat, 0, -0.42, 0));     // 前臂
      arm.add(mkBox(0.12, 0.11, 0.14, darkMat, 0, -0.58, -0.01)); // 战术手套
      group.add(arm);
      arms.push(arm);
    });
    arms[0].rotation.set(-1.15, 0.18, -0.18);
    arms[1].rotation.set(-1.35, -0.30, 0.20);

    // 分件步枪：机匣、护木枪管、枪口、弹匣、枪托、瞄具
    var rifle = new THREE.Group();
    rifle.add(mkBox(0.07, 0.11, 0.32, darkMat, 0, 0, 0));
    rifle.add(mkBox(0.05, 0.05, 0.26, metalMat, 0, 0.02, -0.26));
    rifle.add(mkBox(0.03, 0.03, 0.12, metalMat, 0, 0.02, -0.45));
    rifle.add(mkBox(0.05, 0.14, 0.08, darkMat, 0, -0.11, 0.02));
    rifle.add(mkBox(0.04, 0.08, 0.16, darkMat, 0, -0.01, 0.22));
    rifle.add(mkBox(0.03, 0.02, 0.10, metalMat, 0, 0.07, -0.02));
    rifle.position.set(0.10, 1.26, -0.50);
    rifle.scale.set(1.25, 1.25, 1.25); // 稍微放大，正面能看清持枪
    group.add(rifle);

    group.position.copy(pos);
    scene.add(group);

    // 头顶标记 sprite：橙色菱形=被标记（侦察箭/鹰眼），紫色环=被干扰
    var markSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: GAME.Enemy._markTexture(), transparent: true, depthWrite: false
    }));
    markSprite.position.y = 2.35;
    markSprite.scale.set(0.55, 0.55, 1);
    markSprite.visible = false;
    group.add(markSprite);
    var jamSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: GAME.Enemy._jamTexture(), transparent: true, depthWrite: false
    }));
    jamSprite.position.y = 2.35;
    jamSprite.scale.set(0.55, 0.55, 1);
    jamSprite.visible = false;
    group.add(jamSprite);

    var enemy = {
      group: group,
      bodyMat: bodyMat,
      hp: stats.hp,
      alive: true,
      dying: 0,                 // 死亡倒地动画剩余时间
      state: 'patrol',          // patrol / chase / attack
      patrolTarget: null,
      fireTimer: GAME.Utils.rand(0.5, 1.5),
      flashTimer: 0,
      marked: 0,                // 被标记剩余秒数（侦察箭/信号解码）
      jam: 0,                   // 电子设备被瘫痪剩余秒数（骇爪）
      sonic: 0,                 // 被声波瘫痪剩余秒数（牧羊人）
      markSprite: markSprite,
      jamSprite: jamSprite,
      pos: group.position,      // 脚底位置引用
      legs: legs, arms: arms, rifle: rifle,
      walkPhase: 0,
      lastPos: group.position.clone(),
      update: null, takeDamage: null
    };
    group.userData.enemy = enemy; // 射线命中时反查敌人

    // 标记/干扰接口（干员技能调用）
    enemy.mark = function (dur, src) {
      this.marked = Math.max(this.marked, dur);
      // 露娜/鹰眼橙色，骇爪红色
      this.markSprite.material.color = new THREE.Color(src === 'hackclaw' ? 0xff3b5c : 0xff9d3c);
    };
    enemy.jamEnemy = function (dur) {
      this.jam = Math.max(this.jam, dur);
    };
    enemy.sonicEnemy = function (dur) {
      this.sonic = Math.max(this.sonic, dur);
    };

    // ---- 每帧行为 ----
    enemy.update = function (dt, playerPos, playerAlive) {
      var U = GAME.Utils;
      // 死亡倒地动画
      if (!this.alive) {
        this.dying -= dt;
        this.group.rotation.z = Math.min(Math.PI / 2, this.group.rotation.z + dt * 6);
        this.group.position.y = Math.max(-0.5, this.group.position.y - dt * 1.2);
        return this.dying <= 0; // true 表示可以移除
      }

      // 受击闪白恢复
      if (this.flashTimer > 0) {
        this.flashTimer -= dt;
        if (this.flashTimer <= 0) this.bodyMat.emissive.setHex(0x000000);
      }

      // 走路动画：按移动距离推进相位，双腿前后交替摆动
      var moved = U.dist2D(this.pos, this.lastPos);
      if (moved > 0.0004) this.walkPhase += moved * 6.5;
      else this.walkPhase += (0 - Math.sin(this.walkPhase)) * dt * 4; // 停下时慢慢收脚
      var sw = Math.sin(this.walkPhase) * 0.55;
      if (this.legs) {
        this.legs[0].rotation.x = sw;
        this.legs[1].rotation.x = -sw;
      }
      this.lastPos.copy(this.pos);

      var dist = U.dist2D(this.pos, playerPos);

      // 标记/干扰/声波计时与头顶显示
      if (this.marked > 0) this.marked -= dt;
      if (this.jam > 0) this.jam -= dt;
      if (this.sonic > 0) this.sonic -= dt;
      this.markSprite.visible = this.marked > 0;
      this.jamSprite.visible = this.jam > 0 || this.sonic > 0;
      if (this.jamSprite.visible) {
        // 电子干扰紫色，声波瘫痪青色
        this.jamSprite.material.color.setHex(this.sonic > 0 ? 0x8fe8ff : 0xffffff);
        this.jamSprite.scale.setScalar(0.45 + Math.sin(performance.now() / 120) * 0.08);
      }

      // --- 状态切换 ---
      if (playerAlive && this.jam <= 0) { // 被干扰时完全失去索敌能力
        var canSee = dist < stats.view &&
                     !U.lineBlocked(this.pos, playerPos, GAME.Map.obstacles);
        if (canSee) {
          this.state = (dist < stats.attackRange) ? 'attack' : 'chase';
        } else if (this.state !== 'patrol' && dist > stats.view * 1.5) {
          this.state = 'patrol'; // 跟丢了
        }
      } else if (this.jam > 0) {
        this.state = 'patrol'; // 干扰中强制巡逻（不索敌不开火）
      } else {
        this.state = 'patrol';
      }

      // --- 各状态行为 ---
      var moveTarget = null, moveSpeed = 0;
      if (this.state === 'patrol') {
        if (!this.patrolTarget || U.dist2D(this.pos, this.patrolTarget) < 1.5) {
          this.patrolTarget = U.randomFreePos(GAME.Map.half, GAME.Map.obstacles, 0.6);
        }
        moveTarget = this.patrolTarget;
        moveSpeed = stats.speed * 0.5;
      } else if (this.state === 'chase') {
        moveTarget = playerPos;
        moveSpeed = stats.speed;
      } else if (this.state === 'attack') {
        // 面向玩家并开火
        this.group.rotation.y = Math.atan2(playerPos.x - this.pos.x, playerPos.z - this.pos.z);
        this.fireTimer -= dt;
        if (this.fireTimer <= 0) {
          // 声波瘫痪期间射速降低 40%
          this.fireTimer = stats.fireInterval * (this.sonic > 0 ? 1.7 : 1);
          this._shootAt(playerPos);
        }
      }

      // 移动（带碰撞；干扰时减速）
      if (moveTarget) {
        var dx = moveTarget.x - this.pos.x, dz = moveTarget.z - this.pos.z;
        var d = Math.sqrt(dx * dx + dz * dz);
        var spd = moveSpeed * (this.jam > 0 ? 0.45 : 1) * (this.sonic > 0 ? 0.5 : 1);
        if (d > 0.01) {
          this.pos.x += (dx / d) * spd * dt;
          this.pos.z += (dz / d) * spd * dt;
          U.resolveCircleCollision(this.pos, 0.6, GAME.Map.obstacles);
        }
        if (this.state !== 'attack') {
          this.group.rotation.y = Math.atan2(dx, dz);
        }
      }
      return false;
    };

    // ---- 开火：朝玩家胸口发射带散布的弹丸 ----
    enemy._shootAt = function (playerPos) {
      var from = this.pos.clone(); from.y = 1.3;
      var aim = new THREE.Vector3(playerPos.x, playerPos.y + 1.4, playerPos.z);
      var dir = aim.sub(from).normalize();
      // 加散布
      dir.x += GAME.Utils.rand(-stats.accuracy, stats.accuracy) * 10;
      dir.y += GAME.Utils.rand(-stats.accuracy, stats.accuracy) * 4;
      dir.z += GAME.Utils.rand(-stats.accuracy, stats.accuracy) * 10;
      dir.normalize();
      GAME.Bullets.spawnEnemy(from, dir, stats.bulletSpeed, stats.damage);
      GAME.Audio.enemyShoot();
    };

    // ---- 受伤：返回是否死亡 ----
    enemy.takeDamage = function (d) {
      if (!this.alive) return false;
      this.hp -= d;
      this.bodyMat.emissive.setHex(0xffffff); // 闪白
      this.flashTimer = 0.08;
      if (this.hp <= 0) {
        this.alive = false;
        this.dying = 1.2;
        return true;
      }
      // 被打会警觉：立刻进入追击
      this.state = 'chase';
      return false;
    };

    return enemy;
  },

  // 生成一批敌人（避开出生点中心区域）
  spawnAll: function (scene, def) {
    var list = [];
    var U = GAME.Utils;
    for (var i = 0; i < def.enemies; i++) {
      var p;
      do {
        p = U.randomFreePos(GAME.Map.half, GAME.Map.obstacles, 0.6);
      } while (Math.abs(p.x) < 15 && Math.abs(p.z) < 15);
      list.push(this.create(scene, p, def));
    }
    return list;
  },

  // 头顶标记贴图：菱形（缓存一次）
  _markTexture: function () {
    if (this._markTex) return this._markTex;
    var c = document.createElement('canvas');
    c.width = c.height = 64;
    var g = c.getContext('2d');
    g.strokeStyle = '#ff9d3c';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(32, 6); g.lineTo(54, 32); g.lineTo(32, 58); g.lineTo(10, 32);
    g.closePath(); g.stroke();
    g.fillStyle = 'rgba(255,157,60,0.55)';
    g.fill();
    this._markTex = new THREE.CanvasTexture(c);
    return this._markTex;
  },

  // 头顶干扰贴图：紫色电波圈
  _jamTexture: function () {
    if (this._jamTex) return this._jamTex;
    var c = document.createElement('canvas');
    c.width = c.height = 64;
    var g = c.getContext('2d');
    g.strokeStyle = '#d06bff';
    g.lineWidth = 4;
    for (var r = 10; r <= 26; r += 8) {
      g.beginPath();
      g.arc(32, 32, r, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = '#d06bff';
    g.beginPath(); g.arc(32, 32, 5, 0, Math.PI * 2); g.fill();
    this._jamTex = new THREE.CanvasTexture(c);
    return this._jamTex;
  }
};
