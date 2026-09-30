import { groundFriction, roofImpact } from '../src/physics.js'

export const GRAVITY = 10.8
export const PACKAGE_START = { x: 0, y: 1.15, z: 2.6 }
export const LANDING_Y = 0.79
export const ROOF_TOP = 0.5

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export function glovesScale(rank) {
  return 1 + 0.05 * rank
}

export function windScale(rank) {
  return 1 - 0.16 * rank
}

export function zoneScale(rank) {
  return 1 + 0.06 * rank
}

export function tipScale(rank) {
  return 1 + 0.25 * rank
}

export function calmScale(rank) {
  return 1 - 0.2 * rank
}

export function steadyAmount(rank) {
  return 0.12 * rank
}

export function velocityFromAim(dx, dy, gloves = 0) {
  const power = clamp((dy - 24) / 156, 0, 1)
  const scale = glovesScale(gloves)
  return {
    power,
    x: clamp(dx, -120, 120) / 28.57,
    y: (5.5 + power * 2.8) * scale,
    z: -(6.2 + power * 4.8) * scale,
  }
}

function analyticTime(vy) {
  const disc = vy * vy + 7.776
  return (vy + Math.sqrt(Math.max(0, disc))) / 10.8
}

export function idealLateral(targetX, targetZ, wind, gloves, power) {
  const scale = glovesScale(gloves)
  const vy = (5.5 + power * 2.8) * scale
  const time = Math.max(0.2, analyticTime(vy))
  return (targetX - 0.5 * wind * time * time) / time
}

export function applySteady(vx, targetX, targetZ, wind, gloves, power, steady) {
  const amount = steadyAmount(steady)
  if (amount <= 0) return vx
  const ideal = idealLateral(targetX, targetZ, wind, gloves, power)
  return vx * (1 - amount) + ideal * amount
}

function yawJitter(x) {
  return Math.sin(x * 12.9898) * 0.2
}

function onRoof(x, z) {
  return Math.abs(x) <= 4.55 && z >= -18.25 && z <= -3.75
}

export function landingKind(x, z, targetX, targetZ, targetScale, secondaryTarget = null) {
  if (!onRoof(x, z)) return 'miss'
  const distance = Math.hypot(x - targetX, z - targetZ)
  if (distance <= 0.85 * targetScale) return 'bullseye'
  if (distance <= 1.7 * targetScale) return 'delivered'
  if (secondaryTarget) {
    const secondaryDistance = Math.hypot(x - secondaryTarget.x, z - secondaryTarget.z)
    if (secondaryDistance <= 1.45 * secondaryTarget.scale) return 'delivered'
  }
  return 'edge'
}

export function animalImpulse(velocity, config, direction) {
  return {
    x: velocity.x + direction * config.deflect,
    y: Math.max(0.2, velocity.y) + config.lift,
    z: velocity.z * 0.9,
  }
}

export function animalShouldInterfere(packagePosition, animalPosition, config) {
  const horizontal = Math.hypot(packagePosition.x - animalPosition.x, packagePosition.z - animalPosition.z)
  const relativeHeight = packagePosition.y - animalPosition.y
  return horizontal <= config.radius && relativeHeight >= 0.05 && relativeHeight <= config.height
}

export function createFlight(velocity) {
  return {
    x: PACKAGE_START.x,
    y: PACKAGE_START.y,
    z: PACKAGE_START.z,
    vx: velocity.x,
    vy: velocity.y,
    vz: velocity.z,
    ax: velocity.spinX ?? 0,
    ay: velocity.spinY ?? 0,
    az: velocity.spinZ ?? 0,
    bounceCount: 0,
    grounded: false,
    firstContact: 0,
    elapsed: 0,
    animalHit: false,
    done: false,
    kind: null,
  }
}

export function launchVelocity(dx, dy, wind, mods, targetX, targetZ) {
  const base = velocityFromAim(dx, dy, mods.gloves || 0)
  const power = base.power
  const vx = applySteady(base.x, targetX, targetZ, wind, mods.gloves || 0, power, mods.steady || 0)
  return {
    ...base,
    x: vx,
    spinX: 2.4 + power * 3.6,
    spinY: dx * 0.026,
    spinZ: 2.1 + Math.abs(dx) * 0.018,
    wind,
  }
}

