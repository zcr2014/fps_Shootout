// ===== 物资：地图上散落的可拾取物品（颜色按稀有度区分）=====
window.GAME = window.GAME || {};

GAME.Loot = {
  items: [],    // { itemId, mesh, taken }
  scene: null,

  // 少量散落在地面上的物资（大部分在容器里）
  spawnAll: function (scene, def) {
    var U = GAME.Utils;
    this.scene = scene;
    this.items = [];
    var count = def.groundLoot || 0;
    for (var i = 0; i < count; i++) {
      var itemId = GAME.Items.pickFromTable(def.lootTable);
      var p = U.randomFreePos(GAME.Map.half, GAME.Map.obstacles, 0.6);
      if (GAME.Map._insideAnyBuilding(p.x, p.z)) { i--; continue; }
      this._create(itemId, p);
    }
  },

  _create: function (itemId, pos) {
    var item = GAME.Items.get(itemId);
    var color = new THREE.Color(GAME.Items.color(item));
    var mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.6, 0.9),
      new THREE.MeshLambertMaterial({ color: color, emissive: color.clone().multiplyScalar(0.45) })
    );
    mesh.position.set(pos.x, 0.45, pos.z);
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.items.push({ itemId: itemId, mesh: mesh, taken: false });
  },

  // 旋转浮动 + 找最近的物资
  update: function (dt, playerPos, elapsed) {
    var C = GAME.Config, U = GAME.Utils;
    var nearest = null, nearestDist = C.PICKUP_RANGE;
    for (var i = 0; i < this.items.length; i++) {
      var it = this.items[i];
      if (it.taken) continue;
      it.mesh.rotation.y += dt * 1.5;
      it.mesh.position.y = 0.45 + Math.sin(elapsed * 2 + i) * 0.08;
      if (playerPos.y > 2.2) continue; // 站在二楼时不能隔楼拾取地面物资
      var d = U.dist2D(it.mesh.position, playerPos);
      if (d < nearestDist) { nearestDist = d; nearest = it; }
    }
    return nearest;
  },

  // 拾取，返回物品 id
  take: function (item) {
    if (!item || item.taken) return null;
    item.taken = true;
    this.scene.remove(item.mesh);
    return item.itemId;
  },

  // 敌人死亡掉落
  dropAt: function (pos, itemId) {
    this._create(itemId, pos);
  }
};
