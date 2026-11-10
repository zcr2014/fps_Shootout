// ===== 干员库：参考《三角洲行动》官方干员资料，每位干员有战术装备（X）与专属特性 =====
// passive 字段含义（Player 会读取）：
//   runMul     奔跑速度倍率
//   speedMul   行走/奔跑通用速度倍率
//   crouchMul  蹲行速度系数（越小越快）
//   adsPenalty 开镜时的移速惩罚系数（越小开镜移动越快）
//   hpBonus    生命上限加成
//   limitBonus 负重上限加成（kg）
//   slowMul    超重减速倍率（<1 表示超重惩罚更轻）
//   medMul     急救包治疗量倍率
//   dmgMul     受到伤害倍率（<1 表示减伤）
//   lunaMark   露娜命中敌人后的标记秒数
window.GAME = window.GAME || {};

GAME.Operators = {
  list: [
    {
      id: 'redwolf', name: '红狼', en: 'D-WOLF', role: '突击', color: '#d3452f',
      desc: '凯·席尔瓦。依靠动力外骨骼的高机动性打游击，冲锋与转点就是他的答案。',
      skill: {
        name: '动力外骨骼',
        desc: '8 秒内冲刺速度 +30%、射速 +20%；击倒敌人回复 20% 生命并延长 2 秒。',
        cd: 24
      },
      passive: { desc: '突击兵：举镜瞄准时移动速度更快', adsPenalty: 0.18 }
    },
    {
      id: 'stinger', name: '蜂医', en: 'STINGER', role: '支援', color: '#3fa34d',
      desc: '罗伊·斯米。前线医疗专家，蜂巢科技让他在火力下也能把人从死亡线上拉回来。',
      skill: {
        name: '蜂巢治疗',
        desc: '放出蜂巢治疗无人机跟随 8 秒，每秒回复 7 点生命（共约 56 点）。',
        cd: 20
      },
      passive: { desc: '支援兵：急救包治疗量 +30%', medMul: 1.3 }
    },
    {
      id: 'luna', name: '露娜', en: 'LUNA', role: '侦察', color: '#8f6bd9',
      desc: '金卢娜。冷静的侦察射手，一支箭就能点亮整片区域。',
      skill: {
        name: '侦察箭',
        desc: '射出侦察箭，沿途微型传感器与落点 15 米内的敌人被标记 6 秒。',
        cd: 16
      },
      passive: { desc: '目标分析：命中敌人会标记其 4 秒', lunaMark: 4 }
    },
    {
      id: 'vyron', name: '威龙', en: 'VYRON', role: '机动', color: '#c9802d',
      desc: '以动力辅助装置高速突进、撕开敌方阵型的机动专家。',
      skill: {
        name: '磁吸炸弹',
        desc: '投掷吸附式高爆炸弹，落地 1.6 秒后爆炸，对 6 米内敌人造成 80 点伤害。',
        cd: 18
      },
      passive: { desc: '动力辅助系统：使用战术装备后 4 秒内移动速度 +15%', buff: 4 }
    },
    {
      id: 'shepherd', name: '牧羊人', en: 'SHEPHERD', role: '工程', color: '#2f7dd3',
      desc: '特里·穆萨。用声波控制战场空间，守住每一个咽喉要道。',
      skill: {
        name: '声波瘫痪',
        desc: '释放声波脉冲，14 米内敌人 5 秒内移动减速 50%、射速降低 40%。',
        cd: 20
      },
      passive: { desc: '声波防御：声波相位抵消，受到伤害降低 10%', dmgMul: 0.9 }
    },
    {
      id: 'hackclaw', name: '骇爪', en: 'HACKCLAW', role: '侦察', color: '#b34fb3',
      desc: '电子战专家，敌人的通讯在她眼里如同明文。',
      skill: {
        name: '信号解码器',
        desc: '扫描 40 米内最近的 3 名敌人，标记 10 秒并瘫痪其电子设备 3 秒。',
        cd: 18
      },
      passive: { desc: '静步：行走与蹲行速度更快，蹲行更安静', speedMul: 1.1, crouchMul: 0.62 }
    },
    {
      id: 'uluru', name: '乌鲁鲁', en: 'ULURU', role: '工程', color: '#4a9e8f',
      desc: '重塑战场的工程兵，一枚巡飞弹就能拆掉敌人的整条防线。',
      skill: {
        name: '巡飞弹',
        desc: '发射图像制导巡飞弹，命中后分裂成 4 枚子弹药，覆盖 6 米范围爆炸。',
        cd: 22
      },
      passive: { desc: '战斗硬化：减速效果抗性提升，超重减速减半', slowMul: 0.5 }
    }
  ],

  DEFAULT: 'redwolf',

  get: function (id) {
    for (var i = 0; i < this.list.length; i++) {
      if (this.list[i].id === id) return this.list[i];
    }
    return this.get(this.DEFAULT);
  },

  passiveOf: function (op) {
    return (op && op.passive) || {};
  }
};
