import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createCombatPlayer, applyCombatDamage, traceShot, WORLD } from '../public/voxel-engine.js';
import { MONSTER_BODIES, monsterBodyProfile } from '../public/voxel-monster-bodies.js';
import { MONSTER_BESTIARY_ART, MONSTER_BESTIARY_IDS, MONSTER_VARIANT_IDS, appendMonsterBestiary } from '../public/voxel-monster-variants.js';
import { MONSTER_DEATH_RULES, MONSTER_DEATH_STYLES, monsterDeathPose } from '../public/voxel-monster-death.js';
import { MONSTER_SPECIAL_RULES, MONSTER_HEX_RULES, launchMonsterHex } from '../public/voxel-monster-specials.js';
import { monsterMeshes, monsterDeathMeshes, createMonsterDeathMeshPresenter, monsterSpecialMeshes, createMonsterSpecialImpactPresenter, createMonsterAnimationPresenter, VoxelRenderer } from '../public/voxel-renderer.js';

const arena = { id: 'bestiary-art', theme: 'forest', bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, colliders: [], sites: [] };
const actor = (monsterType, patch = {}) => ({ ...createCombatPlayer(7), monster: true, human: false, monsterType, lifeId: 1, x: 0, y: 0, z: 0, ...patch });
const human = (patch = {}) => ({ ...createCombatPlayer(0), human: true, monster: false, connected: true, participating: true, lifeId: 1, ...patch });
const scene = players => ({ gameId: 'voxel-horde', mapId: arena.id, map: arena, phase: 'fight', round: 1, tick: 100, eventId: 0, events: [], players, horde: { specialId: 0, projectiles: [], hazards: [] } });
const digest = array => createHash('sha256').update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)).digest('hex');
const points = array => Array.from({ length: array.length / 10 }, (_, index) => [...array.slice(index * 10, index * 10 + 3)]);
const inside = (point, box, tolerance = 2e-6) => ['x','y','z'].every((axis,index) => point[index] >= box[axis]-tolerance && point[index] <= box[axis]+box[['w','h','d'][index]]+tolerance);
const death = type => ({ key: `${type}:7:1`, targetId: 7, lifeId: 1, monsterType: type, x: 0, y: 0, z: 0, yaw: .731, dx: .6, dz: -.4 });
function harness() {
  const calls = { creates: 0, allocations: 0 };
  const gl = new Proxy({}, { get(_, key) {
    if (key === 'getShaderParameter' || key === 'getProgramParameter') return () => true;
    if (key === 'getAttribLocation') return () => 0;
    if (key === 'getUniformLocation') return (_program, uniform) => uniform;
    if (key === 'createBuffer') return () => { calls.creates++; return {}; };
    if (key === 'bufferData') return () => { calls.allocations++; };
    if (typeof key === 'string' && key.startsWith('create')) return () => ({});
    return () => {};
  } });
  return { renderer: new VoxelRenderer({ getContext: () => gl, getBoundingClientRect: () => ({ width: 960, height: 540 }), addEventListener() {}, removeEventListener() {} }), calls };
}

