// ===== 局内背包面板：三角洲式格子背包，Tab/B 开关 =====
// 点击物品弹出操作菜单：穿装备 / 换枪 / 存保险箱 / 丢弃；底部是局内保险箱条
window.GAME = window.GAME || {};

GAME.BagPanel = {
  el: {},
  open: false,
  CELL: 46,   // 格子边长（px）
  GAP: 4,
  menuOpen: false,

  init: function () {
    var ids = ['bag-panel', 'bp-title', 'bp-grid', 'bp-cap', 'bp-weight', 'bp-value',
               'bp-meds', 'bp-cards', 'bp-close', 'bp-safe', 'bp-menu'];
    var self = this;
    ids.forEach(function (id) { self.el[id] = document.getElementById(id); });
    this.el['bp-close'].addEventListener('click', function () { self.close(); });
    // 点面板外背景关闭
    this.el['bag-panel'].addEventListener('mousedown', function (e) {
      if (e.target === self.el['bag-panel']) self.close();
    });
  },

  toggle: function () {
    if (this.open) this.close();
    else this.openPanel();
  },

  openPanel: function () {
    if (GAME.Game.state !== 'playing' || this.open) return;
    this.open = true;
    this.render();
    this.el['bag-panel'].classList.remove('hidden');
    GAME.Input.unlock(); // 释放鼠标，才能点击背包里的东西
  },

  close: function () {
    if (!this.open) return;
    this._closeMenu();
    this.open = false;
    this.el['bag-panel'].classList.add('hidden');
    if (GAME.Game.state === 'playing') GAME.Input.lock();
  },

  // 战局结束时强制收起（不重新锁定，结算界面需要鼠标）
  forceClose: function () {
    this.open = false;
    this.menuOpen = false;
    if (this.el['bag-panel']) this.el['bag-panel'].classList.add('hidden');
    if (this.el['bp-menu']) this.el['bp-menu'].classList.add('hidden');
  },

  render: function () {
    var p = GAME.Player;
    var C = GAME.Config;
    var cell = this.CELL, gap = this.GAP, step = cell + gap;
    var cols = p.bagCols, rows = p.bagRows;
    var grid = this.el['bp-grid'];
    var self = this;

    this.el['bp-title'].textContent = p.bagDef ? p.bagDef.name : '口袋（未装备背包）';

    grid.innerHTML = '';
    grid.style.width = (cols * step - gap) + 'px';
    grid.style.height = (rows * step - gap) + 'px';

    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var c = document.createElement('div');
        c.className = 'grid-cell';
        c.style.left = (x * step) + 'px';
        c.style.top = (y * step) + 'px';
        c.style.width = cell + 'px';
        c.style.height = cell + 'px';
        grid.appendChild(c);
      }
    }

    p.bag.forEach(function (entry, idx) {
      var d = GAME.Items.get(entry.id);
      var s = GAME.Items.size(entry.id);
      var el = document.createElement('div');
      el.className = 'inv-item r' + d.rarity;
      el.style.left = (entry.x * step) + 'px';
      el.style.top = (entry.y * step) + 'px';
      el.style.width = (s.w * step - gap) + 'px';
      el.style.height = (s.h * step - gap) + 'px';
      el.title = d.name + ' · 点击操作';
      el.innerHTML =
        '<span class="ii-grade g' + d.rarity + '">' + GAME.Items.gradeRoman[d.rarity] + '</span>' +
        '<span class="ii-name">' + d.name + '</span>' +
        '<span class="ii-price">¥' + d.price + '</span>';
      el.addEventListener('click', function (ev) {
        ev.stopPropagation();
        self._openMenu(idx, ev.clientX, ev.clientY);
      });
      grid.appendChild(el);
    });

    if (p.bag.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'grid-empty';
      empty.textContent = '背包是空的，去搜刮容器吧';
      grid.appendChild(empty);
    }

    this.el['bp-cap'].textContent = '容量 ' + p.bagUsed() + ' / ' + p.bagTotal() + ' 格';
    var wEl = this.el['bp-weight'];
    wEl.textContent = '负重 ' + p.weight.toFixed(1) + ' / ' + C.WEIGHT_OVER + ' kg';
    wEl.className = p.weight > C.WEIGHT_LIMIT ? 'over' : '';
    this.el['bp-value'].textContent = '估值 ¥ ' + p.lootValue;
    this.el['bp-meds'].textContent = '急救包 × ' + p.meds + '（H 使用）';

    // 房卡：显示每张的剩余次数
    var cardTexts = [];
    for (var ci = 0; ci < p.cards.length; ci++) {
      var cd = GAME.Items.get(p.cards[ci].id);
      cardTexts.push(cd.name + '（' + p.cards[ci].uses + ' 次）');
    }
    this.el['bp-cards'].textContent = cardTexts.length ? '房卡 ' + cardTexts.join(' · ') : '房卡 × 0';

    this._renderSafe();
  },

  // 底部保险箱条：存进去的东西阵亡不丢，点击取出
  _renderSafe: function () {
    var p = GAME.Player;
    var safe = this.el['bp-safe'];
    var self = this;
    safe.innerHTML = '';
    for (var i = 0; i < p.SAFE_MAX; i++) {
      var slot = document.createElement('div');
      slot.className = 'bp-safe-slot';
      var e = p.safeItems[i];
      if (e) {
        var d = GAME.Items.get(e.id);
        slot.classList.add('filled');
        slot.style.borderColor = GAME.Items.color(d);
        slot.innerHTML = '<span class="ii-name">' + d.name + '</span>';
        slot.title = d.name + ' · 点击取出';
        slot.addEventListener('click', function (i) {
          return function () { self._act(p.safeTake(i)); };
        }(i));
      }
      safe.appendChild(slot);
    }
  },

  // ---------- 物品操作菜单 ----------
  _openMenu: function (idx, mx, my) {
    var p = GAME.Player;
    var e = p.bag[idx];
    if (!e) return;
    var d = GAME.Items.get(e.id);
    var self = this;
    var acts = [];

    // 按物品类别给出换装选项
    if (d.cat === 'weapon') {
      acts.push({
        t: d.slot === 'secondary' ? '装备为副武器' : '装备为主武器',
        f: function () { self._act(p.equipWeaponFromBag(idx)); }
      });
    }
    if (d.cat === 'helmet') {
      acts.push({ t: '戴上头盔', f: function () { self._act(p.equipHelmetFromBag(idx)); } });
    }
    if (d.cat === 'armor') {
      acts.push({ t: '穿上护甲', f: function () { self._act(p.equipArmorFromBag(idx)); } });
    }
    if (d.cat === 'bag') {
      acts.push({ t: '更换背包', f: function () { self._act(p.equipBagFromBag(idx)); } });
    }
    if (d.cat === 'melee') {
      acts.push({ t: '装备刀皮', f: function () { self._act(p.equipMeleeFromBag(idx)); } });
    }
    acts.push({ t: '存入保险箱', f: function () { self._act(p.safeStore(idx)); } });
    acts.push({ t: '丢弃', danger: true, f: function () { self._drop(idx); } });

    var menu = this.el['bp-menu'];
    var html = '<div class="bpm-head">' +
      '<span class="bpm-name" style="color:' + GAME.Items.color(d) + '">' + d.name + '</span>' +
      '<span class="bpm-price">¥' + d.price + '</span></div>';
    acts.forEach(function (a, i) {
      html += '<button class="bpm-btn' + (a.danger ? ' danger' : '') + '" data-i="' + i + '">' + a.t + '</button>';
    });
    menu.innerHTML = html;
    menu.classList.remove('hidden');
    this.menuOpen = true;

    // 菜单按钮事件
    menu.querySelectorAll('.bpm-btn').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        acts[parseInt(btn.getAttribute('data-i'), 10)].f();
      });
    });

    // 定位（贴着点击点，超出屏幕就往回收）
    menu.style.left = '0px'; menu.style.top = '0px'; // 先显示再量尺寸
    var mw = menu.offsetWidth, mh = menu.offsetHeight;
    var x = Math.min(Math.max(8, mx + 6), window.innerWidth - mw - 8);
    var y = Math.min(Math.max(8, my - 10), window.innerHeight - mh - 8);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    // 点菜单外面就收起（下一次 mousedown 生效，不影响本次点击）
    this._menuDocClose = function (ev) {
      if (!menu.contains(ev.target)) self._closeMenu();
    };
    var selfDoc = this._menuDocClose;
    setTimeout(function () {
      document.addEventListener('mousedown', selfDoc);
    }, 0);
  },

  _closeMenu: function () {
    if (!this.menuOpen) return;
    this.menuOpen = false;
    if (this.el['bp-menu']) this.el['bp-menu'].classList.add('hidden');
    if (this._menuDocClose) {
      document.removeEventListener('mousedown', this._menuDocClose);
      this._menuDocClose = null;
    }
  },

  // 执行一个换装/保险箱操作：提示 + 音效 + 刷新界面
  _act: function (res) {
    this._closeMenu();
    if (!res) return;
    if (res.ok) {
      GAME.Audio.pickup();
      GAME.HUD.killFeed(res.msg);
    } else {
      GAME.Audio.empty();
      GAME.HUD.killFeed(res.msg);
    }
    this.render();
  },

  // 丢弃第 idx 件：从背包移除并扔到脚边
  _drop: function (idx) {
    this._closeMenu();
    var p = GAME.Player;
    var e = p.removeAt(idx);
    if (!e) return;
    GAME.Loot.dropAt(p.pos, e.id);
    GAME.Audio.pickup();
    GAME.HUD.killFeed('丢下了 ' + GAME.Items.get(e.id).name);
    this.render();
  }
};
