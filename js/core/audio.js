// ===== 音效系统：用 WebAudio 现场合成，无需任何音频文件 =====
window.GAME = window.GAME || {};

GAME.Audio = {
  ctx: null,

  // 浏览器要求用户交互后才能创建 AudioContext，所以懒初始化
  ensure: function () {
    if (!this.ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return !!this.ctx;
  },

  // --- 基础积木 ---
  // 播放一段噪声（模拟枪声/爆炸）
  _noise: function (duration, volume, filterFreq) {
    if (!this.ensure()) return;
    var ctx = this.ctx;
    var size = ctx.sampleRate * duration;
    var buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    var src = ctx.createBufferSource(); src.buffer = buffer;
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = filterFreq;
    var gain = ctx.createGain(); gain.gain.value = volume;
    src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    src.start();
  },

  // 播放一段正弦音调（模拟提示音）
  _tone: function (freq, duration, volume, type, slideTo) {
    if (!this.ensure()) return;
    var ctx = this.ctx;
    var osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + duration);
  },

  // --- 游戏音效 ---
  shoot: function ()      { this._noise(0.12, 0.35, 1800); },
  shootSupp: function ()  { this._noise(0.05, 0.12, 900); }, // 消音器：更闷更轻
  enemyShoot: function () { this._noise(0.14, 0.18, 900); },
  empty: function ()      { this._tone(1200, 0.05, 0.08, 'square'); },
  reload: function ()     { this._tone(500, 0.08, 0.12, 'square'); this._tone(300, 0.15, 0.1, 'square'); },
  hit: function ()        { this._tone(2200, 0.06, 0.15, 'square', 1500); },
  slash: function ()      { this._noise(0.09, 0.16, 2400); this._tone(1500, 0.07, 0.1, 'sawtooth', 600); },
  kill: function ()       { this._tone(600, 0.25, 0.2, 'sawtooth', 120); },
  hurt: function ()       { this._noise(0.2, 0.3, 500); this._tone(180, 0.25, 0.2, 'sawtooth', 90); },
  pickup: function ()     { this._tone(700, 0.08, 0.15); this._tone(1050, 0.12, 0.15); },
  extractTick: function (){ this._tone(880, 0.07, 0.12); },
  // --- 干员技能音效 ---
  dash: function ()      { this._noise(0.22, 0.28, 2600); this._tone(300, 0.2, 0.1, 'sawtooth', 90); },
  heal: function ()      { this._tone(660, 0.15, 0.12); this._tone(880, 0.15, 0.12); this._tone(1100, 0.2, 0.12); },
  scan: function ()      { this._tone(1250, 0.35, 0.14, 'sine', 420); },
  explosion: function () { this._noise(0.55, 0.5, 420); this._tone(70, 0.5, 0.32, 'sine', 32); },
  jam: function ()       { this._tone(820, 0.3, 0.14, 'sawtooth', 180); this._tone(980, 0.25, 0.1, 'square', 240); },
  jump: function ()      { this._tone(320, 0.10, 0.10, 'sine', 520); this._noise(0.07, 0.1, 1400); },
  land: function ()      { this._noise(0.10, 0.16, 700); this._tone(120, 0.10, 0.12, 'sine', 70); },
  prone: function ()     { this._noise(0.16, 0.12, 600); },
  boxOpen: function ()   { this._tone(140, 0.22, 0.16, 'sawtooth', 85); this._noise(0.12, 0.12, 900); },
  success: function () {
    var self = this;
    [523, 659, 784, 1046].forEach(function (f, i) {
      setTimeout(function () { self._tone(f, 0.25, 0.18); }, i * 130);
    });
  },
  fail: function () { this._tone(300, 0.6, 0.2, 'sawtooth', 80); }
};
