import * as THREE from 'three'
import './styles.css'
import { applyI18n, line, locale, t } from './i18n.js'
import {
  playAim,
  playBounce,
  playBullseye,
  playClick,
  playCombo,
  playComplete,
  playDelivered,
  playFail,
  playMiss,
  playStart,
  playThrow,
  resumeAudio,
} from './sounds.js'

const $ = (selector) => document.querySelector(selector)
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const random = (min, max) => min + Math.random() * (max - min)

applyI18n(document)

const ui = {
  shell: $('#app'), stage: $('#stage'), hud: $('#hud'), windBadge: $('#windBadge'), windArrow: $('#windArrow'), windValue: $('#windValue'),
  parcelValue: $('#parcelValue'), scoreValue: $('#scoreValue'), missDots: [...document.querySelectorAll('#missDots i')],
  aimUi: $('#aimUi'), powerFill: $('#powerFill'), graceCard: $('#graceCard'), graceCount: $('#graceCount'),
  popLayer: $('#popLayer'), bubble: $('#bubble'), comboBadge: $('#comboBadge'),
  startScreen: $('#startScreen'), gameScreen: $('#gameScreen'), endScreen: $('#endScreen'), playHint: $('#playHint'),
  startButton: $('#startButton'), againButton: $('#againButton'), homeButton: $('#homeButton'),
  resultKicker: $('#resultKicker'), finalScore: $('#finalScore'), bestScore: $('#bestScore'), deliveredValue: $('#deliveredValue'),
  bullseyeValue: $('#bullseyeValue'), maxComboValue: $('#maxComboValue'), recordStamp: $('#recordStamp'),
}

const BEST_KEY = 'rooftop_delivery_best'
const TOTAL_PARCELS = 8
const MAX_MISSES = 3
const GRACE_MS = 1500
const GRAVITY = 10.8
const PACKAGE_START = new THREE.Vector3(0, 1.15, 2.6)
const ROOF_TOP = 0.5
const LANDING_Y = 0.79

const state = {
  isPlaying: false,
  isGameOver: false,
  ready: false,
  aiming: false,
  flying: false,
  resolving: false,
  score: 0,
  best: Number(localStorage.getItem(BEST_KEY) || 0),
  parcelIndex: 0,
  misses: 0,
  delivered: 0,
  bullseyes: 0,
  combo: 0,
  maxCombo: 0,
  centerStreak: 0,
  wind: 0,
  unlockAt: 0,
  pointerStart: { x: 0, y: 0 },
  aimDx: 0,
  aimDy: 0,
  velocity: new THREE.Vector3(),
  angularVelocity: new THREE.Vector3(),
  bounceCount: 0,
  firstRoofContact: 0,
  lastTarget: new THREE.Vector3(99, 0, 99),
  keyboardPower: 0,
  keyboardAim: 0,
  keyboardCharging: false,
}

const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(0x8d7893, 0.022)

const camera = new THREE.PerspectiveCamera(47, 1, 0.1, 120)
camera.position.set(0, 7.8, 15.8)
camera.lookAt(0, 1.1, -5.2)

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.08
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
ui.stage.appendChild(renderer.domElement)

const hemi = new THREE.HemisphereLight(0xffdfba, 0x3b3d57, 2.45)
scene.add(hemi)
const sun = new THREE.DirectionalLight(0xffc48f, 4.2)
sun.position.set(-7, 14, 8)
sun.castShadow = true
sun.shadow.mapSize.set(1024, 1024)
sun.shadow.camera.left = -15
sun.shadow.camera.right = 15
sun.shadow.camera.top = 18
sun.shadow.camera.bottom = -8
scene.add(sun)
const rim = new THREE.DirectionalLight(0x79d7d2, 1.7)
rim.position.set(10, 6, -15)
scene.add(rim)

const city = new THREE.Group()
scene.add(city)

