// ===== 输入系统：键盘、鼠标、指针锁定 =====
window.GAME = window.GAME || {};

GAME.Input = {
  keys: {},          // 按键按住状态，如 keys['KeyW'] = true
  mouseDown: false,  // 鼠标左键按住（连发用）
  mouseR: false,     // 鼠标右键按住（开镜用）
  _dx: 0, _dy: 0,    // 本帧鼠标移动量（消费式读取）
  locked: false,     // 指针是否已锁定
  everLocked: false, // 是否成功锁定过（用于区分"按 Esc 退出"与"环境不支持锁定"）
  canvas: null,

  // 按"键"触发的回调表（只触发一次，不连发）
  onPress: {},       // 例：onPress['KeyE'] = function(){...}

  init: function (canvas) {
    var self = this;
    this.canvas = canvas;

    window.addEventListener('keydown', function (e) {
      if (!self.keys[e.code] && self.onPress[e.code]) self.onPress[e.code]();
      self.keys[e.code] = true;
      // 防止空格滚动页面、Tab 切换焦点
      if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    });
    window.addEventListener('keyup', function (e) { self.keys[e.code] = false; });

    window.addEventListener('mousedown', function (e) {
      if (e.button === 0) self.mouseDown = true;
      if (e.button === 2) self.mouseR = true;
    });
    window.addEventListener('mouseup', function (e) {
      if (e.button === 0) self.mouseDown = false;
      if (e.button === 2) self.mouseR = false;
    });
    // 右键用于开镜，屏蔽浏览器右键菜单
    window.addEventListener('contextmenu', function (e) {
      if (self.locked) e.preventDefault();
    });

    // 指针锁定下的视角移动
    document.addEventListener('mousemove', function (e) {
      if (!self.locked) return;
      self._dx += e.movementX;
      self._dy += e.movementY;
    });

    document.addEventListener('pointerlockchange', function () {
      self.locked = (document.pointerLockElement === self.canvas);
      if (self.locked) self.everLocked = true;
      if (self.onLockChange) self.onLockChange(self.locked);
    });

    // 指针锁定失败（如自动化/无头环境）：静默处理，游戏仍可运行
    document.addEventListener('pointerlockerror', function () {
      self.locked = false;
    });
  },

  // 请求锁定指针（必须由用户点击触发）
  lock: function () {
    if (!this.canvas.requestPointerLock) return;
    // 自动化/无头环境（navigator.webdriver）不支持指针锁定，直接跳过
    if (navigator.webdriver) return;
    try {
      var p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(function () { /* 环境不支持时忽略 */ });
    } catch (e) { /* 环境不支持时忽略 */ }
  },
  unlock: function () {
    if (document.exitPointerLock) document.exitPointerLock();
  },

  // 取出本帧鼠标移动量并清零
  consumeDelta: function () {
    var d = { x: this._dx, y: this._dy };
    this._dx = 0; this._dy = 0;
    return d;
  },

  isDown: function (code) { return !!this.keys[code]; }
};
