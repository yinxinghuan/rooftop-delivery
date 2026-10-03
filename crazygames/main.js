import './guest.css'
import { planThrow, zoneScale } from './aim.js'
import { audio } from './audio.js'
import {
  ROUTES,
  TUTORIAL,
  UPGRADES,
  UPGRADE_ICONS,
  clearBonus,
  continueLabel,
  effectLine,
  hudGoal,
  landingForRoute,
  nextMechanic,
  nextRoofPitch,
  passedRoute,
  progressLine,
  resultHeading,
  retryPitch,
  routeById,
  shouldBeginWindFlip,
  tipValue,
} from './campaign.js'
import { loadProfile, writeProfile } from './save.js'
import { createWorld } from './world.js'

document.documentElement.lang = 'en'
document.title = 'Rooftop Delivery'

const $ = (selector) => document.querySelector(selector)
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const pad = (value) => String(Math.max(0, Math.round(value))).padStart(4, '0')

let profile = loadProfile()
audio.configure(profile.audio)

const world = createWorld($('#stage'))
const app = $('#app')

const held = new Set()
let mode = 'title'
let shopBack = 'title'
let scale = 1
let swallowSpace = false
let pointer = null
let lastTarget = { x: 99, z: 99 }
let timer = 0
let hintTimer = 0
let windFlipTimer = 0
let bridge = { sdk: null, live: false }
let simNow = 0

const run = resetRun(profile.selected || 1)

function resetRun(routeId) {
  return {
    routeId,
    ready: false,
    flying: false,
    resolving: false,
    score: 0,
    parcelIndex: 0,
    misses: 0,
    delivered: 0,
    bullseyes: 0,
    combo: 0,
    maxCombo: 0,
    centerStreak: 0,
    wind: 0,
    tipsEarned: 0,
    passed: false,
    aimDx: 0,
    aimDy: 0,
    charging: false,
    tutorialIndex: null,
    tutorialReplay: false,
    tutorialNote: '',
    targetScale: 1,
    animalHits: 0,
    lastAnimal: '',
    windFlipTriggered: false,
    windFlipPending: null,
    releaseQueued: false,
    keyboardCharging: false,
    fragileCrack: false,
  }
}

function liveRoute() {
  const base = routeById(run.routeId)
  return {
    ...base,
    parcels: base.parcels + profile.upgrades.spare,
    maxMisses: base.maxMisses + profile.upgrades.cushion,
    targetScale: base.targetScale * zoneScale(profile.upgrades.zone),
  }
}

function tutorialStep() {
  return run.tutorialIndex === null ? null : TUTORIAL[run.tutorialIndex]
}

function mods() {
  return { gloves: profile.upgrades.gloves, steady: profile.upgrades.steady }
}

function fit() {
  scale = Math.min(window.innerWidth / 1600, window.innerHeight / 900)
  app.style.transform = `scale(${scale})`
  world.resize(scale)
}

function show(id, on) {
  const node = $(id)
  node.hidden = !on
  node.classList.toggle('is-on', on)
}

function setMode(next) {
  mode = next
  app.dataset.screen = next
  show('#titleScreen', next === 'title')
  show('#pauseScreen', next === 'paused')
  show('#resultScreen', next === 'result')
  show('#shopScreen', next === 'shop')
  const playing = next === 'playing'
  $('#hud').hidden = !playing
  $('#powerDock').hidden = !playing
  if (!playing) $('#graceChip').hidden = true
  $('#tutorialCard').hidden = !(playing && run.tutorialIndex !== null)
  syncLive()
}

function syncLive() {
  const step = tutorialStep()
  const live = mode === 'playing' && (!step || step.action !== 'enter')
  if (!bridge.sdk || bridge.live === live) return
  bridge.live = live
  try {
    if (live) bridge.sdk.game.gameplayStart()
    else bridge.sdk.game.gameplayStop()
  } catch { /* outside the CrazyGames portal */ }
}

function saveAudio() {
  profile.audio = { muted: audio.muted, volume: audio.volume }
  profile = writeProfile(profile)
  paintAudio()
}

function paintAudio() {
  document.querySelectorAll('.mute-btn').forEach((button) => {
    button.querySelector('.icon-sound').hidden = audio.muted
    button.querySelector('.icon-muted').hidden = !audio.muted
    button.setAttribute('aria-label', audio.muted ? 'Unmute' : 'Mute')
    button.setAttribute('aria-pressed', String(audio.muted))
  })
  const percent = String(Math.round(audio.volume * 100))
  $('#volumeTitle').value = percent
  $('#volumePause').value = percent
}

function toggleMute() {
  audio.unlock()
  audio.configure({ muted: !audio.muted, volume: audio.volume })
  saveAudio()
  audio.play('click', 0.6)
}

function setVolume(percent) {
  audio.unlock()
  audio.configure({ muted: audio.muted, volume: Number(percent) / 100 })
  saveAudio()
}

