import { tipScale } from './aim.js'

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
const DOG = { type: 'dog', amplitude: 2.05, period: 4.8, radius: 1.05, height: 2.1, deflect: 2.5, lift: 0.85, pounce: 0.4, zOffset: 0 }
const HEN = { type: 'chicken', amplitude: 1.85, period: 4.2, radius: 0.9, height: 2.1, deflect: 1.8, lift: 1.4, pounce: 0.7, zOffset: 0 }

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
    blurb: 'A light crosswind joins the route. Land 3 parcels.',
    parcels: 5, maxMisses: 3, windMin: 0, windMax: 0.38, targetScale: 1.38,
    deliveredGoal: 3, bullseyeGoal: 0, scoreGoal: 0, moveAmplitude: 0, movePeriod: 0,
    xRange: [-1.5, 1.5], zRange: [-11.8, -9.2], animals: [],
    parcel: { box: 0x4f83b8, tape: 0xfff5de, label: 'AIR / 02' },
  },
  {
    id: 3, name: 'Crosswind Row', scene: 'laundry',
    blurb: 'The gusts pick up. Land 3 of 5 before the misses run out.',
    parcels: 5, maxMisses: 3, windMin: 0.22, windMax: 0.58, targetScale: 1.24,
    deliveredGoal: 3, bullseyeGoal: 0, scoreGoal: 0, moveAmplitude: 0, movePeriod: 0,
    xRange: [-1.9, 1.9], zRange: [-12.2, -8.9], animals: [],
    parcel: { box: 0x4f83b8, tape: 0xfff5de, label: 'AIR / 03' },
  },
  {
    id: 4, name: 'Laundry Cats', scene: 'laundry',
    blurb: 'A cat patrols the drop roof. Land 4 parcels.',
    parcels: 5, maxMisses: 3, windMin: 0.15, windMax: 0.7, targetScale: 1.14,
    deliveredGoal: 4, bullseyeGoal: 0, scoreGoal: 0, moveAmplitude: 0, movePeriod: 0,
    xRange: [-2.1, 2.1], zRange: [-12.4, -8.8], animals: [{ ...CAT }],
    parcel: { box: 0x4f83b8, tape: 0xfff5de, label: 'CAT / 04' },
  },
  {
    id: 5, name: 'Garden Dogs', scene: 'garden',
    blurb: 'Narrower pad, one dog, and a bullseye. Land 4, center once.',
    parcels: 6, maxMisses: 2, windMin: 0.1, windMax: 0.82, targetScale: 1.04,
    deliveredGoal: 4, bullseyeGoal: 1, scoreGoal: 0, moveAmplitude: 0, movePeriod: 0,
    xRange: [-2.2, 2.2], zRange: [-12.6, -8.7], animals: [{ ...DOG }],
    parcel: { box: 0x5d9b67, tape: 0xf4ead8, label: 'BIO / 05' },
  },
  {
    id: 6, name: 'Neon Drift', scene: 'neon',
    blurb: 'The address slides along the roof. Land 4 and score 220.',
    parcels: 6, maxMisses: 2, windMin: 0.1, windMax: 0.78, targetScale: 1.02,
    deliveredGoal: 4, bullseyeGoal: 0, scoreGoal: 220, moveAmplitude: 0.7, movePeriod: 4.4,
    xRange: [-1.8, 1.8], zRange: [-12.2, -9.0], animals: [],
    parcel: { box: 0x8a6aa6, tape: 0x79d7d2, label: 'MOVE / 06' },
  },
  {
    id: 7, name: 'Glasshouse', scene: 'glasshouse',
    blurb: 'Fragile crates, a chicken, and two careful centers.',
    parcels: 6, maxMisses: 2, windMin: 0.15, windMax: 0.92, targetScale: 0.98,
    deliveredGoal: 5, bullseyeGoal: 1, scoreGoal: 0, moveAmplitude: 0, movePeriod: 0,
    xRange: [-2.2, 2.2], zRange: [-12.8, -8.7], animals: [{ ...HEN }],
    parcel: { box: 0xf4ead8, tape: 0xe0483b, label: 'FRAGILE' },
  },
  {
    id: 8, name: 'Twin Patrol', scene: 'beacon',
    blurb: 'Cat and dog share the roof. Land 5 and center once.',
    parcels: 7, maxMisses: 2, windMin: 0.15, windMax: 1.02, targetScale: 0.94,
    deliveredGoal: 5, bullseyeGoal: 1, scoreGoal: 0, moveAmplitude: 0, movePeriod: 0,
    xRange: [-2.3, 2.3], zRange: [-13.0, -8.6],
    animals: [{ ...CAT, zOffset: -0.55, period: 4.6 }, { ...DOG, zOffset: 0.55, phase: Math.PI, period: 5.2 }],
    parcel: { box: 0x353544, tape: 0xf2c14e, label: 'DUO / 08' },
  },
  {
    id: 9, name: 'Market Run', scene: 'neon',
    blurb: 'A moving address in a harder wind. Land 5, center once, score 320.',
    parcels: 7, maxMisses: 2, windMin: 0.2, windMax: 1.08, targetScale: 0.9,
    deliveredGoal: 5, bullseyeGoal: 1, scoreGoal: 320, moveAmplitude: 0.85, movePeriod: 3.8,
    xRange: [-2.0, 2.0], zRange: [-12.6, -8.8], animals: [],
    parcel: { box: 0x8a6aa6, tape: 0x79d7d2, label: 'MKT / 09' },
  },
  {
    id: 10, name: 'Skyline Contract', scene: 'beacon',
    blurb: 'The finale. Land 6, center twice, and clear 420 points.',
    parcels: 8, maxMisses: 2, windMin: 0.2, windMax: 1.22, targetScale: 0.86,
    deliveredGoal: 6, bullseyeGoal: 2, scoreGoal: 420, moveAmplitude: 0.62, movePeriod: 3.5,
    xRange: [-2.3, 2.3], zRange: [-13.2, -8.6],
    animals: [{ ...CAT, amplitude: 2.3, zOffset: -0.6, period: 3.8 }, { ...DOG, amplitude: 2.1, zOffset: 0.6, phase: Math.PI, period: 4.4 }],
    parcel: { box: 0x353544, tape: 0xf2c14e, label: 'FINAL' },
  },
]

