// ===== 局外存档：资金、格子仓库、保险箱、装备栏、战绩（localStorage 持久化）=====
window.GAME = window.GAME || {};

GAME.Profile = {
  KEY: 'sdz_profile_v2',
  data: null,

  _uid: function () {
    return 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  },

  // 初始：手枪装在装备栏，仓库里 3 个急救包，保险箱空
  _defaults: function () {
    return {
      money: GAME.Config.START_MONEY,
      grid: {
        cols: GAME.Config.GRID_COLS,
        rows: GAME.Config.GRID_ROWS,
        items: [
          { uid: this._uid(), id: 'medkit', x: 0, y: 0 },
          { uid: this._uid(), id: 'medkit', x: 2, y: 0 },
          { uid: this._uid(), id: 'medkit', x: 4, y: 0 },
          { uid: this._uid(), id: 'key_blue', x: 0, y: 4, uses: 3 }
        ]
      },
      safe: {
        cols: GAME.Config.SAFE_COLS,
        rows: GAME.Config.SAFE_ROWS,
        items: []
      },
      equip: {
        weapon: { uid: this._uid(), id: 'p92' },
        secondary: null,
        melee: { uid: this._uid(), id: 'knife' },
        helmet: null,
        armor: null,
        bag: { uid: this._uid(), id: 'bag1' }
      },
      stats: { raids: 0, extracts: 0, deaths: 0, kills: 0, earned: 0 },
      operatorId: GAME.Operators ? GAME.Operators.DEFAULT : 'redwolf',
      mapId: GAME.Maps.DEFAULT
    };
  },

  load: function () {
    var raw = localStorage.getItem(this.KEY);
    if (raw) {
      try { this.data = JSON.parse(raw); } catch (e) { this.data = null; }
    }
    if (!this.data) this.data = this._defaults();
    this._normalize();
    return this.data;
  },

  // 兼容旧存档，补齐保险箱/头盔等新字段
  _normalize: function () {
    var d = this.data;
    var self = this;

    if (!d.grid || !d.grid.items) {
      var stash = d.stash || {};
      var loadout = d.loadout || {};
      d.grid = { cols: GAME.Config.GRID_COLS, rows: GAME.Config.GRID_ROWS, items: [] };
      d.equip = { weapon: null, secondary: null, helmet: null, armor: null };

      if (loadout.weapon && stash[loadout.weapon] > 0) {
        d.equip.weapon = { uid: this._uid(), id: loadout.weapon };
        stash[loadout.weapon]--;
      }
      if (loadout.armor && stash[loadout.armor] > 0) {
        d.equip.armor = { uid: this._uid(), id: loadout.armor };
        stash[loadout.armor]--;
      }
      if (!d.equip.weapon) d.equip.weapon = { uid: this._uid(), id: 'p92' };

      var pending = [];
      for (var id in stash) {
        for (var i = 0; i < stash[id]; i++) {
          if (GAME.Items.get(id)) pending.push(id);
        }
      }
      pending.forEach(function (itemId) {
        var pos = self.findFree(GAME.Items.get(itemId));
        if (pos) d.grid.items.push({ uid: self._uid(), id: itemId, x: pos.x, y: pos.y });
      });

      delete d.stash;
      delete d.loadout;
      this.save();
    }

    if (!d.safe || !d.safe.items) {
      d.safe = { cols: GAME.Config.SAFE_COLS, rows: GAME.Config.SAFE_ROWS, items: [] };
    }
    if (!d.equip) d.equip = {};
    ['weapon', 'secondary', 'melee', 'helmet', 'armor', 'bag'].forEach(function (k) {
      if (d.equip[k] === undefined) d.equip[k] = null;
    });
    // 枪械配件：按武器 id 保存四个改装位的配件
    if (!d.attach || typeof d.attach !== 'object') d.attach = {};
    // 近战武器是绑定装备，任何时候都补一把默认匕首
    if (!d.equip.melee) d.equip.melee = { uid: this._uid(), id: 'knife' };
    // 老玩家补发一个入门背包（新字段 bag）
    if (!d.equip.bag && d._bagGranted !== true) {
      d.equip.bag = { uid: this._uid(), id: 'bag1' };
      d._bagGranted = true;
    }
    if (!d.stats) d.stats = { raids: 0, extracts: 0, deaths: 0, kills: 0, earned: 0 };
    // 特勤处：老存档补齐设施等级与制造队列
    if (!d.base) d.base = { levels: {}, craft: null };
    // 当前选择的干员（旧版虚构干员「无名」迁移为乌鲁鲁）
    if (d.operatorId === 'deadeye') d.operatorId = 'uluru';
    if (!d.operatorId || !GAME.Operators.get(d.operatorId)) {
      d.operatorId = GAME.Operators ? GAME.Operators.DEFAULT : 'redwolf';
    }
    if (!d.mapId) d.mapId = GAME.Maps.DEFAULT;
  },

  resolveOperator: function () {
    return GAME.Operators.get(this.data.operatorId || GAME.Operators.DEFAULT);
  },

  save: function () {
    localStorage.setItem(this.KEY, JSON.stringify(this.data));
  },

  reset: function () {
    localStorage.removeItem(this.KEY);
    this.data = this._defaults();
    this._normalize();
    this.save();
  },

  money: function () { return this.data.money; },
  addMoney: function (v) { this.data.money += v; this.save(); },

  // ---------- 通用矩形检测 ----------
  _rectFreeIn: function (items, cols, rows, x, y, w, h, exclude) {
    if (x < 0 || y < 0 || x + w > cols || y + h > rows) return false;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (exclude && exclude.indexOf(it.uid) >= 0) continue;
      var s = GAME.Items.size(it.id);
      if (x < it.x + s.w && x + w > it.x && y < it.y + s.h && y + h > it.y) return false;
    }
    return true;
  },

  _findFreeIn: function (items, cols, rows, def) {
    var s = GAME.Items.size(def.id);
    for (var y = 0; y + s.h <= rows; y++) {
      for (var x = 0; x + s.w <= cols; x++) {
        if (this._rectFreeIn(items, cols, rows, x, y, s.w, s.h)) return { x: x, y: y };
      }
    }
    return null;
  },

  // ---------- 格子仓库 ----------
  cols: function () { return this.data.grid.cols; },
  rows: function () { return this.data.grid.rows; },

  countGrid: function (id) {
    var n = 0, items = this.data.grid.items;
    for (var i = 0; i < items.length; i++) if (items[i].id === id) n++;
    return n;
  },

  usedSlots: function () {
    var n = 0, items = this.data.grid.items;
    for (var i = 0; i < items.length; i++) {
      var s = GAME.Items.size(items[i].id);
      n += s.w * s.h;
    }
    return n;
  },
  totalSlots: function () { return this.data.grid.cols * this.data.grid.rows; },
  freeSlots: function () { return this.totalSlots() - this.usedSlots(); },

  _rectFree: function (x, y, w, h, exclude) {
    var g = this.data.grid;
    return this._rectFreeIn(g.items, g.cols, g.rows, x, y, w, h, exclude);
  },

  findFree: function (def) {
    var g = this.data.grid;
    return this._findFreeIn(g.items, g.cols, g.rows, def);
  },

  add: function (id, n) {
    var def = GAME.Items.get(id);
    if (!def || n <= 0) return 0;
    var placed = 0;
    for (var i = 0; i < n; i++) {
      var pos = this.findFree(def);
      if (!pos) break;
      var entry = { uid: this._uid(), id: id, x: pos.x, y: pos.y };
      if (def.cat === 'key') entry.uses = def.uses;
      this.data.grid.items.push(entry);
      placed++;
    }
    if (placed > 0) this.save();
    return placed;
  },

  // ---------- 房卡：出击时从仓库取出，撤离后按剩余次数放回 ----------
  takeCards: function () {
    var items = this.data.grid.items;
    var out = [];
    for (var i = items.length - 1; i >= 0; i--) {
      var d = GAME.Items.get(items[i].id);
      if (d && d.cat === 'key') {
        out.push(items[i]);
        items.splice(i, 1);
      }
    }
    if (out.length > 0) this.save();
    return out;
  },

  returnCards: function (cards) {
    var n = 0;
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      if (!c || c.uses <= 0) continue;
      var def = GAME.Items.get(c.id);
      var pos = this.findFree(def);
      if (!pos) continue;
      this.data.grid.items.push({ uid: this._uid(), id: c.id, x: pos.x, y: pos.y, uses: c.uses });
      n++;
    }
    if (n > 0) this.save();
    return n;
  },

  remove: function (id, n) {
    var items = this.data.grid.items, removed = 0;
    for (var i = items.length - 1; i >= 0 && removed < n; i--) {
      if (items[i].id === id) { items.splice(i, 1); removed++; }
    }
    if (removed > 0) this.save();
    return removed;
  },

  // ---------- 保险箱（阵亡不掉）----------
  colsSafe: function () { return this.data.safe.cols; },
  rowsSafe: function () { return this.data.safe.rows; },

  countSafe: function (id) {
    var n = 0, items = this.data.safe.items;
    for (var i = 0; i < items.length; i++) if (items[i].id === id) n++;
    return n;
  },

  safeUsed: function () {
    var n = 0, items = this.data.safe.items;
    for (var i = 0; i < items.length; i++) {
      var s = GAME.Items.size(items[i].id);
      n += s.w * s.h;
    }
    return n;
  },
  safeTotal: function () { return this.data.safe.cols * this.data.safe.rows; },
  safeFree: function () { return this.safeTotal() - this.safeUsed(); },

  _rectSafeFree: function (x, y, w, h, exclude) {
    var s = this.data.safe;
    return this._rectFreeIn(s.items, s.cols, s.rows, x, y, w, h, exclude);
  },

  findFreeSafe: function (def) {
    var s = this.data.safe;
    return this._findFreeIn(s.items, s.cols, s.rows, def);
  },

  addSafe: function (id, n) {
    var def = GAME.Items.get(id);
    if (!def || n <= 0) return 0;
    var placed = 0;
    for (var i = 0; i < n; i++) {
      var pos = this.findFreeSafe(def);
      if (!pos) break;
      this.data.safe.items.push({ uid: this._uid(), id: id, x: pos.x, y: pos.y });
      placed++;
    }
    if (placed > 0) this.save();
    return placed;
  },

  removeSafe: function (id, n) {
    var items = this.data.safe.items, removed = 0;
    for (var i = items.length - 1; i >= 0 && removed < n; i--) {
      if (items[i].id === id) { items.splice(i, 1); removed++; }
    }
    if (removed > 0) this.save();
    return removed;
  },

  // 仓库 ↔ 保险箱转移
  transferToSafe: function (uid, x, y) {
    var it = this.findEntry(uid);
    if (!it) return { ok: false, msg: '找不到物品' };
    var g = this.data.grid, s = this.data.safe;
    var gi = g.items.indexOf(it);
    if (gi < 0) return { ok: false, msg: '只能从仓库转进保险箱' };
    var d = GAME.Items.get(it.id), sz = GAME.Items.size(it.id);
    var tx = x, ty = y;
    if (typeof tx !== 'number' || !this._rectSafeFree(tx, ty, sz.w, sz.h)) {
      var fp = this.findFreeSafe(d);
      if (!fp) return { ok: false, msg: '保险箱放不下了' };
      tx = fp.x; ty = fp.y;
    }
    g.items.splice(gi, 1);
    s.items.push({ uid: it.uid, id: it.id, x: tx, y: ty });
    this.save();
    return { ok: true, msg: '已存入保险箱（阵亡不会丢失）' };
  },

  transferToGrid: function (uid, x, y) {
    var it = this.findEntry(uid);
    if (!it) return { ok: false, msg: '找不到物品' };
    var g = this.data.grid, s = this.data.safe;
    var si = s.items.indexOf(it);
    if (si < 0) return { ok: false, msg: '该物品不在保险箱里' };
    var d = GAME.Items.get(it.id), sz = GAME.Items.size(it.id);
    var tx = x, ty = y;
    if (typeof tx !== 'number' || !this._rectFree(tx, ty, sz.w, sz.h)) {
      var fp = this.findFree(d);
      if (!fp) return { ok: false, msg: '仓库放不下了' };
      tx = fp.x; ty = fp.y;
    }
    s.items.splice(si, 1);
    g.items.push({ uid: it.uid, id: it.id, x: tx, y: ty });
    this.save();
    return { ok: true, msg: '已取回仓库' };
  },

  // ---------- 通用查找 ----------
  findEntry: function (uid) {
    var i, items = this.data.grid.items;
    for (i = 0; i < items.length; i++) if (items[i].uid === uid) return items[i];
    items = this.data.safe.items;
    for (i = 0; i < items.length; i++) if (items[i].uid === uid) return items[i];
    var eq = this.data.equip;
    for (var k in eq) if (eq[k] && eq[k].uid === uid) return eq[k];
    return null;
  },

  entryLocation: function (uid) {
    var items = this.data.grid.items, i;
    for (i = 0; i < items.length; i++) if (items[i].uid === uid) return 'grid';
    items = this.data.safe.items;
    for (i = 0; i < items.length; i++) if (items[i].uid === uid) return 'safe';
    var eq = this.data.equip;
    for (var k in eq) if (eq[k] && eq[k].uid === uid) return 'equip';
    return null;
  },

  firstUid: function (id) {
    var items = this.data.grid.items, i;
    for (i = 0; i < items.length; i++) if (items[i].id === id) return items[i].uid;
    return null;
  },

  // 仓库 + 保险箱 + 装备栏的总件数
  count: function (id) {
    var eq = this.data.equip;
    var n = this.countGrid(id) + this.countSafe(id);
    for (var k in eq) if (eq[k] && eq[k].id === id) n++;
    return n;
  },

  isEquipped: function (uid) {
    var eq = this.data.equip;
    for (var k in eq) if (eq[k] && eq[k].uid === uid) return true;
    return false;
  },

  // 在指定容器内移动/交换（container: 'grid' | 'safe'）
  moveWithin: function (container, uid, x, y) {
    var data = container === 'safe' ? this.data.safe : this.data.grid;
    var it = this.findEntry(uid);
    if (!it || this.isEquipped(uid)) return false;
    if (container === 'safe' && this.data.safe.items.indexOf(it) < 0) return false;
    if (container === 'grid' && this.data.grid.items.indexOf(it) < 0) return false;
    var s = GAME.Items.size(it.id);
    if (x < 0 || y < 0 || x + s.w > data.cols || y + s.h > data.rows) return false;

    var items = data.items;
    var freeCheck = container === 'safe' ? this._rectSafeFree.bind(this) : this._rectFree.bind(this);
    if (freeCheck(x, y, s.w, s.h, [uid])) {
      it.x = x; it.y = y;
      this.save();
      return true;
    }

    var others = [];
    for (var i = 0; i < items.length; i++) {
      var o = items[i];
      if (o.uid === uid) continue;
      var os = GAME.Items.size(o.id);
      if (x < o.x + os.w && x + s.w > o.x && y < o.y + os.h && y + s.h > o.y) others.push(o);
    }
    if (others.length !== 1) return false;

    var other = others[0], os2 = GAME.Items.size(other.id);
    var nx = it.x, ny = it.y;
    if (x < nx + os2.w && x + s.w > nx && y < ny + os2.h && y + s.h > ny) return false;
    if (!freeCheck(nx, ny, os2.w, os2.h, [uid, other.uid])) return false;

    other.x = nx; other.y = ny;
    it.x = x; it.y = y;
    this.save();
    return true;
  },

  // 旧接口保持兼容（仓库内移动）
  moveTo: function (uid, x, y) { return this.moveWithin('grid', uid, x, y); },
  moveSafe: function (uid, x, y) { return this.moveWithin('safe', uid, x, y); },

  // ---------- 装备栏 ----------
  equip: function (kind, uid) {
    var slot = this._slotOf(kind);
    var it = this.findEntry(uid);
    if (!slot || !it) return { ok: false, msg: '找不到该装备' };
    var d = GAME.Items.get(it.id);
    if (d.cat !== slot.cat) {
      return { ok: false, msg: slot.label + '格里只能放' + GAME.Items.catLabels[slot.cat] };
    }
    // 副武器槽只收手枪（三角洲规则）
    if (slot.slot === 'secondary' && d.slot !== 'secondary') {
      return { ok: false, msg: '副武器槽只能放手枪' };
    }
    if (this.isEquipped(uid)) return { ok: true, msg: '已经装备了' };

    var g = this.data.grid;
    var idx = g.items.indexOf(it);
    if (idx >= 0) g.items.splice(idx, 1);
    else {
      // 来自保险箱
      var si = this.data.safe.items.indexOf(it);
      if (si >= 0) this.data.safe.items.splice(si, 1);
    }

    var old = this.data.equip[kind];
    this.data.equip[kind] = { uid: it.uid, id: it.id };
    if (old) {
      var oldDef = GAME.Items.get(old.id);
      // 绑定的默认匕首不回流仓库（近战永远有一把）
      if (oldDef && !oldDef.bound) {
        var pos = this.findFree(oldDef);
        if (pos) g.items.push({ uid: old.uid, id: old.id, x: pos.x, y: pos.y });
      }
    }
    this.save();
    return { ok: true, msg: '已装备：' + d.name };
  },

  unequip: function (kind, x, y) {
    var eq = this.data.equip[kind];
    if (!eq) return { ok: false, msg: '这个装备格是空的' };
    var d = GAME.Items.get(eq.id);
    var s = GAME.Items.size(eq.id);

    var tx = x, ty = y;
    var ok = (typeof tx === 'number' && typeof ty === 'number') &&
             this._rectFree(tx, ty, s.w, s.h);
    if (!ok) {
      var pos = this.findFree(d);
      if (!pos) return { ok: false, msg: '仓库放不下了，先卖点东西' };
      tx = pos.x; ty = pos.y;
    }
    // 近战卸下刀皮后自动换回默认匕首
    this.data.equip[kind] = (kind === 'melee') ? { uid: this._uid(), id: 'knife' } : null;
    this.data.grid.items.push({ uid: eq.uid, id: eq.id, x: tx, y: ty });
    this.save();
    return { ok: true, msg: '已卸下：' + d.name };
  },

  loseEquipped: function (kind) {
    var eq = this.data.equip[kind];
    if (!eq) return null;
    this.data.equip[kind] = null;
    this.save();
    return eq.id;
  },

  // 直接设置某个装备格（撤离成功后按局内实际穿戴写回用）
  setEquip: function (kind, id) {
    this.data.equip[kind] = id ? { uid: this._uid(), id: id } : null;
    this.save();
  },

  // ---------- 枪械配件：按武器 id 保存四个改装位 ----------
  _attachMap: function (weaponId) {
    if (!this.data.attach) this.data.attach = {};
    if (!this.data.attach[weaponId]) this.data.attach[weaponId] = {};
    return this.data.attach[weaponId];
  },

  // 返回 { scope: 'scope_red', muzzle: 'muzzle_comp', ... }（只含已装配的）
  getAttach: function (weaponId) {
    var map = this.data.attach && this.data.attach[weaponId], out = {};
    if (!map) return out;
    for (var k in map) {
      if (map[k] && map[k].id) out[k] = map[k].id;
    }
    return out;
  },

  attachEntry: function (weaponId, kind) {
    var map = this.data.attach && this.data.attach[weaponId];
    return (map && map[kind]) || null;
  },

  // 从仓库/保险箱取一个配件装到武器的对应改装位
  installAttach: function (weaponId, kind, uid) {
    var it = this.findEntry(uid);
    if (!it) return { ok: false, msg: '找不到这个配件' };
    var d = GAME.Items.get(it.id);
    if (!d || d.cat !== 'attach') return { ok: false, msg: '这不是枪械配件' };
    if (d.attach !== kind) return { ok: false, msg: '这个配件不能装在' + GAME.Items.attachLabels[kind] + '位' };
    var gi = this.data.grid.items.indexOf(it);
    var si = this.data.safe.items.indexOf(it);
    if (gi < 0 && si < 0) return { ok: false, msg: '配件要先放在仓库里' };

    var map = this._attachMap(weaponId);
    if (map[kind] && map[kind].uid === uid) return { ok: true, msg: '已经装好了' };
    // 先从仓库/保险箱取出
    if (gi >= 0) this.data.grid.items.splice(gi, 1);
    else this.data.safe.items.splice(si, 1);

    var old = map[kind];
    map[kind] = { uid: it.uid, id: it.id };
    if (old) {
      var oldDef = GAME.Items.get(old.id);
      var pos = oldDef ? this.findFree(oldDef) : null;
      if (!pos) {
        // 仓库放不下换下来的旧配件 → 回滚
        map[kind] = old;
        this.data.grid.items.push(it);
        return { ok: false, msg: '仓库放不下换下来的旧配件' };
      }
      this.data.grid.items.push({ uid: old.uid, id: old.id, x: pos.x, y: pos.y });
    }
    this.save();
    return { ok: true, msg: '已装配：' + d.name };
  },

  // 卸下配件，放回仓库
  removeAttach: function (weaponId, kind) {
    var map = this.data.attach && this.data.attach[weaponId];
    var e = map && map[kind];
    if (!e) return { ok: false, msg: '这个位置没有配件' };
    var d = GAME.Items.get(e.id);
    if (!d) { delete map[kind]; this.save(); return { ok: true, msg: '已卸下配件' }; }
    var pos = this.findFree(d);
    if (!pos) return { ok: false, msg: '仓库放不下卸下的配件' };
    delete map[kind];
    this.data.grid.items.push({ uid: e.uid, id: e.id, x: pos.x, y: pos.y });
    this.save();
    return { ok: true, msg: '已卸下：' + d.name };
  },

  // 已装在这把枪上的配件总价值
  attachValue: function (weaponId) {
    var map = this.data.attach && this.data.attach[weaponId], v = 0;
    if (!map) return 0;
    for (var k in map) {
      var d = map[k] && GAME.Items.get(map[k].id);
      if (d) v += d.price;
    }
    return v;
  },

  // 武器阵亡丢失时，挂在上面的配件一起损失
  clearAttach: function (weaponId) {
    if (this.data.attach && this.data.attach[weaponId]) {
      delete this.data.attach[weaponId];
      this.save();
    }
  },

  _slotOf: function (kind) {
    var slots = GAME.Items.equipSlots;
    for (var i = 0; i < slots.length; i++) if (slots[i].kind === kind) return slots[i];
    return null;
  },

  resolveWeapon: function () {
    var w = this.data.equip.weapon;
    if (w && GAME.Items.get(w.id)) return { id: w.id, free: false };
    return { id: GAME.Config.DEFAULT_WEAPON, free: true };
  },

  resolveSecondary: function () {
    var w = this.data.equip.secondary;
    if (w && GAME.Items.get(w.id)) return { id: w.id, free: false };
    return null;
  },

  resolveMelee: function () {
    var m = this.data.equip.melee;
    if (m && GAME.Items.get(m.id)) return { id: m.id, free: false };
    return { id: 'knife', free: true };
  },

  resolveHelmet: function () {
    var h = this.data.equip.helmet;
    if (h && GAME.Items.get(h.id)) return { id: h.id, free: false };
    return null;
  },

  resolveArmor: function () {
    var a = this.data.equip.armor;
    if (a && GAME.Items.get(a.id)) return { id: a.id, free: false };
    return null;
  },

  resolveBag: function () {
    var b = this.data.equip.bag;
    if (b && GAME.Items.get(b.id)) return { id: b.id, free: false };
    return null;
  },

  bumpStats: function (fields) {
    for (var k in fields) this.data.stats[k] = (this.data.stats[k] || 0) + fields[k];
    this.save();
  }
};
