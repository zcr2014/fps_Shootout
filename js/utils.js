// ===== 工具函数：数学、随机数、碰撞 =====
window.GAME = window.GAME || {};

GAME.Utils = {
  // [min, max) 随机小数
  rand: function (min, max) { return min + Math.random() * (max - min); },

  // [min, max] 随机整数
  randInt: function (min, max) { return Math.floor(this.rand(min, max + 1)); },

  // 限制数值范围
  clamp: function (v, min, max) { return Math.max(min, Math.min(max, v)); },

  // 二维平面距离（忽略 Y 轴）
  dist2D: function (a, b) {
    var dx = a.x - b.x, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  },

  // 在地图内随机取一个点，避开障碍物（用 Box3 检测），返回 THREE.Vector3
  randomFreePos: function (mapHalf, obstacles, radius) {
    for (var i = 0; i < 60; i++) {
      var x = this.rand(-mapHalf + 4, mapHalf - 4);
      var z = this.rand(-mapHalf + 4, mapHalf - 4);
      if (!this.pointInAnyBox(x, z, obstacles, radius + 0.4)) {
        return new THREE.Vector3(x, 0, z);
      }
    }
    return new THREE.Vector3(0, 0, 0); // 兜底
  },

  // 检查点 (x,z) 是否落入任一障碍盒（向外扩 pad）
  pointInAnyBox: function (x, z, boxes, pad) {
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      if (x > b.min.x - pad && x < b.max.x + pad &&
          z > b.min.z - pad && z < b.max.z + pad) return true;
    }
    return false;
  },

  // 圆形 vs 轴对齐盒列表 的碰撞解算：直接修改 pos，把圆推出盒外
  resolveCircleCollision: function (pos, radius, boxes, feetY, headY) {
    if (feetY === undefined) feetY = -1e9;
    if (headY === undefined) headY = 1e9;
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      // 楼层过滤：完全在脚下（如二楼楼板）或完全在头顶（如二楼墙体）的盒子不参与碰撞
      if (b.max.y <= feetY + 0.25) continue;
      if (b.min.y >= headY) continue;
      // 找盒子上离圆心最近的点
      var cx = this.clamp(pos.x, b.min.x, b.max.x);
      var cz = this.clamp(pos.z, b.min.z, b.max.z);
      var dx = pos.x - cx, dz = pos.z - cz;
      var d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        var d = Math.sqrt(d2);
        if (d > 0.0001) {
          // 沿法线推出
          var push = (radius - d) / d;
          pos.x += dx * push;
          pos.z += dz * push;
        } else {
          // 圆心在盒内：沿最近边推出
          var l = pos.x - b.min.x, r = b.max.x - pos.x;
          var t = pos.z - b.min.z, bo = b.max.z - pos.z;
          var m = Math.min(l, r, t, bo);
          if (m === l) pos.x = b.min.x - radius;
          else if (m === r) pos.x = b.max.x + radius;
          else if (m === t) pos.z = b.min.z - radius;
          else pos.z = b.max.z + radius;
        }
      }
    }
  },

  // 两点之间是否有障碍盒遮挡（用于敌人视线判断），简单线段采样
  lineBlocked: function (a, b, boxes) {
    var steps = 12;
    for (var i = 1; i < steps; i++) {
      var t = i / steps;
      var x = a.x + (b.x - a.x) * t;
      var z = a.z + (b.z - a.z) * t;
      if (this.pointInAnyBox(x, z, boxes, 0)) return true;
    }
    return false;
  }
};