const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xe9d7b7, roughness: 0.93, metalness: 0.02 })
const startBuilding = makeBuilding(9.2, 8.5, 9.5, 0x625a70)
startBuilding.position.set(0, -4.25, 5)
city.add(startBuilding)
const targetBuilding = makeBuilding(9.2, 9.5, 14.5, 0x716678)
targetBuilding.position.set(0, -4.75, -11)
city.add(targetBuilding)

const startRoof = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.22, 9.7), roofMaterial)
startRoof.position.set(0, 0.38, 5)
startRoof.receiveShadow = true
city.add(startRoof)
const targetRoof = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.22, 14.7), roofMaterial)
targetRoof.position.set(0, 0.38, -11)
targetRoof.receiveShadow = true
city.add(targetRoof)

addRoofDetails()
addBackgroundCity()
addClouds()

const targetGroup = createTarget()
scene.add(targetGroup)

const packageGroup = createPackage()
packageGroup.position.copy(PACKAGE_START)
scene.add(packageGroup)

const trajectoryGroup = new THREE.Group()
const trajectoryDots = []
for (let i = 0; i < 18; i += 1) {
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.055 + i * 0.0015, 8, 6),
    new THREE.MeshBasicMaterial({ color: i < 11 ? 0xfff5de : 0x79d7d2, transparent: true, opacity: 0.78 - i * 0.025 }),
  )
  dot.visible = false
  trajectoryDots.push(dot)
  trajectoryGroup.add(dot)
}
scene.add(trajectoryGroup)

const windStreaks = createWindStreaks()
scene.add(windStreaks)

const particles = []
let lastTrailAt = 0
let resultTimer = 0
let bubbleTimer = 0
let lastFrame = performance.now()

function makeBuilding(width, height, depth, color) {
  const group = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.02 }),
  )
  // City blocks stay outside the shadow map; their large silhouettes otherwise create unstable wedges on mobile GPUs.
  body.castShadow = false
  // Large vertical faces can self-shadow and flicker on mobile GPUs; roofs carry the gameplay shadows.
  body.receiveShadow = false
  group.add(body)

  const windowMaterial = new THREE.MeshBasicMaterial({ color: 0xffd892, transparent: true, opacity: 0.72 })
  for (let row = 0; row < Math.floor(height / 1.15); row += 1) {
    for (let col = -1; col <= 1; col += 1) {
      if ((row + col + Math.round(width)) % 3 === 0) continue
      const windowMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.3), windowMaterial)
      windowMesh.position.set(col * 1.55, height / 2 - 0.8 - row * 1.05, depth / 2 + 0.011)
      group.add(windowMesh)
    }
  }
  return group
}

function addRoofDetails() {
  const dark = new THREE.MeshStandardMaterial({ color: 0x4a465d, roughness: 0.76 })
  const coral = new THREE.MeshStandardMaterial({ color: 0xe76a5b, roughness: 0.7 })
  const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.75, 8), dark)
  vent.position.set(-3.1, 0.88, -15.7)
  vent.castShadow = true
  city.add(vent)
  const waterTank = new THREE.Group()
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 1.05, 10), coral)
  tank.position.y = 1.55
  tank.castShadow = true
  waterTank.add(tank)
  for (const x of [-0.45, 0.45]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 0.12), dark)
    leg.position.set(x, 0.7, 0)
    waterTank.add(leg)
  }
  waterTank.position.set(3.2, 0.45, -16)
  city.add(waterTank)

  const antenna = new THREE.Group()
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 2.5, 6), dark)
  pole.position.y = 1.7
  antenna.add(pole)
  for (let i = 0; i < 3; i += 1) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1 - i * 0.18, 0.055, 0.055), coral)
    bar.position.set(0, 2.2 - i * 0.36, 0)
    antenna.add(bar)
  }
  antenna.position.set(-3.45, 0.45, -7.2)
  city.add(antenna)

  const railMat = new THREE.MeshStandardMaterial({ color: 0x595265, roughness: 0.68 })
  for (const x of [-4.05, 4.05]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.58, 7.2), railMat)
    rail.position.set(x, 0.77, 5)
    city.add(rail)
  }
}

