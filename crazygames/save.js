import { emptyUpgrades } from './campaign.js'

const KEY = 'rooftop_cg_profile_v1'

const DEFAULTS = {
  v: 1,
  unlocked: 1,
  cleared: [],
  best: 0,
  routeBest: {},
  tips: 0,
  upgrades: emptyUpgrades(),
  tutorialSeen: false,
  selected: 1,
  audio: { muted: false, volume: 0.75 },
}

function sanitize(raw) {
  const data = { ...DEFAULTS, ...raw }
  data.upgrades = { ...emptyUpgrades(), ...(raw?.upgrades || {}) }
  data.audio = { ...DEFAULTS.audio, ...(raw?.audio || {}) }
  data.unlocked = Math.max(1, Math.round(Number(data.unlocked) || 1))
  data.selected = Math.min(data.unlocked, Math.max(1, Math.round(Number(data.selected) || 1)))
  data.best = Math.max(0, Math.round(Number(data.best) || 0))
  data.tips = Math.max(0, Math.round(Number(data.tips) || 0))
  data.cleared = Array.isArray(data.cleared) ? data.cleared.filter((id) => Number.isInteger(id) && id >= 1) : []
  data.routeBest = raw?.routeBest && typeof raw.routeBest === 'object' ? raw.routeBest : {}
  data.tutorialSeen = Boolean(data.tutorialSeen)
  data.audio.muted = Boolean(data.audio.muted)
  data.audio.volume = Math.min(1, Math.max(0, Number(data.audio.volume) || 0))
  for (const key of Object.keys(data.upgrades)) {
    data.upgrades[key] = Math.max(0, Math.round(Number(data.upgrades[key]) || 0))
  }
  return data
}

export function loadProfile() {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) || 'null') || {})
  } catch {
    return sanitize({})
  }
}

export function writeProfile(profile) {
  const clean = sanitize(profile)
  localStorage.setItem(KEY, JSON.stringify(clean))
  return clean
}
