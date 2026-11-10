// ===== 干员战术装备实体：治疗无人机 / 侦察箭 / 磁吸炸弹 / 声波瘫痪 / 信号解码 / 巡飞弹 =====
// 所有技能的临时 3D 效果都注册到 effects 里，每帧统一 update，超时自动销毁。
window.GAME = window.GAME || {};

GAME.Skills = {
  scene: null,
  effects: [],   // [{ update(dt) -> true 继续 / false 销毁 }]

  init: function (scene) {
    this.scene = scene;
    this.effects = [];
  },

  // 换场景（回大厅/重新出击）时清空列表（网格体已随 clearScene 销毁）
  clear: function () {
    this.effects = [];
    this.scene = null;
  },

  update: function (dt, player, enemies) {
    for (var i = this.effects.length - 1; i >= 0; i--) {
      if (!this.effects[i].update(dt)) {
        this.effects.splice(i, 1);
      }
    }
  },

  // ---------- 蜂医：治疗无人机 ----------
  spawnDrone: function (player, duration, healPerSec) {
    var scene = this.scene;
    if (!scene) return;
    var self = this;

    var group = new THREE.Group();
    var body = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0x9fe8b4, emissive: 0x1d5c30 })
    );
    group.add(body);
    // 旋转的旋翼环
    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.035, 6, 18),
      new THREE.MeshBasicMaterial({ color: 0x3fa34d })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    var light = new THREE.PointLight(0x66ff99, 0.9, 7);
    group.add(light);
    scene.add(group);

    var t = duration, healAcc = 0;
    this.effects.push({
      update: function (dt) {
        t -= dt;
        if (t <= 0 || !player.alive) {
          scene.remove(group);
          return false;
        }
        // 跟在玩家头顶偏前，轻微上下浮动
        var bob = Math.sin(performance.now() / 300) * 0.08;
        group.position.set(player.pos.x + 0.4, player.pos.y + 2.35 + bob, player.pos.z - 0.3);
        ring.rotation.z += dt * 12;
        healAcc += healPerSec * dt;
        if (healAcc >= 1) {
          var n = Math.floor(healAcc);
          healAcc -= n;
          player.hp = Math.min(player.maxHp, player.hp + n);
        }
        return true;
      }
    });
  },

  // ---------- 露娜：侦察箭（飞行 → 落地 → 范围标记）----------
  spawnArrow: function (from, dir, markDur, radius, enemies) {
    var scene = this.scene;
    if (!scene) return;
    var U = GAME.Utils;

    var mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.55, 6),
      new THREE.MeshBasicMaterial({ color: 0xc9a6ff })
    );
    mesh.position.copy(from);
    scene.add(mesh);

    var vel = dir.clone().normalize().multiplyScalar(30);
    vel.y = 6;                       // 略微上抛的抛物线
    var flight = 0.9, t = flight;
    var trail = [];
    var self = this;

    this.effects.push({
      update: function (dt) {
        t -= dt;
        mesh.position.addScaledVector(vel, dt);
        vel.y -= 12 * dt;
        mesh.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0), vel.clone().normalize());

        // 紫色尾迹粒子
        trail.push({ p: mesh.position.clone(), life: 0.35 });
        for (var i = trail.length - 1; i >= 0; i--) {
          trail[i].life -= dt;
          if (trail[i].life <= 0) trail.splice(i, 1);
        }
        // 尾迹用一条动态线段表现（每帧重建，量小可接受）
        if (trail.length > 1) {
          var pts = [];
          for (var k = 0; k < trail.length; k++) pts.push(trail[k].p);
          if (this.trailLine) {
            scene.remove(this.trailLine);
            this.trailLine.geometry.dispose();
          }
          this.trailLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineBasicMaterial({ color: 0xc9a6ff, transparent: true, opacity: 0.6 }));
          scene.add(this.trailLine);
        }

        var landed = t <= 0 ||
          mesh.position.y <= 0.15 ||
          U.pointInAnyBox(mesh.position.x, mesh.position.z, GAME.Map.obstacles, 0);
        if (!landed) {
          // 沿途微型传感器：飞行路径附近的敌人也会被标记
          for (var s = 0; s < enemies.length; s++) {
            var se = enemies[s];
            if (se.alive && U.dist2D(se.pos, mesh.position) < 6) se.mark(markDur, 'luna');
          }
          return true;
        }

        // 落地：标记范围内敌人 + 光柱提示
        var pos = mesh.position.clone();
        pos.y = Math.max(0.2, pos.y);
        scene.remove(mesh);
        if (this.trailLine) { scene.remove(this.trailLine); this.trailLine.geometry.dispose(); }

        for (var j = 0; j < enemies.length; j++) {
          var e = enemies[j];
          if (e.alive && U.dist2D(e.pos, pos) < radius) e.mark(markDur, 'luna');
        }
        self._beacon(pos, markDur, 0xa06bff, radius);
        GAME.Audio.scan();
        return false;
      }
    });
  },

  // 落点光柱（侦察标记的视觉提示）
  _beacon: function (pos, dur, colorHex, radius) {
    var scene = this.scene;
    var ring = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.25, radius, 32),
      new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.08, pos.z);
    scene.add(ring);
    var beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.05, 6, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    beam.position.set(pos.x, 3, pos.z);
    scene.add(beam);
    var t = dur;
    this.effects.push({
      update: function (dt) {
        t -= dt;
        if (t <= 0) {
          scene.remove(ring); scene.remove(beam);
          ring.geometry.dispose(); beam.geometry.dispose();
          return false;
        }
        ring.material.opacity = 0.25 + Math.sin(t * 5) * 0.15;
        beam.material.opacity = 0.2 + Math.sin(t * 5) * 0.1;
        return true;
      }
    });
  },

  // ---------- 威龙：磁吸炸弹（抛物线 → 落地引信 → 爆炸）----------
  spawnBomb: function (from, dir, fuse, radius, damage, enemies) {
    var scene = this.scene;
    if (!scene) return;
    var U = GAME.Utils, self = this;

    var mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0x2f353c, emissive: 0x552200 })
    );
    mesh.position.copy(from);
    scene.add(mesh);

    var vel = new THREE.Vector3(dir.x, 0, dir.z).normalize().multiplyScalar(11);
    vel.y = 5;
    var blinkT = 0;

    this.effects.push({
      update: function (dt) {
        // 空中飞行 + 落地滚动
        if (mesh.position.y > 0.16 || vel.y > 0) {
          mesh.position.addScaledVector(vel, dt);
          vel.y -= 14 * dt;
          if (mesh.position.y <= 0.16) {
            mesh.position.y = 0.16;
            vel.y = 0;
            vel.x *= 0.4; vel.z *= 0.4;
          }
        } else {
          mesh.position.x += vel.x * dt;
          mesh.position.z += vel.z * dt;
          vel.x *= 0.9; vel.z *= 0.9;
        }

        fuse -= dt;
        // 引信红灯快闪
        blinkT += dt;
        mesh.material.emissive.setHex(
          (Math.floor(blinkT * 8) % 2 === 0) ? 0xff3300 : 0x330000);
        if (fuse > 0) return true;

        // 爆炸
        var pos = mesh.position.clone();
        scene.remove(mesh);
        self._explosion(pos, radius, damage, enemies);
        return false;
      }
    });
  },

  // 只结算范围伤害（不产生特效）
  _blastDamage: function (pos, radius, damage, enemies) {
    var U = GAME.Utils;
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (e.alive && U.dist2D(e.pos, pos) < radius && Math.abs(e.pos.y - pos.y) < 3.5) {
        var died = e.takeDamage(damage);
        if (died && GAME.Game.onKill) GAME.Game.onKill(e);
      }
    }
  },

  _explosion: function (pos, radius, damage, enemies, quiet) {
    var scene = this.scene;

    this._blastDamage(pos, radius, damage, enemies);

    // 爆炸闪光球 + 点光 + 扩散冲击环
    var flash = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffa726, transparent: true, opacity: 0.95 })
    );
    flash.position.set(pos.x, pos.y + 0.6, pos.z);
    scene.add(flash);
    var light = new THREE.PointLight(0xffb35c, 3.5, radius * 4);
    light.position.copy(flash.position);
    scene.add(light);
    var shock = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.8, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd8a0, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    shock.rotation.x = -Math.PI / 2;
    shock.position.set(pos.x, 0.1, pos.z);
    scene.add(shock);

    var t = 0.45;
    if (!quiet) {
      GAME.Audio.explosion();
      GAME.HUD.damageFlash();
    }
    this.effects.push({
      update: function (dt) {
        t -= dt;
        if (t <= 0) {
          scene.remove(flash); scene.remove(light); scene.remove(shock);
          flash.geometry.dispose();
          return false;
        }
        var p = 1 - t / 0.45;
        flash.scale.setScalar(1 + p * radius * 1.4);
        flash.material.opacity = 0.95 * (1 - p);
        light.intensity = 3.5 * (1 - p);
        shock.scale.setScalar(1 + p * radius * 1.6);
        shock.material.opacity = 0.8 * (1 - p);
        return true;
      }
    });
  },

  // 小范围冲击环（巡飞弹子弹药用，不额外产生点光）
  _shockRing: function (pos, radius) {
    var scene = this.scene;
    var ring = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.6, 22),
      new THREE.MeshBasicMaterial({ color: 0xffc06a, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.12, pos.z);
    scene.add(ring);
    var t = 0.4;
    this.effects.push({
      update: function (dt) {
        t -= dt;
        if (t <= 0) {
          scene.remove(ring);
          ring.geometry.dispose();
          return false;
        }
        var p = 1 - t / 0.4;
        ring.scale.setScalar(1 + p * radius * 1.5);
        ring.material.opacity = 0.85 * (1 - p);
        return true;
      }
    });
  },

  // ---------- 乌鲁鲁：巡飞弹（飞行 → 命中 → 分裂 4 枚子弹药）----------
  spawnLoiter: function (from, dir, enemies) {
    var scene = this.scene;
    if (!scene) return;
    var U = GAME.Utils, self = this;

    var missile = new THREE.Group();
    var bodyMat = new THREE.MeshLambertMaterial({ color: 0x6f7a5c, emissive: 0x141a0c });
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8), bodyMat);
    body.rotation.x = Math.PI / 2;
    missile.add(body);
    var tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 8),
      new THREE.MeshLambertMaterial({ color: 0xc9802d, emissive: 0x3a1e00 }));
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 0.35;
    missile.add(tip);
    var glow = new THREE.PointLight(0xffa040, 1.2, 5);
    missile.add(glow);
    missile.position.copy(from);
    scene.add(missile);

    var vel = dir.clone().normalize().multiplyScalar(30);
    vel.y = 2.5;
    var t = 1.2;
    var trail = [];

    this.effects.push({
      update: function (dt) {
        t -= dt;
        missile.position.addScaledVector(vel, dt);
        vel.y -= 6 * dt;
        missile.lookAt(missile.position.clone().add(vel));

        // 橙色尾迹
        trail.push({ p: missile.position.clone(), life: 0.3 });
        for (var i = trail.length - 1; i >= 0; i--) {
          trail[i].life -= dt;
          if (trail[i].life <= 0) trail.splice(i, 1);
        }
        if (trail.length > 1) {
          var pts = [];
          for (var k = 0; k < trail.length; k++) pts.push(trail[k].p);
          if (this.trailLine) {
            scene.remove(this.trailLine);
            this.trailLine.geometry.dispose();
          }
          this.trailLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.65 }));
          scene.add(this.trailLine);
        }

        var hit = t <= 0 || missile.position.y <= 0.3 ||
          U.pointInAnyBox(missile.position.x, missile.position.z, GAME.Map.obstacles, 0);
        if (!hit) return true;

        // 命中：中心爆炸 + 4 枚子弹药
        var center = missile.position.clone();
        center.y = Math.max(0.3, center.y);
        scene.remove(missile);
        if (this.trailLine) { scene.remove(this.trailLine); this.trailLine.geometry.dispose(); }

        self._explosion(center, 4.5, 60, enemies, true);
        for (var b = 0; b < 4; b++) {
          var ang = b * Math.PI / 2 + Math.random() * 0.5;
          var sub = new THREE.Vector3(
            center.x + Math.cos(ang) * 2.4,
            0.25,
            center.z + Math.sin(ang) * 2.4);
          self._blastDamage(sub, 3.2, 35, enemies);
          self._shockRing(sub, 3.2);
        }
        GAME.Audio.explosion();
        GAME.HUD.damageFlash();
        return false;
      }
    });
  },

  // ---------- 牧羊人：声波瘫痪（声波脉冲 → 减速 + 降低射速）----------
  sonicPulse: function (pos, radius, dur, enemies) {
    var scene = this.scene, U = GAME.Utils;
    var ring = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 1.0, 40),
      new THREE.MeshBasicMaterial({ color: 0x8fe8ff, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 1.0, pos.z);
    scene.add(ring);
    var beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 3.2, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x8fe8ff, transparent: true, opacity: 0.16,
        side: THREE.DoubleSide, depthWrite: false
      })
    );
    beam.position.set(pos.x, 1.6, pos.z);
    scene.add(beam);

    var t = 0.75, spread = 0;
    GAME.Audio.jam();
    this.effects.push({
      update: function (dt) {
        t -= dt;
        if (t <= 0) {
          scene.remove(ring); scene.remove(beam);
          ring.geometry.dispose(); beam.geometry.dispose();
          return false;
        }
        spread += (radius / 0.75) * dt;
        ring.scale.setScalar(Math.max(0.05, spread));
        ring.material.opacity = 0.85 * (t / 0.75);
        beam.material.opacity = 0.16 * (t / 0.75);
        return true;
      }
    });

    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (e.alive && U.dist2D(e.pos, pos) < radius) e.sonicEnemy(dur);
    }
  },

  // ---------- 骇爪：信号解码器（扫描最近敌人 → 标记 + 瘫痪电子设备）----------
  scanSignals: function (pos, radius, enemies, count, markDur, jamDur) {
    var scene = this.scene, U = GAME.Utils;
    var ring = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.2, 40),
      new THREE.MeshBasicMaterial({ color: 0xff3b5c, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 1.2, pos.z);
    scene.add(ring);

    var t = 0.8, spread = 0;
    GAME.Audio.jam();
    this.effects.push({
      update: function (dt) {
        t -= dt;
        if (t <= 0) {
          scene.remove(ring);
          ring.geometry.dispose();
          return false;
        }
        spread += (radius / 0.8) * dt;
        ring.scale.setScalar(Math.max(0.05, spread));
        ring.material.opacity = 0.85 * (t / 0.8);
        return true;
      }
    });

    // 按距离排序，锁定最近的 count 个电子信号
    var arr = [];
    for (var i = 0; i < enemies.length; i++) {
      if (!enemies[i].alive) continue;
      var d = U.dist2D(enemies[i].pos, pos);
      if (d < radius) arr.push({ e: enemies[i], d: d });
    }
    arr.sort(function (a, b) { return a.d - b.d; });
    var n = Math.min(count, arr.length);
    for (var k = 0; k < n; k++) {
      arr[k].e.mark(markDur, 'hackclaw');
      arr[k].e.jamEnemy(jamDur);
    }
    return n;
  }
};
