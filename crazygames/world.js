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

  const hemi = new THREE.HemisphereLight(0xffdfba, 0x3b3d57, 2.45)
  scene.add(hemi)
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

  const clouds = addClouds(scene)

  const targetGroup = createTarget()
  scene.add(targetGroup)
  const secondaryTargetGroup = createSecondaryTarget()
  secondaryTargetGroup.visible = false
  scene.add(secondaryTargetGroup)
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
  let secondaryTarget = null
  let secondaryBaseX = 0
  let moveAmplitude = 0
  let movePeriod = 4
  let sceneName = 'depot'
  let bob = true
  let impactFx = 0
  let windVisualOverride = null

  function applyAtmosphere(name) {
    const spec = DISTRICTS[name] || DISTRICTS.depot
    scene.fog.color.setHex(spec.fog)
    scene.fog.density = spec.fogDensity
    hemi.color.setHex(spec.hemiSky)
    hemi.groundColor.setHex(spec.hemiGround)
    hemi.intensity = spec.hemiIntensity
    sun.color.setHex(spec.sun)
    sun.intensity = spec.sunIntensity
    rim.color.setHex(spec.rim)
    rim.intensity = spec.rimIntensity
    clouds.forEach((cloud) => cloud.children.forEach((puff) => {
      puff.material.color.setHex(spec.cloud)
      puff.material.opacity = spec.cloudOpacity
    }))
    const app = container.closest('#app')
    if (app) app.dataset.district = name
  }

  function placeTarget(x, z, scale, secondary = null) {
    baseX = x
    targetX = x
    targetZ = z
    targetScale = scale
    targetGroup.position.set(x, ROOF_TOP + 0.015, z)
    targetGroup.scale.setScalar(scale)
    secondaryTarget = secondary ? { ...secondary } : null
    secondaryTargetGroup.visible = Boolean(secondaryTarget)
    if (secondaryTarget) {
      secondaryBaseX = secondaryTarget.x
      secondaryTargetGroup.position.set(secondaryTarget.x, ROOF_TOP + 0.012, secondaryTarget.z)
      secondaryTargetGroup.scale.setScalar(secondaryTarget.scale)
    }
  }

  function resetPackage() {
    flight = null
    bob = true
    packageGroup.visible = true
    packageGroup.position.set(0, 1.15, 2.6)
    packageGroup.rotation.set(-0.06, 0.12, 0)
    packageGroup.scale.set(1, 1, 1)
    packageGroup.children.forEach((child) => {
      if (child.userData.packageCrack) child.visible = false
    })
    impactFx = 0
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
    const visualWind = windVisualOverride ?? wind
    if (moveAmplitude > 0) {
      const phase = (now / 1000) * (Math.PI * 2 / movePeriod)
      targetX = baseX + Math.sin(phase) * moveAmplitude
      targetGroup.position.x = targetX
      if (secondaryTarget) {
        secondaryTarget.x = secondaryBaseX + Math.sin(phase) * moveAmplitude
        secondaryTargetGroup.position.x = secondaryTarget.x
      }
    }
    updateWindProps(scenes[sceneName], visualWind, now)
    updateAnimals(now)
    targetGroup.children.forEach((child) => {
      if (child.userData.spin) child.rotation.z += child.userData.spin * dt
      if (child.userData.beacon) {
        child.position.y = 0.36 + Math.sin(now * 0.003) * 0.12
        child.rotation.y += dt * 1.6
      }
    })
    windStreaks.children.forEach((streak) => {
      const direction = Math.abs(visualWind) < 0.08 ? 1 : Math.sign(visualWind)
      streak.position.x += direction * streak.userData.speed * dt
      streak.material.opacity = streak.userData.baseOpacity * (0.45 + Math.min(1.2, Math.abs(visualWind)))
      if (streak.position.x > 12) streak.position.x = -12
      if (streak.position.x < -12) streak.position.x = 12
    })
    clouds.forEach((cloud) => {
      cloud.position.x += cloud.userData.speed * dt
      if (cloud.position.x > 22) cloud.position.x = -24
    })
    updateParticles(dt)

    const event = { bounced: false, done: false, kind: null, animal: null, fellOff: false }
    if (!flight) {
      if (bob) packageGroup.position.y = 1.15 + Math.sin(now * 0.004) * 0.06
      updatePackageImpact(dt)
      return event
    }
    const beforeBounce = flight.bounceCount
    const beforeAnimal = flight.animalHit
    const beforeFellOff = Boolean(flight.fellOff)
    stepFlight(flight, dt, {
      wind,
      targetX,
      targetZ,
      targetScale,
      secondaryTarget,
      animals: animalSnapshots(calmRank),
    })
    packageGroup.position.set(flight.x, flight.y, flight.z)
    packageGroup.rotation.x += flight.ax * dt
    packageGroup.rotation.y += flight.ay * dt
    packageGroup.rotation.z += flight.az * dt
    if (flight.bounceCount === 0 && Math.random() < dt * 14) spawnTrail()
    if (flight.bounceCount > beforeBounce) {
      event.bounced = true
      impactFx = 0.38
    }
    if (flight.fellOff && !beforeFellOff) event.fellOff = true
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
    updatePackageImpact(dt)
    return event
  }

  function updatePackageImpact(dt) {
    if (impactFx <= 0) {
      packageGroup.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 18))
      return
    }
    impactFx = Math.max(0, impactFx - dt)
    const progress = 1 - impactFx / 0.38
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const amount = reduced ? 0.08 : 0.28
    const squash = progress < 0.28
      ? Math.sin((progress / 0.28) * Math.PI * 0.5)
      : Math.sin(((progress - 0.28) / 0.72) * Math.PI) * (1 - progress)
    packageGroup.scale.set(1 + squash * amount * 0.45, 1 - squash * amount, 1 + squash * amount * 0.32)
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
      applyAtmosphere(sceneName)
    },
    setSkin(parcel) {
      const box = packageGroup.children.find((child) => child.userData.packagePart === 'box')
      const tape = packageGroup.children.filter((child) => child.userData.packagePart === 'tape')
      const label = packageGroup.children.find((child) => child.userData.packagePart === 'label')
      if (box) box.material.color.setHex(parcel.box)
      tape.forEach((part) => part.material.color.setHex(parcel.tape))
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
    previewWind(nextWind) { windVisualOverride = nextWind },
    commitWind() { windVisualOverride = null },
    crackPackage() {
      packageGroup.children.forEach((child) => {
        if (child.userData.packageCrack) child.visible = true
      })
    },
    previewLanding({ cracked = false, secondary = false } = {}) {
      const target = secondary && secondaryTarget ? secondaryTarget : { x: targetX, z: targetZ }
      flight = null
      bob = false
      packageGroup.visible = true
      packageGroup.position.set(target.x, ROOF_TOP + 0.29, target.z)
      packageGroup.rotation.set(0.08, -0.16, 0.04)
      packageGroup.scale.set(1.12, 0.72, 1.08)
      packageGroup.children.forEach((child) => {
        if (child.userData.packageCrack) child.visible = cracked
      })
    },
    resetPackage,
    setAim,
    hideAim,
    launch,
    step,
    render,
    get target() { return { x: targetX, z: targetZ, scale: targetScale, secondary: secondaryTarget ? { ...secondaryTarget } : null } },
    get actors() {
      return roster.filter((entry) => entry.config && entry.group.visible).map((entry) => ({
        type: entry.type,
        x: entry.group.position.x,
        z: entry.group.position.z,
      }))
    },
    get flying() { return Boolean(flight) },
    get sceneName() { return sceneName },
    get districtMetrics() {
      const spec = DISTRICTS[sceneName]
      const neonCounts = { textSigns: 0, foregroundTextSigns: 0, rearTextSigns: 0, expressWallMounted: false, expressSpaced: false, expressScreen: null, symbols: 0, foregroundSymbols: 0, backgroundSymbols: 0, crosses: 0, boards: 0, eaves: 0, streetTubes: 0, roundTubes: 0, maxTubeRadius: 0 }
      if (sceneName === 'neon') scenes.neon.traverse((child) => {
        if (child.userData.neonText) {
          neonCounts.textSigns += 1
          if (child.userData.neonTextZone === 'foreground') neonCounts.foregroundTextSigns += 1
          if (child.userData.neonTextZone === 'rear') neonCounts.rearTextSigns += 1
          if (child.userData.neonText === 'EXPRESS') {
            neonCounts.expressWallMounted = child.userData.neonTextSurface === 'street-wall' && child.position.y < -1
            neonCounts.expressSpaced = child.userData.neonLetterSpaced === true
            const projected = child.getWorldPosition(new THREE.Vector3()).project(camera)
            neonCounts.expressScreen = { x: Math.round((projected.x + 1) * 800) / 2, y: Math.round((1 - projected.y) * 450) / 2 }
          }
        }
        if (child.userData.neonSymbol) {
          neonCounts.symbols += 1
          if (child.userData.neonSymbolRole === 'foreground') neonCounts.foregroundSymbols += 1
          if (child.userData.neonSymbolRole === 'background') neonCounts.backgroundSymbols += 1
          if (child.userData.neonSymbol === 'cross') neonCounts.crosses += 1
        }
        if (child.userData.neonBillboard) neonCounts.boards += 1
        if (child.userData.neonTubeRole === 'eave') neonCounts.eaves += 1
        if (child.userData.neonTubeRole === 'street') neonCounts.streetTubes += 1
        if (child.userData.neonTubeRadius) {
          neonCounts.roundTubes += 1
          neonCounts.maxTubeRadius = Math.max(neonCounts.maxTubeRadius, child.userData.neonTubeRadius)
        }
      })
      return {
        gap: 4,
        streetWidth: 8,
        skylineCount: 22,
        palette: spec.body,
        architecture: spec.architecture,
        ...(sceneName === 'neon' ? { neonCounts } : {}),
      }
    },
    get windPropDirection() {
      let direction = 0
      scenes[sceneName]?.traverse((child) => {
        if (child.userData.windResponsive === 'flag') direction = Math.sign(child.scale.x)
      })
      return direction
    },
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

function makeBuilding(width, height, depth, color, options = {}) {
  const group = new THREE.Group()
  const kind = options.kind || 'depot'
  const spec = DISTRICTS[kind] || DISTRICTS.depot
  const floors = Math.max(2, Math.floor(height / 1.25))
  const floorHeight = height / floors
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.02 }),
  )
  body.castShadow = false
  body.receiveShadow = false
  group.add(body)

  const trim = options.trim ?? spec.trim
  const trimMaterial = sceneMaterial(trim, { roughness: 0.72 })
  for (let floor = 1; floor < floors; floor += 1) {
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(width + 0.12, 0.075, 0.16), trimMaterial)
    ledge.position.set(0, -height / 2 + floor * floorHeight, depth / 2 + 0.045)
    group.add(ledge)
  }
  for (const x of [-width / 2 + 0.11, width / 2 - 0.11]) {
    const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.16, height + 0.12, 0.16), trimMaterial)
    pilaster.position.set(x, 0, depth / 2 + 0.045)
    group.add(pilaster)
  }

  const roofY = height / 2 + 0.35
  const parapetFront = new THREE.Mesh(new THREE.BoxGeometry(width + 0.18, 0.28, 0.18), trimMaterial)
  parapetFront.position.set(0, roofY, depth / 2 - 0.02)
  group.add(parapetFront)
  for (const x of [-width / 2 + 0.08, width / 2 - 0.08]) {
    const parapetSide = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, depth), trimMaterial)
    parapetSide.position.set(x, roofY, 0)
    group.add(parapetSide)
  }

  const columns = Math.max(2, Math.min(4, Math.floor(width / 1.25)))
  const frameMaterial = new THREE.MeshBasicMaterial({ color: spec.windowFrame })
  const windowMaterial = new THREE.MeshBasicMaterial({ color: options.windowColor ?? spec.windows, transparent: true, opacity: options.windowOpacity ?? spec.windowOpacity })
  for (let floor = 0; floor < floors; floor += 1) {
    const y = -height / 2 + floorHeight * (floor + 0.55)
    for (let column = 0; column < columns; column += 1) {
      if ((floor + column + (options.index || 0)) % spec.windowSkip === 0) continue
      const x = columns === 1 ? 0 : -width * 0.34 + column * (width * 0.68 / (columns - 1))
      addWindow(group, [x, y, depth / 2 + 0.014], 0, frameMaterial, windowMaterial, kind === 'depot' ? 0.58 : 0.46, kind === 'laundry' ? 0.48 : 0.34)
    }
  }

  if (options.streetFace) {
    const faceX = options.streetFace * (width / 2 + 0.014)
    const rotation = options.streetFace > 0 ? Math.PI / 2 : -Math.PI / 2
    for (let floor = 0; floor < floors; floor += 1) {
      const y = -height / 2 + floorHeight * (floor + 0.55)
      for (const z of [-depth * 0.24, depth * 0.24]) addWindow(group, [faceX, y, z], rotation, frameMaterial, windowMaterial, 0.42, 0.32)
    }
  }

  addArchitectureDetails(group, kind, width, height, depth, options)
  return group
}