test('six authored species have distinct geometric silhouettes and recognizable voxel landmarks', () => {
  assert.deepEqual(MONSTER_BESTIARY_IDS, ['vampire','witch','wolf','pig','rat','stag']);
  assert.deepEqual(MONSTER_VARIANT_IDS, ['bomber','spitter','weaver'], 'prior variant catalog contract is preserved');
  const geometry = new Set();
  for (const type of MONSTER_BESTIARY_IDS) {
    const player = actor(type), before = structuredClone(player), mesh = monsterMeshes(player), positions = new Float32Array(mesh.length / 10 * 3);
    for (let at=0; at<mesh.length; at+=10) positions.set(mesh.subarray(at,at+3), at/10*3);
    geometry.add(digest(positions)); assert.ok(mesh.every(Number.isFinite) && mesh.length % 30 === 0);
    assert.ok(mesh.length/10 <= 1650 && mesh.length > 0, `${type}: bounded full silhouette`);
    assert.deepEqual(player,before); assert.ok(Object.isFrozen(MONSTER_BESTIARY_ART[type]));
  }
  assert.equal(geometry.size,6,'palette swaps cannot satisfy distinct original species');
  const vampire = points(monsterMeshes(actor('vampire'))), witch = points(monsterMeshes(actor('witch'))), wolf = points(monsterMeshes(actor('wolf'))), pig = points(monsterMeshes(actor('pig'))), rat = points(monsterMeshes(actor('rat'))), stag = points(monsterMeshes(actor('stag')));
  assert.ok(vampire.some(([x,y,z])=>Math.abs(x)<.17 && y<.7 && z>.17),'crimson-lined long back cape');
  assert.ok(vampire.some(([x,y,z])=>Math.abs(x)<.06 && y>1.53 && y<1.57 && z<-.13),'two exposed pale fangs');
  assert.ok(witch.some(([x,y])=>Math.abs(x)<.024 && y>1.79) && witch.some(([x,y])=>Math.abs(x)>.15&&y>1.64&&y<1.69),'stepped pointed hat and wide brim');
  assert.ok(witch.some(([x,y,z])=>x>.14&&y>1.20&&z<.03),'crystal staff at the actual right-hand grasp');
  assert.ok(wolf.some(([,y])=>y>.96) && wolf.some(([,y,z])=>y>.62&&z>.3),'lupine ears and bushy rear tail');
  assert.ok(pig.some(([x,y,z])=>Math.abs(x)>.1&&y<.53&&z<-.49),'broad pig snout instead of a dog muzzle');
  assert.ok(rat.some(([,y,z])=>z>.22&&y<.15) && rat.some(([x,y,z])=>Math.abs(x)>.05&&y>.18&&y<.214&&z<-.197),'real thin tail and muzzle whiskers');
  assert.ok(stag.filter(([x,y])=>Math.abs(x)>.23&&y>1.53).length>20,'two original branching antlers');
});

test('real flesh, ears, tails, antlers and articulated feet fit their trusted species shooting and wall envelopes', () => {
  for (const type of MONSTER_BESTIARY_IDS) for (const yaw of [0,.731,1.621]) for (let phase=0;phase<12;phase++) for (const airborne of [false,true]) for (const monsterState of ['chase',type==='witch'?'hexing':'windup','recover']) {
    const player = actor(type,{yaw,monsterState,attackTicks:5,attackDuration:96,grounded:!airborne});
    const before=structuredClone(player), animation={phase:phase*Math.PI/6,stride:1,run:1,forward:.7,strafe:.7,airborne,jump:.8};
    const mesh=monsterMeshes(player,1000,animation), body=monsterBodyProfile(player), c=Math.cos(yaw),s=Math.sin(yaw);
    for(let at=0;at<mesh.length;at+=10){
      const x=c*mesh[at]+s*mesh[at+2],y=mesh[at+1],z=-s*mesh[at]+c*mesh[at+2];
      if(body) assert.ok(body.boxes.some(box=>inside([x,y,z],box)),`${type}: every visible flesh/accessory corner belongs to real anatomy`);
      else assert.ok(y>=-2e-6 && y<=WORLD.standHeight+2e-6 && Math.hypot(x,z)<=(y>1.48+2e-6?.22:.29)+2e-6,`${type}: humanoid core envelope`);
      assert.ok(Math.hypot(x,z)<=(body?.radius??WORLD.radius)+2e-6,`${type}: no corner suggests a larger collision body`);
    }
    assert.deepEqual(player,before);
  }
});

test('walking, accepted attack load and recovery animate every species while settled/stopped art stays stable', () => {
  for(const type of MONSTER_BESTIARY_IDS){
    const player=actor(type), idle=monsterMeshes(player,0,{phase:0,stride:0}), walk=monsterMeshes(player,0,{phase:Math.PI/2,stride:1,run:.8}), other=monsterMeshes(player,0,{phase:Math.PI*1.5,stride:1,run:.8});
    assert.notEqual(digest(walk),digest(idle));assert.notEqual(digest(walk),digest(other),'opposing feet really move');
    assert.deepEqual(monsterMeshes(player,99999,{phase:5,stride:0}),idle,'clock alone cannot slide idle feet or flutter clothing');
    const state=type==='witch'?'hexing':['vampire','pig'].includes(type)?'lungeWindup':'windup';
    const telling={...player,monsterState:state,attackDuration:96,attackTicks:1}, charged=monsterMeshes(telling,0,{phase:0,stride:0});
    assert.notEqual(digest(charged),digest(idle),`${type}: accepted tell changes real anatomy and eye/staff glow`);
    const present=createMonsterAnimationPresenter();present({...telling,attackTicks:96},0,'round');present(telling,100,'round');
    let pose=present({...telling,monsterState:'recover',attackTicks:0},110,'round');assert.equal(pose.attack.phase,'contact');
    const released=monsterMeshes({...telling,monsterState:'recover',attackTicks:0},110,pose);
    pose=present({...telling,monsterState:'recover',attackTicks:0},260,'round');assert.equal(pose.attack.phase,'recovery');
    assert.notEqual(digest(monsterMeshes({...telling,monsterState:'recover',attackTicks:0},260,pose)),digest(released));
    const held=present({...telling,monsterState:'recover',attackTicks:0},270,'round',{paused:true});
    assert.deepEqual(present({...telling,monsterState:'recover',attackTicks:0},800,'round',{paused:true}).attack,held.attack);
  }
});

