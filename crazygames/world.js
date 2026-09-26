import * as THREE from 'three'
import { createCat, createChicken, createDog } from '../src/animal-assets.js'
import { calmScale, createFlight, launchVelocity, ROOF_TOP, sampleTrajectory, stepFlight } from './aim.js'

const factories = { cat: createCat, dog: createDog, chicken: createChicken }

export function createWorld(container) {
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x8d7893, 0.018)
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 140)
  camera.position.set(0.4, 8.15, 17.2)
  camera.lookAt(0, 0.55, -4.8)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(1)
  renderer.setSize(1600, 900, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.domElement.className = 'cg-canvas'
  container.appendChild(renderer.domElement)

  scene.add(new THREE.HemisphereLight(0xffdfba, 0x3b3d57, 2.45))
  const sun = new THREE.DirectionalLight(0xffc48f, 4.2)
  sun.position.set(-7, 14, 8)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.left = -18
  sun.shadow.camera.right = 18
  sun.shadow.camera.top = 18
  sun.shadow.camera.bottom = -10
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
  addRoofDetails(city)
  addBackgroundCity(scene, city)
  const clouds = addClouds(scene)

  const targetGroup = createTarget()
  scene.add(targetGroup)
  const packageGroup = createPackage()
  scene.add(packageGroup)

  const scenes = {}
  for (const name of ['depot', 'laundry', 'garden', 'neon', 'glasshouse', 'beacon']) {
    scenes[name] = createLevelScene(name)
    scene.add(scenes[name])
  }

  const roster = ['cat', 'dog', 'chicken', 'cat', 'dog'].map((type) => {
    const group = factories[type]()
    const scale = type === 'dog' ? 0.82 : type === 'chicken' ? 1.05 : 0.9
    group.scale.setScalar(scale)
    group.visible = false
    scene.add(group)
    const path = createPatrolPath()
    path.visible = false
    scene.add(path)
    return { group, path, type, baseScale: scale, config: null, hitAt: 0, hitDirection: 1, direction: 1 }
  })

  const trajectory = []
  const trajectoryGroup = new THREE.Group()
  for (let i = 0; i < 18; i += 1) {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.055 + i * 0.0015, 8, 6),
      new THREE.MeshBasicMaterial({ color: i < 11 ? 0xfff5de : 0x79d7d2, transparent: true, opacity: 0.78 - i * 0.025 }),
    )
    dot.visible = false
    trajectory.push(dot)
    trajectoryGroup.add(dot)
  }
  scene.add(trajectoryGroup)

  const windStreaks = createWindStreaks()
  scene.add(windStreaks)
  const particles = []

  let flight = null
  let wind = 0
  let targetX = 0
  let targetZ = -10.5
  let baseX = 0
  let targetScale = 1
  let moveAmplitude = 0
  let movePeriod = 4
  let sceneName = 'depot'
  let bob = true

  function placeTarget(x, z, scale) {
    baseX = x
    targetX = x
    targetZ = z
    targetScale = scale
    targetGroup.position.set(x, ROOF_TOP + 0.015, z)
    targetGroup.scale.setScalar(scale)
  }

  function resetPackage() {
    flight = null
    bob = true
    packageGroup.visible = true
    packageGroup.position.set(0, 1.15, 2.6)
    packageGroup.rotation.set(-0.06, 0.12, 0)
    hideAim()
  }

  function hideAim() {
    trajectory.forEach((dot) => { dot.visible = false })
  }

  function setAim(dx, dy, feltWind, mods) {
    const preview = sampleTrajectory(dx, dy, feltWind, mods, targetX, targetZ)
    preview.points.forEach((point, index) => {
      const dot = trajectory[index]
      if (!dot) return
      dot.position.set(point.x, point.y, point.z)
      dot.visible = point.visible
    })
    for (let i = preview.points.length; i < trajectory.length; i += 1) trajectory[i].visible = false
    return preview.power
  }

  function launch(dx, dy, feltWind, mods) {
    const velocity = launchVelocity(dx, dy, feltWind, mods, targetX, targetZ)
    flight = createFlight(velocity)
    bob = false
    hideAim()
    return velocity
  }

  function setAnimals(configs) {
    roster.forEach((entry) => {
      entry.group.visible = false
      entry.path.visible = false
      entry.config = null
      entry.hitAt = 0
    })
    const used = new Set()
    configs.forEach((config) => {
      const entry = roster.find((item) => item.type === config.type && !used.has(item))
      if (!entry) return
      used.add(entry)
      entry.config = config
      entry.group.visible = true
      entry.path.visible = true
      entry.path.scale.x = config.amplitude
    })
  }

  function animalSnapshots(calmRank) {
    const scale = calmScale(calmRank)
    return roster.filter((entry) => entry.config && entry.group.visible).map((entry) => ({
      x: entry.group.position.x,
      y: entry.group.position.y,
      z: entry.group.position.z,
      type: entry.type,
      direction: entry.direction,
      radius: entry.config.radius * scale,
      height: entry.config.height,
      deflect: entry.config.deflect * scale,
      lift: entry.config.lift * scale,
    }))
  }

  function updateAnimals(now) {
    roster.forEach((entry) => {
      if (!entry.config || !entry.group.visible) return
      const config = entry.config
      const phase = (now / 1000) * (Math.PI * 2 / config.period) + (config.phase || 0)
      entry.direction = Math.cos(phase) >= 0 ? 1 : -1
      const stride = Math.sin(phase * 4)
      const bobY = Math.abs(Math.sin(phase * 2)) * (entry.type === 'chicken' ? 0.09 : 0.04)
      let pounceY = 0
      let pounceTilt = 0
      if (entry.hitAt) {
        const progress = (now - entry.hitAt) / 450
        if (progress < 1) {
          const arc = Math.sin(progress * Math.PI)
          pounceY = arc * config.pounce
          pounceTilt = arc * entry.hitDirection * 0.2
        } else entry.hitAt = 0
      }
      entry.group.position.set(Math.sin(phase) * config.amplitude, ROOF_TOP + 0.08 + bobY + pounceY, targetZ + (config.zOffset || 0))
      entry.group.rotation.y = entry.direction > 0 ? 0 : Math.PI
      entry.group.rotation.z = stride * 0.045 + pounceTilt
      const squash = 1 + Math.abs(stride) * 0.025
      entry.group.scale.set(entry.baseScale / squash, entry.baseScale * squash, entry.baseScale)
      entry.group.children.forEach((child) => {
        if (child.userData.animalPart === 'leg') {
          const angle = entry.type === 'chicken' ? 0.28 : 0.32
          child.rotation.z = Math.sin(phase * 4 + child.userData.stepPhase) * angle
        } else if (child.userData.animalPart === 'tail') child.rotation.x = Math.sin(phase * 5) * 0.25
        else if (child.userData.animalPart === 'wing') child.rotation.x = child.userData.wingSide * Math.sin(phase * 6) * 0.55
      })
      entry.path.position.set(0, ROOF_TOP + 0.04, targetZ + (config.zOffset || 0))
    })
  }

  function step(dt, now, feltWind, calmRank) {
    wind = feltWind
    if (moveAmplitude > 0) {
      const phase = (now / 1000) * (Math.PI * 2 / movePeriod)
      targetX = baseX + Math.sin(phase) * moveAmplitude
      targetGroup.position.x = targetX
    }
    updateAnimals(now)
    targetGroup.children.forEach((child) => {
      if (child.userData.spin) child.rotation.z += child.userData.spin * dt
      if (child.userData.beacon) {
        child.position.y = 0.36 + Math.sin(now * 0.003) * 0.12
        child.rotation.y += dt * 1.6
      }
    })
    windStreaks.children.forEach((streak) => {
      const direction = Math.abs(wind) < 0.08 ? 1 : Math.sign(wind)
      streak.position.x += direction * streak.userData.speed * dt
      streak.material.opacity = streak.userData.baseOpacity * (0.45 + Math.min(1.2, Math.abs(wind)))
      if (streak.position.x > 12) streak.position.x = -12
      if (streak.position.x < -12) streak.position.x = 12
    })
    clouds.forEach((cloud) => {
      cloud.position.x += cloud.userData.speed * dt
      if (cloud.position.x > 22) cloud.position.x = -24
    })
    updateParticles(dt)

    const event = { bounced: false, done: false, kind: null, animal: null }
    if (!flight) {
      if (bob) packageGroup.position.y = 1.15 + Math.sin(now * 0.004) * 0.06
      return event
    }
    const beforeBounce = flight.bounceCount
    const beforeAnimal = flight.animalHit
    stepFlight(flight, dt, {
      wind,
      targetX,
      targetZ,
      targetScale,
      animals: animalSnapshots(calmRank),
    })
    packageGroup.position.set(flight.x, flight.y, flight.z)
    packageGroup.rotation.x += flight.ax * dt
    packageGroup.rotation.y += flight.ay * dt
    packageGroup.rotation.z += flight.az * dt
    if (flight.bounceCount === 0 && Math.random() < dt * 14) spawnTrail()
    if (flight.bounceCount > beforeBounce) event.bounced = true
    if (flight.animalHit && !beforeAnimal) {
      event.animal = flight.animalType
      const entry = roster.find((item) => item.type === flight.animalType && item.group.visible)
      if (entry) {
        entry.hitAt = now
        entry.hitDirection = Math.sign(flight.x - entry.group.position.x) || 1
      }
      burst(0xf05d4e, 12)
    }
    if (flight.done) {
      event.done = true
      event.kind = flight.kind
      if (flight.kind === 'bullseye') burst(0xf7d58b, 26)
      else if (flight.kind === 'delivered') burst(0x79d7d2, 18)
      else if (flight.kind === 'edge') burst(0xfff0d2, 14)
      flight = null
      bob = false
    }
    return event
  }

  function render() {
    renderer.render(scene, camera)
  }

  return {
    canvas: renderer.domElement,
    resize(pixelScale) {
      const ratio = Math.min(2, Math.max(0.5, pixelScale * (window.devicePixelRatio || 1)))
      renderer.setPixelRatio(ratio)
      renderer.setSize(1600, 900, false)
      camera.aspect = 16 / 9
      camera.updateProjectionMatrix()
    },
    setScene(name) {
      sceneName = scenes[name] ? name : 'depot'
      Object.entries(scenes).forEach(([key, group]) => { group.visible = key === sceneName })
    },
    setSkin(parcel) {
      const box = packageGroup.children.find((child) => child.userData.packagePart === 'box')
      const tape = packageGroup.children.find((child) => child.userData.packagePart === 'tape')
      const label = packageGroup.children.find((child) => child.userData.packagePart === 'label')
      if (box) box.material.color.setHex(parcel.box)
      if (tape) tape.material.color.setHex(parcel.tape)
      if (label) {
        label.material.map?.dispose()
        label.material.map = makeLabelTexture(parcel.label, `#${parcel.box.toString(16).padStart(6, '0')}`)
        label.material.needsUpdate = true
      }
    },
    setMotion(amplitude, period) {
      moveAmplitude = amplitude
      movePeriod = period || 4
    },
    setAnimals,
    placeTarget,
    resetPackage,
    setAim,
    hideAim,
    launch,
    step,
    render,
    get target() { return { x: targetX, z: targetZ, scale: targetScale } },
    get actors() {
      return roster.filter((entry) => entry.config && entry.group.visible).map((entry) => ({
        type: entry.type,
        x: entry.group.position.x,
        z: entry.group.position.z,
      }))
    },
    get flying() { return Boolean(flight) },
    pulseTarget() {
      targetGroup.children.forEach((child) => {
        if (child.geometry?.type?.includes('Ring')) child.scale.setScalar(1.16)
      })
      window.setTimeout(() => targetGroup.children.forEach((child) => child.scale.setScalar(1)), 320)
    },
  }

  function spawnTrail() {
    const colors = [0xf7d58b, 0xfff5de, 0x79d7d2]
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.08 + Math.random() * 0.08, 0.04 + Math.random() * 0.05),
      new THREE.MeshBasicMaterial({ color: colors[Math.floor(Math.random() * colors.length)], side: THREE.DoubleSide, transparent: true }),
    )
    mesh.position.copy(packageGroup.position)
    mesh.userData.velocity = new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.4, Math.random() * 0.6)
    mesh.userData.life = 0.7
    mesh.userData.maxLife = 0.7
    scene.add(mesh)
    particles.push(mesh)
  }

  function burst(color, count) {
    for (let i = 0; i < count; i += 1) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.08 + Math.random() * 0.08, 0.04 + Math.random() * 0.06),
        new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true }),
      )
      mesh.position.copy(packageGroup.position)
      const angle = Math.random() * Math.PI * 2
      const speed = 1.2 + Math.random() * 3
      mesh.userData.velocity = new THREE.Vector3(Math.cos(angle) * speed, 1.4 + Math.random() * 3, Math.sin(angle) * speed)
      mesh.userData.life = 0.7 + Math.random() * 0.4
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
      particle.material.opacity = Math.max(0, particle.userData.life / particle.userData.maxLife)
      if (particle.userData.life <= 0) {
        scene.remove(particle)
        particle.geometry.dispose()
        particle.material.dispose()
        particles.splice(i, 1)
      }
    }
  }
}

