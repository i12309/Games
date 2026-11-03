/* Mahjong logic, link routing and catalog regression. Run: node tests/mahjong.js */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rules = require('../games/mahjong/rules.js');
const games = require('../assets/game-registry.js');
const root = path.resolve(__dirname, '..');
let layouts = 0, moves = 0, shuffles = 0;
for (const level of rules.LEVELS) {
  for (let seed = 1; seed <= 250; seed++) {
    const game = rules.generate(level.id, seed);
    const again = rules.generate(level.id, seed);
    assert.deepEqual(game.symbols, again.symbols);
    assert.equal(game.tiles.length % 2, 0);
    assert.equal(game.plan.length * 2, game.tiles.length);
    assert(rules.validSymbols(game.tiles, game.symbols));
    let gone = new Set();
    // Fully play a known good elimination sequence, respecting tile restrictions.
    for (const pair of game.plan) {
      assert(rules.freeTile(game.tiles[pair[0]], game.tiles, gone));
      assert(rules.freeTile(game.tiles[pair[1]], game.tiles, gone));
      const next = rules.takePair(game, gone, ...pair);
      assert(next, `${level.id}/${seed}: pair ${pair}`);
      assert.equal(next.size, gone.size + 2);
      gone = next;
      moves++;
    }
    assert.equal(gone.size, game.tiles.length);
    assert.equal(rules.safeHint(game, gone), null);
    layouts++;
  }
  const game = rules.generate(level.id, 1124);
  let gone = new Set();
  const first = rules.safeHint(game, gone);
  assert(first && rules.takePair(game, gone, ...first));
  gone = rules.takePair(game, gone, ...first);
  const reorganized = rules.reorganize(game, gone, 29981);
  assert(reorganized, 'shuffle remains possible after one pair');
  assert(rules.validSymbols(game.tiles, reorganized.symbols, gone));
  game.symbols = reorganized.symbols; game.plan = reorganized.plan;
  for (const pair of reorganized.plan) {
    gone = rules.takePair(game, gone, ...pair);
    assert(gone);
  }
  assert.equal(gone.size, game.tiles.length);
  shuffles++;
}
// Coverage and horizontal-open rule on a small custom arrangement.
const tiny = [{id:0,col:0,row:0,layer:0},{id:1,col:1,row:0,layer:0},{id:2,col:2,row:0,layer:0},{id:3,col:0,row:0,layer:1}];
assert.equal(rules.freeTile(tiny[0], tiny, new Set()), false, 'lower tile covered');
assert.equal(rules.freeTile(tiny[1], tiny, new Set()), false, 'middle tile has two neighbors');
assert.equal(rules.freeTile(tiny[2], tiny, new Set()), true, 'edge tile open');
assert.equal(rules.freeTile(tiny[3], tiny, new Set()), true, 'topmost tile open');
assert.equal(rules.freeTile(tiny[0], tiny, new Set([3])), true, 'uncovered side tile open');
assert.equal(rules.takePair({tiles:tiny, symbols:[0,1,2,3]},new Set(),2,3),null,'mismatched symbols rejected');
const ids = games.map(g => g.id);
assert.deepEqual(ids,['coloring','memory','maze','nuts','arrows','hexmerge','mahjong']);
assert.equal(new Set(ids).size,7);
for (const game of games) {
  assert(fs.existsSync(path.join(root,game.link.split('?')[0])), game.id);
  assert(game.description.length > 30);
  if (game.id !== 'coloring') assert(game.levels.length >= 3);
  for (const level of game.levels) {
    assert(fs.existsSync(path.join(root,level.link.split('?')[0])),level.link);
    assert(level.link.includes('?level='), 'level shortcuts deep-link correctly');
  }
}
for (const file of ['index.html','games/mahjong/index.html']) {
  const html = fs.readFileSync(path.join(root,file),'utf8');
  for (const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    const rel = match[1].split('?')[0]; if (/^(https?:|data:)/.test(rel)) continue;
    assert(fs.existsSync(path.resolve(root,path.dirname(file),rel)), `broken link: ${file}: ${rel}`);
    assert(!rel.startsWith('/'), 'no absolute path on Pages');
  }
}
const homepage = fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(homepage.includes('featuredReroll') && homepage.includes('levelGallery'));
console.log(`PASS Mahjong: ${layouts} solvable layouts, ${moves} paired moves, ${shuffles} shuffles to victory`);
console.log('PASS catalog: 7 games, correct deep links, all assets Pages-relative');
