// Smoke test: load client.js with a stubbed module loader and React so a
// broken build fails here instead of in the browser. It renders the widget
// twice: once closed, once with the settings menu opened through its own
// contextmenu handler, which exercises the panel and slider components too.
globalThis.window = {
  __ModuleLoader__: { load(mod) { globalThis.__mod = mod; } },
  innerWidth: 1440,
  innerHeight: 900,
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
  setInterval: () => 0,
  clearInterval: () => {},
};

await import('../client.js');
globalThis.document = { addEventListener: () => {}, removeEventListener: () => {} };

const mod = globalThis.__mod;
if (!mod) throw new Error('client.js did not register itself');
if (mod.id !== 'dsh-zephyr-widget') throw new Error(`unexpected id: ${mod.id}`);

const Fragment = Symbol('Fragment');
const stateStore = [];
let hookIndex = 0;
const cleanups = [];

const React = {
  Fragment,
  createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
  useState(init) {
    const i = hookIndex++;
    if (!(i in stateStore)) {
      stateStore[i] = typeof init === 'function' ? init() : init;
    }
    return [stateStore[i], (value) => {
      stateStore[i] = typeof value === 'function' ? value(stateStore[i]) : value;
    }];
  },
  useEffect: (fn) => {
    const cleanup = fn();
    if (typeof cleanup === 'function') cleanups.push(cleanup);
  },
  useCallback: (fn) => fn,
  useMemo: (fn) => fn(),
  useRef: (value) => ({ current: value }),
};

const plugin = mod.factory(() => React);
if (!plugin || typeof plugin.apply !== 'function') throw new Error('factory did not return an apply()');
if (!Array.isArray(plugin.inject)) throw new Error('factory did not declare inject: [...]');

let registered = null;
plugin.apply({
  slots: {
    inject(name, cb) { cb(); },
    register(config, component) { registered = { config, component }; return () => {}; },
  },
});
if (!registered) throw new Error('apply() did not register a slot entry');
if (registered.config.name !== 'shell.overlay') throw new Error(`unexpected slot: ${registered.config.name}`);

const Comp = registered.component;

// Expand function components (skipping Widget itself, which owns the hooks we
// are driving manually) so Slider is really executed.
function expand(node) {
  if (Array.isArray(node)) return node.map(expand);
  if (!node || typeof node !== 'object') return node;
  if (typeof node.type === 'function' && node.type.name !== 'Widget') {
    return expand(node.type(node.props));
  }
  return { ...node, children: node.children.map(expand) };
}

function render() {
  hookIndex = 0;
  return expand(Comp({}));
}

const first = render();
const widget = first.children[0];
if (!widget || widget.props.className !== 'dshwb-widget') throw new Error('widget root missing');
if (widget.props['data-mood'] !== 'idle') throw new Error(`unexpected mood: ${widget.props['data-mood']}`);
function findNode(node, predicate) {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findNode(child, predicate);
      if (hit) return hit;
    }
    return null;
  }
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  return findNode(node.children, predicate);
}

const img = findNode(widget, (node) => node.props && node.props.className === 'dshwb-img');
if (!img) throw new Error('sticker image missing');
if (!String(img.props.src).startsWith('data:image/webp;base64,')) throw new Error('sticker src is not an inline data URI');
if (first.children[1] !== null) throw new Error('menu should start closed');

// Drive the real handler the widget exposes.
widget.props.onContextMenu({
  preventDefault() {},
  stopPropagation() {},
  currentTarget: { getBoundingClientRect: () => ({ left: 900, top: 600, width: 140, height: 140 }) },
});

const second = render();
const panel = second.children[1];
if (!panel || panel.props.className !== 'dshwb-menu') throw new Error('menu panel did not open');

const sliders = [];
(function collect(node) {
  if (!node || typeof node !== 'object') return;
  if (node.props && node.props.type === 'range') sliders.push(node);
  (node.children || []).forEach(collect);
})(panel);
if (sliders.length !== 2) throw new Error(`expected 2 sliders, got ${sliders.length}`);
const [sizeSlider, intervalSlider] = sliders;
if (sizeSlider.props.min !== 88 || sizeSlider.props.max !== 220) throw new Error('size slider range wrong');
if (intervalSlider.props.min !== 8 || intervalSlider.props.max !== 90) throw new Error('interval slider range wrong');
if (!panel.props.style || !/^\d+px$/.test(panel.props.style.top || '')) throw new Error('menu placement missing');

console.log('smoke ok:', mod.id, 'inject =', plugin.inject.join(','), 'sizes =', sizeSlider.props.value, '/', intervalSlider.props.value);

// --- usage HUD -------------------------------------------------------------
// Feed the route a canned answer, re-render, and check the HUD actually appears
// with both halves (spend + peak/valley countdown).
globalThis.fetch = () => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({
    ok: true,
    now: Date.now(),
    peak: { active: true, nextChangeAt: Math.floor(Date.now() / 1000) + 5400 },
    peakHours: [[9, 12], [14, 18]],
    balance: 47.5,
    currency: 'CNY',
    todaySpend: 0.42,
    partial: false,
  }),
});

