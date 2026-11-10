// ===== 结算与暂停界面 =====
window.GAME = window.GAME || {};

GAME.Menu = {
  el: {},

  init: function (callbacks) {
    var ids = ['overlay-result', 'result-title', 'result-desc', 'result-stats', 'result-items',
               'btn-back-hub', 'btn-again', 'overlay-pause', 'btn-resume', 'btn-quit', 'result-money'];
    var self = this;
    ids.forEach(function (id) { self.el[id] = document.getElementById(id); });
    this.el['btn-back-hub'].addEventListener('click', callbacks.backHub);
    this.el['btn-again'].addEventListener('click', callbacks.again);
    this.el['btn-resume'].addEventListener('click', callbacks.resume);
    this.el['btn-quit'].addEventListener('click', callbacks.quit);
  },

  hideAll: function () {
    this.el['overlay-result'].classList.add('hidden');
    this.el['overlay-pause'].classList.add('hidden');
  },

  showPause: function () {
    this.el['overlay-pause'].classList.remove('hidden');
  },

  hidePause: function () { this.el['overlay-pause'].classList.add('hidden'); },

  // result = { win, reason, mapName, items:[{id,count}], value, kills, lost:[name], overflow, money }
  showResult: function (result) {
    var self = this;
    this.el['overlay-result'].classList.remove('hidden');

    var title, desc;
    if (result.win) {
      title = '撤离成功';
      desc = '带着战利品安全离开了 ' + result.mapName + '，物资已入库。';
    } else if (result.reason === 'timeout') {
      title = '撤离超时';
      desc = '未能在时限内撤离，' + result.mapName + ' 的物资全部遗失。';
    } else if (result.reason === 'quit') {
      title = '行动中止';
      desc = '你主动放弃了行动，本局物资与随身装备均已损失。';
    } else {
      title = '行动阵亡';
      desc = '你倒在了 ' + result.mapName + '，随身装备与背包物资全部损失。';
    }
    this.el['result-title'].textContent = title;
    this.el['result-desc'].textContent = desc;
    this.el['overlay-result'].classList.toggle('lose', !result.win);

    // 统计
    this.el['result-stats'].innerHTML =
      '<div class="stat">击杀<b>' + result.kills + '</b></div>' +
      '<div class="stat">物资价值<b class="gold">¥ ' + result.value + '</b></div>' +
      '<div class="stat">结果<b class="' + (result.win ? 'green' : 'red') + '">' +
        (result.win ? '入库' : '损失') + '</b></div>';

    // 战利品清单
    var html = '';
    if (result.win && result.items.length > 0) {
      html += '<div class="ri-title">带出的战利品</div><div class="ri-grid">';
      result.items.forEach(function (it) {
        var d = GAME.Items.get(it.id);
        html += '<div class="ri-item r' + d.rarity + '">' + d.name +
                (it.count > 1 ? ' ×' + it.count : '') + '</div>';
      });
      html += '</div>';
      if (result.overflow > 0) {
        html += '<div class="ri-warn">仓库已满，' + result.overflow + ' 件物资未能入库</div>';
      }
    } else if (!result.win) {
      // 阵亡/中止：先列保险箱保住的物资，再列丢失的装备
      if (result.items.length) {
        html += '<div class="ri-title keep">保险箱保住的物资</div><div class="ri-grid">';
        result.items.forEach(function (it) {
          var d = GAME.Items.get(it.id);
          html += '<div class="ri-item r' + d.rarity + '">' + d.name +
                  (it.count > 1 ? ' ×' + it.count : '') + '</div>';
        });
        html += '</div>';
      }
      if (result.lost.length) {
        html += '<div class="ri-title red">丢失的装备</div><div class="ri-grid">';
        result.lost.forEach(function (name) {
          html += '<div class="ri-item lost">' + name + '</div>';
        });
        html += '</div>';
      }
      if (result.items.length === 0 && result.lost.length === 0) {
        html += '<div class="ri-empty">这次什么都没带出来</div>';
      }
    } else {
      html += '<div class="ri-empty">背包是空的，下次多带点东西回来</div>';
    }
    this.el['result-items'].innerHTML = html;
    this.el['result-money'].textContent = '¥ ' + result.money;
  }
};
