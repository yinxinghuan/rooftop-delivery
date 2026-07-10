export function roofImpact(velocity, angularVelocity, bounceCount, yawJitter = 0) {
  const impactSpeed = Math.abs(velocity.y)
  const nextBounceCount = bounceCount + 1
  const restitution = bounceCount === 0 ? 0.28 : 0.16
  const grounded = impactSpeed < 0.65 || nextBounceCount >= 3
  return {
    velocity: {
      x: velocity.x * 0.78,
      y: grounded ? 0 : impactSpeed * restitution,
      z: velocity.z * 0.78,
    },
    angularVelocity: {
      x: angularVelocity.x * 0.72 + velocity.z * 0.42,
      y: angularVelocity.y * 0.72 + yawJitter,
      z: angularVelocity.z * 0.72 - velocity.x * 0.52,
    },
    impactSpeed,
    bounceCount: nextBounceCount,
    grounded,
  }
}

export function groundFriction(velocity, angularVelocity, dt) {
  const slideDamping = Math.max(0, 1 - dt * 2.8)
  const angularDamping = Math.max(0, 1 - dt * 3.8)
  return {
    velocity: { x: velocity.x * slideDamping, y: 0, z: velocity.z * slideDamping },
    angularVelocity: {
      x: angularVelocity.x * angularDamping,
      y: angularVelocity.y * angularDamping,
      z: angularVelocity.z * angularDamping,
    },
  }
}
