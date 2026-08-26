from __future__ import annotations
import base64, hashlib, io, json, os, pathlib, re, time, zipfile
import requests

OUT=pathlib.Path('public-repo-work'); (OUT/'candidates').mkdir(parents=True,exist_ok=True)
REPOS=[
'VogelEric/Space-Exploration-Save','Lexi4/Factorio_Space_Exploration_Saves',
'HappyMaki/FactorioSaves','Frogo-o/factorio-saves','ChristineZhiMei/FACTORIO_SAVES',
'lilly-lizard/factorio-saves','syedimran23/factorio-multiplayer-saves','j4yu22/factorio-save',
'ThatCalypsoCat/Factorio-World','mans-debug/factorio_saves','luis-navarro1/factorio_saves',
'Sebastian-Schuchmann/factorio-saves','jakedcrampton/factorio','ianic-dev/factorio-saves',
'Gurczi/factorioSavy','amaro-gameplays36/saves','yoihai22/factorio-save','hahoyer/factorio'
]
TOKEN=os.environ.get('GITHUB_TOKEN',''); S=requests.Session(); S.headers['User-Agent']='JJ-SE-save-audit/1'
if TOKEN:S.headers['Authorization']='Bearer '+TOKEN
errors=[]; rows=[]; total_downloaded=0

def api(url,**kw):
 for i in range(3):
  try:
   r=S.get(url,timeout=60,**kw)
   if r.status_code==200:return r
   if r.status_code in (403,404,410):return r
  except Exception as e:last=repr(e)
  time.sleep(i+1)
 raise RuntimeError(last if 'last' in locals() else url)

def roots(names):
 fs={x.rstrip('/') for x in names if not x.endswith('/')}; out=[]
 for n in fs:
  if n.endswith('/level-init.dat'):
   r=n[:-15]
   if r+'/script.dat' in fs and any(x==r+'/level.dat' or x.startswith(r+'/level.dat') for x in fs):out.append(r)
 return sorted(set(out))

def strings(b):return [m.group().decode('latin1','replace') for m in re.finditer(rb'[\x20-\x7e]{4,}',b)]

def se_info(init,script):
 ss=strings(init); near=[]
 for i,s in enumerate(ss):
  if 'space-exploration' in s.lower():
   for x in ss[max(0,i-25):i+26]:near+=re.findall(r'\b0\.[67]\.\d{1,3}\b',x)
 has=any('space-exploration' in x.lower() for x in ss)
 allv=sorted(set(x.decode() for x in re.findall(rb'\b0\.[67]\.\d{1,3}\b',init)))
 low=script.lower(); terms={x.decode():low.count(x) for x in [b'se-rocket-science-pack',b'nauvis orbit',b'se-rocket-launch-pad',b'cargo rocket',b'space-science-pack',b'astronomic-science',b'cryonite',b'vulcanite',b'holmium',b'iridium']}
 likely=has and (any(v.startswith('0.7.') for v in near) or (any(v.startswith('0.7.') for v in allv) and not any(v.startswith('0.6.') for v in near)))
 return has,sorted(set(near)),allv,terms,likely

def lfs_download(repo,pointer):
 oid=re.search(r'oid sha256:([0-9a-f]{64})',pointer); size=re.search(r'size (\d+)',pointer)
 if not oid:return None
 url=f'https://github.com/{repo}.git/info/lfs/objects/batch'
 body={'operation':'download','transfers':['basic'],'objects':[{'oid':oid.group(1),'size':int(size.group(1)) if size else 0}]}
 h={'Accept':'application/vnd.git-lfs+json','Content-Type':'application/vnd.git-lfs+json'}
 r=requests.post(url,headers=h,json=body,timeout=60)
 if r.status_code!=200:return None
 href=r.json()['objects'][0].get('actions',{}).get('download',{}).get('href')
 if not href:return None
 return requests.get(href,timeout=1800).content

