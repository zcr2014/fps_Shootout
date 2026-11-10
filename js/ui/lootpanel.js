// ===== 开箱搜索面板：三角洲式三栏布局 =====
// 左：干员与随身装备方块  /  中：容器物资按类别分区分格  /  右：附近搜索情况
// 流程：按住 F 搜完 → 面板打开（箱盖翻开）→ 物资逐件揭晓 → 点击拾取 / 全部拾取
window.GAME = window.GAME || {};

GAME.LootPanel = {
  el: {},
  open: false,
  container: null,   // 当前打开的容器（Containers.list 里的引用）
  timers: [],        // 揭晓动画的延时器（关闭时清掉）
  slots: [],         // 当前可拾取的槽位 { el, itemId }

  // 分区顺序与展示名（按物品 cat 归类，未列出的归到「物资」）
  ZONE_ORDER: ['weapon', 'helmet', 'armor', 'bag', 'med', 'key', 'valuable', 'melee'],
  ZONE_NAMES: {
    weapon: '枪械', helmet: '头盔', armor: '护甲', bag: '背包',
    med: '医疗', key: '房卡', valuable: '物资', melee: '近战'
  },
  ZONE_GLYPHS: {
    weapon: '枪', helmet: '盔', armor: '甲', bag: '包',
    med: '药', key: '卡', valuable: '物', melee: '刃'
  },

  init: function () {
    var self = this;
    var ids = ['loot-panel', 'lp-title', 'lp-op-figure', 'lp-op-name', 'lp-gear',
               'lp-container-name', 'lp-count', 'lp-zones', 'lp-nearby',
               'lp-bag', 'lp-take-all', 'lp-close'];
    ids.forEach(function (id) { self.el[id] = document.getElementById(id); });

    this.el['lp-close'].addEventListener('click', function () { self.close(); });
    this.el['lp-take-all'].addEventListener('click', function () { self.takeAll(); });

    // Esc 关面板（面板开着时不触发暂停，因为指针本来就解锁了）
    GAME.Input.onPress['Escape'] = function () {
      if (self.open) self.close();
    };
  },

  // 打开容器（c = Containers.list 里的条目）
  // 注意：状态标志是 this.open（布尔），打开方法叫 openPanel，避免重名互相覆盖
  openPanel: function (c) {
    if (this.open) this.close(true);
    this.container = c;
    this.open = true;
    GAME.BagPanel.forceClose();          // 两个面板互斥
    GAME.Input.unlock();                 // 释放鼠标点击拾取（不暂停，保持紧张感）
    GAME.Containers.openLid(c);          // 3D 箱盖翻开
    GAME.Audio.boxOpen();
    this.render();
    this.el['loot-panel'].classList.remove('hidden');
  },

  render: function () {
    var self = this;
    var c = this.container;
    if (!c) return;

    // 重绘前清掉上一轮的揭晓定时器，避免旧槽位（已移除）继续触发
    this.timers.forEach(function (t) { clearTimeout(t); });
    this.timers = [];

    this.el['lp-title'].textContent = '正在搜索物资 — ' + c.name;
    this.el['lp-container-name'].textContent = c.name;
    this.renderOperator();
    this.renderGear();

    var zones = this.el['lp-zones'];
    zones.innerHTML = '';
    this.slots = [];
    this._updateCount();

    if (c.contents.length === 0) {
      zones.innerHTML = '<div class="lp-empty">箱子里已经空了</div>';
      this.renderNearby();
      return;
    }

    // 按类别分组：{ cat: [{ id, def }] }
    var groups = {};
    c.contents.forEach(function (itemId) {
      var d = GAME.Items.get(itemId);
      if (!d) return;
      var cat = self.ZONE_NAMES[d.cat] ? d.cat : 'valuable';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ id: itemId, def: d });
    });

    // 按固定顺序渲染分区，每个分区是一块带标题的方格区
    var order = this.ZONE_ORDER;
    var allCats = [];
    order.forEach(function (cat) { if (groups[cat]) allCats.push(cat); });
    Object.keys(groups).forEach(function (cat) {
      if (allCats.indexOf(cat) < 0) allCats.push(cat);
    });

    var seq = 0;   // 全局揭晓顺序，保证分区之间也逐件翻出
    allCats.forEach(function (cat) {
      var list = groups[cat];
      var zone = document.createElement('div');
      zone.className = 'lp-zone';
      zone.setAttribute('data-cat', cat);

      var head = document.createElement('div');
      head.className = 'lp-zone-head';
      head.innerHTML = '<b>' + (self.ZONE_NAMES[cat] || '物资') + '</b>' +
                       '<span class="lz-count">' + list.length + ' 件</span>';
      zone.appendChild(head);

      var grid = document.createElement('div');
      grid.className = 'lp-zone-grid';
      zone.appendChild(grid);

      list.forEach(function (entry) {
        var slot = document.createElement('div');
        slot.className = 'lp-slot pending';
        slot.innerHTML = '<span class="lp-pending">···</span>';
        grid.appendChild(slot);
        self.slots.push({ el: slot, itemId: entry.id });

        var t = setTimeout(function () {
          self._reveal(slot, entry.id);
          GAME.Audio.extractTick();
        }, 180 + seq * 150);
        seq++;
        self.timers.push(t);
      });

      zones.appendChild(zone);
    });

    this.renderNearby();
  },

  // 左侧干员信息（用干员主题色做背景光晕，纯 CSS 剪影，避免外链图片）
  renderOperator: function () {
    var op = GAME.Player.operator || (GAME.Operators && GAME.Operators.get(GAME.Operators.DEFAULT));
    if (!op) return;
    this.el['lp-op-name'].textContent = op.name + ' · ' + op.role;
    var fig = this.el['lp-op-figure'];
    fig.style.background =
      'radial-gradient(circle at 50% 34%, ' + op.color + '33, rgba(0,0,0,0) 62%), ' +
      'linear-gradient(160deg, #151d23, #0b1015)';
    fig.style.borderColor = op.color + '66';
  },

  // 左侧随身装备：方形格子，显示类别 / 名称 / 数量
  renderGear: function () {
    var p = GAME.Player;
    var list = [
      { cat: '主武器', def: p.primary },
      { cat: '副武器', def: p.secondary },
      { cat: '头盔', def: p.helmet },
      { cat: '胸挂', def: p.armor },
      { cat: '背包', def: p.bagDef },
      { cat: '近战', def: p.melee }
    ];
    var html = '';
    list.forEach(function (g) {
      var color = g.def && GAME.Items.rarityColors[g.def.rarity]
        ? GAME.Items.rarityColors[g.def.rarity] : '#5a6a60';
      html += '<div class="lp-gear-cell' + (g.def ? '' : ' empty') + '"' +
              (g.def ? ' style="border-color:' + color + '66"' : '') + '>' +
              '<span class="gc-cat">' + g.cat + '</span>' +
              '<span class="gc-name">' + (g.def ? g.def.name : '未装备') + '</span>' +
              '<span class="gc-count">' + (g.def ? '1' : '0') + ' / 1</span>' +
              '</div>';
    });
    this.el['lp-gear'].innerHTML = html;
  },

  // 右侧「附近搜索情况」：列出附近还有物资的容器（同层、未搜空）
  renderNearby: function () {
    var self = this;
    var box = this.el['lp-nearby'];
    box.innerHTML = '';
    var p = GAME.Player;
    var range = 14;   // 附近判定半径（米）
    var near = [];

    (GAME.Containers.list || []).forEach(function (c) {
      if (c === self.container) return;
      if (!c.contents || c.contents.length === 0) return;
      if (Math.abs(c.pos.y - p.pos.y) > 2.2) return;
      var d = GAME.Utils.dist2D(c.pos, p.pos);
      if (d <= range) near.push({ c: c, d: d });
    });

    near.sort(function (a, b) { return a.d - b.d; });

    if (near.length === 0) {
      box.innerHTML = '<div class="lp-near-empty">附近没有其他可搜索的容器</div>';
      return;
    }
    for (var i = 0; i < near.length && i < 8; i++) {
      var item = near[i];
      var c = item.c;
      var reachable = item.d <= GAME.Config.PICKUP_RANGE;
      var el = document.createElement('div');
      el.className = 'lp-near-cell' + (reachable ? ' current' : '');
      el.innerHTML =
        '<span class="lp-near-name">' + c.name + '</span>' +
        '<span class="lp-near-meta">' + item.d.toFixed(1) + ' m</span>' +
        '<span class="lp-near-meta">剩余 ' + c.contents.length + ' 件</span>';
      box.appendChild(el);
    }
  },

  // 单个槽位揭晓：按稀有度上边框色 + 类别 + 名称 + 价格
  _reveal: function (slot, itemId) {
    var d = GAME.Items.get(itemId);
    if (!d) return;
    var color = GAME.Items.rarityColors[d.rarity] || '#9aa4ad';
    slot.className = 'lp-slot revealed r' + d.rarity;
    slot.style.borderColor = color;
    slot.innerHTML =
      '<span class="lp-item-cat">' + (GAME.Items.catLabels[d.cat] || '物资') + '</span>' +
      '<span class="lp-item-glyph" style="color:' + color + '">' +
        (GAME.LootPanel.ZONE_GLYPHS[d.cat] || '物') + '</span>' +
      '<span class="lp-item-name">' + d.name + '</span>' +
      '<span class="lp-item-price gold">¥ ' + d.price + '</span>';
    slot.addEventListener('click', function () { GAME.LootPanel.take(slot, itemId); });
  },

  // 点击拾取单件（放不下提示背包已满，物品留在箱子里）
  take: function (slot, itemId) {
    var p = GAME.Player;
    var d = GAME.Items.get(itemId);
    if (!d || !this.container) return;
    if (!p.pickItem(itemId)) {
      GAME.HUD.killFeed('背包已满或负重超限，装不下 ' + d.name);
      GAME.Audio.empty();
      return;
    }
    var c = this.container;
    var idx = c.contents.indexOf(itemId);
    if (idx >= 0) c.contents.splice(idx, 1);
    // 槽位从列表里摘掉，避免全部拾取时重复移除
    var el = slot;
    this.slots = this.slots.filter(function (s) { return s.el !== el; });
    slot.remove();
    GAME.Audio.pickup();
    GAME.HUD.killFeed('获得 ' + d.name + '（¥ ' + d.price + '）');
    this.refreshFooter();
    this._updateCount();
    this._updateZoneCount();
    this.renderNearby();
    if (c.contents.length === 0) this.close();
  },

  // 全部拾取：能装多少装多少
  takeAll: function () {
    var c = this.container;
    if (!c) return;
    var p = GAME.Player;
    var taken = 0;

    while (c.contents.length > 0) {
      var id = c.contents[0];
      if (!p.pickItem(id)) break;
      c.contents.shift();
      taken++;
    }
    if (taken > 0) GAME.Audio.pickup();
    if (c.contents.length > 0) {
      GAME.HUD.killFeed('背包已满，剩余 ' + c.contents.length + ' 件留在箱子里');
      // 把已经拿走的槽位清掉，剩下的重新按当前内容展示
      this.slots = [];
      this.render();
    } else {
      this.slots = [];
      this.refreshFooter();
      this._updateCount();
      this.close();
      return;
    }
    this.refreshFooter();
    this._updateCount();
    this.renderNearby();
  },

  // 更新总件数
  _updateCount: function () {
    if (!this.container) return;
    this.el['lp-count'].textContent = this.container.contents.length + ' 件';
  },

  // 更新各分区的剩余件数（拾取单件后调用）
  _updateZoneCount: function () {
    var c = this.container;
    if (!c) return;
    var zones = this.el['lp-zones'].querySelectorAll('.lp-zone');
    for (var i = 0; i < zones.length; i++) {
      var cat = zones[i].getAttribute('data-cat');
      var n = 0;
      for (var j = 0; j < c.contents.length; j++) {
        var d = GAME.Items.get(c.contents[j]);
        if (d && d.cat === cat) n++;
      }
      var label = zones[i].querySelector('.lz-count');
      if (label) label.textContent = n + ' 件';
    }
  },

  refreshFooter: function () {
    this.el['lp-bag'].textContent =
      '背包 ' + GAME.Player.bagUsed() + ' / ' + GAME.Player.bagTotal() + ' 格 · 负重 ' +
      GAME.Player.weight.toFixed(1) + ' kg';
  },

  // 关闭（留东西在箱子里也照关，东西不丢）
  close: function () {
    if (!this.open) return;
    this.timers.forEach(function (t) { clearTimeout(t); });
    this.timers = [];
    this.slots = [];
    this.el['loot-panel'].classList.add('hidden');
    this.open = false;
    if (this.container && this.container.contents.length === 0) {
      GAME.Containers.markEmpty(this.container);
    }
    this.container = null;
    // 试着把鼠标锁回视角（Esc/点击都算用户操作；环境不支持就静默）
    if (GAME.Game.state === 'playing') GAME.Input.lock();
  },

  // 撤离/阵亡/重新出击时强制关闭
  forceClose: function () {
    this.close();
  }
};
