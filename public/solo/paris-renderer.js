import { ROAD_HALF, BIKE_WIDTH, BIKE_LENGTH, DISTRICTS, MAX_TRAFFIC } from './paris-engine.js';

// A metre stays a metre in every layer: the road, tyre contact, shadows, and
// signalled envelopes share this projection. The camera never changes physics.
const W = 720, H = 520, HORIZON_Y = 160, RIDER_Y = 458;
const DEPTH = 18, METRE = 49, FAR = 100, NEAR = -3.1;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const mod = (n, d) => ((n % d) + d) % d;
const COLORS = ['#dfb668', '#bf6b5a', '#85a5a4', '#d5d6ce', '#888f9c', '#a58799'];
const WALL_COLORS = ['#decdb1', '#e4d1b9', '#d7c6ac', '#d9d1ba', '#ddc6be'];

export function createParisRenderer(ctx, { sprites, reducedMotion = false } = {}) {
  // Reused bounded lists; continuous positions never become sprite cache keys.
  const actors = [], warnings = [];
  const warningLabels = Array.from({ length: 4 }, () => ({ x: 0, y: 0, width: 0 }));
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON_Y + 45);
  sky.addColorStop(0, '#93c5ce'); sky.addColorStop(0.68, '#c9dbd4'); sky.addColorStop(1, '#efe4cb');
  const asphalt = ctx.createLinearGradient(0, HORIZON_Y, 0, H);
  asphalt.addColorStop(0, '#969a8a'); asphalt.addColorStop(0.35, '#737b71'); asphalt.addColorStop(1, '#596560');
  let state = null, actorFar = FAR, warningFar = 45, survival = false;

  const scale = z => DEPTH / (DEPTH + Math.max(NEAR, z));
  const py = z => HORIZON_Y + (RIDER_Y - HORIZON_Y) * scale(z);
  const px = (x, z) => W / 2 + x * METRE * scale(z);
  const vertical = (height, z) => height * METRE * scale(z);
  const motionReduced = () => typeof reducedMotion === 'object' ? reducedMotion.matches === true : reducedMotion === true;
  function rect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
  }
  function quad(ax, ay, bx, by, cx, cy, dx, dy, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
    ctx.lineTo(cx, cy); ctx.lineTo(dx, dy); ctx.closePath(); ctx.fill();
  }
  function strip(x1, x2, near, far, color) {
    quad(px(x1, far), py(far), px(x2, far), py(far), px(x2, near), py(near), px(x1, near), py(near), color);
  }
  function label(value, x, y, color, size = 10) {
    ctx.font = `bold ${size}px ui-monospace, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#173d3bdd'; ctx.fillRect(Math.round(x - ctx.measureText(value).width / 2 - 6), Math.round(y - 9), Math.ceil(ctx.measureText(value).width + 12), 18);
    ctx.fillStyle = color; ctx.fillText(value, Math.round(x), Math.round(y + 1));
  }

  function background(district) {
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // Stable daylight clouds, kept behind the distant Paris silhouette.
    for (let i = 0; i < 5; i++) {
      const x = mod(i * 167 + district * 43, 790) - 55;
      const y = 28 + (i % 3) * 23;
      rect(x + 15, y, 59, 8, '#eef0dabb'); rect(x, y + 8, 102, 10, '#eef0dabb');
      rect(x + 8, y + 18, 79, 5, '#e3ead8aa');
    }
    const silhouette = sprites?.skyline?.(district);
    if (silhouette) ctx.drawImage(silhouette, -5 - state.x * 0.6, HORIZON_Y - 141, W + 10, 150);
    else {
      for (let i = 0; i < 20; i++) {
        const height = 24 + (i * 17 % 42);
        rect(i * 39 - 12, HORIZON_Y - height, 44, height + 12, '#aaa995');
      }
    }
    // A bridge exposes open water; the other quartiers form a street canyon.
    rect(0, HORIZON_Y + 6, W, H - HORIZON_Y, district === 3 ? '#94afa6' : '#c4bda5');
    if (district === 3) {
      for (let i = 0; i < 22; i++) {
        const z = 3 + i * 5, y = py(z), p = scale(z);
        rect(15 + (i * 41 % 78), y, 78 * p + 6, Math.max(1, p * 2), '#d0d9ba88');
        rect(W - 125 - (i * 29 % 67), y + 7, 87 * p + 6, Math.max(1, p * 2), '#c4d3c199');
      }
    }
  }

  function road(district) {
    strip(-ROAD_HALF - 1.55, ROAD_HALF + 1.55, NEAR, 3000, district === 3 ? '#cec6ad' : '#d7ceb6');
    // Broad, quiet asphalt and a true vanishing point, with no HUD across gaps.
    quad(W / 2 - 1, HORIZON_Y, W / 2 + 1, HORIZON_Y,
      px(ROAD_HALF, NEAR), H + 2, px(-ROAD_HALF, NEAR), H + 2, asphalt);
    strip(-5.12, -5, NEAR, 3000, '#ede1be'); strip(5, 5.12, NEAR, 3000, '#ede1be');
    strip(-4.99, -4.84, NEAR, FAR, '#485b4c'); strip(4.84, 4.99, NEAR, FAR, '#485b4c');
    // World-anchored marks flow toward the rider instead of resizing in place.
    const first = Math.floor((state.distance + NEAR) / 10) * 10;
    for (let i = 0; i < 12; i++) {
      const z = first + i * 10 - state.distance;
      const near = Math.max(NEAR, z), far = Math.min(FAR, z + 4.2);
      if (near >= far || far < NEAR || near > FAR) continue;
      for (const x of [-2.625, -0.875, 0.875, 2.625]) strip(x - 0.035, x + 0.035, near, far, '#d6d1af99');
    }
    // Crossings and gutter stones give speed cues without a field of particles.
    const crossing = Math.floor((state.distance + 38) / 95) * 95 + 55 - state.distance;
    if (crossing > NEAR && crossing < FAR) {
      const near = Math.max(NEAR, crossing), far = Math.min(FAR, crossing + 2.4);
      for (let x = -4.5; x < 4.6; x += 1.2) strip(x, x + 0.58, near, far, '#ded9b3b0');
    }
    for (let i = 0; i < 18; i++) {
      const z = mod(i * 7 - state.distance, 116) - 3;
      const y = py(z), p = scale(z), x = ((i * 37 % 83) / 10 - 4.15);
      rect(px(x, z), y, 5 * p + 1, 1.3 * p, '#cad1b01b');
    }
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 18; i++) {
        const z = mod(i * 6 - state.distance, 108);
        strip(side * 5.18, side * 5.63, Math.max(NEAR, z), Math.min(FAR, z + 0.20), '#a99d83');
      }
    }
  }

  // Map a facade into two triangles. This keeps its bottom and roof in the same
  // projection as the pavement and avoids flat billboards along the roadway.
  function texturedFacade(image, side, near, far, height) {
    const x = side * 7.45;
    const ax = px(x, near), ay = py(near) - vertical(height, near);
    const bx = px(x, far), by = py(far) - vertical(height, far);
    const cx = bx, cy = py(far), dx = ax, dy = py(near);
    const iw = image.width, ih = image.height;
    ctx.save(); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(dx, dy); ctx.closePath(); ctx.clip();
    ctx.transform((bx - ax) / iw, (by - ay) / iw, (dx - ax) / ih, (dy - ay) / ih, ax, ay);
    ctx.drawImage(image, 0, 0); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(cx, cy); ctx.lineTo(dx, dy); ctx.closePath(); ctx.clip();
    const a = (cx - dx) / iw, b = (cy - dy) / iw, c = (cx - bx) / ih, d = (cy - by) / ih;
    ctx.transform(a, b, c, d, bx - a * iw, by - b * iw); ctx.drawImage(image, 0, 0); ctx.restore();
    // Cornice and the thin stone corner prevent neighboring walls blending.
    ctx.strokeStyle = '#6d7361'; ctx.lineWidth = Math.max(1, 1.5 * scale(near));
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.stroke();
  }
  function scenery(district) {
    const base = Math.floor(state.distance / 13) * 13;
    for (let i = 8; i >= -1; i--) {
      const near = base + i * 13 - state.distance, far = near + 12.8;
      if (far < -1 || near > 108) continue;
      for (let side = -1; side <= 1; side += 2) {
        const block = Math.floor((base + i * 13) / 13), variant = mod(block + (side > 0 ? 2 : 0), 4);
        if (district !== 3) {
          const kind = mod(block + side, 5) === 0 ? 'cafe' : mod(block, 4) === 0 ? 'shop' : 'haussmann';
          const facade = sprites?.facade?.(kind, variant);
          const safeNear = Math.max(NEAR, near), safeFar = Math.max(safeNear + 0.1, far);
          const height = district === 4 ? 8.0 + variant * 0.8 : 10.3 + variant * 0.55;
          if (facade) texturedFacade(facade, side, safeNear, safeFar, height);
          else quad(px(side * 7.45, safeNear), py(safeNear) - vertical(height, safeNear),
            px(side * 7.45, safeFar), py(safeFar) - vertical(height, safeFar),
            px(side * 7.45, safeFar), py(safeFar), px(side * 7.45, safeNear), py(safeNear), WALL_COLORS[district]);
        }
        const z = near + 8;
        if (z < 1 || z > 100) continue;
        if (district === 3) {
          // Stone bridge piers and dark railings run along the open Seine view.
          const p = scale(z), x = px(side * 6.0, z), y = py(z);
          rect(x - 5 * p, y - 36 * p, 10 * p, 38 * p, '#d1c7aa');
          rect(x - 7 * p, y - 39 * p, 14 * p, 5 * p, '#f1dfb4');
        } else {
          const tree = sprites?.tree?.();
          if (tree && mod(block, 3) === 0) {
            const height = vertical(3.9, z), width = height * tree.width / tree.height;
            ctx.drawImage(tree, px(side * 6.25, z) - width / 2, py(z) - height, width, height);
          }
          if (mod(block, 7) === 2 && side === -1) {
            const metro = sprites?.metro?.();
            if (metro) {
              const height = vertical(2.8, z), width = height * metro.width / metro.height;
              ctx.drawImage(metro, px(-6.2, z) - width / 2, py(z) - height, width, height);
            }
          }
        }
        // Slender Paris street lamps: two-tone iron, simple daytime lantern.
        if (mod(block, 2) === 0) {
          const p = scale(z), x = px(side * 5.95, z), y = py(z), top = y - vertical(4.0, z);
          rect(x - p, top, 2 * p, y - top, '#4b675d');
          rect(x - 5 * p, top - 7 * p, 10 * p, 11 * p, '#647a67');
          rect(x - 3 * p, top - 5 * p, 6 * p, 6 * p, '#f8d9a0');
          rect(x - 6 * p, top - 9 * p, 12 * p, 3 * p, '#35544f');
        }
      }
    }
    if (district === 3) {
      for (const side of [-1, 1]) {
        const x = side * 6.0;
        quad(px(x - 0.025, FAR), py(FAR) - vertical(0.75, FAR), px(x + 0.025, FAR), py(FAR) - vertical(0.75, FAR),
          px(x + 0.025, NEAR), py(NEAR) - vertical(0.75, NEAR), px(x - 0.025, NEAR), py(NEAR) - vertical(0.75, NEAR), '#59786a');
      }
    }
  }

  function footprint(actor, color = '#203b3442', inset = 0) {
    if (!actorVisible(actor)) return;
    const z = actor.z - state.distance, rear = Math.max(NEAR, z - actor.length / 2), front = Math.max(NEAR, z + actor.length / 2);
    const half = Math.max(0.02, actor.width / 2 - inset);
    strip(actor.x - half, actor.x + half, rear, front, color);
  }
  function actorDepth(actor) { return actor.z - actor.length / 2; }
  function actorVisible(actor) {
    const relative = actor.z - state.distance;
    return relative + actor.length / 2 >= NEAR && relative - actor.length / 2 <= actorFar;
  }
  function actorBody(actor) {
    const z = actor.z - state.distance, actualRear = z - actor.length / 2, front = z + actor.length / 2;
    // A bus can extend from below the canvas to several metres ahead. Clip its
    // visible roof/side at the bottom plane instead of dropping the whole bus.
    const rear = Math.max(NEAR, actualRear);
    if (!actorVisible(actor)) return;
    const p = scale(rear), x = px(actor.x, rear), ground = py(rear), width = actor.width * METRE * p;
    const variant = Math.max(0, COLORS.indexOf(actor.color));
    if (actor.crashed) ctx.globalAlpha = 0.58;
    if (actor.kind === 'barrier') {
      const height = vertical(0.9, rear);
      rect(x - width / 2, ground - height, width, height, '#e0a857');
      ctx.save(); ctx.beginPath(); ctx.rect(x - width / 2, ground - height, width, height * 0.75); ctx.clip();
      ctx.strokeStyle = '#f7e5ba'; ctx.lineWidth = Math.max(2, 8 * p);
      for (let i = -3; i < 12; i++) {
        ctx.beginPath(); ctx.moveTo(x - width / 2 + i * 14 * p, ground); ctx.lineTo(x - width / 2 + (i + 3) * 14 * p, ground - height); ctx.stroke();
      }
      ctx.restore(); rect(x - width * 0.38, ground - height * 0.1, width * 0.12, height * 0.12, '#655c46');
      rect(x + width * 0.26, ground - height * 0.1, width * 0.12, height * 0.12, '#655c46');
    } else if (actor.kind === 'door') {
      const side = Math.sign(actor.x) || 1;
      const outer = actor.x + side * actor.width / 2;
      const bodyCenter = outer - side * 0.55;
      const bodyWidth = 1.1 * METRE * p, height = vertical(1.45, rear);
      const image = sprites?.rearCar?.(3);
      if (image) ctx.drawImage(image, 4, 0, 64, 83, px(bodyCenter, rear) - bodyWidth / 2, ground - height, bodyWidth, height);
      else rect(px(bodyCenter, rear) - bodyWidth / 2, ground - height, bodyWidth, height, '#aa9a7e');
      const extension = Math.max(0, actor.width - 1.1);
      if (extension > 0.015) {
        // A hinged door grows only as far as the current occupied engine width.
        const hingeX = outer - side * 1.1, edgeX = outer - side * actor.width;
        const hinge = px(hingeX, rear), edge = px(edgeX, rear + 0.5);
        quad(hinge, ground - height * 0.8, edge, py(rear + 0.5) - height * 0.58,
          edge, py(rear + 0.5) - height * 0.14, hinge, ground - height * 0.12, '#bfa987');
        ctx.strokeStyle = '#f6cf7a'; ctx.lineWidth = Math.max(1.5, 2.5 * p); ctx.beginPath();
        ctx.moveTo(hinge, ground - height * 0.8); ctx.lineTo(edge, py(rear + 0.5) - height * 0.58);
        ctx.lineTo(edge, py(rear + 0.5) - height * 0.14); ctx.stroke();
        rect(edge - 2 * p, py(rear + 0.5) - height * 0.5, 4 * p, 12 * p, '#d67347');
      }
    } else if (actor.kind === 'cyclist') {
      const image = sprites?.rearCyclist?.(variant % 4), height = vertical(1.73, rear);
      if (image) ctx.drawImage(image, 4, 0, 32, image.height, x - width / 2, ground - height, width, height);
      else rect(x - width / 3, ground - height, width * 2 / 3, height, actor.color);
    } else {
      const bus = actor.kind === 'bus', heightM = bus ? 2.7 : 1.45;
      const height = vertical(heightM, rear), farHeight = vertical(heightM, front);
      const leftNear = px(actor.x - actor.width / 2, rear), rightNear = px(actor.x + actor.width / 2, rear);
      const leftFar = px(actor.x - actor.width / 2, front), rightFar = px(actor.x + actor.width / 2, front);
      // The roof and side continue to the front of the real wheelbase. Long
      // buses therefore occupy depth, rather than looking like narrow cards.
      quad(leftNear, ground - height * 0.73, leftFar, py(front) - farHeight * 0.73,
        rightFar, py(front) - farHeight * 0.73, rightNear, ground - height * 0.73, bus ? '#becbb2' : actor.color);
      const side = actor.x >= state.x ? -1 : 1;
      const nearSide = side < 0 ? leftNear : rightNear, farSide = side < 0 ? leftFar : rightFar;
      quad(nearSide, ground, farSide, py(front), farSide, py(front) - farHeight * 0.73,
        nearSide, ground - height * 0.73, bus ? '#577e70' : '#677d71');
      if (bus) {
        for (let i = 0; i < 5; i++) {
          const za = rear + 0.8 + i * 1.4, zb = Math.min(front - 0.3, za + 1.03);
          if (za >= front || zb <= za) continue;
          const worldX = actor.x + side * actor.width / 2;
          quad(px(worldX, za), py(za) - vertical(1.93, za), px(worldX, zb), py(zb) - vertical(1.93, zb),
            px(worldX, zb), py(zb) - vertical(1.05, zb), px(worldX, za), py(za) - vertical(1.05, za), '#43675f');
        }
      }
      const image = bus ? sprites?.rearBus?.() : sprites?.rearCar?.(variant);
      if (actualRear >= NEAR) {
        if (image) ctx.drawImage(image, 4, 0, bus ? 68 : 64, bus ? 115 : 83, x - width / 2, ground - height, width, height);
        else rect(x - width / 2, ground - height, width, height, actor.color);
      }
      // Real turn lamps remain distinct from the projected intent arrow.
      if (actor.turnSignal && (motionReduced() || Math.floor(state.elapsed * 3) % 2 === 0)) {
        const direction = actor.turnSignal < 0 ? -1 : 1;
        rect(x + direction * width * 0.34 - width * 0.055, ground - height * 0.31, width * 0.11, height * 0.08, '#ffce6c');
      }
    }
    ctx.globalAlpha = 1;
  }

  function intent(actor, index) {
    const relative = actor.z - state.distance, rear = relative - actor.length / 2;
    if (!actorVisible(actor) || relative < -2 || rear > warningFar) return;
    const door = actor.kind === 'door', color = door ? '#ffad69' : '#f9d581';
    const targetX = Number.isFinite(actor.targetX) ? actor.targetX : actor.x;
    const futureWidth = door ? Math.max(actor.width, actor.targetWidth || actor.width) : actor.width;
    const envelopeLeft = Math.min(actor.x - actor.width / 2, targetX - futureWidth / 2);
    const envelopeRight = Math.max(actor.x + actor.width / 2, targetX + futureWidth / 2);
    const near = Math.max(NEAR, rear), far = Math.min(actorFar, relative + actor.length / 2);
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, 2.6 * scale(near));
    ctx.setLineDash([4, 4]); ctx.beginPath();
    ctx.moveTo(px(envelopeLeft, near), py(near)); ctx.lineTo(px(envelopeRight, near), py(near));
    ctx.lineTo(px(envelopeRight, far), py(far)); ctx.lineTo(px(envelopeLeft, far), py(far)); ctx.closePath(); ctx.stroke();
    ctx.setLineDash([]);
    const baseZ = Math.max(0, relative), y = py(baseZ) + 6;
    const from = px(actor.x, baseZ), to = px(targetX, baseZ);
    if (Math.abs(to - from) > 2) {
      const direction = Math.sign(to - from);
      ctx.beginPath(); ctx.moveTo(from, y); ctx.lineTo(to, y); ctx.lineTo(to - direction * 6, y - 5);
      ctx.moveTo(to, y); ctx.lineTo(to - direction * 6, y + 5); ctx.stroke();
    }
    ctx.restore();
    // Final overlay pass keeps the warning readable beside a bus or roof.
    const actorHeight = actor.kind === 'bus' ? 2.7 : actor.kind === 'cyclist' ? 1.73 : 1.45;
    const labelY = clamp(py(Math.max(NEAR, rear)) - vertical(actorHeight, Math.max(NEAR, rear)) - 11 - (index % 2) * 2, 178, 475);
    const position = warningLabels[index];
    label(door ? 'DOOR' : actor.kind === 'cyclist' ? 'DRIFT' : 'MERGE', survival ? position.x : clamp(px(actor.x, baseZ), 48, W - 48), survival ? position.y : labelY, color, Math.max(9, Math.min(11, 11 * scale(baseZ) + 3)));
  }
  function layoutWarningLabels() {
    for (let i = 0; i < warnings.length; i++) {
      const actor = warnings[i], relative = actor.z - state.distance, rear = relative - actor.length / 2;
      const height = actor.kind === 'bus' ? 2.7 : actor.kind === 'cyclist' ? 1.73 : 1.45;
      const position = warningLabels[i];
      position.x = clamp(px(actor.x, Math.max(0, relative)), 48, W - 48);
      position.y = clamp(py(Math.max(NEAR, rear)) - vertical(height, Math.max(NEAR, rear)) - 11 - (i % 2) * 2, 178, 475);
      ctx.font = `bold ${Math.max(9, Math.min(11, 11 * scale(Math.max(0, relative)) + 3))}px ui-monospace, monospace`;
      position.width = ctx.measureText(actor.kind === 'door' ? 'DOOR' : actor.kind === 'cyclist' ? 'DRIFT' : 'MERGE').width + 12;
      // At high pace several signalled actors converge near the horizon. Give
      // the nearest label its usual anchor and only shift overlapping distant
      // labels, using the same four reused slots as the warning cap.
      if (rear <= 45) continue;
      for (let attempt = 0; attempt < 4; attempt++) {
        let nextY = position.y;
        for (let j = 0; j < i; j++) {
          const previous = warningLabels[j];
          if (Math.abs(position.x - previous.x) < (position.width + previous.width) / 2 + 2 && Math.abs(position.y - previous.y) < 20) nextY = Math.max(nextY, previous.y + 20);
        }
        if (nextY === position.y) break;
        position.y = nextY;
      }
    }
  }
  function rider(bellPulseUntil) {
    const ground = py(-BIKE_LENGTH / 2), x = px(state.x, -BIKE_LENGTH / 2);
    const collisionWidth = BIKE_WIDTH * METRE * scale(-BIKE_LENGTH / 2);
    strip(state.x - BIKE_WIDTH / 2, state.x + BIKE_WIDTH / 2, -BIKE_LENGTH / 2, BIKE_LENGTH / 2, '#25413655');
    if (state.assistActive && !motionReduced()) {
      for (let i = 0; i < 3; i++) {
        const z = -1.4 - i * 0.4, y = py(z);
        rect(px(state.x - 0.18, z), y, 2, 6 + i * 3, '#fff1a3a0');
        rect(px(state.x + 0.18, z), y, 2, 6 + i * 3, '#fff1a3a0');
      }
    }
    const image = sprites?.rearCourier?.({
      pedal: motionReduced() ? 0 : state.elapsed * state.speed * 0.3,
      assist: state.assistActive === true, damaged: state.crashCooldown > 0,
    });
    const height = vertical(1.91, -BIKE_LENGTH / 2);
    // Transparent sprite margins accommodate a tall courier while the opaque
    // handlebar and shoulders fit the same physical width as the collision box.
    const width = image ? collisionWidth * image.width / 50 : collisionWidth;
    ctx.save(); ctx.translate(x, ground); ctx.rotate((state.lean || 0) * 0.045);
    if (image) ctx.drawImage(image, -width / 2, -height, width, height);
    else {
      rect(-collisionWidth * 0.4, -height * 0.76, collisionWidth * 0.8, height * 0.5, '#d37f48');
      rect(-collisionWidth * 0.2, -height, collisionWidth * 0.4, height * 0.25, '#f0dfba');
      rect(-3, -height * 0.30, 6, height * 0.30, '#23403a');
    }
    ctx.restore();
    if (state.elapsed < bellPulseUntil) {
      const progress = clamp(1 - (bellPulseUntil - state.elapsed) / 0.65, 0, 1);
      ctx.save(); ctx.strokeStyle = '#ffe8a4'; ctx.globalAlpha = 1 - progress; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, ground - height * 0.65, 18 + progress * 37, 9 + progress * 14, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); ctx.restore();
    }
  }

  return {
    draw(nextState, { bellPulseUntil = 0 } = {}) {
      state = nextState;
      if (!state) return;
      survival = state.mode === 'survival';
      warningFar = survival && Number.isFinite(state.warningDistance) ? Math.max(45, state.warningDistance) : 45;
      actorFar = survival ? Math.max(FAR, warningFar, Number.isFinite(state.lookAheadDistance) ? state.lookAheadDistance : FAR) : FAR;
      ctx.save(); ctx.imageSmoothingEnabled = false;
      const district = mod(state.stageIndex || 0, DISTRICTS.length);
      background(district); road(district); scenery(district);
      actors.length = 0; warnings.length = 0;
      for (const actor of state.traffic || []) {
        if (actors.length >= MAX_TRAFFIC) break;
        const relative = actor.z - state.distance;
        if (!actorVisible(actor)) continue;
        actors.push(actor);
        if (!actor.passed && relative >= -2 && relative - actor.length / 2 <= warningFar &&
          (actor.warningActive || !survival && actor.turnSignal || actor.kind === 'door' && actor.maneuverStarted)) warnings.push(actor);
      }
      actors.sort((a, b) => actorDepth(b) - actorDepth(a) || a.id - b.id);
      for (const actor of actors) footprint(actor);
      let riderDrawn = false;
      for (const actor of actors) {
        if (!riderDrawn && actorDepth(actor) - state.distance < -BIKE_LENGTH / 2) { rider(bellPulseUntil); riderDrawn = true; }
        actorBody(actor);
      }
      if (!riderDrawn) rider(bellPulseUntil);
      warnings.sort((a, b) => actorDepth(a) - actorDepth(b));
      if (warnings.length > 4) warnings.length = 4;
      if (survival) layoutWarningLabels();
      for (let i = warnings.length - 1; i >= 0; i--) intent(warnings[i], i);
      ctx.restore();
    },
    clear() { actors.length = 0; warnings.length = 0; state = null; },
  };
}
