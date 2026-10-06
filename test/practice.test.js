import assert from 'node:assert/strict';
import test from 'node:test';
import {createState,startMatch,step,emptyInput,cloneState,ARENA} from '../public/engine.js';
import {botInput,TRAINING_STAGES} from '../public/practice.js';

test('five training opponents use distinct visible strategies without reading player input',()=>{
 const state=createState();startMatch(state);for(let n=0;n<360;n++)step(state);
 const actions=new Map(),cadence=new Map();
 for(const profile of TRAINING_STAGES){const observed=new Set(),sequence=[];
  for(let tick=360;tick<1200;tick++){
   const sample=cloneState(state);sample.tick=tick;sample.fighters[0].x=490;sample.fighters[1].x=630;
   const action=botInput(sample,1,profile.id);observed.add(JSON.stringify(action));sequence.push(JSON.stringify(action));
   assert.ok(Object.values(action).every(value=>typeof value==='boolean'));
   sample.fighters[0].previousInput={...emptyInput(),heavy:true,jump:true};
   assert.deepEqual(botInput(sample,1,profile.id),action);
  }
  actions.set(profile.id,observed);cadence.set(profile.id,sequence);
 }
 assert.ok([...actions.get('foundations')].every(raw=>!JSON.parse(raw).light));
 assert.ok([...actions.get('guard')].some(raw=>JSON.parse(raw).block));
 assert.ok([...actions.get('air')].some(raw=>JSON.parse(raw).jump));
 assert.notDeepEqual(cadence.get('pressure'),cadence.get('master'));
});

test('each practice matchup remains deterministic, finishes, and keeps simulation bounded',()=>{
 for(const profile of TRAINING_STAGES){
  const a=createState();startMatch(a);const b=cloneState(a);
  for(let tick=0;tick<60000 && a.phase!=='matchEnd';tick++){
   const inputs=[botInput(a,0,'master'),botInput(a,1,profile.id)];step(a,inputs);step(b,inputs);
   for(const f of a.fighters){assert.ok(Number.isFinite(f.x+f.y+f.hp+f.stamina));assert.ok(f.x>=ARENA.minX && f.x<=ARENA.maxX);assert.ok(f.hp>=0 && f.hp<=100);}
  }
  assert.equal(a.phase,'matchEnd',profile.id);assert.deepEqual(a,b);assert.ok(a.events.length<=48);
 }
});


test('normal legal combat wins every stage of the five-opponent training ladder', t => {
 const styles={foundations:'master',guard:'guard',air:'master',pressure:'guard',master:'master'};
 let stagesCleared=0,totalTicks=0;
 for(const stage of TRAINING_STAGES){
  const state=createState();startMatch(state);
  for(let n=0;n<60000&&state.phase!=='matchEnd';n++)step(state,[botInput(state,0,styles[stage.id]),botInput(state,1,stage.id)]);
  assert.equal(state.phase,'matchEnd',stage.id);assert.equal(state.winner,0,stage.id);
  assert.equal(state.fighters[0].wins,2,'each advancement follows two visible round wins');
  assert.ok(state.fighters[0].hp>0);stagesCleared++;totalTicks+=state.tick;
 }
 assert.equal(stagesCleared,5);
 t.diagnostic(`All five ladder opponents defeated using ordinary controls in ${(totalTicks/120).toFixed(1)} simulated seconds.`);
});