function pop(text, miss, tone = '') {
  const node = document.createElement('div')
  node.className = `floater${miss ? ' is-miss' : ''}${tone ? ` is-${tone}` : ''}`
  node.textContent = text
  $('#floatLayer').appendChild(node)
  window.setTimeout(() => node.remove(), 820)
}

function paintHud() {
  const step = tutorialStep()
  const route = liveRoute()
  $('#hudRoute').textContent = step ? 'Training' : `${String(route.id).padStart(2, '0')} ${route.name}`
  $('#hudMission').textContent = step ? step.title : hudGoal(route, run, run.parcelIndex)
  $('#hudScore').textContent = pad(run.score)
  $('#hudCombo').textContent = String(run.combo)
  $('#hudTips').textContent = String(profile.tips)
  const displayedWind = run.windFlipPending ?? run.wind
  $('#hudWind').textContent = Math.abs(displayedWind).toFixed(1)
  const arrow = $('#windArrow')
  arrow.style.transform = displayedWind < -0.05 ? 'scaleX(-1)' : 'scaleX(1)'
  arrow.style.opacity = Math.abs(displayedWind) < 0.05 ? '0.45' : '1'
  arrow.classList.toggle('is-flipping', run.windFlipPending !== null)
  const misses = $('#hudMisses')
  misses.innerHTML = ''
  const total = step ? 1 : route.maxMisses
  for (let i = 0; i < total; i += 1) {
    const pip = document.createElement('i')
    if (!step && i < run.misses) pip.className = 'is-used'
    misses.appendChild(pip)
  }
  const power = clamp((run.aimDy - 24) / 156, 0, 1)
  $('#powerFill').style.width = `${Math.round((run.aimDy <= 0 ? 0 : Math.max(power, run.aimDy / 180)) * 100)}%`
}

function paintTitle() {
  const route = routeById(profile.selected || 1)
  const first = !profile.tutorialSeen && profile.unlocked <= 1 && profile.cleared.length === 0
  app.classList.toggle('is-first-run', first)
  $('#titleLede').textContent = first
    ? 'Four crates on the first roof. Land two. Then take one more roof.'
    : 'The next roof is loaded. Land the crates, then take one more.'
  $('#btnStart').querySelector('.cg-copy').textContent = first ? 'Throw the first crate' : 'Start route'
  $('#titleRoute').textContent = `Route ${String(route.id).padStart(2, '0')} · ${route.name}`
  $('#titleMission').textContent = route.blurb
  $('#titleBest').textContent = `Best ${pad(profile.best)}`
  $('#titleTips').textContent = `Tips ${profile.tips}`
  $('#titleCleared').textContent = `Cleared ${profile.cleared.length}/${ROUTES.length}`
  const picker = $('#routePicker')
  picker.innerHTML = ''
  const highest = Math.max(profile.unlocked, ROUTES.length)
  for (let id = 1; id <= Math.max(highest, profile.unlocked); id += 1) {
    if (id > ROUTES.length + 4 && id > profile.unlocked) break
    const button = document.createElement('button')
    button.type = 'button'
    const locked = id > profile.unlocked
    button.className = locked ? 'is-locked' : id === profile.selected ? 'is-selected' : ''
    button.disabled = locked
    const number = String(id).padStart(2, '0')
    if (locked) {
      button.innerHTML = `<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="11" width="12" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M8 11V8a4 4 0 018 0v3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg><span class="cg-copy">${number}</span>`
      button.setAttribute('aria-label', `Route ${number} locked`)
    } else {
      const label = document.createElement('span')
      label.className = 'cg-copy'
      label.textContent = number
      button.appendChild(label)
    }
    button.addEventListener('click', () => {
      if (id > profile.unlocked) return
      profile.selected = id
      profile = writeProfile(profile)
      audio.play('click', 0.5)
      paintTitle()
    })
    picker.appendChild(button)
  }
}

function rollWind(route, fixed) {
  if (typeof fixed === 'number') {
    run.wind = fixed * (1 - 0.16 * profile.upgrades.vane)
    return
  }
  const calm = route.windMin === 0 && Math.random() < 0.3
  const mag = calm
    ? Math.random() * Math.min(0.1, route.windMax)
    : Math.max(route.windMin, 0) + Math.random() * (route.windMax - Math.max(route.windMin, 0))
  run.wind = (Math.random() < 0.5 ? -1 : 1) * mag * (1 - 0.16 * profile.upgrades.vane)
}