function addBackgroundCity() {
  const palette = [0x514e69, 0x5d566d, 0x766575, 0x4b5369, 0x806a75]
  for (let i = 0; i < 20; i += 1) {
    const side = i % 2 === 0 ? -1 : 1
    const width = random(2.8, 5.4)
    const depth = random(3.5, 7.8)
    const height = random(4, 13)
    const building = makeBuilding(width, height, depth, palette[i % palette.length])
    building.position.set(side * random(7.2, 14.5), -height / 2 - random(0.2, 2.8), random(-30, 8))
    building.rotation.y = random(-0.08, 0.08)
    city.add(building)
  }
  const street = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 52),
    new THREE.MeshStandardMaterial({ color: 0x3e3d50, roughness: 1 }),
  )
  street.rotation.x = -Math.PI / 2
  street.position.set(0, -8.8, -8)
  scene.add(street)
  for (let i = 0; i < 9; i += 1) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.01, 1.3), new THREE.MeshBasicMaterial({ color: 0xf7d58b }))
    light.position.set(0, -8.76, 8 - i * 4.6)
    scene.add(light)
  }
}

function addClouds() {
  const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xffdac0, transparent: true, opacity: 0.18, depthWrite: false })
  for (let i = 0; i < 7; i += 1) {
    const cloud = new THREE.Group()
    for (let j = 0; j < 4; j += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(random(1.4, 2.7), 10, 7), cloudMaterial)
      puff.scale.y = 0.38
      puff.position.set(j * 1.3, random(-0.18, 0.2), random(-0.2, 0.2))
      cloud.add(puff)
    }
    cloud.position.set(random(-20, 12), random(8, 14), random(-42, -17))
    cloud.userData.speed = random(0.08, 0.18)
    scene.add(cloud)
    cloud.userData.isCloud = true
  }
}

function createTarget() {
  const group = new THREE.Group()
  const rings = [
    { inner: 0.1, outer: 0.85, color: 0xf05d4e, opacity: 0.92 },
    { inner: 0.9, outer: 1.7, color: 0xf7d58b, opacity: 0.72 },
    { inner: 1.78, outer: 2.7, color: 0xfff0d2, opacity: 0.42 },
  ]
  rings.forEach(({ inner, outer, color, opacity }, index) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(inner, outer, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = index * 0.006
    ring.userData.spin = (index % 2 ? -1 : 1) * (0.42 + index * 0.18)
    group.add(ring)
  })
  const beacon = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.18, 0),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  )
  beacon.position.y = 0.36
  beacon.userData.beacon = true
  group.add(beacon)
  group.position.set(0, ROOF_TOP + 0.015, -10.5)
  return group
}

function createPackage() {
  const group = new THREE.Group()
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.52, 0.48),
    new THREE.MeshStandardMaterial({ color: 0xf05d4e, roughness: 0.76, metalness: 0.01 }),
  )
  box.castShadow = true
  box.receiveShadow = true
  group.add(box)
  const tapeMaterial = new THREE.MeshStandardMaterial({ color: 0xf7d58b, roughness: 0.72 })
  const tapeTop = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.535, 0.49), tapeMaterial)
  group.add(tapeTop)
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.2), new THREE.MeshBasicMaterial({ map: makeLabelTexture() }))
  label.position.set(0.18, 0.03, 0.246)
  group.add(label)
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.48, 24),
    new THREE.MeshBasicMaterial({ color: 0x27283a, transparent: true, opacity: 0.22, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = -0.64
  shadow.userData.packageShadow = true
  group.add(shadow)
  return group
}

function makeLabelTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 160
  canvas.height = 92
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff5de'
  ctx.fillRect(0, 0, 160, 92)
  ctx.strokeStyle = '#27283a'
  ctx.lineWidth = 5
  ctx.strokeRect(6, 6, 148, 80)
  ctx.fillStyle = '#27283a'
  ctx.font = 'bold 22px Arial'
  ctx.fillText('RD / 08', 17, 34)
  ctx.fillStyle = '#f05d4e'
  ctx.fillRect(17, 48, 91, 9)
  ctx.fillRect(17, 65, 125, 7)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function createWindStreaks() {
  const group = new THREE.Group()
  const material = new THREE.MeshBasicMaterial({ color: 0x79d7d2, transparent: true, opacity: 0.42, depthWrite: false })
  for (let i = 0; i < 9; i += 1) {
    const streak = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, random(0.8, 1.8), 3, 6), material.clone())
    streak.rotation.z = Math.PI / 2
    streak.position.set(random(-10, 10), random(1.8, 6.2), random(-18, 2))
    streak.userData.speed = random(4.4, 7)
    streak.userData.baseOpacity = random(0.18, 0.48)
    group.add(streak)
  }
  return group
}

