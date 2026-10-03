import { calmScale, glovesScale, steadyAmount, tipScale, windScale, zoneScale } from './aim.js'

export const UPGRADES = [
  { id: 'gloves', name: 'Grip Gloves', max: 3, costs: [30, 70, 130], blurb: 'A firmer release. Throws carry farther across the street.' },
  { id: 'vane', name: 'Wind Vane', max: 3, costs: [40, 90, 160], blurb: 'Shed part of the crosswind before it shoves the crate.' },
  { id: 'jar', name: 'Tip Jar', max: 3, costs: [25, 60, 120], blurb: 'Neighbors tip more for the same landing.' },
  { id: 'zone', name: 'Wide Pad', max: 3, costs: [35, 80, 150], blurb: 'The drop mark is painted larger on the roof.' },
  { id: 'spare', name: 'Spare Crate', max: 2, costs: [50, 110], blurb: 'Pack one extra parcel on every route.' },
  { id: 'cushion', name: 'Soft Cushion', max: 2, costs: [45, 100], blurb: 'One more miss is forgiven before the route fails.' },
  { id: 'steady', name: 'Steady Hand', max: 2, costs: [55, 120], blurb: 'The release drifts a little toward the mark.' },
  { id: 'calm', name: 'Animal Treats', max: 2, costs: [60, 140], blurb: 'Cats, dogs, and chickens shove the crate less.' },
]

const CAT = { type: 'cat', amplitude: 2.15, period: 5.4, radius: 0.95, height: 2.1, deflect: 2.2, lift: 1.1, pounce: 0.55, zOffset: 0 }
const DOG = { type: 'dog', amplitude: 2.6, period: 7.8, radius: 0.82, height: 2.1, deflect: 2.4, lift: 0.85, pounce: 0.4, zOffset: 0 }
const HEN = { type: 'chicken', amplitude: 2.3, period: 7.2, radius: 0.78, height: 2.1, deflect: 1.8, lift: 1.4, pounce: 0.7, zOffset: 0 }

