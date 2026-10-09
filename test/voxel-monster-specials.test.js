import assert from 'node:assert/strict';
import test from 'node:test';
import * as Horde from '../public/voxel-horde-engine.js';
import { applyCombatDamage, emptyInput } from '../public/voxel-engine.js';
import { MONSTER_SPECIAL_RULES as RULES, launchMonsterShard, markMonsterRune, advanceMonsterSpecials } from '../public/voxel-monster-specials.js';
import { monsterTypeId, monsterMovementSpeed } from '../public/voxel-monster-bodies.js';
import { MELEE_WEAPONS } from '../public/voxel-melee.js';
import { setInventoryMeleeLoadout, selectInventorySlot } from '../public/voxel-inventory.js';
const arena = { id:'monster-special-qa', bounds:{minX:-25,maxX:25,minZ:-25,maxZ:25},colliders:[],spawns:Horde.MAPS.courtyard.spawns };
function advance(s,n,inputs=[]){for(let i=0;i<n;i++)Horde.step(s,typeof inputs==='function'?inputs(s,i):inputs);}
function pose(p,x,z,yaw=0,y=0){Object.assign(p,{x,y,z,yaw,pitch:0,vx:0,vy:0,vz:0,grounded:true});p.previousInput=emptyInput(p);}
function fixture(type,{wave=type==='bomber'?3:type==='spitter'?5:8,capacity=1,participants=[0],distance=type==='bomber'?3:10,seed=5123}={}){
 const s=Horde.createState({capacity,seed});Horde.startMatch(s,participants);advance(s,s.phaseTicks);s.map=arena;s.horde.wave=wave;s.horde.pending=1;s.horde.nextSpawnTick=Number.MAX_SAFE_INTEGER;
 for(const id of participants)pose(s.players[id],id*2,0);
 s.spawnWarnings=[{id:1,x:0,y:0,z:-12,ticksLeft:1,monsterType:type}];Horde.step(s);const m=s.players.find(p=>p.monster);assert.ok(m);m.emergenceTicks=0;pose(m,0,-distance,Math.PI);
 const b=s.horde.brains[m.id];b.targetId=null;b.nextPlanTick=b.nextSightTick=0;return{s,h:s.players[0],m,b};
}
function waitFor(f,state){for(let i=0;i<500&&f.m.alive&&f.h.alive;i++){Horde.step(f.s);if(f.m.monsterState===state)return;}assert.fail(`expected ${state}`);}
function damageEvents(s,weapon){return s.events.filter(e=>e.type==='damage'&&e.weapon===weapon);}

