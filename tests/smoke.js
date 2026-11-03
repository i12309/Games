/* Offline functional smoke tests for the game logic, without a browser dependency.
   Run: node tests/smoke.js */
'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.children = [];
    this.textContent = '';
    this.innerHTML = '';
    this.hidden = false;
    this.disabled = false;
    this.dataset = {};
    this.listeners = {};
    this.attributes = {};
    this.firstChild = { textContent: '' };
    this.tagName = 'BUTTON';
    const classes = new Set();
    this.classList = {
      toggle: (name, enabled) => { if (enabled) classes.add(name); else classes.delete(name); },
      contains: name => classes.has(name),
    };
    this.style = { setProperty: (name, value) => { this.style[name] = value; } };
  }
  addEventListener(name, handler) { (this.listeners[name] ||= []).push(handler); }
  emit(name, evt = {}) { for (const handler of this.listeners[name] || []) handler(evt); }
  click() { if (!this.disabled) this.emit('click'); }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name]; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  getBoundingClientRect() { return { x: 0, y: 0, width: 800, height: 530, left: 0, top: 0 }; }
  setPointerCapture() {}
  getContext() {
    const ctx = {};
    for (const fn of ['setTransform','clearRect','save','restore','beginPath','roundRect','arc','fill','stroke','fillRect','moveTo','lineTo','translate','fillText']) ctx[fn] = () => {};
    return ctx;
  }
}

