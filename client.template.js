window.__ModuleLoader__.load({
  id: 'dsh-zephyr-widget',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useMemo, useRef, useState } = React;

    const STICKERS = __STICKERS__;

    // 注意：这些键刻意保留旧前缀 "dsh.windbreak-widget."，改包名时不跟着改名，
    // 否则老用户（包括本机）的位置/大小/台词设置会被整体重置。
    const POSITION_KEY = 'dsh.windbreak-widget.position';
    const ASLEEP_KEY = 'dsh.windbreak-widget.asleep';
    const NAP_KEY = 'dsh.windbreak-widget.napon';
    const SIZE_KEY = 'dsh.windbreak-widget.size';
    const INTERVAL_KEY = 'dsh.windbreak-widget.interval';
    const AUTO_KEY = 'dsh.windbreak-widget.auto';
    const HUD_KEY = 'dsh.windbreak-widget.hud';
    const SAY_KEY = 'dsh.windbreak-widget.say';
    const SOUND_KEY = 'dsh.windbreak-widget.sound';
    const RING_KEY = 'dsh.windbreak-widget.ring';
    const VERSION = '0.3.37';
    const PULSE_KEY = 'dsh.windbreak-widget.pulse';
    const PULSE_STYLE_KEY = 'dsh.windbreak-widget.pulsestyle';
    const MENU_H_KEY = 'dsh.windbreak-widget.menuh';

    const SIZE_MIN = 88;
    const SIZE_MAX = 220;
    const SIZE_DEFAULT = 140;
    const INTERVAL_MIN = 8;
    const INTERVAL_MAX = 90;
    const INTERVAL_DEFAULT = 30;

    const DEFAULT_INSET = 24;
    const DRAG_THRESHOLD = 4;
    const SAY_MS = 2600;
    const PIN_MS = 8000;
    const DONE_MS = 3600;
    const MENU_WIDTH = 216;
    const MENU_HEIGHT = 440;
    const MENU_MIN_H = 200;
    const MENU_MAX_H = 900;
    // HUD 挂在挂件框下方，拖拽/贴边时要多留出来的高度。
    const HUD_OVERHANG = 18;

    // 点击换表情时随机蹦出来的一句口头禅（群里的梗）。
    const SAYS = [
      '老大是啥子',
      '老大不是啥子',
      '关注防风Zephyr',
      '老大任务完成了',
      '老大，等待你审核',
      '今天吃什么呢？',
      '玉石姐姐',
      '群主不是黑奴',
      '#009E9D是防风代表色哦',
      '川泽生防风，清歌彻远岑',
    ];

    // 星芒射线的几何是固定的，启动时算一次，渲染时只做映射。
    function rayGeometry(count, r1, r2, offsetDeg) {
      const step = 360 / count;
      const out = [];
      for (let i = 0; i < count; i += 1) {
        const a = ((i * step) + offsetDeg) * Math.PI / 180;
        out.push({
          x1: +(50 + Math.cos(a) * r1).toFixed(2),
          y1: +(50 + Math.sin(a) * r1).toFixed(2),
          x2: +(50 + Math.cos(a) * r2).toFixed(2),
          y2: +(50 + Math.sin(a) * r2).toFixed(2),
        });
      }
      return out;
    }

    const SPARK_INNER = rayGeometry(16, 30, 48, 15);
    const SPARK_OUTER = rayGeometry(16, 44, 62, -12);

    function renderRays(rays, width) {
      return rays.map((ray, index) => h('line', {
        key: index,
        x1: ray.x1,
        y1: ray.y1,
        x2: ray.x2,
        y2: ray.y2,
        stroke: 'currentColor',
        strokeWidth: width,
        strokeLinecap: 'round',
      }));
    }

    // 点击光环的预设色。
    const PULSE_COLORS = [
      ['#ffd166', '黄色'],
      ['#7fd8c9', '青绿'],
      ['#ff8fb1', '粉色'],
      ['#ffffff', '白色'],
    ];
    const PULSE_STYLES = [
      ['ring', '圆环'],
      ['spark', '星芒'],
    ];

    // Usage HUD: the host half serves this route; when it is missing (a host
    // without a web server, or the Electron shell) the HUD simply stays empty.
    const USAGE_ROUTE = '/zephyr/usage.json';
    const USAGE_REFRESH_MS = 60000;

    // 点击/随机轮换的候选池：love 是默认站立脸，留在池外；calm 补进来。
    const REACTIONS = ['happy', 'wow', 'greet', 'calm', 'cry', 'smug', 'sleepy', 'ask', 'sweat', 'tea', 'ok'];
    // 默认站着的那张：比心。轮换/情感池里就不重复抽它了。
    const FALLBACK = 'love';

    // Session state picks the face while the agent is doing something; the
    // manual/idle pool only plays when the session is quiet.
    const MOOD_FACE = { busy: 'sweat', waiting: 'ask', done: 'ok' };
    const MOOD_LABEL = {
      idle: '防风',
      busy: '防风 · 干活中',
      waiting: '防风 · 等你确认',
      done: '防风 · 搞定',
    };

    /** 每张贴纸自己的名字，竖排显示在角色左侧（按实际画面重新识别）。 */
    const FACE_NAME = {
      calm: '盯着你',
      happy: '开心',
      wow: '吃惊',
      greet: '招呼',
      love: '比心',
      cry: '恰喽',
      smug: '得意',
      sleepy: '无语',
      ask: '疑惑',
      sweat: '紧张',
      tea: '干杯',
      ok: '收到',
    };

    const STYLES = `
.dshwb-widget {
  position: fixed;
  pointer-events: auto;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  z-index: 2;
  outline: none;
  transform-origin: 50% 100%;
  transition: transform 200ms ease, opacity 220ms ease;
}
.dshwb-widget[data-dragging="true"] {
  cursor: grabbing;
  transition: none;
}
.dshwb-widget:hover,
.dshwb-widget:focus-visible {
  transform: scale(1.04);
}
.dshwb-widget[data-asleep="true"] {
  transform: scale(0.94);
  opacity: 0.88;
}
.dshwb-widget[data-dragging="true"] .dshwb-float,
.dshwb-widget[data-asleep="true"] .dshwb-float {
  animation-play-state: paused;
}
.dshwb-float {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  animation: dshwb-float 4.6s ease-in-out infinite;
  transform-origin: 50% 100%;
}
.dshwb-widget[data-mood="busy"] .dshwb-float {
  animation-duration: 2.1s;
}
@keyframes dshwb-float {
  0%, 100% { transform: translateY(0) rotate(-1.2deg); }
  50% { transform: translateY(-5px) rotate(1.2deg); }
}
.dshwb-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  -webkit-user-drag: none;
  user-select: none;
  filter: drop-shadow(0 8px 12px rgba(12, 24, 38, 0.28));
  transform-origin: 50% 100%;
  transition: filter 220ms ease;
}
.dshwb-widget[data-mood="waiting"] .dshwb-img {
  filter: drop-shadow(0 8px 12px rgba(12, 24, 38, 0.28)) drop-shadow(0 0 12px rgba(255, 209, 102, 0.55));
}
.dshwb-img[data-pop="true"] {
  animation: dshwb-pop 360ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes dshwb-pop {
  0% { transform: scale(0.92) translateY(2px); }
  45% { transform: scale(1.07) translateY(-6px); }
  100% { transform: scale(1) translateY(0); }
}
.dshwb-widget[data-mood="waiting"]::before {
  content: '!';
  position: absolute;
  top: -2px;
  left: 8px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #ffd166;
  color: #3d2c00;
  font: 700 14px/1 -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  box-shadow: 0 2px 8px rgba(40, 30, 0, 0.28);
  animation: dshwb-bob 1.4s ease-in-out infinite;
  pointer-events: none;
}
@keyframes dshwb-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
/* 等待确认时的黄色光圈：包住整个挂件的一圈呼吸光，可在菜单里关掉。 */
.dshwb-wait {
  position: absolute;
  inset: -9px;
  border-radius: 50%;
  border: 2px solid rgba(255, 209, 102, 0.9);
  box-shadow:
    0 0 0 7px rgba(255, 209, 102, 0.16),
    0 0 26px rgba(255, 190, 60, 0.55),
    inset 0 0 22px rgba(255, 190, 60, 0.22);
  pointer-events: none;
  animation: dshwb-ring 2.2s ease-in-out infinite;
}

/* 宿主会给可交互元素加伪元素装饰（点下去出现的四角方向箭头就是这种），
   挂件不需要，全部关掉。 */
.dshwb-widget::before,
.dshwb-widget::after {
  content: none !important;
  display: none !important;
}
@keyframes dshwb-ring {
  0%, 100% { opacity: 0.55; transform: scale(0.985); }
  50% { opacity: 1; transform: scale(1.035); }
}
/* 点击换表情时的反馈特效：颜色由 --dshwb-pulse 控制，样式看 data-style。 */
/* 挂件是 role=button，点击后宿主会给它画焦点框（青绿圆角方框），
   看起来像光圈变方了。这里统一清掉，光环只由 .dshwb-pulse 负责。 */
.dshwb-widget:focus,
.dshwb-widget:focus-visible,
.dshwb-widget:focus-within,
.dshwb-widget:active {
  outline: none !important;
  box-shadow: none !important;
}

.dshwb-pulse {
  position: absolute;
  inset: -12px;
  border-radius: 50%;
  pointer-events: none;
  overflow: visible;
  z-index: -1;
  --c: var(--dshwb-pulse, #ffd166);
}

/* 圆环：一圈实线向外扩 */
.dshwb-pulse[data-style="ring"] {
  color: var(--c);
  animation: dshwb-pulse-ring 700ms cubic-bezier(0.16, 0.84, 0.44, 1) forwards;
}
@keyframes dshwb-pulse-ring {
  0% { opacity: 0; transform: scale(0.88); }
  16% { opacity: 1; }
  66% { opacity: 1; }
  100% { opacity: 0; transform: scale(1.4); }
}

/* 星芒：内外两层射线，一层顺时针、一层逆时针（SVG 画线，形状与设计稿一致） */
.dshwb-pulse[data-style="spark"] {
  color: var(--c);
  animation: dshwb-spark-fade 780ms cubic-bezier(0.16, 0.84, 0.44, 1) forwards;
}
.dshwb-pulse[data-style="spark"] g {
  transform-box: fill-box;
  transform-origin: center;
}
.dshwb-pulse[data-style="spark"] .dshwb-spark-in {
  animation: dshwb-spark-rotate-in 640ms cubic-bezier(0.16, 0.84, 0.44, 1) forwards;
}
.dshwb-pulse[data-style="spark"] .dshwb-spark-out {
  opacity: 0.4;
  animation: dshwb-spark-rotate-out 900ms cubic-bezier(0.16, 0.84, 0.44, 1) forwards;
}
@keyframes dshwb-spark-fade {
  0% { opacity: 1; }
  62% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes dshwb-spark-rotate-in {
  from { transform: rotate(0deg); }
  to { transform: rotate(34deg); }
}
@keyframes dshwb-spark-rotate-out {
  from { transform: rotate(0deg); }
  to { transform: rotate(-20deg); }
}

.dshwb-hud {
  position: absolute;
  z-index: 4;
  left: 50%;
  bottom: -16px;
  transform: translateX(-50%);
  max-width: calc(100% - 8px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  padding: 3px 9px;
  border-radius: 10px;
  background: rgba(18, 30, 42, 0.76);
  border: 1px solid rgba(127, 216, 201, 0.22);
  color: #cdeee7;
  font: 500 10px/1.35 -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  letter-spacing: 0.02em;
  white-space: nowrap;
  pointer-events: auto;
  cursor: help;
  backdrop-filter: blur(6px);
  transition: opacity 200ms ease;
}
.dshwb-hud[data-peak="true"] {
  border-color: rgba(255, 176, 96, 0.55);
  color: #ffe0b8;
}
.dshwb-hud-spend {
  font-size: 10.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.dshwb-hud-peak {
  color: #ffbc74;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.dshwb-hud-valley {
  color: #7fd8c9;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.dshwb-name {
  position: absolute;
  z-index: 4;
  right: 100%;
  top: 50%;
  transform: translate(-2px, -50%);
  writing-mode: vertical-rl;
  text-orientation: upright;
  padding: 9px 3px;
  border-radius: 9px;
  background: rgba(20, 34, 48, 0.72);
  color: #d9f4ef;
  font: 500 10px/1.3 -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  letter-spacing: 0.22em;
  white-space: nowrap;
  opacity: 0.88;
  pointer-events: none;
  transition: opacity 160ms ease, background 160ms ease;
  backdrop-filter: blur(6px);
}
.dshwb-widget:hover .dshwb-name,
.dshwb-widget:focus-visible .dshwb-name {
  opacity: 1;
  background: rgba(20, 34, 48, 0.9);
}
.dshwb-say {
  position: absolute;
  left: 50%;
  bottom: 100%;
  transform: translateX(-50%);
  margin-bottom: 8px;
  max-width: 280px;
  padding: 5px 10px;
  box-sizing: border-box;
  border-radius: 11px;
  border: 1px solid rgba(127, 216, 201, 0.4);
  background: rgba(20, 34, 48, 0.94);
  color: #e8f8f4;
  font: 500 11px/1.5 -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  text-align: center;
  white-space: nowrap;
  pointer-events: none;
  z-index: 6;
  box-shadow: 0 6px 18px rgba(8, 16, 24, 0.32);
  animation: dshwb-say-in 180ms ease-out;
}
@keyframes dshwb-say-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.dshwb-gear {
  position: absolute;
  z-index: 5;
  right: 2px;
  top: 2px;
  width: 22px;
  height: 22px;
  padding: 0;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  border: 1px solid rgba(210, 235, 230, 0.28);
  border-radius: 50%;
  background: rgba(18, 30, 42, 0.72);
  color: #cdeee7;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 140ms ease, background 140ms ease, transform 140ms ease;
  backdrop-filter: blur(6px);
}
.dshwb-widget:hover .dshwb-gear,
.dshwb-gear:focus-visible,
.dshwb-gear[data-open="true"] {
  opacity: 1;
}
.dshwb-gear:hover {
  background: rgba(30, 48, 62, 0.92);
  transform: scale(1.06);
}
.dshwb-gear:focus-visible {
  outline: 2px solid #7fd8c9;
  outline-offset: 1px;
}

.dshwb-menu {
  position: fixed;
  z-index: 6;
  box-sizing: border-box;
  padding: 12px 14px 10px;
  border-radius: 14px;
  background: rgba(18, 26, 34, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.09);
  box-shadow: 0 18px 40px rgba(8, 14, 22, 0.4);
  color: #dfe9ec;
  font: 400 12px/1.6 -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  backdrop-filter: blur(10px);
  max-height: calc(100vh - 24px);
  min-height: 200px;
  overflow-y: auto;
  overscroll-behavior: contain;
  resize: vertical;
  scrollbar-width: thin;
  scrollbar-color: rgba(127, 216, 201, 0.38) transparent;
  animation: dshwb-menu-in 140ms ease-out;
}
.dshwb-menu::-webkit-scrollbar {
  width: 6px;
}
.dshwb-menu::-webkit-scrollbar-track {
  background: transparent;
}
.dshwb-menu::-webkit-scrollbar-thumb {
  border-radius: 3px;
  background: rgba(127, 216, 201, 0.38);
}
.dshwb-menu::-webkit-scrollbar-thumb:hover {
  background: rgba(127, 216, 201, 0.6);
}
@keyframes dshwb-menu-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.dshwb-menu-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 0 0 8px;
  color: #8fa3ad;
  font-size: 11px;
  letter-spacing: 0.08em;
}
.dshwb-ver {
  margin-left: 8px;
  font-size: 9.5px;
  font-weight: 500;
  color: rgba(127, 216, 201, 0.65);
  letter-spacing: 0.04em;
}
.dshwb-row {
  margin-bottom: 10px;
}
.dshwb-row-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  color: #b9c8cf;
  margin-bottom: 2px;
}
.dshwb-row-value {
  color: #3ec8b4;
  font-variant-numeric: tabular-nums;
}
.dshwb-menu input[type="range"] {
  width: 100%;
  height: 18px;
  margin: 0;
  accent-color: #3ec8b4;
  cursor: pointer;
}
.dshwb-check {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 6px;
  color: #b9c8cf;
  cursor: pointer;
}
.dshwb-check input {
  accent-color: #3ec8b4;
  margin: 0;
  cursor: pointer;
}
.dshwb-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 2px 0 6px;
  color: #b9c8cf;
}
.dshwb-select {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 128px;
  padding: 3px 6px;
  box-sizing: border-box;
  border-radius: 7px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: #cdeee7;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.dshwb-select:focus-visible {
  outline: 2px solid #3ec8b4;
  outline-offset: 1px;
}
.dshwb-select option {
  background: #121a22;
  color: #dfe9ec;
}
.dshwb-menu-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.dshwb-btn {
  flex: 1;
  padding: 5px 8px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: #cfdde2;
  font: inherit;
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease;
}
.dshwb-btn:hover {
  background: rgba(62, 200, 180, 0.18);
  border-color: rgba(62, 200, 180, 0.5);
}
.dshwb-btn-reset {
  display: block;
  width: 100%;
  margin-top: 8px;
  color: #ffc2b4;
  border-color: rgba(255, 146, 120, 0.32);
  background: rgba(255, 146, 120, 0.08);
}
.dshwb-btn-reset:hover {
  background: rgba(255, 146, 120, 0.2);
  border-color: rgba(255, 146, 120, 0.6);
}
.dshwb-hint {
  margin-top: 8px;
  color: #6f838d;
  font-size: 10.5px;
  line-height: 1.5;
}
`;

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), Math.max(min, max));
    }

    /** 金额：小额保留两位，大额保留一位，避免 HUD 被长数字撑开。 */
    function formatMoney(value) {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) return '';
      if (n >= 1000) return String(Math.round(n));
      if (n >= 100) return n.toFixed(1);
      return n.toFixed(2);
    }

    /** 倒计时：>=1 小时用 "2h03"，否则 "47m"。 */
    /** 剩余时间统一成 "HH:MM"：9 小时 12 分 -> "09:12"，47 分 -> "00:47"。 */
    function formatCountdown(ms) {
      const total = Math.max(0, Math.floor(Number(ms) / 1000));
      const hours = Math.floor(total / 3600);
      const minutes = Math.floor((total % 3600) / 60);
      const pad = (n) => (n < 10 ? '0' + n : String(n));
      return pad(hours) + ':' + pad(minutes);
    }

    /** 绝对时刻："今天 09:00" / "明天 09:00" / "12月1日 09:00"（浏览器本地时区）。 */
    function formatWhen(ms) {
      const when = new Date(Number(ms));
      if (!Number.isFinite(when.getTime())) return '';
      const now = new Date();
      const pad = (n) => (n < 10 ? '0' + n : String(n));
      const clock = pad(when.getHours()) + ':' + pad(when.getMinutes());
      const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const days = Math.round((dayStart(when) - dayStart(now)) / 86400000);
      if (days === 0) return '今天 ' + clock;
      if (days === 1) return '明天 ' + clock;
      return (when.getMonth() + 1) + '月' + when.getDate() + '日 ' + clock;
    }

    function readNumber(key, fallback, min, max) {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw === null) return fallback;
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) return fallback;
        return clamp(parsed, min, max);
      } catch (error) {
        return fallback;
      }
    }

    function writeValue(key, value) {
      try {
        window.localStorage.setItem(key, String(value));
      } catch (error) {
        /* Private-mode storage failures only lose this preference. */
      }
    }

    function clearValue(key) {
      try {
        window.localStorage.removeItem(key);
      } catch (error) {
        /* Nothing to lose: the default applies when the key is absent. */
      }
    }

    function readFlag(key, fallback) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw === null ? fallback : raw === '1';
      } catch (error) {
        return fallback;
      }
    }

    function readText(key, fallback) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw === null ? fallback : raw;
      } catch (error) {
        return fallback;
      }
    }

    // A tiny synthesized "pop" for manual clicks: no asset file, no network,
    // and the context is created lazily inside the click gesture so browsers
    // never block it as autoplay.
    let popContext = null;

    function playPop() {
      try {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return;
        if (!popContext) popContext = new Ctor();
        if (popContext.state === 'suspended') popContext.resume();
        const at = popContext.currentTime;
        const osc = popContext.createOscillator();
        const gain = popContext.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(760, at);
        osc.frequency.exponentialRampToValueAtTime(1240, at + 0.07);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.09, at + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
        osc.connect(gain);
        gain.connect(popContext.destination);
        osc.start(at);
        osc.stop(at + 0.18);
      } catch (error) {
        /* No audio output (or a denied context) just means a silent click. */
      }
    }

    function readPosition() {
      try {
        const raw = window.localStorage.getItem(POSITION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
          return { x: parsed.x, y: parsed.y };
        }
      } catch (error) {
        /* A malformed or unavailable saved position just falls back to the corner. */
      }
      return null;
    }

    function writePosition(position) {
      try {
        if (position) {
          window.localStorage.setItem(POSITION_KEY, JSON.stringify(position));
        } else {
          window.localStorage.removeItem(POSITION_KEY);
        }
      } catch (error) {
        /* Ignored: the widget simply keeps its current spot. */
      }
    }

    function pickReaction(previous) {
      const pool = REACTIONS.filter((key) => key !== previous && STICKERS[key]);
      if (pool.length === 0) return FALLBACK;
      return pool[Math.floor(Math.random() * pool.length)];
    }

    /**
     * Map the shared session status onto a widget mood. The slot hands entries
     * the same hooks the shipped UI uses: `useSessions` (session rows) and
     * `useSessionStatus` (a Map of { running, pendingInteraction, completionUnread }).
     * Both are optional here, so a host that stops providing them only loses the
     * mood coupling instead of breaking the widget.
     */
    function noHook() {
      return undefined;
    }

    function useSessionMood(props) {
      // Resolve the hooks once per render but always call them in the same order,
      // so a host that omits one never changes this component's hook sequence.
      const useSessionsHook = (props && props.useSessions) || noHook;
      const useSessionStatusHook = (props && props.useSessionStatus) || noHook;

      const sessionId = useSessionsHook((state) => {
        const rows = state && state.byId ? Object.values(state.byId) : [];
        for (const row of rows) {
          if (row && row.retainedBy && row.retainedBy.mainView > 0) return row.id;
        }
        return undefined;
      });

      const status = useSessionStatusHook((snapshot) => (sessionId === undefined || !snapshot
        ? undefined
        : snapshot.get(sessionId)));

      const running = Boolean(status && status.running === true);
      const waiting = Boolean(status && status.pendingInteraction != null);

      const [justFinished, setJustFinished] = useState(false);
      const previousRunning = useRef(running);

      useEffect(() => {
        const was = previousRunning.current;
        previousRunning.current = running;
        if (running) {
          setJustFinished(false);
          return undefined;
        }
        if (!was) return undefined;
        setJustFinished(true);
        const timer = window.setTimeout(() => setJustFinished(false), DONE_MS);
        return () => window.clearTimeout(timer);
      }, [running]);

      if (waiting) return 'waiting';
      if (running) return 'busy';
      if (justFinished) return 'done';
      return 'idle';
    }

    function Slider({ label, value, min, max, step, unit, onChange }) {
      return h('div', { className: 'dshwb-row' },
        h('div', { className: 'dshwb-row-head' },
          h('span', null, label),
          h('span', { className: 'dshwb-row-value' }, `${value}${unit}`),
        ),
        h('input', {
          type: 'range',
          min,
          max,
          step,
          value,
          'aria-label': label,
          onChange: (event) => onChange(Number(event.target.value)),
        }),
      );
    }

    function Widget(props) {
      const mood = useSessionMood(props);
      const idle = mood === 'idle';

      const [size, setSize] = useState(() => readNumber(SIZE_KEY, SIZE_DEFAULT, SIZE_MIN, SIZE_MAX));
      const [intervalSec, setIntervalSec] = useState(() => readNumber(INTERVAL_KEY, INTERVAL_DEFAULT, INTERVAL_MIN, INTERVAL_MAX));
      const [auto, setAuto] = useState(() => readFlag(AUTO_KEY, true));
      const [position, setPosition] = useState(readPosition);
      const [dragging, setDragging] = useState(false);
      const [asleep, setAsleep] = useState(() => readFlag(ASLEEP_KEY, false));
      const [napOn, setNapOn] = useState(() => readFlag(NAP_KEY, true));
      const [manualFace, setManualFace] = useState(FALLBACK);
      const [say, setSay] = useState('');
      const [fixedSay, setFixedSay] = useState(() => {
        const saved = readText(SAY_KEY, '');
        return SAYS.indexOf(saved) >= 0 ? saved : '';
      });
      const [sound, setSound] = useState(() => readFlag(SOUND_KEY, true));
      const [ring, setRing] = useState(() => readFlag(RING_KEY, true));
      const [pulseColor, setPulseColor] = useState(() => readText(PULSE_KEY, '#ffd166'));
      const [pulseStyle, setPulseStyle] = useState(() => readText(PULSE_STYLE_KEY, 'ring'));
      const [pulseSeq, setPulseSeq] = useState(0);
      const [pop, setPop] = useState(false);
      const [menu, setMenu] = useState(null);
      const [menuHeight, setMenuHeight] = useState(() => readNumber(MENU_H_KEY, 0, 0, MENU_MAX_H));
      const [usage, setUsage] = useState(null);
      const [showHud, setShowHud] = useState(() => readFlag(HUD_KEY, true));
      const [nowMs, setNowMs] = useState(() => Date.now());
      const [pinnedUntil, setPinnedUntil] = useState(0);

      const dragRef = useRef(null);
      const sayTimerRef = useRef(0);
      const lastSayRef = useRef('');
      const widgetRef = useRef(null);
      const menuRef = useRef(null);
      const flipRef = useRef(0);
      const sizeRef = useRef(size);
      sizeRef.current = size;

      // A manual pick wins over the session mood for PIN_MS, so poking the
      // widget while the agent is busy still shows the face you chose; after
      // that the status face comes back.
      const pinned = pinnedUntil > nowMs;

      const face = useMemo(() => {
        if (asleep && STICKERS.sleepy) return 'sleepy';
        const fromMood = MOOD_FACE[mood];
        if (!pinned && fromMood && STICKERS[fromMood]) return fromMood;
        return STICKERS[manualFace] ? manualFace : FALLBACK;
      }, [mood, asleep, manualFace, pinned]);

      useEffect(() => {
        setPop(true);
        const timer = window.setTimeout(() => setPop(false), 380);
        return () => window.clearTimeout(timer);
      }, [face]);

      const react = useCallback(() => {
        if (asleep) return;
        // The picked face stays until the next poke: no timed snap back to calm,
        // and it also outranks the busy/waiting/done face for a short while.
        setManualFace((current) => pickReaction(current));
        setPinnedUntil(Date.now() + PIN_MS);
        // 换表情一律配一圈光环：手动点击、定时自动换都一样
        if (pulseColor !== 'off') setPulseSeq((n) => n + 1);
      }, [asleep, pulseColor]);

      const speak = useCallback(() => {
        window.clearTimeout(sayTimerRef.current);
        let line = fixedSay;
        if (!line) {
          const pool = SAYS.filter((item) => item !== lastSayRef.current);
          line = pool[Math.floor(Math.random() * pool.length)] || SAYS[0];
        }
        lastSayRef.current = line;
        setSay(line);
        sayTimerRef.current = window.setTimeout(() => setSay(''), SAY_MS);
      }, [fixedSay]);

      /** 点一下：换表情 + 说一句 + 一声轻响（忙碌时也能逗）。 */
      const poke = useCallback(() => {
        if (asleep) return;
        react();
        speak();
        if (sound) playPop();
      }, [asleep, react, speak, sound]);

      // Occasional self-absorbed idle reaction so the widget never feels frozen.
      useEffect(() => {
        if (!idle || asleep || !auto) return undefined;
        let cancelled = false;
        let handle = 0;
        const schedule = () => {
          const base = intervalSec * 1000;
          const delay = base * (0.75 + Math.random() * 0.5);
          handle = window.setTimeout(() => {
            if (cancelled) return;
            if (Math.random() < 0.65) react();
            schedule();
          }, delay);
        };
        schedule();
        return () => {
          cancelled = true;
          window.clearTimeout(handle);
        };
      }, [idle, asleep, auto, intervalSec, react]);

      useEffect(() => () => window.clearTimeout(sayTimerRef.current), []);

      // Usage HUD: ask the host half for balance / spend / peak state. Without a
      // web server (or inside the Electron shell) the fetch just fails and the
      // HUD stays hidden instead of showing a fake zero.
      const loadUsage = useCallback(() => {
        try {
          fetch(USAGE_ROUTE, { headers: { accept: 'application/json' }, cache: 'no-store' })
            .then((res) => (res && res.ok ? res.json() : null))
            .then((json) => { if (json && json.ok) setUsage(json); })
            .catch(() => {});
        } catch (error) {
          /* fetch 不可用：保持静默 */
        }
      }, []);

      useEffect(() => {
        if (!showHud) return undefined;
        loadUsage();
        const handle = window.setInterval(loadUsage, USAGE_REFRESH_MS);
        return () => window.clearInterval(handle);
      }, [showHud, loadUsage]);

      // One-second clock for the countdown; when it crosses the next switch we
      // re-ask the host once so "峰/谷" flips on time instead of up to a minute late.
      useEffect(() => {
        if (!usage) return undefined;
        const handle = window.setInterval(() => {
          setNowMs(Date.now());
          const nextAt = Number(usage.peak && usage.peak.nextChangeAt) * 1000;
          if (!Number.isFinite(nextAt) || nextAt <= 0) return;
          if (Date.now() < nextAt) return;
          if (flipRef.current === nextAt) return;
          flipRef.current = nextAt;
          loadUsage();
        }, 1000);
        return () => window.clearInterval(handle);
      }, [usage, loadUsage]);

      // Keep the saved spot inside the viewport as the widget or window resizes.
      useEffect(() => {
        function keepInView() {
          setPosition((current) => {
            if (!current) return current;
            const x = clamp(current.x, 0, window.innerWidth - sizeRef.current);
            const y = clamp(current.y, 0, window.innerHeight - sizeRef.current - HUD_OVERHANG);
            return x === current.x && y === current.y ? current : { x, y };
          });
        }
        keepInView();
        window.addEventListener('resize', keepInView);
        return () => window.removeEventListener('resize', keepInView);
      }, [size]);

      // 菜单高度由这里命令式写入：React 不托管 height，拖拽 resize 期间
      // 每秒一次的 nowMs 重渲染才不会把高度弹回旧值。
      useEffect(() => {
        const node = menuRef.current;
        if (!menu || !node) return;
        node.style.height = menuHeight > 0 ? `${menuHeight}px` : '';
      }, [menu, menuHeight]);

      // Close the menu on any press outside it (including on the widget itself).
      useEffect(() => {
        if (!menu) return undefined;
        function onPointerDown(event) {
          if (menuRef.current && menuRef.current.contains(event.target)) return;
          setMenu(null);
        }
        function onKeyDown(event) {
          if (event.key === 'Escape') setMenu(null);
        }
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('keydown', onKeyDown);
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true);
          document.removeEventListener('keydown', onKeyDown);
        };
      }, [menu]);

      // 挂件永远不要焦点：聚焦后宿主/浏览器会画四向箭头和焦点环。
      useEffect(() => {
        function dropFocus(event) {
          const target = event.target;
          if (!target || !target.closest) return;
          if (target.closest('.dshwb-widget')) {
            try { target.blur(); } catch (error) { /* ignore */ }
          }
        }
        document.addEventListener('focusin', dropFocus, true);
        return () => document.removeEventListener('focusin', dropFocus, true);
      }, []);

      const openMenu = useCallback((event) => {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        // Anchor on the widget, not on whichever control opened the menu: the
        // panel should hang off the character regardless of the button's spot.
        const anchor = widgetRef.current || (event && event.currentTarget) || null;
        const rect = anchor
          ? anchor.getBoundingClientRect()
          : { left: 0, top: 0, width: 0, height: 0, bottom: 0 };
        const height = menuHeight > 0 ? Math.min(menuHeight, window.innerHeight - 16) : MENU_HEIGHT;
        const above = rect.top - height - 10;
        const top = above >= 8 ? above : Math.min(rect.bottom + 10, window.innerHeight - height - 8);
        const left = clamp(
          rect.left + rect.width / 2 - MENU_WIDTH / 2,
          8,
          Math.max(8, window.innerWidth - MENU_WIDTH - 8),
        );
        const finalTop = Math.max(8, top);
        setMenu({
          top: finalTop,
          left,
          // 拉伸上限跟着落点走，避免面板被拉到屏幕外面。
          maxHeight: Math.max(MENU_MIN_H, window.innerHeight - finalTop - 12),
        });
      }, [menuHeight]);

      const closeMenu = useCallback(() => setMenu(null), []);

      /** 把所有持久化偏好恢复成默认值，并回到右下角、保持清醒。 */
      const resetStatus = useCallback(() => {
        setSize(SIZE_DEFAULT);
        setIntervalSec(INTERVAL_DEFAULT);
        setAuto(true);
        setShowHud(true);
        setAsleep(false);
        setManualFace(FALLBACK);
        setFixedSay('');
        setSound(true);
        setRing(true);
        setPulseColor('#ffd166');
        setPulseStyle('ring');
        setPulseSeq(0);
        setPosition(null);
        setMenuHeight(0);
        [SIZE_KEY, INTERVAL_KEY, AUTO_KEY, HUD_KEY, ASLEEP_KEY, SAY_KEY, SOUND_KEY, RING_KEY, PULSE_KEY, PULSE_STYLE_KEY, MENU_H_KEY, NAP_KEY].forEach(clearValue);
        writePosition(null);
        window.clearTimeout(sayTimerRef.current);
        setSay('');
        setMenu(null);
      }, []);

      const toggleAsleep = useCallback(() => {
        // 菜单里关掉「双击打盹」后双击不再触发
        if (!napOn) return;
        const next = !asleep;
        setAsleep(next);
        writeValue(ASLEEP_KEY, next ? '1' : '0');
        setManualFace(FALLBACK);
        window.clearTimeout(sayTimerRef.current);
        setSay('');
      }, [asleep, napOn]);

      const handlePointerDown = useCallback((event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        // 阻止默认行为，挂件不拿焦点：宿主会给聚焦元素画四角方向箭头。
        event.preventDefault();
        if (menu) setMenu(null);
        const rect = event.currentTarget.getBoundingClientRect();
        dragRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          offsetX: event.clientX - rect.left,
          offsetY: event.clientY - rect.top,
          moved: false,
        };
        setDragging(true);
      }, [menu]);

      useEffect(() => {
        if (!dragging) return undefined;
        const sizeNow = () => sizeRef.current;

        function handleMove(event) {
          const drag = dragRef.current;
          if (!drag) return;
          const dx = event.clientX - drag.startX;
          const dy = event.clientY - drag.startY;
          if (!drag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) drag.moved = true;
          if (!drag.moved) return;
          setPosition({
            x: clamp(event.clientX - drag.offsetX, 0, window.innerWidth - sizeNow()),
            y: clamp(event.clientY - drag.offsetY, 0, window.innerHeight - sizeNow() - HUD_OVERHANG),
          });
        }

        function finishDrag() {
          const drag = dragRef.current;
          dragRef.current = null;
          setDragging(false);
          if (!drag) return;
          if (drag.moved) {
            setPosition((current) => {
              if (current) writePosition(current);
              return current;
            });
            return;
          }
          poke();
        }

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', finishDrag);
        window.addEventListener('pointercancel', finishDrag);
        return () => {
          window.removeEventListener('pointermove', handleMove);
          window.removeEventListener('pointerup', finishDrag);
          window.removeEventListener('pointercancel', finishDrag);
        };
      }, [dragging, poke]);

      const style = position
        ? { left: `${position.x}px`, top: `${position.y}px`, width: `${size}px`, height: `${size}px` }
        : { right: `${DEFAULT_INSET}px`, bottom: `${DEFAULT_INSET}px`, width: `${size}px`, height: `${size}px` };

      const src = STICKERS[face] || STICKERS[FALLBACK] || '';
      const faceLabel = asleep ? '打盹' : (FACE_NAME[face] || FACE_NAME[FALLBACK] || '');
      const moodLabel = asleep ? '防风 · 打盹' : MOOD_LABEL[mood] || MOOD_LABEL.idle;

      // HUD numbers: spend on the left, "峰/谷 + 倒计时" on the right.
      const peakNow = Boolean(usage && usage.peak && usage.peak.active === true);
      const spendText = usage && Number.isFinite(usage.todaySpend)
        ? (usage.partial === true ? '~¥' : '¥') + formatMoney(usage.todaySpend)
        : null;
      const balanceText = usage && Number.isFinite(usage.balance) ? '¥' + formatMoney(usage.balance) : null;
      const nextAtMs = usage && Number.isFinite(Number(usage.peak && usage.peak.nextChangeAt))
        ? Number(usage.peak.nextChangeAt) * 1000
        : 0;
      const remainMs = nextAtMs > 0 ? Math.max(0, nextAtMs - nowMs) : null;
      const phaseText = remainMs === null ? null : (peakNow ? '峰 ' : '谷 ') + formatCountdown(remainMs);
      const hudTitle = [
        spendText ? '今日已用 ' + spendText + (usage.partial === true ? '（按本机观测估算）' : '') : '今日花费：余额读不到',
        balanceText ? '余额 ' + balanceText : null,
        remainMs === null
          ? null
          : (peakNow ? '峰价中，' : '谷价中，') + formatCountdown(remainMs) + ' 后转' + (peakNow ? '谷价' : '峰价')
            + '（' + formatWhen(nextAtMs) + '）',
      ].filter(Boolean).join(' · ');
      const hud = showHud && (spendText || phaseText)
        ? h('div', {
          className: 'dshwb-hud',
          'data-peak': peakNow ? 'true' : 'false',
          title: hudTitle,
          // HUD 挂在框外，别让点它触发挂件的拖拽/逗弄。
          onPointerDown: (event) => event.stopPropagation(),
          onDoubleClick: (event) => event.stopPropagation(),
        },
          spendText ? h('span', { className: 'dshwb-hud-spend' }, spendText) : null,
          phaseText ? h('span', { className: peakNow ? 'dshwb-hud-peak' : 'dshwb-hud-valley' }, phaseText) : null,
        )
        : null;

      const widget = h('div', {
        ref: widgetRef,
        className: 'dshwb-widget',
        'data-dragging': dragging ? 'true' : 'false',
        'data-asleep': asleep ? 'true' : 'false',
        'data-mood': mood,
        'data-ring': ring ? 'on' : 'off',
        style,
        role: 'button',
        tabIndex: -1,
        title: '拖动换位置，点一下逗她，双击打盹，点右上角按钮打开设置',
        'aria-label': '防风挂件',
        onPointerDown: handlePointerDown,
        onContextMenu: openMenu,
        onDoubleClick: toggleAsleep,
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            poke();
          }
        },
      },
        h('style', null, STYLES),
        h('div', { className: 'dshwb-float' },
          h('img', {
            className: 'dshwb-img',
            src,
            alt: '',
            draggable: false,
            'data-pop': pop ? 'true' : 'false',
          }),
        ),
        h('div', { className: 'dshwb-name', title: moodLabel }, faceLabel),
        say && !menu ? h('div', { className: 'dshwb-say', role: 'status' }, say) : null,
        hud,
        mood === 'waiting' && ring ? h('div', { className: 'dshwb-wait' }) : null,
        pulseSeq > 0 && pulseColor !== 'off'
          ? h('svg', {
            key: pulseSeq,
            className: 'dshwb-pulse',
            'data-style': pulseStyle,
            viewBox: '0 0 100 100',
            style: { '--dshwb-pulse': pulseColor },
            'aria-hidden': 'true',
          },
          pulseStyle === 'ring'
            ? h('circle', {
              cx: 50,
              cy: 50,
              r: 43,
              fill: 'none',
              stroke: 'currentColor',
              strokeWidth: 9,
            })
            : [
              h('g', { key: 'in', className: 'dshwb-spark-in' }, renderRays(SPARK_INNER, 1.9)),
              h('g', { key: 'out', className: 'dshwb-spark-out' }, renderRays(SPARK_OUTER, 1.0)),
            ])
          : null,
        h('button', {
          type: 'button',
          className: 'dshwb-gear',
          'data-open': menu ? 'true' : 'false',
          title: menu ? '关闭设置' : '打开设置',
          'aria-label': menu ? '关闭设置' : '打开设置',
          'aria-expanded': menu ? 'true' : 'false',
          onPointerDown: (event) => event.stopPropagation(),
          onDoubleClick: (event) => event.stopPropagation(),
          onKeyDown: (event) => event.stopPropagation(),
          onClick: (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (menu) {
              setMenu(null);
              return;
            }
            openMenu(event);
          },
        },
          h('svg', {
            viewBox: '0 0 24 24',
            width: 13,
            height: 13,
            'aria-hidden': 'true',
            focusable: 'false',
          },
            h('circle', { cx: 12, cy: 5.5, r: 1.7, fill: 'currentColor' }),
            h('circle', { cx: 12, cy: 12, r: 1.7, fill: 'currentColor' }),
            h('circle', { cx: 12, cy: 18.5, r: 1.7, fill: 'currentColor' }),
          ),
        ),
      );

      const panel = menu
        ? h('div', {
          ref: menuRef,
          className: 'dshwb-menu',
          role: 'dialog',
          'aria-label': '防风挂件设置',
          style: {
            top: `${menu.top}px`,
            left: `${menu.left}px`,
            width: `${MENU_WIDTH}px`,
            ...(menu.maxHeight > 0 ? { maxHeight: `${menu.maxHeight}px` } : null),
          },
          // 右下角的原生 resize 手柄松手后把高度记下来，下次打开沿用。
          onPointerUp: (event) => {
            const next = Math.round(event.currentTarget.offsetHeight);
            if (!(next >= MENU_MIN_H)) return;
            if (next === menuHeight) return;
            setMenuHeight(next);
            writeValue(MENU_H_KEY, next);
          },
        },
          h('div', { className: 'dshwb-menu-title' }, h('span', null, '防风 · 设置'), h('span', { className: 'dshwb-ver' }, 'v' + VERSION)),
          h(Slider, {
            label: '大小',
            value: size,
            min: SIZE_MIN,
            max: SIZE_MAX,
            step: 4,
            unit: 'px',
            onChange: (next) => {
              setSize(next);
              writeValue(SIZE_KEY, next);
            },
          }),
          h(Slider, {
            label: '随机换表情间隔',
            value: intervalSec,
            min: INTERVAL_MIN,
            max: INTERVAL_MAX,
            step: 1,
            unit: 's',
            onChange: (next) => {
              setIntervalSec(next);
              writeValue(INTERVAL_KEY, next);
            },
          }),
          h('label', { className: 'dshwb-check' },
            h('input', {
              type: 'checkbox',
              checked: auto,
              onChange: (event) => {
                const next = event.target.checked;
                setAuto(next);
                writeValue(AUTO_KEY, next ? '1' : '0');
              },
            }),
            h('span', null, '空闲时自动换表情'),
          ),
          h('label', { className: 'dshwb-check' },
            h('input', {
              type: 'checkbox',
              checked: showHud,
              onChange: (event) => {
                const next = event.target.checked;
                setShowHud(next);
                writeValue(HUD_KEY, next ? '1' : '0');
              },
            }),
            h('span', null, '显示花费与峰谷'),
          ),
          h('label', { className: 'dshwb-check' },
            h('input', {
              type: 'checkbox',
              checked: napOn,
              onChange: (event) => {
                const next = event.target.checked;
                setNapOn(next);
                writeValue(NAP_KEY, next ? '1' : '0');
                if (!next && asleep) setAsleep(false);
              },
            }),
            h('span', null, '双击打盹'),
          ),
          h('label', { className: 'dshwb-check' },
            h('input', {
              type: 'checkbox',
              checked: sound,
              onChange: (event) => {
                const next = event.target.checked;
                setSound(next);
                writeValue(SOUND_KEY, next ? '1' : '0');
              },
            }),
            h('span', null, '点击音效'),
          ),
          h('label', { className: 'dshwb-check' },
            h('input', {
              type: 'checkbox',
              checked: ring,
              onChange: (event) => {
                const next = event.target.checked;
                setRing(next);
                writeValue(RING_KEY, next ? '1' : '0');
              },
            }),
            h('span', null, '等待确认时的黄色光圈'),
          ),
          h('label', { className: 'dshwb-field' },
            h('span', null, '点击光环'),
            h('select', {
              className: 'dshwb-select',
              value: pulseColor,
              onChange: (event) => {
                const next = event.target.value;
                setPulseColor(next);
                writeValue(PULSE_KEY, next);
              },
            },
              h('option', { value: 'off' }, '关闭'),
              PULSE_COLORS.map(([hex, name]) => h('option', { key: hex, value: hex }, name)),
            ),
          ),
          h('label', { className: 'dshwb-field' },
            h('span', null, '点击光环样式'),
            h('select', {
              className: 'dshwb-select',
              value: pulseStyle,
              onChange: (event) => {
                const next = event.target.value;
                setPulseStyle(next);
                writeValue(PULSE_STYLE_KEY, next);
              },
            },
              PULSE_STYLES.map(([id, name]) => h('option', { key: id, value: id }, name)),
            ),
          ),
          h('label', { className: 'dshwb-field' },
            h('span', null, '常用台词'),
            h('select', {
              className: 'dshwb-select',
              value: fixedSay,
              onChange: (event) => {
                const next = event.target.value;
                setFixedSay(next);
                writeValue(SAY_KEY, next);
              },
            },
              h('option', { value: '' }, '随机'),
              SAYS.map((line) => h('option', { key: line, value: line }, line)),
            ),
          ),
          h('div', { className: 'dshwb-menu-actions' },
            h('button', {
              type: 'button',
              className: 'dshwb-btn',
              onClick: () => {
                setPosition(null);
                writePosition(null);
                setMenu(null);
              },
            }, '回到右下角'),
            h('button', {
              type: 'button',
              className: 'dshwb-btn',
              onClick: toggleAsleep,
            }, asleep ? '叫醒' : '打盹'),
          ),
          h('button', {
            type: 'button',
            className: 'dshwb-btn dshwb-btn-reset',
            title: '大小、间隔、开关、位置、表情全部恢复默认',
            onClick: resetStatus,
          }, '重置状态'),
          h('div', { className: 'dshwb-hint' }, '拖动换位置 · 单击逗她 · 双击打盹 · 右上角按钮开关菜单'),
        )
        : null;

      return h(React.Fragment, null, widget, panel);
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'zephyr-widget',
          order: 40,
          label: '防风挂件',
        }, Widget));
      },
    };
  },
});