// Fixed-step rooftop integration shared by the renderer and the playtest planner.
export function stepFlight(flight, dt, env) {
  if (flight.done || dt <= 0) return flight
  const step = Math.min(0.033, dt)
  flight.elapsed += step
  if (flight.grounded) {
    const next = groundFriction(
      { x: flight.vx, y: flight.vy, z: flight.vz },
      { x: flight.ax, y: flight.ay, z: flight.az },
      step,
    )
    flight.vx = next.velocity.x
    flight.vy = next.velocity.y
    flight.vz = next.velocity.z
    flight.ax = next.angularVelocity.x
    flight.ay = next.angularVelocity.y
    flight.az = next.angularVelocity.z
  } else {
    flight.vx += env.wind * step
    flight.vy -= GRAVITY * step
  }
  flight.x += flight.vx * step
  flight.y += flight.vy * step
  flight.z += flight.vz * step

  if (!flight.animalHit && env.animals) {
    for (const animal of env.animals) {
      if (!animalShouldInterfere(flight, animal, animal)) continue
      flight.animalHit = true
      flight.grounded = false
      const push = Math.sign(flight.x - animal.x) || animal.direction || 1
      const next = animalImpulse({ x: flight.vx, y: flight.vy, z: flight.vz }, animal, push)
      flight.vx = next.x
      flight.vy = next.y
      flight.vz = next.z
      flight.animalType = animal.type
      break
    }
  }

  const roof = onRoof(flight.x, flight.z)
  if (flight.grounded && !roof) {
    flight.grounded = false
    flight.vy = -0.25
    flight.fellOff = true
  }
  if (!flight.grounded && roof && flight.y <= LANDING_Y && flight.vy < 0) {
    const impact = roofImpact(
      { x: flight.vx, y: flight.vy, z: flight.vz },
      { x: flight.ax, y: flight.ay, z: flight.az },
      flight.bounceCount,
      yawJitter(flight.x),
    )
    flight.y = LANDING_Y
    flight.vx = impact.velocity.x
    flight.vy = impact.velocity.y
    flight.vz = impact.velocity.z
    flight.ax = impact.angularVelocity.x
    flight.ay = impact.angularVelocity.y
    flight.az = impact.angularVelocity.z
    if (!flight.firstContact) flight.firstContact = flight.elapsed
    flight.bounceCount = impact.bounceCount
    flight.grounded = impact.grounded
  }
  if (flight.grounded) flight.y = LANDING_Y

  if (flight.firstContact && flight.grounded) {
    const horizontal = Math.hypot(flight.vx, flight.vz)
    const angular = Math.hypot(flight.ax, flight.ay, flight.az)
    if (flight.elapsed - flight.firstContact >= 1.8 || (horizontal < 0.18 && angular < 0.35)) {
      flight.done = true
      flight.kind = landingKind(flight.x, flight.z, env.targetX, env.targetZ, env.targetScale, env.secondaryTarget)
      return flight
    }
  }
  if (flight.y < -11.5 || flight.elapsed > 6) {
    flight.done = true
    flight.kind = flight.y < -11.5 || !onRoof(flight.x, flight.z)
      ? 'miss'
      : landingKind(flight.x, flight.z, env.targetX, env.targetZ, env.targetScale, env.secondaryTarget)
  }
  return flight
}

export function simulateThrow({ dx, dy, wind, mods = {}, targetX, targetZ, targetScale = 1, secondaryTarget = null, animals = [] }) {
  const velocity = launchVelocity(dx, dy, wind, mods, targetX, targetZ)
  const flight = createFlight(velocity)
  const env = { wind, targetX, targetZ, targetScale, secondaryTarget, animals }
  const step = 1 / 60
  for (let i = 0; i < 360 && !flight.done; i += 1) stepFlight(flight, step, env)
  if (!flight.done) {
    flight.done = true
    flight.kind = 'miss'
  }
  return flight
}

export function planThrow({ targetX, targetZ, wind, mods = {}, targetScale = 1, animals = [] }) {
  let best = null
  for (let power = 0.28; power <= 0.92; power += 0.04) {
    const dy = 24 + power * 156
    let lo = -110
    let hi = 110
    for (let i = 0; i < 8; i += 1) {
      const mid = (lo + hi) / 2
      const probe = simulateThrow({ dx: mid, dy, wind, mods, targetX, targetZ, targetScale, animals })
      if (probe.x < targetX) lo = mid
      else hi = mid
    }
    const dx = (lo + hi) / 2
    const result = simulateThrow({ dx, dy, wind, mods, targetX, targetZ, targetScale, animals })
    const distance = Math.hypot(result.x - targetX, result.z - targetZ)
    const score = (result.kind === 'miss' ? 100 : 0) + distance
    if (!best || score < best.score) best = { dx, dy, power, distance, kind: result.kind, x: result.x, z: result.z, score }
  }
  return best
}

export function sampleTrajectory(dx, dy, wind, mods, targetX, targetZ) {
  const velocity = launchVelocity(dx, Math.max(24, dy), wind, mods, targetX, targetZ)
  const points = []
  let x = PACKAGE_START.x
  let y = PACKAGE_START.y
  let z = PACKAGE_START.z
  let vx = velocity.x
  let vy = velocity.y
  let vz = velocity.z
  const step = 0.045
  for (let i = 0; i < 18; i += 1) {
    vx += wind * step
    vy -= GRAVITY * step
    x += vx * step
    y += vy * step
    z += vz * step
    points.push({ x, y, z, visible: y > 0.46 })
    if (y < 0.3) break
  }
  return { points, power: velocity.power }
}