function rollTarget(route) {
  if (route.dualTarget) {
    const primaryLeft = Math.random() < 0.5
    const primaryX = primaryLeft ? -1.85 : 1.85
    const secondaryX = -primaryX
    const primaryZ = -10.9 + Math.random() * 1.05
    const secondaryZ = primaryZ + (Math.random() < 0.5 ? -0.5 : 0.5)
    lastTarget = { x: primaryX, z: primaryZ }
    run.targetScale = route.targetScale
    world.placeTarget(primaryX, primaryZ, route.targetScale, {
      x: secondaryX,
      z: secondaryZ,
      scale: Math.min(1, route.targetScale * 0.94),
    })
    return
  }
  let x = 0
  let z = -10
  for (let attempt = 0; attempt < 8; attempt += 1) {
    x = route.xRange[0] + Math.random() * (route.xRange[1] - route.xRange[0])
    z = route.zRange[0] + Math.random() * (route.zRange[1] - route.zRange[0])
    if (Math.hypot(x - lastTarget.x, z - lastTarget.z) >= 1.3) break
  }
  lastTarget = { x, z }
  const scale = route.targetScale
  run.targetScale = scale
  world.placeTarget(x, z, scale)
}

function presentRoute(route) {
  world.setScene(route.scene)
  world.setSkin(route.parcel)
  world.setAnimals(route.animals || [])
  world.setMotion(route.moveAmplitude, route.movePeriod)
}

function prepareRound(delay = 0) {
  run.ready = false
  run.flying = false
  run.resolving = true
  run.charging = false
  run.aimDx = 0
  run.aimDy = 0
  run.windFlipTriggered = false
  run.windFlipPending = null
  run.releaseQueued = false
  run.keyboardCharging = false
  window.clearTimeout(windFlipTimer)
  world.commitWind()
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    if (mode !== 'playing' || run.tutorialIndex !== null) return
    const route = liveRoute()
    world.resetPackage()
    rollTarget(route)
    rollWind(route)
    run.resolving = false
    run.ready = true
    $('#graceChip').hidden = true
    paintHud()
  }, delay)
}

function beginRoute(id) {
  audio.unlock()
  audio.play('click', 0.7)
  const fresh = resetRun(id)
  Object.assign(run, fresh)
  run.tutorialIndex = null
  profile.selected = id
  profile = writeProfile(profile)
  const route = liveRoute()
  audio.setRoute(route.id)
  presentRoute(route)
  world.resetPackage()
  world.commitWind()
  setMode('playing')
  $('#tutorialCard').hidden = true
  $('#graceChip').hidden = false
  $('#graceCount').textContent = '1'
  paintHud()
  const started = performance.now()
  window.clearTimeout(timer)
  const grace = window.setInterval(() => {
    const left = Math.max(1, Math.ceil((700 - (performance.now() - started)) / 400))
    $('#graceCount').textContent = String(left)
  }, 200)
  timer = window.setTimeout(() => {
    window.clearInterval(grace)
    prepareRound(0)
    showMechanicHint(route)
  }, 700)
}

function showMechanicHint(route) {
  const hint = nextMechanic(route, profile.hintsSeen)
  const card = $('#hintCard')
  window.clearTimeout(hintTimer)
  if (!hint) {
    card.hidden = true
    return
  }
  $('#hintText').textContent = hint.text
  card.hidden = false
  profile.hintsSeen = [...profile.hintsSeen, hint.id]
  profile = writeProfile(profile)
  hintTimer = window.setTimeout(() => { card.hidden = true }, 7000)
}

function dismissHint() {
  window.clearTimeout(hintTimer)
  $('#hintCard').hidden = true
}

function showTutorialStep() {
  const step = tutorialStep()
  if (!step) return
  $('#tutorKicker').textContent = `${step.kicker} of ${TUTORIAL.length}`
  $('#tutorTitle').textContent = step.title
  $('#tutorBody').textContent = run.tutorialNote || step.body
  $('#btnTutorialNext').hidden = step.action !== 'enter'
  $('#btnTutorialSkip').querySelector('.cg-copy').textContent = run.tutorialReplay ? 'Back to route' : 'Skip to route 1'
  $('#tutorialCard').hidden = false
  world.setScene('depot')
  world.setSkin(routeById(1).parcel)
  world.setAnimals([])
  world.setMotion(0, 0)
  world.resetPackage()
  run.ready = step.action !== 'enter'
  run.flying = false
  run.resolving = false
  run.charging = false
  run.aimDx = 0
  run.aimDy = 0
  run.windFlipTriggered = false
  run.windFlipPending = null
  run.releaseQueued = false
  run.keyboardCharging = false
  window.clearTimeout(windFlipTimer)
  world.commitWind()
  if (step.target) {
    run.targetScale = step.scale
    world.placeTarget(step.target[0], step.target[1], step.scale)
    rollWind(null, step.wind)
  } else {
    world.placeTarget(0, -10.4, 1.6)
    run.wind = 0
  }
  setMode('playing')
  paintHud()
}

function beginTutorial(replay) {
  audio.unlock()
  audio.play('click', 0.6)
  run.tutorialReplay = replay
  run.tutorialIndex = 0
  run.tutorialNote = ''
  if (!replay) {
    const fresh = resetRun(1)
    fresh.tutorialIndex = 0
    Object.assign(run, fresh)
  }
  showTutorialStep()
}

