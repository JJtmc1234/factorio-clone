from __future__ import annotations
import json,pathlib,socket,struct,time
PUB=pathlib.Path('published');PUB.mkdir(exist_ok=True);PORT=27420;PASSWORD='inspect'
def packet(i,t,b):
 p=struct.pack('<ii',i,t)+b.encode()+b'\0\0';return struct.pack('<i',len(p))+p
def recv(s):
 h=s.recv(4)
 if not h:raise RuntimeError('RCON EOF')
 n=struct.unpack('<i',h)[0];d=b''
 while len(d)<n:d+=s.recv(n-len(d))
 return struct.unpack_from('<ii',d,0)+(d[8:-2].decode('utf-8','replace'),)
def command(body,timeout=180):
 with socket.create_connection(('127.0.0.1',PORT),timeout=30) as s:
  s.settimeout(timeout);s.sendall(packet(1,3,PASSWORD));a=recv(s)
  if a[0]==-1:raise RuntimeError('RCON auth failed')
  s.sendall(packet(2,2,body));return recv(s)[2]
BUILD=r'''
local force=game.forces.player or game.forces["player"] or game.players[1].force
local surface=game.surfaces["nauvis"] or game.surfaces[1]
local anchor=(game.players[1] and game.players[1].position) or {x=0,y=0}
local center={x=math.floor(anchor.x)+500,y=math.floor(anchor.y)}
local area={{center.x-48,center.y-36},{center.x+48,center.y+36}}
for _,e in pairs(surface.find_entities(area)) do if e.valid and e.type~="character" then e.destroy() end end
local tiles={}
for x=center.x-48,center.x+48 do for y=center.y-36,center.y+36 do table.insert(tiles,{name="refined-concrete",position={x,y}}) end end
surface.set_tiles(tiles,true,false,false,false)
local nearest=nil;local best=1e30
for _,e in pairs(surface.find_entities_filtered{force=force,type="electric-pole"}) do
 local dx=e.position.x-center.x;local dy=e.position.y-center.y;local d=dx*dx+dy*dy
 if d<best then best=d;nearest=e end
end
local power_chain=0
if nearest then
 local sx=nearest.position.x;local sy=nearest.position.y;local dx=center.x-sx;local dy=center.y-sy;local dist=math.sqrt(dx*dx+dy*dy);local last=nearest
 local steps=math.ceil(dist/18)
 for i=1,steps do
  local t=i/steps;local tx=sx+dx*t;local ty=sy+dy*t
  local pt=surface.find_non_colliding_position("big-electric-pole",{tx,ty},6,0.5) or {tx,ty}
  local land={};for xx=math.floor(pt.x)-1,math.floor(pt.x)+1 do for yy=math.floor(pt.y)-1,math.floor(pt.y)+1 do table.insert(land,{name="landfill",position={xx,yy}}) end end
  surface.set_tiles(land,true,false,false,false)
  local p=surface.create_entity{name="big-electric-pole",position=pt,force=force,raise_built=true}
  if p then p.connect_neighbour(last);last=p;power_chain=power_chain+1 end
 end
end
local made=0;local filled={speed=0,furnace=0,telemetry=0}
for row=0,3 do for col=0,5 do
 local x=center.x-30+col*12;local y=center.y-18+row*12
 local m=surface.create_entity{name="assembling-machine-3",position={x,y},force=force,raise_built=true}
 if m then
  m.set_recipe("se-rocket-science-pack");made=made+1
  local west=surface.create_entity{name="steel-chest",position={x-3,y},force=force,raise_built=true}
  local north=surface.create_entity{name="steel-chest",position={x,y-3},force=force,raise_built=true}
  local south=surface.create_entity{name="steel-chest",position={x,y+3},force=force,raise_built=true}
  surface.create_entity{name="steel-chest",position={x+3,y},force=force,raise_built=true}
  local iw=surface.create_entity{name="fast-inserter",position={x-2,y},direction=defines.direction.east,force=force,raise_built=true}
  local inn=surface.create_entity{name="fast-inserter",position={x,y-2},direction=defines.direction.south,force=force,raise_built=true}
  local ins=surface.create_entity{name="fast-inserter",position={x,y+2},direction=defines.direction.north,force=force,raise_built=true}
  surface.create_entity{name="fast-inserter",position={x+2,y},direction=defines.direction.east,force=force,raise_built=true}
  if west then filled.speed=filled.speed+west.insert{name="speed-module",count=100000} end
  if north then filled.furnace=filled.furnace+north.insert{name="electric-furnace",count=100000} end
  if south then filled.telemetry=filled.telemetry+south.insert{name="se-satellite-telemetry",count=100000} end
 end
end end
for row=0,1 do for col=0,2 do
 surface.create_entity{name="substation",position={center.x-24+col*24,center.y-12+row*24},force=force,raise_built=true}
end end
local supply=surface.create_entity{name="steel-chest",position={center.x,center.y+31},force=force,raise_built=true}
if supply then supply.insert{name="se-cargo-rocket-section",count=100};supply.insert{name="se-space-capsule",count=1};supply.insert{name="se-rocket-launch-pad",count=1} end
force.add_chart_tag(surface,{position=center,icon={type="item",name="se-rocket-science-pack"},text="JJ: 144 SPM Rocket Science - PRE-ORBIT"})
force.add_chart_tag(surface,{position={center.x,center.y+31},text="First cargo rocket starter materials"})
force.chart(surface,area)
game.write_file("jj_construct_marker.txt",game.table_to_json({center=center,machines=made,filled=filled,power_chain=power_chain}),false)
rcon.print(game.table_to_json({center=center,machines=made,filled=filled,power_chain=power_chain}))
'''
QUERY=r'''
local out={tick=game.tick,hours=game.tick/216000,players={},forces={},surfaces={},rocket_science_machines=0,rocket_science_working=0,rocket_science_output_items=0,backup_power_interfaces=0}
local realforces={};for _,f in pairs(game.forces) do if f.name~="enemy" and f.name~="neutral" then realforces[f.name]=true end end
for _,f in pairs(game.forces) do
 local fr={name=f.name,rockets_launched=f.rockets_launched or 0,rocket_science_output=0,rocket_science_input=0,research={}}
 local ok,v=pcall(function()return f.item_production_statistics.get_output_count("se-rocket-science-pack")end);if ok then fr.rocket_science_output=v end
 local ok2,v2=pcall(function()return f.item_production_statistics.get_input_count("se-rocket-science-pack")end);if ok2 then fr.rocket_science_input=v2 end
 for n,t in pairs(f.technologies) do if t.researched and (string.find(n,"rocket",1,true) or string.find(n,"space",1,true)) then table.insert(fr.research,n) end end
 table.sort(fr.research);table.insert(out.forces,fr)
end
for _,p in pairs(game.players) do table.insert(out.players,{name=p.name,force=p.force.name,surface=p.surface and p.surface.name or nil,position=p.position}) end
for _,s in pairs(game.surfaces) do
 local sr={name=s.name,index=s.index,chunks=0,player_entities=0,entities={},rocket_science_machines=0,rocket_science_working=0,rocket_science_output_items=0}
 for _ in s.get_chunks() do sr.chunks=sr.chunks+1 end
 for fn,_ in pairs(realforces) do local ok,c=pcall(function()return s.count_entities_filtered{force=fn}end);if ok then sr.player_entities=sr.player_entities+c end end
 for _,en in pairs({"se-rocket-launch-pad","se-rocket-landing-pad","se-space-science-lab","se-space-assembling-machine","se-space-manufactory","rocket-silo","electric-energy-interface"}) do local ok,c=pcall(function()return s.count_entities_filtered{name=en}end);sr.entities[en]=ok and c or -1 end
 out.backup_power_interfaces=out.backup_power_interfaces+((sr.entities["electric-energy-interface"] or 0))
 for _,e in pairs(s.find_entities_filtered{type={"assembling-machine","furnace","rocket-silo"}}) do
  local ok,r=pcall(function()return e.get_recipe()end)
  if ok and r and r.name=="se-rocket-science-pack" then
   out.rocket_science_machines=out.rocket_science_machines+1;sr.rocket_science_machines=sr.rocket_science_machines+1
   local oks,st=pcall(function()return e.status end);if oks and st==defines.entity_status.working then out.rocket_science_working=out.rocket_science_working+1;sr.rocket_science_working=sr.rocket_science_working+1 end
  end
 end
 for _,e in pairs(s.find_entities_filtered{name="steel-chest",force="player"}) do local inv=e.get_inventory(defines.inventory.chest);if inv then local c=inv.get_item_count("se-rocket-science-pack");sr.rocket_science_output_items=sr.rocket_science_output_items+c;out.rocket_science_output_items=out.rocket_science_output_items+c end end
 table.insert(out.surfaces,sr)
end
rcon.print(game.table_to_json(out))
'''
def run_lua(lua):return command('/sc '+lua,240)
def parse(body):
 a=body.find('{');b=body.rfind('}')
 if a<0 or b<a:raise RuntimeError(body[:3000])
 return json.loads(body[a:b+1])
