// ===== 子弹系统：敌人弹丸（可躲避）+ 玩家射击曳光线 =====
window.GAME = window.GAME || {};

GAME.Bullets = {
  scene: null,
  enemyShots: [],  // { mesh, dir, damage, life }
  tracers: [],     // { line, life }
  impacts: [],     // { mesh, life }

  init: function (scene) {
    this.scene = scene;
    this.enemyShots = [];
    this.tracers = [];
    this.impacts = [];
  },

  // 敌人发射一颗缓慢弹丸（玩家可以走位躲开）
  spawnEnemy: function (from, dir, speed, damage) {
    var C = GAME.Config;
    var mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color: C.COLOR.ENEMY_BULLET })
    );
    mesh.position.copy(from);
    this.scene.add(mesh);
    this.enemyShots.push({
      mesh: mesh,
      vel: dir.clone().multiplyScalar(speed),
      damage: damage,
      life: 3 // 秒
    });
  },

  // 子弹命中火花：一小团快速消散的亮点（打墙尘土色 / 打人红色）
  addImpact: function (point, colorHex) {
    if (!this.scene) return;
    var spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 6, 6),
      new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.95 })
    );
    spark.position.copy(point);
    this.scene.add(spark);
    this.impacts.push({ mesh: spark, life: 0.08 });
  },

  // 玩家命中时的曳光线：一条快速消失的亮线
  addTracer: function (from, to) {
    var geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    var line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: GAME.Config.COLOR.PLAYER_TRACER, transparent: true, opacity: 0.9
    }));
    this.scene.add(line);
    this.tracers.push({ line: line, life: 0.06 });
  },

  // 每帧更新：弹丸移动、撞墙、撞玩家；曳光衰减
  update: function (dt, player, onHitPlayer) {
    var U = GAME.Utils;
    var obstacles = GAME.Map.obstacles;
    var i, s;

    for (i = this.enemyShots.length - 1; i >= 0; i--) {
      s = this.enemyShots[i];
      s.life -= dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      var p = s.mesh.position;

      var dead = (s.life <= 0 || p.y < 0 || p.y > 20 ||
                  U.pointInAnyBox(p.x, p.z, obstacles, 0));

      // 命中玩家：二维距离 + 高度范围（玩家圆柱近似）
      if (!dead && player.alive) {
        var d = U.dist2D(p, player.pos);
        if (d < GAME.Config.PLAYER_RADIUS + 0.15 &&
            p.y > player.pos.y && p.y < player.pos.y + 1.8) {
          onHitPlayer(s.damage);
          dead = true;
        }
      }

      if (dead) {
        this.scene.remove(s.mesh);
        this.enemyShots.splice(i, 1);
      }
    }

    for (i = this.tracers.length - 1; i >= 0; i--) {
      var t = this.tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.06) * 0.9;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        this.tracers.splice(i, 1);
      }
    }

    // 命中火花消散
    for (i = this.impacts.length - 1; i >= 0; i--) {
      var sp = this.impacts[i];
      sp.life -= dt;
      sp.mesh.material.opacity = Math.max(0, sp.life / 0.08);
      sp.mesh.scale.setScalar(1 + (1 - sp.life / 0.08) * 1.6);
      if (sp.life <= 0) {
        this.scene.remove(sp.mesh);
        sp.mesh.geometry.dispose();
        this.impacts.splice(i, 1);
      }
    }
  }
};
