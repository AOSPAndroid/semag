const WIDTH = 960;
const HEIGHT = 640;
const PALETTES = [
  { light: '#e5ffc0', main: '#b6e88a', mid: '#789d5b', dark: '#3f6248', cloak: '#587947', ink: '#20372f' },
  { light: '#ece0ff', main: '#c1a9ed', mid: '#8f76b3', dark: '#574968', cloak: '#7a6395', ink: '#302f44' },
];
const DEFAULT_OBSTACLES = [
  { id: 'p0', type: 'pillar', x: 285, y: 186, w: 54, h: 76 },
  { id: 'p1', type: 'pillar', x: 621, y: 186, w: 54, h: 76 },
  { id: 'p2', type: 'pillar', x: 285, y: 378, w: 54, h: 76 },
  { id: 'p3', type: 'pillar', x: 621, y: 378, w: 54, h: 76 },
];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mix = (a, b, t) => a + (b - a) * t;
const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
function rngFrom(seed) {
  let n = seed >>> 0;
  return () => { n = (n * 1664525 + 1013904223) >>> 0; return n / 4294967296; };
}
function poly(ctx, points, fill, stroke, width = 1) {
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) i ? ctx.lineTo(...points[i]) : ctx.moveTo(...points[i]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function path(ctx, points, color, width = 1) {
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) i ? ctx.lineTo(...points[i]) : ctx.moveTo(...points[i]);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
function ellipse(ctx, x, y, rx, ry, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}
function circle(ctx, x, y, radius, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
}

/** Authored, asset-free top-down garden, tide crypt and cinder sanctum art. Coordinates are actor centers. */
export class TopdownRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.obstacleCache = new Map();
    this.currentBiome = 'garden';
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.background = document.createElement('canvas');
    this.background.width = WIDTH * 2;
    this.background.height = HEIGHT * 2;
    const bg = this.background.getContext('2d');
    bg.scale(2, 2);
    this.paintGarden(bg);
    this.backgrounds = { garden: this.background };
    for (const biome of ['crypt','ember']) {
      const floor=document.createElement('canvas'); floor.width=WIDTH*2; floor.height=HEIGHT*2;
      const context=floor.getContext('2d'); context.scale(2,2); this.paintDepths(context,biome);
      this.backgrounds[biome]=floor;
    }
    this.torches = [[111, 37], [480, 37], [849, 37], [24, 318], [936, 318], [111, 596], [480, 596], [849, 596]];
    this.resize = this.resize.bind(this);
    this.observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(this.resize) : null;
    this.observer?.observe(canvas);
    this.resetEffects();
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(Math.max(1, rect.width) * dpr);
    const height = Math.round(Math.max(1, rect.height) * dpr);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width; this.canvas.height = height;
    }
  }

  resetEffects() {
    this.particles = [];
    this.rings = [];
    this.ghosts = [];
    this.lastGhost = new Map();
    this.seenEvents = new Set();
    this.lastConsumedEventId=null;
    this.depthObjects=[];
    this.depthPool=[];
    this.lastTick = -1;
    this.lastTime = 0;
    this.shake = 0;
  }

  destroy() {
    this.observer?.disconnect();
    this.resetEffects();
  }

  paintDepths(ctx, biome) {
    const crypt=biome==='crypt',rng=rngFrom(crypt?1348:9359);
    const p=crypt?{ink:'#1d3542',seam:'#2d4651',tiles:['#435b65','#4a636b','#3e5662','#405964'],edge:'#89aeb3',gold:'#c1c8a1',stone:'#557580',shade:'#2b4655',light:'#a7d7d2'}:{ink:'#322a2c',seam:'#423b36',tiles:['#65554a','#6d5b4c','#615046','#695547'],edge:'#b79468',gold:'#d4b17b',stone:'#84715a',shade:'#51473d',light:'#efbe7d'};
    ctx.fillStyle=p.ink;ctx.fillRect(0,0,WIDTH,HEIGHT);ctx.fillStyle=p.seam;ctx.fillRect(36,52,888,536);
    for(let row=0,y=52;y<588;y+=36,row++)for(let x=36-(row%2)*24;x<924;x+=48){
      const left=Math.max(36,x),right=Math.min(924,x+46);if(right<left)continue;
      ctx.fillStyle=p.tiles[Math.floor(rng()*4)];ctx.fillRect(left,y+1,right-left,34);ctx.fillStyle=p.edge+'30';ctx.fillRect(left+2,y+2,right-left-4,2);ctx.fillStyle=p.ink+'66';ctx.fillRect(left+2,y+32,right-left-4,2);
      if(rng()>.68)path(ctx,[[left+9,y+3],[left+14,y+12],[left+10,y+20],[left+17,y+30]],p.ink+'77',1);
      if(rng()>.52){ctx.fillStyle=p.gold+'18';ctx.fillRect(left+5+rng()*14,y+8+rng()*13,7+rng()*13,2);}
      if(crypt&&rng()>.94)path(ctx,[[left+4,y+28],[left+17,y+20],[left+29,y+22]],'#a1c8cb38',1);
      if(!crypt&&rng()>.93)path(ctx,[[left+18,y+11],[left+23,y+22],[left+18,y+32]],'#bd8e5930',2);
    }
    // Shallow inlaid channels frame the walkable floor, without inventing obstacles.
    ctx.strokeStyle=p.gold+'30';ctx.lineWidth=2;ctx.strokeRect(65,81,830,478);ctx.strokeStyle=p.ink+'55';ctx.strokeRect(70,86,820,468);
    ctx.save();ctx.translate(480,320);ctx.globalAlpha=.25;
    circle(ctx,0,0,128,p.ink+'40');ctx.strokeStyle=p.edge;ctx.lineWidth=2;
    for(const radius of[96,108,132]){ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.stroke();}
    for(let i=0;i<12;i++){ctx.save();ctx.rotate(i*Math.PI/6);poly(ctx,[[-4,-127],[-4,-115],[0,-109],[4,-115],[4,-127]],p.gold);path(ctx,[[-2,-127],[-2,-119],[2,-119]],p.ink,1);ctx.restore();}
    if(crypt){for(const side of[-1,1])poly(ctx,[[side*4,-50],[side*36,-34],[side*48,0],[side*31,30],[side*4,47],[side*15,13],[side*9,-11]],p.edge,p.ink);poly(ctx,[[0,-23],[17,0],[0,23],[-17,0]],p.gold);}
    else{for(let i=0;i<8;i++){ctx.save();ctx.rotate(i*Math.PI/4);poly(ctx,[[-10,-65],[-8,-86],[8,-86],[10,-65]],p.gold);ctx.restore();}poly(ctx,[[0,-43],[33,-14],[21,29],[0,43],[-25,22],[-33,-14]],p.edge);poly(ctx,[[0,-28],[17,-4],[10,18],[0,25],[-16,12],[-18,-4]],p.ink);}
    ctx.restore();
    for(const[x,y,w,h]of[[0,0,960,52],[0,588,960,52],[0,52,36,536],[924,52,36,536]]){
      ctx.fillStyle=p.ink;ctx.fillRect(x,y,w,h);const horizontal=w>h;
      for(let n=0;n<(horizontal?w:h);n+=horizontal?60:52){const bx=x+(horizontal?n:2),by=y+(horizontal?2:n);const bw=horizontal?57:w-4,bh=horizontal?h-5:49;
        ctx.fillStyle=p.stone;ctx.fillRect(bx+1,by+1,bw-2,bh-2);ctx.fillStyle=p.edge+'66';ctx.fillRect(bx+2,by+2,bw-4,3);ctx.fillRect(bx+2,by+5,3,bh-7);ctx.fillStyle=p.shade;ctx.fillRect(bx+4,by+bh-8,bw-6,6);
        if(crypt){path(ctx,[[bx+9,by+9],[bx+13,by+18],[bx+10,by+25]],p.ink+'88',1);ctx.fillStyle='#36586688';ctx.fillRect(bx+8,by+bh-12,10,5);}
        else{for(const[rx,ry]of[[6,8],[bw-8,8],[6,bh-12],[bw-8,bh-12]]){circle(ctx,bx+rx,by+ry,2,'#463b31');circle(ctx,bx+rx-.5,by+ry-.5,1,'#d4b182');}}
      }
    }
    // Wall alcoves are decorative architecture, kept outside the collision bounds.
    for(const x of[228,732]){
      ctx.fillStyle=p.ink;ctx.fillRect(x-29,4,58,44);poly(ctx,[[x-23,43],[x-23,17],[x-12,8],[x+12,8],[x+23,17],[x+23,43]],p.shade,p.edge,2);
      if(crypt){poly(ctx,[[x,12],[x+8,24],[x,39],[x-8,24]],'#8fb8b7');path(ctx,[[x,17],[x,33]],'#d8e8d0',1);}
      else{for(let j=-2;j<=2;j++){ctx.fillStyle=j%2?'#8f6645':'#ad7d4d';ctx.fillRect(x+j*7-2,19,4,20);}path(ctx,[[x-19,35],[x+19,35]],p.gold,2);}
    }
    for(let i=0;i<32;i++){
      const x=i%2?48+rng()*50:862+rng()*49,y=94+rng()*429;
      if(crypt){if(i%4===0)this.crystal(ctx,x,y,'#81abb5');else{ctx.fillStyle='#bac7b02a';ctx.fillRect(x,y,5+rng()*8,2);}}
      else{ctx.fillStyle=i%3?'#9d84524a':'#2a292c88';ctx.fillRect(x,y,4+rng()*7,3+rng()*3);if(i%6===0){ctx.fillStyle='#d2a1674a';ctx.fillRect(x+1,y,4,1);}}
    }
    for(const[x,y]of[[111,37],[480,37],[849,37],[24,318],[936,318],[111,596],[480,596],[849,596]]){const glow=ctx.createRadialGradient(x,y,4,x,y,90);glow.addColorStop(0,p.light+'22');glow.addColorStop(1,p.light+'00');ctx.fillStyle=glow;ctx.fillRect(x-90,y-90,180,180);}
    const shade=ctx.createRadialGradient(480,320,160,480,320,575);shade.addColorStop(0,p.ink+'00');shade.addColorStop(.62,p.ink+'00');shade.addColorStop(1,p.ink+'a0');ctx.fillStyle=shade;ctx.fillRect(0,0,960,640);
  }

  paintGarden(ctx) {
    const rng = rngFrom(871009);
    ctx.fillStyle = '#12231e'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const ground = ctx.createLinearGradient(0, 52, 960, 588);
    ground.addColorStop(0, '#3b5041'); ground.addColorStop(0.5, '#536047'); ground.addColorStop(1, '#354b3d');
    ctx.fillStyle = ground; ctx.fillRect(36, 52, 888, 536);

    // Each tile carries its own worn edges, cracks, and moss. The paths stay readable.
    for (let row = 0; row < 12; row++) {
      for (let col = 0; col < 20; col++) {
        const x = 36 + col * 48, y = 52 + row * 48;
        if (x > 924 || y > 588) continue;
        const n = rng();
        const color = ['#626953', '#5d654f', '#59644e', '#646a54', '#56624e'][Math.floor(n * 5)];
        ctx.fillStyle = color; ctx.fillRect(x + 1, y + 1, 46, 46);
        ctx.fillStyle = '#95a08029'; ctx.fillRect(x + 2, y + 1, 44, 2); ctx.fillRect(x + 1, y + 2, 2, 43);
        ctx.fillStyle = '#263c3348'; ctx.fillRect(x + 2, y + 45, 44, 2); ctx.fillRect(x + 45, y + 3, 2, 42);
        const cracks = rng();
        if (cracks > 0.75) path(ctx, [[x + 15, y + 2], [x + 18, y + 14], [x + 13, y + 20], [x + 16, y + 26]], '#30453866', 1);
        if (cracks > 0.85) path(ctx, [[x + 47, y + 23], [x + 38, y + 28], [x + 34, y + 38]], '#33423788', 1);
        ctx.fillStyle = '#abb28a17'; ctx.fillRect(x + 7 + rng() * 14, y + 6 + rng() * 14, 3 + rng() * 14, 2);
        ctx.fillStyle = '#1e392928'; ctx.fillRect(x + 4 + rng() * 30, y + 32 + rng() * 9, 6 + rng() * 7, 2);
        if (rng() > 0.57) {
          ctx.fillStyle = '#536d4052';
          ctx.fillRect(x + 1, y + 37, 13 + rng() * 20, 9);
          ctx.fillRect(x + 3, y + 33, 10, 6);
        }
      }
    }
    // Softly overgrown corners of the enclosed ruin.
    for (let i = 0; i < 315; i++) {
      const side = i % 4;
      let x, y;
      if (side === 0) { x = 38 + rng() * 95; y = 58 + rng() * 519; }
      else if (side === 1) { x = 830 + rng() * 92; y = 58 + rng() * 519; }
      else if (side === 2) { x = 60 + rng() * 839; y = 58 + rng() * 38; }
      else { x = 60 + rng() * 839; y = 548 + rng() * 36; }
      const colors = ['#6c8051', '#72894f', '#425e3d', '#8b995a', '#566c43'];
      this.grass(ctx, x, y, colors[Math.floor(rng() * colors.length)], rng() * 5 + 3);
      if (rng() > 0.90) this.flower(ctx, x, y - 4, rng() > 0.5 ? '#cdbb91' : '#b8b3d1');
    }
    for (let i = 0; i < 48; i++) {
      const x = 139 + rng() * 680, y = 99 + rng() * 430;
      if (Math.abs(x - 480) < 92 && Math.abs(y - 320) < 92) continue;
      if (rng() > 0.46) this.grass(ctx, x, y, '#748756', 3 + rng() * 3);
      else { ctx.fillStyle = '#82907344'; ctx.fillRect(x, y, 2 + rng() * 3, 2); }
    }

    // The original compass seal is a meeting point and a readable arena center.
    ctx.save(); ctx.translate(480, 320);
    ellipse(ctx, 0, 3, 75, 73, '#243b3433');
    circle(ctx, 0, 0, 71, '#52644c');
    circle(ctx, 0, 0, 65, '#6b735b');
    ctx.strokeStyle = '#b5b99b66'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 65, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#354b3e88'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 54, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      ctx.save(); ctx.rotate(i * Math.PI / 4);
      path(ctx, [[0, -59], [0, -52]], '#b9bb9580', 2);
      poly(ctx, [[0, -49], [11, -15], [0, -20], [-11, -15]], '#a0a7846b', '#465b4599');
      ctx.restore();
    }
    poly(ctx, [[0, -28], [27, 0], [0, 29], [-27, 0]], '#455d4c', '#b7c2a155', 2);
    poly(ctx, [[0, -17], [15, 0], [0, 17], [-15, 0]], '#99b68080', '#c3d6a978');
    path(ctx, [[-65, 18], [-43, 18], [-35, 26]], '#3b513e66', 1);
    path(ctx, [[28, -46], [28, -26], [20, -20]], '#3b513e77', 1);
    ctx.restore();

    // A stout wall surrounds the walkable bounds. Its inner edge matches collision.
    this.paintWall(ctx, 0, 0, WIDTH, 52, 'horizontal', rng);
    this.paintWall(ctx, 0, 588, WIDTH, 52, 'horizontal', rng);
    this.paintWall(ctx, 0, 52, 36, 536, 'vertical', rng);
    this.paintWall(ctx, 924, 52, 36, 536, 'vertical', rng);
    ctx.fillStyle = '#122a2655'; ctx.fillRect(36, 52, 888, 9); ctx.fillRect(36, 52, 8, 536); ctx.fillRect(916, 52, 8, 536);
    ctx.fillStyle = '#afbc9033'; ctx.fillRect(38, 586, 884, 2);

    // Broken arch keystones, creeping vines and tiny crystal clusters.
    for (const x of [176, 766]) {
      ctx.fillStyle = '#243c31'; ctx.fillRect(x, 0, 24, 52);
      ctx.fillStyle = '#657257'; ctx.fillRect(x + 2, 0, 20, 47);
      ctx.fillStyle = '#acb29433'; ctx.fillRect(x + 2, 0, 3, 43);
      poly(ctx, [[x + 4, 47], [x + 19, 47], [x + 18, 53], [x + 7, 53]], '#3c4c3d');
    }
    for (const [x, y, dir] of [[232, 17, 1], [732, 5, 1], [14, 166, 1], [932, 453, -1], [291, 613, -1], [651, 632, -1]]) {
      const points = [];
      for (let i = 0; i < 6; i++) points.push([x + Math.sin(i * 1.4) * 5, y + i * 8 * dir]);
      path(ctx, points, '#527548', 2);
      for (let i = 1; i < 6; i++) {
        const px = points[i][0], py = points[i][1];
        poly(ctx, [[px, py], [px - 8, py - 5], [px - 9, py], [px - 3, py + 3]], '#63884b');
        poly(ctx, [[px, py + 2], [px + 7, py - 3], [px + 9, py + 2], [px + 3, py + 6]], '#799859');
      }
    }
    this.crystal(ctx, 67, 112, '#8bac9b'); this.crystal(ctx, 886, 533, '#a9a4c5');
    this.crystal(ctx, 69, 526, '#acae8b'); this.crystal(ctx, 889, 116, '#8eb29e');

    // Warm torch illumination belongs to the environment, never the hit effects.
    for (const [x, y] of [[111, 37], [480, 37], [849, 37], [24, 318], [936, 318], [111, 596], [480, 596], [849, 596]]) {
      const light = ctx.createRadialGradient(x, y, 5, x, y, 102);
      light.addColorStop(0, '#ebb66d26'); light.addColorStop(0.5, '#d6a8580b'); light.addColorStop(1, '#c5a36400');
      ctx.fillStyle = light; ctx.fillRect(x - 104, y - 104, 208, 208);
    }
    this.treeCanopy(ctx, 8, 4, rng); this.treeCanopy(ctx, 954, 0, rng);
    this.treeCanopy(ctx, -10, 643, rng); this.treeCanopy(ctx, 971, 650, rng);
    for(const [x,y,flip]of[[171,38,1],[781,602,-1]]){
      ctx.save();ctx.translate(x,y);ctx.scale(1,flip);poly(ctx,[[-21,-26],[21,-26],[26,6],[-26,6]],'#354f3d','#8ca176',1.5);
      poly(ctx,[[0,-21],[11,-8],[0,2],[-11,-8]],'#80996a','#b3bc8e',1);path(ctx,[[0,-18],[0,-1]],'#c2caa0',1);
      for(const side of[-1,1]){path(ctx,[[side*10,0],[side*17,-10],[side*12,-19]],'#9aa977',1.5);poly(ctx,[[side*15,-10],[side*23,-15],[side*21,-6]],'#879b69');}ctx.restore();
    }
    const shade = ctx.createRadialGradient(480, 320, 160, 480, 320, 560);
    shade.addColorStop(0, '#11261e00'); shade.addColorStop(0.7, '#11261e00'); shade.addColorStop(1, '#0b201d72');
    ctx.fillStyle = shade; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  paintWall(ctx, x, y, w, h, direction, rng) {
    ctx.fillStyle = '#273d32'; ctx.fillRect(x, y, w, h);
    if (direction === 'horizontal') {
      for (let bx = x; bx < x + w; bx += 64) {
        ctx.fillStyle = rng() > 0.5 ? '#64715a' : '#5b6b53'; ctx.fillRect(bx + 2, y + 2, 61, 45);
        ctx.fillStyle = '#98a58144'; ctx.fillRect(bx + 2, y + 2, 61, 3); ctx.fillRect(bx + 2, y + 5, 2, 37);
        ctx.fillStyle = '#344e3999'; ctx.fillRect(bx + 5, y + 43, 58, 5);
        if (rng() > 0.5) path(ctx, [[bx + 45, y + 4], [bx + 41, y + 13], [bx + 46, y + 20]], '#374b3c88', 1);
        ctx.fillStyle = '#7a8c5777'; ctx.fillRect(bx + 5, y + 7, 19, 5); ctx.fillRect(bx + 4, y + 10, 8, 7);
      }
    } else {
      for (let by = y; by < y + h; by += 54) {
        ctx.fillStyle = rng() > 0.5 ? '#55694f' : '#5d7057'; ctx.fillRect(x + 2, by + 1, 31, 50);
        ctx.fillStyle = '#95a78344'; ctx.fillRect(x + 2, by + 2, 3, 48); ctx.fillRect(x + 2, by + 2, 31, 2);
        ctx.fillStyle = '#314c3788'; ctx.fillRect(x + 27, by + 4, 6, 45);
      }
    }
  }

  grass(ctx, x, y, color, size = 5) {
    path(ctx, [[x - size, y], [x - size * 0.5, y - size], [x, y], [x + 1, y - size - 2], [x + 2, y], [x + size, y - size * 0.6]], color, 1.5);
  }

  flower(ctx, x, y, color) {
    ctx.fillStyle = color; ctx.fillRect(x - 2, y, 5, 2); ctx.fillRect(x, y - 2, 2, 5);
    ctx.fillStyle = '#eee2ad'; ctx.fillRect(x, y, 1, 1);
  }

  crystal(ctx, x, y, color) {
    ellipse(ctx, x, y + 8, 13, 5, '#243b3255');
    poly(ctx, [[x - 5, y + 9], [x - 9, y - 2], [x - 5, y - 11], [x + 1, y - 2], [x, y + 10]], color, '#3d5a4f');
    poly(ctx, [[x + 1, y + 9], [x + 2, y - 14], [x + 8, y - 20], [x + 11, y - 4], [x + 7, y + 9]], color, '#3d5a4f');
    path(ctx, [[x + 8, y - 17], [x + 7, y + 5]], '#d7e3d4aa', 1);
    poly(ctx, [[x + 7, y + 9], [x + 13, y - 3], [x + 16, y - 4], [x + 15, y + 8]], '#6c8e7a');
  }

  treeCanopy(ctx, x, y, rng) {
    for (let i = 0; i < 26; i++) {
      const px = x + (rng() - 0.5) * 125, py = y + (rng() - 0.5) * 96;
      const size = 13 + rng() * 24;
      const color = ['#18372b', '#224232', '#294a35', '#35573c'][i % 4];
      poly(ctx, [[px - size, py - size * 0.4], [px - size * 0.5, py - size], [px + size * 0.35, py - size], [px + size, py - size * 0.4], [px + size, py + size * 0.3], [px + size * 0.4, py + size * 0.7], [px - size * 0.5, py + size * 0.7], [px - size, py + size * 0.3]], color);
      path(ctx, [[px - size * 0.5, py - size + 2], [px + size * 0.3, py - size + 2], [px + size * 0.6, py - size * 0.5]], '#78935715', 2);
    }
  }

  pillar(ctx, obstacle) {
    const {x,y,w,h}=obstacle,biome=this.currentBiome,key=`${biome}:${w}:${h}`;
    if(!this.obstacleCache.has(key)){
      const image=document.createElement('canvas');image.width=w+28;image.height=h+38;const g=image.getContext('2d');g.translate(14,17);this.paintPillar(g,{w,h},biome);this.obstacleCache.set(key,image);
      if(this.obstacleCache.size>40)this.obstacleCache.delete(this.obstacleCache.keys().next().value);
    }
    ctx.drawImage(this.obstacleCache.get(key),x-14,y-17);
  }
  paintPillar(ctx,{w,h},biome) {
    const p=biome==='crypt'?{ink:'#233e4a',stone:'#527683',edge:'#92b4b5',light:'#c4d1ba',dark:'#36515f'}:biome==='ember'?{ink:'#41362e',stone:'#806d53',edge:'#bc9866',light:'#e0c38a',dark:'#5a4b3a'}:{ink:'#2c463a',stone:'#63765c',edge:'#93a97d',light:'#c4c6a1',dark:'#3c5645'};
    ellipse(ctx,w/2+4,h+4,w*.62,8,'#122c2d66');ctx.fillStyle=p.ink;ctx.fillRect(0,0,w,h);ctx.fillStyle=p.stone;ctx.fillRect(3,7,w-6,h-12);ctx.fillStyle=p.edge+'88';ctx.fillRect(3,9,5,h-15);ctx.fillStyle=p.dark;ctx.fillRect(w-12,9,9,h-13);
    for(let by=19;by<h-14;by+=20){path(ctx,[[5,by],[w-6,by]],p.ink,1);path(ctx,[[7,by+1],[w-8,by+1]],p.light+'33',1);path(ctx,[[w*.5,by-18],[w*.5,by-2]],p.ink+'88',1);}
    ctx.fillStyle=p.dark;ctx.fillRect(0,h-12,w,12);ctx.fillStyle=p.edge;ctx.fillRect(0,h-12,w,3);ctx.fillStyle=p.stone;ctx.fillRect(3,h-8,w-6,7);
    poly(ctx,[[0,0],[6,-6],[w-6,-6],[w,0],[w,12],[0,12]],p.edge,p.ink);poly(ctx,[[4,0],[8,-3],[w-9,-3],[w-4,0],[w-4,7],[4,7]],p.light);path(ctx,[[8,1],[w-9,1]],'#f0ead066',1);
    const cy=Math.min(34,h*.55);ctx.fillStyle=p.dark;ctx.fillRect(w/2-10,cy-11,20,24);
    if(biome==='crypt'){poly(ctx,[[w/2,cy-8],[w/2+6,cy],[w/2,cy+9],[w/2-6,cy]],null,p.light,1.5);path(ctx,[[w/2-4,cy],[w/2+4,cy]],p.edge,1);ctx.fillStyle='#709da244';ctx.fillRect(7,h-22,w-23,8);path(ctx,[[4,9],[13,17],[10,27]],p.ink+'77',1);}
    else if(biome==='ember'){path(ctx,[[w/2-5,cy+7],[w/2-7,cy-1],[w/2,cy-9],[w/2+7,cy-1],[w/2+4,cy+7],[w/2-5,cy+7]],'#deb984',1.5);for(const rx of[7,w-8])for(const ry of[17,h-17]){circle(ctx,rx,ry,2,p.ink);circle(ctx,rx-.5,ry-.5,1,p.light);}path(ctx,[[w/2-3,cy+5],[w/2,cy],[w/2+3,cy+5]],'#ae7850',1);}
    else{path(ctx,[[w/2,cy-8],[w/2-4,cy-3],[w/2,cy+2],[w/2+4,cy-3],[w/2,cy-8]],p.light,1);path(ctx,[[w/2,cy+2],[w/2,cy+9]],p.edge,1);ctx.fillStyle='#719149';ctx.fillRect(2,7,18,3);ctx.fillRect(1,9,9,10);ctx.fillRect(7,14,6,4);this.grass(ctx,-3,h-1,'#7c9654',6);this.grass(ctx,w-1,h+2,'#74894e',5);}
  }

  consumeEvents(state) {
    if ((state.tick ?? 0) < this.lastTick) this.resetEffects();
    this.lastTick = state.tick ?? 0;
    const events=state.events||[],latest=events[events.length-1];
    // Authoritative events are append-only with monotonic IDs. Repeated display
    // frames usually contain the same bounded event window as the previous one.
    if(typeof latest?.id==='number'&&latest.id===this.lastConsumedEventId)return;
    for (const event of events) {
      const key = event.id ?? `${event.tick}:${event.type}:${event.x}:${event.y}`;
      if (this.seenEvents.has(key)) continue;
      this.seenEvents.add(key);
      if (this.seenEvents.size > 600) this.seenEvents.delete(this.seenEvents.values().next().value);
      if (event.tick != null && this.lastTick - event.tick > 48) continue;
      const x = event.x ?? 480, y = event.y ?? 320;
      const color = event.fighter === 1 ? PALETTES[1].light : PALETTES[0].light;
      if (event.type === 'hit' || event.type === 'guardbreak') {
        this.sparks(x, y, event.type === 'guardbreak' ? 22 : 13, event.source === 'enemy' ? '#ffc0a3' : color);
        this.rings.push({ x, y, color: '#fff6cc', life: 0.15, maxLife: 0.15, size: 19 });
        this.shake = Math.max(this.shake, event.type === 'guardbreak' ? 3.5 : 1.7);
      } else if (event.type === 'parry') {
        this.sparks(x, y, 25, '#e9ffee');
        this.rings.push({ x, y, color: '#e1ffdc', life: 0.35, maxLife: 0.35, size: 47 });
        this.shake = 2.8;
      } else if (event.type === 'block') {
        this.sparks(x, y, 7, '#d9deb9');
      } else if (event.type === 'enemyDeath' || event.type === 'down') {
        this.sparks(x, y, 20, event.type === 'down' ? color : '#e8b677', 0.75);
        this.rings.push({ x, y, color: event.type === 'down' ? color : '#e8b677', life: 0.38, maxLife: 0.38, size: 29 });
      } else if (event.type === 'revive') {
        this.sparks(x, y, 30, '#e2ffbc', 0.45);
        this.rings.push({ x, y, color: '#e2ffbc', life: 0.7, maxLife: 0.7, size: 48 });
      } else if (event.type === 'roll') {
        this.dust(x, y + 9, 6);
      } else if (event.type === 'shoot') {
        this.sparks(x, y, 4, '#d7ddbb', 0.35);
      }
    }
    this.lastConsumedEventId=typeof latest?.id==='number'?latest.id:null;
  }

  sparks(x, y, count, color, speedScale = 1) {
    if(this.reducedMotion.matches)return;
    const rng = rngFrom((x * 37 + y * 53 + this.lastTick * 97) | 0);
    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2, speed = (32 + rng() * 143) * speedScale;
      const life = 0.17 + rng() * 0.3;
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 10, color: i % 4 ? color : '#fffbe9', life, maxLife: life, spark: true, size: 0.7 + rng() * 1.5 });
    }
  }

  dust(x, y, count) {
    if(this.reducedMotion.matches)return;
    const rng = rngFrom(this.lastTick * 197 + x);
    for (let i = 0; i < count; i++) {
      const life = 0.25 + rng() * 0.18;
      this.particles.push({ x: x + (rng() - 0.5) * 16, y: y + (rng() - 0.5) * 8, vx: (rng() - 0.5) * 37, vy: -rng() * 20, color: '#d2c6a0', life, maxLife: life, spark: false, size: 1 + rng() * 3 });
    }
  }

  render(state, options = {}) {
    const wallTime = options.time ?? performance.now();
    const time = this.reducedMotion.matches ? (state?.tick ?? 0) * 1000 / 120 : wallTime;
    this.currentBiome = state?.biome?.id || 'garden';
    const dt = this.lastTime ? clamp((time - this.lastTime) / 1000, 0, 0.05) : 1 / 60;
    this.lastTime = time;
    if (state) this.consumeEvents(state);
    const ctx = this.ctx;
    const scale = Math.min(this.canvas.width / WIDTH, this.canvas.height / HEIGHT);
    const ox = (this.canvas.width - WIDTH * scale) / 2, oy = (this.canvas.height - HEIGHT * scale) / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#12231e'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(scale, 0, 0, scale, ox, oy);
    ctx.drawImage(this.backgrounds[state?.biome?.id || 'garden'] || this.background, 0, 0, WIDTH, HEIGHT);
    ctx.save();
    if (!this.reducedMotion.matches && this.shake > 0.05) ctx.translate(Math.sin(time * 0.163) * this.shake, Math.cos(time * 0.137) * this.shake * 0.7);
    for (const torch of this.torches) this.torch(ctx, ...torch, this.reducedMotion.matches ? 0 : time);

    const fighters = state?.fighters || [];
    const enemies = state?.enemies || [];
    const obstacles = state?.obstacles || DEFAULT_OBSTACLES;
    for(const hazard of state?.hazards || []) this.floorHazard(ctx,hazard,this.reducedMotion.matches?0:time);
    for(const shrine of state?.shrineChoices || []) this.shrine(ctx,shrine,state,time);
    for (const enemy of enemies) this.telegraph(ctx, enemy, time);
    for (const f of fighters) {
      const id = f.id ?? fighters.indexOf(f);
      ellipse(ctx, f.x, f.y + 13, f.action === 'roll' ? 13 : 15, 5, '#0b272e55');
      if (!this.reducedMotion.matches && f.action === 'roll' && (state.tick ?? 0) - (this.lastGhost.get(id) ?? -99) >= 5) {
        this.ghosts.push({ f: { ...f, id }, life: 0.17, maxLife: 0.17 });
        this.lastGhost.set(id, state.tick ?? 0);
      }
      if (options.localId === id && !f.downed && f.action !== 'dead') {
        ctx.save(); ctx.strokeStyle = PALETTES[id % 2].main; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(f.x, f.y + 13, 20, 7, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
    }
    this.ghosts = this.ghosts.filter(ghost => (ghost.life -= dt) > 0);
    for (const ghost of this.ghosts) {
      ctx.save(); ctx.globalAlpha = ghost.life / ghost.maxLife * 0.17;
      this.hero(ctx, ghost.f, time, true); ctx.restore();
    }
    const objects=this.depthObjects,pool=this.depthPool;let count=0;
    const addObject=(kind,entity,y,index=0)=>{const entry=pool[count]||(pool[count]={});entry.kind=kind;entry.entity=entity;entry.y=y;entry.index=index;objects[count++]=entry;};
    for(const obstacle of obstacles)addObject(0,obstacle,obstacle.y+obstacle.h);
    for(let i=0;i<fighters.length;i++)addObject(1,fighters[i],fighters[i].y+13,i);
    for(const enemy of enemies)addObject(2,enemy,enemy.y+(enemy.type==='bat'?-9:10));
    objects.length=count;
    objects.sort((a, b) => a.y - b.y);
    for(const object of objects){
      if(object.kind===0)this.pillar(ctx,object.entity);
      else if(object.kind===1)this.hero(ctx,object.entity.id==null?{...object.entity,id:object.index}:object.entity,time);
      else this.enemy(ctx,object.entity,time);
    }
    for (const projectile of state?.projectiles || []) this.projectile(ctx, projectile, time);
    this.effects(ctx, dt);
    if(!this.reducedMotion.matches)this.motes(ctx, time);
    ctx.restore();
    this.shake *= Math.exp(-dt * 24);
  }

  torch(ctx, x, y, time) {
    const crypt=this.currentBiome==='crypt';
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#21392d'; ctx.fillRect(-5, -3, 10, 15);
    ctx.fillStyle = '#877652'; ctx.fillRect(-3, -5, 6, 16); ctx.fillStyle = '#c2a473'; ctx.fillRect(-3, -4, 2, 14);
    poly(ctx, [[-6, -5], [6, -5], [4, 1], [-4, 1]], '#7a644b', '#b69a67');
    const flicker = Math.sin(time / 83 + x) * 2;
    ctx.shadowColor = crypt?'#a1dcd6':'#ffd186'; ctx.shadowBlur = 12;
    poly(ctx, [[-4, -5], [-6, -11], [-2, -18 + flicker], [0, -13], [4, -21 - flicker], [5, -10], [3, -5]], crypt?'#6ea9bb':'#e7a663');
    poly(ctx, [[-2, -5], [-3, -11], [0, -16 + flicker], [3, -10], [2, -5]], crypt?'#d8efdb':'#ffe6ad');
    ctx.shadowBlur = 0; ctx.restore();
  }

  floorHazard(ctx,h,time) {
    ctx.save();
    if(h.kind==='tide') {
      ellipse(ctx,h.x,h.y,h.radius,h.radius*.78,'#1e6c7d77');
      ctx.strokeStyle='#8bced080';ctx.lineWidth=1;
      for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(h.x,h.y,h.radius*(.5+i*.2),h.radius*(.35+i*.16),0,0,Math.PI*2);ctx.stroke();}
    } else {
      circle(ctx,h.x,h.y,h.radius,'#32252699');ctx.strokeStyle=h.active?'#ffc084':h.warning?'#edaa75':'#a07256';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(h.x,h.y,h.radius,0,Math.PI*2);ctx.stroke();
      for(let i=0;i<6;i++){const a=i*Math.PI/3;poly(ctx,[[h.x+Math.cos(a)*26,h.y+Math.sin(a)*26],[h.x+Math.cos(a+.13)*36,h.y+Math.sin(a+.13)*36],[h.x+Math.cos(a+.26)*26,h.y+Math.sin(a+.26)*26]],h.active?'#ffba67':'#b5816066');}
      if(h.warning){ctx.strokeStyle='#ffe8a5';ctx.lineWidth=3;ctx.beginPath();ctx.arc(h.x,h.y,h.radius+4,-Math.PI/2,-Math.PI/2+h.progress*Math.PI*2);ctx.stroke();}
      if(h.active)for(let i=0;i<7;i++){const x=h.x+Math.sin(i*5.7)*h.radius*.7,y=h.y+Math.cos(i*3)*h.radius*.6;poly(ctx,[[x-5,y+8],[x-3,y-5],[x,y-19-Math.sin(time/90+i)*6],[x+5,y-3],[x+5,y+8]],i%2?'#ed9866':'#ffcf85');}
    }
    ctx.restore();
  }
  shrine(ctx,s,state,time) {
    const biome=this.currentBiome,edge=biome==='crypt'?'#aac6bd':biome==='ember'?'#d1ad77':'#a7b492',stone=biome==='crypt'?'#5d808b':biome==='ember'?'#8a7054':'#64775d';
    ctx.save();ctx.translate(s.x,s.y);ellipse(ctx,0,20,39,12,'#132c2c88');
    poly(ctx,[[-31,-7],[-24,-14],[25,-14],[32,-7],[32,18],[-31,18]],stone,'#2f453b',1.5);ctx.fillStyle=edge;ctx.fillRect(-34,-11,68,6);ctx.fillRect(-31,14,62,4);ctx.fillStyle='#2e484555';ctx.fillRect(-26,-2,52,12);
    for(const x of[-25,23]){ctx.fillStyle=edge;ctx.fillRect(x,-3,3,12);}path(ctx,[[-8,6],[0,0],[8,6]],edge+'77',1);
    const lift=this.reducedMotion.matches?0:Math.sin(time/500+s.x)*2;ctx.translate(0,lift);ctx.save();ctx.shadowColor=s.color;ctx.shadowBlur=10;
    circle(ctx,0,-36,22,s.color+'12');ctx.strokeStyle=s.color+'66';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,-36,21,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;
    if(s.id==='edge'){poly(ctx,[[-3,-51],[3,-51],[4,-30],[0,-22],[-4,-30]],'#e7e7c6',s.color,1);path(ctx,[[-9,-31],[9,-31]],s.color,3);path(ctx,[[0,-28],[0,-17]],'#d9b57d',3);}
    else if(s.id==='ward'){poly(ctx,[[-13,-48],[0,-54],[13,-48],[11,-31],[0,-20],[-11,-31]],s.color,'#eee9c3',1);poly(ctx,[[0,-46],[7,-37],[0,-27],[-7,-37]],'#446950');path(ctx,[[0,-43],[0,-30]],'#cde0b5',1);}
    else if(s.id==='bow'){ctx.strokeStyle=s.color;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-5,-51);ctx.quadraticCurveTo(16,-36,-5,-21);ctx.stroke();path(ctx,[[-5,-51],[-10,-36],[-5,-21]],'#e6e4c2',1);this.arrow(ctx,0,-36,0,'#d2ebdc',24);}
    else if(s.id==='vigor'){for(let i=0;i<3;i++)path(ctx,[[-14+i*3,-42+i*7],[0+i*3,-47+i*7],[12+i*2,-43+i*7]],s.color,2);poly(ctx,[[-5,-47],[3,-56],[8,-50],[0,-41]],'#d5e8c5');}
    else if(s.id==='leech'){for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ellipse(ctx,Math.cos(a)*8,-36+Math.sin(a)*8,6,8,s.color);}circle(ctx,0,-36,5,'#ffe1a1');path(ctx,[[0,-26],[0,-19]],'#9cb57e',2);}
    else{poly(ctx,[[0,-54],[15,-36],[0,-18],[-15,-36]],s.color,'#ede5d0',1);poly(ctx,[[0,-48],[9,-36],[0,-24],[-9,-36]],'#596375');path(ctx,[[-4,-39],[3,-44]],'#ecf1d8',2);}
    ctx.restore();ctx.translate(0,-lift);ctx.textAlign='center';ctx.font='bold 13px system-ui';ctx.fillStyle='#fbf0d0';ctx.fillText(s.name,0,43);ctx.font='10px system-ui';ctx.fillStyle='#ece3c5';ctx.fillText(s.detail,0,58,152);
    const owners=state.boonSelections.map((id,i)=>id===s.id?`P${i+1}`:null).filter(Boolean);if(owners.length){ctx.font='bold 11px system-ui';ctx.fillStyle=s.color;ctx.fillText(owners.join(' + ')+' CHOSEN',0,75);}ctx.restore();
  }

  hero(ctx, f, time, ghost = false) {
    const palette = PALETTES[(f.id ?? 0) % 2];
    const frame = f.actionFrame || 0;
    const facing = f.attackFacing != null && f.action === 'attack' ? f.attackFacing : f.facing ?? 0;
    const dx = Math.cos(facing), dy = Math.sin(facing);
    const moving = f.action === 'run';
    const bob = this.reducedMotion.matches ? 0 : moving ? Math.abs(Math.sin(frame * 0.22)) * 1.4 : Math.sin(time / 420 + f.id) * 0.3;
    const stride = moving && !this.reducedMotion.matches ? Math.sin(frame * 0.22) * 3.2 : 0;
    const downed = f.downed || f.action === 'dead';
    const shooting = f.action === 'attack' && f.attackKind === 'shoot';
    ctx.save(); ctx.translate(f.x, f.y);
    ctx.lineJoin = 'miter'; ctx.lineCap = 'square';

    if (downed) {
      ctx.save(); ctx.rotate(-0.65);
      ellipse(ctx, 0, 9, 20, 7, '#112e2c55');
      poly(ctx, [[-20, 0], [-10, -9], [11, -9], [23, 0], [16, 10], [-14, 10]], palette.dark, '#253a31');
      poly(ctx, [[-18, -4], [-11, -10], [-1, -9], [2, -1], [-3, 7], [-13, 5]], palette.mid, '#283b32');
      ctx.fillStyle = '#263b34'; ctx.fillRect(-15, -3, 11, 4);
      this.sword(ctx, 11, 9, 0.25, palette, 26, true);
      ctx.restore();
      if (f.downed && !ghost) {
        ctx.save(); ctx.globalAlpha = this.reducedMotion.matches ? .8 : 0.70 + Math.sin(time / 200) * 0.15;
        circle(ctx, 0, -24, 7, '#263c35'); path(ctx, [[0, -28], [0, -23]], palette.light, 2); ctx.fillStyle = palette.light; ctx.fillRect(-1, -21, 2, 2);
        if (f.reviveProgress > 0) {
          ctx.strokeStyle = '#e5ffbd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -24, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(f.reviveProgress / 180, 0, 1)); ctx.stroke();
        }
        ctx.restore();
      }
      ctx.restore(); return;
    }

    if (f.action === 'roll') {
      ctx.save(); ctx.rotate(facing + (this.reducedMotion.matches?0:frame / 30 * Math.PI * 2));
      poly(ctx, [[-13, -5], [-5, -13], [9, -11], [15, -2], [10, 10], [-4, 12], [-13, 5]], palette.dark, '#223b32');
      poly(ctx, [[-9, -5], [-3, -10], [7, -9], [11, -2], [7, 6], [-4, 7]], palette.main);
      path(ctx, [[-7, -3], [3, -5], [8, 0]], palette.light, 2);
      poly(ctx, [[-9, 4], [-3, 0], [6, 4], [3, 11], [-3, 10]], palette.cloak);
      this.shield(ctx, -9, -1, -0.8, palette, false, true);
      ctx.restore(); ctx.restore(); return;
    }

    let swordAngle = facing, swordLength = 32, attackTrail = null;
    if (f.action === 'attack' && f.attackKind !== 'shoot') {
      const start = facing - 1.32, end = facing + 1.18;
      if (frame < 9) swordAngle = mix(facing, start, ease(frame / 9));
      else if (frame < 19) { swordAngle = mix(start, end, ease((frame - 9) / 10)); attackTrail = { start, end: swordAngle, alpha: 1 }; }
      else { swordAngle = mix(end, facing, ease((frame - 19) / 19)); if (frame < 24) attackTrail = { start: end - 1.7, end, alpha: 1 - (frame - 19) / 5 }; }
      swordLength = 46;
    }
    if (attackTrail && !ghost) this.slash(ctx, attackTrail.start, attackTrail.end, 72, palette.light, attackTrail.alpha);
    const handX = Math.cos(swordAngle) * 17, handY = Math.sin(swordAngle) * 13 + 2;
    const swordBehind = Math.sin(swordAngle) < -0.22;
    if (swordBehind && !shooting) this.sword(ctx, handX, handY, swordAngle, palette, swordLength, ghost);
    if (dy < -0.3) this.shield(ctx, -dx * 10 - 10, -dy * 9 + 1, -0.1, palette, false, ghost);

    // A back quiver, layered scarf and stitched cape make aim direction legible.
    if(dy < -.3){
      poly(ctx,[[4,-17],[10,-19],[16,8],[9,10]],'#725b43','#273c32',.8);
      for(let i=0;i<3;i++){path(ctx,[[5+i*3,-18],[3+i*3,-26]],'#d2bd8c',1.2);poly(ctx,[[3+i*3,-26],[1+i*3,-29],[5+i*3,-29]],palette.light);}
    }
    // Dark boots and a triangular cloak sit below the broad hood silhouette.
    ctx.fillStyle = '#25372d'; ctx.fillRect(-10, 8 + stride, 8, 8); ctx.fillRect(3, 8 - stride, 8, 8);
    ctx.fillStyle = '#889273'; ctx.fillRect(-10, 14 + stride, 8, 2); ctx.fillRect(3, 14 - stride, 8, 2);
    poly(ctx, [[-10, -10 + bob], [9, -10 + bob], [14 + stride * 0.4, 9], [9, 13], [1, 10], [-5, 14], [-15 - stride * 0.4, 10]], palette.dark, '#21372d', 1);
    poly(ctx, [[-8, -8 + bob], [7, -8 + bob], [10, 8], [4, 11], [0, 7], [-6, 11], [-11, 8]], palette.cloak);
    poly(ctx, [[-4, -7 + bob], [5, -7 + bob], [6, 6], [-5, 7]], '#947d53', '#494b37');
    path(ctx, [[-7, 5], [8, 5]], '#d0b782', 2);
    path(ctx,[[-7,-3],[-8,1]],'#d3cba244',1);path(ctx,[[6,-3],[7,1]],'#d3cba244',1);
    if(dy < -.42){poly(ctx,[[0,-3],[4,2],[0,6],[-4,2]],null,palette.light+'88',.8);path(ctx,[[0,-1],[0,4]],palette.mid,1);}
    ctx.fillStyle='#80664a';ctx.fillRect(-12,4,5,6);ctx.fillStyle='#c9ad76';ctx.fillRect(-12,4,5,1);
    ctx.fillStyle = '#e2cf92'; ctx.fillRect(-1, 3, 3, 4);
    poly(ctx, [[-10, -8 + bob], [-4, -11 + bob], [2, -4 + bob], [-4, 4], [-9, 2]], palette.main);
    path(ctx, [[-8, -6 + bob], [-6, 1]], palette.light, 1);
    // Arms and leather gloves communicate the weapon direction.
    path(ctx, [[dx * 7, -3 + bob], [handX * 0.72, handY * 0.7 + 2], [handX, handY]], '#384d34', 7);
    path(ctx, [[dx * 7, -4 + bob], [handX * 0.72, handY * 0.7 + 1]], palette.mid, 5);
    ctx.fillStyle = '#bba477'; ctx.fillRect(handX - 3, handY - 3, 6, 6);

    const lookX = dx * 2.2;
    // Angular hood, inset face and side folds are readable in every aim direction.
    poly(ctx, [[-13, -14 + bob], [-9, -24 + bob], [-3, -28 + bob], [6, -26 + bob], [12, -19 + bob], [13, -10 + bob], [8, -5 + bob], [-8, -5 + bob], [-14, -10 + bob]], palette.main, '#2c4635', 1.2);
    poly(ctx, [[-10, -17 + bob], [-6, -24 + bob], [2, -26 + bob], [7, -22 + bob], [10, -15 + bob], [7, -7 + bob], [-7, -7 + bob]], palette.mid);
    path(ctx, [[-8, -22 + bob], [-3, -26 + bob], [3, -25 + bob]], palette.light, 1.5);
    if (dy > -0.42) {
      poly(ctx, [[-7 + lookX, -18 + bob], [-3 + lookX, -22 + bob], [5 + lookX, -20 + bob], [9 + lookX, -14 + bob], [5 + lookX, -8 + bob], [-4 + lookX, -9 + bob], [-8 + lookX, -14 + bob]], '#26362f');
      poly(ctx, [[-5 + lookX, -18 + bob], [5 + lookX, -18 + bob], [7 + lookX, -13 + bob], [4 + lookX, -9 + bob], [-4 + lookX, -10 + bob]], '#d4b18a');
      ctx.fillStyle = '#152d29';
      if (dx < 0.8) ctx.fillRect(-3 + lookX, -15 + bob, 2, 3);
      if (dx > -0.8) ctx.fillRect(3 + lookX, -15 + bob, 2, 3);
      ctx.fillStyle = '#efdbb0'; ctx.fillRect(lookX, -12 + bob, 2, 2);
      poly(ctx, [[-9, -18 + bob], [-4, -22 + bob], [7, -21 + bob], [9, -17 + bob], [1, -18 + bob], [-1, -15 + bob], [-4, -18 + bob]], palette.dark);
    } else {
      poly(ctx, [[-7, -19 + bob], [-2, -23 + bob], [6, -19 + bob], [8, -10 + bob], [0, -7 + bob], [-8, -11 + bob]], palette.cloak);
      path(ctx, [[-2, -20 + bob], [0, -11 + bob]], palette.mid, 2);
    }
    // Collar and a little silver cloak clasp.
    poly(ctx, [[-10, -7 + bob], [-4, -9 + bob], [1, -4 + bob], [7, -8 + bob], [10, -6 + bob], [4, -1 + bob], [-3, -1 + bob]], palette.main);
    poly(ctx,[[-10,-5+bob],[-3,-3+bob],[4,-5+bob],[8,-3+bob],[3,0+bob],[-9,-1+bob]],f.id===1?'#aa96c1':'#ceae76');
    poly(ctx,[[-9,-1+bob],[-5,0+bob],[-8,7],[-13,4]],f.id===1?'#9c86b2':'#ad8759');
    circle(ctx, 1, -3 + bob, 2, '#ead9a5');
    if(f.id===1)path(ctx,[[1,-5+bob],[3,-3+bob],[1,-1+bob]],'#f4ecd3',.7);

    if (shooting) this.bow(ctx, facing, frame, palette);
    else if (!swordBehind) this.sword(ctx, handX, handY, swordAngle, palette, swordLength, ghost);
    if (dy >= -0.3) {
      const guard = f.action === 'block';
      const shieldX = guard ? dx * 22 : -10 - dx * 3;
      const shieldY = guard ? dy * 16 + 2 : 2;
      this.shield(ctx, shieldX, shieldY, guard ? facing - Math.PI / 2 : -0.17, palette, guard, ghost);
    } else if (f.action === 'block') this.shield(ctx, dx * 22, dy * 16 + 2, facing - Math.PI / 2, palette, true, ghost);
    if (f.action === 'block' && !ghost) {
      ctx.save(); ctx.globalAlpha = 0.20; ctx.strokeStyle = palette.light; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 2, 31, facing - 0.9, facing + 0.9); ctx.stroke(); ctx.restore();
    }
    if (f.action === 'hit' && !ghost) {
      ctx.save(); ctx.globalAlpha = Math.max(0, 0.38 - frame / 75);
      circle(ctx, 0, -6, 19, '#ffe2c0'); ctx.restore();
    }
    ctx.restore();
  }

  sword(ctx, x, y, angle, palette, length, ghost = false) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = '#735b3a'; ctx.fillRect(-7, -2, 9, 4);
    circle(ctx,-8,0,2.5,'#c4a66d');
    for(let i=-5;i<2;i+=3)path(ctx,[[i,-2],[i+1,2]],'#aa8e61',.7);
    ctx.fillStyle = '#dacb90'; ctx.fillRect(1, -6, 3, 12);
    poly(ctx, [[4, -3], [length - 6, -3], [length, 0], [length - 6, 3], [4, 3]], '#dfe9d7', '#506b5b', 0.75);
    path(ctx, [[5, -2], [length - 6, -2], [length - 1, 0]], '#fbffea', 1);
    path(ctx, [[5, 2], [length - 6, 2]], palette.main, 1);
    ctx.restore();
  }

  shield(ctx, x, y, angle, palette, guard, ghost) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    poly(ctx, [[-9, -10], [0, -13], [10, -10], [9, 6], [0, 13], [-9, 6]], '#bea76d', '#344432', 1);
    poly(ctx, [[-6, -8], [0, -10], [7, -8], [6, 4], [0, 9], [-6, 4]], palette.dark, '#e0cc8b', 0.7);
    poly(ctx, [[0, -5], [4, 0], [0, 5], [-4, 0]], palette.main);
    path(ctx,[[-3,0],[0,-3],[3,0]],palette.light,.8);
    for(const [rx,ry]of[[-7,-7],[7,-7],[-6,5],[6,5]])circle(ctx,rx,ry,.8,'#efdc9f');
    path(ctx, [[0, -8], [0, -5]], '#f4e2a6', 1);
    if (guard && !ghost) poly(ctx, [[-9, -10], [0, -13], [10, -10], [9, 6], [0, 13], [-9, 6]], null, palette.light, 1);
    ctx.restore();
  }

  bow(ctx, angle, frame, palette) {
    ctx.save(); ctx.rotate(angle); ctx.translate(23, 1);
    ctx.strokeStyle = '#be9b67'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -15); ctx.quadraticCurveTo(15, 0, 0, 15); ctx.stroke();
    const pull = frame < 12 ? mix(0, -9, frame / 12) : -2;
    path(ctx, [[0, -15], [pull, 0], [0, 15]], '#e4dcc1', 0.8);
    if (frame < 10) this.arrow(ctx, pull + 11, 0, 0, palette.light, 22);
    ctx.restore();
  }

  slash(ctx, start, end, radius, color, alpha = 1) {
    if (end < start + 0.03) return;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const points = [];
    const begin = Math.max(start, end - 1.9);
    for (let i = 0; i <= 18; i++) { const a = mix(begin, end, i / 18); points.push([Math.cos(a) * radius, Math.sin(a) * radius]); }
    for (let i = 18; i >= 0; i--) { const a = mix(begin, end, i / 18), r = radius - 18 * (i / 18); points.push([Math.cos(a) * r, Math.sin(a) * r]); }
    ctx.globalAlpha = 0.16 * alpha; poly(ctx, points, color);
    ctx.globalAlpha = 0.75 * alpha; ctx.strokeStyle = color; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(0, 0, radius, begin, end); ctx.stroke();
    ctx.globalAlpha = 0.3 * alpha; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, radius - 5, begin + 0.1, end); ctx.stroke();
    ctx.restore();
  }

  telegraph(ctx, enemy, time) {
    if (enemy.action !== 'windup' && enemy.action !== 'attack') return;
    const radius = enemy.telegraphRadius || enemy.reach || (enemy.type === 'boss' ? 94 : 51);
    const facing = enemy.attackFacing ?? enemy.facing ?? 0;
    const burst = ['burst','crown'].includes(enemy.attackKind);
    const radial = enemy.telegraphRadius || burst;
    const halfArc = enemy.telegraphHalfArc ?? (enemy.type === 'knight' ? 1.25 : 0.95);
    const windup = enemy.action === 'windup';
    const progress = windup ? clamp((enemy.actionFrame || 0) / (enemy.windupTicks || 45), 0, 1) : 1;
    ctx.save(); ctx.translate(enemy.x, enemy.y);
    ctx.globalAlpha = (windup ? 0.15 + progress * 0.07 : 0.22) + (this.reducedMotion.matches?0:Math.sin(time / 80) * 0.015);
    ctx.fillStyle = '#f1a17b'; ctx.strokeStyle = '#ffe1a7'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (enemy.attackKind === 'charge') {
      const length = enemy.telegraphLength || 270, width = enemy.reach || 64;
      const cos = Math.cos(facing), sin = Math.sin(facing);
      const corners = [[0,-width],[length,-width],[length,width],[0,width]].map(([x,y]) => [x*cos-y*sin,x*sin+y*cos]);
      for (let i=0;i<corners.length;i++) i ? ctx.lineTo(...corners[i]) : ctx.moveTo(...corners[i]);
      ctx.closePath();
    } else if (radial) ctx.arc(0, 0, radius, 0, Math.PI * 2);
    else { ctx.moveTo(0, 0); ctx.arc(0, 0, radius, facing - halfArc, facing + halfArc); ctx.closePath(); }
    ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 0.35; ctx.strokeStyle = '#fff0bd'; ctx.lineWidth = 1;
    ctx.beginPath();
    if (enemy.attackKind === 'charge') {
      const length=(enemy.telegraphLength || 270)*progress;
      ctx.moveTo(0,0);ctx.lineTo(Math.cos(facing)*length,Math.sin(facing)*length);
    } else ctx.arc(0, 0, radius * progress, radial ? 0 : facing - halfArc, radial ? Math.PI * 2 : facing + halfArc);
    ctx.stroke();
    if (enemy.attackKind === 'fan') {
      ctx.globalAlpha = .4;
      for (let i=-2;i<=2;i++) { const angle=facing+i*.2; path(ctx,[[Math.cos(angle)*24,Math.sin(angle)*24],[Math.cos(angle)*radius,Math.sin(angle)*radius]],'#ffe0ad',1); }
    }
    if (burst) {
      ctx.globalAlpha = 0.48;
      const count = enemy.attackKind === 'crown' ? 12 : 8;
      for (let i = 0; i < count; i++) {
        const a = facing + i * Math.PI * 2 / count;
        path(ctx, [[Math.cos(a) * 35, Math.sin(a) * 35], [Math.cos(a) * radius, Math.sin(a) * radius]], '#ffe0ad', 1.5);
      }
    }
    ctx.restore();
  }

  enemy(ctx, enemy, time) {
    if (enemy.action === 'dead' || enemy.hp <= 0) return;
    const frame = enemy.actionFrame || 0;
    const facing = enemy.attackFacing ?? enemy.facing ?? 0;
    const moving = enemy.action === 'run';
    const bob = this.reducedMotion.matches ? 0 : Math.sin(time / 160 + enemy.id) * (moving ? 1.5 : 0.7);
    const biome=enemy.variant||this.currentBiome,look=Math.cos(facing)*2;
    const skin=biome==='crypt'?['#557f9a','#8fb4bd','#c7dbd2','#759cad']:biome==='ember'?['#a0714d','#d9a568','#f0ce8c','#bb8b52']:['#548f77','#82c5a3','#bfdbc2','#6bac92'];
    const wingColor=biome==='crypt'?'#627f9c':biome==='ember'?'#886854':'#756b93',wingVein=biome==='crypt'?'#9fbad1':biome==='ember'?'#cc9a67':'#ab98bb';
    ctx.save(); ctx.translate(enemy.x, enemy.y);
    const type = enemy.type || 'slime';
    if (type === 'slime') {
      ellipse(ctx, 0, 12, 19, 5, '#13362c66');
      const squash = this.reducedMotion.matches ? 0 : moving ? Math.sin(time / 115 + enemy.id) * 2 : bob;
      poly(ctx, [[-18, 8], [-18, -1 - squash], [-13, -12 - squash], [-5, -17 - squash], [7, -17 - squash], [15, -10 - squash], [19, 0], [17, 9], [7, 13], [-7, 12]], skin[0], '#234d41', 1);
      poly(ctx, [[-14, 5], [-13, -4 - squash], [-7, -12 - squash], [5, -12 - squash], [13, -5], [14, 6], [6, 10], [-6, 9]], skin[1]);
      poly(ctx, [[-12, -5 - squash], [-7, -10 - squash], [0, -10 - squash], [0, -7 - squash], [-7, -6 - squash]], skin[2]);
      ctx.fillStyle = '#25483e'; ctx.fillRect(-7+look, -1, 3, 4); ctx.fillRect(5+look, -1, 3, 4); ctx.fillRect(-2+look, 5, 5, 2);
      for(const [x,y]of[[-11,5],[10,4],[-2,-9]])circle(ctx,x,y,1.5,skin[0]);
      if(biome==='crypt')poly(ctx,[[-4,-16-squash],[0,-24-squash],[5,-15-squash]],'#bad6d5','#6e9dac',.6);
      if(biome==='ember')path(ctx,[[-10,-3],[-4,-7],[0,-3],[5,-6]],'#a96b45',1);
      ctx.fillStyle = '#e0e8c5'; ctx.fillRect(-6, -1, 1, 1); ctx.fillRect(6, -1, 1, 1);
      ctx.fillStyle = skin[3]; ctx.fillRect(-14, 10, 6, 2); ctx.fillRect(7, 11, 7, 2);
    } else if (type === 'bat') {
      ellipse(ctx, 0, 15, 15, 4, '#1b2e3d33');
      ctx.translate(0, -11 + (this.reducedMotion.matches?0:Math.sin(time / 117 + enemy.id) * 3));
      const wing = this.reducedMotion.matches?0:Math.sin(time / 70 + enemy.id) * 6;
      poly(ctx, [[-5, -1], [-16, -11 - wing], [-29, -9 - wing], [-24, 0 - wing * 0.3], [-21, 9], [-14, 4], [-8, 8]], wingColor, '#38465a');
      poly(ctx, [[5, -1], [16, -11 - wing], [29, -9 - wing], [24, 0 - wing * 0.3], [21, 9], [14, 4], [8, 8]], wingColor, '#38465a');
      path(ctx, [[-7, 1], [-19, -6 - wing], [-26, -8 - wing]], wingVein, 1); path(ctx, [[7, 1], [19, -6 - wing], [26, -8 - wing]], wingVein, 1);
      for(const side of[-1,1]){path(ctx,[[side*7,0],[side*18,4],[side*21,8]],wingVein,.8);path(ctx,[[side*14,-5-wing*.7],[side*14,3]],wingVein+'aa',.8);}
      poly(ctx, [[-7, -5], [-7, -14], [-1, -9], [3, -10], [9, -14], [8, -4], [7, 8], [0, 13], [-7, 8]], '#4d526b', '#28354b');
      ctx.fillStyle = '#e7c58c'; ctx.fillRect(-5, 0, 3, 2); ctx.fillRect(3, 0, 3, 2);
      ctx.fillStyle = '#e0dcc1'; ctx.fillRect(-3, 6, 2, 3); ctx.fillRect(2, 6, 2, 3);
    } else if (type === 'caster') {
      this.oracle(ctx,enemy,time,false);
    } else if (type === 'knight') {
      this.knight(ctx,enemy,time);
    } else {
      if(enemy.variant==='crypt')this.oracle(ctx,enemy,time,true);
      else if(enemy.variant==='ember')this.regent(ctx,enemy,time);
      else this.guardian(ctx, enemy, time);
    }
    if (enemy.action === 'hit') {
      ctx.save(); ctx.globalAlpha = 0.25; circle(ctx, 0, -5, type === 'boss' ? 33 : 16, '#fff0cb'); ctx.restore();
    }
    ctx.restore();
    if (enemy.maxHp && (enemy.hp < enemy.maxHp || type === 'boss')) {
      const width = type === 'boss' ? 66 : 30, y = enemy.y + (type === 'boss' ? 43 : type === 'bat' ? 20 : 24);
      ctx.fillStyle = '#243b3299'; ctx.fillRect(enemy.x - width / 2 - 1, y - 1, width + 2, 5);
      ctx.fillStyle = type === 'boss' ? '#dda078' : '#bcaa7d'; ctx.fillRect(enemy.x - width / 2, y, width * clamp(enemy.hp / enemy.maxHp, 0, 1), 3);
    }
  }

  knight(ctx,enemy,time) {
    const biome=enemy.variant||this.currentBiome,p=biome==='crypt'?{main:'#779baa',light:'#c0d3cc',dark:'#405e70',cloth:'#426b80'}:biome==='ember'?{main:'#b08b60',light:'#e4c28b',dark:'#6b5241',cloth:'#854e42'}:{main:'#a3976a',light:'#d5c298',dark:'#5d6351',cloth:'#746d4c'};
    const facing=enemy.attackFacing??enemy.facing??0,dx=Math.cos(facing),dy=Math.sin(facing),bob=this.reducedMotion.matches?0:Math.sin(time/160+enemy.id)*.7,stride=enemy.action==='run'&&!this.reducedMotion.matches?Math.sin((enemy.actionFrame||0)*.16)*2.5:0;
    ellipse(ctx,0,15,21,6,'#18352f77');poly(ctx,[[-13,-16],[12,-16],[21,14],[9,18],[0,12],[-13,18],[-21,12]],p.cloth,'#2c4038');
    ctx.fillStyle=p.dark;ctx.fillRect(-13,9+stride,10,9);ctx.fillRect(4,9-stride,10,9);ctx.fillStyle=p.light;ctx.fillRect(-13,16+stride,10,2);ctx.fillRect(4,16-stride,10,2);
    poly(ctx,[[-12,-12+bob],[12,-12+bob],[18,12],[8,16],[-10,16],[-18,11]],p.dark,'#35463d');poly(ctx,[[-10,-11+bob],[9,-11+bob],[13,4],[1,10],[-12,5]],p.main,p.light);
    path(ctx,[[-7,-5],[7,-5]],p.light+'99',1);path(ctx,[[-9,0],[9,0]],p.dark,1);ctx.fillStyle=p.dark;ctx.fillRect(-8,5,16,4);ctx.fillStyle='#e6c588';ctx.fillRect(-2,5,5,4);
    const look=dx*3;poly(ctx,[[look-13,-15+bob],[look-9,-27+bob],[look+6,-29+bob],[look+13,-19+bob],[look+12,-8+bob],[look-10,-8+bob]],p.main,'#2e4441');poly(ctx,[[look-9,-24+bob],[look+6,-26+bob],[look+9,-18+bob],[look-10,-17+bob]],p.light);
    if(dy<-.65){path(ctx,[[look,-26+bob],[look,-11+bob]],p.dark,3);path(ctx,[[look-9,-15+bob],[look+8,-15+bob]],p.dark,1);}
    else{ctx.fillStyle='#2b403c';ctx.fillRect(look-10,-17+bob,21,6);ctx.fillStyle='#efc38c';if(dx<.8)ctx.fillRect(look-7,-15+bob,6,2);if(dx>-.8)ctx.fillRect(look+3,-15+bob,6,2);path(ctx,[[look,-26+bob],[look,-10+bob]],p.dark,2);}
    poly(ctx,[[-3,-28+bob],[1,-38+bob],[5,-34+bob],[5,-27+bob]],p.cloth);path(ctx,[[1,-36+bob],[3,-30+bob]],p.light+'88',1);
    const swordAngle=facing+(enemy.action==='windup'?-1.2:enemy.action==='attack'?.9:.1);this.sword(ctx,Math.cos(swordAngle)*18,Math.sin(swordAngle)*14+1,swordAngle,{main:p.light},39,true);
    const shieldSide=dx>0?-1:1;this.shield(ctx,shieldSide*17,dy<-.5?7:3,shieldSide*.13,{main:p.light,dark:p.dark,light:p.light},false,true);
    if(enemy.action==='attack')this.slash(ctx,facing-1,facing+1.1,enemy.reach||65,'#ffc9a5',.55);
  }

  guardian(ctx, enemy, time) {
    const bob = this.reducedMotion.matches?0:Math.sin(time / 280) * 0.5;
    ellipse(ctx, 0, 29, 38, 10, '#14302e77');
    ctx.fillStyle = '#3b5147'; ctx.fillRect(-25, 15, 20, 17); ctx.fillRect(7, 15, 20, 17);
    ctx.fillStyle = '#899475'; ctx.fillRect(-26, 16, 21, 12); ctx.fillRect(7, 16, 21, 12);
    ctx.fillStyle = '#b4b49455'; ctx.fillRect(-26, 16, 21, 3); ctx.fillRect(7, 16, 21, 3);
    const wind = enemy.action === 'windup' ? -8 : enemy.action === 'attack' ? 8 : bob;
    poly(ctx, [[-31, -24 + wind], [-19, -29 + wind], [-14, -13 + wind], [-20, 12 + wind], [-32, 12 + wind], [-39, 0 + wind]], '#768572', '#344d43', 1.5);
    poly(ctx, [[20, -27 + wind], [33, -23 + wind], [40, -4 + wind], [35, 15 + wind], [23, 13 + wind], [15, -10 + wind]], '#768572', '#344d43', 1.5);
    ctx.fillStyle = '#a9af90'; ctx.fillRect(-37, -6 + wind, 12, 6); ctx.fillRect(27, -7 + wind, 10, 6);
    poly(ctx, [[-20, -33 + bob], [18, -33 + bob], [25, -9], [20, 14], [-19, 14], [-27, -7]], '#8f9879', '#3b5146', 1.5);
    poly(ctx, [[-15, -28 + bob], [14, -28 + bob], [20, -8], [12, 9], [-15, 9], [-20, -6]], '#5b7060', '#b4b28a', 1);
    poly(ctx, [[0, -21], [12, -6], [0, 6], [-12, -6]], '#dda16a', '#593f35', 1.5);
    ctx.save(); ctx.shadowColor = '#ffd9a0'; ctx.shadowBlur = 12;
    poly(ctx, [[0, -15], [7, -6], [0, 1], [-7, -6]], '#ffe0a2'); ctx.restore();
    poly(ctx, [[-17, -38 + bob], [-13, -51 + bob], [12, -51 + bob], [19, -37 + bob], [15, -23 + bob], [-13, -23 + bob]], '#7b8a72', '#334f43', 1.5);
    poly(ctx, [[-13, -45 + bob], [12, -45 + bob], [15, -34 + bob], [-15, -34 + bob]], '#a6b093');
    ctx.fillStyle = '#3f5548'; ctx.fillRect(-12, -36 + bob, 25, 7);
    ctx.save(); ctx.shadowColor = '#ffc394'; ctx.shadowBlur = 7;
    ctx.fillStyle = '#f7c69b'; ctx.fillRect(-9, -34 + bob, 6, 3); ctx.fillRect(5, -34 + bob, 6, 3); ctx.restore();
    path(ctx, [[0, -47 + bob], [0, -28 + bob]], '#586e5d', 3);
    poly(ctx, [[-18, -48 + bob], [-24, -57 + bob], [-12, -55 + bob], [-10, -49 + bob]], '#909b7d', '#405b45');
    poly(ctx, [[12, -50 + bob], [16, -57 + bob], [24, -54 + bob], [18, -46 + bob]], '#909b7d', '#405b45');
    ctx.fillStyle = '#719352'; ctx.fillRect(-17, -49 + bob, 11, 3); ctx.fillRect(-22, -55 + bob, 8, 4);
    path(ctx, [[18, -1], [14, 2], [16, 10]], '#c6be8c44', 1);
    for(const [x,y]of[[-30,-17],[28,3],[-15,-24],[15,-44]]){ctx.fillStyle='#6b8a4a';ctx.fillRect(x,y,8,3);ctx.fillRect(x+2,y-3,4,3);ctx.fillStyle='#9cad68';ctx.fillRect(x+1,y,3,1);}
    for(const side of[-1,1]){path(ctx,[[side*29,-17+wind],[side*31,-8+wind],[side*28,3+wind]],'#456b48',2);poly(ctx,[[side*31,-7+wind],[side*38,-11+wind],[side*37,-4+wind]],'#739551');path(ctx,[[side*27,1+wind],[side*33,5+wind]],'#c5c09666',1);}
    path(ctx,[[-9,-51+bob],[-6,-60+bob],[0,-63+bob],[5,-59+bob],[10,-51+bob]],'#596e4b',2);
    for(const x of[-6,3])poly(ctx,[[x,-60+bob],[x-3,-67+bob],[x+4,-64+bob]],'#8aa263');
  }

  oracle(ctx,enemy,time,boss) {
    const biome=enemy.variant||this.currentBiome,p=biome==='ember'?{robe:'#8c544a',edge:'#d2a474',dark:'#4e3540',glow:'#f0c386'}:biome==='garden'?{robe:'#63785e',edge:'#c4bd8d',dark:'#344c45',glow:'#cbe1b6'}:{robe:'#4e7e95',edge:'#bdd4ca',dark:'#233d58',glow:'#a5e2df'};
    const bob=this.reducedMotion.matches?0:Math.sin(time/280+enemy.id)*(boss?2.5:1.3),look=Math.cos(enemy.attackFacing??enemy.facing??0)*2;
    if(!boss){
      ellipse(ctx,0,18,22,6,'#102d3d66');poly(ctx,[[-13,-21+bob],[12,-21+bob],[22,16],[13,19],[4,14],[-5,20],[-22,16]],p.dark,'#203c4c');poly(ctx,[[-10,-19+bob],[9,-19+bob],[16,14],[-15,14]],p.robe);
      path(ctx,[[-9,-2],[-14,13]],p.edge,1.5);path(ctx,[[8,-2],[13,13]],p.edge,1.5);poly(ctx,[[-4,-17],[4,-17],[6,9],[0,14],[-6,9]],p.edge+'77');
      poly(ctx,[[look,-37+bob],[look+18,-19+bob],[look+10,-5+bob],[look-12,-5+bob],[look-18,-19+bob]],p.robe,p.dark);path(ctx,[[look-13,-21+bob],[look,-32+bob],[look+12,-21+bob]],p.edge,1);poly(ctx,[[look-9,-22+bob],[look+8,-22+bob],[look+6,-11+bob],[look-6,-11+bob]],p.dark);ctx.fillStyle=p.glow;ctx.fillRect(look-6,-18+bob,4,2);ctx.fillRect(look+3,-18+bob,4,2);
      poly(ctx,[[-13,-4],[-20,2],[-16,8],[-9,2]],p.robe,p.dark);ctx.fillStyle=p.edge;ctx.fillRect(-19,2,4,4);path(ctx,[[20,17],[20,-34]],'#b7a07a',3);path(ctx,[[20,-24],[20,-29]],p.edge,4);poly(ctx,[[20,-47],[27,-38],[20,-30],[13,-38]],p.glow,p.edge,1);path(ctx,[[19,-43],[18,-38]],'#f0f7d6',1);
    }else{
      // Tide Oracle: a floating shell mask, embroidered fins and a tidal crozier.
      ellipse(ctx,0,29,37,10,'#0b2b3c88');poly(ctx,[[-22,-28+bob],[20,-28+bob],[33,22+bob],[19,31+bob],[10,25+bob],[0,37+bob],[-12,24+bob],[-27,32+bob],[-35,22+bob]],'#203d59','#152f42',1.5);
      poly(ctx,[[-18,-25+bob],[16,-25+bob],[26,22+bob],[12,26+bob],[0,32+bob],[-13,23+bob],[-28,22+bob]],'#5e91a2');poly(ctx,[[-9,-26+bob],[9,-26+bob],[12,20+bob],[0,29+bob],[-13,20+bob]],'#345c7b');
      for(const side of[-1,1]){path(ctx,[[side*13,-19+bob],[side*20,15+bob],[side*13,22+bob]],'#b8d3c2',2);path(ctx,[[side*9,-11+bob],[side*14,-7+bob],[side*10,-3+bob]],'#a0c4c4',1);poly(ctx,[[side*19,-24+bob],[side*37,-14+bob],[side*45,4+bob],[side*32,13+bob],[side*17,-3+bob]],'#7aa7ad','#274b66',1);path(ctx,[[side*24,-15+bob],[side*37,1+bob]],'#d0ded0',1.5);}
      poly(ctx,[[-19+look,-50+bob],[-9+look,-62+bob],[11+look,-62+bob],[22+look,-48+bob],[17+look,-29+bob],[look,-19+bob],[-18+look,-31+bob]],'#b4cfc9','#2f5365',1.5);
      poly(ctx,[[-13+look,-48+bob],[look,-56+bob],[14+look,-46+bob],[10+look,-31+bob],[look,-26+bob],[-10+look,-33+bob]],'#456b80');path(ctx,[[-9+look,-48+bob],[look,-54+bob],[9+look,-48+bob]],'#e7e6c9',1.5);
      ctx.fillStyle='#b5f2e0';ctx.fillRect(look-11,-43+bob,7,3);ctx.fillRect(look+5,-43+bob,7,3);path(ctx,[[look,-51+bob],[look,-33+bob]],'#a8c9c2',2);
      for(let i=-2;i<=2;i++){poly(ctx,[[i*9-5,-58+bob],[i*11,-74-(i===0?7:0)+bob],[i*9+4,-58+bob]],'#b6d0c2','#446b7a',1);path(ctx,[[i*10,-66+bob],[i*9,-61+bob]],'#e4e8cb',1);}
      path(ctx,[[39,25],[39,-45]],'#b9c4a1',4);ctx.strokeStyle='#b9c4a1';ctx.lineWidth=4;ctx.beginPath();ctx.arc(39,-48,10,Math.PI*.8,Math.PI*2.6);ctx.stroke();poly(ctx,[[39,-57],[45,-47],[39,-38],[33,-47]],'#a1e0dc','#f0edd2',1);
      poly(ctx,[[-32,1+bob],[-24,-4+bob],[-19,3+bob],[-25,8+bob]],'#b9d3c3');poly(ctx,[[0,-20+bob],[6,-12+bob],[0,-5+bob],[-6,-12+bob]],'#d4dbc0','#608ba0',1);
    }
  }
  regent(ctx,enemy,time) {
    const bob=this.reducedMotion.matches?0:Math.sin(time/310),wind=enemy.action==='windup'?-9:enemy.action==='attack'?5:0,look=Math.cos(enemy.attackFacing??enemy.facing??0)*3;
    ellipse(ctx,0,31,41,11,'#241f2588');poly(ctx,[[-22,-32],[23,-32],[35,26],[19,35],[1,29],[-18,36],[-36,25]],'#713c3b','#3b2d30',1.5);path(ctx,[[-25,7],[-29,26]],'#bd805b',2);path(ctx,[[26,6],[30,26]],'#bd805b',2);
    for(const x of[-24,9]){ctx.fillStyle='#55463a';ctx.fillRect(x,16,17,20);ctx.fillStyle='#b08c5b';ctx.fillRect(x-2,29,21,6);path(ctx,[[x+2,21],[x+13,21]],'#d8b37a',1);}
    poly(ctx,[[-28,-34],[24,-34],[34,12],[16,23],[-18,23],[-34,10]],'#a17651','#3b3030',2);poly(ctx,[[-21,-27],[17,-27],[23,8],[12,14],[-16,14],[-25,4]],'#534039','#d6b27c',1.5);
    poly(ctx,[[-13,-25],[13,-25],[18,2],[9,11],[-10,11],[-18,1]],'#2f3031');for(let i=-2;i<=2;i++){path(ctx,[[i*6,-18],[i*6,2]],'#dc9558',4);path(ctx,[[i*6,-12],[i*6,-3]],i%2?'#f6cb8c':'#eeb16d',2);}path(ctx,[[-19,-6],[20,-6]],'#786148',2);
    poly(ctx,[[-36,-26+wind],[-25,-34+wind],[-18,-24+wind],[-24,4+wind],[-38,12+wind],[-45,-2+wind]],'#b58a5e','#45352f',1.5);poly(ctx,[[25,-34],[40,-26],[45,1],[36,12],[22,5],[17,-19]],'#b58a5e','#45352f',1.5);
    path(ctx,[[-38,-17+wind],[-29,-20+wind]],'#e1bd84',2);path(ctx,[[27,-23],[36,-18]],'#e1bd84',2);
    // A heavy engraved hammer makes the regent's silhouette different from the stone keeper.
    path(ctx,[[-37,15+wind],[-37,-25+wind]],'#88694a',5);poly(ctx,[[-51,-32+wind],[-25,-32+wind],[-22,-17+wind],[-52,-17+wind]],'#645541','#e4bc7d',1.5);path(ctx,[[-45,-28+wind],[-43,-21+wind],[-35,-21+wind],[-33,-28+wind]],'#ba8b53',1.5);
    poly(ctx,[[look-22,-47+bob],[look-13,-60+bob],[look+13,-60+bob],[look+22,-47+bob],[look+17,-27],[look-17,-27]],'#b3895e','#44352c',1.5);poly(ctx,[[look-15,-46+bob],[look+14,-46+bob],[look+13,-34],[look-13,-34]],'#473338');ctx.fillStyle='#ffdda1';ctx.fillRect(look-11,-42+bob,7,3);ctx.fillRect(look+5,-42+bob,7,3);path(ctx,[[look,-54+bob],[look,-30]],'#d1ab73',3);
    for(let i=-2;i<=2;i++){poly(ctx,[[i*10-5,-56+bob],[i*10,-72-(i===0?10:0)+bob],[i*10+5,-56+bob]],'#d6aa6e','#684c35',1);path(ctx,[[i*10,-65+bob],[i*10,-59+bob]],'#f0cf8d',1);}
    poly(ctx,[[-20,-33],[-13,-26],[-20,-17],[-27,-25]],'#dcab6c','#674a36',1);poly(ctx,[[20,-33],[27,-25],[20,-17],[13,-26]],'#dcab6c','#674a36',1);
    if(enemy.action==='windup'){ctx.save();ctx.globalAlpha=.18;ellipse(ctx,0,-6,22,24,'#ffc982');ctx.restore();}
  }

  arrow(ctx, x, y, angle, color = '#e9e0ba', length = 25) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    path(ctx, [[-length / 2, 0], [length / 2 - 3, 0]], '#a08861', 2);
    poly(ctx, [[length / 2 + 2, 0], [length / 2 - 5, -3], [length / 2 - 3, 0], [length / 2 - 5, 3]], color);
    path(ctx, [[-length / 2 + 5, 0], [-length / 2, -3]], color, 1.5); path(ctx, [[-length / 2 + 5, 0], [-length / 2, 3]], color, 1.5);
    ctx.restore();
  }

  projectile(ctx, p, time) {
    const angle = p.angle ?? p.facing ?? Math.atan2(p.vy || 0, p.vx || 1);
    if (p.kind === 'orb') {
      ctx.save();
      const color = p.reflected ? '#c5f4b1' : this.currentBiome==='crypt'?'#a6d4d6':this.currentBiome==='ember'?'#f1b47e':'#e3c295';
      for(let i=3;i>0;i--){ctx.globalAlpha=.05+(3-i)*.04;ellipse(ctx,p.x-Math.cos(angle)*i*7,p.y-Math.sin(angle)*i*7,5-i,5-i,color);}
      ctx.globalAlpha = 0.12; circle(ctx, p.x, p.y, 12, color);
      ctx.globalAlpha = 0.35; circle(ctx, p.x, p.y, 7 + (this.reducedMotion.matches?0:Math.sin(time / 70) * 0.5), color);
      ctx.globalAlpha = 1;poly(ctx,[[p.x,p.y-5],[p.x+5,p.y],[p.x,p.y+5],[p.x-5,p.y]],color);circle(ctx,p.x-1,p.y-1,2,'#fff5cf');
      ctx.restore();
    } else {
      ctx.save(); ctx.globalAlpha = 0.14;
      path(ctx, [[p.x - Math.cos(angle) * 30, p.y - Math.sin(angle) * 30], [p.x, p.y]], p.reflected ? '#c5f4b1' : '#fff0c0', 2);
      ctx.restore(); this.arrow(ctx, p.x, p.y, angle, p.reflected ? '#c5f4b1' : '#e7dfb8');
    }
  }

  effects(ctx, dt) {
    if(this.reducedMotion.matches){this.rings=[];this.particles=[];this.ghosts=[];return;}
    if(this.rings.length>48)this.rings.splice(0,this.rings.length-48);
    if(this.ghosts.length>32)this.ghosts.splice(0,this.ghosts.length-32);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    this.rings = this.rings.filter(r => {
      r.life -= dt; if (r.life <= 0) return false;
      const t = 1 - r.life / r.maxLife;
      ctx.strokeStyle = r.color; ctx.globalAlpha = (1 - t) * 0.75; ctx.lineWidth = 1.4 - t * 0.6;
      ctx.beginPath(); ctx.arc(r.x, r.y, 2 + ease(t) * r.size, 0, Math.PI * 2); ctx.stroke(); return true;
    });
    this.particles = this.particles.filter(p => {
      p.life -= dt; if (p.life <= 0) return false;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.exp(-dt * 3.5); p.vy *= Math.exp(-dt * 2.4);
      const t = p.life / p.maxLife;
      ctx.globalAlpha = Math.min(1, t * 1.4) * (p.spark ? 1 : 0.4);
      if (p.spark) path(ctx, [[p.x, p.y], [p.x - p.vx * 0.035 * t, p.y - p.vy * 0.035 * t]], p.color, p.size * t + 0.3);
      else { ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size * (2 - t), p.size * 0.5); }
      return true;
    });
    if (this.particles.length > 220) this.particles.splice(0, this.particles.length - 220);
    ctx.restore();
  }

  motes(ctx, time) {
    ctx.save();
    for (let i = 0; i < 19; i++) {
      const x = (time * (0.003 + i % 3 * 0.001) + i * 157) % 898 + 31;
      const y = 62 + ((i * 113 + time * 0.002) % 496) + Math.sin(time / 1200 + i) * 5;
      ctx.globalAlpha = 0.10 + Math.sin(time / 700 + i) * 0.06;
      ctx.fillStyle = i % 4 ? '#e9e8bb' : '#d5f2ce'; ctx.fillRect(x, y, 1.5, 1.5);
    }
    ctx.restore();
  }
}
