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
      return {
        gap: Number((spec.startBack - spec.targetFront).toFixed(2)),
        skylineCount: spec.skyline.length,
        palette: spec.body,
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
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.02 }),
  )
  body.castShadow = false
  body.receiveShadow = false
  group.add(body)
  const windowMaterial = new THREE.MeshBasicMaterial({ color: options.windowColor ?? 0xffd892, transparent: true, opacity: options.windowOpacity ?? 0.72 })
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

function addDistrictEnvironment(group, kind) {
  const spec = DISTRICTS[kind]
  const start = makeBuilding(9.2, spec.startHeight, spec.startDepth, spec.startBody, {
    windowColor: spec.windows,
    windowOpacity: spec.windowOpacity,
  })
  start.position.set(0, 0.28 - spec.startHeight / 2, spec.startZ)
  group.add(start)
  sceneBox(group, [9.4, 0.22, spec.startDepth + 0.2], spec.startRoof, [0, 0.39, spec.startZ], { castShadow: false })

  const railColor = spec.rail
  const railDepth = Math.max(4.8, spec.startDepth - 1.6)
  for (const x of [-4.05, 4.05]) sceneBox(group, [0.1, 0.58, railDepth], railColor, [x, 0.77, spec.startZ])

  spec.skyline.forEach(([x, z, width, height, depth, colorIndex, topOffset = 0], index) => {
    const building = makeBuilding(width, height, depth, spec.skylinePalette[colorIndex % spec.skylinePalette.length], {
      windowColor: spec.skylineWindows[index % spec.skylineWindows.length],
      windowOpacity: spec.windowOpacity,
    })
    building.position.set(x, topOffset - height / 2, z)
    group.add(building)
    if (kind === 'garden' && index % 3 === 0) {
      const planter = sceneBox(group, [Math.min(2.2, width * 0.62), 0.3, 0.8], 0x9c5d3e, [x, topOffset + 0.2, z + depth * 0.25])
      planter.castShadow = false
      for (const offset of [-0.48, 0, 0.48]) {
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), sceneMaterial(index % 2 ? 0x5c944f : 0x3d7948))
        crown.position.set(x + offset, topOffset + 0.55, z + depth * 0.25)
        group.add(crown)
      }
    }
    if (kind === 'glasshouse' && index % 2 === 0) {
      const skylight = sceneBox(group, [Math.min(2.5, width * 0.55), 0.42, 1.2], 0x8ed9ee, [x, topOffset + 0.23, z], { opacity: 0.42, castShadow: false })
      skylight.rotation.z = index % 4 ? 0.12 : -0.12
    }
  })

  const street = new THREE.Mesh(
    new THREE.PlaneGeometry(spec.streetWidth, 56),
    new THREE.MeshStandardMaterial({ color: spec.street, roughness: 1 }),
  )
  street.rotation.x = -Math.PI / 2
  street.position.set(0, -8.8, -8)
  group.add(street)
  for (let i = 0; i < 10; i += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(spec.stripeWidth, 0.01, spec.stripeLength), new THREE.MeshBasicMaterial({ color: spec.streetStripe }))
    stripe.position.set(0, -8.76, 10 - i * 4.8)
    group.add(stripe)
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

function makeNeonSignTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 224
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.shadowBlur = 28
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '900 92px Arial Black, Arial, sans-serif'
  ctx.strokeStyle = '#123c49'
  ctx.lineWidth = 19
  ctx.strokeText('NIGHT POST', 384, 112)
  ctx.shadowColor = '#35f5e4'
  ctx.strokeStyle = '#35f5e4'
  ctx.lineWidth = 10
  ctx.strokeText('NIGHT POST', 384, 112)
  ctx.shadowColor = '#ff3f9b'
  ctx.fillStyle = '#fff5de'
  ctx.fillText('NIGHT POST', 384, 112)
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
    height: 7.4, body: 0x9a7154, roof: 0xe7c88f, windows: 0xffd27a, windowOpacity: 0.62, utility: 'tank',
    startHeight: 6.8, startDepth: 12, startZ: 4.2, startBack: -1.8, startBody: 0x776c60, startRoof: 0xd8c39c,
    targetDepth: 13, targetZ: -9.7, targetFront: -3.2, rail: 0x5e574f,
    street: 0x514941, streetWidth: 7.2, streetStripe: 0xe9b75d, stripeWidth: 0.11, stripeLength: 1.1,
    skylinePalette: [0x8b7462, 0x72665c, 0xa27e5f, 0x665f59], skylineWindows: [0xffd892, 0xf4bd69],
    skyline: [[-8,-22,5.8,4.2,7,0],[8.5,-20,6.4,5.1,8,2],[-12,-14,7.2,3.6,6,1],[13,-12,6.8,4.5,7,0],[-9,-31,8,5.4,8,3],[10,-30,7.2,6.1,7,1],[-15,-25,5.8,4.1,6,2],[16,-23,7.5,5.2,8,0]],
    fog: 0xb08a73, fogDensity: 0.017, hemiSky: 0xffd59f, hemiGround: 0x5d5147, hemiIntensity: 2.7,
    sun: 0xffc278, sunIntensity: 4.5, rim: 0xf3a65f, rimIntensity: 1.2, cloud: 0xffd9b5, cloudOpacity: 0.2,
  },
  laundry: {
    height: 10.2, body: 0x2f83a0, roof: 0xd8eef0, windows: 0xffef9b, windowOpacity: 0.9, utility: 'antenna',
    startHeight: 9.3, startDepth: 9, startZ: 5.3, startBack: 0.8, startBody: 0xd85b57, startRoof: 0xf2d78f,
    targetDepth: 14, targetZ: -11.2, targetFront: -4.2, rail: 0x354d67,
    street: 0x356777, streetWidth: 10.5, streetStripe: 0xffe875, stripeWidth: 0.13, stripeLength: 0.85,
    skylinePalette: [0xe05d55, 0x2a9d9f, 0xf0b44c, 0x5276b8, 0xd65386], skylineWindows: [0xfff3ad, 0xbdf5f0],
    skyline: [[-6.5,-8,3.2,8.5,4,0],[6.7,-9,3.1,6.2,4,2],[-8,-13,3.5,10.5,4.5,3],[8.2,-14,3.4,9.2,4,4],[-10,-18,3.2,6.8,4,1],[10.3,-19,3.3,11.5,4.3,0],[-7,-24,3.6,12.4,5,2],[7.2,-25,3.3,7.4,4,1],[-11,-29,3.4,9.6,5,4],[11.4,-30,3.2,13.2,4,3],[-14,-12,3.6,7.2,5,2],[14.2,-16,3.4,10.4,4,1],[-16,-23,3.2,12.6,4,0],[16,-27,3.5,8.1,5,4]],
    fog: 0x7796a3, fogDensity: 0.014, hemiSky: 0xbfeaf0, hemiGround: 0x345d68, hemiIntensity: 2.8,
    sun: 0xffd68b, sunIntensity: 4.2, rim: 0x44d7d2, rimIntensity: 2.1, cloud: 0xd7fbff, cloudOpacity: 0.18,
  },
  garden: {
    height: 6.5, body: 0x64764b, roof: 0xd6c18c, windows: 0xffd38c, windowOpacity: 0.7, utility: 'tank',
    startHeight: 5.8, startDepth: 8.4, startZ: 5.4, startBack: 1.2, startBody: 0x8b694c, startRoof: 0xc9b178,
    targetDepth: 13, targetZ: -11.8, targetFront: -5.3, rail: 0x594a39,
    street: 0x4d5742, streetWidth: 12, streetStripe: 0xd7b66c, stripeWidth: 0.16, stripeLength: 1.5,
    skylinePalette: [0x6c7b50, 0xa66d45, 0x556b45, 0xc08a55], skylineWindows: [0xffd18b, 0xe8efad],
    skyline: [[-9,-11,5.8,4.2,5.8,0],[10,-14,5.2,5.1,5,1],[-14,-20,6.2,3.8,6.5,3],[15,-23,6.8,6.4,6,2],[-8,-29,7.4,5.5,7,1],[9,-32,6.2,4.4,6,0],[-17,-31,5.8,7.2,5,2],[18,-12,6.5,3.5,6,3]],
    fog: 0x85936c, fogDensity: 0.013, hemiSky: 0xf2d39b, hemiGround: 0x4a583a, hemiIntensity: 2.6,
    sun: 0xf2bb75, sunIntensity: 4.1, rim: 0x8fcf72, rimIntensity: 1.7, cloud: 0xf5ddb1, cloudOpacity: 0.16,
  },
  neon: {
    height: 12.4, body: 0x211d42, roof: 0x4b3568, windows: 0x3cf4e4, windowOpacity: 0.94, utility: 'antenna',
    startHeight: 12.2, startDepth: 11, startZ: 4.5, startBack: -1, startBody: 0x171a35, startRoof: 0x3f2f5d,
    targetDepth: 13.6, targetZ: -10.4, targetFront: -3.6, rail: 0x1b1830,
    street: 0x11182a, streetWidth: 8.2, streetStripe: 0xff3f9b, stripeWidth: 0.09, stripeLength: 1.8,
    skylinePalette: [0x161a35, 0x24204b, 0x321d4f, 0x123749], skylineWindows: [0x3cf4e4, 0xff45aa, 0x8d6cff],
    skyline: [[-6.8,-8,3.4,13.5,4,0],[6.9,-9,3.1,9.2,4,3],[-8.2,-13,3.8,16.2,4.6,2],[8.4,-14,3.2,14.3,4,1],[-9.7,-18,3.2,10.8,4,3],[9.9,-19,3.5,17.5,4.2,0],[-7,-24,3.2,18.4,4.3,1],[7.4,-25,3.4,12.7,4,2],[-11.2,-28,3.2,15.1,4.2,0],[11.4,-30,3.4,19.2,4,3],[-13.5,-12,3.2,11.6,4,2],[13.8,-16,3.3,16.8,4.4,1],[-15.5,-22,3.1,18.8,4,3],[15.8,-26,3.5,13.9,4.5,0],[-18,-31,3.2,20.2,4,2],[18.2,-10,3.4,12.4,4,1]],
    fog: 0x211a45, fogDensity: 0.02, hemiSky: 0x403267, hemiGround: 0x101527, hemiIntensity: 1.65,
    sun: 0x8c61ff, sunIntensity: 2.2, rim: 0x18f5e2, rimIntensity: 3.5, cloud: 0x71518f, cloudOpacity: 0.08,
  },
  glasshouse: {
    height: 8.8, body: 0x4e7482, roof: 0xd8edf2, windows: 0xc8f5ff, windowOpacity: 0.82, utility: 'tank',
    startHeight: 7.7, startDepth: 9.5, startZ: 4.75, startBack: 0, startBody: 0x496675, startRoof: 0xb8d4db,
    targetDepth: 12.8, targetZ: -11.5, targetFront: -5.1, rail: 0x304a57,
    street: 0x314b5a, streetWidth: 10.8, streetStripe: 0xb8edf5, stripeWidth: 0.12, stripeLength: 1.2,
    skylinePalette: [0x557b88, 0x6c94a0, 0x3f6474, 0x789ca4], skylineWindows: [0xc9f7ff, 0x94ddea],
    skyline: [[-9,-12,7.5,5.1,7,0],[10,-15,8.5,4.2,8,1],[-15,-21,7.2,7.6,6,2],[16,-24,9.2,6.2,8,3],[-9,-30,8.4,8.4,7,1],[10,-33,7.8,5.4,7,0],[-18,-11,7.4,4.5,7,3],[19,-18,8.6,7.1,8,2]],
    fog: 0x7eaab8, fogDensity: 0.018, hemiSky: 0xd8f8ff, hemiGround: 0x365866, hemiIntensity: 2.55,
    sun: 0xc7efff, sunIntensity: 3.5, rim: 0x6fe4ff, rimIntensity: 2.4, cloud: 0xe6fbff, cloudOpacity: 0.14,
  },
  beacon: {
    height: 14.0, body: 0x18243b, roof: 0x2b3a55, windows: 0xffca55, windowOpacity: 0.92, utility: 'antenna',
    startHeight: 13.5, startDepth: 7.4, startZ: 5.5, startBack: 1.8, startBody: 0x131d30, startRoof: 0x26344d,
    targetDepth: 14, targetZ: -11.5, targetFront: -4.5, rail: 0x101827,
    street: 0x0a1220, streetWidth: 13.4, streetStripe: 0xf2c14e, stripeWidth: 0.08, stripeLength: 2.2,
    skylinePalette: [0x101a2d, 0x17263c, 0x213049], skylineWindows: [0xffc74f, 0x5f88a8],
    skyline: [[-10,-13,4.8,15.5,5,0],[11,-17,5.2,10.8,5,1],[-17,-24,4.6,18.2,5,2],[18,-29,5.4,13.4,6,0],[-10,-34,4.8,20.5,5,1],[13,-38,5.2,16.1,5,2]],
    fog: 0x15223a, fogDensity: 0.022, hemiSky: 0x233456, hemiGround: 0x09111f, hemiIntensity: 1.35,
    sun: 0x60749a, sunIntensity: 1.5, rim: 0x6aa9cf, rimIntensity: 2.1, cloud: 0x304665, cloudOpacity: 0.07,
  },
}

