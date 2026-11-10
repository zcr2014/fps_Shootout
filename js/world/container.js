// ===== 可搜索容器：楼内和野外的补给箱，按住 F 搜刮 =====
window.GAME = window.GAME || {};

GAME.Containers = {
  list: [],   // { typeKey, name, pos, group, mat, contents:[itemId], searched }
  scene: null,

  TYPES: {
    crate: { name: '木制补给箱', color: 0x9a7440, lid: 0x6f5230, count: [2, 4], weight: 40 },
    ammo:  { name: '弹药箱',     color: 0x4f6b42, lid: 0x3a5033, count: [2, 4], weight: 30 },
    med:   { name: '医疗箱',     color: 0xd9d9d9, lid: 0xb03a2e, count: [2, 3], weight: 18 },
    safe:  { name: '保险柜',     color: 0x3c4654, lid: 0x2b333e, count: [1, 3], weight: 12 }
  },

  spawnAll: function (scene, def) {
    var U = GAME.Utils;
    this.scene = scene;
    this.list = [];
    var count = def.containers || 0;
    var placed = 0;

    // 1) 楼内一楼（约 60%）
    var interiors = GAME.Map.interiors;
    if (interiors.length > 0) {
      var per1 = Math.ceil((count * 0.6) / interiors.length);
      for (var bi = 0; bi < interiors.length && placed < count; bi++) {
        for (var k = 0; k < per1 && placed < count; k++) {
          var pos = this._randomInside(interiors[bi], 0, false);
          if (pos) {
            this._create(this._pickType(), pos, def);
            placed++;
          }
        }
      }
    }

    // 2) 楼内二楼（约 15%）
    var interiors2 = GAME.Map.interiors2 || [];
    if (interiors2.length > 0) {
      var per2 = Math.ceil((count * 0.15) / interiors2.length);
      for (var b2 = 0; b2 < interiors2.length && placed < count; b2++) {
        for (var k2 = 0; k2 < per2 && placed < count; k2++) {
          var p2 = this._randomInside(interiors2[b2], 5.3, true);
          if (p2) {
            this._create(this._pickType(), p2, def);
            placed++;
          }
        }
      }
    }

    // 3) 二楼锁定房间：每间放一个高级容器（需要房卡才能进）
    var rooms = GAME.Map.lockedRooms || [];
    var richTable = def.richTable || def.lootTable;
    for (var ri = 0; ri < rooms.length; ri++) {
      var room = rooms[ri];
      var rp = this._randomInRoom(room);
      if (rp) this._create('safe', rp, def, richTable);
    }

    // 4) 不够的放野外
    var guard = 0;
    while (placed < count && guard < count * 30) {
      guard++;
      var p = U.randomFreePos(GAME.Map.half, GAME.Map.obstacles, 1.0);
      if (GAME.Map._insideAnyBuilding(p.x, p.z)) continue;
      this._create(this._pickType(), p, def);
      placed++;
    }
  },

  _pickType: function () {
    var keys = Object.keys(this.TYPES);
    var total = 0, i;
    for (i = 0; i < keys.length; i++) total += this.TYPES[keys[i]].weight;
    var r = Math.random() * total;
    for (i = 0; i < keys.length; i++) {
      r -= this.TYPES[keys[i]].weight;
      if (r <= 0) return keys[i];
    }
    return keys[0];
  },

  // 在楼房内部随机找一个能站人的点（y 为楼层高度）
  _randomInside: function (interior, y, avoidLocked) {
    var U = GAME.Utils;
    for (var i = 0; i < 24; i++) {
      var x = U.rand(interior.min.x + 2, interior.max.x - 2);
      var z = U.rand(interior.min.z + 2, interior.max.z - 2);
      if (avoidLocked && GAME.Map._insideLockedRoom(x, z)) continue;
      if (!U.pointInAnyBox(x, z, GAME.Map.obstacles, 0.9)) {
        return new THREE.Vector3(x, y || 0, z);
      }
    }
    return null;
  },

  // 锁定房间内部（避开墙和桌子）
  _randomInRoom: function (room) {
    var U = GAME.Utils;
    for (var i = 0; i < 24; i++) {
      var x = U.rand(room.minX + 1.4, room.maxX - 1.4);
      var z = U.rand(room.minZ + 2.0, room.maxZ - 1.4);
      if (!U.pointInAnyBox(x, z, GAME.Map.obstacles, 0.8)) {
        return new THREE.Vector3(x, room.y, z);
      }
    }
    return null;
  },

  _create: function (typeKey, pos, def, table) {
    var type = this.TYPES[typeKey];
    var n = GAME.Utils.randInt(type.count[0], type.count[1]);
    var contents = [];
    for (var i = 0; i < n; i++) {
      contents.push(GAME.Items.pickFromTable(table || def.lootTable));
    }

    var group = new THREE.Group();
    // 按箱子类型套用程序化贴图：木箱=木纹、弹药箱=金属、医疗箱=红十字、保险柜=金属
    var tex = GAME.Map.tex ? (GAME.Map.tex[typeKey === 'crate' ? 'wood' : typeKey === 'med' ? 'med' : 'metal']) : null;
    var mat = new THREE.MeshLambertMaterial({
      color: type.color, emissive: new THREE.Color(type.color).multiplyScalar(0.18),
      map: tex || null
    });
    var box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 1.0), mat);
    box.position.y = 0.45;
    box.castShadow = true;
    var lidMat = new THREE.MeshLambertMaterial({
      color: type.lid,
      map: GAME.Map.tex ? GAME.Map.tex.metal : null
    });
    var lid = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 1.1), lidMat);
    lid.position.y = 1.0;
    lid.castShadow = true;
    group.add(box); group.add(lid);
    group.position.copy(pos);
    this.scene.add(group);

    this.list.push({
      typeKey: typeKey,
      name: type.name,
      pos: group.position,
      group: group,
      mat: mat,
      lid: lid,
      lidOpen: { rotX: -0.85, y: 1.3, z: -0.42 },
      contents: contents,
      searched: false
    });
  },

  // AI 阵亡后掉落的「死亡盒子」：深灰盒身 + 红色警示边 + 可翻盖，纳入搜刮流程
  spawnAiBox: function (scene, pos, def) {
    this.scene = scene;
    var group = new THREE.Group();
    var mat = new THREE.MeshLambertMaterial({
      color: 0x23262b,
      emissive: new THREE.Color(0x661414).multiplyScalar(0.55)
    });
    var box = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.7), mat);
    box.position.y = 0.25;
    box.castShadow = true;
    var lidMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
    var lid = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.8), lidMat);
    lid.position.y = 0.55;
    group.add(box); group.add(lid);
    // 红色警示边条（一眼认出这是死亡盒子）
    var edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.04, 0.54, 0.74)),
      new THREE.LineBasicMaterial({ color: 0xd23c2e })
    );
    edge.position.y = 0.25;
    group.add(edge);
    // 落在敌人脚下（贴地）
    var gy = GAME.Map.heightAt ? GAME.Map.heightAt(pos.x, pos.z, pos.y) : 0;
    group.position.set(pos.x, gy, pos.z);
    scene.add(group);

    // 战利品：随机物资 1~2 件 + 50% 掉枪 + 40% 急救包
    var contents = [];
    var n = GAME.Utils.randInt(1, 2);
    for (var i = 0; i < n; i++) contents.push(GAME.Items.pickFromTable(def.lootTable));
    if (Math.random() < 0.5) {
      // 枪械掉落按稀有度加权：MP5 常见，M700 少见
      var gunPool = ['mp5', 'mp5', 'mp5', 'mp5', 'ak12', 'ak12', 'ak12', 'm700', 'p92'];
      contents.push(gunPool[Math.floor(Math.random() * gunPool.length)]);
    }
    if (Math.random() < 0.4) contents.push('medkit');

    var c = {
      typeKey: 'aibox',
      name: '死亡盒子',
      pos: group.position,
      group: group,
      mat: mat,
      lid: lid,
      lidOpen: { rotX: -0.85, y: 0.82, z: -0.30 },
      contents: contents,
      searched: false
    };
    this.list.push(c);
    return c;
  },

  // 返回玩家附近可搜索的最近容器（已搜空的跳过）
  update: function (dt, playerPos) {
    var U = GAME.Utils;
    var nearest = null, nearestDist = GAME.Config.PICKUP_RANGE;
    for (var i = 0; i < this.list.length; i++) {
      var c = this.list[i];
      if (c.contents.length === 0) continue;
      if (Math.abs(c.pos.y - playerPos.y) > 2.2) continue; // 楼上楼下互不干扰
      var d = U.dist2D(c.pos, playerPos);
      if (d < nearestDist) { nearestDist = d; nearest = c; }
    }
    // 未搜刮的容器轻微呼吸发光
    var pulse = 0.14 + Math.sin(performance.now() / 400) * 0.06;
    for (var j = 0; j < this.list.length; j++) {
      var c2 = this.list[j];
      if (c2.contents.length > 0 && c2.mat.emissive) {
        c2.mat.emissive.setRGB(pulse * 0.9, pulse * 0.7, 0.02);
      }
    }
    return nearest;
  },

  // 把容器里的东西尽量装进背包（格子/负重放不下就留在容器里），返回实际拿到的物品 id
  takeContents: function (c, player) {
    var taken = [];
    while (c.contents.length > 0) {
      var id = c.contents[0];
      if (!player.pickItem(id)) break;
      c.contents.shift();
      taken.push(id);
    }
    if (c.contents.length === 0) this.markEmpty(c);
    return taken;
  },

  // 翻开箱盖（开箱面板打开时调用，一次性；小盒子的开盖参数单独调过）
  openLid: function (c) {
    if (!c.lid || c.lidOpened) return;
    c.lidOpened = true;
    var o = c.lidOpen || { rotX: -0.85, y: 1.3, z: -0.42 };
    c.lid.rotation.x = o.rotX;
    c.lid.position.y = o.y;
    c.lid.position.z = o.z;
  },

  markEmpty: function (c) {
    c.searched = true;
    c.mat.color.setHex(0x4a4a4a);
    c.mat.emissive.setHex(0x000000);
  }
};