export function overtimeRoute(id) {
  const tier = id - ROUTES.length
  const wind = Math.min(1.45, 0.95 + tier * 0.06)
  return {
    id,
    name: `Night Contract ${tier}`,
    scene: tier % 2 === 0 ? 'beacon' : 'neon',
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
    parcel: { box: tier % 2 ? 0x8a6aa6 : 0x353544, tape: 0xf2c14e, label: `NIGHT ${tier}` },
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

export const TUTORIAL = [
  {
    id: 'welcome',
    kicker: 'Step 1',
    title: 'Welcome to the dusk shift',
    body: 'You throw parcels from this roof to the marked roof across the street. Press Enter to pick up the first crate.',
    action: 'enter',
  },
  {
    id: 'charge',
    kicker: 'Step 2',
    title: 'Build throw power',
    body: 'Hold Space until the power bar passes the notch. Letting go early will not throw yet.',
    action: 'charge',
  },
  {
    id: 'aim',
    kicker: 'Step 3',
    title: 'Aim sideways',
    body: 'Press A or D, or the arrow keys. The dotted path shows where the crate will travel.',
    action: 'aim',
  },
  {
    id: 'throw',
    kicker: 'Step 4',
    title: 'Release to throw',
    body: 'Release Space to send the crate. Land it anywhere on the far roof.',
    action: 'throw',
    wind: 0,
    target: [0, -10.2],
    scale: 1.75,
  },
  {
    id: 'wind',
    kicker: 'Step 5',
    title: 'Read the wind',
    body: 'The vane shows which way the gust pushes. Aim against it, then throw.',
    action: 'throw',
    wind: 0.48,
    target: [0.15, -10.5],
    scale: 1.65,
  },
  {
    id: 'bull',
    kicker: 'Step 6',
    title: 'Hit the coral center',
    body: 'The coral ring is a bullseye and pays more tips. Drop this crate in the center.',
    action: 'bullseye',
    wind: 0,
    target: [0, -10.15],
    scale: 1.9,
  },
  {
    id: 'done',
    kicker: 'Step 7',
    title: 'Tips open the depot',
    body: 'Between routes, spend tips on upgrades. Progress stays on this device. Press Enter to start Route 1.',
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
