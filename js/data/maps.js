// ===== 地图库：规模 / 敌人强度 / 物资档位 / 建筑与容器数量 =====
window.GAME = window.GAME || {};

GAME.Maps = {
  list: [
    {
      id: 'dam', name: '零号大坝', risk: '低', riskLevel: 1,
      desc: '废弃水利枢纽，视野开阔，适合新手刷装备和熟悉手感。',
      size: 160, obstacles: 34, barrels: 16, wallColor: 0x707570,
      ground: 0x2e4a2f, bg: 0x1a2233, skyTop: 0x3d6390, fogNear: 40, fogFar: 130,
      trees: 24, rocks: 16,
      enemies: 6, enemyHp: 60, enemySpeed: 3.2, enemyDmg: 7, enemyAccuracy: 0.075,
      time: 240, extractPoints: 2, extractTime: 3,
      buildings: 2, containers: 8, groundLoot: 4, lockTier: 'blue',
      lootTable: { canned: 30, copper: 25, medical: 15, medkit: 8, gpu: 6, telescope: 5, armor2: 3, mp5: 2, ak12: 1, key_blue: 2 },
      richTable: { gpu: 22, telescope: 16, gold: 14, harddisk: 10, armor4: 10, medkit: 12, key_purple: 4 }
    },
    {
      id: 'valley', name: '长弓溪谷', risk: '中', riskLevel: 2,
      desc: '山谷林地，掩体密集，敌情复杂，物资品质明显提升。',
      size: 200, obstacles: 46, barrels: 22, wallColor: 0x5d6b58,
      ground: 0x35502f, bg: 0x16201a, skyTop: 0x2f5a44, fogNear: 45, fogFar: 145,
      trees: 40, rocks: 20,
      enemies: 10, enemyHp: 75, enemySpeed: 3.5, enemyDmg: 9, enemyAccuracy: 0.06,
      time: 300, extractPoints: 2, extractTime: 3,
      buildings: 3, containers: 10, groundLoot: 5, lockTier: 'purple',
      lootTable: { copper: 20, medical: 20, gpu: 18, telescope: 14, medkit: 10, armor2: 8, ak12: 6, gold: 4, harddisk: 3, key_purple: 3 },
      richTable: { gpu: 20, telescope: 16, gold: 20, painting: 10, armor4: 12, medkit: 10, key_gold: 4 }
    },
    {
      id: 'spaceport', name: '航天基地', risk: '高', riskLevel: 3,
      desc: '戒备森严的发射场，重兵把守，但高风险对应高回报。',
      size: 240, obstacles: 58, barrels: 28, wallColor: 0x8a8f96,
      ground: 0x3a3f45, bg: 0x0d1420, skyTop: 0x22334f, fogNear: 50, fogFar: 160,
      trees: 10, rocks: 34,
      enemies: 14, enemyHp: 90, enemySpeed: 3.8, enemyDmg: 11, enemyAccuracy: 0.05,
      time: 360, extractPoints: 2, extractTime: 4,
      buildings: 4, containers: 12, groundLoot: 6, lockTier: 'gold',
      lootTable: { gpu: 15, telescope: 12, gold: 18, harddisk: 16, painting: 8, ak12: 12, m700: 6, armor4: 8, medkit: 8, key_gold: 2 },
      richTable: { gpu: 18, telescope: 14, gold: 26, painting: 16, harddisk: 12, m700: 8, key_gold: 5 }
    }
  ],

  DEFAULT: 'dam',

  get: function (id) {
    for (var i = 0; i < this.list.length; i++) {
      if (this.list[i].id === id) return this.list[i];
    }
    return this.list[0];
  }
};