function setTarget() {
  let x
  let z
  let attempts = 0
  do {
    x = random(-2.7, 2.7)
    z = random(-13.5, -8.5)
    attempts += 1
  } while (attempts < 10 && Math.hypot(x - state.lastTarget.x, z - state.lastTarget.z) < 2.2)
  targetGroup.position.set(x, ROOF_TOP + 0.015, z)
  state.lastTarget.set(x, 0, z)
}

function setWind() {
  const calm = Math.random() < 0.2
  state.wind = calm ? random(-0.24, 0.24) : random(-1.2, 1.2)
  if (!calm && Math.abs(state.wind) < 0.25) state.wind = Math.sign(state.wind || 1) * 0.25
  ui.windValue.textContent = Math.abs(state.wind).toFixed(1)
  ui.windArrow.textContent = Math.abs(state.wind) < 0.12 ? '↔' : state.wind > 0 ? '→' : '←'
  ui.windArrow.style.transform = `scaleX(${state.wind < 0 ? -1 : 1})`
}

function resetPackage() {
  packageGroup.visible = true
  packageGroup.position.copy(PACKAGE_START)
  packageGroup.rotation.set(-0.06, 0.12, 0)
  packageGroup.scale.setScalar(1)
  state.velocity.set(0, 0, 0)
  state.angularVelocity.set(0, 0, 0)
  state.flying = false
  state.aiming = false
  state.bounceCount = 0
  state.firstRoofContact = 0
  hideTrajectory()
}

function prepareRound(delay = 0) {
  state.ready = false
  state.resolving = true
  clearTimeout(resultTimer)
  resultTimer = window.setTimeout(() => {
    if (!state.isPlaying) return
    resetPackage()
    setTarget()
    setWind()
    state.resolving = false
    state.ready = true
    ui.parcelValue.textContent = String(state.parcelIndex + 1)
    ui.playHint.classList.add('is-visible')
  }, delay)
}

function startGame() {
  resumeAudio()
  playStart()
  state.isPlaying = true
  state.isGameOver = false
  state.ready = false
  state.resolving = false
  state.score = 0
  state.parcelIndex = 0
  state.misses = 0
  state.delivered = 0
  state.bullseyes = 0
  state.combo = 0
  state.maxCombo = 0
  state.centerStreak = 0
  state.unlockAt = performance.now() + GRACE_MS
  updateHud()
  showScreen('game')
  ui.hud.classList.add('is-visible')
  ui.windBadge.classList.add('is-visible')
  ui.graceCard.classList.add('is-visible')
  ui.graceCount.textContent = '3'
  resetPackage()
  setTarget()
  setWind()
  let tick = 3
  const graceTicker = window.setInterval(() => {
    tick -= 1
    ui.graceCount.textContent = String(Math.max(1, tick))
    if (performance.now() >= state.unlockAt) {
      clearInterval(graceTicker)
      ui.graceCard.classList.remove('is-visible')
      state.ready = true
      ui.playHint.classList.add('is-visible')
    }
  }, 500)
}

