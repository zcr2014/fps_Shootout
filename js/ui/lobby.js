// ===== 大厅：出击（选图+装备）/ 仓库（格子+拖拽）/ 市场 =====
window.GAME = window.GAME || {};

GAME.Lobby = {
  el: {},
  selectedMap: GAME.Maps ? GAME.Maps.DEFAULT : 'dam',
  onDeploy: null,
  inspectingId: null,
  CELL: 44,       // 格子边长（px）
  GAP: 4,         // 格子间距（px）

  init: function (onDeploy) {
    this.onDeploy = onDeploy;
    var ids = ['hub', 'hub-money', 'hub-body', 'map-cards', 'loadout-box', 'deploy-summary',
               'btn-deploy', 'stash-grid', 'stash-cap', 'market-grid', 'inspector', 'toast',
               'sell-rates', 'safe-box', 'safe-cap', 'gear-value', 'bag-cap', 'attach-box',
               'operator-cards',
               'base-overview', 'base-detail', 'base-col-left', 'base-col-right', 'base-links',
               'btn-enter-base',
               'base-back', 'bd-name', 'bd-en', 'bd-holo', 'bd-lv-old', 'bd-lv-new',
               'bd-unlock-grid', 'bd-effect', 'bd-cost', 'bd-upgrade', 'bd-range',
               'craft-box', 'craft-cap', 'collect-cap', 'collection-box',
               'slot-weapon', 'slot-secondary', 'slot-melee', 'slot-helmet', 'slot-armor', 'slot-bag'];
    var self = this;
    ids.forEach(function (id) { self.el[id] = document.getElementById(id); });

    // 页签切换
    var tabs = document.querySelectorAll('.hub-tabs button');
    Array.prototype.forEach.call(tabs, function (btn) {
      btn.addEventListener('click', function () { self.switchTab(btn.getAttribute('data-tab')); });
    });

    this.el['btn-deploy'].addEventListener('click', function () {
      self.onDeploy(self.selectedMap);
    });

    // 特勤处：点部门卡片进设施详情 / 返回总览 / 升级设施
    [this.el['base-col-left'], this.el['base-col-right']].forEach(function (col) {
      col.addEventListener('click', function (e) {
        var card = e.target.closest ? e.target.closest('[data-dept]') : null;
        if (!card) return;
        GAME.Audio.pickup();
        self.openDept(card.getAttribute('data-dept'));
      });
    });
    this.el['base-back'].addEventListener('click', function () { self.showBaseOverview(); });
    // 进入可走动的 3D 特勤处
    this.el['btn-enter-base'].addEventListener('click', function () {
      if (GAME.Game) GAME.Game.enterBase();
    });
    // 靶场详情页的直达入口（也可以走进 3D 特勤处到靶场按 E）
    this.el['bd-range'].addEventListener('click', function () {
      if (GAME.Game) GAME.Game.enterRange();
    });
    this.el['bd-upgrade'].addEventListener('click', function () {
      var r = GAME.Base.upgrade(self.baseDept);
      self.toast(r.msg, r.ok);
      if (r.ok) GAME.Audio.pickup();
      self.refresh();
    });
    this.el['craft-box'].addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-craft]') : null;
      if (!btn) return;
      var r = GAME.Base.startCraft(btn.getAttribute('data-craft'));
      self.toast(r.msg, r.ok);
      if (r.ok) GAME.Audio.pickup();
      self.refresh();
    });

    // 窗口尺寸变化后重画特勤处连线
    window.addEventListener('resize', function () { self.drawBaseLinks(); });

    // 从存档恢复上次选择的地图
    GAME.Profile.load();
    this.selectedMap = GAME.Profile.data.mapId || GAME.Maps.DEFAULT;
  },

  show: function () {
    this.el['hub'].classList.remove('hidden');
    this.inspectingId = null;
    this.el['inspector'].classList.add('hidden');
    this.refresh();
    this.switchTab('deploy');
  },

  hide: function () { this.el['hub'].classList.add('hidden'); },

  switchTab: function (name) {
    this.currentTab = name;
    var tabs = document.querySelectorAll('.hub-tabs button');
    Array.prototype.forEach.call(tabs, function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === name);
    });
    var secs = document.querySelectorAll('.tab');
    Array.prototype.forEach.call(secs, function (sec) {
      sec.classList.toggle('active', sec.id === 'tab-' + name);
    });
    this.el['inspector'].classList.add('hidden');
    // 进入特勤处时回到总览
    if (name === 'base') {
      this.baseDept = null;
      this.el['base-overview'].classList.remove('hidden');
      this.el['base-detail'].classList.add('hidden');
      var self = this;
      requestAnimationFrame(function () { self.renderBase(); });
    }
  },

  refresh: function () {
    this.el['hub-money'].textContent = GAME.Profile.money();
    this.renderOperators();
    this.renderMaps();
    this.renderLoadout();
    this.renderStash();
    this.renderMarket();
    this.renderBase();
  },

  // ---------- 特勤处页 ----------
  renderBase: function () {
    if (!this.el['base-col-left']) return;
    GAME.Base.ensure();
    this.renderDeptCards();
    this.renderCraftPanel();
    this.renderCollectionPanel();
    if (this.baseDept) this.renderDeptDetail();
  },

  // 总览：五个部门卡片，按左右阵营分组
  renderDeptCards: function () {
    var B = GAME.Base, left = '', right = '';
    var groups = [
      { side: 'left', label: '战术部门', ids: ['train', 'range'] },
      { side: 'left', label: '后勤部门', ids: ['craft'] },
      { side: 'right', label: '医疗部门', ids: ['med'] },
      { side: 'right', label: '收藏部门', ids: ['collect'] }
    ];
    groups.forEach(function (g) {
      var h = '<div class="dept-group"><div class="dg-label">' + g.label + '</div>';
      g.ids.forEach(function (id) {
        var dp = B.dept(id);
        h +=
          '<div class="dc-card" data-dept="' + id + '">' +
            '<span class="dc-ic">' + dp.icon + '</span>' +
            '<span class="dc-txt">' +
              '<span class="dc-name">' + dp.name + '</span>' +
              '<span class="dc-lv">Lv.' + B.level(id) + '</span>' +
            '</span>' +
            '<span class="dc-node"></span>' +
          '</div>';
      });
      h += '</div>';
      if (g.side === 'left') left += h; else right += h;
    });
    this.el['base-col-left'].innerHTML = left;
    this.el['base-col-right'].innerHTML = right;

    // 等布局完成后再画连线
    var self = this;
    requestAnimationFrame(function () { self.drawBaseLinks(); });
  },

  // 部门卡片到全息基地的连线
  drawBaseLinks: function () {
    var host = this.el['base-overview'];
    var svg = this.el['base-links'];
    if (!host || !svg || host.classList.contains('hidden')) return;
    var stage = host.querySelector('.bo-stage');
    var holo = host.querySelector('.holo-base');
    if (!stage || !holo) return;
    var sr = stage.getBoundingClientRect();
    if (sr.width < 10 || sr.height < 10) return;
    var hr = holo.getBoundingClientRect();
    var cx = hr.left + hr.width / 2 - sr.left;
    var cy = hr.top + hr.height * 0.5 - sr.top;
    var d = '';
    var nodes = stage.querySelectorAll('.dc-node');
    for (var i = 0; i < nodes.length; i++) {
      var r = nodes[i].getBoundingClientRect();
      var x = r.left + r.width / 2 - sr.left;
      var y = r.top + r.height / 2 - sr.top;
      d += 'M' + x.toFixed(1) + ' ' + y.toFixed(1) + 'L' + cx.toFixed(1) + ' ' + cy.toFixed(1);
    }
    svg.setAttribute('viewBox', '0 0 ' + sr.width + ' ' + sr.height);
    svg.innerHTML =
      '<path d="' + d + '" fill="none" stroke="rgba(99,216,255,.30)" stroke-width="1"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="2" fill="rgba(143,230,255,.8)"/>';
  },

  showBaseOverview: function () {
    this.baseDept = null;
    this.el['base-overview'].classList.remove('hidden');
    this.el['base-detail'].classList.add('hidden');
    this.renderBase();
  },

  openDept: function (id) {
    if (!GAME.Base.dept(id)) return;
    this.baseDept = id;
    this.el['base-overview'].classList.add('hidden');
    this.el['base-detail'].classList.remove('hidden');
    this.renderDeptDetail();
  },

  // 详情：全息设施 + 等级对比 + 升级后解锁 + 材料 / 升级按钮
  renderDeptDetail: function () {
    var B = GAME.Base, P = GAME.Profile, dp = B.dept(this.baseDept);
    if (!dp) return;
    var lv = B.level(dp.id);
    var maxed = lv >= B.MAX_LV;
    var target = maxed ? lv : lv + 1;

    this.el['bd-name'].textContent = dp.name;
    this.el['bd-en'].textContent = dp.en;
    this.el['bd-lv-old'].textContent = 'Lv.' + lv;
    this.el['bd-lv-new'].textContent = maxed ? 'MAX' : 'Lv.' + target;

    // 升级后解锁：一排方形格子
    var cells = this.unlockCells(dp.id, target, lv);
    var g = '';
    cells.forEach(function (c) {
      g += '<div class="bd-cell">' +
             '<span class="bc-glyph">' + c.icon + '</span>' +
             '<span class="bc-label">' + c.name + '</span>' +
           '</div>';
    });
    if (!g) g = '<div class="bd-cell empty"><span class="bc-label">已全部解锁</span></div>';
    this.el['bd-unlock-grid'].innerHTML = g;

    // 当前 / 目标等级的效果
    this.el['bd-effect'].textContent = dp.effect(target);
    // 靶场设施额外给一个直接进入 3D 靶场的入口
    if (this.el['bd-range']) this.el['bd-range'].classList.toggle('hidden', dp.id !== 'range');

    var costEl = this.el['bd-cost'], btn = this.el['bd-upgrade'];
    if (maxed) {
      costEl.innerHTML = '<span class="bd-max">该设施已满级</span>';
      btn.textContent = '已满级';
      btn.disabled = true;
      return;
    }

    var cost = B.costFor(dp.id);
    var parts = ['<span class="gold">¥ ' + cost.money + '</span>'];
    for (var iid in cost.items) {
      var need = cost.items[iid], have = P.count(iid);
      parts.push('<span class="' + (have >= need ? '' : 'lack') + '">' +
        GAME.Items.get(iid).name + ' ' + have + '/' + need + '</span>');
    }
    costEl.innerHTML = parts.join('');
    var chk = B.canUpgrade(dp.id);
    btn.textContent = '升级到 Lv.' + target;
    btn.disabled = !chk.ok;
  },

  // 各设施升级到 targetLv 后解锁的内容（用于方形格子）
  unlockCells: function (id, targetLv, curLv) {
    var B = GAME.Base, out = [];
    if (id === 'craft') {
      B.RECIPES.forEach(function (r) {
        if (r.lv > curLv && r.lv <= targetLv) out.push({ icon: '▣', name: r.name });
      });
      if (!out.length) out.push({ icon: '✓', name: '配方全解锁' });
    } else if (id === 'train') {
      out.push({ icon: '✚', name: '生命 +' + 4 * (targetLv - 1) });
      out.push({ icon: '➤', name: '移速 +' + Math.round(1.2 * (targetLv - 1)) + '%' });
    } else if (id === 'range') {
      out.push({ icon: '⚖', name: '负重 +' + 3 * (targetLv - 1) + 'kg' });
    } else if (id === 'med') {
      out.push({ icon: '✚', name: '治疗 +' + 12 * (targetLv - 1) + '%' });
    } else if (id === 'collect') {
      out.push({ icon: '★', name: '展位 ' + targetLv * 2 + ' 格' });
    }
    return out;
  },

  // 制造台（含每秒倒计时）
  renderCraftPanel: function () {
    var B = GAME.Base, P = GAME.Profile, self = this;
    var done = B.tick();
    if (done) this.toast('制造完成：' + done + ' 已放入仓库', true);

    var st = B.craftState();
    var craftLv = B.level('craft');
    var craftHtml = '';
    if (st) {
      var r = B.recipe(st.id);
      var pct = r ? Math.max(0, Math.min(100, 100 - (st.left / r.time) * 100)) : 0;
      craftHtml =
        '<div class="craft-now">' +
          '<div class="cn-row"><b>正在制造：' + (r ? r.name : st.id) + '</b>' +
          '<span class="dim">剩余 ' + st.left + ' 秒</span></div>' +
          '<div class="cn-bar"><i style="width:' + pct + '%"></i></div>' +
        '</div>';
    } else {
      craftHtml = '<div class="craft-idle dim">制造台空闲 · 选一个配方开始生产（完成后自动放进仓库）</div>';
    }
    B.RECIPES.forEach(function (rec) {
      var unlocked = craftLv >= rec.lv;
      var parts = [];
      for (var iid in rec.items) {
        var need = rec.items[iid], have = P.count(iid);
        parts.push('<span class="' + (have >= need ? '' : 'lack') + '">' +
          GAME.Items.get(iid).name + ' ' + have + '/' + need + '</span>');
      }
      craftHtml +=
        '<div class="craft-row' + (unlocked ? '' : ' locked') + '">' +
          '<span class="cr-name">' + rec.name + '</span>' +
          '<span class="cr-req">Lv.' + rec.lv + '</span>' +
          '<span class="cr-mat">¥' + rec.money + (parts.length ? ' · ' + parts.join(' · ') : '') + '</span>' +
          '<span class="cr-time">' + Math.round(rec.time / 60) + ' 分钟</span>' +
          '<button class="cr-btn" data-craft="' + rec.id + '"' +
            ((unlocked && !st) ? '' : ' disabled') + '>' +
            (unlocked ? '制造' : '未解锁') + '</button>' +
        '</div>';
    });
    this.el['craft-box'].innerHTML = craftHtml;
    this.el['craft-cap'].textContent = '（Lv.' + craftLv + ' · 单件生产）';

    // 制造中：每秒刷新一次倒计时
    clearTimeout(this._baseTimer);
    if (st && this.currentTab === 'base') {
      this._baseTimer = setTimeout(function () { self.renderCraftPanel(); }, 1000);
    }
  },

  renderCollectionPanel: function () {
    var B = GAME.Base;
    var list = B.collection();
    var cap = B.level('collect') * 2;
    var colHtml = '';
    if (list.length === 0) {
      colHtml = '<div class="dim">还没有稀有收藏品。带出四阶以上的战利品后，这里会自动陈列。</div>';
    } else {
      list.slice(0, cap).forEach(function (it) {
        colHtml += '<div class="col-card r' + it.rarity + '">' +
          '<span class="col-g">' + GAME.Items.gradeRoman[it.rarity] + '</span>' +
          '<span class="col-name">' + it.name + '</span>' +
          '<span class="col-n">×' + it.n + '</span></div>';
      });
      if (list.length > cap) {
        colHtml += '<div class="dim">还有 ' + (list.length - cap) + ' 件未展示 · 升级收藏室可扩大展位</div>';
      }
    }
    this.el['collection-box'].innerHTML = colHtml;
    this.el['collect-cap'].textContent = '（展位 ' + Math.min(list.length, cap) + ' / ' + cap + '）';
  },

  // ---------- 干员选择（出击页顶部）----------
  renderOperators: function () {
    var self = this;
    var box = this.el['operator-cards'];
    box.innerHTML = '';
    var current = GAME.Profile.data.operatorId;

    GAME.Operators.list.forEach(function (op) {
      var passive = GAME.Operators.passiveOf(op);
      var card = document.createElement('div');
      card.className = 'op-card' + (op.id === current ? ' selected' : '');
      card.style.borderColor = op.id === current ? op.color : '';
      card.innerHTML =
        '<div class="oc-head">' +
          '<span class="oc-name">' + op.name + '</span>' +
          '<span class="oc-en">' + op.en + '</span>' +
          '<span class="oc-role" style="background:' + op.color + '">' + op.role + '</span>' +
        '</div>' +
        '<div class="oc-desc">' + op.desc + '</div>' +
        '<div class="oc-skill"><b>[X] ' + op.skill.name + '</b><span>' + op.skill.desc + '</span></div>' +
        '<div class="oc-passive"><b>特性</b><span>' + passive.desc + '</span></div>';
      card.addEventListener('click', function () {
        GAME.Profile.data.operatorId = op.id;
        GAME.Profile.save();
        GAME.Audio.pickup();
        self.renderOperators();
        self.renderLoadout();
      });
      box.appendChild(card);
    });
  },

  toast: function (msg, ok) {
    var el = this.el['toast'];
    el.textContent = msg;
    el.classList.remove('hidden');
    el.classList.toggle('bad', !ok);
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(function () { el.classList.add('hidden'); }, 2200);
  },

  // ---------- 出击页 ----------
  renderMaps: function () {
    var self = this;
    var box = this.el['map-cards'];
    box.innerHTML = '';
    GAME.Maps.list.forEach(function (m) {
      var card = document.createElement('div');
      card.className = 'map-card risk' + m.riskLevel + (m.id === self.selectedMap ? ' selected' : '');
      card.innerHTML =
        '<div class="mc-risk">风险 ' + m.risk + '</div>' +
        '<div class="mc-name">' + m.name + '</div>' +
        '<div class="mc-desc">' + m.desc + '</div>' +
        '<div class="mc-stats">' +
          '<span>敌人 ' + m.enemies + '</span>' +
          '<span>时限 ' + (m.time / 60) + ' 分</span>' +
          '<span>容器 ' + m.containers + ' · 楼宇 ' + m.buildings + '</span>' +
        '</div>';
      card.addEventListener('click', function () {
        self.selectedMap = m.id;
        GAME.Profile.data.mapId = m.id;
        GAME.Profile.save();
        self.renderMaps();
        self.renderLoadout();
      });
      box.appendChild(card);
    });
  },

  renderLoadout: function () {
    var P = GAME.Profile;
    var box = this.el['loadout-box'];
    var curW = P.resolveWeapon();
    var curS = P.resolveSecondary();
    // 主武器已装配件摘要
    var attTxt = '未装备主武器';
    if (!curW.free) {
      var amap = P.getAttach(curW.id);
      attTxt = GAME.Items.attachKinds.map(function (k) {
        var d = amap[k] ? GAME.Items.get(amap[k]) : null;
        return GAME.Items.attachLabels[k] + ' ' + (d ? d.name : '空');
      }).join(' · ');
    }
    var curMelee = P.resolveMelee();
    var curHelmet = P.resolveHelmet();
    var curArmor = P.resolveArmor();
    var curBag = P.resolveBag();
    var medsHave = P.count('medkit');
    var medsCarry = Math.min(medsHave, GAME.Config.MAX_MEDS);
    var m = GAME.Maps.get(this.selectedMap);
    var curOp = GAME.Profile.resolveOperator();
    var opPassive = GAME.Operators.passiveOf(curOp);
    var bagDef = curBag ? GAME.Items.get(curBag.id) : null;
    var bagCells = bagDef ? bagDef.gridW * bagDef.gridH
                          : GAME.Config.POCKET_COLS * GAME.Config.POCKET_ROWS;

    box.innerHTML =
      '<div class="lo-row"><span class="lo-label">干员</span>' +
        '<span class="lo-val"><b style="color:' + curOp.color + '">' + curOp.name + '</b>' +
        '（' + curOp.role + '）· [X] ' + curOp.skill.name + ' · ' + opPassive.desc + '</span></div>' +
      '<div class="lo-row"><span class="lo-label">主武器</span>' +
        '<span class="lo-val">' + (curW.free
          ? '未装备 · 配发制式手枪（阵亡不损失）'
          : GAME.Items.get(curW.id).name) + '</span></div>' +
      '<div class="lo-row"><span class="lo-label">枪械改装</span>' +
        '<span class="lo-val" style="font-size:12px">' + attTxt + '</span></div>' +
      '<div class="lo-row"><span class="lo-label">副武器（2 键）</span>' +
        '<span class="lo-val">' + (curS ? GAME.Items.get(curS.id).name : '未装备 · 买手枪放入副武器槽') + '</span></div>' +
      '<div class="lo-row"><span class="lo-label">近战（3 键）</span>' +
        '<span class="lo-val">' + GAME.Items.get(curMelee.id).name +
        (curMelee.free ? '（绑定 · 阵亡不损失）' : '（刀皮 · 阵亡不损失）') + '</span></div>' +
      '<div class="lo-row"><span class="lo-label">头盔</span>' +
        '<span class="lo-val">' + (curHelmet ? GAME.Items.get(curHelmet.id).name : '未装备') + '</span></div>' +
      '<div class="lo-row"><span class="lo-label">护甲</span>' +
        '<span class="lo-val">' + (curArmor ? GAME.Items.get(curArmor.id).name : '未装备') + '</span></div>' +
      '<div class="lo-row"><span class="lo-label">背包</span>' +
        '<span class="lo-val">' + (bagDef
          ? bagDef.name + '（' + bagDef.gridW + '×' + bagDef.gridH + ' 格）'
          : '未装备 · 只有 ' + GAME.Config.POCKET_COLS + '×' + GAME.Config.POCKET_ROWS + ' 口袋') + '</span></div>' +
      '<div class="lo-row"><span class="lo-label">急救包</span>' +
        '<span class="lo-val">持有 ' + medsHave + ' 个 · 本局携带 ' + medsCarry + ' 个（H 使用）</span></div>' +
      '<div class="lo-hint">提示：在「仓库」页把装备拖进左上角装备栏即可装备；局内按 Tab 打开背包；保险箱里的东西阵亡不会丢</div>';

    // 出击摘要：地图风险 + 装备价值
    var gearValue = 0;
    if (!curW.free) { gearValue += GAME.Items.get(curW.id).price; gearValue += P.attachValue(curW.id); }
    if (curS) { gearValue += GAME.Items.get(curS.id).price; gearValue += P.attachValue(curS.id); }
    if (curHelmet) gearValue += GAME.Items.get(curHelmet.id).price;
    if (curArmor) gearValue += GAME.Items.get(curArmor.id).price;
    if (bagDef) gearValue += bagDef.price;
    this.el['deploy-summary'].innerHTML =
      '<span>区域：<b>' + m.name + '</b>（风险 ' + m.risk + '）</span>' +
      '<span>风险装备价值：<b class="gold">¥ ' + gearValue + '</b>（阵亡会损失）</span>' +
      '<span>背包容量：<b>' + bagCells + '</b> 格</span>';
  },

  // ---------- 仓库页（格子 + 拖拽）----------
  renderStash: function () {
    var P = GAME.Profile;
    this.el['stash-cap'].textContent =
      '（' + P.usedSlots() + ' / ' + P.totalSlots() + ' 格）';
    this.el['safe-cap'].textContent =
      '（' + P.safeUsed() + ' / ' + P.safeTotal() + ' 格 · 阵亡不掉）';
    this._renderEquip();
    this._renderAttach();
    this._renderGrid();
    this._renderSafe();
  },

  // 保险箱：3×3，阵亡不掉
  _renderSafe: function () {
    var P = GAME.Profile;
    var box = this.el['safe-box'];
    var cell = this.CELL, gap = this.GAP, step = cell + gap;
    var cols = P.colsSafe(), rows = P.rowsSafe();
    var self = this;

    box.innerHTML = '';
    box.style.width = (cols * step - gap) + 'px';
    box.style.height = (rows * step - gap) + 'px';

    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var c = document.createElement('div');
        c.className = 'grid-cell safe-cell';
        c.style.left = (x * step) + 'px';
        c.style.top = (y * step) + 'px';
        c.style.width = cell + 'px';
        c.style.height = cell + 'px';
        box.appendChild(c);
      }
    }

    P.data.safe.items.forEach(function (entry) {
      var block = self._makeBlock(entry, { x: entry.x, y: entry.y, safe: true });
      self._bindDrag(block, entry, 'safe');
      box.appendChild(block);
    });
  },

  _renderEquip: function () {
    var P = GAME.Profile;
    var cell = this.CELL, gap = this.GAP, step = cell + gap;
    var self = this;
    var value = 0;

    GAME.Items.equipSlots.forEach(function (slot) {
      var zone = self.el['slot-' + slot.kind];
      if (!zone) return;
      zone.innerHTML = '';
      zone.style.width = (slot.w * step - gap) + 'px';
      zone.style.height = (slot.h * step - gap) + 'px';

      for (var y = 0; y < slot.h; y++) {
        for (var x = 0; x < slot.w; x++) {
          var c = document.createElement('div');
          c.className = 'grid-cell';
          c.style.left = (x * step) + 'px';
          c.style.top = (y * step) + 'px';
          c.style.width = cell + 'px';
          c.style.height = cell + 'px';
          zone.appendChild(c);
        }
      }

      var eq = P.data.equip[slot.kind];
      if (eq) {
        var block = self._makeBlock(eq, { x: 0, y: 0, equipped: true });
        self._bindDrag(block, eq, 'equip', slot.kind);
        zone.appendChild(block);
        var d = GAME.Items.get(eq.id);
        // 近战武器/刀皮阵亡不会丢失，不计入“风险装备价值”
        if (d && d.cat !== 'melee') value += d.price;
        // 枪上装着的配件也会跟着枪一起损失
        if (d && d.cat === 'weapon') value += P.attachValue(eq.id);
      }
    });

    // 装备价值（阵亡会损失的装备总和）
    this.el['gear-value'].textContent = '¥ ' + value;

    // 背包容量提示
    var b = P.data.equip.bag;
    var bd = b ? GAME.Items.get(b.id) : null;
    this.el['bag-cap'].textContent = bd
      ? '（' + bd.gridW + '×' + bd.gridH + ' 格）'
      : '（未装备 · ' + GAME.Config.POCKET_COLS + '×' + GAME.Config.POCKET_ROWS + ' 口袋）';
  },

  // 枪械改装：主武器四个改装位，点击循环切换仓库里的同类配件
  _renderAttach: function () {
    var box = this.el['attach-box'];
    if (!box) return;
    var P = GAME.Profile;
    var w = P.data.equip.weapon;
    // 装备栏为空时，改装默认配发的免费主武器（阵亡后仍能继续改枪）
    var wepId = (w && GAME.Items.get(w.id)) ? w.id : GAME.Config.DEFAULT_WEAPON;
    var wd = GAME.Items.get(wepId);
    if (!wd) {
      box.innerHTML = '<div class="attach-empty">先在左上角装备一把主武器，才能改装</div>';
      return;
    }
    var self = this;
    var map = P.data.attach[wepId] || {};
    var html = '<div class="attach-title">' + wd.name + (w ? '' : '（默认配发）') + '</div>';
    GAME.Items.attachKinds.forEach(function (kind) {
      var e = map[kind];
      var d = e ? GAME.Items.get(e.id) : null;
      html += '<button class="attach-slot" data-kind="' + kind + '">' +
        '<span class="as-kind">' + GAME.Items.attachLabels[kind] + '</span>' +
        '<span class="as-name' + (d ? '' : ' dim') + '">' + (d ? d.name : '空') + '</span>' +
        '<span class="as-op">切换</span></button>';
    });
    html += '<div class="attach-hint">点击切换：仓库里的同类配件 → 不装。装配后会显示在枪上并影响后坐/散布/开镜/弹匣。靶场可免费试用全部配件。</div>';
    box.innerHTML = html;
    box.onclick = function (e) {
      var b = e.target.closest ? e.target.closest('[data-kind]') : null;
      if (!b) return;
      self._cycleAttach(wepId, b.getAttribute('data-kind'));
    };
  },

  _cycleAttach: function (weaponId, kind) {
    var P = GAME.Profile;
    var cur = P.attachEntry(weaponId, kind);
    var curUid = cur ? cur.uid : null;
    var cands = [{ uid: null, id: null }];
    P.data.grid.items.concat(P.data.safe.items).forEach(function (it) {
      var d = GAME.Items.get(it.id);
      if (d && d.cat === 'attach' && d.attach === kind) cands.push({ uid: it.uid, id: it.id });
    });
    // 当前已装的配件不在仓库里（已从库存取出），也要能切回“不装”
    var found = -1;
    for (var i = 0; i < cands.length; i++) {
      if ((cands[i].uid || null) === curUid) { found = i; break; }
    }
    if (found < 0) cands.push({ uid: curUid, id: cur.id });

    var next = cands[(found + 1) % cands.length];
    if (!curUid && !next.uid) {
      this.toast('仓库里没有' + GAME.Items.attachLabels[kind] + '配件', false);
      return;
    }
    if (next.uid === curUid) return;

    if (!next.uid) {
      var r = P.removeAttach(weaponId, kind);
      this.toast(r.msg, r.ok);
      if (r.ok) GAME.Audio.pickup();
    } else {
      var old = cur;
      if (cur) {
        var rr = P.removeAttach(weaponId, kind);
        if (!rr.ok) { this.toast(rr.msg, false); return; }
      }
      var r2 = P.installAttach(weaponId, kind, next.uid);
      if (!r2.ok && old) P.installAttach(weaponId, kind, old.uid);
      this.toast(r2.msg, r2.ok);
      if (r2.ok) GAME.Audio.pickup();
    }
    this.refresh();
  },

  _renderGrid: function () {
    var P = GAME.Profile;
    var gridEl = this.el['stash-grid'];
    var cell = this.CELL, gap = this.GAP, step = cell + gap;
    var cols = P.cols(), rows = P.rows();
    var self = this;

    gridEl.innerHTML = '';
    gridEl.style.width = (cols * step - gap) + 'px';
    gridEl.style.height = (rows * step - gap) + 'px';

    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var c = document.createElement('div');
        c.className = 'grid-cell';
        c.style.left = (x * step) + 'px';
        c.style.top = (y * step) + 'px';
        c.style.width = cell + 'px';
        c.style.height = cell + 'px';
        gridEl.appendChild(c);
      }
    }

    var items = P.data.grid.items;
    items.forEach(function (entry) {
      var block = self._makeBlock(entry, { x: entry.x, y: entry.y });
      self._bindDrag(block, entry, 'grid');
      gridEl.appendChild(block);
    });

    if (items.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'grid-empty';
      empty.textContent = '仓库空空如也，去市场采购或出击搜集物资吧';
      gridEl.appendChild(empty);
    }
  },

  // 生成一件占据多格的物品块
  _makeBlock: function (entry, opts) {
    var d = GAME.Items.get(entry.id);
    var cell = this.CELL, gap = this.GAP, step = cell + gap;
    var el = document.createElement('div');
    el.className = 'inv-item r' + d.rarity + (opts.equipped ? ' equipped' : '') + (opts.safe ? ' in-safe' : '');
    el.style.left = (opts.x * step) + 'px';
    el.style.top = (opts.y * step) + 'px';
    el.style.width = (d.w * step - gap) + 'px';
    el.style.height = (d.h * step - gap) + 'px';
    el.innerHTML =
      '<span class="ii-grade g' + d.rarity + '">' + GAME.Items.gradeRoman[d.rarity] + '</span>' +
      '<span class="ii-name">' + d.name + '</span>' +
      '<span class="ii-price">' + (d.bound ? '绑定' : '¥' + GAME.Market.sellPrice(d.id)) + '</span>';
    return el;
  },

  // 按住拖动：换格子 / 装备 / 卸下；没拖动就是点击查看
  _bindDrag: function (el, entry, from, slotKind) {
    var self = this;
    el.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      var rect = el.getBoundingClientRect();
      var offX = e.clientX - rect.left;
      var offY = e.clientY - rect.top;
      var startX = e.clientX, startY = e.clientY;
      var moved = false, ghost = null;

      function onMove(ev) {
        if (!moved && Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) > 4) {
          moved = true;
          ghost = el.cloneNode(true);
          ghost.classList.add('drag-ghost');
          ghost.style.width = rect.width + 'px';
          ghost.style.height = rect.height + 'px';
          ghost.style.left = (ev.clientX - offX) + 'px';
          ghost.style.top = (ev.clientY - offY) + 'px';
          document.body.appendChild(ghost);
          el.classList.add('dragging');
        }
        if (ghost) {
          ghost.style.left = (ev.clientX - offX) + 'px';
          ghost.style.top = (ev.clientY - offY) + 'px';
        }
      }

      function onUp(ev) {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        el.classList.remove('dragging');
        if (ghost) ghost.remove();
        if (!moved) self.inspect(entry.id, entry.uid, from);
        else self._drop(entry, from, slotKind, ev.clientX, ev.clientY, offX, offY);
      }

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
  },

  _drop: function (entry, from, slotKind, cx, cy, offX, offY) {
    var P = GAME.Profile;
    var step = this.CELL + this.GAP;

    // 1) 拖到装备格 → 装备（仓库/保险箱里的都可装备）
    if (from === 'grid' || from === 'safe') {
      var zones = document.querySelectorAll('.equip-slot');
      for (var i = 0; i < zones.length; i++) {
        var r = zones[i].getBoundingClientRect();
        if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
          var res = P.equip(zones[i].getAttribute('data-kind'), entry.uid);
          this.toast(res.msg, res.ok);
          this.refresh();
          return;
        }
      }
    }

    // 2) 拖到仓库网格
    var gridEl = this.el['stash-grid'];
    var gr = gridEl.getBoundingClientRect();
    if (cx >= gr.left - step && cx <= gr.right + step &&
        cy >= gr.top - step && cy <= gr.bottom + step) {
      var s = GAME.Items.size(entry.id);
      var x = Math.round((cx - offX - gr.left) / step);
      var y = Math.round((cy - offY - gr.top) / step);
      x = Math.max(0, Math.min(P.cols() - s.w, x));
      y = Math.max(0, Math.min(P.rows() - s.h, y));

      if (from === 'equip') {
        var resU = P.unequip(slotKind, x, y);
        this.toast(resU.msg, resU.ok);
      } else if (from === 'safe') {
        var resG = P.transferToGrid(entry.uid, x, y);
        this.toast(resG.msg, resG.ok);
      } else if (!P.moveTo(entry.uid, x, y)) {
        this.toast('这里放不下，换个位置试试', false);
      }
      this.refresh();
      return;
    }

    // 3) 拖到保险箱
    var safeEl = this.el['safe-box'];
    var sr = safeEl.getBoundingClientRect();
    if (cx >= sr.left - step && cx <= sr.right + step &&
        cy >= sr.top - step && cy <= sr.bottom + step) {
      var s2 = GAME.Items.size(entry.id);
      var sx = Math.round((cx - offX - sr.left) / step);
      var sy = Math.round((cy - offY - sr.top) / step);
      sx = Math.max(0, Math.min(P.colsSafe() - s2.w, sx));
      sy = Math.max(0, Math.min(P.rowsSafe() - s2.h, sy));

      if (from === 'grid') {
        var resS = P.transferToSafe(entry.uid, sx, sy);
        this.toast(resS.msg, resS.ok);
      } else if (from === 'safe') {
        if (!P.moveSafe(entry.uid, sx, sy)) this.toast('这里放不下', false);
      } else if (from === 'equip') {
        // 从装备栏直接丢保险箱：先卸下再存
        var resU2 = P.unequip(slotKind);
        if (resU2.ok) {
          P.transferToSafe(P.firstUid(entry.id), sx, sy);
        }
        this.toast(resU2.msg, resU2.ok);
      }
      this.refresh();
      return;
    }

    this.refresh(); // 丢到空白处 → 回到原位
  },

  // ---------- 市场页 ----------
  renderMarket: function () {
    var grid = this.el['market-grid'];
    grid.innerHTML = '';
    var self = this;
    this._renderSellRates();
    GAME.Items.buyable.forEach(function (id) {
      var d = GAME.Items.get(id);
      var card = self._itemCard(d, 1, { price: GAME.Market.buyPrice(id), size: true });
      var btn = document.createElement('button');
      btn.className = 'buy-btn';
      btn.textContent = '购买';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var r = GAME.Market.buy(id);
        self.toast(r.msg, r.ok);
        if (r.ok) self.refresh();
      });
      card.appendChild(btn);
      card.addEventListener('click', function () { self.inspect(id); });
      grid.appendChild(card);
    });
  },

  // 变卖分级价目表
  _renderSellRates: function () {
    var box = this.el['sell-rates'];
    if (!box) return;
    var html = '<span class="sr-title">回收倍率</span>';
    for (var g = 1; g <= 5; g++) {
      html += '<span class="sr-item g' + g + '">' +
              '<b>' + GAME.Items.gradeRoman[g] + '</b> ' + GAME.Items.gradeName[g] +
              ' <span class="dim">×' + GAME.Market.sellRate(g).toFixed(2) + '</span></span>';
    }
    html += '<span class="dim">（品阶越高，回收价越接近原价）</span>';
    box.innerHTML = html;
  },

  // 市场用的物品卡片（仓库里用格子块，不用这个）
  _itemCard: function (d, count, opts) {
    opts = opts || {};
    var div = document.createElement('div');
    div.className = 'item-card r' + d.rarity + (opts.equipped ? ' equipped' : '');
    var bottom = '';
    if (opts.price) bottom = '¥ ' + opts.price;
    else if (count > 1) bottom = '×' + count;
    else bottom = '¥ ' + GAME.Market.sellPrice(d.id);
    div.innerHTML =
      '<div class="ic-tag"><span class="grade g' + d.rarity + '">' +
        GAME.Items.gradeRoman[d.rarity] + '</span> ' + GAME.Items.catLabels[d.cat] +
        ' · ' + d.w + '×' + d.h + '</div>' +
      '<div class="ic-name">' + d.name + '</div>' +
      '<div class="ic-bottom">' + bottom + (opts.equipped ? ' · 已装备' : '') + '</div>';
    return div;
  },

  // 物品详情弹层
  inspect: function (id, uid, from) {
    var d = GAME.Items.get(id);
    var P = GAME.Profile;
    var inv = this.el['inspector'];
    var self = this;
    var statLine = '';
    if (d.cat === 'weapon') {
      statLine = '伤害 ' + d.damage + ' · 弹匣 ' + d.mag + ' · 射程 ' + d.range + 'm · 射速 ' +
                 (1 / d.interval).toFixed(1) + '/秒';
    } else if (d.cat === 'melee') {
      statLine = '伤害 ' + d.damage + ' · 范围 ' + d.range + 'm · 挥砍间隔 ' +
                 d.interval + ' 秒' + (d.skinOf ? ' · 纯外观刀皮' : '');
    } else if (d.cat === 'helmet') {
      statLine = '头部减伤 ' + Math.round(d.reduce * 100) + '%';
    } else if (d.cat === 'armor') {
      statLine = '躯干减伤 ' + Math.round(d.reduce * 100) + '%';
    } else if (d.cat === 'bag') {
      statLine = '局内背包容量 ' + d.gridW + '×' + d.gridH + ' 格';
    } else if (d.cat === 'key') {
      var entry = uid ? P.findEntry(uid) : null;
      var uses = entry && entry.uses !== undefined ? entry.uses : d.uses;
      statLine = '可开启 ' + GAME.Items.keyTierName[d.keyTier] + ' · 剩余 ' + uses + ' 次';
    } else if (d.cat === 'med') {
      statLine = '治疗 ' + d.heal + ' HP';
    } else {
      statLine = '收藏品 · 可在市场出售';
    }
    if (d.weight) statLine += ' · 重量 ' + d.weight + 'kg';

    var equipped = uid ? P.isEquipped(uid) : false;
    var loc = uid ? P.entryLocation(uid) : 'grid';
    var kind = d.cat === 'weapon' ? (d.slot === 'secondary' ? 'secondary' : 'weapon') :
               (d.cat === 'melee' ? 'melee' :
               (d.cat === 'helmet' ? 'helmet' :
               (d.cat === 'armor' ? 'armor' :
               (d.cat === 'bag' ? 'bag' : null))));

    var actions = '';
    if (P.countGrid(id) > 0 && !d.bound) {
      actions += '<button class="insp-btn sell" id="insp-sell">出售 1 件（¥' +
                 GAME.Market.sellPrice(id) + '）</button>';
    }
    if (equipped) {
      actions += '<button class="insp-btn" id="insp-unequip">卸下到仓库</button>';
    } else if (kind) {
      var targetUid = uid || P.firstUid(id);
      if (targetUid) {
        var slot = P._slotOf(kind);
        actions += '<button class="insp-btn" data-equip-kind="' + kind +
                   '" data-equip-uid="' + targetUid + '">装备到' + slot.label + '</button>';
      }
    }
    if (loc === 'grid') {
      actions += '<button class="insp-btn" id="insp-safe">存入保险箱</button>';
    } else if (loc === 'safe') {
      actions += '<button class="insp-btn" id="insp-grid">取回仓库</button>';
    }
    actions += '<button class="insp-btn close" id="insp-close">关闭</button>';

    inv.className = 'inspector r' + d.rarity;
    inv.innerHTML =
      '<div class="insp-head"><span class="rname">' + d.name + '</span>' +
        '<span class="rtag">品阶 ' + GAME.Items.gradeRoman[d.rarity] + ' · ' +
        GAME.Items.gradeName[d.rarity] + ' · ' + GAME.Items.catLabels[d.cat] + '</span></div>' +
      '<div class="insp-stat">' + statLine + ' · 占用 ' + d.w + '×' + d.h + ' 格</div>' +
      '<div class="insp-desc">' + d.desc + '</div>' +
      '<div class="insp-own">持有 <b>' + P.count(id) + '</b> 件 · 仓库 <b>' + P.countGrid(id) +
        '</b> · 保险箱 <b>' + P.countSafe(id) + '</b> · 回收倍率 <b class="gold">' +
        Math.round(GAME.Market.sellRate(d.rarity) * 100) + '%</b>' +
        (equipped ? ' · <span class="green">已装备</span>' : '') + '</div>' +
      '<div class="insp-actions">' + actions + '</div>';
    inv.classList.remove('hidden');
    inv.setAttribute('data-id', id);

    document.getElementById('insp-close').addEventListener('click', function () {
      inv.classList.add('hidden');
    });

    var sellBtn = document.getElementById('insp-sell');
    if (sellBtn) sellBtn.addEventListener('click', function () {
      var r = GAME.Market.sell(id);
      self.toast(r.msg, r.ok);
      if (r.ok) {
        inv.classList.add('hidden');
        self.refresh();
      }
    });

    var unequipBtn = document.getElementById('insp-unequip');
    if (unequipBtn) unequipBtn.addEventListener('click', function () {
      var r = GAME.Profile.unequip(kind);
      self.toast(r.msg, r.ok);
      inv.classList.add('hidden');
      self.refresh();
    });

    var equipBtn = inv.querySelector('[data-equip-kind]');
    if (equipBtn) equipBtn.addEventListener('click', function () {
      var r = GAME.Profile.equip(equipBtn.getAttribute('data-equip-kind'),
                                 equipBtn.getAttribute('data-equip-uid'));
      self.toast(r.msg, r.ok);
      inv.classList.add('hidden');
      self.refresh();
    });

    var safeBtn = document.getElementById('insp-safe');
    if (safeBtn) safeBtn.addEventListener('click', function () {
      var r = GAME.Profile.transferToSafe(uid);
      self.toast(r.msg, r.ok);
      inv.classList.add('hidden');
      self.refresh();
    });

    var gridBtn = document.getElementById('insp-grid');
    if (gridBtn) gridBtn.addEventListener('click', function () {
      var r = GAME.Profile.transferToGrid(uid);
      self.toast(r.msg, r.ok);
      inv.classList.add('hidden');
      self.refresh();
    });
  }
};
