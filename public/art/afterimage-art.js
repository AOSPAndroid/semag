// Original rooftop and fighter artwork. All dimensions are in arena coordinates.
const poly = (ctx, points, fill, stroke) => {
  ctx.beginPath(); points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.closePath();
  ctx.fillStyle=fill; ctx.fill(); if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}
};
const rule = (ctx,x,y,w,h,fill) => {ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);};

export function paintRooftopDetails(ctx) {
  ctx.save();
  // A station canopy sits in the skyline, clear of the fighting plane.
  poly(ctx,[[356,310],[457,280],[585,286],[601,309]],'#1a2d37','#5a777761');
  poly(ctx,[[363,307],[459,287],[580,292],[589,306]],'#334c50');
  for(let x=385;x<584;x+=24){rule(ctx,x,310,3,44,'#1b3037');rule(ctx,x+3,312,1,38,'#5a777b48');}
  rule(ctx,390,322,179,1,'#dcbd7644');
  // Raised service housings and brushed roof vents, all behind the rear rail.
  for(const [x,y,w] of [[181,358,56],[945,351,71]]){
    poly(ctx,[[x,y],[x+9,y-8],[x+w+9,y-8],[x+w,y]],'#6b7b6d','#8b9a7955');
    poly(ctx,[[x+w,y],[x+w+9,y-8],[x+w+9,389],[x+w,398]],'#14282c');
    rule(ctx,x,y,w,39,'#2d4442');
    for(let k=0;k<5;k++){rule(ctx,x+7,y+6+k*5,w-14,2,'#162b30');rule(ctx,x+7,y+8+k*5,w-14,1,'#67827466');}
    rule(ctx,x+5,y+2,w-10,1,'#b5c38b55');
  }
  // Foreground cable trough, fasteners, worn paint and embossed access panels.
  for(let x=8;x<1200;x+=152){
    rule(ctx,x,483,119,2,'#0b171d'); rule(ctx,x+1,485,117,1,'#56695877');
    for(let k=0;k<9;k++)rule(ctx,x+11+k*11,516,5,1,'#7b8b6960');
    for(const dx of [3,112])for(const y of [490,551]){
      rule(ctx,x+dx,y,3,3,'#18292e');rule(ctx,x+dx,y,2,1,'#849477');
    }
    rule(ctx,x+13,560,84,1,'#87926d26');
  }
  // Potted rooftop plants bring a little life to the industrial perimeter.
  for(const [x,y] of [[38,393],[1157,394]]){
    rule(ctx,x-9,y-9,20,15,'#223b35');rule(ctx,x-7,y+6,16,2,'#647558');
    for(const [dx,dy] of [[-7,-8],[-3,-16],[3,-22],[8,-12]]){
      rule(ctx,x+dx,y+dy,3,-dy,'#36574a');
      poly(ctx,[[x+dx,y+dy],[x+dx-8,y+dy-4],[x+dx-5,y+dy-10],[x+dx+2,y+dy-7]],'#5b7551');
      rule(ctx,x+dx-3,y+dy-6,4,1,'#9aa67366');
    }
  }
  ctx.restore();
}

export function drawRooftopLife(ctx,time,reduced=false) {
  ctx.save();
  const clock=reduced?1600:time;
  // A slow commuter train crosses the far viaduct. It never overlaps fighters.
  const x=(clock*.017%1830)-590;
  for(let i=0;i<3;i++){
    const bx=x+i*91;
    poly(ctx,[[bx,338],[bx+5,332],[bx+75,332],[bx+84,339],[bx+84,350],[bx,350]],'#2d444a','#647b7344');
    for(let j=0;j<6;j++)rule(ctx,bx+10+j*10,336,6,6,j%3?'#b5c2a050':'#d7b67966');
    rule(ctx,bx+2,347,78,1,'#b4c48b55');
  }
  for(const [vx,vy] of [[195,356],[963,349]]){
    ctx.globalAlpha=.045;
    ctx.fillStyle='#cbddd1';
    for(let i=0;i<3;i++){
      const t=(clock/2700+i/3)%1;
      ctx.beginPath();ctx.ellipse(vx+t*13,vy-t*24,7+t*14,2+t*3,0,0,Math.PI*2);ctx.fill();
    }
  }
  ctx.restore();
}

export function drawFighterHead(ctx,p,color,id,time,ghost=false,action='idle') {
  const [x,y]=p.head;
  ctx.save();ctx.translate(x,y);
  // Jade wears a short armored hood; Violet has a swept knot and a silk mask.
  const violet=id%2===1, skin=violet?'#e5bfa2':'#cfb398';
  poly(ctx,[[-11,-9],[5,-11],[13,-3],[11,10],[4,14],[-8,10],[-13,1]],skin,'#12212a');
  rule(ctx,5,3,7,2,'#ac7e6d');
  if(violet){
    poly(ctx,[[-13,2],[-16,-6],[-13,-14],[0,-18],[10,-13],[11,-6],[1,-8],[-6,-2]],'#282737','#73728b');
    poly(ctx,[[-11,-11],[-20,-17],[-25,-13],[-23,-6],[-14,-4]],'#42344e','#9f82b4');
    rule(ctx,-19,-12,7,2,color.main);rule(ctx,-12,-9,16,2,'#b6a0c63b');
    poly(ctx,[[-10,4],[12,3],[10,11],[2,15],[-9,10]],'#504663','#aa92bc');
    rule(ctx,3,7,7,1,'#cebedb77');
  }else{
    poly(ctx,[[-13,4],[-16,-5],[-11,-14],[1,-17],[11,-10],[12,-4],[4,-7],[-5,-5]],'#253f3b','#7a9c6d');
    poly(ctx,[[-12,-10],[0,-15],[8,-9],[1,-10],[-7,-5]],'#4e6952');
    rule(ctx,-10,-7,14,1,'#a4b38966');
    poly(ctx,[[-10,3],[12,2],[10,11],[3,15],[-8,10]],'#283c3c','#57776a');
    for(let k=0;k<3;k++)rule(ctx,4+k*2,7,1,3,'#7f9c8177');
  }
  // Small visible eyes and a bright headband stay legible at game scale.
  const closed=action==='dead'||(!ghost&&Math.floor((time+id*617)/170)%29===0);
  rule(ctx,3,-1,8,closed?1:3,'#15272d');
  if(!closed){rule(ctx,5,-1,5,1,'#fff3db');rule(ctx,9,-1,1,2,color.dark);}
  rule(ctx,-8,-4,17,1,color.main);rule(ctx,-8,-4,4,1,color.light);
  ctx.restore();
}

export function drawFighterInsignia(ctx,p,color,id) {
  const [x,y]=p.shoulder;
  ctx.save();ctx.translate(x-3,y+12);
  poly(ctx,[[-5,-3],[0,-7],[5,-3],[4,4],[0,7],[-4,4]],'#16292d','#9eaa8066');
  if(id%2)poly(ctx,[[0,-4],[3,1],[0,4],[-3,1]],color.light);
  else{rule(ctx,-2,-3,4,6,color.main);rule(ctx,-4,-1,8,2,color.light);}
  rule(ctx,-7,12,12,1,'#a6b79755');
  ctx.restore();
}
