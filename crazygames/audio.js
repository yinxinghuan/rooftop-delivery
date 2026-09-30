import cityUrl from './audio/music-city-loop.mp3'
import calmUrl from './audio/music-calm-track.ogg'
import winUrl from './audio/sting-win.mp3'
import loseUrl from './audio/sting-lose.mp3'
import clickUrl from './audio/sfx-click.mp3'
import throwUrl from './audio/sfx-throw.mp3'
import bounceUrl from './audio/sfx-bounce.mp3'
import confirmUrl from './audio/sfx-confirm.mp3'
import errorUrl from './audio/sfx-error.mp3'
import hitUrl from './audio/sfx-hit.mp3'
import switchUrl from './audio/sfx-switch.mp3'
import bongUrl from './audio/sfx-bong.mp3'

const clips = {
  click: clickUrl,
  throw: throwUrl,
  bounce: bounceUrl,
  confirm: confirmUrl,
  error: errorUrl,
  hit: hitUrl,
  switch: switchUrl,
  bong: bongUrl,
  win: winUrl,
  lose: loseUrl,
}

const city = new Audio(cityUrl)
const calm = new Audio(calmUrl)
const playlist = [city, calm]
playlist.forEach((node) => {
  node.loop = true
  node.preload = 'auto'
})

let muted = false
let volume = 0.75
let unlocked = false
let duckTimer = 0
let trackIndex = 0

function outputGain() {
  return muted ? 0 : Math.min(1, Math.max(0, volume))
}

function musicGain() {
  return outputGain() * 0.42
}

function activeMusic() {
  return playlist[trackIndex]
}

function syncMusic() {
  const gain = musicGain()
  playlist.forEach((node, index) => {
    if (index !== trackIndex) {
      node.pause()
      node.volume = 0
    }
  })
  const node = activeMusic()
  node.volume = gain
  if (muted || !unlocked) {
    node.pause()
    return
  }
  node.play().catch(() => {})
}

export const audio = {
  get unlocked() { return unlocked },
  get muted() { return muted },
  get volume() { return volume },
  configure({ muted: nextMuted, volume: nextVolume }) {
    muted = Boolean(nextMuted)
    volume = Math.min(1, Math.max(0, Number(nextVolume) || 0))
    syncMusic()
  },
  unlock() {
    unlocked = true
    syncMusic()
  },
  setRoute(routeId) {
    const next = Number(routeId) % 2 === 0 ? 1 : 0
    if (next === trackIndex) {
      syncMusic()
      return
    }
    trackIndex = next
    syncMusic()
  },
  play(name, gain = 1) {
    if (muted || !clips[name]) return
    const node = new Audio(clips[name])
    node.volume = Math.min(1, outputGain() * gain)
    node.play().catch(() => {})
  },
  sting(name) {
    this.play(name, name === 'win' ? 0.9 : 0.8)
    if (muted) return
    activeMusic().volume = musicGain() * 0.28
    window.clearTimeout(duckTimer)
    duckTimer = window.setTimeout(() => { activeMusic().volume = musicGain() }, name === 'win' ? 2800 : 1200)
  },
}

export const AUDIO_CREDITS = [
  { title: 'City Loop', author: 'wipics', license: 'CC0', role: 'Looping music on odd routes and the title screen', source: 'https://opengameart.org/content/city-loop-0', file: 'https://opengameart.org/sites/default/files/city-loop_0.mp3' },
  { title: 'Calm Track', author: 'pmiller', license: 'CC0', role: 'Longer alternate loop on even routes (4 min 9 sec)', source: 'https://opengameart.org/content/calm-track', file: 'https://opengameart.org/sites/default/files/calm_track-loop.ogg' },
  { title: 'Victory', author: 'celestialghost8', license: 'CC0', role: 'Route-clear fanfare', source: 'https://opengameart.org/content/victory', file: 'https://opengameart.org/sites/default/files/Victory_0.mp3' },
  { title: 'Game Over Trumpet', author: '0new4y', license: 'CC0', role: 'Route-failed sting', source: 'https://opengameart.org/content/game-over-trumpet-sfx', file: 'https://opengameart.org/sites/default/files/losetrumpet.mp3' },
  { title: 'Interface Sounds, UI Audio, Impact Sounds', author: 'Kenney (www.kenney.nl)', license: 'CC0', role: 'Click, throw, bounce, confirm, error, and hit effects', source: 'https://kenney.nl/assets' },
]
