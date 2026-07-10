import * as THREE from 'three'
import './styles.css'
import { createCat, createChicken, createDog } from './animal-assets.js'
import { applyI18n, line, locale, t } from './i18n.js'
import { LEVELS, animalImpulse, hasPassedLevel, levelMission, levelTitle, objectiveProgress } from './levels.js'
import { initLeaderboard, snapshotPreRunBest, submitFinalScore } from './leaderboard.js'
import {
  playAim,
  playAnimalHit,
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
  playUnlock,
  resumeAudio,
} from './sounds.js'

const $ = (selector) => document.querySelector(selector)
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const random = (min, max) => min + Math.random() * (max - min)

applyI18n(document)

const ui = {
  shell: $('#app'), stage: $('#stage'), hud: $('#hud'), windBadge: $('#windBadge'), windArrow: $('#windArrow'), windValue: $('#windValue'),
  parcelValue: $('#parcelValue'), parcelTotal: $('#parcelTotal'), scoreValue: $('#scoreValue'), missDots: [...document.querySelectorAll('#missDots i')],
  aimUi: $('#aimUi'), powerFill: $('#powerFill'), graceCard: $('#graceCard'), graceCount: $('#graceCount'),
  popLayer: $('#popLayer'), bubble: $('#bubble'), comboBadge: $('#comboBadge'),
  objectiveBadge: $('#objectiveBadge'), routeMapButton: $('#routeMapButton'), endMapButton: $('#endMapButton'),
  startRouteLabel: $('#startRouteLabel'), startRouteTitle: $('#startRouteTitle'), startRouteMission: $('#startRouteMission'),
  routeMapOverlay: $('#routeMapOverlay'), routeMapList: $('#routeMapList'), routeMapClose: $('#routeMapClose'),
  startScreen: $('#startScreen'), gameScreen: $('#gameScreen'), endScreen: $('#endScreen'), playHint: $('#playHint'),
  againButton: $('#againButton'), homeButton: $('#homeButton'),
  resultKicker: $('#resultKicker'), finalScore: $('#finalScore'), bestScore: $('#bestScore'), deliveredValue: $('#deliveredValue'),
  bullseyeValue: $('#bullseyeValue'), maxComboValue: $('#maxComboValue'), recordStamp: $('#recordStamp'),
  resultRoute: $('#resultRoute'), resultMission: $('#resultMission'),
}

const BEST_KEY = 'rooftop_delivery_best'
const PROGRESS_KEY = 'rooftop_delivery_progress_v1'
const GRACE_MS = 1500
const GRAVITY = 10.8
const PACKAGE_START = new THREE.Vector3(0, 1.15, 2.6)
const ROOF_TOP = 0.5
const LANDING_Y = 0.79

function loadProgress() {
  try {
    const value = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}')
    const unlocked = clamp(Number(value.unlocked) || 1, 1, LEVELS.length)
    const cleared = Array.isArray(value.cleared)
      ? value.cleared.filter((id) => Number.isInteger(id) && id >= 1 && id <= LEVELS.length)
      : LEVELS.filter((level) => level.id < unlocked).map((level) => level.id)
    return { unlocked, cleared }
  } catch {
    return { unlocked: 1, cleared: [] }
  }
}

const storedProgress = loadProgress()

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
  selectedLevel: storedProgress.unlocked - 1,
  unlockedLevel: storedProgress.unlocked,
  completedLevels: new Set(storedProgress.cleared),
  levelPassed: false,
  targetBaseX: 0,
  animalHitThisThrow: false,
}

const currentLevel = () => LEVELS[state.selectedLevel]

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

const levelSceneGroups = LEVELS.map((level) => createLevelScene(level.scene))
levelSceneGroups.forEach((group) => scene.add(group))
const animalRoster = createAnimalRoster()
animalRoster.forEach((entry) => scene.add(entry.group))

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
  box.userData.packagePart = 'box'
  group.add(box)
  const tapeMaterial = new THREE.MeshStandardMaterial({ color: 0xf7d58b, roughness: 0.72 })
  const tapeTop = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.535, 0.49), tapeMaterial)
  tapeTop.userData.packagePart = 'tape'
  group.add(tapeTop)
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.2), new THREE.MeshBasicMaterial({ map: makeLabelTexture() }))
  label.position.set(0.18, 0.03, 0.246)
  label.userData.packagePart = 'label'
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

