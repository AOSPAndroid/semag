/** Cosmetic joints in local metres. Heads and authoritative bodies never move. */
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const styles = Object.freeze({
  stalker: [.082, .100, .074], runner: [.102, .126, .118], brute: [.064, .078, .052],
  gunner: [.082, .105, .025], sniper: [.070, .085, .021], leaper: [.097, .123, .112],
  screecher: [.069, .083, .062], bomber: [.088, .112, .082],
  spitter: [.073, .091, .057], weaver: [.065, .076, .047],
});

/** A crouched takeoff, bent knees and softly weighted body replace sliding poles. */
export function monsterLocomotionPose(player, animation = {}) {
  const alive = player?.alive !== false, type = player?.monsterType;
  const stride = alive ? clamp(finite(animation.stride), 0, 1) : 0;
  const airborne = alive && (animation.airborne === true || player?.grounded === false);
  const phase = finite(animation.phase), land = alive && !airborne ? clamp(finite(animation.land), 0, 1) : 0;
  const jump = airborne ? clamp(finite(animation.jump, finite(player?.vy) / 6.4), 0, 1) : 0;
  const fall = airborne ? clamp(finite(animation.fall, -finite(player?.vy) / 8), 0, 1) : 0;
  const forward = clamp(finite(animation.forward, 1), -1, 1), strafe = clamp(finite(animation.strafe), -1, 1);
  const active = stride > .00001 || airborne || land > .00001;
  const bodyBob = airborne ? 0 : -(1 - Math.cos(phase * 2)) * stride * (type === 'hound' ? .003 : .007) - land * (type === 'hound' ? .003 : .010);
  if (type === 'hound') {
    // Diagonal paws trot together. Their compact swing remains inside the four
    // real paw boxes; motion never adds an unhittable tail or floating muzzle.
    const paws = [];
    for (const side of [-1, 1]) for (const end of [-1, 1]) {
      const offset = side === end ? 0 : Math.PI, swing = Math.sin(phase + offset);
      const raised = Math.max(0, Math.cos(phase + offset));
      const lift = airborne ? .038 + jump * .030 : raised ** 1.4 * stride * .082;
      const travel = airborne ? -.014 * jump : swing * stride * .034;
      const x = side * .13, z = end < 0 ? -.19 : .21;
      paws.push({ hip: [x, .300 + bodyBob, z], knee: [x, .175 + lift * .48, z + travel * .35],
        ankle: [x, .063 + lift, z + travel], foot: [x, .006 + lift, z + travel] });
    }
    return { active, phase, stride, airborne, land, bodyBob, paws, legs: [], arms: [] };
  }
  const style = styles[type] || styles.stalker, armed = type === 'gunner' || type === 'sniper';
  const charging = ['windup', 'lungeWindup', 'bomberFuse', 'spitting', 'weaving'].includes(player?.monsterState);
  const charge = charging ? clamp(1 - finite(player.attackTicks) / Math.max(1, finite(player.attackDuration, 1)), 0, 1) : 0;
  const roar = player?.monsterState === 'roar' ? clamp(1 - finite(player.roarTicks) / Math.max(1, finite(player.roarDuration, 1)), 0, 1) : 0;
  const crouch = type === 'leaper' ? charge * .055 + (player?.monsterState === 'leap' ? .035 : 0) : 0;
  const hipY = (['bomber', 'spitter', 'weaver'].includes(type) ? .560 : .795) + bodyBob - crouch;
  const legs = [-1, 1].map((side, index) => {
    const swing = Math.sin(phase + index * Math.PI), raised = Math.max(0, Math.cos(phase + index * Math.PI));
    const lift = airborne ? .055 + jump * .060 + fall * .015 : raised ** 1.4 * stride * style[1];
    const travel = airborne ? -.020 * jump : swing * stride * style[0];
    const x = side * (['leaper', 'screecher'].includes(type) ? .130 : .140);
    const foot = [x + strafe * travel * .15, .018 + lift, -.010 - forward * travel];
    const hip = [x, hipY, .012];
    const knee = [x + strafe * travel * .08, (hipY > .7 ? .440 : .335) + lift * .52 + bodyBob * .5 - land * .008,
      -.015 - forward * travel * .27 - lift * .40];
    return { hip, knee, ankle: [foot[0], foot[1] + .135, foot[2] + .012], foot, lift };
  });
  const arms = [-1, 1].map((side, index) => {
    // Armed monsters keep both palms on the existing weapon attachment. The
    // elbows absorb the gait instead of waving a detached firearm around.
    const swing = Math.sin(phase + index * Math.PI + Math.PI) * stride * style[2] * (1 - charge * .8 - roar * .7);
    const lift = armed ? .09 : charge * (type === 'leaper' ? .23 : .20) + roar * .14 + (type === 'leaper' && airborne ? .12 : 0);
    const shoulder = [side * .210, 1.225 + Math.min(.16, lift) + bodyBob, -.024];
    const elbow = [side * .208, 1.020 + lift + bodyBob + Math.max(0, -swing) * .45, -.020 + swing * .40];
    const hand = armed ? [side < 0 ? .063 : .120, 1.245, side < 0 ? -.210 : -.180]
      : [side * .190, (type === 'leaper' || type === 'screecher' ? .635 : .835) + lift + bodyBob + Math.max(0, -swing) * .7, clamp(-.050 + swing, -.135, .080)];
    return { shoulder, elbow, hand };
  });
  return { active, phase, stride, airborne, land, bodyBob, legs, arms, paws: [] };
}

/** Reusable cuboid between two joints; no mesh templates or per-vertex objects. */
export function appendMonsterLimb(mesh, pose, a, b, width, depth, color) {
  const c = Math.cos(pose.yaw), s = Math.sin(pose.yaw), dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const wx = c * dx - s * dz, wz = s * dx + c * dz, horizontal = Math.hypot(wx, wz);
  mesh.box(-width / 2, 0, -depth / 2, width, Math.hypot(horizontal, dy), depth, color, {
    x: pose.x + c * a[0] - s * a[2], y: pose.y + a[1], z: pose.z + s * a[0] + c * a[2],
    yaw: horizontal > 1e-7 ? Math.atan2(-wx, wz) : pose.yaw, pitch: Math.atan2(horizontal, dy),
  });
}