function addWindow(group, position, rotationY, frameMaterial, paneMaterial, width, height) {
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(width + 0.14, height + 0.14), frameMaterial)
  frame.position.set(...position)
  frame.rotation.y = rotationY
  group.add(frame)
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), paneMaterial)
  pane.position.set(...position)
  if (rotationY === 0) pane.position.z += 0.006
  else pane.position.x += Math.sign(Math.sin(rotationY)) * 0.006
  pane.rotation.y = rotationY
  group.add(pane)
}

function addArchitectureDetails(group, kind, width, height, depth, options) {
  const spec = DISTRICTS[kind]
  const top = height / 2
  const index = options.index || 0
  const streetFace = options.streetFace || 0
  const roofDecor = options.roofDecor !== false
  if (kind === 'depot') {
    const doors = Math.max(2, Math.floor(width / 2.2))
    for (let index = 0; index < doors; index += 1) {
      const x = doors === 1 ? 0 : -width * 0.3 + index * (width * 0.6 / (doors - 1))
      sceneBox(group, [Math.min(1.25, width / doors - 0.18), 1.15, 0.08], 0x4c4945, [x, -height / 2 + 0.68, depth / 2 + 0.08], { castShadow: false })
      sceneBox(group, [Math.min(1.4, width / doors), 0.14, 0.48], spec.accent, [x, -height / 2 + 1.38, depth / 2 + 0.2], { castShadow: false })
    }
    if (streetFace) {
      for (const z of [-depth * 0.24, depth * 0.24]) {
        sceneBox(group, [0.08, 1.08, Math.min(1.05, depth * 0.26)], 0x4c4945, [streetFace * (width / 2 + 0.08), -height / 2 + 0.64, z], { castShadow: false })
        sceneBox(group, [0.46, 0.14, Math.min(1.18, depth * 0.29)], spec.accent, [streetFace * (width / 2 + 0.2), -height / 2 + 1.32, z], { castShadow: false })
      }
      if (roofDecor) {
        sceneBox(group, [0.64, 0.48, 0.58], index % 3 ? 0xd99a5f : 0xf05d4e, [streetFace * width * 0.18, top + 0.38, -depth * 0.08])
        sceneBox(group, [0.48, 0.36, 0.46], 0xc58450, [streetFace * width * 0.18, top + 0.28, depth * 0.18])
      }
    }
  } else if (kind === 'laundry') {
    for (let y = -height / 2 + 1.35; y < top - 0.6; y += 2.35) {
      sceneBox(group, [width * 0.72, 0.1, 0.72], spec.trim, [0, y, depth / 2 + 0.32], { castShadow: false })
      sceneBox(group, [width * 0.72, 0.42, 0.06], 0xe6f0e8, [0, y + 0.22, depth / 2 + 0.66], { opacity: 0.78, castShadow: false })
      for (const [offset, color] of [[-0.24, 0xf05d4e], [0.02, 0xf7d58b], [0.27, 0x65c7b8]]) {
        sceneBox(group, [0.22, 0.3, 0.025], color, [offset * width, y + 0.05, depth / 2 + 0.7], { castShadow: false })
      }
    }
    if (streetFace) {
      const lineX = streetFace * (width / 2 + 0.28)
      const lineY = top - 0.55
      sceneBox(group, [0.035, 0.035, depth * 0.82], 0xf4ead8, [lineX, lineY, 0], { castShadow: false })
      ;[[-0.28, 0xf05d4e], [0, 0xf7d58b], [0.28, 0x65c7b8]].forEach(([offset, color], clothIndex) => {
        const cloth = sceneBox(group, [0.04, 0.5, Math.min(0.64, depth * 0.19)], color, [lineX, lineY - 0.27 - (clothIndex % 2) * 0.05, offset * depth])
        cloth.userData.windResponsive = 'laundry'
      })
    }
  } else if (kind === 'garden') {
    if (roofDecor) {
      sceneBox(group, [width * 0.72, 0.34, depth * 0.3], 0x9b5d3d, [0, top + 0.3, -depth * 0.14], { castShadow: false })
      for (const x of [-width * 0.24, 0, width * 0.24]) {
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(Math.min(0.34, width * 0.08), 0), sceneMaterial(x === 0 ? 0x477c43 : 0x6f9c4c))
        crown.position.set(x, top + 0.68, -depth * 0.14)
        group.add(crown)
      }
      for (const x of [-width * 0.38, width * 0.38]) sceneBox(group, [0.12, 0.7, depth * 0.72], spec.trim, [x, top + 0.34, 0], { castShadow: false })
    }
    if (streetFace) {
      for (const y of [-height * 0.18, height * 0.14]) {
        sceneBox(group, [0.16, 0.22, depth * 0.34], 0x9b5d3d, [streetFace * (width / 2 + 0.09), y, 0], { castShadow: false })
        for (const z of [-depth * 0.11, 0, depth * 0.11]) {
          const shrub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), sceneMaterial((index + Math.round(z * 10)) % 2 ? 0x477c43 : 0x6f9c4c))
          shrub.position.set(streetFace * (width / 2 + 0.2), y + 0.26, z)
          group.add(shrub)
        }
      }
    }
  } else if (kind === 'neon') {
    const neonColors = [0xff4fa3, 0x35f5e4, 0xffb84d, 0x5cff8d]
    const neonColor = neonColors[index % neonColors.length]
    if (roofDecor) {
      if (streetFace) {
        const eave = addGlowTube(group, [0.12, 0.12, depth + 0.12], neonColor, [streetFace * (width / 2 + 0.08), top + 0.52, 0])
        eave.userData.neonTubeRole = 'eave'
      }
    }
    if (streetFace && ![0, 1, 20, 21].includes(index)) {
      const foreground = index === 18 || index === 19
      const backgroundSymbols = ['circle', 'arrow', 'cup', 'circle', 'cross', 'circle', 'arrow', 'cup']
      const symbol = index === 18 ? 'cup' : index === 19 ? 'arrow' : backgroundSymbols[index % backgroundSymbols.length]
      addNeonSymbol(group, symbol, neonColor, streetFace, width, height, index, foreground ? 0.76 : 0.42, foreground ? 'foreground' : 'background')
    }
  } else if (kind === 'glasshouse') {
    if (roofDecor) {
      const glass = sceneBox(group, [width * 0.64, 0.78, depth * 0.42], 0x9adcec, [0, top + 0.52, 0], { opacity: 0.38, castShadow: false })
      glass.material.depthWrite = false
      for (const x of [-width * 0.28, 0, width * 0.28]) sceneBox(group, [0.08, 1.0, depth * 0.44], spec.trim, [x, top + 0.52, 0], { castShadow: false })
    }
  } else if (kind === 'beacon') {
    for (const x of [-width * 0.38, width * 0.38]) sceneBox(group, [0.22, height + 0.2, 0.18], spec.trim, [x, 0, depth / 2 + 0.08], { castShadow: false })
    if (roofDecor && index === 2) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.58, 2.25, 10), sceneMaterial(0xfff5de))
      tower.position.set(0, top + 1.15, 0)
      group.add(tower)
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshBasicMaterial({ color: spec.accent }))
      lamp.position.set(0, top + 2.4, 0)
      group.add(lamp)
      const beam = new THREE.Mesh(new THREE.ConeGeometry(0.82, 3.8, 14, 1, true), new THREE.MeshBasicMaterial({ color: spec.accent, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }))
      beam.rotation.z = -Math.PI / 2
      beam.position.set(-1.85, top + 2.4, 0)
      group.add(beam)
    } else if (roofDecor && index % 3 === 0) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.46, 0.75, 8), sceneMaterial(spec.accent))
      cap.position.set(0, top + 0.58, 0)
      group.add(cap)
    }
  }
}

