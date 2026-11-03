"""Offline Chromium tests. Assets are inlined; storage and query are test doubles.
Run: CHROMIUM=/usr/bin/chromium python tests/adventures-browser.py [group]
Groups: shop1, shop2, post, shapes1, shapes2, shapes3, editor, physics, shelf, layouts.
"""
import os,json,sys
from playwright.sync_api import sync_playwright
from browser_fixture import load

def stored(page): return page.evaluate('window.__fixtureStorage')
def clean(page): assert not page.errors,page.errors
def touch(page,selector,x,y):
    node=page.locator(selector);node.scroll_into_view_if_needed();box=node.bounding_box()
    node.tap(position={'x':x*box['width']/640,'y':y*box['height']/480})
def lesson_state(page,slug):return page.evaluate('(s)=>Igroland.read("learning."+s+".v1")',slug)

def lessons(context,slug,levels):
    for level in levels:
        page=load(context,f'games/{slug}/index.html','?level='+level);page.locator('.learn-next').click()
        for i in range(5):
            data=lesson_state(page,slug)['topics'][level]['session']
            task=page.evaluate('(v)=>window[v.r].generate(v.level,v.seed,v.index)',{'r':'ShopRules' if slug=='forest-shop' else 'PostRules','level':level,'seed':data['seed'],'index':data['index']})
            if i==0:page.get_by_role('button',name='Подсказка',exact=True).click()
            if slug=='forest-shop':
                if i==0:
                    if level=='budget':page.get_by_role('button',name='Хватит',exact=True).click()
                    else:page.locator('.shop-check').click()
                    assert not lesson_state(page,slug)['topics'][level]['session']['done']
                for item in task['order']:page.locator(f'[data-product="{item}"]').click()
                if level not in ['count','budget']:
                    for _ in range(task['answer']):page.get_by_role('button',name='+ 1',exact=True).click()
                if level=='budget':page.get_by_role('button',name='Хватит' if task['answer'] else 'Не хватит',exact=True).click()
                else:page.locator('.shop-check').click()
            else:
                if i==0:
                    assert page.locator('.post-letter .highlight').count()>=1
                    page.locator(f'[data-house="{(task["target"]+1)%6}"]').tap()
                    assert not lesson_state(page,slug)['topics'][level]['session']['done']
                    page.get_by_role('button',name='Подсветить слоги',exact=True).click()
                page.locator(f'[data-house="{task["target"]}"]').tap()
            assert lesson_state(page,slug)['topics'][level]['session']['done'];page.locator('.learn-next').click()
        assert page.get_by_role('heading',name='Занятие завершено').count()==1
        assert lesson_state(page,slug)['history'][-1]['independent']==4
        data=stored(page);clean(page);page.close()
        again=load(context,f'games/{slug}/index.html','?level='+level,data)
        assert again.get_by_role('heading',name='Занятие завершено').count()==1;clean(again);again.close()
        print('PASS lesson',slug,level,'5 tasks, hints, incorrect response, assisted result, reload',flush=True)

def shapes(context,ids):
    page=load(context,'games/shape-studio/index.html')
    levels=page.evaluate('ShapeRules.LEVELS')
    for level in [l for l in levels if l['id'] in ids]:
        page.locator('#levelSelect').select_option(level['id'])
        for i,target in enumerate(level['targets']):
            page.locator(f'[data-select-piece="{i+1}"]').click()
            draft=page.evaluate('(id)=>Igroland.read("workshop.shape-studio.v1")[id].pieces',level['id'])
            piece=next(x for x in draft if x['id']==i+1)
            for _ in range(((target['rot']-piece['rot'])%360)//90):page.get_by_role('button',name='↷ Повернуть',exact=True).click()
            touch(page,'.ws-board svg',target['x'],target['y'])
        assert not page.locator('.ws-banner').is_hidden(),level['id']
        if level['id']=='garden':
            page.locator('#workName').fill('Зеркальный сад');page.get_by_role('button',name='Сохранить на полку',exact=True).click()
            assert page.evaluate('Workshop.entries()[0].data.pieces.length')==6
        print('PASS shape',level['id'],flush=True)
    clean(page);page.close()

def editor(context):
    page=load(context,'games/shape-studio/index.html','?level=free');page.locator('.ws-tools button').first.tap()
    touch(page,'.ws-board svg',240,200)
    initial=page.evaluate('Igroland.read("workshop.shape-studio.v1").free.pieces')
    page.get_by_role('button',name='↷ Повернуть',exact=True).click();page.get_by_role('button',name='↶ Отмена',exact=True).click()
    assert page.evaluate('Igroland.read("workshop.shape-studio.v1").free.pieces')==initial
    node=page.locator('.ws-board svg');node.scroll_into_view_if_needed();box=node.bounding_box();x=box['x']+240*box['width']/640;y=box['y']+200*box['height']/480
    session=context.new_cdp_session(page)
    session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+40,'y':y+30}]})
    session.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]})
    assert page.evaluate('Igroland.read("workshop.shape-studio.v1").free.pieces')==initial
    page.locator('#workName').fill('Моя фигура');page.get_by_role('button',name='Сохранить на полку',exact=True).click()
    work=page.evaluate('Workshop.entries()[0]');page.get_by_role('button',name='Сохранить на полку',exact=True).click();assert page.evaluate('Workshop.entries().length')==1
    data=stored(page);clean(page);page.close()
    again=load(context,'games/shape-studio/index.html','?work='+work['id'],data)
    assert again.locator('#workName').input_value()=='Моя фигура';assert again.locator('[data-select-piece]').count()==1
    again.evaluate('window.__failStorage=true');again.get_by_role('button',name='Сохранить на полку',exact=True).click()
    assert 'не разрешил' in again.locator('#gameMessage').inner_text();clean(again);again.close()
    print('PASS editor: touch placement, cancelled gesture, undo, save/update/reopen, denied storage',flush=True)