test('new special species are trusted unarmed humanoids with different real attack families',()=>{
 for(const type of ['bomber','spitter','weaver']){const {m}=fixture(type);assert.equal(monsterTypeId(m),type);assert.equal(m.hasGun,false);assert.deepEqual(m.inventory,[null,null,null,null]);assert.ok(monsterMovementSpeed(m)>0);assert.equal(m.shots,0);}
 assert.equal(monsterTypeId({monster:false,human:true,monsterType:'weaver'}),null);
});
for(const response of ['stay','dodge','cover','kill'])test(`bomber fuse is readable and ${response} gives the corresponding real blast outcome`,()=>{
 const f=fixture('bomber');waitFor(f,'bomberFuse');const {s,h,m,b}=f,start=s.tick,pos={x:m.x,z:m.z};assert.equal(b.attackTicks,90);advance(s,89,response==='dodge'?[{down:true}]:[]);
 assert.equal(damageEvents(s,'bomber').length,0);assert.equal(m.x,pos.x);assert.equal(m.z,pos.z);
 if(response==='cover')s.map={...arena,colliders:[{id:'blast-cover',x:-10,y:0,z:-1.8,w:20,h:4,d:.12}]};
 if(response==='kill')applyCombatDamage(s,[{playerId:0,targetId:m.id,damage:m.hp,attack:'gun',weapon:'carbine'}]);
 Horde.step(s,response==='dodge'?[{down:true}]:[]);
 assert.equal(s.tick-start,90);assert.equal(m.alive,false);const harm=damageEvents(s,'bomber').filter(e=>e.targetId===h.id);
 assert.equal(harm.length,response==='stay'?1:0);assert.equal(s.events.filter(e=>e.type==='monsterBlast').length,response==='kill'?0:1);
 const death=s.events.find(e=>e.type==='kill'&&e.targetId===m.id);assert.equal(death.monsterType,'bomber');assert.equal(death.targetLifeId,m.lifeId);assert.equal(s.horde.totalKills,1);
});
test('bomber begins a real rush at distance then stops to commit a stationary fuse',()=>{
 const f=fixture('bomber',{distance:9});const start=f.m.z;advance(f.s,60);assert.ok(f.m.z>start+1);waitFor(f,'bomberFuse');const z=f.m.z;advance(f.s,20);assert.ok(Math.abs(f.m.z-z)<.3,'ordinary inertia stops during committed tell');
});
for(const response of ['stay','dodge','cover'])test(`spitter emits a visible finite slow shard and ${response} resolves through real motion/cover`,()=>{
 const f=fixture('spitter');waitFor(f,'spitting');const {s,h,m,b}=f;assert.equal(b.attackTicks,78);advance(s,77);assert.equal(s.horde.projectiles.length,0);assert.equal(h.hp,h.maxHp);
 Horde.step(s);assert.equal(s.horde.projectiles.length,1);const shard=s.horde.projectiles[0];assert.equal(shard.sourceLifeId,m.lifeId);assert.equal(shard.sourceId,m.id);
 const before={x:shard.x,y:shard.y,z:shard.z};Horde.step(s);assert.ok(Math.abs(Math.hypot(shard.x-before.x,shard.y-before.y,shard.z-before.z)-RULES.shardSpeed/120)<1e-9);assert.ok(shard.z>before.z);
 if(response==='cover')s.map={...arena,colliders:[{id:'shard-cover',x:-10,y:0,z:-5,w:20,h:4,d:.1}]};
 advance(s,180,response==='dodge'?[{right:true}]:[]);assert.equal(damageEvents(s,'spitter').length,response==='stay'?1:0);assert.equal(s.horde.projectiles.length,response==='dodge'?1:0);assert.equal(m.shots,0);
 if(response==='cover')assert.ok(s.events.some(e=>e.type==='monsterShardImpact'&&e.z<=-4.9));
});
for(const response of ['stay','dodge','jump','cover','kill'])test(`weaver fixes a ground rune during its warning, and ${response} respects actual bounds/life/height`,()=>{
 const f=fixture('weaver');waitFor(f,'weaving');const {s,h,m,b}=f;assert.equal(b.attackTicks,108);assert.equal(s.horde.hazards.length,1);const rune=s.horde.hazards[0];assert.equal(rune.x,0);assert.equal(rune.z,0);assert.equal(rune.y,0);
 advance(s,response==='jump'?84:90,response==='dodge'?[{right:true}]:[]);assert.equal(damageEvents(s,'weaver').length,0);assert.equal(rune.x,0);assert.equal(rune.z,0);
 if(response==='cover'){pose(h,1,0);s.map={...arena,colliders:[{id:'rune-cover',x:.4,y:0,z:-3,w:.12,h:.6,d:6}]};}
 if(response==='kill')applyCombatDamage(s,[{playerId:0,targetId:m.id,damage:m.hp,attack:'gun',weapon:'carbine'}]);
 if(response==='jump')Horde.step(s,[{jump:true}]);else Horde.step(s,response==='dodge'?[{right:true}]:[]);
 advance(s,response==='jump'?23:17,response==='dodge'?[{right:true}]:[]);assert.equal(s.horde.hazards.length,0);assert.equal(damageEvents(s,'weaver').length,response==='stay'?1:0);
 if(response==='jump')assert.ok(h.y>=RULES.runeHeight,'the ordinary physical jump clears the low eruption');
 assert.ok(s.events.some(e=>e.type==='monsterMark'&&e.stage===(response==='kill'?'cancel':'release')));
});
test('blade contact genuinely interrupts a caster warning and removes its pending rune',()=>{
 const f=fixture('weaver',{distance:2.2});waitFor(f,'weaving');setInventoryMeleeLoadout(f.h,'sword');selectInventorySlot(f.h,0);f.h.triggerBlocked=false;advance(f.s,30,[{up:true,yaw:0}]);
 Horde.step(f.s,[{fire:true,yaw:0}]);advance(f.s,MELEE_WEAPONS.sword.startupTicks + MELEE_WEAPONS.sword.activeTicks);assert.ok(f.m.alive);assert.equal(f.s.horde.hazards.length,0);assert.ok(f.s.events.some(e=>e.type==='monsterStagger'));assert.ok(f.s.events.some(e=>e.type==='monsterMark'&&e.stage==='cancel'));assert.equal(damageEvents(f.s,'weaver').length,0);
});
test('runes preserve platform ground height and do not affect a different target life',()=>{
 const f=fixture('weaver');f.s.map={...arena,colliders:[{id:'platform',x:-2,y:0,z:-2,w:4,h:2,d:4}]};pose(f.h,0,0,0,2);assert.equal(markMonsterRune(f.s,f.m,f.h,f.s.map),true);const rune=f.s.horde.hazards[0];assert.equal(rune.y,2);f.h.lifeId++;const hits=advanceMonsterSpecials(f.s,f.s.map);assert.equal(hits.length,0);assert.equal(f.s.horde.hazards.length,0);
});
test('special pools are capped, paused exactly, cancelled on source reuse, and cleared on end/replay',()=>{
 const f=fixture('spitter');for(let i=0;i<40;i++)launchMonsterShard(f.s,f.m,0,0);assert.equal(f.s.horde.projectiles.length,RULES.maxProjectiles);Horde.pauseMatch(f.s);const frozen=JSON.stringify(f.s);advance(f.s,1000);assert.equal(JSON.stringify(f.s),frozen);Horde.resumeMatch(f.s);f.m.lifeId++;Horde.step(f.s);assert.equal(f.s.horde.projectiles.length,0);
 const w=fixture('weaver');for(let i=0;i<12;i++)markMonsterRune(w.s,w.m,w.h,w.s.map);assert.equal(w.s.horde.hazards.length,RULES.maxHazards);Horde.setConnected(w.s,0,false);Horde.step(w.s);assert.equal(w.s.phase,'matchEnd');assert.equal(w.s.horde.hazards.length,0);assert.equal(w.s.horde.projectiles.length,0);Horde.startMatch(w.s);assert.equal(w.s.horde.hazards.length,0);assert.equal(w.s.horde.projectiles.length,0);
});
test('shards expire without target contact and do not survive beyond their source identity',()=>{
 const f=fixture('spitter');f.s.map={...arena,bounds:{minX:-1000,maxX:1000,minZ:-1000,maxZ:1000}};launchMonsterShard(f.s,f.m,0,0);for(let i=0;i<RULES.shardTicks-1;i++){f.s.tick++;assert.equal(advanceMonsterSpecials(f.s,f.s.map).length,0);}assert.equal(f.s.horde.projectiles.length,1);f.s.tick++;advanceMonsterSpecials(f.s,f.s.map);assert.equal(f.s.horde.projectiles.length,0);
});
test('seeded sparse co-op special attacks remain deterministic',()=>{
 const options={capacity:3,participants:[0,2]},a=fixture('weaver',options),b=fixture('weaver',options);
 for(let tick=0;tick<400;tick++){const input=[{right:tick%130<50},{},{left:tick%180<45}];Horde.step(a.s,input);Horde.step(b.s,input);}assert.equal(JSON.stringify(a.s),JSON.stringify(b.s));assert.ok(a.s.events.some(e=>e.type==='monsterMark'));
});