test('real stag antler branches receive headshots while the visible gap between them stays empty at every facing', () => {
  const boxes=[];
  appendMonsterBestiary({box(x,y,z,w,h,d){boxes.push({x,y,z,w,h,d});}},actor('stag'),{x:0,y:0,z:0,yaw:0});
  for(let turn=0;turn<32;turn++) for(const [x,y,expected] of [[0,1.55,'none'],[-.05,1.55,'none'],[.05,1.55,'none'],[-.25,1.60,'head'],[.25,1.60,'head']]){
    const yaw=turn*Math.PI/16, c=Math.cos(yaw),s=Math.sin(yaw), target=actor('stag',{id:1,yaw}), world=scene([human(),target]);
    const visible=boxes.some(box=>x>=box.x&&x<=box.x+box.w&&y>=box.y&&y<=box.y+box.h);
    assert.equal(visible,expected==='head','the authored branch or gap is real geometry');
    const hit=traceShot(world,0,{x:c*x+s*3,y,z:s*x-c*3},{x:-s,y:0,z:c},10,arena);
    assert.equal(hit.kind,expected,`visible antlers and authority agree at yaw ${yaw}`);
    if(expected==='head')assert.equal(hit.playerId,target.id);
  }
});

test('all six corpses retain original anatomy, collapse with their actual cadence, ground on cover and reuse cached buffers', () => {
  const platform={...arena,colliders:[{x:-5,y:0,z:-5,w:10,h:2,d:10}]}, present=createMonsterDeathMeshPresenter();
  const deaths=MONSTER_BESTIARY_IDS.map((type,id)=>({...death(type),key:`${id}:1`,targetId:id,y:2,ageMs:0}));
  const signatures=new Set();
  for(const corpse of deaths){
    const fresh=monsterDeathMeshes(corpse,0,platform), collapsed=monsterDeathMeshes(corpse,MONSTER_DEATH_STYLES[corpse.monsterType].collapseMs,platform), dissolve=monsterDeathMeshes(corpse,950,platform);
    assert.ok(fresh.length>0&&collapsed.length>0&&dissolve.length<fresh.length);assert.notDeepEqual(collapsed,fresh);
    signatures.add(digest(fresh));
    assert.equal(monsterDeathPose(corpse,MONSTER_DEATH_STYLES[corpse.monsterType].collapseMs).collapse,1);
    for(const age of [0,100,210,300,455,640,950])assert.ok(points(monsterDeathMeshes(corpse,age,platform)).every(([,y])=>y>=2-2e-6),'all real pieces stay above the actual supporting platform');
    assert.equal(monsterDeathMeshes(corpse,MONSTER_DEATH_RULES.durationMs,platform).length,0);
  }
  assert.equal(signatures.size,6);
  const first=present(deaths,platform), buffer=first.buffer;assert.equal(present.getStats().geometryBuilds,6);
  for(const ageMs of [100,300,455,640,950]){const next=present(deaths.map(corpse=>({...corpse,ageMs})),platform);assert.equal(next.buffer,buffer);assert.equal(present.getStats().geometryBuilds,6);}
  present.reset();assert.equal(present.getStats().geometryBuilds,0);
});

