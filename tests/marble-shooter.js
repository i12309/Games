/* Run: node tests/marble-shooter.js — deterministic logic & progression tests for a new eighth game. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const L=require('../games/marble-shooter/levels.js');
const E=require('../games/marble-shooter/engine.js');
const root=path.resolve(__dirname,'..');
let layouts=0,solutions=0,shots=0;
assert.equal(L.LEVELS.length,10);
assert.equal(new Set(L.LEVELS.map(l=>l.id)).size,10);
assert.equal(L.levelById('5').title,'Тайная тропа');
assert.equal(L.levelById(999),null);
assert.equal(E.segmentCircle(0,0,10,0,5,0,2),.3);
assert.equal(E.segmentCircle(0,0,10,0,5,10,2),null);
assert.equal(E.segmentCircle(0,0,0,0,0,0,2),0);
assert.equal(E.segmentCircle(0,0,10,0,0,0,1),0);
assert.equal(E.segmentCircle(0,0,10,0,100,0,1),null);
for(const lev of L.LEVELS) {
  for(const [w,h] of [[960,680],[600,820]]) {
    const track=L.buildPath(lev,w,h);
    assert(track.length>1700&&track.length<4300);
    assert(track.samples.length>140);
    for(let i=1;i<track.samples.length;i++) {
      assert(track.samples[i].s>track.samples[i-1].s,'monotone arc length');
      assert(track.samples[i].x>=0&&track.samples[i].x<=w);
      assert(track.samples[i].y>=0&&track.samples[i].y<=h);
    }
    for(let i=0;i<=100;i++){
      const p=track.at(track.length*i/100);
      assert(Math.abs(Math.hypot(p.tx,p.ty)-1)<.05);
    }
    const minimum=Math.min(...track.samples.map(p=>Math.hypot(p.x-w*.51,p.y-h*.54)));
    assert(minimum>65,`track too near center ${lev.id} ${minimum}`);
  }
  for(const mode of Object.keys(L.MODES)) {
    for(let seed=1;seed<=100;seed++){
      const g=new E.Game(lev,mode,seed);
      const g2=new E.Game(lev,mode,seed);
      assert.deepEqual(g.chain,g2.chain,'deterministic layouts');
      assert.equal(g.chain.length,lev.groups*2);
      for(let i=0;i<g.chain.length;i+=2){
        assert.equal(g.chain[i].color,g.chain[i+1].color,'pairs');
        if(i>=2)assert.notEqual(g.chain[i].color,g.chain[i-2].color,'no adjacent equal groups');
      }
      // Directly inject the correctly colored marble into every 2-color group.
      let iterations=0;
      while(g.chain.length&&iterations++<lev.groups+2){
        const index=g.chain.length-1,color=g.chain[index].color,count=g.chain.length;
        g.projectile={color};
        assert(g.removeAt(index,false,1));
        assert(g.chain.length<=count-2,'matching removes at least one group');
        solutions++;
      }
      assert.equal(g.chain.length,0);
      assert.equal(g.status,'won');
      layouts++;
    }
  }
}
let base=new E.Game(L.LEVELS[0],'normal',345);
const firstColor=base.chain.at(-1).color,front=base.position(base.chain.length-1);
assert(base.fire(front.x,front.y));
assert.equal(base.shots,1);
assert.equal(base.fire(front.x,front.y),false,'only one projectile at a time');
for(let i=0;i<1000 && base.projectile;i++)base.update(.016);
assert.equal(base.projectile,null);
assert(base.chain.length<=base.level.groups*2+1);
assert.equal(base.undo(),true);
assert.equal(base.chain.length,base.level.groups*2);
assert.equal(base.shots,0);
assert.equal(base.current,firstColor);
assert.equal(base.undo(),false);
assert(base.swap());assert.equal(base.current,base.next,'first two ammo both front color');
assert(base.fire(front.x,front.y));for(let i=0;i<1000&&base.projectile;i++)base.update(.016);
const snapshot=base.snapshot();
const resumed=new E.Game(base.level,base.mode,345);
assert(resumed.restore(snapshot));assert.equal(resumed.score,base.score);
assert.equal(resumed.chain.length,base.chain.length);
assert.equal(resumed.shots,base.shots);
assert(!new E.Game(base.level,'kid',345).restore(snapshot),'mode changes must not restore incompatible session');
assert(!resumed.restore({...snapshot,chain:Array(999).fill({color:0,id:1})}),'huge/corrupt state');
assert(!resumed.restore({...snapshot,score:Infinity}));
assert(!resumed.restore({...snapshot,headS:-1}));
assert(!resumed.restore({...snapshot,current:999}));
const before=resumed.headS;resumed.status='paused';resumed.update(1);assert.equal(resumed.headS,before);
resumed.status='playing';resumed.charges={freeze:1,bomb:1,reverse:1};
assert(resumed.activate('freeze'));assert(resumed.freezeTime>0);
const chilled=resumed.headS;resumed.update(.05);assert(resumed.headS-chilled<resumed.speed*.04);
assert(resumed.activate('reverse'));assert(resumed.headS<=chilled);
assert(resumed.activate('bomb'));assert.equal(resumed.armedBomb,true);
const target=resumed.position(resumed.chain.length-1);
assert(resumed.fire(target.x,target.y));assert.equal(resumed.projectile.bomb,true);
for(let i=0;i<1200&&resumed.projectile;i++)resumed.update(.016);
assert.equal(resumed.projectile,null);
assert.equal(resumed.armedBomb,false);
assert.equal(resumed.charges.bomb,0);
const insertion=[{color:1,id:1},{color:1,id:2},{color:2,id:3},{color:1,id:4},{color:1,id:5}];
// Three-of-a-kind removal exposes another adjacent run, with no global deletion of unrelated pairs.
assert.equal(E.takeMatches(insertion,2).length,0);
assert.equal(E.takeMatches([{color:1},{color:1},{color:1},{color:2}],1)[0].count,3);
const cascade=[{color:1},{color:1},{color:2},{color:2},{color:2},{color:1},{color:1}];
assert.deepEqual(E.takeMatches(cascade,3).map(m=>m.count),[3,4],'chain-reaction groups collapse');
assert.equal(cascade.length,0);
// All pages assets are local and relative, suitable for GitHub Pages /Games/.
for(const file of ['games/marble-shooter/index.html']){
  const html=fs.readFileSync(path.join(root,file),'utf8');
  for(const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)){
    const dest=match[1].split('?')[0];
    assert(!dest.startsWith('/'),`absolute link ${dest}`);
    if(dest.startsWith('../../'))continue; // existing shared project files, verified in the repo
    assert(fs.existsSync(path.resolve(root,path.dirname(file),dest)),`missing ${dest}`);
  }
}
for(const js of ['levels.js','engine.js','renderer.js','game.js'])assert(fs.existsSync(path.join(root,'games/marble-shooter',js)));
console.log(`PASS marble shooter: ${layouts} deterministic configurations; ${solutions} constructive matches; collision, projectile, snapshot, undo, bonuses`);
