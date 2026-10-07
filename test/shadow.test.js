import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, FIXED_STEP, DIFFICULTIES, LEVELS, TOTAL_LEVELS, createState, step, nextMission, togglePause, moveBody, sweepCircleRect, segmentCircle, segmentRect, lineOfSight, guardSees, rearTakedownAvailable, interactionTarget, missionDeadline, rayEnd, inShadow } from '../public/solo/shadow-engine.js';
const play = (s, input = {}, seconds = 1) => { for (let i = 0; i < Math.ceil(seconds / FIXED_STEP) && s.phase === 'playing'; i++) step(s, input); return s; };
const quiet = () => { const s = createState(); s.guards = []; return s; };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
const fixtureGuard = (s, detail = {}) => { const guard = { ...s.guards[0], x: 100, y: 100, facing: 0, turnWait: 100, ...detail }; s.guards = [guard]; return guard; };

test('Shadow Lantern begins as a demanding Veteran campaign with explicit record scope', () => {
 const s = createState(); assert.equal(s.difficulty, 'veteran'); assert.equal(s.player.hp, 3); assert.equal(s.smoke, 2); assert.equal(s.kunai, 4); assert.equal(s.recordKey, 'shadow-v1-veteran'); assert.equal(s.phase, 'playing'); assert.equal(s.cleared, 0);
});
test('unknown and inherited difficulty names safely select Veteran', () => { for (const difficulty of ['constructor', 'toString', 'unknown', null]) { const s = createState({ difficulty }); assert.equal(s.difficulty, 'veteran'); assert.equal(s.player.hp, 3); } });
test('difficulty records and campaign allowances remain distinct', () => { for (const difficulty of Object.keys(DIFFICULTIES)) { const s = createState({ difficulty }); assert.equal(s.recordKey, `shadow-v1-${difficulty}`); assert.equal(s.player.hp, DIFFICULTIES[difficulty].health); } assert.ok(DIFFICULTIES.nightmare.time < DIFFICULTIES.veteran.time); assert.ok(DIFFICULTIES.veteran.time < DIFFICULTIES.standard.time); });
test('nine authored missions span three districts and a three-seal final heist', () => {
 assert.equal(TOTAL_LEVELS, 9); assert.deepEqual(LEVELS.map(l => l.district), [0,0,0,1,1,1,2,2,2]); assert.equal(new Set(LEVELS.map(l => l.name)).size, 9); assert.equal(LEVELS[8].seals.length, 3); assert.equal(LEVELS[8].caches.length, 0); assert.ok(LEVELS[8].guards.length >= 6); assert.equal(new Set(LEVELS.map(l => JSON.stringify(l.walls))).size, 9);
 for (const l of LEVELS) for (const objective of [...l.seals, ...l.caches]) assert.ok(!l.walls.some(r => objective.x > r.x - 10 && objective.x < r.x + r.w + 10 && objective.y > r.y - 10 && objective.y < r.y + r.h + 10), `${l.name}: object inside solid cover`);
});
test('ray and line of sight agree on a true cover face, not its bounding approach', () => {
 const level = LEVELS[0], origin = { x: 100, y: 250 }; assert.equal(lineOfSight(level, origin, { x: 300, y: 250 }), false); assert.equal(lineOfSight(level, origin, { x: 180, y: 250 }), true); const end = rayEnd(level, 100, 250, 0, 400); close(end.x, 200); close(end.y, 250); assert.equal(segmentRect(100,250,400,0,level.walls[0]), .25);
});
test('rounded wall corners leave empty diagonal space available', () => { const r = { x: 100, y: 100, w: 40, h: 40 }; assert.equal(sweepCircleRect(80,91,12,0,10,r), null); assert.ok(sweepCircleRect(80,100,25,0,10,r)); });
test('swept wall contact prevents tunneling and allows tangential sliding', () => { const body = { x: 100, y: 250 }; moveBody(body, 450, 40, LEVELS[0].walls); close(body.x, 190); close(body.y, 290); });
test('body touching a wall can retreat or move along it without sticking', () => { const b = { x: 190, y: 230 }; moveBody(b,-25,20,LEVELS[0].walls); close(b.x,165); close(b.y,250); });
test('physical guard bodies stop frontal run-through and allow retreat', () => { const b = { x: 80, y: 100 }; moveBody(b,100,0,[],10,[{x:120,y:100,radius:11}]); close(b.x,99); moveBody(b,-20,0,[],10,[{x:120,y:100,radius:11}]); close(b.x,79); });
test('opposing live guards pass around one another without stacking or a parked queue', () => {
 const s=createState(),base=s.guards[0];s.player.x=100;s.player.y=100;
 const a={...base,id:0,x:400,y:550,facing:0,mode:'alert',lastSeen:{x:650,y:550},turnWait:0},b={...base,id:1,x:600,y:550,facing:Math.PI,mode:'alert',lastSeen:{x:350,y:550},turnWait:0};s.guards=[a,b];
 for(let tick=0;tick<180;tick++){step(s,{});assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=22-1e-6,'live guard circles must remain separate');}
 assert.ok(a.x>520&&b.x<480,`both opposing routes must continue: ${a.x}, ${b.x}`);
});
test('overlap repair keeps wall-pinned and coincident guard bodies outside solid cover', () => {
 for(const positions of [[[189,250],[175,250]],[[100,100],[100,100]]]){const s=createState(),base=s.guards[0];s.guards=positions.map(([x,y],id)=>({...base,id,x,y,turnWait:100}));step(s,{});const[a,b]=s.guards;assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=22-1e-6);
  for(const g of s.guards){assert.ok(g.x>=49&&g.x<=911&&g.y>=59&&g.y<=591);assert.ok(Math.hypot(g.x-s.player.x,g.y-s.player.y)>=21-1e-6);for(const r of LEVELS[0].walls){const x=Math.max(r.x,Math.min(r.x+r.w,g.x)),y=Math.max(r.y,Math.min(r.y+r.h,g.y));assert.ok(Math.hypot(g.x-x,g.y-y)>=11-1e-6,'separation cannot push a guard into cover');}}
 }
});
test('normal sprint and sneak routes keep converging live patrols separate', () => {
 const route=[[100,155],[430,155],[430,325],[740,325],[795,375],[795,535],[585,535],[585,505],[585,535],[100,535]];
 for(const sneak of [false,true]){const s=createState();let waypoint=0,ticks=0;while(s.phase==='playing'&&ticks++<5400){const[x,y]=route[waypoint%route.length],dx=x-s.player.x,dy=y-s.player.y;if(Math.hypot(dx,dy)<3)waypoint++;step(s,{right:dx>1,left:dx< -1,down:dy>1,up:dy< -1,sneak});for(let i=0;i<s.guards.length;i++)for(let j=i+1;j<s.guards.length;j++)assert.ok(Math.hypot(s.guards[i].x-s.guards[j].x,s.guards[i].y-s.guards[j].y)>=22-1e-6,'normal movement must not merge guard threats');}assert.ok(ticks>60*18,'replay reaches the original converging patrol case');}
});
test('all nine authored mission entrances begin with separate live guard bodies', () => {
 const s=createState();for(let level=0;level<TOTAL_LEVELS;level++){assert.equal(s.level,level);for(let i=0;i<s.guards.length;i++)for(let j=i+1;j<s.guards.length;j++)assert.ok(Math.hypot(s.guards[i].x-s.guards[j].x,s.guards[i].y-s.guards[j].y)>=22-1e-6,`mission ${level+1} starts with separate guard circles`);if(level<TOTAL_LEVELS-1){s.phase='mission-clear';assert.equal(nextMission(s),true);}}
});
test('circle sweep catches a moving segment crossing before its endpoint', () => { close(segmentCircle(0,0,100,0,50,0,5),.45); assert.equal(segmentCircle(0,0,100,0,50,10,5),null); });
test('player body remains within the drawn courtyard boundary', () => { const s = quiet(); play(s,{left:true,down:true},8); assert.ok(s.player.x >= 48); assert.ok(s.player.y <= WORLD.height - 48); });
test('diagonal movement has the same total pace as a cardinal move', () => { const a=quiet(), b=quiet(); a.player.x=b.player.x=90;a.player.y=b.player.y=550; play(a,{right:true},.2);play(b,{right:true,up:true},.2);close(a.player.x-90,Math.hypot(b.player.x-90,b.player.y-550)); });
test('sneak moves slower and produces no footstep noise', () => { const a=quiet(),b=quiet();play(a,{right:true},.2);play(b,{right:true,sneak:true},.2);assert.ok(a.player.x>b.player.x);assert.ok(a.noiseId>0);assert.equal(b.noiseId,0); });
test('solid cover and a facing cone protect against sight', () => { const s=createState(),g=fixtureGuard(s,{x:100,y:250});s.player.x=350;s.player.y=250;assert.equal(guardSees(s,g),false);s.player.x=160;assert.equal(guardSees(s,g),true);g.facing=Math.PI;assert.equal(guardSees(s,g),false); });
test('first visibility warns with accumulating suspicion rather than instant alarm', () => { const s=createState(),g=fixtureGuard(s);s.player.x=165;s.player.y=100;step(s,{});assert.ok(g.suspicion>0&&g.suspicion<1);assert.equal(s.alarm,0);play(s,{},1);assert.equal(s.alarm,1);assert.equal(g.mode,'alert'); });
test('quiet shadow gives more time but never indefinite visibility immunity', () => { const s=createState(),g=fixtureGuard(s,{x:85,y:535});s.player.x=175;s.player.y=535;assert.equal(inShadow(LEVELS[0],s.player),true);play(s,{sneak:true},1);assert.ok(g.suspicion>0&&g.suspicion<.3);assert.equal(s.alarm,0);play(s,{sneak:true},8);assert.ok(s.alarm>0||s.phase==='lost'); });
test('smoke uses one charge per press and blocks crossing sight lines', () => { const s=createState(),g=fixtureGuard(s);s.player.x=160;s.player.y=100;assert.equal(guardSees(s,g),true);play(s,{smoke:true},1);assert.equal(s.smoke,1);assert.equal(guardSees(s,g),false);assert.equal(s.clouds.length,1);play(s,{},.02);step(s,{smoke:true});assert.equal(s.smoke,0); });
test('smoke expires after five active seconds and does not stop the campaign clock', () => { const s=quiet();step(s,{smoke:true});play(s,{},5.1);assert.equal(s.clouds.length,0);assert.ok(s.elapsed>5); });
test('kunai press is finite and its swept impact stops at the real wall face', () => { const s=quiet();s.player.x=100;s.player.y=250;play(s,{kunai:true,aimX:500,aimY:250},.4);assert.equal(s.kunai,3);const impact=s.events.find(e=>e.type==='noise'&&e.kind==='kunai');assert.ok(impact);close(impact.x,198);close(impact.y,250); });
test('a distraction beside solid cover cannot park a patrol indefinitely', () => { const s=createState();step(s,{kunai:true,aimX:250,aimY:250});play(s,{},40);assert.equal(s.guards[0].mode,'patrol');assert.ok(s.guards[0].x>230||s.guards[0].y>360);assert.equal(s.alarm,0); });
test('investigating guards navigate around solid cover rather than entering it', () => { const s=createState(),g=fixtureGuard(s,{x:170,y:250,mode:'investigate',lastSeen:{x:440,y:250},investigateAge:0});s.player.x=100;s.player.y=550;play(s,{},3);assert.ok(g.y<185||g.y>315);assert.ok(!LEVELS[0].walls.some(r=>g.x>r.x&&g.x<r.x+r.w&&g.y>r.y&&g.y<r.y+r.h)); });
test('takedowns require the rear, quiet facing and clear physical space', () => { const s=createState(),g=fixtureGuard(s,{x:130,y:100});s.player.x=106;s.player.y=100;assert.equal(rearTakedownAvailable(s,g),true);g.facing=Math.PI;assert.equal(rearTakedownAvailable(s,g),false);g.facing=0;g.mode='alert';assert.equal(rearTakedownAvailable(s,g),false); });
test('held rear takedown commits briefly and removes only that patrol', () => { const s=createState(),g=fixtureGuard(s,{x:130,y:100,turnWait:0});s.player.x=106;s.player.y=100;play(s,{interact:true,sneak:true},.65);assert.equal(g.mode,'down');assert.equal(s.score,180);assert.equal(s.alarm,0); });
test('interacting at a seal channels, and movement breaks the channel', () => { const s=quiet();s.player.x=430;s.player.y=155;play(s,{interact:true},.4);assert.equal(s.scrolls[0],false);assert.ok(s.channel.progress>.3);step(s,{right:true,interact:true});assert.equal(s.channel,null);play(s,{interact:true},1.2);assert.equal(s.scrolls[0],true);assert.equal(s.score,1000); });
test('extraction stays locked until every scroll is secured', () => { const s=quiet();assert.equal(interactionTarget(s),null);play(s,{interact:true},1);assert.equal(s.phase,'playing');for(let i=0;i<s.scrolls.length;i++){Object.assign(s.player,LEVELS[0].seals[i]);play(s,{interact:true},1.2);}s.player.x=100;s.player.y=535;play(s,{interact:true},.85);assert.equal(s.phase,'mission-clear');assert.equal(s.cleared,1); });
test('optional caches are once-only and resources carry across missions without healing', () => { const s=quiet();s.player.hp=2;s.smoke=1;s.kunai=0;Object.assign(s.player,LEVELS[0].caches[0]);play(s,{interact:true},.75);assert.equal(s.kunai,2);play(s,{interact:true},.75);assert.equal(s.kunai,2);s.phase='mission-clear';assert.equal(nextMission(s),true);assert.equal(s.player.hp,2);assert.equal(s.smoke,1);assert.equal(s.kunai,2);assert.equal(s.level,1);assert.equal(s.scrolls.some(Boolean),false);assert.equal(s.caches.some(Boolean),false); });
test('guards telegraph a slash and only its facing sector hurts', () => { const s=createState(),g=fixtureGuard(s,{x:130,y:100,mode:'alert'});s.player.x=155;s.player.y=100;step(s,{});assert.ok(g.attack>.7);play(s,{},.45);assert.equal(s.player.hp,3);play(s,{},.2);assert.equal(s.player.hp,2);assert.ok(s.player.invulnerable>0); });
test('escaping behind a committed slash avoids the strike', () => { const s=createState(),g=fixtureGuard(s,{x:130,y:100,mode:'alert',attack:.78,attackFacing:0});s.player.x=130;s.player.y=72;play(s,{},.7);assert.equal(s.player.hp,3); });
test('invulnerability prevents simultaneous guards from doubling a wound', () => { const s=createState();const a=fixtureGuard(s,{x:130,y:100,mode:'alert',attack:.2,attackFacing:0}),b={...a,id:1};s.guards.push(b);s.player.x=155;s.player.y=100;play(s,{},.1);assert.equal(s.player.hp,2); });
test('an idle campaign is defeated by the active deadline, not free parked progress', () => { const s=quiet();play(s,{},missionDeadline(s)+1);assert.equal(s.phase,'lost');assert.match(s.reason,/clock expired/);assert.equal(s.cleared,0);assert.equal(s.score,0); });
test('pause freezes all clocks, bodies, tools and patrols without restarting resources', () => { const s=createState();step(s,{smoke:true});assert.equal(togglePause(s),true);const before=JSON.stringify(s);step(s,{right:true,kunai:true},.25);assert.equal(JSON.stringify(s),before);assert.equal(togglePause(s),true);step(s,{});assert.ok(s.elapsed>FIXED_STEP);assert.equal(s.smoke,1); });
test('invalid step durations leave the simulation unchanged', () => { const s=createState(),before=JSON.stringify(s);for(const dt of [NaN,Infinity,0,-1])step(s,{right:true},dt);assert.equal(JSON.stringify(s),before); });
test('mission menus freeze elapsed time and never skip a mission from active play', () => { const s=createState();assert.equal(nextMission(s),false);s.phase='mission-clear';const elapsed=s.elapsed;play(s,{right:true},10);assert.equal(s.elapsed,elapsed);assert.equal(nextMission(s),true);assert.equal(s.level,1);assert.equal(s.levelElapsed,0);assert.equal(s.elapsed,elapsed); });
test('a deliberate first heist clears with native movement and held interactions, without spending tools', () => {
 const s=createState();
 const route=[[100,155],[430,155,true],[430,325],[740,325],[795,375,true],[795,535],[585,535],[585,505,true],[585,535],[100,535,true]];
 for(const [x,y,interact] of route){let ticks=0;while(Math.hypot(x-s.player.x,y-s.player.y)>2&&s.phase==='playing'&&ticks++<6000)step(s,{right:x-s.player.x>1,left:x-s.player.x< -1,down:y-s.player.y>1,up:y-s.player.y< -1,sneak:true});assert.ok(ticks<6000,'route must not park against a guard');if(interact)play(s,{interact:true,sneak:true},1.34);if(s.phase!=='playing')break;}
 assert.equal(s.phase,'mission-clear');assert.equal(s.player.hp,3);assert.equal(s.alarm,0);assert.equal(s.smoke,2);assert.equal(s.kunai,6);assert.ok(s.scrolls.every(Boolean));assert.ok(s.levelElapsed<35);
});
test('raising an alarm beyond the campaign allowance locks the whole fortress', () => {const s=createState();s.alarm=DIFFICULTIES.veteran.alarms;fixtureGuard(s,{x:100,y:100});s.player.x=145;s.player.y=100;play(s,{},1);assert.equal(s.phase,'lost');assert.match(s.reason,/alarm allowance/);assert.equal(s.alarm,9);});
test('a last wound ends the campaign and later input cannot revive it', () => {const s=createState();s.player.hp=1;fixtureGuard(s,{x:130,y:100,mode:'alert',attack:.2,attackFacing:0});s.player.x=155;s.player.y=100;play(s,{},.1);assert.equal(s.phase,'lost');assert.equal(s.player.hp,0);const before=JSON.stringify(s);step(s,{smoke:true,interact:true},.25);assert.equal(JSON.stringify(s),before);assert.equal(nextMission(s),false);});