function addNeonText(group, { text, width, height, color, position, axis = 'front', rotationY = null, vertical = false, spaced = false, surface = 'sign', zone = 'foreground' }) {
  const isFront = axis === 'front'
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: makeNeonSignTexture(text, color, vertical, spaced), transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  )
  plane.position.set(...position)
  if (rotationY !== null) plane.rotation.y = rotationY
  else if (!isFront) plane.rotation.y = axis === 'right' ? Math.PI / 2 : -Math.PI / 2
  plane.userData.neonText = text
  plane.userData.neonTextZone = zone
  plane.userData.neonTextAxis = axis
  plane.userData.neonLetterSpaced = spaced
  plane.userData.neonTextSurface = surface
  group.add(plane)
  return plane
}

function rotateGlowPair(tube, rotationZ) {
  tube.rotation.z += rotationZ
}

function addNeonArrow(group, color, position, scale = 1) {
  const arrow = new THREE.Group()
  addGlowTube(arrow, [1.55 * scale, 0.12, 0.12], color, [-0.15 * scale, 0, 0], 0.16)
  rotateGlowPair(addGlowTube(arrow, [0.72 * scale, 0.12, 0.12], color, [0.62 * scale, 0.25 * scale, 0], 0.16), -0.72)
  rotateGlowPair(addGlowTube(arrow, [0.72 * scale, 0.12, 0.12], color, [0.62 * scale, -0.25 * scale, 0], 0.16), 0.72)
  arrow.position.set(...position)
  arrow.userData.neonSymbol = 'parcel-arrow'
  arrow.userData.neonSymbolRole = 'hero'
  group.add(arrow)
}

