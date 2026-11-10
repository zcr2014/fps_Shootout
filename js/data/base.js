// ===== 特勤处：设施升级、制造台生产、收藏室展示 =====
window.GAME = window.GAME || {};

GAME.Base = {
  MAX_LV: 5,

  // 五个部门：等级越高效果越强（和《三角洲行动》的特勤处类似）
  DEPTS: [
    {
      id: 'craft', name: '制造中心', en: 'FABRICATION', icon: '⚙',
      desc: '在制造台用材料和资金生产装备，等级越高解锁越高级的配方。',
      effect: function (lv) {
        if (lv <= 1) return '当前：可制造一级物资 ｜ 下一级：解锁二级配方';
        if (lv === 2) return '当前：可制造二级装备 ｜ 下一级：解锁三级配方';
        if (lv === 3) return '当前：可制造三级装备 ｜ 下一级：解锁四级配方';
        return '已解锁全部四级装备配方';
      }
    },
    {
      id: 'train', name: '训练中心', en: 'TRAINING', icon: '✚',
      desc: '日常体能训练，提升干员的生命上限与移动速度。',
      effect: function (lv) {
        var hp = 4 * (lv - 1), sp = Math.round(1.2 * (lv - 1));
        if (lv >= 5) return '生命上限 +' + hp + ' · 移速 +' + sp + '%（已满级）';
        return '当前：生命 +' + hp + ' · 移速 +' + sp + '% ｜ 下一级：+' + (hp + 4) + ' · +' + (sp + 1) + '%';
      }
    },
    {
      id: 'range', name: '靶场', en: 'RANGE', icon: '◎',
      desc: '负重与耐力训练，直接提高出击时的负重上限。',
      effect: function (lv) {
        var w = 3 * (lv - 1);
        if (lv >= 5) return '负重上限 +' + w + ' kg（已满级）';
        return '当前：负重上限 +' + w + ' kg ｜ 下一级：+' + (w + 3) + ' kg';
      }
    },
    {
      id: 'med', name: '医疗站', en: 'MEDICAL', icon: '✚',
      desc: '升级医疗设备，提高急救包的治疗量。',
      effect: function (lv) {
        var m = Math.round(12 * (lv - 1));
        if (lv >= 5) return '急救包治疗量 +' + m + '%（已满级）';
        return '当前：急救包 +' + m + '% ｜ 下一级：+' + (m + 12) + '%';
      }
    },
    {
      id: 'collect', name: '收藏室', en: 'COLLECTION', icon: '★',
      desc: '陈列你带回来的稀有战利品，记录每一次成功撤离。',
      effect: function (lv) {
        if (lv >= 5) return '展位 ' + (lv * 2) + ' 格（已满级）';
        return '当前：展位 ' + (lv * 2) + ' 格 ｜ 下一级：' + (lv * 2 + 2) + ' 格';
      }
    }
  ],

  // 升级到目标等级需要的资金与物资（2 级只要资金，方便新档起步）
  COSTS: {
    2: { money: 1500, items: {} },
    3: { money: 4000, items: { copper: 2 } },
    4: { money: 9000, items: { copper: 3, medical: 2, telescope: 1 } },
    5: { money: 20000, items: { gpu: 1, gold: 1 } }
  },

  // 制造配方：lv 为需要的制造中心等级
  RECIPES: [
    { id: 'medkit', name: '急救包', lv: 1, time: 60, money: 300, items: {} },
    { id: 'helmet2', name: '二级头盔', lv: 1, time: 120, money: 800, items: {} },
    { id: 'armor2', name: '二级防弹衣', lv: 2, time: 180, money: 1600, items: { copper: 2 } },
    { id: 'bag2', name: '战术背包', lv: 3, time: 240, money: 2200, items: { copper: 2, medical: 1 } },
    { id: 'helmet4', name: '四级头盔', lv: 4, time: 480, money: 3200, items: { telescope: 1, gpu: 1 } }
  ],

  dept: function (id) {
    for (var i = 0; i < this.DEPTS.length; i++) {
      if (this.DEPTS[i].id === id) return this.DEPTS[i];
    }
    return null;
  },

  // 读档后确保 base 字段存在
  ensure: function () {
    var d = GAME.Profile.data;
    if (!d.base) d.base = {};
    var b = d.base;
    if (!b.levels) b.levels = {};
    for (var i = 0; i < this.DEPTS.length; i++) {
      var id = this.DEPTS[i].id;
      if (!b.levels[id]) b.levels[id] = 1;
    }
    if (b.craft === undefined) b.craft = null;
  },

  level: function (id) {
    this.ensure();
    return GAME.Profile.data.base.levels[id] || 1;
  },

  // 战斗加成（Player 初始化时读取）
  bonus: function () {
    var lvT = this.level('train'), lvR = this.level('range'), lvM = this.level('med');
    return {
      hp: 4 * (lvT - 1),
      speed: 0.012 * (lvT - 1),
      weight: 3 * (lvR - 1),
      med: 0.12 * (lvM - 1)
    };
  },

  // ---------- 升级 ----------
  costFor: function (id) {
    var lv = this.level(id);
    if (lv >= this.MAX_LV) return null;
    return this.COSTS[lv + 1] || null;
  },

  canUpgrade: function (id) {
    var cost = this.costFor(id);
    if (!cost) return { ok: false, msg: '已经满级' };
    if (GAME.Profile.money() < cost.money) return { ok: false, msg: '资金不足（需要 ¥' + cost.money + '）' };
    for (var itemId in cost.items) {
      if (GAME.Profile.count(itemId) < cost.items[itemId]) {
        return { ok: false, msg: '材料不足：' + GAME.Items.get(itemId).name + ' ×' + cost.items[itemId] };
      }
    }
    return { ok: true, cost: cost };
  },

  upgrade: function (id) {
    var chk = this.canUpgrade(id);
    if (!chk.ok) return chk;
    var cost = chk.cost;
    GAME.Profile.data.money -= cost.money;
    for (var itemId in cost.items) GAME.Profile.remove(itemId, cost.items[itemId]);
    var lv = this.level(id);
    GAME.Profile.data.base.levels[id] = lv + 1;
    GAME.Profile.save();
    return { ok: true, msg: this.dept(id).name + ' 升到 ' + (lv + 1) + ' 级' };
  },

  // ---------- 制造 ----------
  recipe: function (id) {
    for (var i = 0; i < this.RECIPES.length; i++) {
      if (this.RECIPES[i].id === id) return this.RECIPES[i];
    }
    return null;
  },

  craftState: function () {
    this.ensure();
    var c = GAME.Profile.data.base.craft;
    if (!c) return null;
    var left = Math.max(0, Math.ceil((c.finishAt - Date.now()) / 1000));
    return { id: c.id, left: left, done: left <= 0 };
  },

  startCraft: function (id) {
    var r = this.recipe(id);
    if (!r) return { ok: false, msg: '配方不存在' };
    if (this.craftState()) return { ok: false, msg: '制造台正在忙，等这一件做完' };
    if (this.level('craft') < r.lv) return { ok: false, msg: '需要制造中心 ' + r.lv + ' 级' };
    if (GAME.Profile.money() < r.money) return { ok: false, msg: '资金不足（需要 ¥' + r.money + '）' };
    for (var itemId in r.items) {
      if (GAME.Profile.count(itemId) < r.items[itemId]) {
        return { ok: false, msg: '材料不足：' + GAME.Items.get(itemId).name + ' ×' + r.items[itemId] };
      }
    }
    GAME.Profile.data.money -= r.money;
    for (var k in r.items) GAME.Profile.remove(k, r.items[k]);
    GAME.Profile.data.base.craft = { id: id, finishAt: Date.now() + r.time * 1000 };
    GAME.Profile.save();
    return { ok: true, msg: '开始制造 ' + r.name + '（' + Math.round(r.time / 60) + ' 分钟）' };
  },

  // 大厅刷新时结算：做好了就放进仓库
  tick: function () {
    var st = this.craftState();
    if (!st || !st.done) return null;
    var r = this.recipe(st.id);
    GAME.Profile.add(st.id, 1);
    GAME.Profile.data.base.craft = null;
    GAME.Profile.save();
    return r ? r.name : st.id;
  },

  // ---------- 收藏室：统计仓库/保险箱里的稀有战利品 ----------
  collection: function () {
    var list = [];
    var seen = {};
    var scan = function (items) {
      for (var i = 0; i < items.length; i++) {
        var def = GAME.Items.get(items[i].id);
        if (!def || def.rarity < 4) continue;
        if (seen[def.id]) { seen[def.id].n++; continue; }
        seen[def.id] = { id: def.id, name: def.name, rarity: def.rarity, n: 1 };
        list.push(seen[def.id]);
      }
    };
    scan(GAME.Profile.data.grid.items);
    scan(GAME.Profile.data.safe.items);
    list.sort(function (a, b) { return b.rarity - a.rarity; });
    return list;
  }
};
