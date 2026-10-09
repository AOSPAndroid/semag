import assert from 'node:assert/strict';
import test from 'node:test';
import * as Horde from '../public/voxel-horde-engine.js';
import * as Royale from '../public/voxel-royale-engine.js';
import { createPractice, startPractice, stepPractice } from '../public/voxel-practice-engine.js';
import { createCombatPlayer, applyCombatDamage, pickupCombatLoot, HEAL } from '../public/voxel-engine.js';
import { ensureInventory, createInventoryGun, createInventoryMelee, refreshInventory, inventoryTotal } from '../public/voxel-inventory.js';

const arena={id:'corpse-supply-arena',bounds:{minX:-25,maxX:25,minZ:-22,maxZ:22},colliders:[],spawns:Horde.MAPS.courtyard.spawns};
const advance=(state,n,input=[])=>{for(let i=0;i<n;i++)Horde.step(state,input);};
function spawned({capacity=1,ids=[0],type='hound',seed=291,wave=1}={}){
  const state=Horde.createState({capacity,seed});Horde.startMatch(state,ids);advance(state,state.phaseTicks);
  state.map=arena;state.horde.wave=wave;state.horde.pending=1;state.horde.nextSpawnTick=1e9;
  for(const id of ids)Object.assign(state.players[id],{x:id*3,y:0,z:0,vx:0,vy:0,vz:0});
  state.spawnWarnings=[{id:1,x:0,y:0,z:-6,ticksLeft:1,monsterType:type}];Horde.step(state);
  const monster=state.players.find(player=>player.monster);assert.ok(monster);monster.emergenceTicks=100000;
  return{state,monster,player:state.players[ids[0]]};
}
function kill(state,monster){applyCombatDamage(state,[{playerId:0,targetId:monster.id,damage:monster.hp,attack:'gun',weapon:'carbine'}]);Horde.step(state);}
function collect(state,player,kind,amount=1){const loot={id:++state.horde.lootId,kind,amount,x:player.x,y:player.y,z:player.z,expiresTick:state.tick+5400};state.loot.push(loot);assert.equal(pickupCombatLoot(state,player,loot),true);}

test('fresh generic, Horde and practice actors have knife plus chosen gun with no consumables, while Royale stays knife-only',()=>{
  const combat=createCombatPlayer(0,1,'revolver');assert.deepEqual(combat.inventory.map(item=>item?.weapon??null),['knife','revolver',null,null]);assert.equal(combat.potions+combat.grenades,0);
  const horde=Horde.createState({melee:'katana'});Horde.selectLoadout(horde,0,'sniper');Horde.startMatch(horde);assert.deepEqual(horde.players[0].inventory.map(item=>item?.weapon??null),['knife','sniper',null,null]);
  const practice=createPractice({bots:2,weapon:'revolver',melee:'axe',seed:1});startPractice(practice);assert.deepEqual(practice.players[0].inventory.map(item=>item?.weapon??null),['knife','revolver',null,null]);assert.ok(practice.players.every(player=>player.potions+player.grenades===0));
  const royale=Royale.createState({capacity:2,seed:1});Royale.startMatch(royale,[0,1]);assert.ok(royale.players.every(player=>player.inventory[0]?.weapon==='knife'&&player.inventory.slice(1).every(item=>item===null)&&player.potions+player.grenades===0));
});

test('legacy actors without supply fields never invent potions or grenades',()=>{
  const legacy={weapon:'pistol',slot:'primary'};ensureInventory(legacy);assert.equal(legacy.potions+legacy.grenades,0);assert.deepEqual(legacy.inventory.map(item=>item?.weapon??null),['knife','pistol',null,null]);
});