function finishTutorial() {
  profile.tutorialSeen = true
  profile = writeProfile(profile)
  run.tutorialIndex = null
  run.tutorialNote = ''
  if (run.tutorialReplay) {
    run.tutorialReplay = false
    world.resetPackage()
    const route = liveRoute()
    presentRoute(route)
    rollTarget(route)
    rollWind(route)
    run.ready = true
    run.flying = false
    run.resolving = false
    setMode('paused')
    paintHud()
    return
  }
  beginRoute(profile.selected || 1)
}

function advanceTutorial() {
  run.tutorialNote = ''
  run.tutorialIndex += 1
  if (run.tutorialIndex >= TUTORIAL.length) finishTutorial()
  else showTutorialStep()
}

function skipTutorial() {
  audio.play('click', 0.5)
  finishTutorial()
}

function openShop(back) {
  shopBack = back
  audio.play('click', 0.5)
  renderShop()
  setMode('shop')
}

const SHOP_TONES = ['tone-coral', 'tone-gold', 'tone-teal', 'tone-paper']

function renderShop() {
  $('#shopTips').textContent = String(profile.tips)
  const next = shopBack === 'result-pass'
  $('#btnShopNext').hidden = shopBack === 'title' || shopBack === 'paused'
  $('#btnShopNext').querySelector('.cg-copy').textContent = next ? 'Start next route' : 'Retry route'
  const grid = $('#shopGrid')
  grid.innerHTML = ''
  UPGRADES.forEach((spec, index) => {
    const rank = profile.upgrades[spec.id] || 0
    const maxed = rank >= spec.max
    const cost = maxed ? 0 : spec.costs[rank]
    const affordable = !maxed && profile.tips >= cost
    const card = document.createElement('article')
    card.className = `upgrade ${SHOP_TONES[index % SHOP_TONES.length]} ${maxed ? 'is-max' : affordable ? 'is-ready' : 'is-poor'}`
    const top = document.createElement('div')
    top.className = 'upgrade-top'
    const icon = document.createElement('div')
    icon.className = 'upgrade-icon'
    icon.innerHTML = UPGRADE_ICONS[spec.id] || ''
    const heading = document.createElement('div')
    const title = document.createElement('h3')
    title.className = 'cg-copy'
    title.textContent = spec.name
    const pips = document.createElement('div')
    pips.className = 'rank-pips'
    pips.setAttribute('aria-label', `Rank ${rank} of ${spec.max}`)
    for (let mark = 0; mark < spec.max; mark += 1) {
      const pip = document.createElement('i')
      if (mark < rank) pip.className = 'is-on'
      pips.appendChild(pip)
    }
    heading.append(title, pips)
    top.append(icon, heading)
    const effect = document.createElement('p')
    effect.className = 'effect cg-copy'
    effect.textContent = effectLine(spec.id, rank, spec.max)
    const blurb = document.createElement('p')
    blurb.className = 'blurb cg-copy'
    blurb.textContent = spec.blurb
    const buyRow = document.createElement('div')
    buyRow.className = 'upgrade-buy'
    const price = document.createElement('span')
    price.className = 'price-pill cg-copy'
    price.textContent = maxed ? 'Maxed' : `${cost} tips`
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'btn'
    const label = document.createElement('span')
    label.className = 'cg-copy'
    if (maxed) {
      label.textContent = 'Maxed'
      button.disabled = true
    } else if (affordable) {
      label.textContent = 'Buy'
      button.addEventListener('click', () => buyUpgrade(spec.id))
    } else {
      label.textContent = 'Need tips'
      button.disabled = true
    }
    button.appendChild(label)
    buyRow.append(price, button)
    card.append(top, effect, blurb, buyRow)
    grid.appendChild(card)
  })
}

function buyUpgrade(id) {
  const spec = UPGRADES.find((item) => item.id === id)
  const rank = profile.upgrades[id] || 0
  if (!spec || rank >= spec.max) return
  const cost = spec.costs[rank]
  if (profile.tips < cost) return
  profile.tips -= cost
  profile.upgrades[id] = rank + 1
  profile = writeProfile(profile)
  audio.play('confirm', 0.8)
  renderShop()
  paintTitle()
}

function startFromTitle() {
  if (!profile.tutorialSeen) beginTutorial(false)
  else beginRoute(profile.selected || 1)
}

function goTitle() {
  window.clearTimeout(timer)
  run.ready = false
  run.flying = false
  run.tutorialIndex = null
  world.resetPackage()
  world.setAnimals([])
  dismissHint()
  world.setScene(routeById(profile.selected || 1).scene)
  world.setSkin(routeById(profile.selected || 1).parcel)
  audio.setRoute(1)
  setMode('title')
  paintTitle()
}

function pauseGame() {
  if (mode !== 'playing') return
  audio.play('click', 0.4)
  setMode('paused')
}

function resumeGame() {
  if (mode !== 'paused') return
  audio.play('click', 0.4)
  setMode('playing')
  if (run.tutorialIndex !== null) $('#tutorialCard').hidden = false
}

