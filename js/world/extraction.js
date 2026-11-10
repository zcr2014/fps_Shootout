// ===== 撤离点：绿色光柱与撤离计时 =====
window.GAME = window.GAME || {};

GAME.Extraction = {
  points: [],
  progress: 0,
  activePoint: -1,
  cfg: { time: 3, radius: 4 },

  spawnAll: function (scene, def) {
    var U = GAME.Utils;
    var half = GAME.Map.half;
    var radius = GAME.Config.EXTRACT_RADIUS;
    this.points = [];
    this.progress = 0;
    this.activePoint = -1;
    this.cfg = { time: def.extractTime, radius: radius };

    // 四个角落区域里随机挑两个不相邻的点
    var spots = [
      new THREE.Vector3(-half + 14, 0, -half + 14),
      new THREE.Vector3(half - 14, 0, half - 14),
      new THREE.Vector3(half - 14, 0, -half + 14),
      new THREE.Vector3(-half + 14, 0, half - 14)
    ];
    var idxA = U.randInt(0, 3);
    var chosen = [spots[idxA], spots[(idxA + 2) % 4]].slice(0, def.extractPoints || 2);

    var self = this;
    chosen.forEach(function (p) {
      var beam = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.5, radius * 0.5, 30, 20, 1, true),
        new THREE.MeshBasicMaterial({
          color: GAME.Config.COLOR.EXTRACT, transparent: true, opacity: 0.28,
          side: THREE.DoubleSide, depthWrite: false
        })
      );
      beam.position.set(p.x, 15, p.z);
      scene.add(beam);

      var ring = new THREE.Mesh(
        new THREE.RingGeometry(radius - 0.5, radius, 32),
        new THREE.MeshBasicMaterial({ color: GAME.Config.COLOR.EXTRACT, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(p.x, 0.05, p.z);
      scene.add(ring);
      self.points.push({ pos: p, beam: beam, ring: ring });
    });
  },

  // 返回 { inside, progress01, done }
  update: function (dt, playerPos) {
    var U = GAME.Utils;
    var radius = this.cfg.radius;
    this.activePoint = -1;
    for (var i = 0; i < this.points.length; i++) {
      if (U.dist2D(this.points[i].pos, playerPos) < radius) { this.activePoint = i; break; }
    }

    if (this.activePoint >= 0) {
      var before = this.progress;
      this.progress += dt;
      if (Math.floor(this.progress) > Math.floor(before)) GAME.Audio.extractTick();
    } else {
      this.progress = 0; // 离开撤离区就清零
    }

    return {
      inside: this.activePoint >= 0,
      progress01: U.clamp(this.progress / this.cfg.time, 0, 1),
      done: this.progress >= this.cfg.time
    };
  }
};
