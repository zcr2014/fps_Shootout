// ===== 市场：买入/卖出价格，每日价格小幅波动（按日期确定性计算）=====
window.GAME = window.GAME || {};

GAME.Market = {
  // 同一件物品在同一天价格固定，跨天变化
  _fluct: function (id) {
    var d = new Date();
    var seed = '' + d.getFullYear() + (d.getMonth() + 1) + d.getDate() + id;
    var h = 0;
    for (var i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 1000003;
    return 0.92 + (h % 17) / 100; // 0.92 ~ 1.08
  },

  // 买入价：基础价 × 溢价，取整到 10
  buyPrice: function (id) {
    var item = GAME.Items.get(id);
    return Math.round(item.price * GAME.Config.BUY_MARKUP / 10) * 10;
  },

  // 变卖分级：不同品阶的回收倍率不同，越稀有越接近甚至超过基准价
  sellRate: function (rarity) {
    return GAME.Config.SELL_RATES[rarity] || GAME.Config.SELL_RATES[1];
  },

  // 卖出价：基础价 × 品阶回收倍率 × 当日波动
  sellPrice: function (id) {
    var item = GAME.Items.get(id);
    return Math.round(item.price * this.sellRate(item.rarity) * this._fluct(id) / 10) * 10;
  },

  trend: function (id) { return this._fluct(id) >= 1 ? 'up' : 'down'; },

  // 买入：返回 { ok, msg }
  buy: function (id) {
    var P = GAME.Profile;
    var price = this.buyPrice(id);
    if (P.freeSlots() <= 0) return { ok: false, msg: '仓库已满，先卖掉一些物资' };
    if (!P.add(id, 1)) return { ok: false, msg: '仓库已满' };
    if (P.money() < price) {
      P.remove(id, 1); // 回滚
      return { ok: false, msg: '资金不足，还差 ¥' + (price - P.money()) };
    }
    P.data.money -= price;
    P.save();
    return { ok: true, msg: '购买成功：' + GAME.Items.get(id).name + ' -¥' + price };
  },

  // 卖出 1 件：返回 { ok, msg }
  sell: function (id) {
    var P = GAME.Profile;
    if (P.countGrid(id) <= 0) {
      return { ok: false, msg: P.count(id) > 0 ? '装备栏里的要先卸下才能卖' : '仓库里没有这件物品' };
    }
    var price = this.sellPrice(id);
    P.remove(id, 1);
    P.addMoney(price);
    return { ok: true, msg: '卖出：' + GAME.Items.get(id).name + ' +¥' + price };
  }
};