function makeLabelTexture(text = 'RD / 01', accent = '#f05d4e') {
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
  ctx.font = `bold ${text.length > 8 ? 17 : 22}px Arial`
  ctx.fillText(text, 17, 34)
  ctx.fillStyle = accent
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

function sceneMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: options.roughness ?? 0.82, metalness: options.metalness ?? 0.02, transparent: options.opacity < 1, opacity: options.opacity ?? 1 })
}

function sceneBox(group, size, color, position, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), sceneMaterial(color, options))
  mesh.position.set(...position)
  mesh.castShadow = options.castShadow !== false
  mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}

function createLevelScene(kind) {
  const group = new THREE.Group()
  if (kind === 'depot') {
    sceneBox(group, [0.9, 0.65, 0.8], 0xd99a5f, [-3.15, 0.82, -6.6])
    sceneBox(group, [0.65, 0.45, 0.65], 0xf05d4e, [-2.55, 0.7, -6.2])
  } else if (kind === 'laundry') {
    for (const x of [-3.45, 3.45]) sceneBox(group, [0.08, 2.15, 0.08], 0x4a465d, [x, 1.55, -15.1])
    for (const z of [-15.05, -14.7]) sceneBox(group, [6.9, 0.035, 0.035], 0xf4ead8, [0, 2.15, z], { castShadow: false })
    const cloths = [[-2.2, 0xf05d4e], [-0.75, 0xf7d58b], [0.8, 0x79d7d2], [2.2, 0x8a6aa6]]
    cloths.forEach(([x, color], index) => sceneBox(group, [0.75, 0.78, 0.04], color, [x, 1.75 - (index % 2) * 0.08, -15.02]))
  } else if (kind === 'garden') {
    const spots = [[-3.25, -15.6], [3.1, -14.8], [-3.4, -7.1], [3.25, -6.8]]
    spots.forEach(([x, z], index) => {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.35, 0.5, 8), sceneMaterial(index % 2 ? 0xf05d4e : 0xd99a5f))
      pot.position.set(x, 0.76, z)
      pot.castShadow = true
      group.add(pot)
      const plant = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), sceneMaterial(index % 2 ? 0x5d9b67 : 0x79a75d))
      plant.position.set(x, 1.23, z)
      plant.castShadow = true
      group.add(plant)
    })
  } else if (kind === 'neon') {
    for (const x of [-3.15, 3.15]) {
      const panel = sceneBox(group, [1.45, 0.08, 2.1], 0x4b5b78, [x, 0.87, -14.5], { metalness: 0.18 })
      panel.rotation.x = -0.18
      sceneBox(group, [1.5, 0.035, 0.06], 0x79d7d2, [x, 0.95, -13.48], { castShadow: false })
    }
  } else if (kind === 'glasshouse') {
    sceneBox(group, [2.5, 0.08, 3.2], 0xf4ead8, [3.05, 0.62, -14.4])
    for (const x of [2, 4.1]) for (const z of [-15.8, -13]) sceneBox(group, [0.07, 1.8, 0.07], 0x5c5c68, [x, 1.5, z])
    sceneBox(group, [2.1, 1.35, 0.05], 0x9fd6ff, [3.05, 1.55, -15.8], { opacity: 0.34, castShadow: false })
    sceneBox(group, [2.1, 1.35, 0.05], 0x9fd6ff, [3.05, 1.55, -13], { opacity: 0.34, castShadow: false })
  } else if (kind === 'beacon') {
    for (const [x, z] of [[-3.3, -15.7], [3.3, -15.2], [-3.4, -6.6], [3.4, -7.1]]) {
      sceneBox(group, [0.18, 1.45, 0.18], 0x353544, [x, 1.25, z])
      const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), new THREE.MeshBasicMaterial({ color: 0xf2c14e }))
      lamp.position.set(x, 2.08, z)
      group.add(lamp)
    }
  }
  return group
}

function createPatrolPath() {
  const group = new THREE.Group()
  const material = new THREE.MeshBasicMaterial({ color: 0xf05d4e, transparent: true, opacity: 0.32, depthWrite: false })
  for (let index = 0; index < 11; index += 1) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.06), material)
    mark.position.x = -1 + index * 0.2
    group.add(mark)
  }
  return group
}

