from __future__ import annotations
import json,pathlib,struct,urllib.request,urllib.parse,tarfile,zipfile
P=pathlib.Path
SAVE=P('work/original.zip'); MODS=P('work/mods'); PUB=P('published'); MODS.mkdir(parents=True,exist_ok=True);PUB.mkdir(exist_ok=True)
with zipfile.ZipFile(SAVE) as z:
 init=next(n for n in z.namelist() if n.endswith('/level-init.dat'));d=z.read(init)
class R:
 def __init__(self,d):self.d=d;self.o=0
 def u8(self):v=self.d[self.o];self.o+=1;return v
 def u16(self):v=struct.unpack_from('<H',self.d,self.o)[0];self.o+=2;return v
 def u32(self):v=struct.unpack_from('<I',self.d,self.o)[0];self.o+=4;return v
 def ver(self):return self.u16(),self.u16(),self.u16(),self.u16()
 def opt(self,b,fv):
  if fv>(0,14,14,0):
   x=self.u8()
   if x!=255:return x
  return self.u16() if b==16 else self.u32()
 def text(self,fv):n=self.opt(32,fv);v=self.d[self.o:self.o+n];self.o+=n;return v.decode('utf-8','replace')
 def v48(self,fv):return self.opt(16,fv),self.opt(16,fv),self.opt(16,fv)
r=R(d);fv=r.ver();r.u8();save_name=r.text(fv);campaign=r.text(fv);base_mod=r.text(fv)
r.u8();r.u8();r.u8();r.text(fv);r.u8();r.u8();r.u8();r.u8();loaded='.'.join(map(str,r.v48(fv)));build=r.u16();r.u8()
mods={}
for _ in range(r.opt(32,fv)):
 name=r.text(fv);ver='.'.join(map(str,r.v48(fv)));r.u32();mods[name]=ver
version='.'.join(map(str,fv[:3]));header={'factorio_version':version,'save_name':save_name,'campaign':campaign,'base_mod':base_mod,'loaded_from':loaded,'build':build,'mods':mods}
(PUB/'header.json').write_text(json.dumps(header,indent=2))
def download(url,dest,timeout=1200):
 req=urllib.request.Request(url,headers={'User-Agent':'JJ-SE-constructor/1.0'})
 with urllib.request.urlopen(req,timeout=timeout) as src,dest.open('wb') as out:
  while c:=src.read(1024*1024):out.write(c)
archive=P('work/factorio.tar.xz');download(f'https://factorio.com/get-download/{version}/headless/linux64',archive)
with tarfile.open(archive,'r:xz') as t:t.extractall('work')
report=[]
for name,ver in mods.items():
 if name in {'base','core'}:report.append({'name':name,'version':ver,'status':'builtin'});continue
 try:
  api='https://mods.factorio.com/api/mods/'+urllib.parse.quote(name,safe='')+'/full'
  with urllib.request.urlopen(urllib.request.Request(api,headers={'User-Agent':'JJ-SE-constructor/1.0'}),timeout=90) as x:meta=json.load(x)
  rel=next((x for x in meta.get('releases',[]) if x.get('version')==ver),None)
  if not rel:raise RuntimeError('exact release missing')
  url=urllib.parse.urljoin('https://mods.factorio.com',rel['download_url']);dest=MODS/f'{name}_{ver}.zip';download(url,dest)
  report.append({'name':name,'version':ver,'status':'downloaded','bytes':dest.stat().st_size})
 except Exception as e:report.append({'name':name,'version':ver,'status':'failed','error':repr(e)})
(PUB/'mod-downloads.json').write_text(json.dumps(report,indent=2))
failed=[x for x in report if x['status']=='failed']
if failed:raise SystemExit(f'{len(failed)} mod downloads failed: {failed}')
(MODS/'mod-list.json').write_text(json.dumps({'mods':[{'name':n,'enabled':True} for n in mods]},indent=2))
print(json.dumps(header,indent=2))
