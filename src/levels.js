import { t } from './i18n.js'

export const LEVELS = [
  { id: 1, titleKey: 'level1Title', missionKey: 'level1Mission', parcels: 4, maxMisses: 2, windMax: 0.45, windMin: 0, targetScale: 1.1, deliveredGoal: 3, bullseyeGoal: 0, scoreGoal: 0, moveAmplitude: 0, movePeriod: 0 },
  { id: 2, titleKey: 'level2Title', missionKey: 'level2Mission', parcels: 5, maxMisses: 2, windMax: 1.25, windMin: 0.35, targetScale: 1, deliveredGoal: 4, bullseyeGoal: 0, scoreGoal: 0, moveAmplitude: 0, movePeriod: 0 },
  { id: 3, titleKey: 'level3Title', missionKey: 'level3Mission', parcels: 6, maxMisses: 2, windMax: 1.05, windMin: 0, targetScale: 0.82, deliveredGoal: 5, bullseyeGoal: 1, scoreGoal: 0, moveAmplitude: 0, movePeriod: 0 },
  { id: 4, titleKey: 'level4Title', missionKey: 'level4Mission', parcels: 6, maxMisses: 2, windMax: 0.95, windMin: 0, targetScale: 0.92, deliveredGoal: 4, bullseyeGoal: 0, scoreGoal: 300, moveAmplitude: 1.15, movePeriod: 3.8 },
  { id: 5, titleKey: 'level5Title', missionKey: 'level5Mission', parcels: 7, maxMisses: 1, windMax: 1.15, windMin: 0, targetScale: 0.9, deliveredGoal: 6, bullseyeGoal: 2, scoreGoal: 0, moveAmplitude: 0, movePeriod: 0 },
  { id: 6, titleKey: 'level6Title', missionKey: 'level6Mission', parcels: 8, maxMisses: 2, windMax: 1.35, windMin: 0, targetScale: 0.82, deliveredGoal: 7, bullseyeGoal: 2, scoreGoal: 500, moveAmplitude: 0.75, movePeriod: 3.2 },
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
