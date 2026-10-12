/** Shared cosmetic gait helpers; these never alter movement or collision state. */
export function locomotionStride(speed) {
  return Number.isFinite(speed) && speed >= .05 ? Math.min(1, speed / 3) : 0;
}

/** Keep the complete animated boot inside the existing circular body envelope.
 * The stride can be expressive in every direction without drawing unhittable
 * toes through cover. Pads include the boot's small surface markings.
 */
export function footEnvelopeScale(x, z, halfWidth, halfDepth, radius = .29) {
  const xx = Math.abs(x), zz = Math.abs(z);
  if (Math.hypot(xx + halfWidth, zz + halfDepth) <= radius) return 1;
  const a = xx * xx + zz * zz, b = 2 * (xx * halfWidth + zz * halfDepth);
  const c = halfWidth * halfWidth + halfDepth * halfDepth - radius * radius;
  return a > 1e-12 ? Math.max(0, Math.min(1, (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a))) : 1;
}