test('every new collapse, hold and late dissolve clears nearby corner cover including its bounded breakup drift', () => {
  const configurations=[
    {ground:0,walls:[{x:-2,y:0,z:-6.05,w:4,h:3,d:.3}],supports:[]},
    {ground:3,walls:[{x:.58,y:3,z:-6.8,w:.3,h:3,d:3.6},{x:-2,y:3,z:-5.9,w:2.7,h:3,d:.3}],supports:[{x:-10,y:0,z:-12,w:20,h:3,d:20}]},
  ];
  for(const {ground,walls,supports} of configurations)for(const type of MONSTER_BESTIARY_IDS){
    const map={...arena,colliders:[...supports,...walls]}, corpse={...death(type),x:0,y:ground,z:-5,yaw:.6,dx:.25,dz:-1};
    for(let age=0;age<MONSTER_DEATH_RULES.durationMs;age+=12){
      const mesh=monsterDeathMeshes(corpse,age,map);assert.ok(mesh.every(Number.isFinite));
      for(let at=0;at<mesh.length;at+=10){
        const [x,y,z]=mesh.subarray(at,at+3);assert.ok(y>=ground-2e-6);
        for(const wall of walls)assert.equal(x>wall.x+1e-6&&x<wall.x+wall.w-1e-6&&y>wall.y+1e-6&&y<wall.y+wall.h-1e-6&&z>wall.z+1e-6&&z<wall.z+wall.d-1e-6,false,`${type}/${age}/${ground}: true corpse pieces never drift into cover`);
      }
    }
  }
});

test('witch hex art follows the real physical tip, shared pool, life identity, rear cover and bounded confirmed impact', () => {
  const witch=actor('witch',{id:1}), state=scene([human(),witch]);assert.equal(launchMonsterHex(state,witch,0,0),true);
  const projectile=state.horde.projectiles[0], before=structuredClone(state), mesh=monsterSpecialMeshes(state,arena);
  assert.equal(mesh.hexes,1);assert.equal(mesh.shards,0);assert.equal(mesh.world.length/10,72);
  assert.ok(points(mesh.world).every(([x,y,z])=>z>=projectile.z&&Math.abs(x-projectile.x)<=.023&&Math.abs(y-projectile.y)<=.023));
  const wall={x:-2,y:0,z:projectile.z+.15,w:4,h:3,d:.02};assert.ok(points(monsterSpecialMeshes(state,{...arena,colliders:[wall]}).world).every(([, , z])=>z<wall.z));
  state.horde.projectiles=Array.from({length:40},(_,index)=>({...projectile,id:index+1,x:index*.1}));assert.equal(monsterSpecialMeshes(state,arena).hexes,MONSTER_SPECIAL_RULES.maxProjectiles);
  const contact={...projectile,type:'monsterHex',stage:'impact',playerId:witch.id,specialId:1,tick:100,x:0,y:.3,z:-3};
  const impact=createMonsterSpecialImpactPresenter(), particles=impact(contact,state,1000);assert.equal(particles.length,4);assert.ok(particles.every(item=>item.cover&&item.life<=150&&item.radius<=.22));assert.equal(impact(contact,state,1000).length,0);
  for(const patch of [{stage:'windup'},{stage:'release'},{sourceLifeId:2},{tick:81}])assert.equal(createMonsterSpecialImpactPresenter()({...contact,...patch},state,1000).length,0);
  witch.lifeId++;assert.equal(monsterSpecialMeshes(state,arena).hexes,0);witch.lifeId--;state.horde.projectiles=[projectile];assert.deepEqual(state,before);
  assert.equal(MONSTER_HEX_RULES.ticks,540);
});

test('twenty mixed bestiary actors and their full corpse templates reuse existing world batches and effect budgets', () => {
  const {renderer,calls}=harness(), local=human(), players=[local,...Array.from({length:20},(_,index)=>actor(MONSTER_BESTIARY_IDS[index%6],{id:index+1,x:(index%5-2)*2,z:-5-Math.floor(index/5)*3}))], state=scene(players);
  renderer.render(state,{localId:0,time:0});
  const corpse=Array.from({length:20},(_,index)=>({...death(MONSTER_BESTIARY_IDS[index%6]),key:`dead:${index}:1`,targetId:index+1,x:15,y:0,z:-index*.3,ageMs:0}));
  renderer.presentMonsterDeaths=Object.assign(()=>corpse,{reset(){},getStats(){return{};}});
  renderer.render(state,{localId:0,time:10});const creates=calls.creates,allocations=calls.allocations;
  for(const time of [20,40,60]){renderer.render(state,{localId:0,time});assert.equal(calls.creates,creates);assert.equal(calls.allocations,allocations);assert.ok(renderer.stats.drawCalls<=7&&renderer.stats.dynamicVertices<=72000);}
  const poses=renderer.stats.monsterAnimation.poses;assert.equal(poses.length,20);assert.ok(poses.filter(pose=>MONSTER_BODIES[pose.monsterType]).every(pose=>pose.feet.length===4));
  renderer.destroy();
});

