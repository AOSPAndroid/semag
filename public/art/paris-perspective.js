/** Original rear-view Paris pixel art. Cached canvases use their bottom as ground contact. */
export function createParisPerspective() {
  const cache = new Map();
  const C = { ink:'#263d43', deep:'#294a50', paper:'#f2e3bf', cream:'#dfcba4', stone:'#b7ad95', zinc:'#738b94', zincHi:'#99a6a6', teal:'#397f78', ochre:'#d8a656', orange:'#ca7147', green:'#527d62' };
  const paintColors=['#e2d7bb','#bd6d53','#729b96','#9fa8ad','#ccac75','#8e839b'];
  const normalize = (value,count=6) => Math.abs(Math.trunc(Number(value)||0))%count;
  function asset(key,width,height,paint) {
    if(cache.has(key))return cache.get(key);
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
    const r=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
    const p=(points,color)=>{ctx.fillStyle=color;ctx.beginPath();for(let i=0;i<points.length;i++)i?ctx.lineTo(...points[i]):ctx.moveTo(...points[i]);ctx.closePath();ctx.fill();};
    paint(r,p,ctx);cache.set(key,canvas);return canvas;
  }
  function rider(player,phase,assist,damaged,variant=0) {
    const width=player?76:40,height=player?126:92;
    const raw=asset(`rider:${player}:${phase}:${assist}:${damaged}:${variant}`,width,height,(r,p,ctx)=>{
      // Paint cyclists on the same coordinate grid, with fewer visual details.
      ctx.save();ctx.scale(width/76,height/126);
      p([[34,62],[42,62],[45,72],[45,114],[42,124],[34,124],[30,114],[30,73]],C.ink);
      p([[35,69],[40,69],[42,76],[42,111],[39,118],[35,118],[33,112],[33,77]],'#9fae9c');
      r(35,76,5,37,'#455a5d');r(36,81,3,26,'#b3b9a3');
      p([[39,61],[44,61],[48,67],[48,103],[44,111],[42,111],[43,101],[43,69]],'#40595b');
      r(44,73,2,24,'#9caaa0');
      // The frame, crank, battery and fork remain visible below the courier bag.
      p([[37,67],[48,62],[45,92],[37,98],[25,88],[37,67]],'#315b5e');
      p([[37,73],[44,67],[42,89],[37,93],[29,86],[37,73]],'#91b7a4');
      p([[37,76],[40,72],[39,91],[36,91]],'#3d8f85');
      r(32,68,14,4,C.ink);r(28,69,5,4,'#678a7f');r(41,65,4,19,C.teal);r(42,67,2,12,'#98c5a6');
      r(22,82,12,3,'#536e6b');r(46,85,10,3,'#536e6b');r(35,88,6,6,'#d7ce9f');r(36,89,4,4,'#4a6a67');
      if(phase){p([[28,64],[35,66],[27,87],[20,98],[23,106],[17,107],[13,100],[21,81]],'#344c5b');p([[41,65],[49,63],[57,82],[53,96],[60,99],[60,104],[49,104],[47,91],[48,83]],'#344c5b');}
      else{p([[28,64],[35,67],[24,86],[26,98],[19,105],[13,105],[13,99],[18,93],[17,81]],'#344c5b');p([[41,65],[48,62],[55,78],[61,92],[56,99],[49,96],[51,89],[47,82]],'#344c5b');}
      r(17,102,11,4,C.ink);r(50,99,12,4,C.ink);
      p([[27,31],[47,31],[57,37],[61,58],[54,76],[22,76],[16,58],[19,38]],C.ink);
      const coat=damaged?'#eeac76':player?C.orange:['#709b98','#8c82a0','#789463','#b8875a'][variant%4];
      p([[28,33],[46,33],[55,38],[58,57],[53,71],[23,71],[19,57],[22,39]],coat);
      r(22,40,6,19,player?'#e69960':'#a4baa7');r(50,41,6,17,player?'#a75439':'#526b67');
      p([[20,39],[16,42],[11,63],[15,66],[22,53],[26,43]],coat);p([[55,40],[59,43],[66,62],[61,66],[54,53],[50,43]],coat);
      r(10,59,6,6,'#cfac84');r(61,59,6,6,'#cfac84');r(9,64,9,4,C.ink);r(59,64,9,4,C.ink);
      r(8,64,20,3,'#3f6867');r(49,64,20,3,'#3f6867');r(28,65,21,3,C.ink);
      // Large courier backpack with an inset pocket, straps and brass clasp.
      if(player){r(22,38,32,38,'#694f35');r(24,37,29,36,C.ochre);r(24,38,29,5,'#f0d18b');r(25,44,26,3,'#bd863d');r(27,49,22,19,'#bd8c42');r(29,50,18,3,'#e5ba69');r(27,66,22,3,'#eccb88');r(34,53,7,11,'#efcf85');p([[38,53],[34,60],[38,60],[36,64],[42,57],[38,57]],'#80613b');r(23,44,3,27,'#886239');r(51,44,3,27,'#886239');r(28,35,4,7,C.ink);r(45,35,4,7,C.ink);r(35,70,6,3,'#f8ddb0');}
      else{r(26,40,23,29,'#4a6562');r(28,41,19,4,'#a8b2a0');r(30,49,15,15,'#7b8f79');r(35,60,4,3,'#d5c998');}
      r(30,24,15,12,'#b99a73');r(32,25,12,7,'#dec09a');
      p([[29,6],[46,6],[51,11],[53,23],[48,31],[28,31],[23,23],[24,12]],C.ink);
      p([[30,7],[45,7],[50,12],[51,22],[47,28],[29,28],[25,22],[26,13]],player?'#ece1bb':'#bdc8b4');
      r(29,10,4,12,'#fff1cb');r(35,8,5,19,player?'#4a8e84':'#7e9585');r(45,12,4,11,'#b2b39a');r(28,26,20,3,'#8d9e96');r(28,22,3,5,'#d8c59e');r(45,22,3,5,'#d8c59e');
      r(34,97,9,4,'#9f453c');r(35,97,7,2,'#f59c70');r(33,102,11,3,'#5d7671');
      if(assist){r(28,78,3,11,'#94cfb8');r(27,82,5,3,'#dbebbc');r(46,78,3,10,'#94cfb8');r(35,105,5,2,'#c7e2af');}
      ctx.restore();
    });
    if(!player)return raw;
    // Transparent margins keep a 46px foreground drawing within the 30px bike
    // footprint. Nearest-neighbour compression preserves the original pixels.
    return asset(`rider:fit:${phase}:${assist}:${damaged}`,width,height,(_r,_p,ctx)=>ctx.drawImage(raw,7,0,62,height));
  }
  function rearCar(variant=0){
    variant=normalize(variant);
    return asset(`car:${variant}`,72,86,(r,p)=>{
      const body=paintColors[variant];
      r(7,38,10,44,C.ink);r(55,38,10,44,C.ink);r(8,55,3,24,'#526766');r(61,55,3,24,'#526766');
      p([[20,4],[52,4],[59,14],[63,35],[68,44],[68,72],[61,80],[11,80],[4,72],[4,44],[9,34],[14,14]],C.ink);
      p([[21,5],[51,5],[56,15],[59,34],[65,44],[65,70],[60,75],[12,75],[7,70],[7,44],[12,34],[16,15]],body);
      r(21,6,29,3,'#f5e8c4');r(17,13,39,2,'#ded1b3');
      p([[20,16],[52,16],[57,36],[15,36]],'#304f59');p([[22,18],[50,18],[53,26],[19,26]],'#a3c2b8');r(20,29,32,3,'#648f91');r(34,18,3,18,'#638784');r(25,33,18,2,'#203d48');
      r(6,35,10,5,C.ink);r(56,35,10,5,C.ink);r(8,35,6,2,'#7faaa0');r(58,35,6,2,'#7faaa0');
      r(12,41,48,3,'#f2dab0');r(10,48,52,17,body);r(12,49,48,2,'#e8d7b5');r(34,53,6,3,'#729189');r(15,62,42,2,'#8e8b79');
      r(7,57,15,7,'#a14f43');r(50,57,15,7,'#a14f43');r(8,58,13,3,'#edaa76');r(51,58,13,3,'#edaa76');r(8,58,3,2,'#f8d79b');r(61,58,3,2,'#f8d79b');
      r(10,68,52,8,'#506b6a');r(10,68,52,2,'#bec5ac');r(28,70,16,5,'#eee5c7');r(31,71,10,1,'#758a7a');r(11,77,50,3,C.ink);r(12,44,3,12,'#dccda7');r(59,44,3,12,'#837a65');
    });
  }
  function rearBus(){return asset('bus:rear',76,118,(r,p)=>{
    r(6,78,11,37,C.ink);r(59,78,11,37,C.ink);
    p([[10,3],[66,3],[72,9],[72,103],[65,112],[11,112],[4,103],[4,9]],C.ink);
    r(8,10,60,93,C.teal);r(10,4,56,7,'#c9ceaf');r(12,4,52,2,'#eff0ca');r(10,13,56,39,'#2e4e58');r(12,15,52,11,'#91b5aa');r(12,28,52,20,'#537f82');r(35,15,5,34,'#365c61');r(15,45,46,3,'#234551');
    r(11,55,54,4,'#ecd49b');r(15,65,46,30,'#d1cfb2');r(17,66,42,2,'#ede5c4');r(23,72,30,16,'#6a9186');for(let y=74;y<87;y+=3)r(25,y,26,1,'#b5c3aa');
    r(7,62,6,21,'#e2c46e');r(63,62,6,21,'#e2c46e');r(8,66,4,8,'#e8905d');r(64,66,4,8,'#e8905d');r(8,75,4,7,'#d4e0be');r(64,75,4,7,'#d4e0be');
    r(9,98,58,8,'#315b5b');r(10,98,56,2,'#9fb9a0');r(29,100,18,4,'#eadfbb');r(32,101,12,1,'#6d8e7d');r(12,109,52,3,C.ink);r(15,9,46,2,'#587775');
  });}
  function busSide(){return asset('bus:side',160,104,(r,p)=>{
    p([[8,7],[149,7],[156,17],[156,88],[4,88],[4,17]],C.ink);r(8,14,145,69,C.teal);r(9,9,139,5,'#cad0b5');r(10,14,138,2,'#9ebda8');
    r(9,23,140,30,'#274e57');for(let x=12;x<145;x+=22){r(x,25,18,17,'#84aaa2');r(x,44,18,5,'#466f76');r(x+1,26,16,3,'#bdd0b6');}
    r(6,54,148,4,'#e7d29b');r(11,61,136,18,'#568f81');r(57,13,14,75,'#475e5e');for(let x=58;x<71;x+=3)r(x,14,1,70,'#9fab98');
    r(25,63,20,27,'#243f48');r(115,63,20,27,'#243f48');r(28,73,14,17,'#6c8580');r(119,73,12,17,'#6c8580');r(31,77,8,9,'#b2baa2');r(122,77,6,9,'#b2baa2');r(151,59,4,11,'#edbf76');r(5,63,3,8,'#c57350');
  });}
  function busRoof(){return asset('bus:roof',76,164,(r,p)=>{
    r(4,1,68,162,C.ink);r(6,3,64,158,'#cecfb4');r(7,4,62,3,'#eee7c6');r(8,5,3,151,C.teal);r(65,5,3,151,C.teal);
    for(const y of [16,101]){r(22,y,32,28,'#9fb1a1');r(24,y+2,28,3,'#e0e0be');r(25,y+10,26,15,'#6c9084');for(let dy=12;dy<25;dy+=4)r(26,y+dy,24,1,'#bdc9ae');}
    r(5,77,66,14,'#4d6260');for(let y=78;y<91;y+=3)r(7,y,62,1,'#a4aea0');r(18,54,40,10,'#9cb39f');r(18,145,40,10,'#9cb39f');
  });}
  function stone(r,variant){
    const colors=[['#e5d5b6','#d4c4a7','#f4e5c6'],['#ddd1b7','#cfc3ab','#efe4cb'],['#e7ceb0','#d7bfa0','#f6dfbf']][variant];
    r(0,0,120,160,colors[0]);
    // Quiet limestone courses continue to the image edges without a gutter.
    for(let y=9;y<160;y+=10){r(0,y,120,1,colors[1]);for(let x=(y%20===9?10:0);x<120;x+=20)r(x,y-9,1,9,colors[1]);}
    for(const y of [0,40,80,120]){r(0,y,120,2,colors[2]);r(0,y+2,120,1,colors[1]);r(0,y+3,120,1,colors[2]);}
    return colors;
  }
  /** Flat, full-bleed wall: top/eaves y0, ground y160; four40px storeys. */
  function wall(kind='haussmann',variant=0){
    kind=['cafe','shop'].includes(kind)?kind:'haussmann';variant=normalize(variant,3);
    return asset(`wall:${kind}:${variant}`,120,160,(r,p)=>{
      const stoneColors=stone(r,variant),frame=stoneColors[2];
      for(let floor=0;floor<3;floor++){
        const y=floor*40;
        for(let bay=0;bay<6;bay++){
          const x=bay*20+4,curtain=(bay+floor+variant)%4===0;
          r(x,y+5,13,30,'#b6a88f');r(x+1,y+6,11,28,'#405e66');
          r(x+2,y+7,4,25,curtain?'#c5c4aa':'#91b0aa');r(x+7,y+7,4,25,'#688f91');
          r(x+6,y+6,1,28,frame);r(x+1,y+17,11,1,frame);r(x,y+4,13,1,frame);r(x-1,y+34,15,2,frame);
          // Individual iron guards use straight pixel rows and slender posts.
          if(floor!==1){r(x-2,y+28,17,1,'#364e50');r(x-2,y+35,17,1,'#364e50');for(let rail=x-2;rail<=x+14;rail+=4)r(rail,y+29,1,6,'#4a6260');r(x+2,y+30,1,3,'#789080');r(x+10,y+30,1,3,'#789080');}
        }
        // The bel étage's continuous balcony stays on the same floor band.
        if(floor===1){r(0,y+28,120,1,'#364e50');r(0,y+35,120,1,'#364e50');for(let x=1;x<120;x+=4)r(x,y+29,1,6,'#4a6260');r(0,y+36,120,1,'#a6b299');}
        r(0,y+37,120,1,stoneColors[1]);r(0,y+38,120,2,frame);
      }
      if(kind==='cafe'||kind==='shop'){
        const trim=kind==='cafe'?'#356653':'#3d706b';
        r(0,124,120,36,trim);r(2,125,116,8,'#31594f');r(18,127,84,1,'#dac89b');r(35,130,50,1,'#a8b792');
        r(6,137,42,19,'#2d5055');r(9,139,36,13,'#91b0a4');r(11,140,32,2,'#c0ccb0');r(26,139,2,16,'#bbc7a9');
        r(72,137,42,19,'#2d5055');r(75,139,36,13,'#91b0a4');r(77,140,32,2,'#c0ccb0');r(92,139,2,16,'#bbc7a9');
        r(53,134,14,26,'#274e53');r(55,136,10,21,'#6f9c97');r(59,136,1,21,'#c5caab');r(64,146,1,3,'#dbb566');
        if(kind==='cafe'){r(0,133,120,8,'#be7855');for(let x=0;x<120;x+=10)r(x,133,5,7,'#f1ddba');r(0,140,120,1,'#8c5d45');}
        else{r(10,152,33,3,'#d5b374');r(77,152,31,3,'#d5b374');r(3,134,2,25,'#a4baa1');r(115,134,2,25,'#a4baa1');}
        r(0,159,120,1,'#a9b59a');
      }else{
        r(49,128,22,32,'#b7a78d');p([[52,136],[55,129],[65,129],[68,136],[68,160],[52,160]],'#365b5f');
        r(55,137,10,22,'#658f8d');r(59,136,1,23,'#c1c7a8');r(64,148,1,3,'#e0b975');
        for(const x of [7,86]){r(x,128,27,27,'#afaa92');r(x+2,130,23,22,'#476970');r(x+4,132,19,15,'#91aca2');r(x+12,130,1,23,'#d3d2b3');r(x+2,149,23,3,'#bac5a5');r(x-1,155,29,1,frame);}
      }
    });
  }
  /** Opaque zinc material, mapped onto a separate pitched roof plane. */
  function roof(variant=0){
    variant=normalize(variant,3);
    return asset(`roof:${variant}`,120,64,(r)=>{
      const base=['#708891','#788c92','#6e8390'][variant];
      r(0,0,120,64,base);
      for(let x=0;x<120;x+=12){r(x,0,1,64,'#9aacad');r(x+1,0,1,64,'#59747f');r(x+3,0,7,64,(x/12+variant)%3===0?'#7c939a':base);}
      for(let y=15;y<64;y+=16){r(0,y,120,1,'#5d7882');r(0,y+1,120,1,'#8fa4a6');for(let x=5;x<120;x+=12)r(x,y-1,1,1,'#bac1b4');}
      // Flush glazed skylights are material detail, never a baked roof outline.
      for(const x of [27,79]){r(x,22,14,22,'#b1b8aa');r(x+1,23,12,20,'#3b6170');r(x+2,24,10,7,'#a1bcb7');r(x+2,32,10,9,'#648a93');r(x+6,23,1,20,'#a9b6a8');r(x+1,31,12,1,'#a9b6a8');}
    });
  }
  function endWall(variant=0){
    variant=normalize(variant,3);
    return asset(`end-wall:${variant}`,120,160,(r)=>{
      const colors=stone(r,variant);
      for(let floor=0;floor<3;floor++)for(const x of [28,80]){const y=floor*40+9;r(x,y,12,23,colors[1]);r(x+1,y+1,10,21,colors[0]);r(x-1,y+23,14,1,colors[2]);}
      r(0,158,120,2,colors[1]);
    });
  }
  const facade=wall;
  function tree(){return asset('tree',72,144,(r,p)=>{
    r(30,72,11,72,'#5e6750');r(32,78,4,62,'#9d9570');p([[33,91],[13,67],[17,63],[37,80],[54,57],[59,62],[39,95]],'#6b7052');
    p([[20,10],[50,10],[50,15],[61,15],[61,26],[67,26],[67,57],[61,57],[61,72],[48,72],[48,78],[17,78],[17,70],[7,70],[7,58],[2,58],[2,30],[9,30],[9,16],[20,16]],'#345e50');
    p([[20,7],[46,7],[46,14],[58,14],[58,26],[64,26],[64,48],[58,48],[58,63],[45,63],[45,72],[18,72],[18,63],[9,63],[9,48],[5,48],[5,29],[13,29],[13,16],[20,16]],'#628965');
    r(18,15,30,25,'#82a071');r(12,31,26,21,'#81a075');r(20,10,16,10,'#a3b487');r(43,46,13,17,'#497555');r(15,61,18,8,'#527d58');r(31,51,16,9,'#719368');r(27,140,18,4,'#8d987d');
  });}
  function metro(){return asset('metro',60,110,(r,p)=>{
    r(5,101,50,8,'#7c8970');r(9,95,42,5,'#abb196');r(13,87,34,7,'#7c8873');r(17,80,26,6,'#abb196');r(21,74,18,5,'#7c8873');
    p([[8,108],[8,60],[13,57],[16,72],[16,108]],'#315f4c');p([[44,108],[44,72],[47,57],[52,60],[52,108]],'#315f4c');
    r(12,76,34,3,'#416e54');r(12,89,34,3,'#416e54');for(let x=13;x<47;x+=6)r(x,75,2,26,'#416e54');
    r(8,25,3,55,'#315f4c');r(48,25,3,55,'#315f4c');p([[9,26],[16,17],[44,17],[50,26],[50,32],[9,32]],'#315f4c');r(15,19,30,9,'#cfcb9c');
    // Small enamel METRO lettering uses pixels rather than a platform font.
    for(const x of [17,23,29,35,41]){r(x,22,3,1,'#42694f');r(x,24,3,1,'#42694f');r(x,22,1,4,'#42694f');}r(19,22,1,4,'#42694f');r(43,22,1,4,'#42694f');
    r(7,8,5,17,'#4c6a4a');r(47,8,5,17,'#4c6a4a');p([[6,5],[12,5],[15,10],[15,16],[12,20],[6,20],[3,16],[3,10]],'#b15f43');p([[46,5],[52,5],[55,10],[55,16],[52,20],[46,20],[43,16],[43,10]],'#b15f43');r(6,8,5,4,'#e6a465');r(46,8,5,4,'#e6a465');
  });}
  function skyline(district=0){
    const d=normalize(district,5);
    return asset(`skyline:${d}`,820,150,(r,p)=>{
      const rear='#a6b2a1',roof='#849e9a',front='#b3bda8';
      for(let x=0;x<820;x+=47){const h=22+(x*17%37);r(x,150-h,45,h,rear);p([[x-2,150-h],[x+8,143-h],[x+36,143-h],[x+47,150-h]],roof);r(x+11,146-h,3,7,'#97aaa1');for(let wx=x+7;wx<x+39;wx+=11)r(wx,155-h,4,9,'#879f99');}
      for(let x=0;x<820;x+=94){const y=118+(x%3)*4;r(x,y,78,32,front);p([[x-3,y],[x+8,y-9],[x+69,y-9],[x+82,y]],'#8fa49c');r(x+15,y-15,5,11,'#a6b2a1');r(x+13,y-16,9,3,'#c0c5ad');for(let wx=x+10;wx<x+70;wx+=15){r(wx,y+8,5,9,'#849b91');r(wx,y+22,5,9,'#849b91');}}
      if(d===0){r(404,40,12,94,'#668c80');r(407,40,4,89,'#a3b6a0');r(399,36,22,7,'#7e9b89');r(397,125,26,7,'#96ab94');r(390,132,39,6,'#b7baa0');r(408,20,5,17,'#718d79');p([[410,7],[403,21],[405,29],[416,28],[418,20]],'#879e87');r(416,11,9,3,'#a3ae8e');r(418,10,4,8,'#a3ae8e');}
      else if(d===4){
        r(353,95,114,43,'#ddd7b8');r(367,75,87,30,'#e3dbbb');r(388,43,44,47,'#e8dfbd');p([[388,45],[391,33],[397,25],[406,20],[414,20],[424,27],[430,35],[432,45]],'#e8dfbd');r(408,8,5,14,'#aaae94');r(404,12,12,3,'#aaae94');
        for(const x of [365,442]){r(x,57,14,36,'#d8d4b7');p([[x-1,58],[x+1,49],[x+5,43],[x+10,43],[x+14,50],[x+15,58]],'#ddd6b8');r(x+6,33,2,12,'#a7aa90');}
        for(const x of [369,391,413,435]){r(x,106,10,22,'#97a799');r(x+2,103,6,4,'#97a799');}r(393,131,34,10,'#b9bd9f');r(403,126,13,15,'#839d91');
      }else{
        const eiffelX=d===3?466:590;
        p([[eiffelX+27,26],[eiffelX+33,26],[eiffelX+37,70],[eiffelX+50,112],[eiffelX+65,141],[eiffelX+53,141],[eiffelX+39,111],[eiffelX+30,91],[eiffelX+21,111],[eiffelX+8,141],[eiffelX-5,141],[eiffelX+11,112],[eiffelX+24,70]],'#7b9a91');
        r(eiffelX+20,72,21,4,'#75968c');r(eiffelX+11,106,39,5,'#75968c');r(eiffelX+16,116,28,4,'#bcc5ad');r(eiffelX+28,17,3,11,'#79958c');r(eiffelX+25,46,10,2,'#9aafa0');r(eiffelX+22,89,17,3,'#a4b6a4');
        if(d===1){r(254,69,25,58,'#a8b5a2');p([[251,70],[264,40],[282,70]],'#869e93');r(264,30,3,14,'#7d9c8f');r(262,87,9,23,'#849e91');}
      }
      if(d===2||d===3){for(let x=0;x<820;x+=38){r(x+14,128,4,22,'#76957c');p([[x+5,123],[x+11,109],[x+24,107],[x+32,122],[x+27,136],[x+8,135]],'#96ad8e');}}
    });
  }
  function rearCourier({pedal=0,assist=false,damaged=false}={}){return rider(true,Math.abs(Number(pedal)||0)%1>=.5?1:0,!!assist,!!damaged);}
  return {rearCourier,rearRider:rearCourier,rearCar,rearBus,busSide,busRoof,facade,wall,roof,endWall,tree,metro,skyline,
    rearCyclist(variant=0){return rider(false,0,false,false,normalize(variant,4));},
    rearActor(actor={}){const kind=actor.kind??actor.type;return kind==='bus'?rearBus():kind==='cyclist'?rider(false,0,false,false,normalize(actor.variant??actor.id,4)):rearCar(actor.variant??actor.id);},
    clear(){cache.clear();},
  };
}
export const createParisPerspectiveSprites = createParisPerspective;
