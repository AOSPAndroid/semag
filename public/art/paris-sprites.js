/** Original Paris pixel materials, painted once and reused. All anchors are centers. */
export function createParisSprites() {
  const cache = new Map();
  const C = { ink:'#273039', dark:'#34424a', zinc:'#71818b', zincLight:'#94a0a3', paper:'#e9dfc6', stone:'#b8ad99', cream:'#dbd1b8', teal:'#367d79', green:'#517b65', ochre:'#d6a857', orange:'#c86b43', road:'#62696b' };
  const palettes = ['#e1d7bd','#87959b','#bca78d','#578783','#b2664f','#626d84'];
  function material(key, width, height, paint) {
    if (cache.has(key)) return cache.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
    const r = (x,y,w,h,color) => { ctx.fillStyle=color; ctx.fillRect(x,y,w,h); };
    const p = (points,color) => { ctx.fillStyle=color; ctx.beginPath(); for (let i=0;i<points.length;i++) i ? ctx.lineTo(...points[i]) : ctx.moveTo(...points[i]); ctx.closePath(); ctx.fill(); };
    paint(r,p,ctx); cache.set(key,canvas); return canvas;
  }
  function bicycle(player, frame, assist, damaged, variant=0) {
    const jackets = ['#58878c','#a8789b','#73815a','#ad7450'];
    return material(`bike:${player}:${frame}:${assist}:${damaged}:${variant}`,28,56,(r,p) => {
      r(13,2,5,15,C.ink); r(14,3,2,13,'#94a2a1'); r(13,40,5,14,C.ink); r(14,42,2,10,'#859795');
      r(12,16,6,26,player?C.teal:'#917d62'); r(12,18,2,22,'#99b7a5'); r(16,24,2,12,C.ink);
      r(6,12,19,3,C.ink); r(5,11,4,4,'#4d686c'); r(22,11,4,4,'#4d686c');
      r(8,14,4,7,'#deb68d'); r(20,14,4,7,'#deb68d');
      p([[10,18],[20,18],[24,25],[21,33],[9,33],[7,25]],C.ink);
      const coat = damaged?'#f1b57a':player?C.orange:jackets[variant%jackets.length];
      r(10,19,11,13,coat); r(10,20,3,9,player?'#e9945a':'#97b1a4'); r(19,23,2,8,'#8e5d47');
      r(9,18,4,5,coat); r(19,18,4,5,coat);
      r(11,31,5,7,'#343f48'); r(16,31,5,7,'#343f48');
      r(frame?9:11,35,4,7,'#344a57'); r(frame?19:17,35,4,7,'#344a57');
      r(frame?7:9,40,6,3,C.ink); r(frame?19:17,40,6,3,C.ink);
      r(9,34,13,2,'#7f9190'); r(8,34,3,3,C.ink); r(20,34,3,3,C.ink);
      r(11,12,10,9,C.ink); r(12,12,8,7,player?'#eee2bd':'#d5bf9a');
      r(12,13,3,5,'#fff0c9'); r(17,14,2,4,'#b1ad97'); r(13,11,6,2,'#eee2bd');
      r(11,21,10,10,player?C.ochre:'#6c766a'); r(12,21,8,2,player?'#f2d189':'#a4afa0');
      r(13,24,6,5,player?'#bf8d43':'#57635b'); r(14,25,4,2,player?'#e8bf65':'#7d8b7a');
      r(20,20,2,10,'#493d32'); r(15,29,2,2,'#eed0a2');
      r(13,43,5,2,'#bd6047'); r(14,43,3,1,'#f2bd81');
      if (assist) { r(6,25,3,8,'#80b2a2'); r(5,28,5,2,'#c2dcc1'); r(12,38,3,2,'#a8d2b1'); }
    });
  }
  function car(kind,variant) {
    const van = kind==='van'; const w=van?40:36,h=van?88:72;
    return material(`${kind}:${variant}`,w,h,(r,p) => {
      const color=kind==='taxi'?C.ochre:palettes[variant%palettes.length];
      r(3,11,w-4,h-17,'#354149'); r(2,17,4,12,C.ink); r(w-6,17,4,12,C.ink); r(2,h-24,4,12,C.ink); r(w-6,h-24,4,12,C.ink);
      p([[8,3],[w-8,3],[w-4,9],[w-3,h-10],[w-8,h-5],[8,h-5],[3,h-10],[4,9]],C.ink);
      r(6,6,w-12,h-14,color); r(4,14,w-8,h-29,color); r(7,6,w-14,3,'#efe6ce'); r(5,14,2,h-32,'#d6d0bb'); r(w-7,14,2,h-32,'#58696c');
      p([[8,15],[w-8,15],[w-6,28],[6,28]],'#334e58');
      p([[9,17],[w-9,17],[w-8,23],[8,23]],'#9eb5b2'); r(9,24,w-18,2,'#688e91');
      r(8,31,w-16,van?37:19,color); r(9,32,w-18,2,'#d6d1ba');
      if(van) { r(12,38,w-24,20,'#c8c6b6'); r(14,40,w-28,2,'#e4ddc9'); r(12,55,w-24,2,'#9ca39b'); r(19,61,2,10,'#858f8b'); }
      else { r(9,48,w-18,9,'#3f5b62'); r(10,49,w-20,3,'#789b9b'); r(12,42,w-24,2,'#e1d4b8'); }
      r(6,h-12,w-12,4,'#647779'); r(7,h-12,w-14,1,'#c3c6b4');
      r(6,8,6,3,'#fff0bd'); r(w-12,8,6,3,'#fff0bd'); r(5,h-17,6,4,'#a75345'); r(w-11,h-17,6,4,'#a75345'); r(6,h-17,4,1,'#e28f61'); r(w-10,h-17,4,1,'#e28f61');
      r(w/2-4,h-10,8,2,'#eee4c8'); r(1,26,5,4,C.ink); r(w-6,26,5,4,C.ink);
      if(kind==='taxi') { r(w/2-5,33,10,5,C.ink); r(w/2-4,33,8,3,'#fff0c3'); r(w/2-2,34,4,1,'#d59946'); }
    });
  }
  function bus() {
    return material('bus',48,154,(r,p) => {
      r(2,10,6,18,C.ink); r(40,10,6,18,C.ink); r(2,98,6,18,C.ink); r(40,98,6,18,C.ink); r(2,131,6,15,C.ink); r(40,131,6,15,C.ink);
      p([[8,2],[40,2],[45,9],[45,144],[40,151],[8,151],[3,144],[3,9]],C.ink);
      r(5,9,38,135,C.teal); r(8,3,32,10,'#3c6465'); r(8,4,32,2,'#b6c8b6'); r(8,11,32,12,'#2b4651'); r(9,12,30,4,'#86ada9'); r(21,13,2,10,'#466d72');
      r(10,25,28,107,'#c7c6b0'); r(11,26,26,2,'#eee6c9'); r(10,128,28,3,'#92aaa0');
      r(14,31,20,21,'#9baaa3'); r(16,33,16,2,'#d8d8c0'); r(16,38,16,11,'#718987');
      for(let y=39;y<48;y+=3) r(17,y,14,1,'#bac0b1');
      r(14,57,20,13,'#839992'); r(16,59,16,2,'#c7d1bc'); r(15,66,18,2,'#566f6f');
      r(5,80,38,14,'#3b4d51'); for(let y=81;y<94;y+=3) { r(6,y,36,1,'#9a9f97'); r(8,y+1,32,1,'#56696b'); }
      r(14,103,20,20,'#9eada5'); r(16,105,16,2,'#e1dfc6'); r(16,111,16,8,'#6f8c88');
      for(let y=32;y<134;y+=19) { r(4,y,3,12,'#243e49'); r(41,y,3,12,'#243e49'); r(4,y,2,2,'#82a6a1'); }
      r(5,24,3,55,'#cfb869'); r(40,24,3,55,'#e3c877'); r(6,96,2,38,'#cfb869'); r(40,96,2,38,'#e3c877');
      r(8,141,32,5,'#254b52'); r(9,142,5,2,'#d67d63'); r(34,142,5,2,'#d67d63'); r(20,143,8,2,'#e9dfbd'); r(7,5,5,2,'#faedbb'); r(36,5,5,2,'#faedbb');
      r(1,19,5,3,C.ink); r(42,19,5,3,C.ink);
    });
  }
  function scooter(variant) {
    return material(`scooter:${variant}`,24,50,(r,p) => {
      r(10,1,5,12,C.ink); r(11,2,2,9,'#819796'); r(9,37,7,12,C.ink); r(10,39,4,8,'#91a39c');
      p([[9,8],[16,8],[19,16],[18,37],[6,37],[5,16]],palettes[(variant+3)%6]); r(7,15,12,4,'#9cb7b0'); r(4,15,4,3,C.ink); r(18,15,4,3,C.ink);
      r(8,20,9,12,'#b28e61'); r(9,20,7,2,'#dfb97c'); r(7,17,4,6,'#deb891'); r(15,17,4,6,'#deb891');
      r(8,11,9,9,C.ink); r(9,11,7,7,'#e4debe'); r(10,12,2,4,'#fff2c8'); r(7,32,12,5,'#344954'); r(9,39,7,3,'#c46e55');
    });
  }
  function prop(kind) {
    return material(`prop:${kind}`,24,32,(r,p) => {
      if(kind==='pedestrian') { r(7,25,5,5,C.ink); r(14,25,4,5,C.ink); r(5,12,15,14,'#7d7890'); r(6,13,4,9,'#a19bad'); r(9,5,9,9,'#d9b38b'); r(8,4,11,4,'#736b57'); r(4,17,3,7,'#dfbd93'); r(19,17,3,7,'#dfbd93'); }
      else if(kind==='cone') { r(4,26,18,4,C.ink); p([[12,3],[4,27],[21,27]],'#cb7d46'); r(8,15,10,4,'#f4e3b9'); r(6,24,14,3,'#f1b164'); }
      else { r(6,24,14,5,'#526167'); r(9,8,8,18,'#344d56'); r(8,7,10,4,'#778f8d'); r(10,8,3,16,'#76988d'); r(9,14,8,3,'#ded8b4'); }
    });
  }
  function tree(r,x,y) {
    r(x+7,y+17,29,26,'#9b9c87'); r(x+17,y+35,5,12,'#746959');
    r(x+8,y+6,23,29,'#345e53'); r(x+2,y+15,36,14,'#345e53'); r(x+6,y+8,25,24,'#547e65'); r(x+3,y+17,30,10,'#658c6c'); r(x+12,y+3,16,28,'#769873');
    r(x+8,y+13,10,5,'#88a17a'); r(x+18,y+5,6,8,'#a0b087'); r(x+25,y+21,9,5,'#345e53'); r(x+13,y+29,12,4,'#416853');
  }
  function building(r,p,x,w,y,h,variant,side) {
    if(w<12) return;
    r(x,y,w,h,C.ink); r(x+2,y+2,w-4,h-4,'#d0c3a8'); r(x+6,y+5,w-12,h-15,C.zinc);
    r(x+7,y+6,w-14,4,C.zincLight); r(x+7,y+h-14,w-14,4,'#576a76');
    for(let sx=x+14;sx<x+w-8;sx+=17) r(sx,y+10,1,h-24,'#84929a');
    for(let sy=y+20;sy<y+h-20;sy+=38) { r(x+12,sy,w-24,1,'#506371'); r(x+13,sy+1,w-26,1,'#91a0a5'); }
    const edge=side==='left'?x+w-9:x+3;
    r(edge,y+9,6,h-18,'#ede0be'); r(edge+1,y+10,3,h-20,'#fff0ce');
    for(let sy=y+20;sy<y+h-20;sy+=24) { r(edge-1,sy,8,12,'#697579'); r(edge+1,sy+1,3,8,'#b4c2b8'); r(edge-2,sy+10,10,3,'#465862'); }
    for(let sy=y+18;sy<y+h-20;sy+=45) { r(x+Math.max(8,w*.32|0),sy,9,13,'#b7ad9b'); r(x+Math.max(8,w*.32|0)+2,sy+2,5,5,'#514f4b'); r(x+Math.max(8,w*.32|0),sy+11,10,3,'#d6c9aa'); }
    if(variant%2) { const a=side==='left'?x+w-15:x+3; r(a,y+h-34,12,25,'#b7765e'); for(let sy=y+h-33;sy<y+h-9;sy+=7) r(a,sy,12,3,'#ecd7ab'); r(a,y+h-9,12,3,'#724d40'); }
    else { const a=side==='left'?x+w-17:x+3; r(a,y+h-39,14,29,'#427a6d'); for(let sy=y+h-38;sy<y+h-10;sy+=7) r(a,sy,14,3,'#d9ddbe'); r(a,y+h-11,14,3,'#2d5d58'); }
    r(x+6,y+h-6,w-12,3,'#e8dabc');
  }
  function streetTile(width,roadLeft,roadRight,district) {
    const name=String(district?.id??district?.name??district??'0').toLowerCase();
    const bridge=/seine|pont|bridge/.test(name)||name==='3'; const hill=/montmartre|hill/.test(name)||name==='4';
    const key=`street:${width}:${roadLeft}:${roadRight}:${bridge?'bridge':hill?'hill':name}`;
    return material(key,width,288,(r,p,ctx) => {
      r(0,0,width,288,'#c5bba6'); r(roadLeft,0,roadRight-roadLeft,288,C.road);
      // Quiet, regular asphalt grain never competes with traffic silhouettes.
      for(let y=10;y<288;y+=41) for(let x=roadLeft+9;x<roadRight-8;x+=53) r(x,y+(x%7),2,1,'#6a7071');
      const sidewalk=28;
      for(const sx of [roadLeft-sidewalk,roadRight]) {
        r(sx,0,sidewalk,288,'#bfb6a1'); r(sx+2,0,sidewalk-4,288,'#d3c9b2');
        for(let y=0;y<288;y+=12) { r(sx+2,y,sidewalk-4,1,'#b5ac9c'); for(let x=sx+4+(y%24?0:6);x<sx+sidewalk-2;x+=10) r(x,y+1,1,10,'#c0b6a2'); }
      }
      r(roadLeft-4,0,4,288,'#efe2c4'); r(roadRight,0,4,288,'#efe2c4'); r(roadLeft,0,3,288,'#414f54'); r(roadRight-3,0,3,288,'#414f54');
      if(bridge) {
        r(0,0,Math.max(0,roadLeft-sidewalk),288,'#568e8b'); r(roadRight+sidewalk,0,width-roadRight-sidewalk,288,'#568e8b');
        for(let y=11;y<288;y+=26) { for(let x=8;x<roadLeft-sidewalk-8;x+=37) r(x,y+(x%5),19,2,'#7ba79a'); for(let x=roadRight+sidewalk+8;x<width-8;x+=37) r(x,y+(x%5),19,2,'#7ba79a'); }
        for(const edge of [roadLeft-sidewalk-5,roadRight+sidewalk]) { r(edge,0,5,288,'#7f8b80'); r(edge,0,2,288,'#e2d8ba'); for(let y=0;y<288;y+=36) { r(edge-3,y,11,8,'#c2b69b'); r(edge-2,y,9,2,'#efe3bf'); r(edge-1,y+8,7,5,'#7d847a'); } }
        for(let y=36;y<288;y+=72) { r(roadLeft-19,y,5,10,'#455e60'); r(roadRight+14,y,5,10,'#455e60'); r(roadLeft-20,y,7,2,'#a3b1a3'); r(roadRight+13,y,7,2,'#a3b1a3'); }
      } else {
        const leftW=roadLeft-sidewalk-4,rightX=roadRight+sidewalk+4;
        building(r,p,0,leftW,4,140,hill?3:0,'left'); building(r,p,0,leftW,151,134,1,'left');
        building(r,p,rightX,width-rightX,4,112,1,'right'); building(r,p,rightX,width-rightX,126,159,2,'right');
        if(leftW>34) tree(r,Math.max(0,leftW-34),101); if(width-rightX>34) tree(r,rightX-6,210);
        // Paris Métro entrance: green iron railings, red globe, small enamel sign.
        if(roadLeft>70) { const mx=roadLeft-26; r(mx-12,210,11,39,'#7e7d6b'); r(mx-11,212,9,36,'#a39d84'); r(mx-13,209,13,3,'#375d52'); r(mx-14,209,2,40,'#426b56'); r(mx-2,209,2,40,'#426b56'); for(let y=214;y<249;y+=7) r(mx-12,y,11,1,'#638570'); r(mx-15,190,2,18,'#385c4d'); r(mx-16,185,4,6,'#b8614c'); r(mx-16,196,14,7,'#345e4d'); r(mx-14,198,10,2,'#dcdcb6'); }
        if(hill&&leftW>40) { const cx=Math.max(4,leftW-37); r(cx,38,26,24,'#e6debf'); r(cx+5,27,16,13,'#e6debf'); r(cx+8,21,10,8,'#e6debf'); r(cx+10,18,6,4,'#b6b09b'); r(cx+11,11,4,7,'#9d9c8d'); r(cx+4,42,4,11,'#75878b'); r(cx+17,42,4,11,'#75878b'); r(cx+9,48,8,14,'#9c9c8b'); }
      }
    });
  }
  function stamp(ctx,s,x,y,scale,width,height,angle=0) {
    const w=width??s.width*scale,h=height??s.height*scale;
    ctx.save(); ctx.imageSmoothingEnabled=false; ctx.translate(Math.round(x),Math.round(y)); if(angle)ctx.rotate(angle); ctx.drawImage(s,-w/2,-h/2,w,h); ctx.restore();
  }
  return {
    drawRider(ctx,x,y,{scale=1,lean=0,pedal=0,assist=false,damaged=false,width,height}={}) {
      const frame=Math.abs(pedal%1)>=.5?1:0;
      stamp(ctx,bicycle(true,frame,!!assist,!!damaged),x,y,scale,width,height,Math.max(-.2,Math.min(.2,lean)));
    },
    drawActor(ctx,actor,x,y,{scale=1,width,height}={}) {
      const kind=String(actor.kind??actor.type??'car').toLowerCase();
      const variant=Math.abs(Number(actor.palette??actor.variant??actor.id??0)||0)%6|0;
      let s;
      if(kind.includes('bus'))s=bus();
      else if(kind.includes('cycl')||kind==='bike')s=bicycle(false,((actor.pedal??actor.z??0)%1)>=.5?1:0,false,false,variant%4);
      else if(kind==='scooter'||kind==='moped')s=scooter(variant);
      else if(kind==='pedestrian'||kind==='cone'||kind==='bollard')s=prop(kind);
      else s=car(kind==='van'?'van':kind==='taxi'?'taxi':'car',variant);
      stamp(ctx,s,x,y,scale,width,height,actor.angle??0);
    },
    drawStreet(ctx,{width=820,height=620,distance=0,district=0,roadLeft=width*.2,roadRight=width*.8,laneCount=4}={}) {
      roadLeft=Math.round(roadLeft); roadRight=Math.round(roadRight);
      const tile=streetTile(Math.ceil(width),roadLeft,roadRight,district);
      const offset=((distance%288)+288)%288;
      ctx.save(); ctx.imageSmoothingEnabled=false;
      for(let y=offset-288;y<height;y+=288)ctx.drawImage(tile,0,Math.floor(y));
      const laneWidth=(roadRight-roadLeft)/laneCount,markOffset=((distance%76)+76)%76;
      ctx.fillStyle='#a6aaa1'; ctx.globalAlpha=.55;
      for(let lane=1;lane<laneCount;lane++)for(let y=markOffset-76;y<height;y+=76)ctx.fillRect(Math.round(roadLeft+lane*laneWidth)-1,Math.round(y),2,29);
      ctx.globalAlpha=1; ctx.restore();
    },
    clear(){cache.clear();},
  };
}