test('a fifth genuine monster kill guarantees exactly one carryable potion and replaying the dead life never duplicates it',()=>{
  const{state,monster,player}=spawned();player.hp=50;state.horde.killsSinceHeal=4;kill(state,monster);
  const potion=state.loot.find(item=>item.kind==='heal');assert.ok(potion);assert.equal(potion.type,'potion');assert.equal(potion.amount,1);assert.equal(potion.item.amount,1);assert.equal(player.hp,50);assert.equal(player.potions,0);assert.equal(state.horde.killsSinceHeal,0);
  const id=potion.id,total=state.loot.length,kills=state.horde.totalKills;advance(state,500);applyCombatDamage(state,[{playerId:0,targetId:monster.id,damage:999,attack:'gun',weapon:'carbine'}]);Horde.step(state);
  assert.equal(state.loot.length,total);assert.equal(state.loot.filter(item=>item.id===id).length,1);assert.equal(state.horde.totalKills,kills);
});

test('actual E collects corpse medicine into a slot at full health and its later use runs the real two-second heal channel',()=>{
  const{state,monster,player}=spawned();state.horde.killsSinceHeal=4;kill(state,monster);Object.assign(player,{x:monster.x,z:monster.z});
  Horde.step(state,[{interact:true}]);assert.equal(player.hp,player.maxHp);assert.equal(player.potions,1);assert.ok(state.events.some(event=>event.type==='lootPickup'&&event.kind==='heal'));assert.ok(!state.loot.some(item=>item.kind==='heal'));
  player.hp=50;Horde.step(state);Horde.step(state,[{heal:true}]);assert.equal(player.potions,0);assert.equal(player.healTicks,HEAL.ticks);assert.equal(player.hp,50);
  advance(state,HEAL.ticks-1);assert.equal(player.hp,50);advance(state,1);assert.equal(player.hp,50+HEAL.amount);assert.equal(player.healTicks,0);
});

test('corpse potions obey real range, height and cover checks before any inventory mutation',()=>{
  const{state,monster,player}=spawned();state.horde.killsSinceHeal=4;kill(state,monster);const potion=state.loot.find(item=>item.kind==='heal');Object.assign(player,{x:potion.x,z:potion.z+1});
  const blocked={...arena,colliders:[{id:'wall',x:-10,y:0,z:potion.z+.5,w:20,h:4,d:.15}]};state.map=blocked;assert.equal(Horde.findNearbyLoot(state,0),null);Horde.step(state,[{interact:true}]);assert.equal(player.potions,0);
  state.map=arena;potion.y=2;assert.equal(Horde.findNearbyLoot(state,0),null);potion.y=0;player.z=potion.z+Horde.HORDE_RULES.pickupRange+.001;assert.equal(Horde.findNearbyLoot(state,0),null);
  player.z=potion.z+Horde.HORDE_RULES.pickupRange-.001;assert.equal(Horde.findNearbyLoot(state,0),potion);
});

test('two survivors cannot both collect the same corpse supply on one authoritative tick',()=>{
  const{state,monster}=spawned({capacity:2,ids:[0,1]});state.horde.killsSinceHeal=4;kill(state,monster);const potion=state.loot.find(item=>item.kind==='heal');
  Object.assign(state.players[0],{x:potion.x-.6,z:potion.z});Object.assign(state.players[1],{x:potion.x+.6,z:potion.z});
  Horde.step(state,[{interact:true},{interact:true}]);assert.equal(state.players[0].potions+state.players[1].potions,1);assert.equal(state.loot.filter(item=>item.id===potion.id).length,0);assert.equal(state.events.filter(event=>event.type==='lootPickup'&&event.lootId===potion.id).length,1);
});

test('every potion stack stays capped at two and a full pack leaves all uncollected medicine on the ground',()=>{
  const{state,player}=spawned();player.inventory=[createInventoryMelee('knife'),createInventoryGun('carbine'),{kind:'heal',amount:1},createInventoryGun('pistol')];refreshInventory(player);
  const loot={id:++state.horde.lootId,type:'potion',kind:'heal',amount:3,x:player.x,y:0,z:player.z,expiresTick:state.tick+5400};state.loot.push(loot);
  Horde.step(state,[{interact:true}]);assert.equal(player.potions,2);assert.equal(player.inventory[2].amount,2);assert.equal(loot.amount,2);assert.equal(Horde.findNearbyLoot(state,0),null);
  Horde.step(state);Horde.step(state,[{interact:true}]);assert.equal(loot.amount,2);assert.equal(player.potions,2);
});