function award(kind) {
  run.parcelIndex += 1
  if (kind === 'miss') {
    run.misses += 1
    run.combo = 0
    run.centerStreak = 0
    audio.play('error', 0.75)
    if (!run.fragileCrack) pop('Miss', true)
    run.fragileCrack = false
    return
  }
  run.delivered += 1
  run.combo += 1
  run.maxCombo = Math.max(run.maxCombo, run.combo)
  const comboBonus = run.combo >= 2 ? Math.min(run.combo, 5) * 10 : 0
  let points = 25 + comboBonus
  if (kind === 'bullseye') {
    run.bullseyes += 1
    run.centerStreak += 1
    points = 100 + comboBonus
    if (run.centerStreak === 3) points += 100
    audio.play('bong', 0.75)
    audio.play('hit', 0.65)
    world.pulseTarget()
  } else if (kind === 'delivered') {
    run.centerStreak = 0
    points = 60 + comboBonus
    audio.play('confirm', 0.8)
  } else {
    run.centerStreak = 0
    audio.play('confirm', 0.55)
  }
  run.score += points
  const tips = tipValue(kind, profile.upgrades.jar)
  run.tipsEarned += tips
  profile.tips += tips
  profile = writeProfile(profile)
  pop(`+${points}`, false)
  pop(`+${tips} tips`, false, 'tip')
  if (run.combo >= 2) audio.play('switch', 0.45)
}

function resolveThrow(kind) {
  run.flying = false
  run.ready = false
  run.resolving = true
  run.charging = false
  world.hideAim()
  if (run.tutorialIndex !== null) {
    resolveTutorial(kind)
    return
  }
  const route = liveRoute()
  kind = landingForRoute(route, kind)
  award(kind)
  paintHud()
  window.clearTimeout(timer)
  if (run.misses >= route.maxMisses || run.parcelIndex >= route.parcels) {
    timer = window.setTimeout(finishRoute, 780)
  } else {
    timer = window.setTimeout(() => prepareRound(0), 680)
  }
}

function resolveTutorial(kind) {
  const step = tutorialStep()
  const success = step.action === 'bullseye' ? kind === 'bullseye' : kind !== 'miss'
  if (success) {
    audio.play(kind === 'bullseye' ? 'bong' : 'confirm', 0.7)
    pop(kind === 'bullseye' ? 'Bullseye' : 'Nice throw', false)
    window.setTimeout(advanceTutorial, 650)
    return
  }
  run.tutorialNote = step.action === 'bullseye'
    ? 'Close. The coral ring is the center. Try that throw again.'
    : 'The street caught it. Charge a little more and release.'
  audio.play('error', 0.6)
  window.setTimeout(showTutorialStep, 650)
}

function starCount(route) {
  const rate = route.parcels ? run.bullseyes / route.parcels : 0
  if (rate >= 0.6) return 3
  if (rate >= 0.3) return 2
  return 1
}

function paintStars(count) {
  const node = $('#resultStars')
  const star = (on) => `<svg class="star${on ? ' is-on' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.4l2.55 5.4 5.95.8-4.35 4.1 1.1 5.9L12 15.8 6.75 18.6l1.1-5.9L3.5 8.6l5.95-.8z"/></svg>`
  node.innerHTML = [1, 2, 3].map((index) => star(index <= count)).join('')
  node.setAttribute('aria-label', `${count} of 3 stars`)
}

let scoreFrame = 0
function animateScore(value) {
  const node = $('#resultScore')
  window.cancelAnimationFrame(scoreFrame)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    node.textContent = pad(value)
    return
  }
  const started = performance.now()
  const step = (now) => {
    const t = Math.min(1, (now - started) / 700)
    node.textContent = pad(value * (1 - (1 - t) ** 3))
    if (t < 1) scoreFrame = window.requestAnimationFrame(step)
  }
  node.textContent = pad(0)
  scoreFrame = window.requestAnimationFrame(step)
}