export const ROUTES = [
  {
    id: 1, name: 'Depot Drill', scene: 'depot',
    blurb: 'A wide pad and a quiet sky. Land 2 parcels.',
    parcels: 4, maxMisses: 3, windMin: 0, windMax: 0.16, targetScale: 1.58,
    deliveredGoal: 2, bullseyeGoal: 0, scoreGoal: 0, moveAmplitude: 0, movePeriod: 0,
    xRange: [-0.9, 0.9], zRange: [-11.0, -9.8], animals: [],
    parcel: { box: 0xf05d4e, tape: 0xf7d58b, label: 'RD / 01' },
  },
  {
    id: 2, name: 'Breeze Alley', scene: 'laundry',
    blurb: 'A light crosswind, and the pad creeps. Land 3 parcels.',
    hook: 'The pad creeps in a light wind. Land 3',
    parcels: 5, maxMisses: 3, windMin: 0.22, windMax: 0.72, targetScale: 1.05,
    deliveredGoal: 3, bullseyeGoal: 0, scoreGoal: 0, moveAmplitude: 0.48, movePeriod: 7.2,
    xRange: [-3.45, 3.45], zRange: [-12.1, -9.0], animals: [],
    parcel: { box: 0x4f83b8, tape: 0xfff5de, label: 'AIR / 02' },
  },
  {
    id: 3, name: 'Sliding Row', scene: 'laundry',
    blurb: 'The drop mark slides. Lead the pad and land 3 of 5.',
    hook: 'The drop mark slides. Land 3 of 5',
    parcels: 5, maxMisses: 3, windMin: 0.42, windMax: 1.08, targetScale: 0.86,
    deliveredGoal: 3, bullseyeGoal: 0, scoreGoal: 0, moveAmplitude: 1.12, movePeriod: 4.0,
    xRange: [-3.25, 3.25], zRange: [-12.6, -8.8], animals: [],
    parcel: { box: 0x4f83b8, tape: 0xfff5de, label: 'AIR / 03' },
  },
  {
    id: 4, name: 'Laundry Cats', scene: 'laundry',
    blurb: 'A cat patrols the drop roof. Land 4 parcels.',
    hook: 'A cat patrols the roof. Land 4',
    parcels: 5, maxMisses: 3, windMin: 0.15, windMax: 0.7, targetScale: 1.14,
    deliveredGoal: 4, bullseyeGoal: 0, scoreGoal: 0, moveAmplitude: 0, movePeriod: 0,
    xRange: [-2.1, 2.1], zRange: [-12.4, -8.8], animals: [{ ...CAT }],
    parcel: { box: 0x4f83b8, tape: 0xfff5de, label: 'CAT / 04' },
  },
  {
    id: 5, name: 'Garden Dogs', scene: 'garden',
    blurb: 'Narrower pad, one dog, and a bullseye. Land 4, center once.',
    parcels: 6, maxMisses: 3, windMin: 0.1, windMax: 0.82, targetScale: 1.04,
    deliveredGoal: 4, bullseyeGoal: 1, scoreGoal: 0, moveAmplitude: 0, movePeriod: 0,
    xRange: [-2.2, 2.2], zRange: [-12.6, -8.7], animals: [{ ...DOG }],
    parcel: { box: 0x5d9b67, tape: 0xf4ead8, label: 'BIO / 05' },
  },
  {
    id: 6, name: 'Neon Drift', scene: 'neon',
    blurb: 'The address slides and the wind flips while you charge. Land 4 and score 220.',
    parcels: 6, maxMisses: 2, windMin: 0.1, windMax: 0.78, targetScale: 1.02,
    deliveredGoal: 4, bullseyeGoal: 0, scoreGoal: 220, moveAmplitude: 0.7, movePeriod: 4.4,
    xRange: [-1.8, 1.8], zRange: [-12.2, -9.0], animals: [],
    windFlip: true,
    parcel: { box: 0x8a6aa6, tape: 0x79d7d2, label: 'MOVE / 06' },
  },
  {
    id: 7, name: 'Glasshouse', scene: 'glasshouse',
    blurb: 'Fragile crates. Land 5 parcels, and hit the coral center once.',
    parcels: 6, maxMisses: 2, windMin: 0.15, windMax: 0.92, targetScale: 0.98,
    deliveredGoal: 5, bullseyeGoal: 1, scoreGoal: 0, moveAmplitude: 0, movePeriod: 0,
    xRange: [-2.2, 2.2], zRange: [-12.8, -8.7], animals: [{ ...HEN }],
    fragile: true,
    parcel: { box: 0xf4ead8, tape: 0xe0483b, label: 'FRAGILE' },
  },
  {
    id: 8, name: 'Twin Patrol', scene: 'beacon',
    blurb: 'Two addresses: coral pays a bullseye, teal is a regular delivery.',
    parcels: 7, maxMisses: 2, windMin: 0.15, windMax: 1.02, targetScale: 0.94,
    deliveredGoal: 5, bullseyeGoal: 1, scoreGoal: 0, moveAmplitude: 0, movePeriod: 0,
    xRange: [-2.3, 2.3], zRange: [-13.0, -8.6],
    dualTarget: true,
    animals: [{ ...CAT, zOffset: -0.55, period: 4.6 }, { ...DOG, zOffset: 0.55, phase: Math.PI, period: 5.2 }],
    parcel: { box: 0x353544, tape: 0xf2c14e, label: 'DUO / 08' },
  },
  {
    id: 9, name: 'Market Run', scene: 'neon',
    blurb: 'A moving address and a charging gust. Land 5, center once, score 320.',
    parcels: 7, maxMisses: 2, windMin: 0.2, windMax: 1.08, targetScale: 0.9,
    deliveredGoal: 5, bullseyeGoal: 1, scoreGoal: 320, moveAmplitude: 0.85, movePeriod: 3.8,
    xRange: [-2.0, 2.0], zRange: [-12.6, -8.8], animals: [],
    windFlip: true,
    parcel: { box: 0x8a6aa6, tape: 0x79d7d2, label: 'MKT / 09' },
  },
  {
    id: 10, name: 'Skyline Contract', scene: 'beacon',
    blurb: 'Two addresses and a charging gust. Land 6, center twice, clear 420.',
    parcels: 8, maxMisses: 2, windMin: 0.2, windMax: 1.22, targetScale: 0.86,
    deliveredGoal: 6, bullseyeGoal: 2, scoreGoal: 420, moveAmplitude: 0.62, movePeriod: 3.5,
    xRange: [-2.3, 2.3], zRange: [-13.2, -8.6],
    dualTarget: true,
    windFlip: true,
    animals: [{ ...CAT, amplitude: 2.3, zOffset: -0.6, period: 3.8 }, { ...DOG, amplitude: 2.1, zOffset: 0.6, phase: Math.PI, period: 4.4 }],
    parcel: { box: 0x353544, tape: 0xf2c14e, label: 'FINAL' },
  },
]

