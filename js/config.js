// ===== 全局配置：通用数值，地图相关参数见 data/maps.js =====
window.GAME = window.GAME || {};

GAME.Config = {
  // 玩家
  PLAYER_HP: 100,
  PLAYER_SPEED: 6,        // 走路速度 m/s
  PLAYER_RUN: 9.5,        // 奔跑速度 m/s
  PLAYER_RADIUS: 0.6,     // 碰撞半径
  EYE_HEIGHT: 1.65,       // 视角高度

  // 背包与搜索（局内背包容量由装备的背包决定，格子按矩形装箱）
  POCKET_COLS: 2,         // 没装备背包时的口袋列数
  POCKET_ROWS: 2,         // 没装备背包时的口袋行数（共 4 格）
  PICKUP_RANGE: 2.6,      // 拾取/搜索距离
  MAX_MEDS: 5,            // 单局最多携带急救包数量
  SEARCH_TIME: 1.4,       // 搜完一个容器需要按住 F 的秒数

  // 负重（三角洲式：背包+装备总重量，超重后移动速度下降）
  WEIGHT_LIMIT: 20,       // 负重上限（kg），不超重正常移动
  WEIGHT_OVER: 30,        // 超重上限（kg），超过此值无法再拾取（硬限）
  WEIGHT_SLOW: 0.45,      // 超重时移动速度倍率

  // 局外
  GRID_COLS: 10,          // 仓库网格列数
  GRID_ROWS: 6,           // 仓库网格行数（共 60 格）
  SAFE_COLS: 3,           // 保险箱列数
  SAFE_ROWS: 3,           // 保险箱行数（共 9 格，阵亡不掉）
  START_MONEY: 12000,
  BUY_MARKUP: 1.2,        // 市场买入溢价
  // 变卖分级：按品阶 I~V 给出不同回收倍率（越稀有越值钱）
  SELL_RATES: [0, 0.85, 0.88, 0.92, 0.96, 1.02],
  DEFAULT_WEAPON: 'p92',  // 无武器时免费配发的制式手枪

  // 撤离
  EXTRACT_RADIUS: 4,

  // 颜色
  COLOR: {
    EXTRACT: 0x52e07a,
    ENEMY: 0xc0392b,
    PLAYER_TRACER: 0xfff2a8,
    ENEMY_BULLET: 0xff7043
  }
};