function finishRoute() {
  const route = liveRoute()
  const previousBest = profile.best
  const previousRoute = Number(profile.routeBest[route.id] || 0)
  const alreadyOpen = profile.unlocked > route.id
  run.passed = passedRoute(route, run)
  if (run.passed) {
    if (!profile.cleared.includes(route.id)) profile.cleared.push(route.id)
    profile.unlocked = Math.max(profile.unlocked, route.id + 1)
    const bonus = clearBonus(route, profile.upgrades.jar)
    profile.tips += bonus
    run.tipsEarned += bonus
    profile.selected = route.id + 1
    audio.sting('win')
  } else {
    profile.selected = route.id
    audio.sting('lose')
  }
  profile.best = Math.max(profile.best, run.score)
  profile.routeBest[route.id] = Math.max(previousRoute, run.score)
  profile = writeProfile(profile)
  const record = run.score > previousBest || run.score > previousRoute
  const stars = starCount(route)
  $('#resultKicker').textContent = `Route ${String(route.id).padStart(2, '0')} · ${route.name}`
  $('#resultTitle').textContent = resultHeading(run.passed, run)
  $('#resultStamp').hidden = !record
  paintStars(stars)
  animateScore(run.score)
  $('#resultTipsPill').textContent = `+${run.tipsEarned} tips`
  if (run.passed && !alreadyOpen) {
    $('#resultUnlock').textContent = nextRoofPitch(route)
  } else if (run.passed) {
    $('#resultUnlock').textContent = 'Tips saved. The next roof is ready when you are.'
  } else {
    $('#resultUnlock').textContent = retryPitch(route, run)
  }
  $('#btnResultNext').querySelector('.cg-copy').textContent = continueLabel(true, route.id)
  $('#btnResultRetry').querySelector('.cg-copy').textContent = continueLabel(false, route.id)
  $('#resultMission').textContent = `${run.passed ? 'Mission complete' : 'Mission incomplete'} · ${progressLine(route, run)}`
  $('#resultBest').textContent = pad(profile.best)
  $('#resultLanded').textContent = `${run.delivered}/${route.parcels}`
  $('#resultBull').textContent = String(run.bullseyes)
  $('#resultCombo').textContent = String(run.maxCombo)
  $('#resultTips').textContent = String(run.tipsEarned)
  $('#resultWallet').textContent = String(profile.tips)
  $('#btnResultNext').hidden = !run.passed
  $('#btnResultNext').classList.toggle('btn-primary', run.passed)
  $('#btnResultPrimary').hidden = !run.passed
  $('#btnResultPrimary').querySelector('.cg-copy').textContent = 'Open depot'
  $('#btnResultRetry').classList.toggle('btn-primary', !run.passed)
  run.ready = false
  setMode('result')
}

function nextRouteId() {
  return run.passed ? run.routeId + 1 : run.routeId
}

function launchThrow() {
  dismissHint()
  const step = tutorialStep()
  if (!run.ready || run.flying || run.resolving || mode !== 'playing') return
  if (run.windFlipPending !== null) {
    run.releaseQueued = true
    return
  }
  if (step && (step.action === 'charge' || step.action === 'aim' || step.action === 'enter')) {
    if (step.action === 'charge') {
      const power = (run.aimDy - 24) / 156
      if (power >= 0.62) advanceTutorial()
      else {
        run.tutorialNote = 'Keep holding until the bar passes the notch.'
        run.aimDy = 0
        run.charging = false
        showTutorialStep()
      }
    }
    run.charging = false
    run.aimDy = step && step.action === 'aim' ? run.aimDy : 0
    return
  }
  if (run.aimDy < 24) {
    run.charging = false
    run.aimDy = 0
    world.hideAim()
    return
  }
  world.launch(run.aimDx, run.aimDy, run.wind, mods())
  run.flying = true
  run.ready = false
  run.charging = false
  run.keyboardCharging = false
  audio.play('throw', 0.8)
  paintHud()
}

function beginWindFlip() {
  const route = liveRoute()
  if (!shouldBeginWindFlip(route, {
    triggered: run.windFlipTriggered,
    charging: run.charging,
    tutorial: run.tutorialIndex !== null,
    power: (run.aimDy - 24) / 156,
  })) return
  run.windFlipTriggered = true
  run.windFlipPending = Math.abs(run.wind) < 0.05 ? -0.45 : -run.wind
  world.previewWind(run.windFlipPending)
  paintHud()
  pop('Wind turning', false, 'wind')
  window.clearTimeout(windFlipTimer)
  windFlipTimer = window.setTimeout(() => {
    if (run.windFlipPending === null) return
    run.wind = run.windFlipPending
    run.windFlipPending = null
    world.commitWind()
    paintHud()
    if (run.ready && (run.charging || Math.abs(run.aimDx) > 1 || run.aimDy > 20)) {
      world.setAim(run.aimDx, Math.max(24, run.aimDy), run.wind, mods())
    }
    if (run.releaseQueued) {
      run.releaseQueued = false
      launchThrow()
    }
  }, 180)
}

function updateAim(dt) {
  if (mode !== 'playing' || !run.ready || run.flying) return
  let aimRate = 0
  if (held.has('ArrowRight') || held.has('KeyD')) aimRate += 140
  if (held.has('ArrowLeft') || held.has('KeyA')) aimRate -= 140
  if (aimRate) run.aimDx = clamp(run.aimDx + aimRate * dt, -120, 120)
  let powerRate = 0
  if (run.charging || held.has('KeyW') || held.has('ArrowUp')) powerRate += 78
  if (held.has('KeyS') || held.has('ArrowDown')) powerRate -= 90
  if (powerRate) run.aimDy = clamp(run.aimDy + powerRate * dt, 0, 180)
  beginWindFlip()
  const step = tutorialStep()
  if (step?.action === 'charge' && (run.aimDy - 24) / 156 >= 0.62) {
    run.charging = false
    advanceTutorial()
    return
  }
  if (step?.action === 'aim' && Math.abs(run.aimDx) >= 36) {
    advanceTutorial()
    return
  }
  if (run.ready && (run.charging || Math.abs(run.aimDx) > 1 || run.aimDy > 20)) {
    world.setAim(run.aimDx, Math.max(24, run.aimDy), run.wind, mods())
  }
  paintHud()
}