export function overtimeRoute(id) {
  const tier = id - ROUTES.length
  const wind = Math.min(1.45, 0.95 + tier * 0.06)
  const nightScenes = ['depot', 'laundry', 'garden', 'neon', 'glasshouse', 'beacon']
  const scene = nightScenes[(tier - 1) % nightScenes.length]
  const skins = {
    depot: { box: 0xf05d4e, tape: 0xf7d58b },
    laundry: { box: 0x4f83b8, tape: 0xfff5de },
    garden: { box: 0x5d9b67, tape: 0xf4ead8 },
    neon: { box: 0x8a6aa6, tape: 0x79d7d2 },
    glasshouse: { box: 0xf4ead8, tape: 0xe0483b },
    beacon: { box: 0x353544, tape: 0xf2c14e },
  }
  return {
    id,
    name: `Night Contract ${tier}`,
    scene,
    blurb: `Overtime shift ${tier}. The city does not get easier.`,
    parcels: 7,
    maxMisses: 2,
    windMin: 0.25,
    windMax: wind,
    targetScale: Math.max(0.74, 0.88 - tier * 0.015),
    deliveredGoal: 5,
    bullseyeGoal: 1,
    scoreGoal: 280 + tier * 35,
    moveAmplitude: tier % 2 === 0 ? 0.55 : 0.8,
    movePeriod: Math.max(3.1, 4.2 - tier * 0.08),
    xRange: [-2.2, 2.2],
    zRange: [-13.0, -8.7],
    animals: tier % 3 === 0
      ? [{ ...CAT, period: 3.6 }, { ...DOG, phase: Math.PI, zOffset: 0.5 }]
      : tier % 3 === 1 ? [{ ...HEN, period: 3.4 }] : [{ ...DOG, period: 4.1 }],
    parcel: { ...skins[scene], label: `NIGHT ${tier}` },
  }
}

export function routeById(id) {
  if (id >= 1 && id <= ROUTES.length) return ROUTES[id - 1]
  if (id > ROUTES.length) return overtimeRoute(id)
  return ROUTES[0]
}

export function maxKnownRoute(unlocked) {
  return Math.max(ROUTES.length + 4, unlocked)
}

export function passedRoute(route, stats) {
  return stats.delivered >= route.deliveredGoal
    && stats.bullseyes >= route.bullseyeGoal
    && stats.score >= route.scoreGoal
}

// Glasshouse stays a center challenge: the coral bullseye is required, but a
// pad or roof-edge landing is still a landing. Rewriting those into misses
// made the route fail anyone who followed "land 5, and center once."
export function landingForRoute(route, kind) {
  if (!route?.fragile) return kind
  if (kind === 'bullseye' || kind === 'delivered' || kind === 'edge' || kind === 'miss') return kind
  return 'miss'
}

export function shouldBeginWindFlip(route, { triggered = false, charging = false, tutorial = false, power = 0 } = {}) {
  return Boolean(route?.windFlip) && !triggered && charging && !tutorial && power >= 0.12
}

export function missionLine(route) {
  const parts = [`Land ${route.deliveredGoal}`]
  if (route.bullseyeGoal) parts.push(`${route.bullseyeGoal} bullseye${route.bullseyeGoal > 1 ? 's' : ''}`)
  if (route.scoreGoal) parts.push(`${route.scoreGoal} points`)
  return parts.join(' · ')
}

export function progressLine(route, stats) {
  const parts = [`Landed ${stats.delivered}/${route.deliveredGoal}`]
  if (route.bullseyeGoal) parts.push(`Centers ${stats.bullseyes}/${route.bullseyeGoal}`)
  if (route.scoreGoal) parts.push(`Score ${stats.score}/${route.scoreGoal}`)
  return parts.join(' · ')
}

export function hudGoal(route, stats, parcelIndex) {
  const crate = `Crate ${Math.min(route.parcels, (parcelIndex || 0) + 1)}/${route.parcels}`
  if (!passedRoute(route, stats)) return `${missionLine(route)} · ${crate}`
  const left = Math.max(0, route.parcels - (parcelIndex || 0) - 1)
  return left > 0 ? `Combo still pays · ${crate}` : `Goal met · ${crate}`
}