function createAnimalRoster() {
  const specs = [createCat, createDog, createChicken, createCat, createDog]
  return specs.map((factory) => {
    const group = factory()
    const type = group.userData.animalType
    const scale = type === 'dog' ? 0.82 : type === 'chicken' ? 1.05 : 0.9
    group.scale.setScalar(scale)
    group.visible = false
    const path = createPatrolPath()
    path.visible = false
    scene.add(path)
    return { group, path, config: null, direction: 1, type }
  })
}

function updatePackageSkin() {
  const skin = currentLevel().parcel
  const box = packageGroup.children.find((child) => child.userData.packagePart === 'box')
  const tape = packageGroup.children.find((child) => child.userData.packagePart === 'tape')
  const label = packageGroup.children.find((child) => child.userData.packagePart === 'label')
  if (box) box.material.color.setHex(skin.box)
  if (tape) tape.material.color.setHex(skin.tape)
  if (label) {
    label.material.map?.dispose()
    label.material.map = makeLabelTexture(skin.label, `#${skin.box.toString(16).padStart(6, '0')}`)
    label.material.needsUpdate = true
  }
}

function applyLevelPresentation() {
  const level = currentLevel()
  levelSceneGroups.forEach((group, index) => { group.visible = index === state.selectedLevel })
  animalRoster.forEach((entry) => {
    entry.group.visible = false
    entry.path.visible = false
    entry.config = null
  })
  level.animals.forEach((config, index) => {
    const offset = level.id === 6 ? index + 3 : config.type === 'cat' ? 0 : config.type === 'dog' ? 1 : 2
    const entry = animalRoster[offset]
    entry.config = config
    entry.group.visible = true
    entry.path.visible = true
    entry.path.scale.x = config.amplitude
  })
  updatePackageSkin()
  state.animalHitThisThrow = false
}

function updateAnimals(now) {
  animalRoster.forEach((entry) => {
    if (!entry.config || !entry.group.visible) return
    const config = entry.config
    const phase = (now / 1000) * (Math.PI * 2 / config.period) + (config.phase || 0)
    entry.direction = Math.cos(phase) >= 0 ? 1 : -1
    entry.group.position.set(Math.sin(phase) * config.amplitude, ROOF_TOP + 0.08, targetGroup.position.z + config.zOffset)
    entry.group.rotation.y = entry.direction > 0 ? 0 : Math.PI
    entry.path.position.set(0, ROOF_TOP + 0.04, targetGroup.position.z + config.zOffset)
  })
}

function checkAnimalCollision() {
  if (!state.flying || state.animalHitThisThrow) return
  for (const entry of animalRoster) {
    if (!entry.config || !entry.group.visible) continue
    const center = entry.group.position.clone()
    center.y += entry.type === 'chicken' ? 0.45 : 0.52
    if (packageGroup.position.distanceTo(center) > entry.config.radius) continue
    state.animalHitThisThrow = true
    const nextVelocity = animalImpulse(state.velocity, entry.config, entry.direction)
    state.velocity.set(nextVelocity.x, nextVelocity.y, nextVelocity.z)
    state.angularVelocity.add(new THREE.Vector3(2.4, entry.direction * 3.2, 1.8))
    playAnimalHit(entry.type)
    showBubble(t(`${entry.type}Hit`))
    popScore(t('animalInterference'), true)
    burstParticles(0xf05d4e, 10)
    break
  }
}

function setTarget() {
  const level = currentLevel()
  let x
  let z
  let attempts = 0
  do {
    x = random(-2.7, 2.7)
    z = random(-13.5, -8.5)
    attempts += 1
  } while (attempts < 10 && Math.hypot(x - state.lastTarget.x, z - state.lastTarget.z) < 2.2)
  state.targetBaseX = x
  targetGroup.position.set(x, ROOF_TOP + 0.015, z)
  targetGroup.scale.setScalar(level.targetScale)
  state.lastTarget.set(x, 0, z)
}