function onKeyDown(event) {
  audio.unlock()
  if (event.code === 'Space') event.preventDefault()
  if (event.code === 'KeyM' && !event.repeat) {
    toggleMute()
    return
  }
  if (event.code === 'KeyP' && !event.repeat) {
    if (mode === 'playing') pauseGame()
    else if (mode === 'paused') resumeGame()
    return
  }
  if (event.code === 'Enter' && !event.repeat) {
    if (mode === 'title') startFromTitle()
    else if (mode === 'paused') resumeGame()
    else if (mode === 'result') {
      if (run.passed) beginRoute(nextRouteId())
      else beginRoute(run.routeId)
    } else if (mode === 'shop') {
      if (!$('#btnShopNext').hidden) {
        if (shopBack === 'result-pass') beginRoute(nextRouteId())
        else beginRoute(run.routeId)
      } else closeShop()
    } else if (tutorialStep()?.action === 'enter') advanceTutorial()
    return
  }
  if (event.repeat) return
  held.add(event.code)
  if ((event.code === 'ArrowLeft' || event.code === 'KeyA') && run.ready) run.aimDx = clamp(run.aimDx - 4, -120, 120)
  if ((event.code === 'ArrowRight' || event.code === 'KeyD') && run.ready) run.aimDx = clamp(run.aimDx + 4, -120, 120)
  if (event.code === 'Space') {
    if (swallowSpace) return
    if (mode === 'title') {
      swallowSpace = true
      startFromTitle()
      return
    }
    if (mode === 'playing' && run.ready && !run.flying) {
      run.charging = true
      run.keyboardCharging = true
      run.aimDy = Math.max(run.aimDy, 24)
      audio.play('click', 0.25)
    }
  }
}

function onKeyUp(event) {
  held.delete(event.code)
  if (event.code === 'Space') {
    event.preventDefault()
    if (swallowSpace) {
      swallowSpace = false
      return
    }
    if (run.charging || run.aimDy > 0) launchThrow()
    if (run.windFlipPending === null) run.keyboardCharging = false
  }
}

function onPointerDown(event) {
  audio.unlock()
  if (event.button !== 0) return
  if (mode === 'title' && event.target === world.canvas) {
    event.preventDefault()
    startFromTitle()
    return
  }
  if (mode !== 'playing' || !run.ready || run.flying || event.target !== world.canvas) return
  event.preventDefault()
  pointer = { x: event.clientX, y: event.clientY, id: event.pointerId }
  run.charging = true
  run.keyboardCharging = false
  world.canvas.setPointerCapture?.(event.pointerId)
}

function onPointerMove(event) {
  if (!pointer || pointer.id !== event.pointerId) return
  event.preventDefault()
  run.aimDx = clamp((event.clientX - pointer.x) / scale, -120, 120)
  run.aimDy = clamp((pointer.y - event.clientY) / scale, 0, 180)
  beginWindFlip()
}

function onPointerUp(event) {
  if (!pointer || pointer.id !== event.pointerId) return
  pointer = null
  if (run.charging) launchThrow()
}

function closeShop() {
  audio.play('click', 0.4)
  if (shopBack === 'paused') setMode('paused')
  else if (shopBack === 'result-pass' || shopBack === 'result-fail') setMode('result')
  else goTitle()
}

$('#btnStart').addEventListener('click', startFromTitle)
$('#btnHow').addEventListener('click', () => beginTutorial(false))
$('#btnShopTitle').addEventListener('click', () => openShop('title'))
$('#btnTutorialNext').addEventListener('click', advanceTutorial)
$('#btnTutorialSkip').addEventListener('click', skipTutorial)
$('#btnPause').addEventListener('click', pauseGame)
$('#muteHud').addEventListener('click', toggleMute)
$('#muteTitle').addEventListener('click', toggleMute)
$('#volumeTitle').addEventListener('input', (event) => setVolume(event.target.value))
$('#volumePause').addEventListener('input', (event) => setVolume(event.target.value))
$('#btnResume').addEventListener('click', resumeGame)
$('#btnPauseHow').addEventListener('click', () => beginTutorial(true))
$('#btnPauseShop').addEventListener('click', () => openShop('paused'))
$('#btnPauseRetry').addEventListener('click', () => beginRoute(run.routeId))
$('#btnPauseTitle').addEventListener('click', goTitle)
$('#btnResultPrimary').addEventListener('click', () => {
  if (run.passed) openShop('result-pass')
  else beginRoute(run.routeId)
})
$('#btnResultNext').addEventListener('click', () => beginRoute(nextRouteId()))
$('#btnResultRetry').addEventListener('click', () => beginRoute(run.routeId))
$('#btnResultTitle').addEventListener('click', goTitle)
$('#btnShopNext').addEventListener('click', () => beginRoute(shopBack === 'result-pass' ? nextRouteId() : run.routeId))
$('#btnShopBack').addEventListener('click', closeShop)
world.canvas.addEventListener('pointerdown', onPointerDown, { passive: false })
world.canvas.addEventListener('pointermove', onPointerMove, { passive: false })
world.canvas.addEventListener('pointerup', onPointerUp)
world.canvas.addEventListener('pointercancel', onPointerUp)
window.addEventListener('keydown', onKeyDown)
window.addEventListener('keyup', onKeyUp)
window.addEventListener('resize', fit)
window.addEventListener('pointerdown', () => audio.unlock(), { once: false })