def query():return parse(run_lua(QUERY))
def main():
 built=parse(run_lua(BUILD));(PUB/'build.json').write_text(json.dumps(built,indent=2));print('BUILT',json.dumps(built))
 time.sleep(8);q=query();print('INITIAL',json.dumps(q))
 if q['rocket_science_working']<20:
  backup=r'''local s=game.surfaces["nauvis"];local f=game.forces.player;local p=s.find_non_colliding_position("electric-energy-interface",{game.players[1].position.x+500,game.players[1].position.y+32},20,1);local e=s.create_entity{name="electric-energy-interface",position=p,force=f};if e then e.power_production=100000000;e.electric_buffer_size=100000000;e.energy=100000000;e.destructible=false;e.minable=false end;rcon.print(e and "backup-added" or "backup-failed")'''
  print(command('/sc '+backup));time.sleep(5)
 command('/sc game.speed=20;rcon.print("speed20")');
 for i in range(18):
  time.sleep(5);q=query();out=max((f.get('rocket_science_output',0) for f in q['forces']),default=0);print('PROGRESS',i,out,q['rocket_science_working'])
  if out>=1500:break
 command('/sc game.speed=1;rcon.print("speed1")');final=query();(PUB/'pre_save_verification.json').write_text(json.dumps(final,indent=2,sort_keys=True))
 print(command('/server-save JJ_SE07_144SPM_PREORBIT_CONSTRUCTED',timeout=300));time.sleep(12)
 print(json.dumps(final,indent=2,sort_keys=True))
if __name__=='__main__':main()
