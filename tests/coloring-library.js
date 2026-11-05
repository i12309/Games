/* Run: node tests/coloring-library.js */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'games/coloring');
const packs=fs.readdirSync(path.join(dir,'packs')).filter(f=>f.endsWith('.js')).sort();
function load(){const ctx={window:{}};vm.createContext(ctx);for(const file of ['art-data.js','pixel-art.js',...packs.map(f=>'packs/'+f)])vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'),ctx,{filename:file});return JSON.parse(JSON.stringify(ctx.window.PIXEL_LEVELS));}
const levels=load();assert.deepEqual(levels,load(),'fixed drawings must reproduce exactly');
assert.equal(levels.length,48);assert.equal(new Set(levels.map(l=>l.id)).size,48);
const original=fs.readFileSync(path.join(dir,'art-data.js'));
assert.equal(crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+original.length+'\0'),original])).digest('hex'),'3b0c84b6a68b4371ff9080ac5a74b8cf16cdfa26','never alter the original eight saved patterns');
const added=levels.filter(l=>l.id.startsWith('more-'));assert.equal(added.length,40);assert.equal(packs.length,8);
const expected={easy:6,medium:10,hard:12,expert:8,master:4};
for(const [difficulty,count] of Object.entries(expected))assert.equal(added.filter(l=>l.difficulty===difficulty).length,count);
let active=0,largest=0;const shapes=new Set();
for(const level of levels){
  assert(/^[a-z0-9-]+$/.test(level.id));assert(level.title.length>2);
  const w=level.rows[0].length,h=level.rows.length;assert(w<=80&&h<=80);assert(w>0&&h>0);
  const used=new Set();let count=0;
  for(const row of level.rows){assert.equal(row.length,w,level.id);for(const key of row){if(key==='.')continue;assert(level.palette[key],`${level.id}: missing ${key}`);assert(/^#[0-9a-f]{6}$/i.test(level.palette[key]));used.add(key);count++;}}
  assert(count>0);if(level.id.startsWith('more-'))assert.equal(used.size,Object.keys(level.palette).length,'no empty paints');
  if(level.difficulty==='master'){assert.equal(w,80);assert.equal(h,80);assert(count>=5800);assert(used.size>=14);}
  const signature=JSON.stringify([level.palette,level.rows]);assert(!shapes.has(signature),'duplicate art');shapes.add(signature);active+=count;largest=Math.max(largest,count);
}
for(const file of ['index.html','games/coloring/index.html','games/coloring/gallery.html']){
 const html=fs.readFileSync(path.join(root,file),'utf8');
 for(const m of html.matchAll(/(?:href|src)="([^"#]+)"/g)){
  const url=m[1].split('?')[0];if(/^(https?:|data:)/.test(url))continue;
  assert(!url.startsWith('/'),'Pages requires relative links');assert(fs.existsSync(path.resolve(root,path.dirname(file),url)),`${file}: ${url}`);
 }
 const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
 const stem=file==='index.html'?'games/coloring/':'';
 assert(scripts.indexOf(stem+'art-data.js')<scripts.indexOf(stem+'pixel-art.js'));
 for(const pack of packs)assert(scripts.includes(stem+'packs/'+pack));
 assert(scripts.indexOf(stem+'packs/'+packs.at(-1))<scripts.length-1,'data before page code');
}
console.log(`PASS coloring library: 40 new + 8 unchanged; ${active} paintable cells; largest ${largest}; all five difficulty tiers, palettes, reproducibility and Pages links.`);
