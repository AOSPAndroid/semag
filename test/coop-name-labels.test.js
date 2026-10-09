import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../public/topdown-engine.js';
import { TopdownRenderer } from '../public/topdown-renderer.js';

// Record the real Canvas renderer. All state comes from the actual Dungeon engine.
function fixture({ width=960, height=640, reducedMotion=false }={}) {
  const previous={ document:globalThis.document, window:globalThis.window, ResizeObserver:globalThis.ResizeObserver };
  const calls=[];let assets=0,layouts=0,measurements=0;
  const context=()=>{
    const properties={ globalAlpha:1, lineWidth:1 },stack=[];
    return new Proxy(properties,{ get(target,key){
      if(key in target)return target[key];
      if(key==='save')return()=>stack.push({ ...properties });
      if(key==='restore')return()=>{const saved=stack.pop();if(saved)Object.assign(properties,saved);};
      if(key==='measureText')return text=>{measurements++;return{ width:Array.from(text).reduce((n,char)=>n+(char.codePointAt(0)>127?12:7),0) };};
      if(key==='createLinearGradient'||key==='createRadialGradient')return()=>({ addColorStop(){} });
      if(['fillText','strokeText','fillRect','drawImage','setTransform'].includes(key))return(...args)=>calls.push({ op:key,args,color:properties.fillStyle,font:properties.font,align:properties.textAlign });
      return()=>{};
    },set(target,key,value){target[key]=value;return true;}});
  };
  const canvas=()=>{const ctx=context();return{ width,height,getContext:()=>ctx,getBoundingClientRect(){layouts++;return{width,height};} };};
  globalThis.document={ createElement(tag){assert.equal(tag,'canvas');assets++;return canvas();} };
  globalThis.window={ devicePixelRatio:1,matchMedia:()=>({matches:reducedMotion}) };
  globalThis.ResizeObserver=class{observe(){}disconnect(){}};
  const renderer=new TopdownRenderer(canvas());calls.length=0;
  return{renderer,calls,get assets(){return assets;},get layouts(){return layouts;},get measurements(){return measurements;},restore(){renderer.destroy();for(const[key,value]of Object.entries(previous))if(value===undefined)delete globalThis[key];else globalThis[key]=value;} };
}
function withRenderer(options,work){const env=fixture(options);try{work(env);}finally{env.restore();}}
function dungeon(){const state=game.createState('coop');game.startMatch(state);for(let i=0;i<360;i++)game.step(state,[game.emptyInput(),game.emptyInput()]);return state;}
const roster=()=>[{name:'Camille',connected:true},{name:'Jules',connected:true}];
const names=env=>env.calls.filter(call=>call.op==='fillText'&&call.font==='bold 12px system-ui');

test('Dungeon actual roster names appear compactly above both heroes without mutating combat or roster',()=>withRenderer({},env=>{
  const state=dungeon(),players=roster(),before=structuredClone(state),people=structuredClone(players);
  env.renderer.render(state,{players,localId:0,time:1000});
  const labels=names(env);assert.deepEqual(labels.map(call=>call.args[0]),['Camille','Jules']);
  for(let i=0;i<2;i++){
    assert.equal(labels[i].args[1],state.fighters[i].x);assert.equal(labels[i].args[2],state.fighters[i].y-43);
    assert.equal(labels[i].align,'center');assert.ok(env.calls.some(call=>call.op==='strokeText'&&call.args[0]===players[i].name),'each label has a dark outline');
  }
  assert.deepEqual(state,before);assert.deepEqual(players,people);
}));

test('labels use actual connected seats and disappear on disconnect or missing preview roster',()=>withRenderer({},env=>{
  const state=dungeon(),players=roster();players[1].connected=false;
  env.renderer.render(state,{players,time:1000});assert.deepEqual(names(env).map(call=>call.args[0]),['Camille']);
  env.calls.length=0;env.renderer.render(state,{time:1010});assert.deepEqual(names(env),[]);
  env.calls.length=0;env.renderer.render(state,{players:[null,{connected:true,name:'   '}],time:1020});assert.deepEqual(names(env),[]);
}));

test('duel renders retain their original art without co-op name labels',()=>withRenderer({},env=>{
  const state=game.createState('duel');env.renderer.render(state,{players:roster(),time:1000});assert.deepEqual(names(env),[]);
}));

test('names preserve accented and emoji text, strip control and direction overrides, and draw literal markup',()=>withRenderer({},env=>{
  const state=dungeon(),players=[{connected:true,name:'  Éloïse 🥷\u0000\u202E  '},{connected:true,name:'<b>Jules</b>'}];
  env.renderer.render(state,{players,time:1000});assert.deepEqual(names(env).map(call=>call.args[0]),['Éloïse 🥷','<b>Jules</b>']);
  env.calls.length=0;players[0].name='🥷'.repeat(30);env.renderer.render(state,{players,time:1010});
  const name=names(env)[0].args[0];assert.ok(name.endsWith('…'));assert.equal(Array.from(name).filter(char=>char==='🥷').length,9);assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(name),'never split an emoji surrogate pair');
}));