def get_blob(repo,branch,path):
 global total_downloaded
 raw=f'https://raw.githubusercontent.com/{repo}/{branch}/'+requests.utils.quote(path,safe='/')
 r=requests.get(raw,timeout=1800)
 if r.status_code!=200:raise RuntimeError(f'raw {r.status_code}')
 b=r.content
 if b.startswith(b'version https://git-lfs.github.com/spec/v1'):
  b=lfs_download(repo,b.decode())
  if b is None:raise RuntimeError('LFS download failed')
 total_downloaded+=len(b); return b

for repo in REPOS:
 try:
  meta=api('https://api.github.com/repos/'+repo).json(); branch=meta.get('default_branch','main')
  tr=api(f'https://api.github.com/repos/{repo}/git/trees/{branch}?recursive=1')
  if tr.status_code!=200:raise RuntimeError(f'tree {tr.status_code}')
  obj=tr.json(); exact='Space_Exploration' in repo or 'Space-Exploration' in repo
  files=[]
  for x in obj.get('tree',[]):
   p=x.get('path',''); low=p.lower(); sz=x.get('size') or 0
   if x.get('type')!='blob' or not low.endswith(('.zip','.sav')):continue
   if '/mods/' in '/'+low or low.startswith('mods/'):continue
   if sz<100000 or sz>650_000_000:continue
   if exact or any(k in low for k in ('save','autosave','factorio','space','world','.zip')):files.append((p,sz))
  files=sorted(files,key=lambda x:x[0])[:80]
  print(repo,'files',len(files),flush=True)
  for path,sz in files:
   if total_downloaded>5_500_000_000:raise RuntimeError('global download cap')
   try:b=get_blob(repo,branch,path)
   except Exception as e:
    errors.append({'repo':repo,'path':path,'error':repr(e)});continue
   rec={'repo':repo,'branch':branch,'path':path,'declared_size':sz,'size':len(b),'sha256':hashlib.sha256(b).hexdigest(),'is_zip':zipfile.is_zipfile(io.BytesIO(b)),'saves':[]}
   if rec['is_zip']:
    try:
     with zipfile.ZipFile(io.BytesIO(b)) as z:
      for root in roots(z.namelist()):
       init=z.read(root+'/level-init.dat'); script=z.read(root+'/script.dat')
       has,near,allv,terms,likely=se_info(init,script)
       sr={'root':root,'has_se':has,'near_versions':near,'all_06_07_versions':allv,'terms':terms,'likely_se07':likely};rec['saves'].append(sr)
       if likely and len(b)<94_000_000:
        name=re.sub(r'[^A-Za-z0-9_.-]+','_',repo+'__'+path)[-150:]
        (OUT/'candidates'/(name+'.zip')).write_bytes(b)
    except Exception as e:rec['zip_error']=repr(e)
   rows.append(rec)
 except Exception as e:errors.append({'repo':repo,'error':repr(e)})

(OUT/'audit.json').write_text(json.dumps(rows,indent=2));(OUT/'errors.json').write_text(json.dumps(errors,indent=2))
likely=[(r,s) for r in rows for s in r['saves'] if s['likely_se07']]
lines=['# Public GitHub Factorio save repository audit','',f'Repositories: {len(REPOS)}',f'Archives inspected: {len(rows)}',f'Factorio saves: {sum(len(r["saves"]) for r in rows)}',f'Likely native SE 0.7 saves: {len(likely)}',f'Downloaded bytes: {total_downloaded}','']
for r,s in likely:lines += [f'## {r["repo"]}: {r["path"]}',f'- root: `{s["root"]}`',f'- size: {r["size"]}',f'- sha256: `{r["sha256"]}`',f'- SE versions: {s["near_versions"]}',f'- terms: `{s["terms"]}`','']
lines+=['## All saves','']
for r in rows:
 for s in r['saves']:lines.append(f'- {r["repo"]} / `{r["path"]}` / `{s["root"]}` | SE={s["has_se"]} | likely07={s["likely_se07"]} | versions={s["near_versions"]}')
(OUT/'SUMMARY.md').write_text('\n'.join(lines));print('\n'.join(lines[:300]))