function setWind() {
  const level = currentLevel()
  const calm = level.windMin === 0 && Math.random() < 0.2
  if (calm) {
    state.wind = random(-Math.min(0.24, level.windMax), Math.min(0.24, level.windMax))
  } else {
    const magnitude = random(Math.max(level.windMin, 0.25), level.windMax)
    state.wind = (Math.random() < 0.5 ? -1 : 1) * magnitude
  }
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
  state.animalHitThisThrow = false
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
    updateObjective()
    ui.playHint.classList.add('is-visible')
  }, delay)
}

function saveProgress() {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify({ unlocked: state.unlockedLevel, cleared: [...state.completedLevels].sort((a, b) => a - b) }))
}

function updateLevelIntro() {
  const level = currentLevel()
  ui.startRouteLabel.textContent = t('routeLabel', { n: level.id })
  ui.startRouteTitle.textContent = levelTitle(level)
  ui.startRouteMission.textContent = levelMission(level)
}

function updateObjective() {
  ui.objectiveBadge.textContent = objectiveProgress(currentLevel(), state)
}

function renderRouteMap() {
  ui.routeMapList.innerHTML = ''
  LEVELS.forEach((level, index) => {
    const unlocked = level.id <= state.unlockedLevel
    const cleared = state.completedLevels.has(level.id)
    const card = document.createElement('button')
    card.type = 'button'
    card.className = `rd-map-row${index === state.selectedLevel ? ' is-current' : ''}${unlocked ? '' : ' is-locked'}`
    card.disabled = !unlocked

    const number = document.createElement('span')
    number.className = 'rd-map-row__number'
    number.textContent = String(level.id).padStart(2, '0')
    const body = document.createElement('span')
    body.className = 'rd-map-row__body'
    const title = document.createElement('strong')
    title.textContent = levelTitle(level)
    const mission = document.createElement('small')
    mission.textContent = levelMission(level)
    body.append(title, mission)
    const status = document.createElement('span')
    status.className = 'rd-map-row__status'
    status.textContent = !unlocked ? t('locked') : index === state.selectedLevel ? t('current') : cleared ? t('cleared') : '→'
    card.append(number, body, status)
    if (unlocked) {
      card.addEventListener('click', () => {
        state.selectedLevel = index
        state.levelPassed = false
        closeRouteMap()
        goHome()
        updateLevelIntro()
      })
    }
    ui.routeMapList.appendChild(card)
  })
}

function openRouteMap() {
  renderRouteMap()
  ui.routeMapOverlay.classList.add('is-visible')
  ui.routeMapOverlay.setAttribute('aria-hidden', 'false')
}

function closeRouteMap() {
  ui.routeMapOverlay.classList.remove('is-visible')
  ui.routeMapOverlay.setAttribute('aria-hidden', 'true')
}