// A controller uses only public observations and normal held controls. Its route
// finder plans around cover; it never relocates actors, refills tools or changes AI.
function runCampaign(difficulty = 'veteran', careful = true) {
 const s=createState({difficulty}), graphs=new Map(), distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const clear=(l,a,b)=>!l.walls.some(r=>sweepCircleRect(a.x,a.y,b.x-a.x,b.y-a.y,10.1,r));
 function graph(l){
  if(graphs.has(l.id))return graphs.get(l.id);
  const nodes=[],grid=new Map(),spacing=18;
  for(let y=60;y<=600;y+=spacing)for(let x=48;x<=912;x+=spacing){if(l.walls.some(r=>Math.hypot(x-Math.max(r.x,Math.min(r.x+r.w,x)),y-Math.max(r.y,Math.min(r.y+r.h,y)))<11))continue;const n={x,y,index:nodes.length,links:[]};nodes.push(n);grid.set(`${x},${y}`,n);}
  for(const n of nodes)for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const b=grid.get(`${n.x+dx*spacing},${n.y+dy*spacing}`);if(b&&clear(l,n,b))n.links.push(b.index);}
  graphs.set(l.id,nodes);return nodes;
 }
 function path(l,start,goal){
  if(clear(l,start,goal))return[goal];
  const nodes=graph(l),nearest=p=>nodes.filter(n=>clear(l,p,n)).reduce((best,n)=>!best||distance(n,p)<distance(best,p)?n:best,null),source=nearest(start),target=nearest(goal);
  assert.ok(source&&target,'each objective must have a reachable cover route');
  const open=new Set([source.index]),cost=new Map([[source.index,0]]),parent=new Map();
  while(open.size){let current=[...open].reduce((a,b)=>(cost.get(a)+distance(nodes[a],target))<(cost.get(b)+distance(nodes[b],target))?a:b);if(current===target.index){const out=[goal];while(current!==source.index){out.unshift(nodes[current]);current=parent.get(current);}out.unshift(source);return out;}open.delete(current);for(const next of nodes[current].links){const score=cost.get(current)+distance(nodes[current],nodes[next]);if(score<(cost.get(next)??Infinity)){cost.set(next,score);parent.set(next,current);open.add(next);}}}
  return null;
 }
 const firstRoute=[{x:100,y:155},{x:430,y:155,interact:true},{x:430,y:325},{x:740,y:325},{x:795,y:375,interact:true},{x:795,y:535},{x:585,y:535},{x:585,y:505,interact:true},{x:585,y:535},{x:100,y:535,interact:true}];
 let stage=-1,target=null,waypoints=[],firstWaypoint=0,ticks=0;const missions=[];
 while(['playing','mission-clear'].includes(s.phase)&&ticks++<60*140*9){
  if(s.phase==='mission-clear'){missions.push({level:s.level,allSeals:s.scrolls.every(Boolean),time:s.levelElapsed,hp:s.player.hp});nextMission(s);}
  if(s.level!==stage){stage=s.level;target=null;waypoints=[];}
  const l=LEVELS[s.level],p=s.player;
  if(careful&&s.level===0){const n=firstRoute[firstWaypoint],dx=n.x-p.x,dy=n.y-p.y;if(Math.hypot(dx,dy)<3){if(n.interact&&interactionTarget(s)){step(s,{interact:true,sneak:true});continue;}firstWaypoint++;continue;}step(s,{right:dx>1,left:dx< -1,down:dy>1,up:dy< -1,sneak:true});continue;}
  if(!target||(target.type==='seal'&&s.scrolls[target.index])||(target.type==='cache'&&s.caches[target.index])){
   const objectives=l.seals.flatMap((p,index)=>s.scrolls[index]?[]:[{...p,type:'seal',index}]);if(careful)objectives.push(...l.caches.flatMap((p,index)=>s.caches[index]?[]:[{...p,type:'cache',index}]));if(!objectives.length)objectives.push({x:l.exit[0],y:l.exit[1],type:'exit',index:0});
   const candidates=objectives.map(o=>({o,route:path(l,p,o)})).filter(c=>c.route),length=c=>c.route.reduce((sum,n,i)=>sum+distance(i?c.route[i-1]:p,n),0);
   // North, central, east gives a clean final approach behind the throne patrol.
   candidates.sort((a,b)=>careful&&s.level===8&&a.o.type==='seal'&&b.o.type==='seal'?a.o.index-b.o.index:length(a)-length(b));target=candidates[0]?.o;waypoints=candidates[0]?.route||[];assert.ok(target,'campaign route needs an objective');
  }
  if(distance(p,target)<20&&clear(l,p,target)){const input={interact:true,sneak:true};if(careful&&s.guards.some(g=>guardSees(s,g)&&g.suspicion>.5)&&s.smoke>0&&!s.clouds.some(c=>distance(c,p)<c.radius-5))input.smoke=true;step(s,input);continue;}
  while(waypoints.length>1&&distance(p,waypoints[0])<8)waypoints.shift();for(let i=waypoints.length-1;i>0;i--)if(clear(l,p,waypoints[i])){waypoints=waypoints.slice(i);break;}
  const n=waypoints[0]||target,dx=n.x-p.x,dy=n.y-p.y,near=s.guards.some(g=>g.mode!=='down'&&g.mode!=='alert'&&distance(g,p)<110);step(s,{right:dx>2,left:dx< -2,down:dy>2,up:dy< -2,sneak:careful&&near});
 }
 if(s.phase==='won')missions.push({level:s.level,allSeals:s.scrolls.every(Boolean),time:s.levelElapsed,hp:s.player.hp});
 return {state:s,missions,ticks};
}
test('all nine Veteran heists are feasible through normal controls with physical guard contact and persistent resources',()=>{
 const {state:s,missions,ticks}=runCampaign();assert.equal(s.phase,'won');assert.equal(s.cleared,9);assert.equal(missions.length,9);assert.ok(missions.every(m=>m.allSeals&&m.hp>0&&m.time<DIFFICULTIES.veteran.time+(LEVELS[m.level].timeBonus||0)));assert.ok(s.player.hp>0&&s.player.hp<=3);assert.ok(s.alarm<=8);assert.ok(s.smoke>=0&&s.kunai>=0);assert.ok(s.score>20000);assert.ok(ticks<60*140*9);
});
test('sprinting the shortest objective route without reading patrols fails early in Veteran',()=>{const {state:s}=runCampaign('veteran',false);assert.equal(s.phase,'lost');assert.ok(s.cleared<2);assert.ok(s.elapsed<45);});