function addDistrictShell(group, kind) {
  const spec = DISTRICTS[kind]
  const building = makeBuilding(9.2, spec.height, spec.targetDepth, spec.body, { windowColor: spec.windows, windowOpacity: spec.windowOpacity })
  building.position.set(0, 0.28 - spec.height / 2, spec.targetZ)
  group.add(building)
  const roof = sceneBox(group, [9.4, 0.22, spec.targetDepth + 0.2], spec.roof, [0, 0.38, spec.targetZ], { castShadow: false })
  roof.receiveShadow = true

  if (kind === 'depot') sceneBox(group, [2.4, 4.2, 5.2], 0x6d6257, [-5.8, -1.82, -8.2], { castShadow: false })
  if (kind === 'laundry') {
    sceneBox(group, [2.2, 7.4, 4.5], 0xe05d55, [-5.45, -3.42, -12.5], { castShadow: false })
    sceneBox(group, [1.8, 5.6, 4], 0xf0b44c, [5.25, -2.52, -9.2], { castShadow: false })
  }
  if (kind === 'garden') sceneBox(group, [3.6, 3.3, 4.8], 0xa66d45, [5.8, -1.37, -12.8], { castShadow: false })
  if (kind === 'neon') sceneBox(group, [2.3, 9.6, 4.2], 0x123749, [-5.6, -4.52, -11.2], { castShadow: false })
  if (kind === 'glasshouse') sceneBox(group, [3.8, 4.6, 5.5], 0x6c94a0, [-5.9, -2.02, -12.6], { castShadow: false })
  if (kind === 'beacon') sceneBox(group, [2.8, 11.2, 4.8], 0x101a2d, [-6.1, -5.32, -13.2], { castShadow: false })

  if (spec.utility === 'tank') {
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.68, 1.15, 12),
      sceneMaterial(kind === 'garden' ? 0xc98955 : kind === 'glasshouse' ? 0x6b8e95 : 0xd77858),
    )
    tank.position.set(-3.35, 1.12, spec.targetZ - spec.targetDepth / 2 + 1.35)
    tank.castShadow = true
    group.add(tank)
    sceneBox(group, [1.05, 0.12, 1.05], 0x39384a, [-3.35, 0.58, spec.targetZ - spec.targetDepth / 2 + 1.35])
  } else {
    const antennaZ = spec.targetZ - spec.targetDepth / 2 + 1.25
    sceneBox(group, [0.1, 2.3, 0.1], 0x39384a, [-3.4, 1.58, antennaZ])
    sceneBox(group, [1.35, 0.08, 0.08], spec.windows, [-3.4, 2.25, antennaZ], { castShadow: false })
    sceneBox(group, [0.08, 0.08, 1.1], spec.windows, [-3.4, 2.25, antennaZ], { castShadow: false })
  }

  const flagZ = spec.targetFront - 1.05
  const pole = sceneBox(group, [0.08, 2.1, 0.08], 0x353544, [3.65, 1.48, flagZ])
  pole.castShadow = true
  const flag = sceneBox(group, [1.55, 0.68, 0.04], kind === 'beacon' ? 0xf2c14e : 0xf05d4e, [3.65, 2.05, flagZ], { castShadow: false })
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
  if (kind === 'depot') {
    sceneBox(group, [1.15, 0.78, 1.05], 0xd99a5f, [-2.9, 0.86, -6.6])
    sceneBox(group, [0.86, 0.56, 0.82], 0xf05d4e, [-1.85, 0.75, -6.15])
    sceneBox(group, [2.8, 1.05, 0.12], 0x39384a, [2.1, 1.28, -16.1])
    sceneBox(group, [2.45, 0.72, 0.05], 0xfff5de, [2.1, 1.28, -16.02], { castShadow: false })
    for (const x of [1.4, 2.1, 2.8]) sceneBox(group, [0.12, 0.5, 0.06], 0xf05d4e, [x, 1.28, -15.98], { castShadow: false })
  } else if (kind === 'laundry') {
    for (const x of [-3.45, 3.45]) sceneBox(group, [0.08, 2.15, 0.08], 0x4a465d, [x, 1.55, -15.1])
    for (const z of [-15.05, -14.7]) sceneBox(group, [6.9, 0.035, 0.035], 0xf4ead8, [0, 2.15, z], { castShadow: false })
    ;[[-2.2, 0xf05d4e], [-0.75, 0xf7d58b], [0.8, 0x79d7d2], [2.2, 0x8a6aa6]].forEach(([x, color], index) => {
      const cloth = sceneBox(group, [0.75, 0.78, 0.04], color, [x, 1.75 - (index % 2) * 0.08, -15.02])
      cloth.userData.windResponsive = 'laundry'
    })
  } else if (kind === 'garden') {
    ;[[-3.0, -14.8], [2.75, -14.3], [-3.15, -7.0], [2.9, -6.7]].forEach(([x, z], index) => {
      sceneBox(group, [1.65, 0.48, 0.72], index % 2 ? 0xd99a5f : 0xb76b4b, [x, 0.73, z])
      for (const offset of [-0.48, 0, 0.48]) {
        const plant = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28 + (index % 2) * 0.05, 0), sceneMaterial(index % 2 ? 0x6fa361 : 0x4f8a58))
        plant.position.set(x + offset, 1.12 + Math.abs(offset) * 0.12, z)
        plant.castShadow = true
        group.add(plant)
      }
    })
  } else if (kind === 'neon') {
    const signBack = sceneBox(group, [5.8, 2.05, 0.18], 0x0d1024, [0.45, 1.75, -15.45], { emissive: 0x15102d, emissiveIntensity: 0.7 })
    signBack.castShadow = true
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(5.28, 1.52),
      new THREE.MeshBasicMaterial({ map: makeNeonSignTexture(), transparent: true, depthWrite: false }),
    )
    sign.position.set(0.45, 1.75, -15.34)
    group.add(sign)
    const cyanGlow = new THREE.PointLight(0x35f5e4, 7.5, 8)
    cyanGlow.position.set(-1.2, 2.2, -14.8)
    group.add(cyanGlow)
    const magentaGlow = new THREE.PointLight(0xff3f9b, 6.5, 7)
    magentaGlow.position.set(2.1, 1.35, -14.8)
    group.add(magentaGlow)
    sceneBox(group, [1.8, 0.18, 1.2], 0x4b5b78, [-2.7, 0.62, -7.1], { metalness: 0.18 })
  } else if (kind === 'glasshouse') {
    sceneBox(group, [3.8, 0.08, 3.7], 0xf4ead8, [2.45, 0.58, -13.65])
    for (const x of [0.75, 4.15]) for (const z of [-15.3, -12.0]) sceneBox(group, [0.1, 2.25, 0.1], 0x3d4852, [x, 1.7, z])
    for (const z of [-15.3, -12.0]) sceneBox(group, [3.4, 1.82, 0.07], 0x83d4e8, [2.45, 1.62, z], { opacity: 0.56, castShadow: false })
    for (const x of [1.6, 2.45, 3.3]) sceneBox(group, [0.07, 1.8, 3.35], 0x4f5964, [x, 1.62, -13.65], { castShadow: false })
    const roofLeft = sceneBox(group, [2.08, 0.08, 3.5], 0x83d4e8, [1.55, 2.72, -13.65], { opacity: 0.5, castShadow: false })
    roofLeft.rotation.z = -0.34
    const roofRight = sceneBox(group, [2.08, 0.08, 3.5], 0x83d4e8, [3.35, 2.72, -13.65], { opacity: 0.5, castShadow: false })
    roofRight.rotation.z = 0.34
  } else if (kind === 'beacon') {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.05, 2.65, 12), sceneMaterial(0xfff5de))
    tower.position.set(2.85, 1.82, -15.0)
    tower.castShadow = true
    group.add(tower)
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.28, 12), sceneMaterial(0x353544))
    cap.position.set(2.85, 3.18, -15.0)
    group.add(cap)
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.43, 10, 8), new THREE.MeshBasicMaterial({ color: 0xf2c14e }))
    lamp.position.set(2.85, 3.52, -15.0)
    group.add(lamp)
    const beam = new THREE.Mesh(new THREE.ConeGeometry(1.35, 5.5, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }))
    beam.rotation.z = -Math.PI / 2
    beam.position.set(0.15, 3.52, -15.0)
    group.add(beam)
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