function endGame(completed) {
  state.isPlaying = false
  state.isGameOver = true
  state.ready = false
  state.aiming = false
  state.flying = false
  hideTrajectory()
  ui.aimUi.classList.remove('is-visible')
  ui.playHint.classList.remove('is-visible')
  const previousBest = state.best
  state.best = Math.max(previousBest, state.score)
  localStorage.setItem(BEST_KEY, String(state.best))
  ui.resultKicker.textContent = completed ? t('shiftComplete') : t('shiftLost')
  ui.finalScore.textContent = formatScore(state.score)
  ui.bestScore.textContent = formatScore(state.best)
  ui.deliveredValue.textContent = `${state.delivered}/${TOTAL_PARCELS}`
  ui.bullseyeValue.textContent = String(state.bullseyes)
  ui.maxComboValue.textContent = String(state.maxCombo)
  ui.recordStamp.classList.toggle('is-visible', state.score > previousBest)
  completed ? playComplete() : playFail()
  showScreen('end')
}

function goHome() {
  clearTimeout(resultTimer)
  state.isPlaying = false
  state.isGameOver = false
  state.ready = false
  state.flying = false
  resetPackage()
  setTarget()
  setWind()
  ui.hud.classList.remove('is-visible')
  ui.windBadge.classList.remove('is-visible')
  ui.graceCard.classList.remove('is-visible')
  showScreen('start')
}

function showScreen(name) {
  const screens = { start: ui.startScreen, game: ui.gameScreen, end: ui.endScreen }
  Object.entries(screens).forEach(([key, screen]) => {
    const active = key === name
    screen.classList.toggle('is-active', active)
    screen.setAttribute('aria-hidden', String(!active))
  })
}

function beginAim(event) {
  if (!state.isPlaying || !state.ready || state.flying || state.resolving || performance.now() < state.unlockAt) return
  resumeAudio()
  playAim()
  state.aiming = true
  state.pointerStart.x = event.clientX
  state.pointerStart.y = event.clientY
  state.aimDx = 0
  state.aimDy = 0
  ui.gameScreen.classList.add('is-aiming')
  ui.aimUi.classList.add('is-visible')
  ui.playHint.classList.remove('is-visible')
  ui.gameScreen.setPointerCapture?.(event.pointerId)
  updateAimVisuals()
}

function moveAim(event) {
  if (!state.aiming) return
  state.aimDx = clamp(event.clientX - state.pointerStart.x, -120, 120)
  state.aimDy = clamp(state.pointerStart.y - event.clientY, 0, 180)
  updateAimVisuals()
}

function releaseAim(event) {
  if (!state.aiming) return
  ui.gameScreen.releasePointerCapture?.(event.pointerId)
  state.aiming = false
  ui.gameScreen.classList.remove('is-aiming')
  ui.aimUi.classList.remove('is-visible')
  if (state.aimDy < 24) {
    hideTrajectory()
    ui.playHint.classList.add('is-visible')
    return
  }
  launchPackage(state.aimDx, state.aimDy)
}

function velocityFromAim(dx, dy) {
  const power = clamp((dy - 24) / 156, 0, 1)
  return new THREE.Vector3(
    clamp(dx, -120, 120) / 28.57,
    5.5 + power * 2.8,
    -(6.2 + power * 4.8),
  )
}

function launchPackage(dx, dy) {
  const power = clamp((dy - 24) / 156, 0, 1)
  state.velocity.copy(velocityFromAim(dx, dy))
  state.angularVelocity.set(2.4 + power * 3.6, dx * 0.026, 2.1 + Math.abs(dx) * 0.018)
  state.ready = false
  state.flying = true
  state.bounceCount = 0
  state.firstRoofContact = 0
  lastTrailAt = 0
  hideTrajectory()
  playThrow()
}

function updateAimVisuals() {
  const power = clamp((state.aimDy - 24) / 156, 0, 1)
  ui.powerFill.style.height = `${Math.round(power * 100)}%`
  const velocity = velocityFromAim(state.aimDx, Math.max(24, state.aimDy))
  for (let i = 0; i < trajectoryDots.length; i += 1) {
    const time = (i + 1) * 0.105
    const dot = trajectoryDots[i]
    dot.position.set(
      PACKAGE_START.x + velocity.x * time + 0.5 * state.wind * time * time,
      PACKAGE_START.y + velocity.y * time - 0.5 * GRAVITY * time * time,
      PACKAGE_START.z + velocity.z * time,
    )
    dot.visible = dot.position.y > 0.46
  }
}

