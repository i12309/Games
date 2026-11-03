(() => {
  'use strict';
  const gallery = document.querySelector('#artGallery');
  const levels = window.PIXEL_LEVELS || [];
  const difficulty = {easy:'Легко',medium:'Средне',hard:'Посложнее'};

  function drawPreview(canvas, level, px = 8) {
    const rows = level.rows;
    const w = rows[0].length, h = rows.length;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const sizeW = canvas.clientWidth || 120;
    const sizeH = canvas.clientHeight || 120;
    canvas.width = Math.floor(sizeW*dpr);
    canvas.height = Math.floor(sizeH*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,sizeW,sizeH);
    const cell = Math.min((sizeW-18)/w,(sizeH-18)/h,px);
    const x0 = (sizeW-w*cell)/2, y0 = (sizeH-h*cell)/2;
    rows.forEach((row,y)=>[...row].forEach((key,x)=>{
      if (key !== '.') {ctx.fillStyle=level.palette[key];ctx.fillRect(x0+x*cell,y0+y*cell,Math.ceil(cell),Math.ceil(cell));}
    }));
  }

  levels.forEach(level => {
    const a = document.createElement('a');
    a.className='art-tile';
    a.href='games/coloring/index.html?level='+encodeURIComponent(level.id);
    const art = document.createElement('div'); art.className='art-tile-image';
    const canvas=document.createElement('canvas'); canvas.setAttribute('aria-hidden','true'); art.appendChild(canvas);
    const body=document.createElement('div'); body.className='art-tile-body';
    const title=document.createElement('strong');title.textContent=level.title;
    const badge=document.createElement('span');badge.className='difficulty '+level.difficulty;badge.textContent=difficulty[level.difficulty];
    body.append(title,badge); a.append(art,body); gallery.append(a);
    requestAnimationFrame(()=>drawPreview(canvas,level));
  });
  window.addEventListener('resize',()=>{
    [...gallery.children].forEach((tile,i)=>drawPreview(tile.querySelector('canvas'),levels[i]));
  });
})();
