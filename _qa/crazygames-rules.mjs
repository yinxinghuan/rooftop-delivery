import assert from 'node:assert/strict'
import { createFlight, landingKind, planThrow, stepFlight } from '../crazygames/aim.js'
import { ROUTES, landingForRoute, nextMechanic, overtimeRoute, passedRoute, shouldBeginWindFlip } from '../crazygames/campaign.js'

assert.equal(ROUTES.length, 10, 'the fixed campaign must remain ten routes')
assert.deepEqual(ROUTES.filter((route) => route.windFlip).map((route) => route.id), [6, 9, 10])
assert.deepEqual(ROUTES.filter((route) => route.dualTarget).map((route) => route.id), [8, 10])
assert.deepEqual(ROUTES.filter((route) => route.fragile).map((route) => route.id), [7])

const nightScenes = Array.from({ length: 6 }, (_, index) => overtimeRoute(11 + index).scene)
assert.deepEqual(nightScenes, ['depot', 'laundry', 'garden', 'neon', 'glasshouse', 'beacon'])
assert.equal(overtimeRoute(17).scene, 'depot', 'night contracts should cycle the dressed districts')

assert.equal(landingKind(0, -10, 0, -10, 1), 'bullseye')
assert.equal(landingKind(1.25, -10, 0, -10, 1), 'delivered')
assert.equal(landingKind(3.2, -10, 0, -10, 1, { x: 3.2, z: -10, scale: 0.9 }), 'delivered')
assert.equal(landingKind(0.65, -10, 0, -10, 1), 'bullseye', 'fragile center is mechanically available')

const glasshouse = ROUTES[6]
assert.equal(glasshouse.deliveredGoal, 5)
assert.equal(glasshouse.bullseyeGoal, 1)
assert.equal(glasshouse.parcels, 6)
assert.equal(glasshouse.maxMisses, 2)
for (const kind of ['delivered', 'edge', 'bullseye', 'miss']) {
  assert.equal(landingForRoute(glasshouse, kind), kind, `Glasshouse must not rewrite ${kind}`)
}
assert.equal(landingForRoute(ROUTES[4], 'delivered'), 'delivered')
assert.equal(landingForRoute(overtimeRoute(15), 'edge'), 'edge', 'night contracts keep the shared landing kinds')
assert.equal(passedRoute(glasshouse, { delivered: 5, bullseyes: 1, score: 0 }), true)
assert.equal(passedRoute(glasshouse, { delivered: 5, bullseyes: 0, score: 0 }), false, 'the coral center is still required')
assert.equal(passedRoute(glasshouse, { delivered: 4, bullseyes: 1, score: 0 }), false)

function playGlasshouse(kinds) {
  const stats = { delivered: 0, bullseyes: 0, misses: 0, score: 0, index: 0, ended: false }
  for (const raw of kinds) {
    const kind = landingForRoute(glasshouse, raw)
    stats.index += 1
    if (kind === 'miss') stats.misses += 1
    else {
      stats.delivered += 1
      if (kind === 'bullseye') stats.bullseyes += 1
    }
    if (stats.misses >= glasshouse.maxMisses || stats.index >= glasshouse.parcels) {
      stats.ended = true
      break
    }
  }
  stats.passed = !kinds.length ? false : passedRoute(glasshouse, stats) && stats.ended
  return stats
}
const followedText = playGlasshouse(['delivered', 'delivered', 'delivered', 'delivered', 'bullseye', 'edge'])
assert.equal(followedText.misses, 0)
assert.equal(followedText.passed, true, 'landing on the pad and centering once clears Glasshouse')
const twoPadLandings = playGlasshouse(['delivered', 'delivered'])
assert.equal(twoPadLandings.ended, false)
assert.equal(twoPadLandings.delivered, 2)
assert.equal(twoPadLandings.misses, 0, 'pad landings must not spend the miss budget')
const twoRealMisses = playGlasshouse(['miss', 'miss'])
assert.equal(twoRealMisses.ended, true)
assert.equal(twoRealMisses.passed, false)

const windRoute = ROUTES[5]
const pointerCharge = { charging: true, power: 0.2 }
assert.equal(shouldBeginWindFlip(windRoute, pointerCharge), true, 'pointer charging crosses the same wind-flip threshold')
assert.equal(shouldBeginWindFlip(windRoute, { charging: true, power: 0.2, triggered: true }), false)
assert.equal(shouldBeginWindFlip(windRoute, { charging: true, power: 0.2, tutorial: true }), false)
assert.equal(shouldBeginWindFlip(windRoute, { charging: false, power: 0.9 }), false)
assert.equal(shouldBeginWindFlip(windRoute, { charging: true, power: 0.119 }), false)
assert.equal(shouldBeginWindFlip(ROUTES[8], { charging: true, power: 0.5 }), true)
assert.equal(shouldBeginWindFlip(ROUTES[9], { charging: true, power: 0.5 }), true)
assert.equal(shouldBeginWindFlip(glasshouse, { charging: true, power: 1 }), false)

const falling = createFlight({ x: 0, y: 0, z: 0, spinX: 3, spinY: 2, spinZ: 4 })
Object.assign(falling, { x: 4.7, y: 0.79, z: -10, vx: 1.2, vy: 0, vz: 0, grounded: true })
let sawStreetDepth = false
for (let index = 0; index < 360 && !falling.done; index += 1) {
  stepFlight(falling, 1 / 60, { wind: 0, targetX: 0, targetZ: -10, targetScale: 1, animals: [] })
  if (falling.y <= -8.8 && !falling.done) sawStreetDepth = true
}
assert.equal(falling.fellOff, true, 'a parcel leaving the roof should enter the street fall')
assert.equal(sawStreetDepth, true, 'the parcel should remain in motion through street depth before resolving')
assert.equal(falling.kind, 'miss')

const hintIds = [
  nextMechanic(ROUTES[5], [])?.id,
  nextMechanic(ROUTES[6], [])?.id,
  nextMechanic(ROUTES[7], [])?.id,
]
assert.deepEqual(hintIds, ['wind-flip', 'fragile-center', 'dual-pad'])

const routePlans = ROUTES.map((route) => {
  const wind = route.windMax * 0.72
  const targetX = route.dualTarget ? -1.85 : (route.xRange[0] + route.xRange[1]) / 2
  const targetZ = route.dualTarget ? -10.5 : (route.zRange[0] + route.zRange[1]) / 2
  const effectiveWind = route.windFlip ? -wind : wind
  const plan = planThrow({ targetX, targetZ, wind: effectiveWind, targetScale: route.targetScale, mods: {} })
  assert.ok(plan, `route ${route.id} should have a planned throw`)
  assert.notEqual(plan.kind, 'miss', `route ${route.id} should retain a reachable landing after its new rule`)
  return { route: route.id, wind: Number(effectiveWind.toFixed(2)), kind: plan.kind, distance: Number(plan.distance.toFixed(3)) }
})

console.log(JSON.stringify({ routes: routePlans, nightScenes, hintIds }, null, 2))
