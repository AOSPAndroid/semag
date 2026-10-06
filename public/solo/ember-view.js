import { ARENA, ACT_NAMES, BOSSES, RELICS, createState, step, chooseRoute, chooseReward, chooseCamp, togglePause as pauseState } from './ember-engine.js';
import { drawEmberActor, drawEmberProjectile, drawEmberBlade } from '../art/ember-sprites.js';
const copy = s => JSON.parse(JSON.stringify(s));
const node = (tag, cls, text) => { const n = document.createElement(tag); n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const controls = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', j: 'melee', J: 'melee', k: 'spell', K: 'spell', e: 'spell', E: 'spell', ' ': 'dash', Shift: 'dash', f: 'interact', F: 'interact' };
function pixelIcon(id) {
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('shape-rendering','crispEdges');
  const paths={melee:'M16 2h6v6h-2v2h-2v2h-2v2h-2v2h-2v-2H8v-2H6v-2h4V8h2V6h2V4h2zM6 14h4v4H6v4H2v-4h4z',spell:'M10 2h4v4h2v4h4v4h-4v4h-2v4h-4v-4H8v-4H4v-4h4V6h2z',dash:'M4 4h4v4h4v4H8v4H4v-4h4V8H4zM12 4h4v4h4v4h-4v4h-4v-4h4V8h-4zM2 20h12v2H2z',interact:'M6 2h14v20H6v-4H4v-2h2V2zm2 2v16h10V4H8zm6 7h2v4h-2zM2 8h8v2h2v4h-2v2H2v-2h6v-4H2z',move:'M10 2h4v4h2v2h-2v2h8v4h-8v8h-4v-8H2v-4h8V8H8V6h2z'};
  const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[id]||paths.spell);path.setAttribute('fill','currentColor');svg.append(path);return svg;
}
export function mount(container, { onUpdate = () => {} } = {}) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let state = createState(), raf = 0, dead = false, previous = null, accumulator = 0, lastUpdate = 0, lastPhase = '', roomId = '', choiceKey = '', lastEvent = 0, particles = [], roomProps = [], lastPosition = null;
  let mapKey='',buildKey='';
  const textCache=new WeakMap(),mapMarks=[],gateImages=new Map();
  const text=(element,value)=>{if(textCache.get(element)!==value){textCache.set(element,value);element.textContent=value;}};
  const hidden=(element,value)=>{if(element.hidden!==value)element.hidden=value;};
  const held = new Map(), pointers = new Map(), queue = new Set();
  const sticks = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 } };
  let aimPoint = null, aim = { x: 1, y: 0 };
  const view = node('section', 'ember-view'); view.setAttribute('aria-label', 'Ember Delve dungeon');
  const heading = node('div', 'ember-topline'), actLabel = node('strong', '', ACT_NAMES[0]), roomLabel = node('span', '', 'GALLERY · 01 / 04'); heading.append(actLabel, roomLabel);
  const map = node('ol', 'ember-route-map'); map.setAttribute('aria-label', 'Three-act run progress');
  for (let a = 1; a <= 3; a++) { const li = node('li', ''); li.dataset.act = a; li.append(node('b', '', `ACT ${a}`)); for (let d = 1; d <= 4; d++) { const mark = node('span', '', d === 4 ? '♜' : '◇'); mark.dataset.depth = d; li.append(mark);mapMarks.push({mark,a,d}); } map.append(li); }
  const meters = node('div', 'ember-meters'), meterRefs = {};
  for (const [key, title] of [['hp', 'HEALTH'], ['stamina', 'STAMINA'], ['mana', 'MANA']]) { const wrap = node('div', `ember-meter ember-meter-${key}`), label = node('div', 'ember-meter-label'), value = node('b', ''), rail = node('div', 'ember-meter-rail'), fill = node('i', ''); rail.setAttribute('role', 'progressbar'); rail.setAttribute('aria-label', title); rail.setAttribute('aria-valuemin', '0'); label.append(node('span', '', title), value); rail.append(fill); wrap.append(label, rail); meters.append(wrap); meterRefs[key] = { value, rail, fill }; }
  const board = node('div', 'ember-board'), canvas = node('canvas', 'ember-canvas'); canvas.width = ARENA.width; canvas.height = ARENA.height; canvas.tabIndex = 0; canvas.dataset.soloFocus = ''; canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Pixel cavern. WASD to move, pointer to aim, click or J to swing, right click or E to cast, Space to dodge, F to use doors or shrines.');
  const overlay = node('div', 'ember-overlay'); overlay.hidden = true; const overlayTitle = node('strong', ''), overlayText = node('p', ''), replay = node('button', '', 'Begin another descent'); replay.type = 'button'; overlay.append(node('span', 'ember-eyebrow', 'EMBER DELVE'), overlayTitle, overlayText, replay); board.append(canvas, overlay);
  const prompt = node('div', 'ember-prompt'); prompt.setAttribute('role', 'status'); prompt.setAttribute('aria-live', 'polite');
  const decisions = node('section', 'ember-decisions'); decisions.hidden = true; decisions.setAttribute('aria-label', 'Dungeon choices'); const decisionTitle = node('strong', 'ember-decision-title'), decisionNote = node('p', 'ember-decision-note'), decisionList = node('div', 'ember-choice-list'); decisions.append(decisionTitle, decisionNote, decisionList);
  const build = node('div', 'ember-build'); build.setAttribute('aria-label', 'Run relics');
  const hints = node('div', 'ember-hints'); for (const [key, text] of [['WASD','Move'],['Click / J','Blade'],['E / K','Ember bolt'],['Space','Dodge'],['F','Interact']]) { const n = node('span', ''); n.append(node('kbd','',key),document.createTextNode(text)); hints.append(n); }
  const touch = node('div', 'ember-controls'), pads = {};
  for (const [id, title] of [['move','MOVE'],['aim','AIM + ATTACK']]) { const group = node('div','ember-stick-group'), pad = node('button','ember-stick'), knob = node('i','ember-stick-knob');knob.append(pixelIcon(id==='move'?'move':'spell')); pad.type = 'button'; pad.dataset.stick = id; pad.setAttribute('aria-label',id === 'move' ? 'Drag to move' : 'Drag to aim, swing, and cast'); pad.append(knob); group.append(pad,node('span','',title)); touch.append(group); pads[id] = { pad, knob }; }
  const actions = node('div','ember-actions'), actionRefs = {};
  for (const [id, title] of [['melee','BLADE'],['spell','BOLT'],['dash','DODGE'],['interact','USE']]) { const button = node('button','ember-action'); button.type = 'button'; button.dataset.control = id; button.setAttribute('aria-label',title === 'USE' ? 'Use nearby door, chest or camp' : title === 'DODGE' ? 'Tap to dodge' : `Hold to ${title === 'BLADE' ? 'swing your blade' : 'cast ember bolts'}`);const icon=node('b','ember-action-icon');icon.append(pixelIcon(id)); button.append(icon,node('span','',title)); actions.append(button); actionRefs[id] = button; }
  touch.insertBefore(actions,touch.lastChild);
  const seedBar = node('div','ember-seed'); const seedLabel = node('label','','RUN SEED'), seedInput = node('input',''), seedButton = node('button','','Replay seed'), newButton = node('button','','New seed'); seedInput.type = 'text'; seedInput.inputMode = 'numeric'; seedInput.value = state.seed; seedInput.maxLength = 10; seedInput.setAttribute('aria-label','Run seed, a number from 1 to 4294967295'); seedButton.type = newButton.type = 'button'; seedLabel.append(seedInput); seedBar.append(seedLabel,seedButton,newButton);
  view.append(heading,map,meters,board,prompt,decisions,build,hints,touch,seedBar); container.append(view);
  const ctx = canvas.getContext('2d'), floor = document.createElement('canvas'); floor.width = canvas.width; floor.height = canvas.height; const f = floor.getContext('2d');
  function rect(context,x,y,w,h,color) { context.fillStyle = color; context.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h)); }
  const biomeColors = [
    { ink:'#172c28', tile:['#34483e','#384c40','#3c5041','#31463c'], seam:'#273e35', stone:'#526752', edge:'#829475', light:'#b4b88a', glow:'#e8b673', crystal:'#b79265' },
    { ink:'#182d37', tile:['#354d54','#38515a','#3c565c','#304a53'], seam:'#29424c', stone:'#557780', edge:'#89adb0', light:'#c4d9cc', glow:'#a6d6cf', crystal:'#a5cdd0' },
    { ink:'#302a2c', tile:['#4e4540','#56483e','#51463d','#49413b'], seam:'#3b3633', stone:'#76624d', edge:'#ad9166', light:'#d8bd86', glow:'#e6ad6c', crystal:'#c98b54' },
  ];
  function pixelLine(context,points,color,width=2){context.strokeStyle=color;context.lineWidth=width;context.beginPath();points.forEach(([x,y],i)=>i?context.lineTo(x,y):context.moveTo(x,y));context.stroke();}
  function crystal(context,x,y,size,color){
    const points=[[x-size*.55,y+size*.2],[x-size*.55,y-size*.3],[x,y-size],[x+size*.35,y-size*.38],[x+size*.35,y+size*.2]];
    context.fillStyle=color;context.beginPath();points.forEach(([px,py],i)=>i?context.lineTo(Math.round(px/2)*2,Math.round(py/2)*2):context.moveTo(Math.round(px/2)*2,Math.round(py/2)*2));context.closePath();context.fill();
    pixelLine(context,[[x,y-size*.88],[x-2,y+size*.1]],'#e1e7cd',2);rect(context,x+2,y-size*.3,size*.2,size*.35,'#69959a');
  }
  function background() {
    const c=biomeColors[state.act-1];let n=(state.seed+state.act*727+state.depth*97)>>>0;const rand=()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};
    rect(f,0,0,960,640,c.ink);rect(f,42,42,876,556,c.seam);
    // Worn flags, shallow grooves, mineral veins and quiet debris are cached per room.
    for(let row=0,y=44;y<598;row++,y+=36)for(let x=42-(row%2)*22;x<918;x+=44){
      const left=Math.max(42,x),right=Math.min(918,x+42);if(right<=left)continue;
      rect(f,left,y,right-left,34,c.tile[Math.floor(rand()*4)]);rect(f,left+2,y+1,right-left-4,2,c.edge+'28');rect(f,left+2,y+31,right-left-4,2,c.ink+'48');
      if(rand()>.7)pixelLine(f,[[left+8,y+2],[left+13,y+13],[left+9,y+20],[left+16,y+29]],c.seam,1);
      if(rand()>.5)rect(f,left+6+rand()*15,y+8+rand()*13,4+rand()*10,2,c.light+'18');
      if(state.act===2&&rand()>.91)pixelLine(f,[[left+4,y+26],[left+17,y+16],[left+31,y+19]],'#8cafae44',1);
      if(state.act===3&&rand()>.91){rect(f,left+15,y+24,12,2,'#c58a4b30');rect(f,left+20,y+20,2,7,'#d59d5540');}
    }
    // Room seals distinguish the safe sanctuaries, riskier crucibles and keepers.
    f.save();f.globalAlpha=.12;f.strokeStyle=c.light;f.lineWidth=2;
    const center=state.room.kind==='boss'?{x:660,y:320}:{x:480,y:320},r=state.room.kind==='boss'?166:state.room.kind==='camp'?96:116;
    for(const radius of [r,r+10]){f.beginPath();f.arc(center.x,center.y,radius,0,Math.PI*2);f.stroke();}
    for(let i=0;i<8;i++){const a=i*Math.PI/4;pixelLine(f,[[center.x+Math.cos(a)*(r-8),center.y+Math.sin(a)*(r-8)],[center.x+Math.cos(a)*(r+6),center.y+Math.sin(a)*(r+6)]],c.light,3);}
    pixelLine(f,[[center.x,center.y-37],[center.x+27,center.y],[center.x,center.y+37],[center.x-27,center.y],[center.x,center.y-37]],c.light,2);f.restore();
    for(let x=0;x<960;x+=48){rect(f,x,0,46,42,c.ink);rect(f,x+2,2,42,32,c.stone);rect(f,x+3,3,40,4,c.edge);rect(f,x+6,11,33,2,c.light+'25');rect(f,x+2,31,42,9,c.seam);rect(f,x+9,33,29,2,c.edge+'55');rect(f,x,598,46,42,c.ink);rect(f,x+2,603,42,30,c.stone);rect(f,x+3,603,40,4,c.edge);}
    for(let y=42;y<598;y+=40){rect(f,0,y,42,38,c.ink);rect(f,3,y+2,30,34,c.stone);rect(f,4,y+2,3,33,c.edge);rect(f,32,y+3,8,34,c.seam);rect(f,918,y,42,38,c.ink);rect(f,925,y+2,31,34,c.stone);rect(f,926,y+2,3,32,c.edge);}
    for(const[x,y]of[[67,70],[868,70],[67,547],[868,547]]){
      const glow=f.createRadialGradient(x+8,y+8,3,x+8,y+8,87);glow.addColorStop(0,c.glow+'24');glow.addColorStop(1,c.glow+'00');f.fillStyle=glow;f.fillRect(x-79,y-79,174,174);
      rect(f,x-5,y+20,26,11,c.ink);rect(f,x,y+2,16,23,c.stone);rect(f,x+2,y+3,3,19,c.edge);rect(f,x-2,y-2,20,7,'#9a8058');rect(f,x+3,y-10,10,11,c.glow);rect(f,x+6,y-19,4,18,'#ffe0a1');
    }
    for(let i=0;i<30;i++){
      const x=i%2?50+rand()*45:870+rand()*43,y=80+rand()*450;
      if(state.act===2&&i%3===0)crystal(f,x,y,8+rand()*16,c.crystal);
      else if(state.act===1){rect(f,x,y,5+rand()*9,3,'#77915855');pixelLine(f,[[x,y],[x+3,y-6],[x+5,y]],'#8e9c6b77',1);}
      else{rect(f,x,y,5+rand()*8,4,c.edge+'50');rect(f,x+2,y,4,2,c.light+'44');}
    }
    const shade=f.createRadialGradient(460,315,180,460,315,600);shade.addColorStop(0,'#0a1e1900');shade.addColorStop(.65,'#0a1e1900');shade.addColorStop(1,'#0a1e1966');f.fillStyle=shade;f.fillRect(0,0,960,640);
    roomProps=state.room.obstacles.map((o,index)=>{
      const image=document.createElement('canvas');image.width=o.width+24;image.height=o.height+62;const g=image.getContext('2d'),x=12,y=42,w=o.width,h=o.height;
      rect(g,x-5,y+14,w+10,h+8,c.ink+'bb');rect(g,x,y,w,h,c.ink);rect(g,x+2,y+4,w-4,h-6,c.stone);rect(g,x+3,y+7,6,h-12,c.edge);rect(g,x+w-12,y+7,10,h-9,c.seam);rect(g,x+3,y+h-12,w-6,9,c.seam);rect(g,x+3,y+h-12,w-6,3,c.edge);
      for(let yy=y+26;yy<y+h-12;yy+=24){rect(g,x+7,yy,w-17,2,c.ink+'99');rect(g,x+w*.45,yy-21,2,21,c.ink+'66');rect(g,x+10,yy+3,w-24,1,c.light+'22');}
      rect(g,x,y-4,w,14,c.edge);rect(g,x+5,y-7,w-10,10,c.light);rect(g,x+9,y-5,w-18,3,'#e4ddaf55');rect(g,x+7,y+3,w-14,2,c.stone);
      const cx=x+w/2;rect(g,cx-10,y+21,20,24,c.seam);pixelLine(g,[[cx,y+25],[cx+5,y+31],[cx,y+38],[cx-5,y+31],[cx,y+25]],c.edge,2);rect(g,cx-1,y+38,2,5,c.edge);
      if(state.act===2){crystal(g,cx-8,y-6,25,c.crystal);crystal(g,cx+10,y-4,18,'#7ea5ae');}
      else if(state.act===3){rect(g,cx-17,y-29,34,23,'#413b35');rect(g,cx-18,y-31,36,6,'#aa885c');for(let j=0;j<4;j++){rect(g,cx-14+j*8,y-23,4,15,'#cf8e51');rect(g,cx-14+j*8,y-17,4,5,'#ecc37c');}rect(g,cx-20,y-8,40,5,'#d0ab73');}
      else{rect(g,cx-10,y-24,20,15,'#544d3a');rect(g,cx-13,y-26,26,5,'#a58e60');rect(g,cx-7,y-32,14,10,'#d79e60');rect(g,cx-3,y-40,6,18,'#f2c87e');rect(g,cx-1,y-34,2,12,'#fff0b6');for(let j=0;j<3;j++)rect(g,x+3+j*6,y+7+j*5,8,4,'#748b51');}
      return{y:o.y+o.height,draw:()=>ctx.drawImage(image,o.x-12,o.y-42)};
    });
  }
  function paintExit(ctx,c,open) {
    rect(ctx,856,260,61,115,c.ink);rect(ctx,860,261,9,107,c.stone);rect(ctx,907,261,8,108,c.stone);rect(ctx,860,253,55,12,c.edge);rect(ctx,866,250,43,5,c.light);rect(ctx,860,368,55,7,c.edge);
    for(let i=0;i<4;i++){rect(ctx,861,272+i*23,7,2,c.edge);rect(ctx,908,272+i*23,7,2,c.edge);}
    if(open){const glow=ctx.createRadialGradient(889,320,8,889,320,74);glow.addColorStop(0,'#edca8638');glow.addColorStop(1,'#edca8600');ctx.fillStyle=glow;ctx.fillRect(815,246,148,148);rect(ctx,871,271,32,95,'#987e54');rect(ctx,877,273,20,91,'#dabb7d');rect(ctx,883,276,8,86,'#f2de9e');for(let i=0;i<7;i++)rect(ctx,876+i%3*7,282+i*11,3,3,'#ffeabe');}
    else{rect(ctx,870,271,35,95,'#3d4634');for(let x=871;x<904;x+=8){rect(ctx,x,272,4,93,'#8a7b55');rect(ctx,x,272,2,92,'#b39b66');}for(const y of[286,339]){rect(ctx,868,y,39,6,'#b29b65');for(let x=871;x<905;x+=9)rect(ctx,x,y+1,2,2,'#ddbf80');}rect(ctx,883,310,9,12,'#d5b67a');rect(ctx,886,313,3,5,'#485037');}
    ctx.font='bold 11px monospace';ctx.textAlign='center';ctx.fillStyle=open?'#f7dc9d':'#b2b89a';ctx.fillText(open?'EXIT · F':'SEALED',889,395);
  }
  function drawGate() {
    const open=state.room.cleared,c=biomeColors[state.act-1],t=state.room.shrine,key=`${state.act}:${open}`;
    if(!gateImages.has(key)){const image=document.createElement('canvas');image.width=148;image.height=167;const g=image.getContext('2d');g.translate(-815,-240);paintExit(g,c,open);gateImages.set(key,image);}
    ctx.drawImage(gateImages.get(key),815,240);
    ctx.font='bold 11px monospace';ctx.textAlign='center';
    if(['treasure','camp'].includes(state.room.kind)){
      ctx.fillStyle=c.ink+'99';ctx.beginPath();ctx.ellipse(t.x,t.y+21,43,12,0,0,Math.PI*2);ctx.fill();
      if(state.room.kind==='treasure'){
        rect(ctx,t.x-32,t.y-15,64,39,'#493e33');rect(ctx,t.x-29,t.y-13,58,33,'#9d704a');rect(ctx,t.x-27,t.y-10,54,3,'#c39a61');rect(ctx,t.x-29,t.y-29,58,16,'#a67a4d');rect(ctx,t.x-25,t.y-33,50,8,'#c9a36b');rect(ctx,t.x-22,t.y-29,44,5,'#dbb780');rect(ctx,t.x-21,t.y-31,6,51,'#e1c184');rect(ctx,t.x+15,t.y-31,6,51,'#e1c184');rect(ctx,t.x-5,t.y-15,10,17,'#f0d39a');rect(ctx,t.x-2,t.y-10,4,7,'#6b5e43');rect(ctx,t.x-27,t.y+14,54,4,'#795841');
        if(!state.room.rewardTaken){ctx.save();ctx.globalAlpha=reducedMotion.matches ? .3 : .25+.1*Math.sin(state.elapsed*3);ctx.strokeStyle='#ffe1a0';ctx.lineWidth=2;ctx.strokeRect(t.x-35,t.y-35,70,61);ctx.restore();}
      }else{
        for(let i=0;i<8;i++){const a=i*Math.PI/4;rect(ctx,t.x+Math.cos(a)*29-5,t.y+Math.sin(a)*13+14,10,6,'#8e9580');rect(ctx,t.x+Math.cos(a)*29-4,t.y+Math.sin(a)*13+14,7,2,'#b3b398');}
        rect(ctx,t.x-24,t.y+12,47,7,'#765443');rect(ctx,t.x-18,t.y+21,38,6,'#956946');for(let i=0;i<5;i++){const x=t.x-13+i*6,h=20+Math.sin((reducedMotion.matches?0:state.elapsed*9)+i*2)*6+i%2*13;rect(ctx,x,t.y-h+12,6,h,i%2?'#f4bd77':'#d98955');rect(ctx,x+2,t.y-h+16,2,h-6,'#ffe2a1');}
      }
      ctx.fillStyle='#f4d399';ctx.fillText(state.room.rewardTaken?'CLAIMED':state.room.kind==='camp'?'REST · F':'CHEST · F',t.x,t.y+48);
    }
  }
  function draw() {
    const artTime=reducedMotion.matches?0:state.elapsed;
    if(roomId!==state.room.id){roomId=state.room.id;background();lastPosition=null;}ctx.imageSmoothingEnabled=false;ctx.drawImage(floor,0,0);drawGate();
    for(const e of state.enemies)if(e.phase==='tell'){
      ctx.save();ctx.globalAlpha=.8;ctx.strokeStyle=e.tell==='summon'?'#bad9d0':'#efba81';ctx.lineWidth=2;ctx.setLineDash([8,6]);
      if(e.tell==='charge'){ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+e.aimX*280,e.y+e.aimY*280);ctx.stroke();}
      else if(e.tell==='fan'){const angle=Math.atan2(e.aimY,e.aimX),count=e.boss?7:3,spread=e.boss?.16:.14;for(let i=0;i<count;i++){const a=angle+(i-(count-1)/2)*spread;ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+Math.cos(a)*190,e.y+Math.sin(a)*190);ctx.stroke();}}
      else{const r=e.tell==='sweep'?(e.boss?150:80):e.tell==='ring'?62:40;ctx.beginPath();ctx.arc(e.x,e.y,r,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=.06;ctx.fillStyle='#f4bc82';ctx.fill();}ctx.restore();
    }
    const p=state.player,walking=!reducedMotion.matches&&lastPosition&&Math.hypot(p.x-lastPosition.x,p.y-lastPosition.y)>.1;lastPosition={x:p.x,y:p.y};
    const actors=[...roomProps,...state.enemies.map(e=>({y:e.y+20,draw:()=>{
      ctx.fillStyle='#102b28aa';ctx.beginPath();ctx.ellipse(e.x,e.y+22,e.boss?38:e.radius+9,e.boss?12:7,0,0,Math.PI*2);ctx.fill();drawEmberActor(ctx,e,state.act,artTime,!reducedMotion.matches&&e.phase==='seek');
      if(e.burn>0){rect(ctx,e.x-11,e.y-29,4,9,'#db945c');rect(ctx,e.x+8,e.y-14,4,8,'#f0bd79');}
    }})),{y:p.y+20,draw:()=>{
      ctx.save();if(p.damageCooldown>0&&(reducedMotion.matches||Math.floor(state.elapsed*18)%2===0))ctx.globalAlpha=.6;ctx.fillStyle='#112a25aa';ctx.beginPath();ctx.ellipse(p.x,p.y+22,24,8,0,0,Math.PI*2);ctx.fill();drawEmberActor(ctx,{...p,type:'hero'},state.act,artTime,walking);drawEmberBlade(ctx,p);ctx.restore();
    }}];actors.sort((a,b)=>a.y-b.y);for(const a of actors)a.draw();
    for(const e of state.enemies){const width=e.boss?112:34,top=e.y-(e.boss?94:e.type==='crawler'?35:58);rect(ctx,e.x-width/2-2,top-2,width+4,7,'#18352edd');rect(ctx,e.x-width/2,top,width*Math.max(0,e.hp/e.maxHp),3,e.burn>0?'#e7a166':e.slow>0?'#a1c4c1':'#c9b78c');if(e.boss){ctx.font='bold 12px monospace';ctx.fillStyle='#f3dfb5';ctx.textAlign='center';ctx.fillText(BOSSES[state.act-1],e.x,top-8);}}
    for(const b of state.projectiles)drawEmberProjectile(ctx,b,state.elapsed);
    if(p.dashTime>0){ctx.save();ctx.globalAlpha=.35;ctx.strokeStyle='#c1dfbd';ctx.lineWidth=2;for(let i=1;i<=3;i++){ctx.beginPath();ctx.moveTo(p.x-p.dashX*i*14-p.dashY*8,p.y-p.dashY*i*14+p.dashX*8);ctx.lineTo(p.x-p.dashX*i*14+p.dashY*8,p.y-p.dashY*i*14-p.dashX*8);ctx.stroke();}ctx.restore();}
    if(!reducedMotion.matches)for(const fx of particles){const age=state.elapsed-fx.spawn;ctx.save();ctx.globalAlpha=Math.max(0,1-age/.45);rect(ctx,fx.x+fx.vx*age,fx.y+fx.vy*age,fx.size,fx.size,fx.color);ctx.restore();}particles=particles.filter(fx=>state.elapsed-fx.spawn<.45);
    if(!['playing','won','lost','paused'].includes(state.phase)){ctx.fillStyle='rgba(16,34,26,.35)';ctx.fillRect(42,42,876,556);ctx.fillStyle='#f3dfb5';ctx.textAlign='center';ctx.font='bold 22px monospace';ctx.fillText(state.phase==='route'?'CHOOSE YOUR NEXT ROOM':state.phase==='camp'?'A MOMENT BY THE FIRE':'A RELIC FOR THE ROAD',480,310);}
  }
  function emit() { onUpdate({phase:['route','reward','camp'].includes(state.phase)?'playing':state.phase,score:state.score,record:state.score,detail:`Act ${state.act}/3 · ${state.room.title} · ${state.gold} gold`}); }
  function updateUI() {
    if(view.dataset.phase!==state.phase)view.dataset.phase=state.phase;
    text(actLabel,`ACT ${state.act} · ${ACT_NAMES[state.act-1]}`);text(roomLabel,`${state.room.kind.toUpperCase()} · ${String(state.depth).padStart(2,'0')} / 04`);
    const nextMapKey=state.room.id+':'+state.routeHistory.length;
    if(nextMapKey!==mapKey){mapKey=nextMapKey;for(const{mark,a,d}of mapMarks){mark.dataset.state=a<state.act||a===state.act&&d<state.depth?'done':a===state.act&&d===state.depth?'current':'future';const history=state.routeHistory.find(r=>r.act===a&&r.depth===d);text(mark,d===4?'♜':history?.kind==='treasure'?'▣':history?.kind==='camp'?'♨':history?.kind==='elite'?'✦':'◇');mark.setAttribute('aria-label',`Act ${a} room ${d}${history?`, ${history.kind}`:''}`);}}
    for(const[key,refs]of Object.entries(meterRefs)){
      const max=state.player[key==='hp'?'maxHp':key==='mana'?'maxMana':'maxStamina'],value=Math.ceil(state.player[key]),width=`${clamp(state.player[key]/max*100,0,100)}%`;
      text(refs.value,`${value} / ${max}`);
      if(refs.width!==width){refs.width=width;refs.fill.style.width=width;}
      if(refs.max!==max){refs.max=max;refs.rail.setAttribute('aria-valuemax',max);}
      if(refs.current!==value){refs.current=value;refs.rail.setAttribute('aria-valuenow',value);}
    }
    const decision=['route','reward','camp'].includes(state.phase);hidden(decisions,!decision);
    const signature=decision?state.phase+state.choices.map(c=>c.id).join()+state.gold:'';
    if(decision&&signature!==choiceKey){choiceKey=signature;decisionTitle.textContent=state.phase==='route'?'Choose the road ahead.':state.phase==='camp'?'Tend the flame.':'Take one. Build a different run.';decisionNote.textContent=state.phase==='route'?'Health, mana, gold, and relics carry between rooms.':state.phase==='camp'?`${state.gold} GOLD · Recovery before the act keeper.`:'Relics stack. Coalbrand + Spark Coil rewards burning foes; Glassheart + blade rewards closing the gap.';decisionList.replaceChildren();for(const c of state.choices){const button=node('button','ember-choice');button.type='button';button.dataset.choice=c.id;button.append(node('span','ember-choice-category',''),node('strong','',c.title),node('p','',c.description));button.firstChild.textContent=c.risk|| (state.phase==='camp'?c.cost?`${c.cost} GOLD`:'FREE':`RELIC${state.relics[c.id]?` · OWNED ${state.relics[c.id]}`:''}`);if(c.cost>state.gold)button.disabled=true;button.addEventListener('click',()=>select(c.id));decisionList.append(button);}}
    const showOverlay=['paused','won','lost'].includes(state.phase);hidden(overlay,!showOverlay);hidden(replay,state.phase==='paused');
    if(showOverlay){text(overlayTitle,state.phase==='paused'?'The embers are waiting.':state.phase==='won'?'You silenced the Crown.':'Your flame went out.');text(overlayText,state.phase==='paused'?'Resume when you’re ready. Your room and decision stay intact.':`${state.kills} foes · ${state.score.toLocaleString()} score · seed ${state.seed}`);}
    const nearExit=Math.hypot(state.player.x-state.room.exit.x,state.player.y-state.room.exit.y)<70,nearShrine=Math.hypot(state.player.x-state.room.shrine.x,state.player.y-state.room.shrine.y)<70;
    text(prompt,decision?'Make your choice below.':state.phase==='paused'?'PAUSED':state.room.cleared?(nearExit?'F / USE · Step through the open gate.':'Room clear. Cross the cavern to the glowing gate →'):state.room.kind==='treasure'?(nearShrine?'F / USE · Open the reliquary.':'Find the reliquary chest.'):state.room.kind==='camp'?(nearShrine?'F / USE · Rest by the fire.':'Reach the sanctuary fire.'):state.enemies.some(e=>e.boss)?`${BOSSES[state.act-1]} · Read the amber tells. Dodge through danger; punish recovery.`:`${state.enemies.length} guards remain · Blade restores space; bolts spend mana.`);
    const nextBuildKey=JSON.stringify(state.relics);
    if(nextBuildKey!==buildKey){buildKey=nextBuildKey;build.replaceChildren();if(!Object.keys(state.relics).length)build.append(node('span','ember-build-empty','NO RELICS YET · A build begins at the first gate.'));else for(const[id,count]of Object.entries(state.relics)){const chip=node('span','ember-relic',`${RELICS[id].title}${count>1?` ×${count}`:''}`);chip.title=RELICS[id].description;build.append(chip);}}
    for(const e of state.events){if(e.id<=lastEvent)continue;lastEvent=e.id;if(!reducedMotion.matches&&['hit','kill','dash','cast','perfect'].includes(e.type))for(let i=0;i<5;i++)particles.push({x:e.x,y:e.y,vx:Math.cos(i*1.25+e.id)*60,vy:Math.sin(i*1.25+e.id)*60,spawn:state.elapsed,size:i%2?3:5,color:e.type==='perfect'?'#bfd5bb':e.type==='dash'?'#8eae97':'#eac183'});}if(particles.length>120)particles.splice(0,particles.length-120);
    if(state.phase!==lastPhase){lastPhase=state.phase;if(state.phase!=='playing')release();emit();}
  }
  function input() { const result={};for(const control of held.values())result[control]=true;for(const p of pointers.values())if(p.control)result[p.control]=true;for(const c of queue)result[c]=true;const m=sticks.move;if(Math.hypot(m.x,m.y)>.16){result.moveX=m.x;result.moveY=m.y;}const a=sticks.aim;if(Math.hypot(a.x,a.y)>.16){aimPoint=null;aim={x:a.x,y:a.y};result.melee=true;result.spell=true;}if(aimPoint)aim={x:aimPoint.x-state.player.x,y:aimPoint.y-state.player.y};return {...result,aimX:aim.x,aimY:aim.y}; }
  function release() { held.clear();pointers.clear();queue.clear();for(const id of ['move','aim']){sticks[id]={x:0,y:0};pads[id].knob.style.transform='translate(0,0)';pads[id].pad.setAttribute('aria-pressed','false');}for(const b of Object.values(actionRefs))b.setAttribute('aria-pressed','false'); }
  function schedule(){if(!dead&&state.phase==='playing'&&!raf)raf=requestAnimationFrame(frame);}
  function stopFrame(){if(raf)cancelAnimationFrame(raf);raf=0;previous=null;accumulator=0;}
  function select(id) {release();if(state.phase==='route')chooseRoute(state,id);else if(state.phase==='reward')chooseReward(state,id);else if(state.phase==='camp')chooseCamp(state,id);stopFrame();updateUI();draw();emit();canvas.focus({preventScroll:true});schedule();}
  function restart(seed=Date.now()) {release();stopFrame();state=createState({seed});seedInput.value=state.seed;particles=[];lastEvent=0;roomId='';choiceKey='';mapKey='';buildKey='';updateUI();draw();emit();canvas.focus({preventScroll:true});schedule();}
  function togglePause() {release();stopFrame();pauseState(state);updateUI();draw();emit();schedule();}
  function frame(time) {
    raf=0;if(dead||state.phase!=='playing')return;
    if(previous===null)previous=time;const delta=Math.min(.05,(time-previous)/1000);previous=time;accumulator+=delta;
    let count=0;while(accumulator>=1/120&&count<6){step(state,input());queue.clear();accumulator-=1/120;count++;}
    updateUI();draw();if(time-lastUpdate>180){emit();lastUpdate=time;}schedule();
  }
  const native = target => target instanceof Element && Boolean(target.closest('input,textarea,select,[contenteditable],button,a,summary'));
  function keydown(e) {if(e.isComposing||e.metaKey||e.ctrlKey||e.altKey)return;if(native(e.target))return;const control=controls[e.key];if(!control)return;e.preventDefault();if(e.repeat)return;if(state.phase==='playing'){held.set(e.code,control);queue.add(control);}}
  function keyup(e) {held.delete(e.code);}
  const coordinate = e => {const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*960/r.width,y:(e.clientY-r.top)*640/r.height};};
  function aimMove(e){if(e.pointerType!=='touch')aimPoint=coordinate(e);}
  function canvasDown(e){if(e.pointerType==='touch'){aimPoint=coordinate(e);return;}if(![0,2].includes(e.button)||state.phase!=='playing')return;e.preventDefault();canvas.focus({preventScroll:true});aimPoint=coordinate(e);const control=e.button===2?'spell':'melee';pointers.set(e.pointerId,{control});queue.add(control);canvas.setPointerCapture(e.pointerId);}
  function pointerEnd(e){const p=pointers.get(e.pointerId);if(!p)return;if(p.stick){sticks[p.stick]={x:0,y:0};pads[p.stick].knob.style.transform='translate(0,0)';pads[p.stick].pad.setAttribute('aria-pressed','false');}if(p.control){actionRefs[p.control]?.setAttribute('aria-pressed','false');if(e.type==='pointercancel')queue.delete(p.control);}pointers.delete(e.pointerId);}
  for(const [id,{pad,knob}] of Object.entries(pads)) {const update=e=>{const r=pad.getBoundingClientRect(),radius=r.width*.35;const dx=clamp((e.clientX-r.left-r.width/2)/radius,-1,1),dy=clamp((e.clientY-r.top-r.height/2)/radius,-1,1),l=Math.hypot(dx,dy);sticks[id]={x:l>1?dx/l:dx,y:l>1?dy/l:dy};knob.style.transform=`translate(${sticks[id].x*radius}px,${sticks[id].y*radius}px)`;};pad.addEventListener('pointerdown',e=>{if(state.phase!=='playing')return;e.preventDefault();pointers.set(e.pointerId,{stick:id});pad.setPointerCapture(e.pointerId);pad.setAttribute('aria-pressed','true');update(e);});pad.addEventListener('pointermove',e=>{if(pointers.get(e.pointerId)?.stick===id)update(e);});pad.addEventListener('pointerup',pointerEnd);pad.addEventListener('pointercancel',pointerEnd);pad.addEventListener('lostpointercapture',pointerEnd);}
  for(const [id,button] of Object.entries(actionRefs)){button.addEventListener('pointerdown',e=>{if(state.phase!=='playing')return;e.preventDefault();pointers.set(e.pointerId,{control:id});queue.add(id);button.setPointerCapture(e.pointerId);button.setAttribute('aria-pressed','true');});button.addEventListener('pointerup',pointerEnd);button.addEventListener('pointercancel',pointerEnd);button.addEventListener('lostpointercapture',pointerEnd);button.addEventListener('click',e=>{if(e.detail===0&&state.phase==='playing')queue.add(id);});}
  function blur(){release();if(['playing','route','reward','camp'].includes(state.phase))togglePause();}
  function visibility(){if(document.hidden)blur();}
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);canvas.addEventListener('pointermove',aimMove);canvas.addEventListener('pointerdown',canvasDown);canvas.addEventListener('pointerup',pointerEnd);canvas.addEventListener('pointercancel',pointerEnd);canvas.addEventListener('lostpointercapture',pointerEnd);canvas.addEventListener('contextmenu',e=>e.preventDefault());
  replay.addEventListener('click',()=>restart());newButton.addEventListener('click',()=>restart());seedButton.addEventListener('click',()=>{const seed=Number(seedInput.value);if(Number.isInteger(seed)&&seed>0&&seed<=4294967295){restart(seed);seedInput.setCustomValidity('');}else{seedInput.setCustomValidity('Enter a whole number from 1 to 4294967295.');seedInput.reportValidity();}});
  function motionChange(){particles=[];draw();}
  reducedMotion.addEventListener('change',motionChange);
  updateUI();draw();emit();schedule();
  return {getState:()=>copy(state),restart:()=>restart(),togglePause,destroy(){dead=true;stopFrame();release();reducedMotion.removeEventListener('change',motionChange);window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);view.remove();}};
}
