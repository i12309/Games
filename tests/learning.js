'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const C=require('../shared/learning-core.js');
const math=require('../games/number-garden/rules.js');
const read=require('../games/reading-stories/rules.js');
const logic=require('../games/logic-lab/rules.js');
const robot=require('../games/robot-route/rules.js');
const registry=require('../assets/learning-registry.js');
let mathCases=0,readingCases=0,logicCases=0,robotCases=0;
for(const level of math.levels)for(let seed=0;seed<300;seed++)for(let step=0;step<5;step++){
  const t=math.generate(level.id,seed,step);assert.deepEqual(t,math.generate(level.id,seed,step));
  const expected=t.kind==='count'?t.a:t.kind==='compare'?(t.a<t.b?'<':t.a>t.b?'>':'='):t.kind==='parts'?t.b:t.kind==='subtract'?t.a-t.b:t.a+t.b;
  assert.equal(t.result,expected);assert.equal(t.choices.filter(x=>x===expected).length,1);assert.equal(new Set(t.choices).size,t.choices.length);
  assert(t.a>=0&&t.b>=0&&t.a<=t.max&&t.b<=t.max);
  if(t.kind!=='compare'){assert(Number.isInteger(t.result)&&t.result>=0&&t.result<=t.max);assert(t.choices.every(n=>Number.isInteger(n)&&n>=0&&n<=t.max));}
  if(level.id==='twenty')assert(t.result>10&&t.result<=18);
  if(t.kind==='subtract')assert(t.b<=t.a);
  if(t.kind==='parts')assert(t.a+t.b<=10);
  mathCases++;
}
assert.equal(read.stories.length,12);assert.equal(new Set(read.stories.map(s=>s.id)).size,12);
for(const story of read.stories){
  assert(story.lines.length>=2&&story.lines.length<=3);
  for(const line of story.lines){assert(RU(line));assert(!read.plain(line).includes('/'));for(const word of line.split(' ')){if(!word.includes('/'))continue;for(const syllable of word.split('/'))assert.equal((syllable.match(/[аеёиоуыэюя]/gi)||[]).length,1,`syllable: ${syllable} in ${word}`);}}
  for(const f of story.facts){assert(f[2]>=0&&f[2]<f[1].length);assert(f[3]>=0&&f[3]<story.lines.length);assert.equal(new Set(f[1]).size,3);}
}
function RU(s){return /[А-Яа-яЁё]/.test(s)&&s.endsWith('.');}
for(const level of read.levels)for(let seed=0;seed<24;seed++)for(let i=0;i<6;i++){
  const t=read.generate(level.id,seed,i);assert.equal(t.story.level,level.id);assert.equal(t.choices.filter(x=>x.correct).length,1);
  if(t.kind==='assemble'){const right=t.expected.map((_,j)=>j);assert(read.ordered(t,right));assert(!read.ordered(t,[]));assert(!read.ordered(t,[...right,right[0]]));assert(!read.ordered(t,right.map(()=>0)));assert.equal(new Set(t.bank.map(x=>x.id)).size,t.expected.length);}
  readingCases++;
}
for(const level of logic.levels)for(let seed=0;seed<150;seed++)for(let i=0;i<5;i++){
  const t=logic.generate(level.id,seed,i);
  if(t.kind==='patterns'){assert.equal(t.answer,t.pattern[t.row.length%t.pattern.length].icon);assert(t.row.every((s,j)=>s.icon===t.pattern[j%t.pattern.length].icon));assert.equal(t.choices.filter(x=>x.icon===t.answer).length,1);}
  else if(t.kind==='sorting'){const odd=t.items[t.answer];assert.equal(t.items.filter(x=>x.icon===odd.icon).length,1);assert.equal(new Set(t.items.filter(x=>x.id!==t.answer).map(x=>x.icon)).size,1);}
  else{assert(logic.ordered(t,t.sequence.steps.map((_,j)=>j)));assert(!logic.ordered(t,[1,0,2,3]));assert.equal(new Set(t.bank.map(x=>x.id)).size,t.bank.length);}
  logicCases++;
}
for(const level of robot.levels)for(let seed=0;seed<160;seed++)for(let i=0;i<5;i++){
  const t=robot.generate(level.id,seed,i);assert.deepEqual(t,robot.generate(level.id,seed,i));assert(t.solution.length>0&&t.solution.length<=18);
  const r=robot.simulate(t,t.solution);assert(r.ok);assert.equal(r.trace.length,t.solution.length+1);assert(robot.equal(r.trace.at(-1),t.goal));assert(r.trace.at(-1).got);
  assert.equal(new Set(t.walls.map(p=>`${p.x},${p.y}`)).size,t.walls.length);assert(!t.walls.some(p=>robot.equal(p,t.start)||robot.equal(p,t.goal)||t.pickup&&robot.equal(p,t.pickup)));
  assert(!robot.simulate(t,['D']).ok);assert(!robot.simulate(t,['INVALID']).ok);assert(!robot.simulate(t,Array(31).fill('R')).ok);robotCases++;
}
const delivery={size:3,start:{x:0,y:2},goal:{x:2,y:2},pickup:{x:0,y:0},walls:[]};assert(!robot.simulate(delivery,['R','R']).ok);assert(robot.simulate(delivery,['U','U','D','D','R','R']).ok);
const state=C.initial(52);assert(!C.advance(state,5));C.answer(state,false);state.aided=true;C.answer(state,true);assert(!C.answer(state,true));assert(C.advance(state,5));assert.deepEqual(state.results,[{independent:false,wrong:1}]);
assert.deepEqual(C.restore(state,99,5),state);
for(const bad of [null,[],{}, {seed:5,index:2,results:[]}, {...state,index:99},{...state,wrong:NaN},{...state,results:[{independent:'yes',wrong:0}]}])assert.equal(C.restore(bad,99,5).seed,99);
const independent=C.initial(1);for(let n=0;n<5;n++){C.answer(independent,true);C.advance(independent,5);}assert.equal(independent.results.filter(r=>r.independent).length,5);assert(!C.advance(independent,5));
const root=path.resolve(__dirname,'..');assert.equal(registry.length,4);assert.equal(new Set(registry.map(g=>g.id)).size,4);
const rules={'number-garden':math,'reading-stories':read,'logic-lab':logic,'robot-route':robot};
for(const game of registry){assert(game.educational);const ids=rules[game.id].levels.map(x=>x.id);assert.equal(game.levels.length,ids.length);for(const l of game.levels){const u=new URL(l.link,'https://example.test/Games/');assert(u.pathname.startsWith('/Games/games/'));assert(ids.includes(u.searchParams.get('level')));assert(fs.existsSync(path.join(root,l.link.split('?')[0])));}
 const page=`games/${game.id}/index.html`,html=fs.readFileSync(path.join(root,page),'utf8');for(const m of html.matchAll(/(?:href|src)="([^"#]+)"/g)){const rel=m[1].split('?')[0];assert(!rel.startsWith('/'));assert(fs.existsSync(path.resolve(root,path.dirname(page),rel)),rel);}
}
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');assert(home.indexOf('assets/learning-home.js')<home.indexOf('assets/catalog.js'));assert(home.includes('data-catalog-section="learn"'));
// Existing game registry remains separate; composition must neither mutate it nor duplicate entries.
const vm=require('node:vm');
for(const [section,expected] of [['',12],['learn',4],['play',8],['invalid',12]]){
 const elements=new Map(),node=id=>{if(!elements.has(id))elements.set(id,{textContent:''});return elements.get(id);};
 const play=Object.freeze(['coloring','memory','maze','nuts','arrows','hexmerge','mahjong','marble-shooter'].map(id=>Object.freeze({id})));
 const callbacks=[];const ctx={URLSearchParams,location:{search:'?section='+section},window:{IGROLAND_GAME_REGISTRY:play,IGROLAND_LEARNING_REGISTRY:registry},document:{body:{dataset:{},classList:{add(){}}},addEventListener:(name,fn)=>callbacks.push(fn),querySelectorAll:()=>[],querySelector:node,getElementById:node}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'assets/learning-home.js'),'utf8'),ctx);
 assert.equal(ctx.window.IGROLAND_GAME_REGISTRY.length,expected);assert.equal(ctx.window.IGROLAND_ALL_GAMES.length,12);assert.equal(new Set(ctx.window.IGROLAND_ALL_GAMES.map(g=>g.id)).size,12);assert.equal(play.length,8);callbacks.forEach(fn=>fn());
}
console.log(`PASS learning: ${mathCases} arithmetic cases; ${readingCases} reading variants; ${logicCases} logic cases; ${robotCases} solved robot maps.`);
console.log('PASS: authored syllable structure, invalid save recovery, independent/assisted results, catalog filters, 16 topic links and Pages-relative assets.');