def physics(context):
    page=load(context,'games/marble-lab/index.html','?level=bridge')
    ref=page.evaluate('MarbleLab.solution(MarbleLab.byId("bridge"))[0]');touch(page,'.ws-board canvas',ref['x'],ref['y'])
    page.get_by_role('button',name='▶ Запустить',exact=True).click();page.wait_for_timeout(150)
    page.get_by_role('button',name='Пауза',exact=True).click();before=page.locator('canvas').evaluate('(c)=>c.toDataURL()');page.wait_for_timeout(150)
    assert before==page.locator('canvas').evaluate('(c)=>c.toDataURL()')
    page.get_by_role('button',name='Продолжить',exact=True).click();page.wait_for_selector('.ws-banner:not([hidden])',timeout=10000)
    assert 'Шарик добрался' in page.locator('.ws-banner').inner_text()
    page.locator('#workName').fill('Моя трасса');page.get_by_role('button',name='Сохранить на полку',exact=True).click()
    work=page.evaluate('Workshop.entries()[0]');assert len(work['data']['parts'])==3;data=stored(page);clean(page);page.close()
    page=load(context,'games/marble-lab/index.html','?work='+work['id'],data)
    page.get_by_role('button',name='Три шарика',exact=True).click();page.wait_for_selector('.ws-banner:not([hidden])',timeout=10000)
    assert '3 из 3' in page.locator('.ws-banner').inner_text();clean(page);page.close()
    print('PASS physics: touch-built bridge, pause, win, saved fixed rails, three balls after reopen',flush=True)

def shelf(context):
    page=load(context,'works.html');assert page.locator('.ws-work').count()==0
    payload={'format':'igroland-work','version':1,'game':'shape-studio','name':'<img src=x onerror=alert(1)>','data':{'pieces':[{'id':1,'type':'circle','x':100,'y':100,'rot':0,'color':1}]}}
    page.locator('#workFile').set_input_files({'name':'work.json','mimeType':'application/json','buffer':json.dumps(payload).encode()})
    page.wait_for_function('document.querySelectorAll(".ws-work").length===1');assert page.locator('.ws-work img').count()==0
    assert '<img' in page.locator('.ws-work h2').inner_text()
    page.locator('#workFile').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{bad'})
    page.wait_for_function('document.getElementById("shelfMessage").textContent.includes("Не удалось")');assert page.locator('.ws-work').count()==1
    page.on('dialog',lambda d:d.accept());page.get_by_role('button',name='Удалить',exact=True).first.click();assert page.locator('.ws-work').count()==0
    clean(page);page.close();print('PASS shelf: empty state, imported preview, HTML-safe name, bad JSON, deletion',flush=True)

def layouts(browser):
    for width in [390,768,1280]:
        context=browser.new_context(viewport={'width':width,'height':900},has_touch=True)
        for slug in ['forest-shop','story-post','shape-studio','marble-lab']:
            page=load(context,f'games/{slug}/index.html');assert not page.evaluate('document.documentElement.scrollWidth>innerWidth');clean(page);page.close()
        for query,count in [('',16),('?section=learn',7),('?section=play',9)]:
            page=load(context,'index.html',query);assert page.locator('#gameCards>a').count()==count;assert not page.evaluate('document.documentElement.scrollWidth>innerWidth');clean(page);page.close()
        context.close();print('PASS layouts',width,'four games and three catalog filters',flush=True)

if __name__=='__main__':
    group=sys.argv[1] if len(sys.argv)>1 else 'all'
    with sync_playwright() as p:
        opts={'args':['--no-sandbox']}
        if os.environ.get('CHROMIUM'):opts['executable_path']=os.environ['CHROMIUM']
        browser=p.chromium.launch(**opts);context=browser.new_context(viewport={'width':1280,'height':960},has_touch=True);context.set_default_timeout(4000)
        actions={
          'shop1':lambda:lessons(context,'forest-shop',['count','pay','total']),
          'shop2':lambda:lessons(context,'forest-shop',['budget','change']),
          'post':lambda:lessons(context,'story-post',['address','clues','stories']),
          'shapes1':lambda:shapes(context,['house','boat','fish']),
          'shapes2':lambda:shapes(context,['rocket','tree','windmill']),
          'shapes3':lambda:shapes(context,['butterfly','robot','garden']),
          'editor':lambda:editor(context),'physics':lambda:physics(context),'shelf':lambda:shelf(context),'layouts':lambda:layouts(browser)
        }
        try:
            if group=='all':
                for action in actions.values():action()
            else:actions[group]()
        finally:context.close();browser.close()