function createHarness(game, store = new Map()) {
  const ids = new Map();
  const el = id => { if (!ids.has(id)) ids.set(id, new FakeElement(id)); return ids.get(id); };
  const levels = ['easy', 'normal', 'hard'].map(name => {
    const node = new FakeElement('level-' + name); node.dataset.difficulty = name; return node;
  });
  const arrows = ['up', 'down', 'left', 'right'].map(name => {
    const node = new FakeElement('arrow-' + name); node.dataset.direction = name; return node;
  });
  const timeouts = [];
  const intervals = [];
  const windowListeners = {};
  const sound = [];
  const app = {
    read: (name, fallback) => { try { return store.has(name) ? JSON.parse(store.get(name)) : fallback; } catch (_) {return fallback;} },
    write: (name, value) => { store.set(name, JSON.stringify(value)); return true; },
    duration: t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`,
    sound: notes => sound.push(notes),
    soundEnabled: () => false,
    setSound: () => {},
  };
  const doc = {
    querySelector: selector => el(selector),
    querySelectorAll: selector => selector === '[data-difficulty]' ? levels : selector === '[data-direction]' ? arrows : [],
    createElement: () => new FakeElement(),
    hidden: false,
  };
  const window = { Igroland: app, addEventListener: (name, cb) => { (windowListeners[name] ||= []).push(cb); }, devicePixelRatio: 1 };
  if (game === 'maze') window.ResizeObserver = class { observe() {} };
  const ctx = vm.createContext({ window, document: doc, console, setTimeout: cb => { timeouts.push(cb); return timeouts.length; }, clearTimeout: () => {}, setInterval: cb => { intervals.push(cb); return intervals.length; }, Math, Number, Map, Set, JSON, URLSearchParams, location: { search: '' } });
  const source = fs.readFileSync(path.join(root, 'games', game, game + '.js'), 'utf8');
  vm.runInContext(source, ctx, {filename: game + '.js', timeout: 10000});
  return { app, store, el, levels, arrows, timeouts, intervals, ids, windowListeners,
    flushTimeouts: () => { while(timeouts.length) timeouts.shift()(); },
    session: () => app.read(game + '.sessions.v1', {}),
    clickLevel: name => levels.find(node => node.dataset.difficulty === name).click(),
    clickArrow: name => arrows.find(node => node.dataset.direction === name).click(),
  };
}

function testMemory() {
  const x = createHarness('memory');
  const board = x.el('#memoryBoard');
  assert.equal(board.children.length, 6);
  const order = x.session().easy.order;
  for (const icon of new Set(order)) {
    const indexes = order.map((v, i) => v === icon ? i : -1).filter(i => i >= 0);
    board.children[indexes[0]].click(); board.children[indexes[1]].click();
  }
  assert.equal(x.session().easy.moves, 3);
  assert.equal(x.session().easy.won, true);
  assert.equal(x.el('#successDialog').hidden, false);
  assert.equal(x.app.read('memory.best.v1', {}).easy.moves, 3);
  x.el('#againButton').click();
  assert.equal(x.session().easy.moves, 0);
  assert.equal(x.el('#successDialog').hidden, true);
  const freshOrder = x.session().easy.order;
  const idx1 = 0, idx2 = freshOrder.findIndex(value => value !== freshOrder[0]);
  board.children[idx1].click();board.children[idx2].click();
  assert.equal(x.session().easy.moves, 0); // a mismatch is committed after the flip timer
  x.flushTimeouts();
  assert.equal(x.session().easy.moves, 1);
  x.clickLevel('hard');
  assert.equal(board.children.length, 20);
  x.el('#hintButton').click();
  assert.equal(board.children.filter(c => c.classList.contains('is-hint')).length, 2);
  x.flushTimeouts();
  assert.equal(x.session().hard.hints, 1);
  const y = createHarness('memory', x.store);
  assert.equal(y.el('#memoryBoard').children.length, 20);
  assert.equal(y.session().hard.hints, 1);
  console.log('PASS: память, завершение, рекорды, неверная пара, подсказка, перезагрузка');
}

function shortestPath(grid, from = [1,1], to = [grid.length - 2,grid.length - 2]) {
  const q = [from], p = new Map([[from.join(','), null]]);
  for (let i = 0; i < q.length; i++) {
    const [r,c] = q[i];
    for (const [name, dr, dc] of [['up',-1,0],['down',1,0],['left',0,-1],['right',0,1]]) {
      const rr=r+dr,cc=c+dc,key=rr+','+cc;
      if (grid[rr]?.[cc] !== 0 || p.has(key)) continue;
      p.set(key, {from:r+','+c, direction:name});q.push([rr,cc]);
    }
  }
  const end = to.join(',');
  if (!p.has(end)) return null;
  const route = [];
  for (let at=end; at!==from.join(',');) { const parent=p.get(at);route.push(parent.direction);at=parent.from; }
  return route.reverse();
}

function testMaze() {
  const x = createHarness('maze');
  for (const [mode, n] of Object.entries({easy:7,normal:11,hard:15})) {
    x.clickLevel(mode);
    for (let i = 0; i < 30; i++) {
      const grid = x.session()[mode].grid;
      assert.equal(grid.length, n);
      assert.ok(shortestPath(grid), 'generated maze is solvable');
      x.el('#newMaze').click();
    }
  }
  x.clickLevel('easy');
  const route = shortestPath(x.session().easy.grid);
  for (const direction of route) x.clickArrow(direction);
  assert.equal(x.session().easy.won, true);
  assert.equal(x.el('#successDialog').hidden, false);
  assert.equal(x.session().easy.steps, route.length);
  assert.equal(x.app.read('maze.best.v1', {}).easy.steps, route.length);
  x.el('#againButton').click();
  assert.equal(x.session().easy.steps, 0);
  x.el('#zoomIn').click();
  assert.equal(x.el('#zoomLabel').textContent, '125%');
  x.el('#zoomFit').click();
  assert.equal(x.el('#zoomLabel').textContent, '100%');
  x.el('#hintButton').click();
  assert.equal(x.session().easy.hints, 1);
  // Simulate a finger tracing to a free neighboring tile.
  x.el('#newMaze').click();
  const grid = x.session().easy.grid;
  const neighbor = [[1,2],[2,1]].find(([r,c]) => grid[r][c] === 0);
  assert.ok(neighbor);
  const tile = 530 * .9 / 7, x0 = (800 - tile * 7) / 2, y0 = (530 - tile * 7) / 2;
  const coord = ([r,c]) => ({ clientX: x0 + (c+.5)*tile,clientY:y0+(r+.5)*tile });
  const ev = (point, id) => ({...point,pointerType:'touch',pointerId:id,button:0,preventDefault:()=>{}});
  const canvas=x.el('#mazeCanvas');
  canvas.emit('pointerdown', ev(coord([1,1]),11));
  canvas.emit('pointermove', ev(coord(neighbor),11));
  canvas.emit('pointerup', ev(coord(neighbor),11));
  assert.equal(x.session().easy.steps, 1, 'touch trace moves hero');
  // Two-finger pinch must alter zoom; dragging both fingers must pan.
  const centerA = {clientX:320,clientY:200}, centerB = {clientX:440,clientY:200};
  canvas.emit('pointerdown', ev(centerA,21));
  canvas.emit('pointerdown', ev(centerB,22));
  canvas.emit('pointermove', ev({clientX:490,clientY:200},22));
  assert.notEqual(x.el('#zoomLabel').textContent, '100%', 'pinch zooms the board');
  canvas.emit('pointerup', ev(centerA,21));
  canvas.emit('pointerup', ev({clientX:490,clientY:200},22));
  const y = createHarness('maze', x.store);
  assert.equal(y.session().easy.steps, 1);
  console.log('PASS: генерация 90 проходимых карт, победа, рекорды, подсказки, зум, касание, перезагрузка');
}

testMemory();
testMaze();