function hideTrajectory() {
  trajectoryDots.forEach((dot) => { dot.visible = false })
}

function resolveDelivery(kind) {
  if (!state.isPlaying || state.resolving) return
  state.resolving = true
  state.flying = false
  state.ready = false
  state.parcelIndex += 1
  const success = kind !== 'miss'
  let points = 0
  if (success) {
    state.delivered += 1
    state.combo += 1
    state.maxCombo = Math.max(state.maxCombo, state.combo)
    const comboBonus = state.combo >= 2 ? Math.min(state.combo, 5) * 10 : 0
    if (kind === 'bullseye') {
      state.bullseyes += 1
      state.centerStreak += 1
      points = 100 + comboBonus
      if (state.centerStreak === 3) points += 100
      playBullseye()
      burstParticles(0xf7d58b, 28)
      pulseTarget()
      showBubble(line('perfect'))
    } else if (kind === 'delivered') {
      state.centerStreak = 0
      points = 60 + comboBonus
      playDelivered()
      burstParticles(0x79d7d2, 22)
      showBubble(line('deliveredLine'))
    } else {
      state.centerStreak = 0
      points = 25 + comboBonus
      playDelivered()
      burstParticles(0xfff0d2, 18)
      showBubble(line('edgeLine'))
    }
    state.score += points
    popScore(`+${points}`, false)
    if (state.combo >= 2) {
      showCombo()
      playCombo(state.combo)
    }
  } else {
    state.misses += 1
    state.combo = 0
    state.centerStreak = 0
    playMiss()
    showBubble(line('missLine'))
    popScore(t('miss'), true)
    ui.shell.classList.remove('is-shaking')
    void ui.shell.offsetWidth
    ui.shell.classList.add('is-shaking')
  }
  updateHud()
  if (state.misses >= MAX_MISSES || state.parcelIndex >= TOTAL_PARCELS) {
    resultTimer = window.setTimeout(() => endGame(state.parcelIndex >= TOTAL_PARCELS && state.misses < MAX_MISSES), 1050)
  } else {
    prepareRound(900)
  }
}

function evaluateLanding() {
  const dx = packageGroup.position.x - targetGroup.position.x
  const dz = packageGroup.position.z - targetGroup.position.z
  const distance = Math.hypot(dx, dz)
  if (distance <= 0.85) resolveDelivery('bullseye')
  else if (distance <= 1.7) resolveDelivery('delivered')
  else resolveDelivery('edge')
}

function updatePackage(dt, now) {
  if (!state.flying) return
  state.velocity.x += state.wind * dt
  state.velocity.y -= GRAVITY * dt
  packageGroup.position.addScaledVector(state.velocity, dt)
  packageGroup.rotation.x += state.angularVelocity.x * dt
  packageGroup.rotation.y += state.angularVelocity.y * dt
  packageGroup.rotation.z += state.angularVelocity.z * dt

  if (now - lastTrailAt > 70 && state.bounceCount === 0) {
    lastTrailAt = now
    spawnTrailParticle()
  }

  const overTargetRoof = Math.abs(packageGroup.position.x) <= 4.55 && packageGroup.position.z >= -18.25 && packageGroup.position.z <= -3.75
  if (overTargetRoof && packageGroup.position.y <= LANDING_Y && state.velocity.y < 0) {
    packageGroup.position.y = LANDING_Y
    state.velocity.y = Math.abs(state.velocity.y) * 0.22
    state.velocity.x *= 0.62
    state.velocity.z *= 0.62
    state.angularVelocity.multiplyScalar(0.58)
    if (!state.firstRoofContact) state.firstRoofContact = now
    playBounce(state.bounceCount)
    state.bounceCount += 1
  }

  if (state.firstRoofContact) {
    const horizontalSpeed = Math.hypot(state.velocity.x, state.velocity.z)
    if (now - state.firstRoofContact >= 1100 || (state.bounceCount >= 2 && horizontalSpeed < 0.9)) {
      state.velocity.set(0, 0, 0)
      packageGroup.position.y = LANDING_Y
      evaluateLanding()
      return
    }
  }

  if (packageGroup.position.y < -7) {
    resolveDelivery('miss')
  }

  const shadow = packageGroup.children.find((child) => child.userData.packageShadow)
  if (shadow) {
    const height = Math.max(0, packageGroup.position.y - ROOF_TOP)
    shadow.position.y = -height - 0.27
    shadow.material.opacity = clamp(0.27 - height * 0.022, 0.04, 0.22)
    const scale = clamp(1 + height * 0.08, 1, 1.9)
    shadow.scale.setScalar(scale)
  }
}

