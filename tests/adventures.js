'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const shop = require('../games/forest-shop/rules.js'), post = require('../games/story-post/rules.js');
const shapes = require('../games/shape-studio/rules.js'), physics = require('../games/marble-lab/rules.js');
const shelf = require('../shared/workshop.js'), registry = require('../assets/adventures-registry.js');
const root = path.resolve(__dirname, '..');
let shopCases = 0, postCases = 0;
for (const l of shop.LEVELS) for (let seed = 0; seed < 200; seed++) for (let index = 0; index < 5; index++) {
  const t = shop.generate(l.id, seed, index); assert.deepEqual(t, shop.generate(l.id, seed, index));
  assert.equal(shop.cost(t.order), t.total); assert(t.total <= 20);
  const state = { cart: t.order.slice(), coins: typeof t.answer === 'number' ? t.answer : 0 };
  assert(shop.check(t, state, t.answer).ok); assert(!shop.check(t, { ...state, cart: [] }, t.answer).ok);
  assert(shop.check(t, { ...state, cart: state.cart.slice().reverse() }, t.answer).ok);
  if (l.id === 'budget') assert(!shop.check(t, state, !t.answer).ok);
  else if (l.id !== 'count') { assert(!shop.check(t, { ...state, coins: state.coins + 1 }).ok); assert(t.answer >= 0 && t.answer <= 10); }
  if (l.id === 'total' || l.id === 'budget') assert(t.total <= 8);
  shopCases++;
}
assert.equal(shop.coins(1),'1 монета'); assert.equal(shop.coins(4),'4 монеты'); assert.equal(shop.coins(11),'11 монет');
for (const bad of [null, {}, { cart: ['x'], coins: 1 }, { cart: [], coins: -1 }, { cart: [], coins: Infinity }]) assert.deepEqual(shop.draft(bad), { cart: [], coins: 0 });
for (const l of post.LEVELS) for (let seed = 0; seed < 100; seed++) for (let index = 0; index < 6; index++) {
  const t = post.generate(l.id, seed, index); assert.deepEqual(t, post.generate(l.id, seed, index));
  assert.equal(new Set(t.houses.map(h => `${h.roof},${h.door}`)).size, 6);
  assert.equal(new Set(t.houses.map(h => h.person.name)).size, 6);
  assert(t.target >= 0 && t.target < 6); assert(t.clue >= 0 && t.clue < t.lines.length);
  const target = t.houses[t.target];
  if (l.id === 'clues') {
    assert(t.lines[0].includes(post.ROOFS[target.roof].name)); assert(t.lines[1].includes(post.DOORS[target.door].name));
    assert.equal(t.houses.filter(h => h.roof === target.roof && h.door === target.door).length, 1);
  }
  if (l.id === 'stories' && index % 3 === 0) assert(t.lines[1].includes(target.person.at));
  t.lines.join(' ').split(' ').forEach(word => assert.equal(post.syllables(word).join(''), word));
  postCases++;
}
for (const [word, chunks] of Object.entries(post.SYLLABLES)) {
  assert.equal(chunks.join(''), word); chunks.forEach(c => assert.equal((c.match(/[аеёиоуыэюя]/g) || []).length,1));
}
for (const l of shapes.LEVELS.filter(l => l.id !== 'free')) {
  const initial = shapes.initial(l.id); assert(shapes.validForLevel(initial,l)); assert(!shapes.solved(initial,l));
  const solution = l.targets.map((t, i) => ({ ...t, id: i + 1 })); assert(shapes.solved(solution,l));
  const near = JSON.parse(JSON.stringify(solution)); near[0].x += 15; assert(!shapes.solved(near,l)); assert(shapes.snap(near,near[0].id,l)); assert(shapes.solved(near,l));
  assert(!shapes.solved(solution.slice(1),l));
  if (l.mode === 'mirror') {
    l.fixed.forEach((p,i) => assert(shapes.matches({ ...p, x: 640-p.x, rot: shapes.rotate(-p.rot) },l.targets[i],1,true)));
    const bad = JSON.parse(JSON.stringify(solution)); bad[0].color = (bad[0].color + 1) % 5; assert(!shapes.solved(bad,l)); assert.equal(shapes.validForLevel(bad,l),null);
  }
}
assert.equal(shapes.validPieces([{ id:1,type:'__proto__',x:100,y:100,rot:0,color:0 }]),null);
assert.equal(shapes.validPieces([{ id:1,type:'square',x:NaN,y:100,rot:0,color:0 }]),null);
for (const l of physics.LEVELS.filter(l => l.id !== 'free')) {
  const design = { parts: physics.solution(l), spawn:l.spawn, goal:l.goal };
  assert(physics.validDesign(design)); const a=physics.simulate(design,physics.fixed(l)), b=physics.simulate(design,physics.fixed(l));
  assert.equal(a.status,'won',l.id); assert.deepEqual(a,b); assert(a.time < 10);
}
let seed = 37; const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(let i=0;i<200;i++) {
  const d={spawn:{x:50+rand()*540,y:30},goal:{x:320,y:430},parts:Array.from({length:8},(_,j)=>physics.part(j+1,50+rand()*540,80+rand()*330,-90+rand()*180,['rail','funnel','spring'][j%3]))};
  const b=physics.simulate(d); assert(Number.isFinite(b.x)&&Number.isFinite(b.y)&&Number.isFinite(b.vx)&&Number.isFinite(b.vy)); assert(['won','lost'].includes(b.status));
}
assert.equal(physics.validDesign({parts:[],spawn:{x:NaN,y:20},goal:{x:40,y:40}}),null);
const cache=new Map();let denied=false;
global.window={Igroland:{read:(k,f)=>cache.has(k)?JSON.parse(cache.get(k)):f,write:(k,v)=>{if(denied)return false;cache.set(k,JSON.stringify(v));return true;}}};
const sample={pieces:shapes.initial('house')};let first;
for(let i=0;i<24;i++){const result=shelf.saveWork('shape-studio',`Работа ${i}`,sample);assert(result.item);if(!i)first=result.item.id;}
assert(shelf.saveWork('shape-studio','Лишняя',sample).error);assert.equal(shelf.entries().length,24);
assert(shelf.saveWork('shape-studio','Обновлённая',sample,first).item);assert.equal(shelf.entries().length,24);
assert(shelf.removeWork(first));assert.equal(shelf.entries().length,23);denied=true;assert(shelf.saveWork('shape-studio','Нет места',sample).error);assert(!shelf.removeWork(shelf.entries()[0].id));denied=false;
assert(!shelf.validEntry({id:'javascript:alert(1)',game:'shape-studio',name:'x',time:1,data:{}}));delete global.window;
for(const [section,count] of [['',16],['learn',7],['play',9],['invalid',16]]) {
  const callbacks=[],elements=new Map(),node=id=>{if(!elements.has(id))elements.set(id,{textContent:''});return elements.get(id);};
  const context={URLSearchParams,location:{search:`?section=${section}`},window:{},document:{body:{dataset:{},classList:{add(){}}},addEventListener:(n,cb)=>callbacks.push(cb),querySelectorAll:()=>[],querySelector:node,getElementById:node}};
  for(const f of ['game-registry.js','learning-registry.js','adventures-registry.js','learning-home.js']) vm.runInNewContext(fs.readFileSync(path.join(root,'assets',f),'utf8'),context);
  assert.equal(context.window.IGROLAND_GAME_REGISTRY.length,count);assert.equal(new Set(context.window.IGROLAND_ALL_GAMES.map(g=>g.id)).size,16);callbacks.forEach(cb=>cb());
}
const modules={'forest-shop':shop,'story-post':post,'shape-studio':shapes,'marble-lab':physics};
for(const game of registry)for(const l of game.levels){const url=new URL(l.link,'https://example.test/Games/');assert(modules[game.id].LEVELS.some(x=>x.id===url.searchParams.get('level')));assert(url.pathname.startsWith('/Games/games/'));}
for(const file of ['index.html','works.html',...registry.map(g=>`games/${g.id}/index.html`)]) {
  const html=fs.readFileSync(path.join(root,file),'utf8');
  for(const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {const rel=match[1].split('?')[0];assert(!/^(?:\/|https?:)/.test(rel));assert(fs.existsSync(path.resolve(root,path.dirname(file),rel)),`${file}: ${rel}`);}
}
console.log(`PASS adventures: ${shopCases} shop orders; ${postCases} letters; 9 shape solutions; 6 physical routes; 200 bounded physics simulations.`);
console.log('PASS shelf: 24-work limit, update, delete, failed storage; registry 16/7/9, unique entries and 25 relative level links.');
