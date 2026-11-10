// ===== HUD：生命、武器弹药、护甲、药品、背包、计时、小地图 =====
window.GAME = window.GAME || {};

GAME.HUD = {
  el: {}, mmCtx: null,

  init: function () {
    var ids = ['hud', 'hp-fill', 'hp-num', 'ammo-num', 'weapon-name', 'melee-name', 'armor-num', 'med-num',
               'bag-num', 'loot-num', 'kill-num', 'raid-timer', 'interact-tip', 'reload-tip',
               'extract-panel', 'extract-fill', 'extract-text', 'hitmarker', 'damage-vignette',
               'killfeed', 'minimap', 'search-panel', 'search-fill', 'search-text', 'weight-num',
               'skill-box', 'skill-name', 'skill-cd'];
    var self = this;
    ids.forEach(function (id) { self.el[id] = document.getElementById(id); });
    this.mmCtx = this.el['minimap'].getContext('2d');
  },

  show: function () { this.el['hud'].classList.remove('hidden'); },
  hide: function () {
    this.el['hud'].classList.add('hidden');
    this.scope(null, 0);
  },

  // ---------- 瞄具视野：kind = scope_red / scope_holo / scope_3x / scope_8x ----------
  // k = 开镜进度 0~1，进度越高遮罩越实、准星越清晰
  scope: function (kind, k) {
    var view = document.getElementById('scope-view');
    if (!view) return;
    var hud = this.el['hud'];
    var rh = document.getElementById('range-hud');
    if (!kind || k < 0.06) {
      if (this._scopeOn) {
        view.classList.add('hidden');
        this._scopeOn = false;
        this._scopeKind = null;
        if (hud) hud.classList.remove('scoped');
        if (rh) rh.classList.remove('scoped');
      }
      return;
    }
    var cls = kind === 'scope_red' ? 'sv-dot' :
              kind === 'scope_holo' ? 'sv-holo' :
              kind === 'scope_8x' ? 'sv-mil8' : 'sv-mil';
    if (this._scopeKind !== cls) {
      view.className = cls;          // 换镜时重置样式类
      view.style.opacity = '0';
      this._scopeKind = cls;
      this._buildReticle(cls);
    }
    if (!this._scopeOn) { view.classList.remove('hidden'); this._scopeOn = true; }
    view.style.opacity = String(Math.min(1, Math.max(0, (k - 0.2) / 0.55)));
    if (hud) hud.classList.toggle('scoped', k > 0.55);
    if (rh) rh.classList.toggle('scoped', k > 0.55);
  },

  // 生成镜内分划（红点 / 全息圈 / 十字密位）
  _buildReticle: function (cls) {
    var r = document.getElementById('sv-reticle');
    if (!r) return;
    if (cls === 'sv-dot') {
      r.innerHTML = '<i class="rt-dot"></i>';
    } else if (cls === 'sv-holo') {
      r.innerHTML = '<i class="rt-holo"></i><i class="rt-dot"></i>';
    } else {
      r.innerHTML = '<i class="rt-h"></i><i class="rt-v"></i><i class="rt-dot"></i>' +
        '<i class="rt-tick rt-t1"></i><i class="rt-tick rt-t2"></i>' +
        '<i class="rt-tick rt-t3"></i><i class="rt-tick rt-t4"></i>';
    }
  },

  update: function (player, timeLeft) {
    var C = GAME.Config;
    var hpPct = Math.round(player.hp / player.maxHp * 100);
    this.el['hp-fill'].style.width = hpPct + '%';
    this.el['hp-num'].textContent = Math.ceil(player.hp) + ' / ' + player.maxHp;

    if (player.slot === 3) {
      this.el['weapon-name'].textContent = '[3] ' + (player.melee ? player.melee.name : '战术匕首');
      this.el['ammo-num'].textContent = '近战';
    } else {
      this.el['weapon-name'].textContent = (player.slot === 2 ? '[2] ' : '[1] ') + player.weapon.name;
      this.el['ammo-num'].textContent = player.ammo + ' / ' + player.weapon.mag;
    }
    this.el['melee-name'].textContent = player.melee ? player.melee.name : '战术匕首';
    this.el['armor-num'].textContent = player.armor ? ('减伤 ' + Math.round(player.armor.reduce * 100) + '%') : '无护甲';
    this.el['med-num'].textContent = player.meds;
    var wEl = this.el['weight-num'];
    wEl.textContent = player.weight.toFixed(1) + ' / ' + player.weightOver + ' kg';
    wEl.className = 'val' + (player.weight > player.weightLimit ? ' over' : '');
    this.el['bag-num'].textContent = player.bagUsed() + ' / ' + player.bagTotal() + ' 格';
    this.el['loot-num'].textContent = '¥ ' + player.lootValue;
    this.el['kill-num'].textContent = player.kills;

    // --- 干员技能条 ---
    var skBox = this.el['skill-box'];
    var skCd = this.el['skill-cd'];
    if (player.operator) {
      this.el['skill-name'].textContent = player.operator.skill.name;
      if (player.skillCd > 0) {
        skCd.textContent = '冷却 ' + player.skillCd.toFixed(1) + 's';
        skBox.classList.remove('ready');
      } else {
        skCd.textContent = '[X] 就绪';
        skBox.classList.add('ready');
      }
    }

    var m = Math.floor(Math.max(0, timeLeft) / 60);
    var s = Math.floor(Math.max(0, timeLeft) % 60);
    this.el['raid-timer'].textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    this.el['raid-timer'].classList.toggle('danger', timeLeft < 60);

    this.el['reload-tip'].classList.toggle('hidden', !player.reloading);
  },

  setInteract: function (visible, text) {
    var tip = this.el['interact-tip'];
    tip.classList.toggle('hidden', !visible);
    if (visible && text) tip.innerHTML = text;
  },

  setExtract: function (progress01, secondsLeft) {
    if (progress01 === null) {
      this.el['extract-panel'].classList.add('hidden');
    } else {
      this.el['extract-panel'].classList.remove('hidden');
      this.el['extract-fill'].style.width = Math.round(progress01 * 100) + '%';
      this.el['extract-text'].textContent = '站稳别动，还需 ' + Math.ceil(secondsLeft) + ' 秒';
    }
  },

  // 搜索容器进度条，progress01 为 null 时隐藏
  setSearch: function (progress01, text) {
    var panel = this.el['search-panel'];
    if (progress01 === null) {
      panel.classList.add('hidden');
    } else {
      panel.classList.remove('hidden');
      this.el['search-fill'].style.width = Math.round(progress01 * 100) + '%';
      if (text) this.el['search-text'].textContent = text;
    }
  },

  hitMarker: function () {
    var el = this.el['hitmarker'];
    el.classList.remove('show');
    void el.offsetWidth; // 强制重排，让动画可重复触发
    el.classList.add('show');
  },

  damageFlash: function () {
    var el = this.el['damage-vignette'];
    el.style.opacity = '1';
    setTimeout(function () { el.style.opacity = '0'; }, 120);
  },

  killFeed: function (text) {
    var div = document.createElement('div');
    div.textContent = text;
    this.el['killfeed'].appendChild(div);
    setTimeout(function () { div.remove(); }, 3200);
  },

  // --- 小地图 ---
  drawMinimap: function (playerPos, playerYaw, enemies, loots, extractPoints, containers) {
    var ctx = this.mmCtx;
    var size = this.el['minimap'].width;
    var half = GAME.Map.half;
    var scale = size / (half * 2);
    var toMap = function (x, z) { return [(x + half) * scale, (z + half) * scale]; };

    ctx.fillStyle = 'rgba(20,40,26,0.9)';
    ctx.fillRect(0, 0, size, size);

    var i, p;
    // 楼宇轮廓（灰色方块）
    ctx.fillStyle = 'rgba(150,160,170,0.22)';
    for (i = 0; i < GAME.Map.buildings.length; i++) {
      var b = GAME.Map.buildings[i];
      p = toMap(b.x - b.w / 2, b.z - b.d / 2);
      ctx.fillRect(p[0], p[1], b.w * scale, b.d * scale);
    }
    // 撤离点
    for (i = 0; i < extractPoints.length; i++) {
      p = toMap(extractPoints[i].pos.x, extractPoints[i].pos.z);
      ctx.fillStyle = '#52e07a';
      ctx.beginPath(); ctx.arc(p[0], p[1], 6, 0, Math.PI * 2); ctx.fill();
    }
    // 未搜刮容器：橙色小方块
    ctx.fillStyle = '#ffa04a';
    for (i = 0; i < containers.length; i++) {
      if (containers[i].contents.length === 0) continue;
      p = toMap(containers[i].pos.x, containers[i].pos.z);
      ctx.fillRect(p[0] - 3, p[1] - 3, 6, 6);
    }
    // 地面物资：按稀有度着色
    for (i = 0; i < loots.length; i++) {
      if (loots[i].taken) continue;
      p = toMap(loots[i].mesh.position.x, loots[i].mesh.position.z);
      ctx.fillStyle = GAME.Items.color(GAME.Items.get(loots[i].itemId));
      ctx.fillRect(p[0] - 2, p[1] - 2, 4, 4);
    }
    // 敌人：默认只显示 30 米内的（侦察规则）；被标记/干扰的全程显示
    for (i = 0; i < enemies.length; i++) {
      var en = enemies[i];
      if (!en.alive) continue;
      var near = GAME.Utils.dist2D(playerPos, en.pos) < 30;
      var tracked = en.marked > 0 || en.jam > 0;
      if (!near && !tracked) continue;
      p = toMap(en.pos.x, en.pos.z);
      ctx.fillStyle = en.jam > 0 ? '#d06bff' : '#ff5252';
      ctx.beginPath(); ctx.arc(p[0], p[1], 3.5, 0, Math.PI * 2); ctx.fill();
      if (en.marked > 0) { // 被标记：外圈橙色描边
        ctx.strokeStyle = '#ffa64a';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p[0], p[1], 6.5, 0, Math.PI * 2); ctx.stroke();
      }
    }
    // 玩家朝向
    p = toMap(playerPos.x, playerPos.z);
    ctx.save();
    ctx.translate(p[0], p[1]);
    ctx.rotate(-playerYaw);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
};