function addNeonRing(group, color, position, radius) {
  const glow = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.12, 10, 40),
    sceneMaterial(color, { emissive: color, emissiveIntensity: 2.2, opacity: 0.2 }),
  )
  glow.material.depthWrite = false
  glow.position.set(...position)
  group.add(glow)
  const tube = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.06, 10, 40), sceneMaterial(color, { emissive: color, emissiveIntensity: 5.2 }))
  tube.position.set(...position)
  tube.userData.neonSymbol = '24h-circle'
  tube.userData.neonSymbolRole = 'hero'
  tube.userData.neonTubeRadius = 0.06
  group.add(tube)
}

function addNeonSymbol(group, symbol, color, streetFace, width, height, index, scale = 0.42, role = 'background') {
  const symbolGroup = new THREE.Group()
  const faceX = streetFace * (width / 2 + 0.11)
  const y = height / 2 - 1.2
  const addPart = (size, offset, rotationX = 0) => {
    const tube = addGlowTube(symbolGroup, size.map((value) => value * scale), color, offset.map((value) => value * scale), 0.14)
    tube.rotation.x += rotationX
  }
  if (symbol === 'arrow') {
    addPart([0.12, 0.12, 1.5], [0, 0, 0])
    addPart([0.12, 0.12, 0.72], [0, 0.25, 0.62], 0.72)
    addPart([0.12, 0.12, 0.72], [0, -0.25, 0.62], -0.72)
  } else if (symbol === 'circle') {
    const torus = new THREE.Mesh(new THREE.TorusGeometry(0.62 * scale, 0.06, 8, 24), sceneMaterial(color, { emissive: color, emissiveIntensity: 4.8 }))
    torus.rotation.y = Math.PI / 2
    torus.userData.neonTubeRadius = 0.06
    symbolGroup.add(torus)
  } else if (symbol === 'cross') {
    addPart([0.12, 1.35, 0.12], [0, 0, 0])
    addPart([0.12, 0.12, 1.35], [0, 0, 0])
  } else {
    addPart([0.12, 1.05, 0.12], [0, 0, -0.48])
    addPart([0.12, 1.05, 0.12], [0, 0, 0.48])
    addPart([0.12, 0.12, 1.12], [0, -0.52, 0])
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.32 * scale, 0.06, 8, 18, Math.PI), sceneMaterial(color, { emissive: color, emissiveIntensity: 4.8 }))
    handle.rotation.set(0, Math.PI / 2, Math.PI / 2)
    handle.position.set(0, -0.05 * scale, 0.62 * scale)
    handle.userData.neonTubeRadius = 0.06
    symbolGroup.add(handle)
  }
  const foregroundCupDrop = index === 18 ? 1.3 : 0
  symbolGroup.position.set(faceX, y - (index % 3) * 0.18 - foregroundCupDrop, 0)
  symbolGroup.userData.neonSymbol = symbol
  symbolGroup.userData.neonSymbolRole = role
  symbolGroup.userData.neonSymbolScale = scale
  group.add(symbolGroup)
}