test('wave clear never hands out consumables or refunds a potion already committed to an interrupted heal',()=>{
  const{state,player,monster}=spawned({wave:2});player.hp=50;collect(state,player,'heal');Horde.step(state,[{heal:true}]);assert.equal(player.healTicks,HEAL.ticks);assert.equal(player.potions,0);
  state.horde.pending=0;kill(state,monster);assert.equal(state.phase,'intermission');assert.equal(player.healTicks,0);assert.equal(player.potions,0);assert.equal(player.grenades,0);assert.equal(player.hp,85);assert.equal(player.sprinting,false);assert.equal(player.stamina,100);
});

test('fresh Horde rematches discard found blades and supplies while retaining the selected gun',()=>{
  const{state,player}=spawned();collect(state,player,'heal',2);collect(state,player,'grenade');player.inventory[0]=createInventoryMelee('katana');refreshInventory(player);player.stamina=1;player.sprinting=true;
  Horde.resetLobby(state);const fresh=state.players[0];assert.deepEqual(fresh.inventory.map(item=>item?.weapon??null),['knife','carbine',null,null]);assert.equal(fresh.potions+fresh.grenades,0);assert.equal(fresh.stamina,100);assert.equal(fresh.sprinting,false);
});

test('fixed knife RPC validation is pure and cannot overwrite a found blade or create a new item between waves',()=>{
  const{state,player}=spawned();state.phase='intermission';player.inventory[0]=createInventoryMelee('tonfas');refreshInventory(player);const before=structuredClone(state);
  assert.equal(Horde.validateMeleeChoice(state,0,'knife').ok,false);assert.equal(Horde.chooseMelee(state,0,'katana').ok,false);assert.deepEqual(state,before);
});

test('unarmed beasts never drop grenades, while later armed corpses provide scarce seeded frags',()=>{
  let grenades=0;
  for(let seed=1;seed<=40;seed++){
    for(const type of['hound','leaper','screecher']){const{state,monster}=spawned({seed,type,wave:5});kill(state,monster);assert.ok(state.loot.every(item=>!['grenade','weapon','melee'].includes(item.kind)),`${type}/${seed}`);}
    const{state,monster}=spawned({seed,type:'gunner',wave:4});kill(state,monster);grenades+=state.loot.filter(item=>item.kind==='grenade').length;
    assert.ok(state.loot.filter(item=>item.kind==='grenade').every(item=>item.amount===1));assert.ok(state.loot.length<=Horde.HORDE_RULES.maxLoot);
  }
  assert.ok(grenades>0&&grenades<10,`frags should be discoverable but scarce: ${grenades}/40`);
});

test('Breach combat practice drops a carryable heal for a real bot kill and the local player must collect it',()=>{
  const state=createPractice({bots:2,mode:'targets',seed:291});startPractice(state);while(state.phase==='countdown')stepPractice(state);state.map=arena;
  const player=state.players[0],bot=state.players[1];Object.assign(player,{x:0,y:0,z:0});Object.assign(bot,{x:0,y:0,z:-1,hp:1});
  Object.assign(state.players[2],{x:20,y:0,z:20});
  applyCombatDamage(state,[{playerId:0,targetId:1,damage:1,attack:'gun',weapon:'carbine'}]);
  const potion=state.loot.find(item=>item.kind==='heal');assert.ok(potion);assert.equal(player.potions,0);assert.equal(potion.amount,1);assert.equal(inventoryTotal(bot,'heal'),0);
  stepPractice(state,{interact:true});assert.equal(player.potions,1);assert.equal(state.loot.some(item=>item.id===potion.id),false);assert.deepEqual(player.inventory.map(item=>item?.weapon??item?.kind??null),['knife','carbine','heal',null]);
});