test('twenty largest species plus twenty fresh largest corpses and twenty heavy pickups retain the whole-frame upload cap', () => {
  const {renderer,calls}=harness(), local={...human(),weapon:'odin',ammo:100,slot:'primary'}, monsters=Array.from({length:20},(_,index)=>actor('stag',{id:index+1,team:1,lifeId:index+1,x:(index%5-2)*3,z:-8-Math.floor(index/5)*3,hp:40,maxHp:40,slot:'empty'})), state=scene([local,...monsters]);
  renderer.render(state,{localId:0,time:0});state.tick++;
  applyCombatDamage(state,monsters.map(player=>({playerId:0,targetId:player.id,targetLifeId:player.lifeId,attack:'gun',weapon:'carbine',damage:player.hp,dz:-1})));
  state.players=[local,...monsters.map(player=>({...player,alive:true,hp:40,lifeId:player.lifeId+100,x:player.x+1}))];
  state.loot=Array.from({length:20},(_,id)=>({id,kind:'weapon',weapon:'odin',x:(id%5-2)*3,y:0,z:-8-Math.floor(id/5)*3,amount:1}));
  renderer.render(state,{localId:0,time:10});const created=calls.creates,allocated=calls.allocations;
  assert.equal(renderer.stats.monsterDeaths.activeCorpses,20);assert.equal(renderer.stats.monsterDeaths.vertices,20*1512);assert.equal(renderer.stats.lootItems,20);
  for(const time of [20,40,60]){renderer.render(state,{localId:0,time});assert.ok(renderer.stats.dynamicVertices<72000,`actual first-person gun, live bodies, full corpses, heavy loot and contact effects stay within the existing cap: ${renderer.stats.dynamicVertices}`);assert.ok(renderer.stats.drawCalls<=7);assert.equal(calls.creates,created);assert.equal(calls.allocations,allocated);}
  renderer.destroy();
});

test('invalid new species identities/poses cannot append partial art or unbounded auxiliary geometry', () => {
  for(const player of [null,actor('__proto__'),actor('missing'),actor(['wolf']),actor(new String('wolf')),actor('wolf',{human:true}),actor('rat',{monster:false})]){
    let count=0;assert.equal(appendMonsterBestiary({box(){count++;}},player,{x:0,y:0,z:0,yaw:0}),false);assert.equal(count,0);
  }
  for(const pose of [null,{x:NaN,y:0,z:0,yaw:0},{x:0,y:Infinity,z:0,yaw:0}]){let count=0;assert.equal(appendMonsterBestiary({box(){count++;}},actor('vampire'),pose),false);assert.equal(count,0);}
  const fallback=monsterMeshes(actor('missing'));
  for(const type of [['wolf'],new String('wolf'),'__proto__','constructor'])assert.deepEqual(monsterMeshes(actor(type)),fallback,'invalid identities follow the existing ordinary fallback, without coerced new anatomy');
});


test('actual health bars use the rendered species bodies and disappear behind complete real cover', () => {
  for(const type of MONSTER_BESTIARY_IDS){
    const {renderer}=harness(), target=actor(type,{id:1,z:-8,hp:37,maxHp:90}), state=scene([human(),target]);
    renderer.render(state,{localId:0,time:0});
    const label=renderer.worldLabels.find(label=>label.id===1);assert.ok(label,`${type}: a visible body gets an actual health bar`);assert.equal(label.hp,37);assert.equal(label.maxHp,90);
    const height=MONSTER_BODIES[type]?.height??WORLD.standHeight;
    state.map={...arena,colliders:[{id:'species-cover',x:-2,y:0,z:-6.5,w:4,h:height+.4,d:.12}]};
    renderer.render(state,{localId:0,time:10});assert.equal(renderer.worldLabels.some(label=>label.id===1),false,`${type}: blocked flesh cannot leak floating health`);renderer.destroy();
  }
});