function makeBuilding(width, height, depth, color) {
  const group = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.02 }),
  )
  body.castShadow = false
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

function addRoofDetails(city) {
  const dark = new THREE.MeshStandardMaterial({ color: 0x4a465d, roughness: 0.76 })
  const coral = new THREE.MeshStandardMaterial({ color: 0xe76a5b, roughness: 0.7 })
  const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.75, 8), dark)
  vent.position.set(-3.1, 0.88, -15.7)
  vent.castShadow = true
  city.add(vent)
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 1.05, 10), coral)
  tank.position.y = 1.05
  tank.castShadow = true
  tank.position.set(3.2, 1.15, -16)
  city.add(tank)
  const railMat = new THREE.MeshStandardMaterial({ color: 0x595265, roughness: 0.68 })
  for (const x of [-4.05, 4.05]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.58, 7.2), railMat)
    rail.position.set(x, 0.77, 5)
    city.add(rail)
  }
}

function addBackgroundCity(scene, city) {
  const palette = [0x514e69, 0x5d566d, 0x766575, 0x4b5369, 0x806a75]
  for (let i = 0; i < 22; i += 1) {
    const side = i % 2 === 0 ? -1 : 1
    const width = 2.8 + (i % 4) * 0.6
    const depth = 3.6 + (i % 5) * 0.7
    const height = 4 + (i % 6) * 1.4
    const building = makeBuilding(width, height, depth, palette[i % palette.length])
    building.position.set(side * (7.4 + (i % 5) * 1.5), -height / 2 - (i % 3) * 0.4, -28 + (i % 11) * 3.1)
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

function addClouds(scene) {
  const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xffdac0, transparent: true, opacity: 0.18, depthWrite: false })
  const clouds = []
  for (let i = 0; i < 7; i += 1) {
    const cloud = new THREE.Group()
    for (let j = 0; j < 4; j += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1.5 + (i + j) % 3 * 0.4, 10, 7), cloudMaterial)
      puff.scale.y = 0.38
      puff.position.set(j * 1.3, ((i + j) % 3) * 0.08, 0)
      cloud.add(puff)
    }
    cloud.position.set(-18 + i * 5.5, 9 + (i % 3), -36 + (i % 4) * 3)
    cloud.userData.speed = 0.08 + (i % 4) * 0.03
    scene.add(cloud)
    clouds.push(cloud)
  }
  return clouds
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
  const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }))
  beacon.position.y = 0.36
  beacon.userData.beacon = true
  group.add(beacon)
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
  const tape = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.535, 0.49),
    new THREE.MeshStandardMaterial({ color: 0xf7d58b, roughness: 0.72 }),
  )
  tape.userData.packagePart = 'tape'
  group.add(tape)
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.2), new THREE.MeshBasicMaterial({ map: makeLabelTexture() }))
  label.position.set(0.18, 0.03, 0.246)
  label.userData.packagePart = 'label'
  group.add(label)
  group.position.set(0, 1.15, 2.6)
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
  for (let i = 0; i < 9; i += 1) {
    const material = new THREE.MeshBasicMaterial({ color: 0x79d7d2, transparent: true, opacity: 0.42, depthWrite: false })
    const streak = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.9 + (i % 4) * 0.25, 3, 6), material)
    streak.rotation.z = Math.PI / 2
    streak.position.set(-10 + i * 2.2, 2.2 + (i % 3) * 1.3, -16 + (i % 5) * 3)
    streak.userData.speed = 4.4 + (i % 3)
    streak.userData.baseOpacity = 0.2 + (i % 4) * 0.06
    group.add(streak)
  }
  return group
}

function sceneMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.82,
    metalness: options.metalness ?? 0.02,
    transparent: (options.opacity ?? 1) < 1,
    opacity: options.opacity ?? 1,
  })
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
    ;[[-2.2, 0xf05d4e], [-0.75, 0xf7d58b], [0.8, 0x79d7d2], [2.2, 0x8a6aa6]].forEach(([x, color], index) => {
      sceneBox(group, [0.75, 0.78, 0.04], color, [x, 1.75 - (index % 2) * 0.08, -15.02])
    })
  } else if (kind === 'garden') {
    ;[[-3.25, -15.6], [3.1, -14.8], [-3.4, -7.1], [3.25, -6.8]].forEach(([x, z], index) => {
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