function startGame() {
  const level = currentLevel()
  snapshotPreRunBest()
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
  state.levelPassed = false
  state.unlockAt = performance.now() + GRACE_MS
  applyLevelPresentation()
  updateHud()
  showScreen('game')
  ui.hud.classList.add('is-visible')
  ui.windBadge.classList.add('is-visible')
  ui.objectiveBadge.classList.add('is-visible')
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

function endGame() {
  const level = currentLevel()
  state.isPlaying = false
  state.isGameOver = true
  state.ready = false
  state.aiming = false
  state.flying = false
  hideTrajectory()
  ui.aimUi.classList.remove('is-visible')
  ui.playHint.classList.remove('is-visible')
  ui.hud.classList.remove('is-visible')
  ui.windBadge.classList.remove('is-visible')
  ui.objectiveBadge.classList.remove('is-visible')
  const previousBest = state.best
  state.best = Math.max(previousBest, state.score)
  state.levelPassed = hasPassedLevel(level, state)
  const unlockedBefore = state.unlockedLevel
  if (state.levelPassed) state.completedLevels.add(level.id)
  if (state.levelPassed && level.id < LEVELS.length) {
    state.unlockedLevel = Math.max(state.unlockedLevel, level.id + 1)
  }
  if (state.levelPassed) saveProgress()
  localStorage.setItem(BEST_KEY, String(state.best))
  submitFinalScore(state.score)
  ui.resultKicker.textContent = state.levelPassed
    ? (level.id === LEVELS.length ? t('allRoutesComplete') : t('shiftComplete'))
    : t('shiftLost')
  ui.resultRoute.textContent = `${t('routeLabel', { n: level.id })} · ${levelTitle(level)}`
  ui.resultMission.textContent = `${state.levelPassed ? t('missionComplete') : t('missionFailed')} · ${objectiveProgress(level, state)}`
  ui.finalScore.textContent = formatScore(state.score)
  ui.bestScore.textContent = formatScore(state.best)
  ui.deliveredValue.textContent = `${state.delivered}/${level.parcels}`
  ui.bullseyeValue.textContent = String(state.bullseyes)
  ui.maxComboValue.textContent = String(state.maxCombo)
  ui.recordStamp.classList.toggle('is-visible', state.score > previousBest)
  ui.againButton.textContent = state.levelPassed
    ? (level.id === LEVELS.length ? t('replayFinal') : t('nextRoute'))
    : t('retryRoute')
  if (state.levelPassed) {
    playComplete()
    if (state.unlockedLevel > unlockedBefore) window.setTimeout(playUnlock, 380)
  } else {
    playFail()
  }
  showScreen('end')
}

function goHome() {
  clearTimeout(resultTimer)
  state.isPlaying = false
  state.isGameOver = false
  state.ready = false
  state.flying = false
  applyLevelPresentation()
  resetPackage()
  setTarget()
  setWind()
  ui.hud.classList.remove('is-visible')
  ui.windBadge.classList.remove('is-visible')
  ui.objectiveBadge.classList.remove('is-visible')
  ui.graceCard.classList.remove('is-visible')
  updateLevelIntro()
  showScreen('start')
}

function showScreen(name) {
  ui.shell.dataset.screen = name
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
  const level = currentLevel()
  if (state.misses >= level.maxMisses || state.parcelIndex >= level.parcels) {
    resultTimer = window.setTimeout(endGame, 1050)
  } else {
    prepareRound(900)
  }
}

function evaluateLanding() {
  const targetScale = currentLevel().targetScale
  const dx = packageGroup.position.x - targetGroup.position.x
  const dz = packageGroup.position.z - targetGroup.position.z
  const distance = Math.hypot(dx, dz)
  if (distance <= 0.85 * targetScale) resolveDelivery('bullseye')
  else if (distance <= 1.7 * targetScale) resolveDelivery('delivered')
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
  checkAnimalCollision()

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
  const level = currentLevel()
  if (level.moveAmplitude > 0 && state.isPlaying && !state.resolving) {
    const phase = (now / 1000) * (Math.PI * 2 / level.movePeriod)
    targetGroup.position.x = state.targetBaseX + Math.sin(phase) * level.moveAmplitude
  }
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
  const level = currentLevel()
  ui.scoreValue.textContent = formatScore(state.score)
  ui.parcelValue.textContent = String(Math.min(level.parcels, state.parcelIndex + 1))
  ui.parcelTotal.textContent = String(level.parcels)
  ui.missDots.forEach((dot, index) => {
    dot.hidden = index >= level.maxMisses
    dot.classList.toggle('is-used', index < state.misses)
  })
  updateObjective()
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
  updateAnimals(now)
  updatePackage(dt, now)
  updateParticles(dt)
  updateAmbient(dt, now)
  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}

ui.startScreen.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  playClick()
  startGame()
})
ui.againButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  playClick()
  if (state.levelPassed && currentLevel().id < LEVELS.length) state.selectedLevel += 1
  startGame()
})
ui.routeMapButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  event.stopPropagation()
  playClick()
  openRouteMap()
})
ui.endMapButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  playClick()
  openRouteMap()
})
ui.routeMapClose.addEventListener('click', closeRouteMap)
ui.routeMapOverlay.addEventListener('click', (event) => {
  if (event.target === ui.routeMapOverlay) closeRouteMap()
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
  if (event.code === 'Escape' && ui.routeMapOverlay.classList.contains('is-visible')) {
    closeRouteMap()
    return
  }
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
applyLevelPresentation()
setTarget()
setWind()
resetPackage()
updateHud()
updateLevelIntro()
ui.shell.dataset.screen = 'start'
initLeaderboard()
requestAnimationFrame(frame)

if (locale === 'zh') document.title = '天台速递'