function addGlowTube(group, size, color, position, glowOpacity = 0.22, radius = 0.06) {
  const axis = size.indexOf(Math.max(...size))
  const length = size[axis]
  const tubeGroup = new THREE.Group()
  const geometry = (tubeRadius) => new THREE.CylinderGeometry(tubeRadius, tubeRadius, length, 12)
  const glow = new THREE.Mesh(geometry(radius * 2), sceneMaterial(color, { emissive: color, emissiveIntensity: 2.4, opacity: glowOpacity }))
  glow.material.depthWrite = false
  glow.renderOrder = 1
  const tube = new THREE.Mesh(geometry(radius), sceneMaterial(color, { emissive: color, emissiveIntensity: 5.2 }))
  tube.renderOrder = 2
  tube.userData.neonTubeRadius = radius
  tubeGroup.add(glow, tube)
  if (axis === 0) tubeGroup.rotation.z = Math.PI / 2
  if (axis === 2) tubeGroup.rotation.x = Math.PI / 2
  tubeGroup.position.set(...position)
  group.add(tubeGroup)
  return tubeGroup
}

function addDistrictEnvironment(group, kind) {
  const spec = DISTRICTS[kind]
  const start = makeBuilding(9.2, 8.5, 9.5, spec.startBody, { kind, index: 22, windowColor: spec.windows, roofDecor: false })
  start.position.set(0, -4.25, 5)
  group.add(start)
  sceneBox(group, [9.4, 0.22, 9.7], spec.startRoof, [0, 0.38, 5], { castShadow: false })
  for (const x of [-4.05, 4.05]) sceneBox(group, [0.1, 0.58, 7.2], spec.trim, [x, 0.77, 5])

  for (let index = 0; index < 22; index += 1) {
    const side = index % 2 === 0 ? -1 : 1
    const width = 2.8 + (index % 4) * 0.6
    const depth = 3.6 + (index % 5) * 0.7
    const rawHeight = 4 + (index % 6) * 1.4
    const height = kind === 'depot' ? 3.8 + (index % 4) * 0.85 : kind === 'garden' ? 3.7 + (index % 3) * 1.05 : rawHeight
    const building = makeBuilding(width, height, depth, spec.skylinePalette[index % spec.skylinePalette.length], {
      kind,
      index,
      streetFace: -side,
      windowColor: spec.skylineWindows[index % spec.skylineWindows.length],
    })
    building.position.set(side * (7.4 + (index % 5) * 1.5), -height / 2 - (index % 3) * 0.4, -28 + (index % 11) * 3.1)
    group.add(building)
  }

  if (kind === 'neon') {
    addNeonText(group, { text: 'NIGHT', width: 1.45, height: 4.4, color: 0x35f5e4, position: [-5.65, 2.55, -1.0], vertical: true })
    sceneBox(group, [1.05, 0.14, 0.14], 0x232942, [-6.35, 2.55, -1.08], { metalness: 0.26, castShadow: false })

    addNeonText(group, { text: 'PARCEL', width: 4.15, height: 1.42, color: 0xff4fa3, position: [5.72, 3.0, -1.0] })
    addNeonArrow(group, 0xffb84d, [5.72, 1.82, -0.98], 1.0)
    sceneBox(group, [1.0, 0.14, 0.14], 0x232942, [6.4, 2.42, -1.08], { metalness: 0.26, castShadow: false })

    addNeonRing(group, 0xffb84d, [6.05, 2.75, -13.7], 1.42)
    addNeonText(group, { text: '24H', width: 2.15, height: 1.18, color: 0xffb84d, position: [6.05, 2.75, -13.55], zone: 'rear' })

    addNeonText(group, { text: 'EXPRESS', width: 5.0, height: 1.5, color: 0x5cff8d, position: [-9.15, -1.05, -6.3], rotationY: 1.3, spaced: true, surface: 'street-wall' })
  }

  const street = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 52),
    new THREE.MeshStandardMaterial({ color: spec.street, roughness: 1 }),
  )
  street.rotation.x = -Math.PI / 2
  street.position.set(0, -8.8, -8)
  group.add(street)
  for (let i = 0; i < 9; i += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.01, 1.3), new THREE.MeshBasicMaterial({ color: spec.streetStripe }))
    stripe.position.set(0, -8.76, 8 - i * 4.6)
    group.add(stripe)
  }
  if (kind === 'neon') {
    const leftStreetTube = addGlowTube(group, [0.12, 0.12, 4.45], 0x35f5e4, [-4.04, 0.56, -1.75], 0.22)
    const rightStreetTube = addGlowTube(group, [0.12, 0.12, 4.45], 0xff4fa3, [4.04, 0.56, -1.75], 0.22)
    leftStreetTube.userData.neonTubeRole = 'street'
    rightStreetTube.userData.neonTubeRole = 'street'
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

function createSecondaryTarget() {
  const group = new THREE.Group()
  const outer = new THREE.Mesh(
    new THREE.RingGeometry(0.72, 1.45, 48),
    new THREE.MeshBasicMaterial({ color: 0xfff5de, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false }),
  )
  outer.rotation.x = -Math.PI / 2
  group.add(outer)
  const inner = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.66, 48),
    new THREE.MeshBasicMaterial({ color: 0x0f7f78, transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false }),
  )
  inner.rotation.x = -Math.PI / 2
  inner.position.y = 0.008
  group.add(inner)
  const marker = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.32), new THREE.MeshBasicMaterial({ color: 0xfff5de }))
  marker.rotation.y = Math.PI / 4
  marker.position.y = 0.15
  group.add(marker)
  return group
}