test('a real wave clear removes in-flight shards before intermission and a new wave starts with empty special pools',()=>{
 const f=fixture('spitter');launchMonsterShard(f.s,f.m,0,0);f.s.horde.pending=0;applyCombatDamage(f.s,[{playerId:0,targetId:f.m.id,damage:f.m.hp,attack:'gun',weapon:'carbine'}]);Horde.step(f.s);assert.equal(f.s.phase,'intermission');assert.equal(f.s.horde.projectiles.length,0);assert.equal(f.s.horde.hazards.length,0);f.s.phaseTicks=1;Horde.step(f.s);assert.equal(f.s.phase,'fight');assert.equal(f.s.horde.projectiles.length,0);assert.equal(f.s.horde.hazards.length,0);
});

for(const type of ['bomber','spitter','weaver'])test(`${type} special damage penetrates an active blade guard rather than masquerading as claws`,()=>{
 const f=fixture(type);setInventoryMeleeLoadout(f.h,'katana');selectInventorySlot(f.h,0);f.h.triggerBlocked=false;waitFor(f,type==='bomber'?'bomberFuse':type==='spitter'?'spitting':'weaving');
 if(type==='spitter'){advance(f.s,78);while(f.s.horde.projectiles[0]?.z < -.65)Horde.step(f.s);Horde.step(f.s,[{aim:true,pitch:-.6}]);advance(f.s,8);}
 else {advance(f.s,f.b.attackTicks-5);Horde.step(f.s,[{aim:true,pitch:type==='weaver'?-1.35:0}]);advance(f.s,5);}
 assert.ok(f.h.hp<f.h.maxHp);assert.equal(f.s.events.some(e=>e.type==='meleeParry'),false);const start=f.s.events.find(e=>e.type==='parryStart'),damage=damageEvents(f.s,type).find(e=>e.targetId===f.h.id);assert.ok(start&&damage);assert.ok(damage.tick-start.tick>=4&&damage.tick-start.tick<16,'impact arrives during the genuine active guard window');assert.equal(damage.attack,'monster-special');
});

