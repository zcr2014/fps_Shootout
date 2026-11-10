// ===== 物品库：武器 / 护甲 / 药品 / 可出售物资 =====
window.GAME = window.GAME || {};

GAME.Items = {
  defs: {
    // ---- 武器 ----
    p92: {
      id: 'p92', name: 'P92 手枪', cat: 'weapon', slot: 'secondary', rarity: 1, price: 900, w: 3, h: 2, weight: 1.1,
      damage: 26, mag: 15, interval: 0.16, reload: 1.3, range: 85,
      model: 'pistol', color: 0x0b0c0e, adsFov: 62, spread: 0.006, recoil: 0.85,
      desc: '制式手枪，可靠但火力有限'
    },
    mp5: {
      id: 'mp5', name: 'MP5 冲锋枪', cat: 'weapon', slot: 'primary', rarity: 2, price: 2600, w: 5, h: 2, weight: 3.2,
      damage: 22, mag: 30, interval: 0.075, reload: 1.5, range: 95,
      model: 'smg', color: 0x0a0f0a, adsFov: 58, spread: 0.0075, recoil: 0.72,
      desc: '射速极快，近距离压制力强'
    },
    vector: {
      id: 'vector', name: 'Vector 冲锋枪', cat: 'weapon', slot: 'primary', rarity: 3, price: 7200, w: 5, h: 2, weight: 3.4,
      damage: 21, mag: 33, interval: 0.055, reload: 1.6, range: 100,
      model: 'vector', color: 0x101014, adsFov: 58, spread: 0.008, recoil: 0.62,
      desc: '.45 口径全自动冲锋枪，超高射速，近距离爆发力极强'
    },
    ak12: {
      id: 'ak12', name: 'AK-12 突击步枪', cat: 'weapon', slot: 'primary', rarity: 3, price: 5200, w: 5, h: 2, weight: 4.3,
      damage: 36, mag: 30, interval: 0.105, reload: 1.7, range: 130,
      model: 'ak', color: 0x130f09, adsFov: 52, spread: 0.006, recoil: 1.12,
      desc: '全能主力步枪，伤害与射程均衡'
    },
    m4a1: {
      id: 'm4a1', name: 'M4A1 突击步枪', cat: 'weapon', slot: 'primary', rarity: 3, price: 6400, w: 5, h: 2, weight: 4.0,
      damage: 33, mag: 30, interval: 0.092, reload: 1.75, range: 150,
      model: 'ar', color: 0x14161a, adsFov: 50, spread: 0.0055, recoil: 0.95,
      desc: '三角洲干员的主力步枪，后坐力低、改装空间大'
    },
    scarh: {
      id: 'scarh', name: 'SCAR-H 战斗步枪', cat: 'weapon', slot: 'primary', rarity: 4, price: 9800, w: 5, h: 2, weight: 4.9,
      damage: 43, mag: 20, interval: 0.135, reload: 2.0, range: 170,
      model: 'br', color: 0x1a1712, adsFov: 48, spread: 0.005, recoil: 1.32,
      desc: '7.62 口径战斗步枪，单发伤害高，适合中远距离点射'
    },
    m700: {
      id: 'm700', name: 'M700 精确步枪', cat: 'weapon', slot: 'primary', rarity: 4, price: 9800, w: 5, h: 2, weight: 6.5,
      damage: 110, mag: 6, interval: 0.55, reload: 2.2, range: 220,
      model: 'sniper', color: 0x0a0e13, adsFov: 34, spread: 0.0022, recoil: 2.2,
      desc: '一枪一个，但射速慢，考验枪法'
    },
    awm: {
      id: 'awm', name: 'AWM 狙击步枪', cat: 'weapon', slot: 'primary', rarity: 5, price: 26000, w: 6, h: 2, weight: 7.2,
      damage: 145, mag: 5, interval: 0.95, reload: 2.8, range: 300,
      model: 'sniper', color: 0x0c1014, adsFov: 30, spread: 0.0016, recoil: 2.6,
      desc: '.338 口径顶级狙击步枪，精度与射程极高，一发定胜负'
    },

    // ---- 枪械配件（装备到主/副武器的四个改装位，装配后生效）----
    scope_red: {
      id: 'scope_red', name: '红点瞄准镜', cat: 'attach', attach: 'scope', rarity: 2, price: 900, w: 1, h: 1, weight: 0.2,
      adsFov: 60, spreadMul: 0.94, rangeMul: 1.02, desc: '小巧红点，开镜快、视野好，适合近中距离'
    },
    scope_holo: {
      id: 'scope_holo', name: '全息瞄准镜', cat: 'attach', attach: 'scope', rarity: 3, price: 1800, w: 1, h: 1, weight: 0.3,
      adsFov: 56, spreadMul: 0.90, rangeMul: 1.05, desc: '全息准星，瞄准更稳，中距离表现优秀'
    },
    scope_3x: {
      id: 'scope_3x', name: '3 倍战术镜', cat: 'attach', attach: 'scope', rarity: 4, price: 4200, w: 1, h: 1, weight: 0.5,
      adsFov: 44, spreadMul: 0.84, rangeMul: 1.12, desc: '三倍放大，适合中远距离架枪'
    },
    scope_8x: {
      id: 'scope_8x', name: '8 倍狙击镜', cat: 'attach', attach: 'scope', rarity: 5, price: 9800, w: 1, h: 1, weight: 0.7,
      adsFov: 26, spreadMul: 0.72, rangeMul: 1.30, desc: '八倍高倍镜，远距离狙击专用'
    },
    muzzle_comp: {
      id: 'muzzle_comp', name: '钢制补偿器', cat: 'attach', attach: 'muzzle', rarity: 2, price: 700, w: 1, h: 1, weight: 0.2,
      recoilMul: 0.82, spreadMul: 0.96, desc: '压制枪口上跳，连发更稳'
    },
    muzzle_supp: {
      id: 'muzzle_supp', name: '战术消音器', cat: 'attach', attach: 'muzzle', rarity: 3, price: 3000, w: 1, h: 1, weight: 0.4,
      recoilMul: 0.88, spreadMul: 0.90, supp: true, desc: '降低枪声与后坐，适合潜行作战'
    },
    muzzle_brake: {
      id: 'muzzle_brake', name: '膛口制退器', cat: 'attach', attach: 'muzzle', rarity: 4, price: 2600, w: 1, h: 1, weight: 0.3,
      recoilMul: 0.70, spreadMul: 0.93, desc: '大幅降低后坐力，代价是枪口焰更明显'
    },
    grip_vert: {
      id: 'grip_vert', name: 'RK-O 垂直握把', cat: 'attach', attach: 'grip', rarity: 3, price: 1500, w: 1, h: 1, weight: 0.2,
      recoilMul: 0.86, spreadMul: 0.95, desc: '经典垂直前握把，显著改善连续射击稳定性'
    },
    grip_angled: {
      id: 'grip_angled', name: '斜角握把', cat: 'attach', attach: 'grip', rarity: 2, price: 800, w: 1, h: 1, weight: 0.15,
      spreadMul: 0.88, adsMul: 0.96, desc: '斜角造型，开镜更快，腰射散布更小'
    },
    mag_ext: {
      id: 'mag_ext', name: '扩容弹匣', cat: 'attach', attach: 'mag', rarity: 2, price: 900, w: 1, h: 2, weight: 0.3,
      magMul: 1.5, desc: '弹匣容量提升 50%，少一次换弹就多一分胜算'
    },
    mag_quick: {
      id: 'mag_quick', name: '快速弹匣', cat: 'attach', attach: 'mag', rarity: 3, price: 1900, w: 1, h: 2, weight: 0.25,
      reloadMul: 0.75, desc: '优化供弹结构，换弹速度提升 25%'
    },

    // ---- 头部护甲（头盔）----
    helmet2: {
      id: 'helmet2', name: '二级头盔', cat: 'helmet', rarity: 2, price: 900, w: 2, h: 2, weight: 1.4,
      reduce: 0.30, desc: '减免 30% 头部受到的伤害'
    },
    helmet4: {
      id: 'helmet4', name: '四级头盔', cat: 'helmet', rarity: 4, price: 3200, w: 2, h: 2, weight: 2.1,
      reduce: 0.55, desc: '减免 55% 头部受到的伤害'
    },

    // ---- 躯干护甲（防弹衣）----
    armor2: {
      id: 'armor2', name: '二级防弹衣', cat: 'armor', rarity: 2, price: 1600, w: 3, h: 3, weight: 3.5,
      reduce: 0.28, desc: '减免 28% 躯干受到的伤害'
    },
    armor4: {
      id: 'armor4', name: '四级防弹衣', cat: 'armor', rarity: 4, price: 5400, w: 3, h: 3, weight: 6.8,
      reduce: 0.48, desc: '减免 48% 躯干受到的伤害'
    },

    // ---- 背包（决定局内背包格子容量，阵亡会丢失）----
    bag1: {
      id: 'bag1', name: '帆布背包', cat: 'bag', rarity: 1, price: 600, w: 3, h: 2, weight: 0.8,
      gridW: 4, gridH: 3, desc: '简易背包，局内提供 4×3 格背包空间'
    },
    bag2: {
      id: 'bag2', name: '战术背包', cat: 'bag', rarity: 3, price: 2200, w: 3, h: 3, weight: 1.2,
      gridW: 5, gridH: 3, desc: '制式战术背包，局内提供 5×3 格背包空间'
    },
    bag3: {
      id: 'bag3', name: '重型登山包', cat: 'bag', rarity: 4, price: 4800, w: 4, h: 3, weight: 1.8,
      gridW: 5, gridH: 4, desc: '大容量登山包，局内提供 5×4 格背包空间'
    },

    // ---- 近战：默认战术匕首（绑定，永不丢失）与刀皮（纯外观）----
    knife: {
      id: 'knife', name: '战术匕首', cat: 'melee', rarity: 1, price: 0, w: 2, h: 2, weight: 0.4,
      damage: 55, range: 2.4, interval: 0.75, bound: true,
      bladeColor: 0xc7d0d9, gripColor: 0x2a2a2a,
      desc: '制式战术匕首，按 V 挥砍。近战武器阵亡不会丢失，刀皮只改变外观'
    },
    knife_sand: {
      id: 'knife_sand', name: '战术匕首 · 沙暴', cat: 'melee', rarity: 3, price: 1600, w: 2, h: 2, weight: 0.4,
      damage: 55, range: 2.4, interval: 0.75, skinOf: 'knife',
      bladeColor: 0xd9b06a, gripColor: 0x5a4a33,
      desc: '沙暴迷彩刀皮，只改变匕首外观，属性与原版一致'
    },
    knife_night: {
      id: 'knife_night', name: '战术匕首 · 暗夜', cat: 'melee', rarity: 4, price: 3200, w: 2, h: 2, weight: 0.4,
      damage: 55, range: 2.4, interval: 0.75, skinOf: 'knife',
      bladeColor: 0x8fa0c8, gripColor: 0x1b2030,
      desc: '暗夜涂层刀皮，只改变匕首外观，属性与原版一致'
    },
    knife_gold: {
      id: 'knife_gold', name: '战术匕首 · 金龙', cat: 'melee', rarity: 5, price: 8800, w: 2, h: 2, weight: 0.4,
      damage: 55, range: 2.4, interval: 0.75, skinOf: 'knife',
      bladeColor: 0xffd54a, gripColor: 0x2a2113, emissive: 0x4a3200,
      desc: '传说级金龙刀皮，刀身泛金光，属性与原版一致'
    },

    // ---- 房卡（开启对应等级的锁门，按次数消耗）----
    key_blue: {
      id: 'key_blue', name: '蓝色房卡', cat: 'key', rarity: 3, price: 1600, w: 1, h: 1, weight: 0.05,
      keyTier: 'blue', uses: 3, desc: '可开启 3 次蓝色等级锁门，去往二楼受限房间'
    },
    key_purple: {
      id: 'key_purple', name: '紫色房卡', cat: 'key', rarity: 4, price: 3800, w: 1, h: 1, weight: 0.05,
      keyTier: 'purple', uses: 5, desc: '可开启 5 次紫色等级锁门，内含更高级物资'
    },
    key_gold: {
      id: 'key_gold', name: '金色房卡', cat: 'key', rarity: 5, price: 8000, w: 1, h: 1, weight: 0.05,
      keyTier: 'gold', uses: 6, desc: '可开启 6 次金色等级锁门，顶级物资房间'
    },

    // ---- 药品 ----
    medkit: {
      id: 'medkit', name: '急救包', cat: 'med', rarity: 2, price: 500, w: 2, h: 1, weight: 0.8,
      heal: 55, desc: '局内按 H 使用，恢复 55 点生命'
    },

    // ---- 可出售物资（不同稀有度）----
    canned: { id: 'canned', name: '军用罐头', cat: 'valuable', rarity: 1, price: 220, w: 1, h: 1, weight: 0.5, desc: '不值钱，但聊胜于无' },
    copper: { id: 'copper', name: '铜线卷', cat: 'valuable', rarity: 1, price: 320, w: 1, h: 1, weight: 0.7, desc: '常见的工业废料' },
    medical: { id: 'medical', name: '医疗物资', cat: 'valuable', rarity: 2, price: 680, w: 2, h: 1, weight: 1.2, desc: '战区里的硬通货' },
    telescope: { id: 'telescope', name: '军用望远镜', cat: 'valuable', rarity: 3, price: 1200, w: 2, h: 2, weight: 0.9, desc: '侦察兵的标配' },
    gpu: { id: 'gpu', name: '显卡', cat: 'valuable', rarity: 3, price: 1500, w: 2, h: 1, weight: 1.0, desc: '黑市上很抢手' },
    harddisk: { id: 'harddisk', name: '加密硬盘', cat: 'valuable', rarity: 4, price: 2600, w: 2, h: 2, weight: 0.4, desc: '里面不知道存了什么' },
    gold: { id: 'gold', name: '金条', cat: 'valuable', rarity: 4, price: 3200, w: 1, h: 2, weight: 1.2, desc: '沉甸甸的收益' },
    painting: { id: 'painting', name: '名画', cat: 'valuable', rarity: 5, price: 5600, w: 3, h: 2, weight: 1.5, desc: '价值连城，也最扎眼' }
  },

  rarityColors: { 1: '#9aa4ad', 2: '#52e07a', 3: '#4aa8ff', 4: '#b06bff', 5: '#ffd54a' },
  catLabels: { weapon: '武器', melee: '近战', helmet: '头盔', armor: '护甲', bag: '背包', key: '房卡', med: '药品', attach: '配件', valuable: '物资' },
  // 四个枪械改装位
  attachKinds: ['scope', 'muzzle', 'grip', 'mag'],
  attachLabels: { scope: '瞄准镜', muzzle: '枪口', grip: '握把', mag: '弹匣' },
  // 品阶：I~V，稀有度即品阶
  gradeRoman: ['', 'I', 'II', 'III', 'IV', 'V'],
  gradeName: ['', '普通', '稀有', '精良', '史诗', '传说'],

  get: function (id) { return this.defs[id]; },
  color: function (item) { return this.rarityColors[item.rarity] || '#9aa4ad'; },

  // 物品占用格子数（宽 × 高）
  size: function (id) {
    var d = this.defs[id];
    return { w: (d && d.w) || 1, h: (d && d.h) || 1 };
  },

  // 房卡等级
  keyTierName: { blue: '蓝色房卡', purple: '紫色房卡', gold: '金色房卡' },
  keyTier: function (id) {
    var d = this.defs[id];
    return (d && d.keyTier) || null;
  },

  // 装备栏格子定义（尺寸与可放入的类别）
  equipSlots: [
    { kind: 'weapon', label: '主武器', cat: 'weapon', slot: 'primary', w: 5, h: 2 },
    { kind: 'secondary', label: '副武器', cat: 'weapon', slot: 'secondary', w: 3, h: 2 },
    { kind: 'melee',  label: '近战',   cat: 'melee',  w: 2, h: 2 },
    { kind: 'helmet', label: '头盔', cat: 'helmet', w: 2, h: 2 },
    { kind: 'armor',  label: '护甲', cat: 'armor',  w: 3, h: 3 },
    { kind: 'bag',    label: '背包', cat: 'bag',    w: 4, h: 3 }
  ],

  // 市场可购买的物品（物资类只能卖不能买）
  buyable: ['p92', 'mp5', 'vector', 'ak12', 'm4a1', 'scarh', 'm700', 'awm',
            'scope_red', 'scope_holo', 'scope_3x', 'scope_8x',
            'muzzle_comp', 'muzzle_supp', 'muzzle_brake',
            'grip_vert', 'grip_angled', 'mag_ext', 'mag_quick',
            'helmet2', 'helmet4', 'armor2', 'armor4',
            'bag1', 'bag2', 'bag3', 'key_blue', 'key_purple', 'medkit',
            'knife_sand', 'knife_night', 'knife_gold'],

  // 把武器基础属性与配件效果合成一份有效属性（不改动原始定义）
  // attach: { scope: 'scope_red', muzzle: 'muzzle_comp', ... }
  weaponStats: function (def, attach) {
    if (!def) return null;
    var s = {}, k;
    for (k in def) s[k] = def[k];
    s.mag = def.mag;
    s.reload = def.reload;
    s.range = def.range;
    s.spread = def.spread || 0.006;
    s.recoil = def.recoil != null ? def.recoil : 1;   // 每把枪的基础后坐，配件再做乘法
    s.attachIds = {};
    if (attach) {
      for (k in attach) {
        var aid = attach[k];
        if (!aid) continue;
        var a = this.get(aid);
        if (!a || a.cat !== 'attach') continue;
        s.attachIds[k] = aid;
        if (a.adsFov != null) s.adsFov = a.adsFov;
        if (a.spreadMul) s.spread *= a.spreadMul;
        if (a.rangeMul) s.range *= a.rangeMul;
        if (a.recoilMul) s.recoil *= a.recoilMul;
        if (a.reloadMul) s.reload *= a.reloadMul;
        if (a.magMul) s.mag = Math.round(s.mag * a.magMul);
        if (a.magBonus) s.mag += a.magBonus;
        if (a.supp) s.suppressed = true;
        if (a.adsMul) s.adsMul = (s.adsMul || 1) * a.adsMul;
      }
    }
    s.mag = Math.max(1, Math.round(s.mag));
    return s;
  },

  // 按权重随机抽取一件物品
  pickFromTable: function (table) {
    var total = 0, k;
    for (k in table) total += table[k];
    var r = Math.random() * total;
    for (k in table) {
      r -= table[k];
      if (r <= 0) return k;
    }
    return Object.keys(table)[0];
  }
};