function createPackage() {
  const group = new THREE.Group()
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 0.62, 0.58),
    new THREE.MeshStandardMaterial({ color: 0xf05d4e, roughness: 0.76, metalness: 0.01 }),
  )
  box.castShadow = true
  box.receiveShadow = true
  box.userData.packagePart = 'box'
  group.add(box)
  const tape = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.635, 0.59),
    new THREE.MeshStandardMaterial({ color: 0xf7d58b, roughness: 0.72 }),
  )
  tape.userData.packagePart = 'tape'
  group.add(tape)
  const crossTape = new THREE.Mesh(
    new THREE.BoxGeometry(0.87, 0.635, 0.15),
    new THREE.MeshStandardMaterial({ color: 0xf7d58b, roughness: 0.72 }),
  )
  crossTape.userData.packagePart = 'tape'
  group.add(crossTape)
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.26), new THREE.MeshBasicMaterial({ map: makeLabelTexture() }))
  label.position.set(0.19, 0.015, 0.296)
  label.userData.packagePart = 'label'
  group.add(label)
  const crackMaterial = new THREE.MeshBasicMaterial({ color: 0x351821, side: THREE.DoubleSide, depthTest: false })
  ;[
    [-0.22, 0.15, 0.075, 0.34, -0.72],
    [-0.08, -0.02, 0.065, 0.28, 0.58],
    [0.10, 0.14, 0.072, 0.31, 0.66],
    [0.23, -0.05, 0.065, 0.29, -0.62],
  ].forEach(([x, y, width, height, rotation]) => {
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(width, height), crackMaterial)
    crack.position.set(x, y, 0.302)
    crack.rotation.z = rotation
    crack.visible = false
    crack.renderOrder = 5
    crack.userData.packageCrack = true
    group.add(crack)
  })
  ;[
    [-0.20, -0.10, 0.075, 0.36, -0.78],
    [0.02, 0.03, 0.07, 0.32, 0.68],
    [0.22, -0.08, 0.065, 0.27, -0.48],
  ].forEach(([x, z, width, length, rotation]) => {
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(width, length), crackMaterial)
    crack.position.set(x, 0.316, z)
    crack.rotation.x = -Math.PI / 2
    crack.rotation.z = rotation
    crack.visible = false
    crack.renderOrder = 5
    crack.userData.packageCrack = true
    group.add(crack)
  })
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