test('long and edge names remain bounded inside the game canvas at narrow viewport sizes',()=>withRenderer({width:320,height:214},env=>{
  const state=dungeon();state.fighters[0].x=37;state.fighters[0].y=54;state.fighters[1].x=923;
  const players=[{name:'ABCDEFGHIJKLMNOPQRSTUVWX',connected:true},{name:'漢字'.repeat(15),connected:true}];
  env.renderer.render(state,{players,time:1000});
  for(const label of names(env)){const width=env.renderer.ctx.measureText(label.args[0]).width;assert.ok(width<=120);assert.ok(label.args[1]-width/2>=10);assert.ok(label.args[1]+width/2<=950);assert.ok(label.args[2]>=18);}
}));

test('a downed teammate keeps their name above the existing revive indicator',()=>withRenderer({},env=>{
  const state=dungeon();Object.assign(state.fighters[1],{hp:0,downed:true,action:'dead',reviveProgress:60});
  env.renderer.render(state,{players:roster(),time:1000});assert.deepEqual(names(env).map(call=>call.args[0]),['Camille','Jules']);assert.equal(names(env)[1].args[2],state.fighters[1].y-43);
}));

test('name updates are immediate and high refresh or reduced motion never allocates new name canvases',()=>{
  for(const reducedMotion of[false,true])withRenderer({reducedMotion},env=>{
    const state=dungeon(),players=roster();players[0].name='漢字'.repeat(15);env.renderer.render(state,{players,time:1000});const assets=env.assets,layouts=env.layouts,measurements=env.measurements;
    for(let i=0;i<240;i++)env.renderer.render(state,{players,time:1000+i*1000/240});
    assert.equal(env.assets,assets);assert.equal(env.layouts,layouts);assert.equal(env.measurements,measurements,'even long names reuse their measured truncation at 240 Hz');
    env.calls.length=0;players[1].name='Alex';env.renderer.render(state,{players,time:2001});assert.equal(names(env)[1].args[0],'Alex');assert.equal(env.measurements,measurements+1,'only the renamed seat is measured again');
  });
});

test('the name cache stays limited to two real seats and resets for a new room, biome or session',()=>withRenderer({},env=>{
  const state=dungeon(),players=roster();env.renderer.render(state,{players,time:1000});assert.equal(env.renderer.coopNames.size,2);let measurements=env.measurements;
  state.wave++;env.renderer.render(state,{players,time:1010});assert.equal(env.measurements,measurements+2);measurements=env.measurements;
  state.biome={id:'crypt'};env.renderer.render(state,{players,time:1020});assert.equal(env.measurements,measurements+2);
  for(let id=2;id<100;id++)env.renderer.heroName(env.renderer.ctx,{id,x:100,y:100},{name:'Extra',connected:true});assert.equal(env.renderer.coopNames.size,2);
  env.renderer.resetEffects();assert.equal(env.renderer.coopNames.size,0);env.renderer.render(state,{players,time:1030});assert.equal(env.renderer.coopNames.size,2);
  players[1].connected=false;env.renderer.render(state,{players,time:1040});assert.equal(env.renderer.coopNames.size,1);
}));

test('Dungeon existing monster health reflects actual health and retains depth occlusion by foreground pillars',()=>withRenderer({},env=>{
  const state=dungeon(),enemy=state.enemies.find(enemy=>enemy.type==='slime');assert.ok(enemy);
  Object.assign(enemy,{x:312,y:212,hp:20,maxHp:40,action:'idle'});state.enemies=[enemy];state.obstacles=[{id:'cover',type:'pillar',x:285,y:186,w:54,h:76}];
  env.renderer.render(state,{players:roster(),time:1000});
  const bar=env.calls.findIndex(call=>call.op==='fillRect'&&call.color==='#bcaa7d');assert.ok(bar>=0);assert.deepEqual(env.calls[bar].args,[297,236,15,3]);
  const pillar=env.calls.findIndex(call=>call.op==='drawImage'&&call.args[1]===271&&call.args[2]===169);assert.ok(pillar>bar,'foreground cover paints over the sprite and health bar');
  assert.ok(297>=285&&297+30<=339&&236>=186&&236+3<=262,'the entire bar is inside the covering pillar face');
  env.calls.length=0;enemy.y=292;env.renderer.render(state,{players:roster(),time:1010});
  const foregroundBar=env.calls.findIndex(call=>call.op==='fillRect'&&call.color==='#bcaa7d'),behindPillar=env.calls.findIndex(call=>call.op==='drawImage'&&call.args[1]===271&&call.args[2]===169);assert.ok(foregroundBar>behindPillar,'visible monsters in front of the pillar retain visible health');
  env.calls.length=0;enemy.hp=0;enemy.action='dead';env.renderer.render(state,{players:roster(),time:1020});assert.ok(!env.calls.some(call=>call.op==='fillRect'&&call.color==='#bcaa7d'),'dead monsters have no health bar');
}));