function spawnTrailParticle() {
  const colors = [0xf7d58b, 0xfff5de, 0x79d7d2]
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(random(0.08, 0.16), random(0.04, 0.1)),
    new THREE.MeshBasicMaterial({ color: colors[Math.floor(Math.random() * colors.length)], side: THREE.DoubleSide, transparent: true }),
  )
  mesh.position.copy(packageGroup.position)
  mesh.position.add(new THREE.Vector3(random(-0.18, 0.18), random(-0.12, 0.1), random(-0.12, 0.12)))
  mesh.userData.velocity = new THREE.Vector3(random(-0.5, 0.5), random(-0.1, 0.4), random(0.2, 0.9))
  mesh.userData.life = 0.75
  mesh.userData.maxLife = 0.75
  scene.add(mesh)
  particles.push(mesh)
}

function burstParticles(color, count) {
  for (let i = 0; i < count; i += 1) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(random(0.08, 0.18), random(0.04, 0.1)),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true }),
    )
    mesh.position.copy(packageGroup.position)
    const angle = random(0, Math.PI * 2)
    const speed = random(1.2, 4.5)
    mesh.userData.velocity = new THREE.Vector3(Math.cos(angle) * speed, random(1.5, 4.8), Math.sin(angle) * speed)
    mesh.userData.life = random(0.7, 1.2)
    mesh.userData.maxLife = mesh.userData.life
    scene.add(mesh)
    particles.push(mesh)
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i]
    particle.userData.life -= dt
    particle.userData.velocity.y -= 4.2 * dt
    particle.position.addScaledVector(particle.userData.velocity, dt)
    particle.rotation.x += dt * 5
    particle.rotation.z += dt * 7
    particle.material.opacity = clamp(particle.userData.life / particle.userData.maxLife, 0, 1)
    if (particle.userData.life <= 0) {
      scene.remove(particle)
      particle.geometry.dispose()
      particle.material.dispose()
      particles.splice(i, 1)
    }
  }
}

function updateAmbient(dt, now) {
  targetGroup.children.forEach((child) => {
    if (child.userData.spin) child.rotation.z += child.userData.spin * dt
    if (child.userData.beacon) {
      child.position.y = 0.36 + Math.sin(now * 0.003) * 0.12
      child.rotation.y += dt * 1.6
    }
  })
  windStreaks.children.forEach((streak) => {
    const direction = Math.abs(state.wind) < 0.12 ? 1 : Math.sign(state.wind)
    streak.position.x += direction * streak.userData.speed * dt
    streak.material.opacity = streak.userData.baseOpacity * (0.5 + Math.abs(state.wind) * 0.5)
    if (streak.position.x > 11) streak.position.x = -11
    if (streak.position.x < -11) streak.position.x = 11
  })
  scene.children.forEach((child) => {
    if (!child.userData.isCloud) return
    child.position.x += child.userData.speed * dt
    if (child.position.x > 20) child.position.x = -23
  })
  packageGroup.position.y += !state.flying && !state.aiming && state.ready ? Math.sin(now * 0.004) * 0.00045 : 0
}