render();
await new Promise((resolve) => setTimeout(resolve, 20));
const withUsage = render();
const hud = findNode(withUsage.children[0], (node) => node.props && node.props.className === 'dshwb-hud');
if (!hud) throw new Error('usage HUD did not render');
if (hud.props['data-peak'] !== 'true') throw new Error('HUD did not pick up the peak state');
const hudText = [];
(function collectText(node) {
  if (!node) return;
  if (Array.isArray(node)) return node.forEach(collectText);
  if (typeof node === 'string' || typeof node === 'number') return hudText.push(String(node));
  if (typeof node === 'object') collectText(node.children);
})(hud.children);
const joined = hudText.join(' ');
if (!joined.includes('¥0.42')) throw new Error(`HUD spend text wrong: ${joined}`);
if (!joined.includes('峰')) throw new Error(`HUD phase text wrong: ${joined}`);
console.log('hud ok:', joined);

// --- menu button + reset ----------------------------------------------------
const FRECT = { left: 900, top: 600, width: 140, height: 140, bottom: 740 };
const fakeEvent = () => ({
  preventDefault() {},
  stopPropagation() {},
  currentTarget: { getBoundingClientRect: () => FRECT },
});
const gearOf = (tree) => findNode(tree.children[0], (n) => n.props && n.props.className === 'dshwb-gear');
if (!gearOf(withUsage)) throw new Error('gear button missing');
// The menu is open at this point: first click closes it, second one reopens.
gearOf(withUsage).props.onClick(fakeEvent());
if (render().children[1] !== null) throw new Error('gear did not close the open menu');
gearOf(render()).props.onClick(fakeEvent());
const withMenu = render();
const panel2 = withMenu.children[1];
if (!panel2 || panel2.props.className !== 'dshwb-menu') throw new Error('gear did not open the menu');

const resetBtn = findNode(panel2, (n) => n.props && String(n.props.className || '').includes('dshwb-btn-reset'));
if (!resetBtn) throw new Error('reset button missing');

// Change the size away from its default, then reset and expect it back.
const sliders2 = [];
(function collectSliders(node) {
  if (!node || typeof node !== 'object') return;
  if (node.props && node.props.type === 'range') sliders2.push(node);
  (node.children || []).forEach(collectSliders);
})(panel2);
sliders2[0].props.onChange({ target: { value: '200' } });
sliders2[1].props.onChange({ target: { value: '60' } });
resetBtn.props.onClick();
const afterReset = render();
if (afterReset.children[1] !== null) throw new Error('reset should close the menu');
const afterStyle = afterReset.children[0].props.style;
if (afterStyle.width !== '140px') throw new Error(`reset did not restore the size: ${afterStyle.width}`);
console.log('menu ok: gear opens the panel, reset restored size', afterStyle.width);

// --- poke: chatter bubble + sticky face -------------------------------------
const beforePoke = render().children[0];
const imgBefore = findNode(beforePoke, (n) => n.props && n.props.className === 'dshwb-img');
beforePoke.props.onKeyDown({ key: 'Enter', preventDefault() {} });
const poked = render().children[0];
const bubble = findNode(poked, (n) => n.props && n.props.className === 'dshwb-say');
if (!bubble || typeof bubble.children[0] !== 'string') throw new Error('poke did not say anything');
const imgAfter = findNode(poked, (n) => n.props && n.props.className === 'dshwb-img');
if (imgAfter.props.src === imgBefore.props.src) throw new Error('poke did not change the face');
console.log('poke ok:', bubble.children[0]);

// --- fixed line: the menu picker overrides the random pool -------------------
gearOf(render()).props.onClick(fakeEvent());
const menu3 = render().children[1];
const selects = [];
(function collectSelects(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(collectSelects); return; }
  if (node.props && node.props.className === 'dshwb-select') selects.push(node);
  (node.children || []).forEach(collectSelects);
})(menu3);
if (selects.length !== 3) throw new Error(`expected 3 selects (line + pulse colour + pulse style), got ${selects.length}`);
const styleIds = ['ring', 'spark'];
const pulseSel = selects.find((n) => String(n.props.value).startsWith('#'));
const styleSel = selects.find((n) => styleIds.includes(n.props.value));
const lineSel = selects.find((n) => n !== pulseSel && n !== styleSel);
if (!lineSel) throw new Error('fixed-line select missing');
if (!pulseSel) throw new Error('pulse colour select missing');
if (!styleSel) throw new Error('pulse style select missing');
if (pulseSel.props.value !== '#ffd166') throw new Error(`pulse colour default wrong: ${pulseSel.props.value}`);
if (styleSel.props.value !== 'ring') throw new Error(`pulse style default wrong: ${styleSel.props.value}`);
if (!lineSel) throw new Error('fixed-line select missing from the menu');
if (lineSel.props.value !== '') throw new Error('fixed-line select should default to random');
lineSel.props.onChange({ target: { value: '玉石姐姐' } });
gearOf(render()).props.onClick(fakeEvent());
if (render().children[1] !== null) throw new Error('gear did not close the menu after picking a line');
render().children[0].props.onKeyDown({ key: 'Enter', preventDefault() {} });
const fixedBubble = findNode(render().children[0], (n) => n.props && n.props.className === 'dshwb-say');
if (!fixedBubble || fixedBubble.children[0] !== '玉石姐姐') {
  throw new Error('fixed line not used, got: ' + (fixedBubble && fixedBubble.children[0]));
}
console.log('fixed say ok:', fixedBubble.children[0]);

for (const cleanup of cleanups) cleanup();

