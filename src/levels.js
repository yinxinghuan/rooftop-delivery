import { t } from './i18n.js'

export const LEVELS = [
  { id: 1, titleKey: 'level1Title', missionKey: 'level1Mission', scene: 'depot', parcel: { box: 0xf05d4e, tape: 0xf7d58b, label: 'RD / 01' }, animals: [], parcels: 4, maxMisses: 2, windMax: 0.45, windMin: 0, targetScale: 1.1, deliveredGoal: 3, bullseyeGoal: 0, scoreGoal: 0, moveAmplitude: 0, movePeriod: 0 },
  { id: 2, titleKey: 'level2Title', missionKey: 'level2Mission', scene: 'laundry', parcel: { box: 0x4f83b8, tape: 0xfff5de, label: 'AIR / 02' }, animals: [{ type: 'cat', amplitude: 2.7, period: 4.2, radius: 1.15, height: 2.1, deflect: 2.8, lift: 1.4, pounce: 0.55, zOffset: 0 }], parcels: 5, maxMisses: 2, windMax: 1.25, windMin: 0.35, targetScale: 1, deliveredGoal: 4, bullseyeGoal: 0, scoreGoal: 0, moveAmplitude: 0, movePeriod: 0 },
  { id: 3, titleKey: 'level3Title', missionKey: 'level3Mission', scene: 'garden', parcel: { box: 0x5d9b67, tape: 0xf4ead8, label: 'BIO / 03' }, animals: [{ type: 'dog', amplitude: 2.4, period: 3.6, radius: 1.3, height: 2.1, deflect: 3.2, lift: 1, pounce: 0.4, zOffset: 0 }], parcels: 6, maxMisses: 2, windMax: 1.05, windMin: 0, targetScale: 0.82, deliveredGoal: 5, bullseyeGoal: 1, scoreGoal: 0, moveAmplitude: 0, movePeriod: 0 },
  { id: 4, titleKey: 'level4Title', missionKey: 'level4Mission', scene: 'neon', parcel: { box: 0x8a6aa6, tape: 0x79d7d2, label: 'MOVE / 04' }, animals: [], parcels: 6, maxMisses: 2, windMax: 0.95, windMin: 0, targetScale: 0.92, deliveredGoal: 4, bullseyeGoal: 0, scoreGoal: 300, moveAmplitude: 1.15, movePeriod: 3.8 },
  { id: 5, titleKey: 'level5Title', missionKey: 'level5Mission', scene: 'glasshouse', parcel: { box: 0xf4ead8, tape: 0xe0483b, label: 'FRAGILE' }, animals: [{ type: 'chicken', amplitude: 2, period: 3, radius: 1.1, height: 2.1, deflect: 2.2, lift: 1.8, pounce: 0.7, zOffset: 0 }], parcels: 7, maxMisses: 1, windMax: 1.15, windMin: 0, targetScale: 0.9, deliveredGoal: 6, bullseyeGoal: 2, scoreGoal: 0, moveAmplitude: 0, movePeriod: 0 },
  { id: 6, titleKey: 'level6Title', missionKey: 'level6Mission', scene: 'beacon', parcel: { box: 0x353544, tape: 0xf2c14e, label: 'FINAL / 06' }, animals: [{ type: 'cat', amplitude: 2.6, period: 3.4, radius: 1.15, height: 2.1, deflect: 2.8, lift: 1.4, pounce: 0.55, zOffset: -0.6 }, { type: 'dog', amplitude: 2.25, period: 4.1, radius: 1.3, height: 2.1, deflect: 3.2, lift: 1, pounce: 0.4, zOffset: 0.6, phase: Math.PI }], parcels: 8, maxMisses: 2, windMax: 1.35, windMin: 0, targetScale: 0.82, deliveredGoal: 7, bullseyeGoal: 2, scoreGoal: 500, moveAmplitude: 0.75, movePeriod: 3.2 },
]

export function levelTitle(level) {
  return t(level.titleKey)
}

export function levelMission(level) {
  return t(level.missionKey)
}

export function objectiveProgress(level, state) {
  const parts = [`${t('delivered')} ${state.delivered}/${level.deliveredGoal}`]
  if (level.bullseyeGoal) parts.push(`${t('bullseyes')} ${state.bullseyes}/${level.bullseyeGoal}`)
  if (level.scoreGoal) parts.push(`${t('score')} ${state.score}/${level.scoreGoal}`)
  return parts.join(' · ')
}

export function hasPassedLevel(level, state) {
  return state.delivered >= level.deliveredGoal
    && state.bullseyes >= level.bullseyeGoal
    && state.score >= level.scoreGoal
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