function pulseTarget() {
  targetGroup.children.forEach((child) => {
    if (!child.geometry?.type?.includes('Ring')) return
    child.scale.setScalar(1.18)
  })
  window.setTimeout(() => targetGroup.children.forEach((child) => child.scale.setScalar(1)), 350)
}

function popScore(text, miss) {
  const node = document.createElement('div')
  node.className = `rd-score-pop${miss ? ' rd-score-pop--miss' : ''}`
  node.textContent = text
  ui.popLayer.appendChild(node)
  window.setTimeout(() => node.remove(), 850)
}

function showBubble(text) {
  clearTimeout(bubbleTimer)
  ui.bubble.textContent = text
  ui.bubble.classList.remove('is-visible')
  void ui.bubble.offsetWidth
  ui.bubble.classList.add('is-visible')
  bubbleTimer = window.setTimeout(() => ui.bubble.classList.remove('is-visible'), 920)
}

function showCombo() {
  ui.comboBadge.textContent = `x${state.combo} ${t('combo')}`
  ui.comboBadge.classList.remove('is-visible')
  void ui.comboBadge.offsetWidth
  ui.comboBadge.classList.add('is-visible')
}

function formatScore(score) {
  return String(Math.max(0, Math.round(score))).padStart(4, '0')
}

function updateHud() {
  ui.scoreValue.textContent = formatScore(state.score)
  ui.parcelValue.textContent = String(Math.min(TOTAL_PARCELS, state.parcelIndex + 1))
  ui.missDots.forEach((dot, index) => dot.classList.toggle('is-used', index < state.misses))
}

function resize() {
  const width = ui.stage.clientWidth
  const height = ui.stage.clientHeight
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

function frame(now) {
  const dt = Math.min(0.033, Math.max(0.001, (now - lastFrame) / 1000))
  lastFrame = now
  updatePackage(dt, now)
  updateParticles(dt)
  updateAmbient(dt, now)
  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}

ui.startButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  playClick()
  startGame()
})
ui.againButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  playClick()
  startGame()
})
ui.homeButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  playClick()
  goHome()
})
ui.gameScreen.addEventListener('pointerdown', beginAim)
ui.gameScreen.addEventListener('pointermove', moveAim)
ui.gameScreen.addEventListener('pointerup', releaseAim)
ui.gameScreen.addEventListener('pointercancel', releaseAim)

window.addEventListener('keydown', (event) => {
  if (event.code === 'Escape' && state.isGameOver) goHome()
  if (event.code === 'KeyR' && state.isGameOver) startGame()
  if (!state.isPlaying || !state.ready) return
  if (event.code === 'ArrowLeft') state.keyboardAim = clamp(state.keyboardAim - 12, -120, 120)
  if (event.code === 'ArrowRight') state.keyboardAim = clamp(state.keyboardAim + 12, -120, 120)
  if (event.code === 'Space' && !state.keyboardCharging) {
    event.preventDefault()
    resumeAudio()
    playAim()
    state.keyboardCharging = true
    state.keyboardPower = 24
    state.aiming = true
    state.aimDx = state.keyboardAim
    state.aimDy = state.keyboardPower
    ui.aimUi.classList.add('is-visible')
  }
})
window.addEventListener('keyup', (event) => {
  if (event.code === 'Space' && state.keyboardCharging) {
    event.preventDefault()
    state.keyboardCharging = false
    state.aiming = false
    ui.aimUi.classList.remove('is-visible')
    launchPackage(state.keyboardAim, Math.max(48, state.keyboardPower))
  }
})

window.setInterval(() => {
  if (!state.keyboardCharging) return
  state.keyboardPower = clamp(state.keyboardPower + 9, 24, 180)
  state.aimDx = state.keyboardAim
  state.aimDy = state.keyboardPower
  updateAimVisuals()
}, 100)

window.addEventListener('resize', resize)
resize()
setTarget()
setWind()
resetPackage()
updateHud()
requestAnimationFrame(frame)

if (locale === 'zh') document.title = '天台速递'
