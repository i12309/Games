"""Browser checks; real HTTP by default, existing offline fixture when requested. Requires playwright and Chromium.
Run: python tests/coloring-library-browser.py
Set CHROMIUM_PATH when Chromium is elsewhere. In restricted sandboxes set COLORING_OFFLINE=1.
Offline mode inlines the exact assets and uses simulated storage/query parameters.
"""
import functools
import http.server
import json
import os
from pathlib import Path
import tempfile
import sys
import threading
from playwright.sync_api import sync_playwright
from urllib.parse import urlparse
from browser_fixture import html_for

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('COLORING_SCREENSHOTS', '/tmp/coloring-previews'))
OUT.mkdir(parents=True, exist_ok=True)

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

with tempfile.TemporaryDirectory() as site:
    Path(site, 'Games').symlink_to(ROOT, target_is_directory=True)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=site))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{server.server_port}/Games/'
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
        ctx = browser.new_context(viewport={'width':1280,'height':960}, has_touch=True)
        ctx.set_default_timeout(4000)
        page = ctx.new_page()
        errors=[]
        page.on('pageerror', lambda e: errors.append(str(e)))
        def navigate(url):
            global page
            if os.environ.get('COLORING_OFFLINE')!='1':
                page.goto(url)
                return
            viewport=page.viewport_size
            store=page.evaluate("() => {window.dispatchEvent(new Event('pagehide'));return window.__fixtureStorage||{};}")
            page.close()
            page=ctx.new_page()
            page.set_viewport_size(viewport)
            page.on('pageerror',lambda e:errors.append(str(e)))
            parsed=urlparse(url)
            file=parsed.path.removeprefix('/Games/') or 'index.html'
            page.set_content(html_for(file,('?'+parsed.query) if parsed.query else '',store),wait_until='load')
        navigate(base+'games/coloring/gallery.html')
        assert page.locator('.picture-card').count()==48
        assert page.evaluate('''()=>[...document.querySelectorAll('.picture-preview canvas')].every(c=>{const r=c.getBoundingClientRect(),p=c.parentElement.getBoundingClientRect();return r.top>=p.top && r.bottom<=p.bottom+1;})''')
        page.select_option('#artDifficulty','master')
        assert page.locator('.picture-card').count()==4
        page.screenshot(path=str(OUT/'gallery-master-1280.png'),full_page=True)
        page.click('#clearFilters')
        page.fill('#artSearch','единорог')
        assert page.locator('.picture-card').count()==1
        page.click('#clearFilters')
        for difficulty,count in [('easy',8),('medium',13),('hard',15),('expert',8),('master',4)]:
            page.select_option('#artDifficulty',difficulty)
            assert page.locator('.picture-card').count()==count,(difficulty,count)
        page.click('#clearFilters')
        page.screenshot(path=str(OUT/'gallery-all-1280.png'),full_page=True)
        # Validate every deep link, palette and last-cell completion through actual UI logic.
        levels=page.evaluate('window.PIXEL_LEVELS.map(l=>({id:l.id,colors:Object.keys(l.palette).length,rows:l.rows}))')
        if os.environ.get('COLORING_SKIP_DEEP')=='1': levels=[]
        levels=levels[int(os.environ.get('COLORING_START',0)):int(os.environ.get('COLORING_END',48))]
        for number,level in enumerate(levels,1):
            print("Checking",number,level["id"],flush=True)
            cells=''.join(level['rows']);last=max(i for i,c in enumerate(cells) if c!='.')
            saved=[1 if c!='.' and i!=last else 0 for i,c in enumerate(cells)]
            page.evaluate('([id,values])=>localStorage.setItem("igroland-pixel-paint-v1:progress:"+id,JSON.stringify(values))',[level['id'],saved])
            navigate(base+'games/coloring/index.html?level='+level['id'])
            assert page.locator('.color-button').count()==level['colors']
            page.evaluate('''({rows,last})=>{
              const canvas=document.getElementById('paintCanvas'),r=canvas.getBoundingClientRect();
              const w=rows[0].length,h=rows.length,s=Math.max(1,Math.min((r.width-36)/w,(r.height-36)/h,43));
              const x=r.left+(r.width-w*s)/2+(last%w+.5)*s,y=r.top+(r.height-h*s)/2+(Math.floor(last/w)+.5)*s;
              canvas.dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,pointerType:'mouse',button:0,clientX:x,clientY:y,bubbles:true}));
              canvas.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,pointerType:'mouse',button:0,clientX:x,clientY:y,bubbles:true}));
            }''',{'rows':level['rows'],'last':last})
            page.wait_for_function("document.getElementById('progressPercent').textContent==='100%'")
            assert page.locator('#completeBanner').is_visible(),level['id']
            page.click('#undoButton')
            assert page.locator('#completeBanner').is_hidden()
        if os.environ.get('COLORING_TEST_MODE')=='links':
            assert not errors,errors
            print('PASS',len(levels),'deep links: palette, last cell, victory and undo',flush=True)
            browser.close();server.shutdown();sys.exit(0)
        # Clear only this test context's state; test natural colouring and storage.
        page.evaluate('localStorage.clear()')
        navigate(base+'games/coloring/index.html?level=more-coral-reef')
        page.evaluate("localStorage.setItem('igroland.memory.sentinel','keep');localStorage.setItem('igroland-pixel-paint-v1:progress:heart','[1,0]')")
        # Complete all ~6,000 cells, then undo all; exercises counters and >5,000 history.
        counts=page.evaluate('''()=>{
          const l=window.PIXEL_LEVELS.find(l=>l.id==='more-coral-reef'),keys=Object.keys(l.palette);
          const canvas=document.getElementById('paintCanvas'),r=canvas.getBoundingClientRect(),w=l.rows[0].length,h=l.rows.length,s=Math.min((r.width-36)/w,(r.height-36)/h,43);
          let count=0;
          keys.forEach((key,color)=>{
            document.querySelector(`[data-color="${color}"]`).click();
            l.rows.forEach((row,y)=>[...row].forEach((ch,x)=>{if(ch!==key)return;count++;
              const clientX=r.left+(r.width-w*s)/2+(x+.5)*s,clientY=r.top+(r.height-h*s)/2+(y+.5)*s;
              canvas.dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,pointerType:'mouse',button:0,clientX,clientY,bubbles:true}));
              canvas.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,pointerType:'mouse',button:0,clientX,clientY,bubbles:true}));
            }));
          });return count;
        }''')
        page.wait_for_function("document.getElementById('progressPercent').textContent==='100%'")
        page.evaluate('(n)=>{for(let i=0;i<n;i++)document.getElementById("undoButton").click();}',counts)
        assert page.locator('#progressPercent').inner_text()=='0%'
        assert page.locator('#undoButton').is_disabled()
        assert page.evaluate("localStorage.getItem('igroland.memory.sentinel')")=='keep'
        assert page.evaluate("localStorage.getItem('igroland-pixel-paint-v1:progress:heart')")=='[1,0]'
        # Screen sizes, readable zoom, preview, reload and Pages path prefix.
        for width,height in [(390,844),(768,1024),(1280,960)]:
            page.set_viewport_size({'width':width,'height':height})
            navigate(base+'games/coloring/index.html?level=more-fairy-forest')
            page.click('#zoomReadable')
            zoom=int(page.locator('#zoomValue').inner_text().rstrip('%'))
            assert zoom>100
            if width==390:assert zoom>700
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            page.screenshot(path=str(OUT/f'painting-{width}.png'),full_page=True)
            page.click('#zoomFit');page.click('#showPreview')
            page.screenshot(path=str(OUT/f'preview-{width}.png'),full_page=True)
            navigate(base+'games/coloring/gallery.html?difficulty=master')
            assert page.locator('.picture-card').count()==4
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        navigate(base)
        assert page.evaluate('window.PIXEL_LEVELS.length')==48
        assert page.locator('#gameCards>a').count()==16
        navigate(base+'index.html?section=learn')
        assert page.locator('#gameCards>a').count()==7
        navigate(base+'index.html?section=play')
        assert page.locator('#gameCards>a').count()==9
        assert not errors,errors
        print(json.dumps({'status':'PASS','fixture':'offline' if os.environ.get('COLORING_OFFLINE')=='1' else 'HTTP','deep_links_to_victory':len(levels),'full_large_picture_cells_and_undo':counts,'viewports':[390,768,1280],'errors':errors,'screenshots':str(OUT)},ensure_ascii=False))
        browser.close()
    server.shutdown()