export function resultHeading(passed, stats) {
  if (passed) return 'Route cleared'
  if ((stats.delivered || 0) > 0 || (stats.score || 0) > 0) return 'So close'
  return 'Missed the roof'
}

export function continueLabel(passed, routeId) {
  if (!passed) return 'Retry this roof'
  if (routeId <= 3) return 'One more roof'
  return 'Next route'
}

export function nextRoofPitch(route) {
  const next = routeById(route.id + 1)
  const hook = next.hook || String(next.blurb || '').split('.')[0]
  return `Next roof: ${next.name}. ${hook}.`
}

export function retryPitch(route, stats) {
  const land = Math.max(0, (route.deliveredGoal || 0) - (stats.delivered || 0))
  const centers = Math.max(0, (route.bullseyeGoal || 0) - (stats.bullseyes || 0))
  const points = Math.max(0, (route.scoreGoal || 0) - (stats.score || 0))
  const needs = []
  if (land) needs.push(land === 1 ? 'land 1 more crate' : `land ${land} more crates`)
  if (centers) needs.push(centers === 1 ? 'hit the center once' : `hit the center ${centers} times`)
  if (points) needs.push(`score ${points} more`)
  if (!needs.length) return 'One careful throw clears this roof. Fresh crates, same street.'
  const detail = needs.length === 1 ? needs[0] : `${needs[0]}, and ${needs.slice(1).join(', ')}`
  const sentence = `${detail.charAt(0).toUpperCase()}${detail.slice(1)}.`
  return `${sentence} Fresh crates, same street.`
}

export const TUTORIAL = [
  {
    id: 'throw',
    kicker: 'Step 1',
    title: 'Land the first crate',
    body: 'Drag up to charge, sideways to aim, then release. On a keyboard, hold Space and use A or D. Anywhere on the far roof counts.',
    action: 'throw',
    wind: 0,
    target: [0, -10.2],
    scale: 1.85,
  },
  {
    id: 'wind',
    kicker: 'Step 2',
    title: 'Aim against the wind',
    body: 'The vane shows which way the gust pushes. Aim the other way, then throw. The roof edge still counts.',
    action: 'throw',
    wind: 0.36,
    target: [0.1, -10.35],
    scale: 1.75,
  },
  {
    id: 'done',
    kicker: 'Step 3',
    title: 'The first roof is ready',
    body: 'Four crates. Land two. The coral ring pays more, and the rest of the roof still counts. Continue to start.',
    action: 'enter',
  },
]

export function tipValue(kind, jarRank) {
  const base = kind === 'bullseye' ? 18 : kind === 'delivered' ? 12 : kind === 'edge' ? 6 : 0
  return Math.round(base * tipScale(jarRank))
}

export function clearBonus(route, jarRank) {
  return Math.round((16 + route.id * 2) * tipScale(jarRank))
}

export function emptyUpgrades() {
  return { gloves: 0, vane: 0, jar: 0, zone: 0, spare: 0, cushion: 0, steady: 0, calm: 0 }
}

export function nextMechanic(route, seen) {
  const known = new Set(seen || [])
  const types = new Set((route.animals || []).map((animal) => animal.type))
  const options = []
  if (route.windFlip) {
    options.push({ id: 'wind-flip', text: 'The wind flips once while you charge. Watch the rooftop flag turn first.' })
  }
  if (route.fragile) {
    options.push({ id: 'fragile-center', text: 'Fragile crate: roof landings count. One crate has to hit the coral center.' })
  }
  if (route.dualTarget) {
    options.push({ id: 'dual-pad', text: 'Two addresses: coral is a high-tip bullseye; the teal ring is a regular delivery.' })
  }
  if (route.moveAmplitude > 0 && route.moveAmplitude < 0.85) {
    options.push({ id: 'creep', text: 'The pad creeps. Aim a little ahead of the mark.' })
  }
  if (route.moveAmplitude >= 0.85) {
    options.push({ id: 'slide', text: 'The pad slides. Throw ahead of where it is now.' })
  }
  if (types.has('cat') && !types.has('dog')) {
    options.push({ id: 'cat', text: 'A cat patrols this roof and can swat the crate.' })
  }
  if (types.has('dog') && !types.has('cat')) {
    options.push({ id: 'dog', text: 'Wait for the dog to walk off the pad, then throw.' })
  }
  if (types.has('chicken')) {
    options.push({ id: 'hen', text: 'Wait for the chicken to leave the pad, then throw.' })
  }
  if (types.has('cat') && types.has('dog')) {
    options.push({ id: 'duo', text: 'Cat and dog share the roof. Wait for a clear gap.' })
  }
  if (route.scoreGoal) {
    options.push({ id: 'score', text: 'This route needs points. Centers pay more than the roof edge.' })
  }
  return options.find((option) => !known.has(option.id)) || null
}

