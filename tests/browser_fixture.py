"""Offline browser fixture: inline repository assets, simulated storage and search params.
No network navigation is possible in this sandbox. Production files are not modified.
"""
from pathlib import Path
import re,json
ROOT=Path(__file__).resolve().parents[1]
def html_for(file,query='',storage=None):
 path=ROOT/file
 html=path.read_text()
 def style(m):return '<style>'+ (path.parent/m.group(1)).resolve().read_text()+'</style>'
 html=re.sub(r'<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>',style,html)
 def script(m):
  body=(path.parent/m.group(1)).resolve().read_text().replace('location.search','window.__fixtureSearch')
  return '<script>'+body.replace('</script','<\\/script')+'</script>'
 html=re.sub(r'<script src="([^"]+)"></script>',script,html)
 fixture='''<script>
 window.__fixtureSearch=QUERY; window.__fixtureStorage=STORE;
 Object.defineProperty(window,'localStorage',{configurable:true,value:{
 getItem(k){return Object.hasOwn(window.__fixtureStorage,k)?window.__fixtureStorage[k]:null;},
 setItem(k,v){if(window.__failStorage)throw new Error('quota');window.__fixtureStorage[k]=String(v);},
 removeItem(k){delete window.__fixtureStorage[k];},clear(){window.__fixtureStorage={};}
 }});
 </script>'''.replace('QUERY',json.dumps(query)).replace('STORE',json.dumps(storage or {},ensure_ascii=False).replace('</','<\\/'))
 return html.replace('<head>','<head>'+fixture)
def load(context,file,query='',storage=None):
 page=context.new_page();page.errors=[];page.on('pageerror',lambda e:page.errors.append(str(e)))
 page.set_content(html_for(file,query,storage),wait_until='load');return page