function makeNeonSignTexture(text = 'NIGHT', color = 0x35f5e4, vertical = false, spaced = false) {
  makeNeonSignTexture.cache ||= new Map()
  const cacheKey = `${text}-${color}-${vertical}-${spaced}`
  if (makeNeonSignTexture.cache.has(cacheKey)) return makeNeonSignTexture.cache.get(cacheKey)
  const canvas = document.createElement('canvas')
  canvas.width = vertical ? 320 : spaced ? 1024 : 768
  canvas.height = vertical ? 768 : 320
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const fontSize = vertical ? 112 : spaced ? 150 : text.length >= 7 ? 116 : text.length >= 6 ? 132 : 150
  ctx.font = `900 ${fontSize}px Arial Rounded MT Bold, Arial Black, Arial, sans-serif`
  const tubeColor = `#${color.toString(16).padStart(6, '0')}`
  const coreColor = color === 0xff4fa3 ? '#ffd0e8' : color === 0xffb84d ? '#fff0b8' : color === 0x5cff8d ? '#d0ffdc' : '#c5fff9'
  const drawTubeText = (value, x, y) => {
    ctx.shadowColor = tubeColor
    ctx.shadowBlur = 54
    ctx.strokeStyle = tubeColor
    ctx.lineWidth = 28
    ctx.strokeText(value, x, y)
    ctx.shadowBlur = 22
    ctx.lineWidth = 18
    ctx.strokeText(value, x, y)
    ctx.shadowBlur = 0
    ctx.strokeStyle = coreColor
    ctx.lineWidth = 7
    ctx.strokeText(value, x, y)
  }
  if (vertical) {
    const step = canvas.height / (text.length + 0.6)
    ;[...text].forEach((letter, index) => drawTubeText(letter, canvas.width / 2, step * (index + 0.8)))
  } else if (spaced) {
    const letters = [...text]
    const step = canvas.width / (letters.length + 1)
    letters.forEach((letter, index) => drawTubeText(letter, step * (index + 1), canvas.height / 2))
  } else {
    drawTubeText(text, canvas.width / 2, canvas.height / 2)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  makeNeonSignTexture.cache.set(cacheKey, texture)
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
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
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

const DISTRICTS = {
  depot: {
    architecture: 'warehouse', height: 8.0, body: 0x826b59, startBody: 0x6d6257, roof: 0xddc69b,
    trim: 0x4c4945, accent: 0xd99a5f, windows: 0xffd27a, windowFrame: 0x3d3b39, windowOpacity: 0.68, windowSkip: 3, utility: 'tank',
    street: 0x3e3d45, streetStripe: 0xf0c66f, skylinePalette: [0x74675e, 0x8c735f, 0x665f5a, 0x96785f], skylineWindows: [0xffd892, 0xe9bd72],
    fog: 0x9b8176, fogDensity: 0.018, hemiSky: 0xffd6a5, hemiGround: 0x514c48, hemiIntensity: 2.5,
    sun: 0xffc48f, sunIntensity: 4.2, rim: 0xd9a276, rimIntensity: 1.4, cloud: 0xffd9bd, cloudOpacity: 0.18,
  },
  laundry: {
    architecture: 'residential', height: 10.6, body: 0x547d91, startBody: 0xb96762, roof: 0xd7e4df,
    trim: 0x36556a, accent: 0xf0b44c, windows: 0xffedb6, windowFrame: 0x294457, windowOpacity: 0.9, windowSkip: 4, utility: 'antenna',
    street: 0x3c4650, streetStripe: 0xf4d36f, skylinePalette: [0xc45f59, 0x438f91, 0xc7954c, 0x5879a5, 0xb35f83], skylineWindows: [0xffefac, 0xbdeee7],
    fog: 0x748b98, fogDensity: 0.016, hemiSky: 0xbfe1e5, hemiGround: 0x3d5360, hemiIntensity: 2.55,
    sun: 0xffcf8c, sunIntensity: 3.9, rim: 0x68d4cb, rimIntensity: 2.0, cloud: 0xd9f1ee, cloudOpacity: 0.16,
  },
  garden: {
    architecture: 'courtyard', height: 7.1, body: 0x68754e, startBody: 0x80654d, roof: 0xd5c796,
    trim: 0x524735, accent: 0xb76b4b, windows: 0xffd892, windowFrame: 0x43392e, windowOpacity: 0.72, windowSkip: 3, utility: 'tank',
    street: 0x414640, streetStripe: 0xd7ba75, skylinePalette: [0x68754e, 0x936b4b, 0x536747, 0xa57850], skylineWindows: [0xffd18b, 0xe2e8a7],
    fog: 0x7f886c, fogDensity: 0.015, hemiSky: 0xe8d1a5, hemiGround: 0x46503b, hemiIntensity: 2.45,
    sun: 0xeebc79, sunIntensity: 3.9, rim: 0x8fc378, rimIntensity: 1.7, cloud: 0xf0dcba, cloudOpacity: 0.15,
  },
  neon: {
    architecture: 'sign-tower', height: 12.1, body: 0x292347, startBody: 0x1c203d, roof: 0x51436b,
    trim: 0x15172f, accent: 0x35f5e4, windows: 0x5deadd, windowFrame: 0x101226, windowOpacity: 0.95, windowSkip: 5, utility: 'antenna',
    street: 0x17172b, streetStripe: 0xff4fa3, skylinePalette: [0x1a1d38, 0x292348, 0x372354, 0x173b49], skylineWindows: [0x35f5e4, 0xff4fa3, 0x8c75ff],
    fog: 0x282344, fogDensity: 0.019, hemiSky: 0x40345f, hemiGround: 0x11152a, hemiIntensity: 1.65,
    sun: 0x9276d4, sunIntensity: 2.1, rim: 0x35f5e4, rimIntensity: 3.2, cloud: 0x67517f, cloudOpacity: 0.08,
  },
  glasshouse: {
    architecture: 'glassworks', height: 9.2, body: 0x587680, startBody: 0x506b75, roof: 0xdce7e4,
    trim: 0x344d58, accent: 0x8ed9ee, windows: 0xc4eeff, windowFrame: 0x314a55, windowOpacity: 0.82, windowSkip: 4, utility: 'tank',
    street: 0x38464c, streetStripe: 0xb8e8ef, skylinePalette: [0x587680, 0x688992, 0x46636f, 0x78969b], skylineWindows: [0xc9f7ff, 0x91d8e6],
    fog: 0x7898a3, fogDensity: 0.017, hemiSky: 0xd2edf2, hemiGround: 0x3d5963, hemiIntensity: 2.45,
    sun: 0xc9e7ed, sunIntensity: 3.35, rim: 0x75d8e8, rimIntensity: 2.2, cloud: 0xe1f3f4, cloudOpacity: 0.13,
  },
  beacon: {
    architecture: 'harbor', height: 13.0, body: 0x29364b, startBody: 0x202d42, roof: 0x4c586b,
    trim: 0x141d2c, accent: 0xf2c14e, windows: 0xf2c14e, windowFrame: 0x111827, windowOpacity: 0.9, windowSkip: 4, utility: 'antenna',
    street: 0x151b27, streetStripe: 0xe6b84a, skylinePalette: [0x1e2b3e, 0x29384d, 0x35465b, 0x1a2637], skylineWindows: [0xf2c14e, 0x7da4bd],
    fog: 0x26374c, fogDensity: 0.019, hemiSky: 0x344a65, hemiGround: 0x111927, hemiIntensity: 1.45,
    sun: 0x7589a5, sunIntensity: 1.7, rim: 0x78a9c1, rimIntensity: 2.0, cloud: 0x41556e, cloudOpacity: 0.08,
  },
}
function addDistrictShell(group, kind) {
  const spec = DISTRICTS[kind]
  const building = makeBuilding(9.2, spec.height, 14.5, spec.body, { kind, index: 23, windowColor: spec.windows, roofDecor: false })
  building.position.set(0, 0.28 - spec.height / 2, -11)
  group.add(building)
  const roof = sceneBox(group, [9.4, 0.22, 14.7], spec.roof, [0, 0.38, -11], { castShadow: false })
  roof.receiveShadow = true

  if (spec.utility === 'tank') {
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.68, 1.15, 12),
      sceneMaterial(kind === 'garden' ? 0xc98955 : kind === 'glasshouse' ? 0x6b8e95 : 0xd77858),
    )
    tank.position.set(-3.35, 1.12, -15.6)
    tank.castShadow = true
    group.add(tank)
    sceneBox(group, [1.05, 0.12, 1.05], 0x39384a, [-3.35, 0.58, -15.6])
  } else {
    sceneBox(group, [0.1, 2.3, 0.1], 0x39384a, [-3.4, 1.58, -15.65])
    sceneBox(group, [1.35, 0.08, 0.08], spec.windows, [-3.4, 2.25, -15.65], { castShadow: false })
    sceneBox(group, [0.08, 0.08, 1.1], spec.windows, [-3.4, 2.25, -15.65], { castShadow: false })
  }

  const pole = sceneBox(group, [0.08, 2.1, 0.08], 0x353544, [3.65, 1.48, -7.05])
  pole.castShadow = true
  const flag = sceneBox(group, [1.55, 0.68, 0.04], kind === 'beacon' ? 0xf2c14e : 0xf05d4e, [3.65, 2.05, -7.0], { castShadow: false })
  flag.geometry.translate(0.775, 0, 0)
  flag.userData.windResponsive = 'flag'
  flag.userData.baseRotation = 0
}

function updateWindProps(group, wind, now) {
  if (!group) return
  const lean = THREE.MathUtils.clamp(wind * 0.24, -0.3, 0.3)
  const direction = Math.abs(wind) < 0.05 ? 1 : Math.sign(wind)
  group.traverse((child) => {
    if (child.userData.windResponsive === 'flag') {
      child.rotation.z = -lean + Math.sin(now * 0.006) * 0.025
      child.scale.x = direction * (1 + Math.min(0.14, Math.abs(wind) * 0.08))
    }
    if (child.userData.windResponsive === 'laundry') {
      child.rotation.z = -lean * 0.72 + Math.sin(now * 0.004 + child.position.x) * 0.035
      child.rotation.y = lean * 0.22
    }
  })
}

function createLevelScene(kind) {
  const group = new THREE.Group()
  addDistrictEnvironment(group, kind)
  addDistrictShell(group, kind)
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