test('special IDs never overwrite the shared event cursor across mark/release/shard/impact cues',()=>{
 for(const type of ['spitter','weaver']){const f=fixture(type);advance(f.s,420);let last=0;for(const event of f.s.events){assert.ok(event.id>last,`global event IDs remain monotone for ${type}`);last=event.id;}const cues=f.s.events.filter(e=>['monsterSpit','monsterShardImpact','monsterMark'].includes(e.type));assert.ok(cues.length>=2);for(const event of cues.filter(e=>e.stage!=='windup'||e.type==='monsterMark'))assert.ok(Number.isInteger(event.specialId)&&event.specialId>0);assert.equal(last,f.s.eventId);}
});

function assertEventCursor(state) { let cursor=0;for(const event of state.events){assert.ok(event.id>cursor,`event ${event.type} has a fresh global ID`);cursor=event.id;}assert.equal(cursor,state.eventId); }
for(const kind of ['heal','ammo','weapon'])test(`a genuine ${kind} monster drop keeps loot identity separate from canonical event ID/type`,()=>{
 let found=null;for(let seed=1;seed<=80&&!found;seed++){const f=fixture(kind==='weapon'?'gunner':'weaver',{seed});if(kind==='heal')f.s.horde.killsSinceHeal=4;applyCombatDamage(f.s,[{playerId:0,targetId:f.m.id,damage:f.m.hp,attack:'gun',weapon:'carbine'}]);Horde.step(f.s);const drop=f.s.loot.find(loot=>loot.kind===kind);if(drop)found={...f,drop};}
 assert.ok(found,`real seeded ${kind} drop exists`);const {s,m,drop}=found;assertEventCursor(s);const event=s.events.find(e=>e.type==='hordeDrop'&&e.lootId===drop.id&&e.kind===kind);assert.ok(event);assert.equal(event.lootType,drop.type);assert.equal(event.weapon,drop.weapon);assert.equal(event.x,drop.x);assert.equal(event.z,drop.z);assert.equal(event.type,'hordeDrop');assert.equal(drop.kind,kind);assert.equal(s.horde.totalKills,1);const death=s.events.find(e=>e.type==='kill'&&e.targetId===m.id);assert.equal(death.targetLifeId,m.lifeId);assert.ok(event.id>death.id);
 if(kind==='heal')assert.equal(drop.type,'potion');if(kind==='ammo')assert.equal(drop.type,'ammo');
});
test('real rift and wave-clear supply events retain canonical IDs and expose separate entity identifiers',()=>{
 const s=Horde.createState({capacity:1,seed:51});Horde.startMatch(s);advance(s,s.phaseTicks+25);const rift=s.events.find(e=>e.type==='monsterRift');assert.ok(rift);const warning=s.spawnWarnings.find(w=>w.id===rift.riftId);assert.ok(warning);assert.equal(rift.monsterType,warning.monsterType);assertEventCursor(s);
 const f=fixture('weaver');f.s.horde.pending=0;applyCombatDamage(f.s,[{playerId:0,targetId:f.m.id,damage:f.m.hp,attack:'gun',weapon:'carbine'}]);Horde.step(f.s);assert.equal(f.s.phase,'intermission');const event=f.s.events.find(e=>e.type==='hordeSupply'),cache=f.s.loot.find(loot=>loot.source==='wave-clear');assert.ok(event&&cache);assert.equal(event.lootId,cache.id);assert.equal(event.kind,cache.kind);assert.equal(event.weapon,cache.weapon);assertEventCursor(f.s);
});