paintAudio()
paintTitle()
world.setScene('depot')
world.setSkin(routeById(1).parcel)
world.placeTarget(0, -10.4, 1.5)
world.resetPackage()
fit()
setMode('title')

let lastFrame = performance.now()
function tick(now) {
  const dt = Math.min(0.033, Math.max(0, (now - lastFrame) / 1000))
  lastFrame = now
  if (mode !== 'paused') simNow = now
  if (mode === 'playing') updateAim(dt)
  const event = world.step(mode === 'paused' ? 0 : dt, simNow, run.wind, profile.upgrades.calm)
  if (event.bounced) audio.play('bounce', 0.35)
  if (event.animal) {
    run.animalHits += 1
    run.lastAnimal = event.animal
    const line = event.animal === 'dog' ? 'The dog bumped it' : event.animal === 'chicken' ? 'Chicken crossing' : 'The cat swatted it'
    pop(line, true)
    audio.play('hit', 0.6)
  }
  if (event.done && run.flying) resolveThrow(event.kind)
  world.render()
  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)

async function bootSdk() {
  const started = performance.now()
  while (!window.CrazyGames?.SDK && performance.now() - started < 1200) {
    await new Promise((resolve) => window.setTimeout(resolve, 40))
  }
  const sdk = window.CrazyGames?.SDK
  if (!sdk) return
  try {
    await sdk.init()
    sdk.game.loadingStart()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    sdk.game.loadingStop()
    bridge.sdk = sdk
    syncLive()
  } catch { /* preview without the portal SDK */ }
}
bootSdk()

if (new URLSearchParams(location.search).has('playtest')) {
  window.__cg = {
    snapshot() {
      return {
        mode,
        routeId: run.routeId,
        ready: run.ready,
        flying: run.flying,
        resolving: run.resolving,
        score: run.score,
        delivered: run.delivered,
        misses: run.misses,
        bullseyes: run.bullseyes,
        parcels: run.tutorialIndex === null ? liveRoute().parcels : 0,
        goal: run.tutorialIndex === null ? liveRoute().deliveredGoal : 0,
        passed: run.passed,
        wind: run.wind,
        windFlipTriggered: run.windFlipTriggered,
        windFlipPending: run.windFlipPending,
        moving: run.tutorialIndex === null && liveRoute().moveAmplitude > 0,
        animals: run.tutorialIndex === null ? (liveRoute().animals || []).map((animal) => animal.type) : [],
        animalHits: run.animalHits,
        lastAnimal: run.lastAnimal,
        aim: run.aimDx,
        charge: run.aimDy,
        tutorial: run.tutorialIndex,
        tutorialAction: tutorialStep()?.action || null,
        target: { ...world.target },
        scene: world.sceneName,
        district: world.districtMetrics,
        windPropDirection: world.windPropDirection,
        actors: world.actors.map((actor) => ({ type: actor.type, x: actor.x, z: actor.z })),
        hint: $('#hintCard').hidden ? '' : $('#hintText').textContent,
        tips: profile.tips,
        unlocked: profile.unlocked,
        best: profile.best,
      }
    },
    plan() {
      return planThrow({
        targetX: world.target.x,
        targetZ: world.target.z,
        wind: run.wind,
        mods: mods(),
        targetScale: world.target.scale,
      })
    },
    startRoute(id) {
      const routeId = clamp(Math.round(Number(id) || 1), 1, 10)
      profile.unlocked = Math.max(profile.unlocked, routeId)
      profile.selected = routeId
      profile.tutorialSeen = true
      profile = writeProfile(profile)
      beginRoute(routeId)
    },
    showCrack() {
      world.previewLanding({ cracked: true })
      pop('Fragile crate cracked', true, 'fragile')
    },
    showLanding({ secondary = false } = {}) {
      world.previewLanding({ secondary })
      pop(secondary ? '+12 tips' : '+18 tips', false, 'tip')
    },
    triggerWindFlip() {
      run.ready = true
      run.charging = true
      run.keyboardCharging = true
      run.aimDy = 72
      beginWindFlip()
    },
    resolve(kind) {
      resolveThrow(kind)
    },
  }
}
