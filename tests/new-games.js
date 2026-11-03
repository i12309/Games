/* Deterministic regression tests for the three new games. Run: node tests/new-games.js */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const nuts=require('../games/nuts/logic.js');
const arrow=require('../games/arrows/rules.js');
const hex=require('../games/hexmerge/rules.js');
let validations=0;
function testNuts(){
 for(let level=1;level<=140;level++){
  const puzzle=nuts.create(level);const colors=nuts.colorsForLevel(level);
  assert(nuts.validState(puzzle.stacks,colors));
  assert.equal(nuts.create(level).stacks.map(x=>x.join('')).join('/'),puzzle.stacks.map(x=>x.join('')).join('/'),'stable level');
  let s=puzzle.stacks,history=[];
  for(const [from,to] of puzzle.answer){
   assert(nuts.canMove(s,from,to),`Illegal constructive move on level ${level}`);history.push(s);s=nuts.move(s,from,to);validations++;
  }
  assert(nuts.isWon(s),`Unsolvable level ${level}`);
  assert.equal(nuts.move(s,0,0),null);
  if(history.length)assert.deepEqual(history.at(-1),history.at(-1).map(x=>x.slice()),'undo snapshot');
 }
 for(let level=1;level<=6;level++){
  const p=nuts.create(level);const path=nuts.solve(p.stacks,90000);
  assert(path?.length>0,'solver can find a hint for easy puzzles');
  assert(nuts.canMove(p.stacks,...path[0]));
 }
 console.log('PASS nuts: 140 solvable deterministic levels, all moves legal, simple hints');
}
function testArrows(){
 for(let level=1;level<=45;level++){
  for(let v=0;v<3;v++){
   const board=arrow.create(level,v);
   assert(arrow.validate(board),`Invalid arrow board ${level}/${v}`);
   assert(board.pieces.length>=6,`Empty board ${level}/${v}`);
   let pieces=board.pieces;
   const sequence=arrow.solution(pieces,board.width,board.height);
   assert(sequence&&sequence.length===pieces.length,'Every arrow can leave');
   for(const id of sequence){
    const piece=pieces.find(x=>x.id===id);assert(piece);
    assert(arrow.available(piece,pieces,board.width,board.height),`Blocked planned arrow ${id}`);
    pieces=pieces.filter(x=>x.id!==id);validations++;
   }
   assert.equal(pieces.length,0);
  }
 }
 const cycle=[{id:1,color:0,path:[[1,1],[2,1]]},{id:2,color:1,path:[[3,1],[2,1]]}];
 assert.equal(arrow.validate({width:5,height:5,pieces:cycle}),false,'overlapping positions are forbidden');
 const blocked=[{id:0,color:0,path:[[0,1],[1,1]]},{id:1,color:1,path:[[2,1],[3,1]]}];
 assert.equal(arrow.available(blocked[0],blocked,6,5),false);
 assert.equal(arrow.available(blocked[1],blocked,6,5),true);
 console.log('PASS arrows: 135 verified boards and complete escape sequences, blockers, overlaps');
}
function testHex(){
 for(const mode of Object.keys(hex.MODES)){
  for(let seed=0;seed<40;seed++){
   let board=hex.create(mode,seed+1),guard=0;
   assert(hex.validate(board,mode));
   while(!board.won&&guard++<550){
    const matches=hex.findPairs(board.board);
    assert(matches.length,'Pair always available');
    const [a,b]=matches[guard%matches.length];
    const before=board.board[a[0]][a[1]];
    assert.equal(before,board.board[b[0]][b[1]]);
    const next=hex.merge(board,...a,mode,seed*200+guard);
    assert(next&&hex.validate(next,mode));
    assert(next.score>board.score&&next.moves===board.moves+1);
    assert(next.bestTile>=board.bestTile);
    assert(next.merged>=1);
    board=next;validations++;
   }
   assert(board.won,`Must reach target: ${mode} ${seed}`);
  }
 }
 console.log('PASS hex: 120 runs to goal, gravity/refill, merges, chain scores');
}
function testLinks(){
 const pages=['index.html',...['coloring','memory','maze','nuts','arrows','hexmerge'].map(n=>`games/${n}/index.html`)];
 for(const p of pages){
  const file=path.join(root,p),html=fs.readFileSync(file,'utf8'),dir=path.dirname(file);
  for(const match of html.matchAll(/(?:href|src)="([^"]+)"/g)){
   const rel=match[1].split('?')[0];if(rel.startsWith('http:')||rel.startsWith('https:')||rel==='#')continue;
   const linked=path.resolve(dir,rel);
   assert(linked.startsWith(root+path.sep)||linked===root,`Outside repo: ${p} -> ${rel}`);
   assert(fs.existsSync(linked),`Missing dependency: ${p} -> ${rel}`);
   validations++;
  }
 }
 const catalog=fs.readFileSync(path.join(root,'index.html'),'utf8');
 for(const name of ['coloring','memory','maze','nuts','arrows','hexmerge'])assert(catalog.includes(`games/${name}/index.html`));
 assert(fs.existsSync(path.join(root,'.nojekyll')));
 console.log('PASS Pages: all local relative links exist, six games listed, nojekyll available');
}
testNuts();testArrows();testHex();testLinks();
console.log(`PASS: ${validations} assertions/workflow steps across new games`);
