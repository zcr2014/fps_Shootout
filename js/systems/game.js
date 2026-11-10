// ===== 游戏主控：大厅 ↔ 战局 状态机与主循环 =====
window.GAME = window.GAME || {};

GAME.Game = {
  renderer: null, scene: null, camera: null,
  state: 'hub',            // hub / playing / paused / result
  enemies: [],
  timeLeft: 0, elapsed: 0,
  clock: null,
  nearLoot: null,
  searchTarget: null,      // 当前正在搜的容器
  searchTimer: 0,          // 已按住 F 的秒数
  hubAngle: 0,
  currentMap: null,
  lastMapId: GAME.Maps ? GAME.Maps.DEFAULT : 'dam',
  raidGear: null,          // { weaponId, weaponFree, armorId }
  raidMeds: 0,

  init: function () {
    var self = this;
    GAME.Profile.load();

    // --- 渲染器 ---
    var canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // 色彩管线：sRGB + ACES 电影感色调映射，画面更接近现代战术射击游戏
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    // --- 场景与相机 ---
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);
    this.scene.add(this.camera); // 相机挂进场景，枪模型才会被渲染

    // --- 子系统 ---
    GAME.Input.init(canvas);
    GAME.Audio.ensure();
    GAME.HUD.init();
    GAME.BagPanel.init();
    GAME.LootPanel.init();
    GAME.Lobby.init(function (mapId) { self.deploy(mapId); });
    GAME.Menu.init({
      backHub: function () { self.backToHub(); },
      again: function () { self.deploy(self.lastMapId); },
      resume: function () { self.resume(); },
      quit: function () { self.endRaid(false, 'quit'); }
    });

    // Esc 解除指针锁定 → 暂停；只有"锁定过又解除"才算暂停，
    // 避免无指针锁定能力的浏览器一进战局就被误判为暂停
    GAME.Input.onLockChange = function (locked) {
      // 特勤处漫游中按 Esc 解锁 → 直接返回大厅
      if (!locked && self.state === 'base') { self.exitBase(); return; }
      // 靶场：装备台打开时解锁鼠标不算退出；否则 Esc 解锁 → 回特勤处
      if (!locked && self.state === 'range') {
        if (GAME.Range.panelOpen) return;
        self.exitRange();
        return;
      }
      // 打开背包/开箱面板时主动解锁鼠标，不算暂停
      if (!locked && self.state === 'playing' && GAME.Input.everLocked &&
          !GAME.BagPanel.open && !GAME.LootPanel.open) {
        self.state = 'paused';
        GAME.Menu.showPause();
      }
    };
    GAME.Input.onPress['KeyE'] = function () { self.interact(); };
    GAME.Input.onPress['Escape'] = function () {
      if (self.state === 'base') self.exitBase();
      else if (self.state === 'range') {
        // 指针没锁定时 Esc 不会触发 pointerlockchange，这里兜底
        if (GAME.Range.panelOpen) GAME.Range.togglePanel(false);
        else if (!GAME.Input.locked) self.exitRange();
      }
    };
    GAME.Input.onPress['Tab'] = function () {
      if (self.state === 'playing') GAME.BagPanel.toggle();
    };
    GAME.Input.onPress['KeyB'] = function () {
      if (self.state === 'playing') GAME.BagPanel.toggle();
    };

    window.addEventListener('resize', function () {
      self.camera.aspect = window.innerWidth / window.innerHeight;
      self.camera.updateProjectionMatrix();
      self.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this.clock = new THREE.Clock();
    this.showHub();
    this.loop();
  },

  // ---------- 场景管理 ----------
  clearScene: function () {
    for (var i = this.scene.children.length - 1; i >= 0; i--) {
      var c = this.scene.children[i];
      if (c === this.camera) continue;
      this.scene.remove(c);
      c.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          var mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(function (m) { m.dispose(); });
        }
      });
    }
    // 技能效果实体随场景销毁，这里只清登记表
    GAME.Skills.clear();
  },

  // 大厅背景：用当前选中地图搭一个场景，相机环绕
  showHub: function () {
    this.state = 'hub';
    var def = GAME.Maps.get(GAME.Lobby.selectedMap || GAME.Maps.DEFAULT);
    this.currentMap = def;
    this.clearScene();
    GAME.Map.build(this.scene, def);
    GAME.Menu.hideAll();
    GAME.HUD.hide();
    GAME.HUD.setExtract(null);
    GAME.HUD.setInteract(false);
    GAME.HUD.setSearch(null);
    GAME.Lobby.show();
  },

  backToHub: function () {
    GAME.Menu.hideAll();
    this.showHub();
  },

  // ---------- 特勤处：可走动的 3D 大厅 ----------
  enterBase: function () {
    if (this.state === 'base') return;
    this.state = 'base';
    this.clearScene();
    var info = GAME.Base3D.build(this.scene);
    GAME.Menu.hideAll();
    GAME.HUD.hide();
    GAME.Lobby.hide();
    GAME.BaseWalk.begin(info, this.camera);
  },

  // opts: { dept: 设施 id } 或 { tab: 'stash' / 'market' }
  exitBase: function (opts) {
    if (this.state !== 'base') return;
    this.state = 'hub';
    GAME.BaseWalk.end();
    GAME.Input.unlock();
    this.showHub();
    if (opts && opts.tab) GAME.Lobby.switchTab(opts.tab);
    else if (opts && opts.dept) {
      GAME.Lobby.switchTab('base');
      GAME.Lobby.openDept(opts.dept);
    }
  },

  // ---------- 靶场 ----------
  enterRange: function () {
    // 支持两种入口：3D 特勤处里走到靶场按 E，或 2D 靶场详情页的直达按钮
    if (this.state !== 'base' && this.state !== 'hub') return;
    if (this.state === 'base') GAME.BaseWalk.end();
    this.state = 'range';
    this.clearScene();
    GAME.Menu.hideAll();
    GAME.HUD.hide();
    GAME.Lobby.hide();
    GAME.Range.begin(this.scene, this.camera);
  },

  exitRange: function () {
    if (this.state !== 'range') return;
    GAME.Range.end();
    this.state = 'hub';
    GAME.Input.unlock();
    this.enterBase();
  },

  // ---------- 出击 ----------
  deploy: function (mapId) {
    var C = GAME.Config;
    var P = GAME.Profile;
    var def = GAME.Maps.get(mapId || this.lastMapId);
    var self = this;

    GAME.Audio.ensure();
    this.lastMapId = def.id;
    this.currentMap = def;
    P.data.mapId = def.id;
    P.save();

    // 装备与药品
    var weapon = P.resolveWeapon();
    var secondary = P.resolveSecondary();
    var melee = P.resolveMelee();
    var helmet = P.resolveHelmet();
    var armor = P.resolveArmor();
    var bag = P.resolveBag();
    var meds = Math.min(P.count('medkit'), C.MAX_MEDS);
    P.remove('medkit', meds);
    var cards = P.takeCards();   // 仓库里的房卡带入战局

    this.raidGear = {
      weaponId: weapon.id,
      weaponFree: weapon.free,
      secondaryId: secondary ? secondary.id : null,
      meleeId: melee.id,
      helmetId: helmet ? helmet.id : null,
      armorId: armor ? armor.id : null,
      bagId: bag ? bag.id : null
    };
    this.raidMeds = meds;
    this.raidCards = cards;

    // 出击时装备栏随人带入战局（阵亡即丢失；撤离成功后按局内实际穿戴写回）
    P.data.equip.weapon = null;
    P.data.equip.secondary = null;
    P.data.equip.helmet = null;
    P.data.equip.armor = null;
    P.data.equip.bag = null;
    P.save();

    // 重建场景
    this.clearScene();
    GAME.Map.build(this.scene, def);
    GAME.Bullets.init(this.scene);
    GAME.Skills.init(this.scene);
    GAME.Loot.spawnAll(this.scene, def);
    GAME.Containers.spawnAll(this.scene, def);
    GAME.Extraction.spawnAll(this.scene, def);
    this.enemies = GAME.Enemy.spawnAll(this.scene, def);
    GAME.Player.init(this.camera, this.scene, {
      weaponId: weapon.id,
      secondaryId: secondary ? secondary.id : null,
      meleeId: melee.id,
      helmetId: helmet ? helmet.id : null,
      armorId: armor ? armor.id : null,
      bagId: bag ? bag.id : null,
      // 出击时把仓库里已装在这两把枪上的配件带进战局
      attach1: P.getAttach(weapon.id),
      attach2: secondary ? P.getAttach(secondary.id) : {},
      meds: meds,
      cards: cards,
      operator: P.resolveOperator()
    });

    this.timeLeft = def.time;
    this.elapsed = 0;
    this.nearLoot = null;
    this.nearLocked = null;
    this.searchTarget = null;
    this.searchTimer = 0;
    GAME.HUD.setSearch(null);

    P.bumpStats({ raids: 1 });
    GAME.BagPanel.forceClose();
    GAME.LootPanel.forceClose();
    GAME.Lobby.hide();
    GAME.Menu.hideAll();
    GAME.HUD.show();
    this.state = 'playing';
    GAME.Input.lock();
  },

  resume: function () {
    if (this.state !== 'paused') return;
    GAME.Menu.hidePause();
    this.state = 'playing';
    GAME.Input.lock();
  },

  // ---------- 交互：地面物资优先，其次开锁门 ----------
  interact: function () {
    if (this.state === 'base') { GAME.BaseWalk.interact(); return; }
    if (this.state !== 'playing') return;
    if (this.nearLoot) { this.pickup(); return; }
    if (this.nearLocked) {
      var dr = this.nearLocked;
      if (GAME.Map.tryOpenDoor(dr, GAME.Player)) {
        this.nearLocked = null;
        GAME.Audio.pickup();
        GAME.HUD.killFeed('已使用房卡，锁门打开了');
      } else {
        GAME.HUD.killFeed('没有 ' + (GAME.Items.keyTierName[dr.tier] || '对应房卡'));
      }
    }
  },

  // ---------- 拾取 ----------
  pickup: function () {
    if (this.state !== 'playing' || !this.nearLoot) return;
    var C = GAME.Config;
    var p = GAME.Player;
    var itemId = this.nearLoot.itemId;
    var d = GAME.Items.get(itemId);
    if (!p.canFit(itemId)) {
      GAME.HUD.killFeed('背包装不下或负重超限（' + p.weight.toFixed(1) + '/' + p.weightOver + ' kg）');
      return;
    }
    GAME.Loot.take(this.nearLoot);
    p.pickItem(itemId);
    GAME.Audio.pickup();
    GAME.HUD.killFeed('获得 ' + d.name + '（¥' + d.price + '）');
    this.nearLoot = null;
  },

  // ---------- 击杀掉落：AI 阵亡留下可搜刮的死亡盒子 ----------
  onKill: function (enemy) {
    GAME.Player.kills++;
    GAME.Player.onOperatorKill();
    GAME.Audio.kill();
    GAME.Containers.spawnAiBox(this.scene, enemy.pos, this.currentMap);
    GAME.HUD.killFeed('击杀敌人！留下了死亡盒子（按住 F 搜刮）');
  },

  // ---------- 战局结束 ----------
  endRaid: function (win, reason) {
    if (this.state !== 'playing' && this.state !== 'paused') return;
    this.state = 'result';
    GAME.BagPanel.forceClose();
    GAME.LootPanel.forceClose();
    GAME.Input.unlock();
    GAME.HUD.hide();
    GAME.HUD.setExtract(null);
    GAME.HUD.setInteract(false);
    GAME.HUD.setSearch(null);

    var P = GAME.Profile;
    var p = GAME.Player;
    var gear = this.raidGear;
    var bagIds = p.bag.map(function (e) { return e.id; });
    var safeIds = p.safeItems.map(function (e) { return e.id; });
    var safeValue = 0;
    safeIds.forEach(function (id) { safeValue += GAME.Items.get(id).price; });

    var result = {
      win: win,
      reason: reason || '',
      mapName: this.currentMap.name,
      kills: p.kills,
      value: win ? p.lootValue + safeValue : safeValue,
      items: [],
      lost: [],
      overflow: 0,
      money: 0,
      cardsBack: 0
    };

    if (win) {
      // 背包物资入库（仓库满时部分丢失）
      var stored = 0;
      for (var i = 0; i < bagIds.length; i++) {
        if (P.add(bagIds[i], 1)) stored++;
        else result.overflow++;
      }
      // 局内保险箱物资保底入库
      for (var si = 0; si < safeIds.length; si++) {
        if (!P.add(safeIds[si], 1)) result.overflow++;
      }
      result.items = this._groupItems(bagIds.concat(safeIds));
      // 没用完的急救包返还
      if (p.meds > 0) P.add('medkit', p.meds);
      // 房卡按剩余次数放回仓库（用完的不返还）
      result.cardsBack = p.cards && p.cards.length ? P.returnCards(p.cards) : 0;
      // 局内实际穿戴写回装备栏（含局内换上的战利品装备）
      P.setEquip('weapon', p.primary ? p.primary.id : null);
      P.setEquip('secondary', p.secondary ? p.secondary.id : null);
      P.setEquip('helmet', p.helmet ? p.helmet.id : null);
      P.setEquip('armor', p.armor ? p.armor.id : null);
      P.setEquip('bag', p.bagDef ? p.bagDef.id : null);
      P.setEquip('melee', p.melee ? p.melee.id : 'knife');
      P.bumpStats({ extracts: 1, kills: p.kills });
      GAME.Audio.success();
    } else {
      // 阵亡/超时/中止：局内实际穿戴的装备全部损失（出击时已从装备栏收走，这里只列清单）
      if (p.primary && !gear.weaponFree) result.lost.push(p.primary.name);
      if (p.secondary) result.lost.push(p.secondary.name);
      // 枪丢了，装在枪上的配件也一起损失
      if (p.primary && !gear.weaponFree) P.clearAttach(p.primary.id);
      if (p.secondary) P.clearAttach(p.secondary.id);
      if (p.helmet) result.lost.push(p.helmet.name);
      if (p.armor) result.lost.push(p.armor.name);
      if (p.bagDef) result.lost.push(p.bagDef.name);
      // 局内保险箱保底入库（阵亡也不丢）
      for (var sj = 0; sj < safeIds.length; sj++) {
        if (!P.add(safeIds[sj], 1)) result.overflow++;
      }
      result.items = this._groupItems(safeIds);
      // 近战匕首永不丢失；刀皮随阵亡消失，换回默认匕首
      P.setEquip('melee', 'knife');
      P.bumpStats({ deaths: 1, kills: p.kills });
      GAME.Audio.fail();
    }

    result.money = P.money();
    GAME.Menu.showResult(result);
  },

  // 把物品 id 列表按 id 汇总成 [{id,count}]
  _groupItems: function (ids) {
    var map = {};
    for (var i = 0; i < ids.length; i++) map[ids[i]] = (map[ids[i]] || 0) + 1;
    var out = [];
    for (var k in map) out.push({ id: k, count: map[k] });
    out.sort(function (a, b) {
      return GAME.Items.get(b.id).price - GAME.Items.get(a.id).price;
    });
    return out;
  },

  // ---------- 主循环 ----------
  loop: function () {
    var self = this;
    requestAnimationFrame(function () { self.loop(); });
    var dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.state === 'playing') {
      this.update(dt);
    } else if (this.state === 'base') {
      // 特勤处漫游
      GAME.BaseWalk.update(dt);
    } else if (this.state === 'range') {
      // 靶场练枪
      GAME.Range.update(dt);
    } else if (this.state === 'hub') {
      // 大厅背景：相机环绕地图
      var def = this.currentMap || GAME.Maps.get(GAME.Maps.DEFAULT);
      var r = def.size * 0.55 + 15;
      var h = def.size * 0.3 + 20;
      this.hubAngle += dt * 0.06;
      this.camera.position.set(Math.cos(this.hubAngle) * r, h, Math.sin(this.hubAngle) * r);
      this.camera.lookAt(0, 0, 0);
    }
    this.renderer.render(this.scene, this.camera);
  },

  update: function (dt) {
    var self = this;
    var player = GAME.Player;
    var C = GAME.Config;

    // 战局倒计时
    this.elapsed += dt;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this.endRaid(false, 'timeout'); return; }

    // 玩家
    player.update(dt, this.enemies, {
      onKill: function (e) { self.onKill(e); }
    });
    if (!player.alive) { this.endRaid(false, 'dead'); return; }

    // 干员技能实体（无人机/侦察箭/炸弹/护盾/干扰）
    GAME.Skills.update(dt, player, this.enemies);

    // 离开容器太远自动关掉开箱面板
    if (GAME.LootPanel.open && GAME.LootPanel.container) {
      var lc = GAME.LootPanel.container;
      if (GAME.Utils.dist2D(player.pos, lc.pos) > C.PICKUP_RANGE * 1.8 ||
          Math.abs(player.pos.y - lc.pos.y) > 2.6) {
        GAME.LootPanel.close();
        GAME.HUD.killFeed('离箱子太远，搜索中断');
      }
    }

    // 敌人
    for (var i = this.enemies.length - 1; i >= 0; i--) {
      var e = this.enemies[i];
      var removable = e.update(dt, player.pos, player.alive);
      if (removable) {
        this.scene.remove(e.group);
        this.enemies.splice(i, 1);
      }
    }

    // 子弹
    GAME.Bullets.update(dt, player, function (d) { player.takeDamage(d); });

    // 容器搜索（优先级高于地面物资）
    var nearC = GAME.Containers.update(dt, player.pos);
    this.nearLoot = GAME.Loot.update(dt, player.pos, this.elapsed);
    this.nearLocked = GAME.Map.updateDoors(dt, player.pos);

    if (nearC) {
      if (this.searchTarget !== nearC) {
        this.searchTarget = nearC;
        this.searchTimer = 0;
      }
      if (player.bagFree() <= 0) {
        GAME.HUD.setSearch(null);
        GAME.HUD.setInteract(true, '背包已满（' + player.bagUsed() + '/' + player.bagTotal() + ' 格）');
      } else if (GAME.LootPanel.open) {
        GAME.HUD.setSearch(null); // 开箱面板已打开，不用再按住 F
      } else if (GAME.Input.isDown('KeyF')) {
        this.searchTimer += dt;
        GAME.HUD.setSearch(this.searchTimer / player.searchTime(),
          '搜索 ' + nearC.name + '…');
        if (this.searchTimer >= player.searchTime()) this.finishSearch(nearC);
      } else {
        this.searchTimer = 0;
        GAME.HUD.setSearch(null);
        GAME.HUD.setInteract(true,
          '按住 <b>F</b> 搜索 ' + nearC.name + '（' + nearC.contents.length + ' 件）');
      }
    } else {
      this.searchTarget = null;
      this.searchTimer = 0;
      GAME.HUD.setSearch(null);
      if (this.nearLoot) {
        var d = GAME.Items.get(this.nearLoot.itemId);
        if (!player.canFit(d.id)) {
          GAME.HUD.setInteract(true, '背包装不下 ' + d.name + '（' + player.bagUsed() + '/' + player.bagTotal() + ' 格）');
        } else {
          GAME.HUD.setInteract(true, '按 <b>E</b> 拾取 ' + d.name + '（¥' + d.price + '）');
        }
      } else if (this.nearLocked) {
        var dr = this.nearLocked;
        var card = player.cardFor(dr.tier);
        var tierName = GAME.Items.keyTierName[dr.tier] || '房卡';
        if (card) {
          GAME.HUD.setInteract(true,
            '按 <b>E</b> 使用 ' + GAME.Items.get(card.id).name +
            ' 开门（剩 ' + card.uses + ' 次）');
        } else {
          GAME.HUD.setInteract(true,
            '锁定房间：需要 <b>' + tierName + '</b>（市场可购买）');
        }
      } else {
        GAME.HUD.setInteract(false);
      }
    }

    // 撤离
    var ex = GAME.Extraction.update(dt, player.pos);
    var leftSec = GAME.Extraction.cfg.time * (1 - ex.progress01);
    GAME.HUD.setExtract(ex.inside ? ex.progress01 : null, leftSec);
    if (ex.done) { this.endRaid(true); return; }

    // HUD
    GAME.HUD.update(player, this.timeLeft);
    GAME.HUD.drawMinimap(player.pos, player.yaw, this.enemies, GAME.Loot.items,
      GAME.Extraction.points, GAME.Containers.list);
  },

  // 搜完一个容器：打开三角洲式开箱面板（物资逐件翻出，点击拾取）
  finishSearch: function (c) {
    this.searchTimer = 0;
    this.searchTarget = null;
    GAME.HUD.setSearch(null);
    GAME.LootPanel.openPanel(c);
  }
};