function percentPoints(scale) {
  return Math.round((scale - 1) * 100)
}

function signedPercent(points) {
  if (points > 0) return `+${points}%`
  if (points < 0) return `−${Math.abs(points)}%`
  return '0%'
}

function effectPair(current, next) {
  return next == null ? `${current} · Maxed` : `${current} to ${next}`
}

export function effectLine(id, rank, max) {
  const next = rank >= max ? null : rank + 1
  if (id === 'gloves') {
    return `Reach ${effectPair(signedPercent(percentPoints(glovesScale(rank))), next == null ? null : signedPercent(percentPoints(glovesScale(next))))}`
  }
  if (id === 'vane') {
    return `Wind ${effectPair(signedPercent(percentPoints(windScale(rank))), next == null ? null : signedPercent(percentPoints(windScale(next))))}`
  }
  if (id === 'jar') {
    return `Tips ${effectPair(signedPercent(percentPoints(tipScale(rank))), next == null ? null : signedPercent(percentPoints(tipScale(next))))}`
  }
  if (id === 'zone') {
    return `Pad ${effectPair(signedPercent(percentPoints(zoneScale(rank))), next == null ? null : signedPercent(percentPoints(zoneScale(next))))}`
  }
  if (id === 'spare') return `Extra parcels ${effectPair(String(rank), next == null ? null : String(next))}`
  if (id === 'cushion') return `Extra misses ${effectPair(String(rank), next == null ? null : String(next))}`
  if (id === 'steady') {
    const drift = (value) => `${Math.round(steadyAmount(value) * 100)}%`
    return `Drift ${effectPair(drift(rank), next == null ? null : drift(next))}`
  }
  const shove = (value) => signedPercent(percentPoints(calmScale(value)))
  return `Shove ${effectPair(shove(rank), next == null ? null : shove(next))}`
}

const icon = (body) => `<svg viewBox="0 0 48 48" aria-hidden="true">${body}</svg>`

export const UPGRADE_ICONS = {
  gloves: icon('<path d="M18 30V18.5a2.5 2.5 0 015 0V26M23 26v-9.5a2.5 2.5 0 015 0V26M28 25.5V18a2.5 2.5 0 015 0v12.5c0 6.2-4.2 10.5-10.5 10.5h-3.2C18 41 14.5 37.2 13.6 33l-2.4-6.2a2.4 2.4 0 014.4-1.8L18 30" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'),
  vane: icon('<path d="M24 40V14M24 16l12 4-12 4V16zM10 40h28" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>'),
  jar: icon('<path d="M18 14h12M20 14v-3h8v3M17 20h14l-1.4 16.2a4 4 0 01-4 3.6h-3.2a4 4 0 01-4-3.6L17 20z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M19 28h10" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
  zone: icon('<circle cx="24" cy="24" r="12" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="24" cy="24" r="6" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="24" cy="24" r="2" fill="currentColor"/>'),
  spare: icon('<path d="M10 18l14-7 14 7-14 7-14-7zM10 18v12l14 7 14-7V18M24 25v12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/>'),
  cushion: icon('<path d="M12 28c0-7 5-12 12-12s12 5 12 12-5 8-12 8-12-1-12-8z" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M16 28c1.2 3 3.4 4.5 8 4.5s6.8-1.5 8-4.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
  steady: icon('<circle cx="24" cy="24" r="10" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M24 8v6M24 34v6M8 24h6M34 24h6M24 24l6-4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'),
  calm: icon('<circle cx="17" cy="20" r="3" fill="currentColor"/><circle cx="31" cy="20" r="3" fill="currentColor"/><circle cx="12" cy="28" r="3" fill="currentColor"/><circle cx="36" cy="28" r="3" fill="currentColor"/><circle cx="24" cy="32" r="4.2" fill="currentColor"/>'),
}
