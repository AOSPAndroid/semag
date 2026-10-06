// Authored two-pixel sprite poses. These are visual silhouettes; the engine owns hitboxes.
const INK = '#162b2b';
const GOLD = '#e4b778';
const CREAM = '#ffe4ad';
function block(ctx, x, y, w, h, color) {
  ctx.fillStyle = color; ctx.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, Math.max(2, Math.round(w / 2) * 2), Math.max(2, Math.round(h / 2) * 2));
}
function shape(ctx, points, color) {
  const min = Math.floor(Math.min(...points.map(p => p[1])) / 2) * 2, max = Math.ceil(Math.max(...points.map(p => p[1])) / 2) * 2;
  ctx.fillStyle = color;
  for (let y = min; y < max; y += 2) {
    const hits = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      if ((a[1] <= y + 1 && b[1] > y + 1) || (b[1] <= y + 1 && a[1] > y + 1)) hits.push(a[0] + (y + 1 - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
    }
    hits.sort((a, b) => a - b);
    for (let i = 0; i + 1 < hits.length; i += 2) ctx.fillRect(Math.round(hits[i] / 2) * 2, y, Math.max(2, Math.round((hits[i + 1] - hits[i]) / 2) * 2), 2);
  }
}
function seam(ctx, points, color, width = 2) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], steps = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / 2);
    for (let j = 0; j <= steps; j++) block(ctx, a[0] + (b[0] - a[0]) * j / Math.max(1, steps) - width / 2, a[1] + (b[1] - a[1]) * j / Math.max(1, steps) - width / 2, width, width, color);
  }
}
function eye(ctx, x, y, bright = CREAM) { block(ctx, x - 2, y - 2, 6, 4, INK); block(ctx, x, y - 2, 4, 2, bright); }
function boot(ctx, x, y, color = '#3c4540') { block(ctx, x, y, 10, 10, INK); block(ctx, x, y, 8, 6, color); block(ctx, x - 2, y + 8, 12, 2, '#87947b'); }
function hood(ctx, x, y, look, colors, back = false) {
  shape(ctx, [[x-16,y+18],[x-16,y+2],[x-10,y-10],[x,y-16],[x+12,y-10],[x+18,y+4],[x+14,y+20]], INK);
  shape(ctx, [[x-12,y+16],[x-12,y+2],[x-8,y-8],[x,y-12],[x+10,y-8],[x+14,y+4],[x+10,y+16]], colors.main);
  seam(ctx, [[x-10,y-2],[x-6,y-8],[x,y-12],[x+6,y-10]], colors.light);
  shape(ctx, [[x+6,y-8],[x+14,y+4],[x+10,y+16],[x+6,y+12]], colors.dark);
  if (back) { seam(ctx, [[x,y-6],[x+2,y+10]], colors.mid); block(ctx,x-8,y+10,16,4,colors.dark); return; }
  const side = Math.abs(look) > .7, faceX = x + (side ? Math.sign(look) * 6 : look * 3);
  shape(ctx, [[faceX-8,y],[faceX+8,y],[faceX+10,y+10],[faceX+4,y+16],[faceX-6,y+14],[faceX-10,y+6]], '#3b4036');
  shape(ctx, [[faceX-6,y+2],[faceX+6,y+2],[faceX+8,y+10],[faceX+2,y+14],[faceX-6,y+12]], '#d8b18a');
  if (look < .75) block(ctx,faceX-4,y+6,2,4,INK);
  if (look > -.75) block(ctx,faceX+4,y+6,2,4,INK);
  block(ctx,faceX,y+10,2,2,'#ffe1b1'); block(ctx,faceX-8,y,16,4,colors.dark);
}
function adventurer(ctx, a, t, walking) {
  const dx=a.aimX??1,dy=a.aimY??0,back=dy<-.5, stride=walking?Math.sin(t*15)*3:0, bob=walking?Math.abs(stride)*.45:0;
  const p={main:'#82a67e',light:'#c1d5a2',mid:'#66856d',dark:'#3f6055'};
  boot(ctx,-12,10+stride);boot(ctx,4,10-stride);
  shape(ctx,[[-14,-18+bob],[12,-18+bob],[20+stride,12],[8,18],[0,12],[-10,18],[-22-stride,10]],INK);
  shape(ctx,[[-12,-16+bob],[10,-16+bob],[16+stride,10],[8,14],[0,10],[-10,14],[-18-stride,8]],p.dark);
  shape(ctx,[[-8,-14+bob],[10,-12+bob],[10,8],[0,12],[-10,8]],back?p.mid:'#96774e');
  block(ctx,-10,2,22,4,'#3a4d40');block(ctx,-1,2,6,4,GOLD);
  seam(ctx,[[-6,-12+bob],[8,0]],'#c7ac79',4);block(ctx,-13,1,6,9,'#654e3d');block(ctx,11,0,6,10,'#325c64');block(ctx,13,0,2,4,'#b2d2c1');
  hood(ctx,dx*2,-30+bob,dx,p,back);
  shape(ctx,[[-14,-12+bob],[-6,-10+bob],[4,-12+bob],[14,-10+bob],[8,-4+bob],[-12,-6+bob]],'#c88658');
  seam(ctx,[[-12,-10+bob],[-3,-8+bob],[8,-10+bob]],'#efbb78');
  shape(ctx,[[back?-8:7,-8],[back?-12:13,1],[back?-20:21,6],[back?-14:15,10],[back?-8:9,3]],'#a66e4d');
  const hx=dx*16,hy=dy*13+1;seam(ctx,[[dx*7,-7+bob],[hx*.7,hy],[hx,hy]],p.mid,6);block(ctx,hx-3,hy-3,6,6,'#d1ad84');
}
function crawler(ctx,a,t) {
  const walk=Math.sin(t*13+a.id)*3;
  for(const side of [-1,1])for(let i=0;i<3;i++)seam(ctx,[[side*12,-9+i*9],[side*22,-10+i*10+(i%2?walk:-walk)],[side*27,-5+i*10]],'#58765c',4);
  shape(ctx,[[-20,-12],[-10,-22],[10,-22],[20,-12],[20,10],[10,20],[-10,20],[-20,10]],INK);
  shape(ctx,[[-16,-12],[-8,-18],[8,-18],[16,-12],[16,8],[8,14],[-8,14],[-16,8]],'#658459');
  shape(ctx,[[-12,-12],[-4,-16],[-2,10],[-8,12],[-14,4]],'#91a869');shape(ctx,[[2,-16],[10,-12],[14,4],[8,12],[2,10]],'#78955c');
  seam(ctx,[[0,-18],[0,12]],'#3b604b',2);block(ctx,-10,-14,4,4,'#bcc489');block(ctx,6,-10,4,4,'#a6b47a');
  shape(ctx,[[-12,10],[12,10],[10,22],[-10,22]],'#3a5c48');eye(ctx,-7,15,'#efcd85');eye(ctx,5,15,'#efcd85');
  seam(ctx,[[-9,20],[-14,24]],'#e3c38a',2);seam(ctx,[[9,20],[14,24]],'#e3c38a',2);
}
function archer(ctx,a,t) {
  const dx=a.aimX??-1,dy=a.aimY??0,bob=Math.sin(t*8+a.id)*1.5,p={main:'#947581',light:'#c6a8a0',mid:'#746477',dark:'#504757'};
  boot(ctx,-10,9+bob);boot(ctx,3,9-bob);shape(ctx,[[-13,-13],[12,-13],[19,16],[-18,16]],INK);shape(ctx,[[-10,-12],[9,-12],[14,12],[-14,12]],p.dark);
  shape(ctx,[[-5,-12],[5,-12],[7,9],[-7,9]],'#9d7765');seam(ctx,[[-12,3],[13,3]],'#d1ad82',3);
  hood(ctx,dx*2,-28+bob,dx,p,dy<-.5);block(ctx,-15,-9,5,17,'#5a413f');block(ctx,-17,-15,3,11,'#d3bc9a');block(ctx,-11,-15,3,11,'#e5caaa');
  const bx=dx<0?-24:24;seam(ctx,[[bx-5,-20],[bx+3,-16],[bx+8,-4],[bx+3,12],[bx-5,16]],'#bf986e',3);seam(ctx,[[bx-5,-20],[bx-11,a.phase==='tell'?-4:0],[bx-5,16]],'#ded0af',2);
  seam(ctx,[[dx*8,-8],[bx-10,0]],p.main,6);block(ctx,bx-13,-3,6,6,'#cdae92');seam(ctx,[[bx-10,-1],[bx+10,-1]],'#d9bd89',2);shape(ctx,[[bx+9,-4],[bx+15,-1],[bx+9,2]],CREAM);
}
function armored(ctx,a,t,sentinel=false) {
  const dx=a.aimX??-1,dy=a.aimY??0,look=dx*3,bob=Math.sin(t*9+a.id)*1.2;
  const p=sentinel?{main:'#8aa6a5',light:'#c5d0ba',mid:'#647f83',dark:'#3c5963'}:{main:'#b07a64',light:'#e0b488',mid:'#89594f',dark:'#5c4545'};
  boot(ctx,-13,10+bob,p.dark);boot(ctx,5,10-bob,p.dark);
  shape(ctx,[[-16,-19],[16,-19],[23,8],[13,16],[-15,16],[-23,6]],INK);shape(ctx,[[-13,-17],[13,-17],[18,7],[10,12],[-12,12],[-18,6]],p.mid);
  shape(ctx,[[-11,-17],[11,-17],[13,3],[0,8],[-13,3]],p.main);seam(ctx,[[-10,-14],[0,-10],[10,-14]],p.light,2);block(ctx,-13,7,26,4,p.dark);block(ctx,-3,6,6,6,GOLD);
  shape(ctx,[[look-15,-30+bob],[look-9,-43+bob],[look+8,-43+bob],[look+16,-31+bob],[look+13,-16+bob],[look-13,-16+bob]],INK);
  shape(ctx,[[look-12,-30+bob],[look-8,-39+bob],[look+6,-39+bob],[look+12,-30+bob],[look+10,-20+bob],[look-10,-20+bob]],p.main);seam(ctx,[[look-7,-38+bob],[look+5,-38+bob],[look+10,-30+bob]],p.light);
  if(dy<-.6)seam(ctx,[[look,-38+bob],[look,-21+bob]],p.dark,4);else{block(ctx,look-11,-29+bob,22,6,INK);eye(ctx,look-6,-27+bob);eye(ctx,look+4,-27+bob);seam(ctx,[[look,-38+bob],[look,-19+bob]],p.mid,4);}
  if(!sentinel){shape(ctx,[[-13,-37],[-21,-46],[-18,-52],[-11,-43]],'#d2bd92');shape(ctx,[[11,-40],[16,-49],[22,-51],[19,-40]],'#d2bd92');seam(ctx,[[-4,-14],[0,-8],[5,-14]],'#dbad72',2);}
  const sx=dx<0?-23:23;
  if(sentinel){shape(ctx,[[sx-14,-10],[sx,-16],[sx+14,-10],[sx+12,13],[sx,23],[sx-12,13]],INK);shape(ctx,[[sx-11,-8],[sx,-12],[sx+10,-8],[sx+9,11],[sx,18],[sx-9,11]],p.main);shape(ctx,[[sx-7,-6],[sx,-9],[sx+7,-6],[sx+6,9],[sx,13],[sx-6,9]],p.dark);seam(ctx,[[sx, -5],[sx,10]],GOLD,2);seam(ctx,[[sx-5,2],[sx+5,2]],GOLD,2);}
  else {seam(ctx,[[sx,7],[sx,-23]],'#69594b',4);shape(ctx,[[sx-10,-26],[sx+4,-33],[sx+14,-29],[sx+10,-12],[sx+2,-15],[sx-6,-14]],p.light);block(ctx,sx-3,-29,4,13,p.mid);}
}
function warden(ctx,a,t) {
  const tell=a.phase==='tell',lift=tell?-8:0;
  boot(ctx,-26,20,'#7b6654');boot(ctx,14,20,'#7b6654');block(ctx,-26,22,18,12,'#ac8861');block(ctx,12,22,18,12,'#ac8861');
  shape(ctx,[[-27,-32],[24,-32],[32,10],[20,27],[-23,26],[-33,8]],INK);shape(ctx,[[-24,-29],[22,-29],[27,9],[17,21],[-19,22],[-27,7]],'#826146');
  shape(ctx,[[-19,-25],[16,-25],[22,7],[10,14],[-17,13],[-23,0]],'#ae835b');block(ctx,-21,12,42,6,'#604b3e');block(ctx,-5,10,10,10,GOLD);
  shape(ctx,[[-17,-23],[16,-23],[20,0],[9,10],[-15,10],[-20,-2]],'#3a4039');
  for(let i=-2;i<=2;i++){block(ctx,i*6-2,-17,4,22,'#d69052');block(ctx,i*6-2,-12+Math.sin(t*4+i)*3,4,9,i%2?GOLD:CREAM);}
  shape(ctx,[[-35,-23+lift],[-27,-33+lift],[-19,-24+lift],[-24,8+lift],[-38,15+lift],[-43,4+lift]],INK);shape(ctx,[[-33,-22+lift],[-27,-29+lift],[-23,-22+lift],[-28,8+lift],[-37,10+lift],[-39,3+lift]],'#ad8055');
  shape(ctx,[[25,-29+lift],[38,-22+lift],[44,4+lift],[36,16+lift],[23,11+lift],[19,-16+lift]],INK);shape(ctx,[[27,-25+lift],[34,-19+lift],[39,3+lift],[34,11+lift],[27,8+lift],[24,-16+lift]],'#99714f');
  block(ctx,-37,-8+lift,12,8,GOLD);block(ctx,28,-8+lift,10,8,GOLD);
  shape(ctx,[[-20,-49],[-13,-61],[14,-61],[23,-45],[18,-26],[-17,-26]],INK);shape(ctx,[[-17,-47],[-11,-57],[11,-57],[18,-44],[15,-30],[-13,-30]],'#af8b63');
  block(ctx,-15,-45,30,9,'#403c34');eye(ctx,-10,-42,'#ffd893');eye(ctx,6,-42,'#ffd893');block(ctx,-3,-57,6,26,'#786449');block(ctx,-1,-57,2,26,'#d2af79');
  shape(ctx,[[-18,-53],[-28,-68],[-19,-66],[-11,-54]],'#c5a67a');shape(ctx,[[12,-55],[20,-67],[29,-66],[20,-51]],'#c5a67a');
  seam(ctx,[[-22,-19],[-26,-6],[-18,2]],'#dfb886',2);seam(ctx,[[22,-20],[26,-4],[18,4]],'#5c5040',2);
}
function stag(ctx,a,t) {
  const bob=Math.sin(t*7)*2,dx=a.aimX??-1;
  for(const [x,y]of[[-30,12],[-12,17],[12,18],[31,10]]){seam(ctx,[[x,y-4],[x-2,y+15],[x+5,y+24]],'#688fa4',6);block(ctx,x,y+20,10,4,'#d1e5df');}
  shape(ctx,[[-40,-10],[-27,-25],[12,-25],[32,-17],[41,5],[30,18],[-24,18],[-43,5]],INK);shape(ctx,[[-36,-8],[-25,-21],[10,-21],[28,-14],[36,4],[27,12],[-22,13],[-37,3]],'#789daf');
  shape(ctx,[[-28,-16],[-10,-20],[14,-18],[24,-10],[6,-7],[-18,-8]],'#b1ced0');seam(ctx,[[-26,-12],[-12,-5],[7,-8],[27,4]],'#4a738b',4);
  for(const[x,y]of[[-27,-21],[-10,-24],[9,-22],[25,-14]]){shape(ctx,[[x-6,y+5],[x-3,y-9],[x+3,y-18],[x+7,y-4],[x+4,y+6]],'#a8c9d1');seam(ctx,[[x+3,y-14],[x+2,y+1]],'#e2ece0',2);}
  ctx.save();ctx.translate(dx*11,-4+bob);
  shape(ctx,[[-16,-21],[-10,-35],[12,-35],[19,-20],[13,-6],[0,2],[-13,-5]],INK);shape(ctx,[[-12,-21],[-8,-31],[9,-31],[14,-20],[10,-9],[0,-3],[-10,-8]],'#b9d1d0');
  shape(ctx,[[-10,-18],[0,-24],[12,-18],[8,-6],[0,-2],[-8,-6]],'#638b9e');eye(ctx,-9,-17,'#fff4c3');eye(ctx,6,-17,'#fff4c3');block(ctx,-4,-5,8,4,INK);
  for(const side of [-1,1]){seam(ctx,[[side*10,-28],[side*17,-45],[side*14,-61]],'#d0ded5',6);seam(ctx,[[side*17,-43],[side*28,-52],[side*31,-66]],'#bed8d7',4);seam(ctx,[[side*15,-53],[side*24,-60],[side*22,-72]],'#a3c6cb',4);seam(ctx,[[side*14,-61],[side*8,-67],[side*9,-76]],'#e3e9db',2);}
  block(ctx,-3,-28,6,5,'#ffe3a5');ctx.restore();
  shape(ctx,[[-37,-11],[-48,-21],[-48,-8],[-39,1]],'#b6d3d0');
}
function queen(ctx,a,t) {
  const float=Math.sin(t*3)*3,tell=a.phase==='tell',look=(a.aimX??0)*3;
  shape(ctx,[[-22,-28],[20,-28],[35,30],[19,36],[9,26],[0,38],[-12,28],[-24,35],[-36,25]],INK);
  shape(ctx,[[-18,-25],[17,-25],[29,27],[19,30],[9,23],[0,31],[-12,23],[-23,29],[-29,23]],'#6e3f49');
  shape(ctx,[[-12,-25],[11,-25],[17,24],[7,29],[0,20],[-9,29],[-17,24]],'#b46750');
  seam(ctx,[[-17,-15],[-21,15],[-25,26]],'#d19161',2);seam(ctx,[[15,-16],[20,13],[24,26]],'#c38659',2);seam(ctx,[[-8,-22],[-2,10],[0,23]],'#e0ad75',2);
  for(const side of [-1,1]){const handY=-10+(tell?-14:Math.sin(t*3+side)*3);shape(ctx,[[side*14,-23],[side*25,-9],[side*34,handY-3],[side*36,handY+4],[side*25,handY+8],[side*18,-6]],'#b87555');seam(ctx,[[side*15,-21],[side*25,-7]],'#e4ac73',2);block(ctx,side*33-3,handY,6,6,'#e9c493');shape(ctx,[[side*35,handY-14],[side*40,handY-7],[side*35,handY-1],[side*30,handY-7]],tell?CREAM:GOLD);}
  shape(ctx,[[look-15,-45+float],[look-9,-53+float],[look+10,-53+float],[look+16,-43+float],[look+10,-24+float],[look-10,-24+float]],'#382f39');
  shape(ctx,[[look-10,-43+float],[look+10,-43+float],[look+8,-30+float],[look-7,-29+float]],'#ddbc91');block(ctx,look-9,-40+float,18,5,'#493344');eye(ctx,look-6,-38+float);eye(ctx,look+4,-38+float);block(ctx,look-3,-31+float,6,2,'#a86454');
  shape(ctx,[[-18,-51+float],[-20,-66+float],[-9,-59+float],[0,-74+float],[9,-59+float],[20,-66+float],[18,-51+float]],INK);shape(ctx,[[-15,-53+float],[-16,-61+float],[-8,-56+float],[0,-68+float],[8,-56+float],[16,-61+float],[15,-53+float]],GOLD);block(ctx,-14,-54+float,28,4,'#eccb86');shape(ctx,[[0,-59+float],[4,-54+float],[0,-49+float],[-4,-54+float]],'#ce7054');
  shape(ctx,[[-13,-23],[0,-17],[13,-23],[8,-13],[-8,-13]],'#e5bd85');block(ctx,-3,-16,6,8,'#fff0bb');
}
export function drawEmberActor(ctx, actor, act, time, walking = false) {
  ctx.save();ctx.translate(Math.round(actor.x/2)*2,Math.round(actor.y/2)*2);ctx.imageSmoothingEnabled=false;
  if(actor.type==='hero')adventurer(ctx,actor,time,walking);
  else if(actor.boss){if(act===1)warden(ctx,actor,time);else if(act===2)stag(ctx,actor,time);else queen(ctx,actor,time);}
  else if(actor.type==='crawler')crawler(ctx,actor,time);
  else if(actor.type==='archer')archer(ctx,actor,time);
  else armored(ctx,actor,time,actor.type==='sentinel');
  ctx.restore();
}
export function drawEmberProjectile(ctx, p, time) {
  const angle=Math.atan2(p.vy,p.vx),friendly=p.owner==='player';ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);
  for(let i=3;i>0;i--){ctx.globalAlpha=.12+(3-i)*.08;shape(ctx,[[-i*9,-2-i],[-i*9+10,-4],[-i*9+17,0],[-i*9+10,4],[-i*9,2+i]],friendly?'#e7a36b':'#df8b76');}
  ctx.globalAlpha=1;shape(ctx,[[-9,-4],[-3,-8],[5,-6],[10,0],[5,6],[-3,8],[-9,4]],friendly?'#ad6f45':'#954c4a');shape(ctx,[[-6,-3],[0,-5],[7,0],[0,5],[-6,3]],GOLD);block(ctx,0,-2,4,4,CREAM);block(ctx,-4,-4,2,2,'#fff4cf');ctx.restore();
}
export function drawEmberBlade(ctx,p) {
  const aim=Math.atan2(p.aimY,p.aimX),swing=p.attackTime>0,angle=aim+(swing?(1-p.attackTime/.15)*1.8-.9:0);
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);block(ctx,14,-3,10,6,'#725b43');block(ctx,22,-8,4,16,GOLD);
  shape(ctx,[[26,-4],[48,-4],[58,0],[48,4],[26,4]],INK);shape(ctx,[[26,-2],[48,-2],[54,0],[48,2],[26,2]],'#d9ddbe');block(ctx,28,-2,20,2,'#fff4cb');ctx.restore();
  if(swing){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(aim);ctx.strokeStyle=p.empowered>0?'#fff1bf':'#e7c58e';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,82,-.95,.95);ctx.stroke();ctx.globalAlpha=.13;ctx.fillStyle='#ffd492';ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,82,-.95,.95);ctx.closePath();ctx.fill();ctx.restore();}
}
