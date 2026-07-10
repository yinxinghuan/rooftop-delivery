import * as THREE from 'three'

// Portable adaptations of the shared _lowpoly_lab cat, dog and chicken builders.
// The library's hard-edge box geometry and identity colors are preserved so the
// animals remain in the same visual family without requiring external GLB files.
const materials = new Map()

function material(color) {
  if (!materials.has(color)) {
    materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: true }))
  }
  return materials.get(color)
}

function box(group, width, height, depth, color, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material(color))
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}

function quadruped(spec) {
  const group = new THREE.Group()
  const bodyLength = spec.bodyLength
  const bodyHeight = spec.bodyHeight
  const bodyWidth = spec.bodyWidth
  const legHeight = spec.legHeight
  const bodyY = legHeight + bodyHeight / 2
  box(group, bodyLength, bodyHeight, bodyWidth, spec.body, 0, bodyY, 0)

  if (spec.stripes) {
    for (let index = 0; index < 3; index += 1) {
      box(group, 0.1, 0.05, bodyWidth * 0.82, spec.stripes, bodyLength * 0.3 - index * 0.24, bodyY + bodyHeight / 2, 0)
    }
  }

  const legWidth = 0.25
  const legX = bodyLength / 2 - legWidth / 2 - 0.04
  const legZ = bodyWidth / 2 - legWidth / 2 - 0.03
  for (const xSign of [-1, 1]) {
    for (const zSign of [-1, 1]) {
      const leg = box(group, legWidth, legHeight, legWidth, spec.leg, xSign * legX, legHeight / 2, zSign * legZ)
      leg.userData.animalPart = 'leg'
      leg.userData.stepPhase = xSign === zSign ? 0 : Math.PI
      box(group, legWidth + 0.01, 0.09, legWidth + 0.01, spec.hoof, xSign * legX, 0.045, zSign * legZ)
    }
  }

  const headWidth = spec.headWidth
  const headHeight = spec.headHeight
  const headDepth = spec.headDepth
  const headX = bodyLength / 2 + headWidth / 2 - 0.22
  const headY = bodyY + 0.17
  box(group, headWidth, headHeight, headDepth, spec.head, headX, headY, 0)
  box(group, spec.snoutWidth, spec.snoutHeight, spec.snoutDepth, spec.snout, headX + headWidth / 2 + spec.snoutWidth / 2 - 0.02, headY - 0.1, 0)

  if (spec.chest) box(group, 0.05, 0.38, 0.34, spec.chest, bodyLength / 2 + 0.005, bodyY - 0.04, 0)

  for (const zSign of [-1, 1]) {
    box(group, spec.earWidth, spec.earHeight, 0.12, spec.ear, headX, headY + headHeight / 2 + spec.earHeight * 0.42, zSign * (headDepth / 2 - 0.1))
    if (spec.innerEar) box(group, spec.earWidth * 0.58, spec.earHeight * 0.58, 0.04, spec.innerEar, headX + 0.02, headY + headHeight / 2 + spec.earHeight * 0.42, zSign * (headDepth / 2 - 0.09))
  }

  const eyeX = headX + headWidth / 2 + 0.006
  for (const zSign of [-1, 1]) box(group, 0.1, 0.13, 0.03, 0x241f1c, eyeX, headY + 0.06, zSign * headDepth * 0.26)

  const tailHeight = spec.tailHeight
  const tail = box(group, 0.13, tailHeight, 0.13, spec.tail, -bodyLength / 2 - 0.02, bodyY + tailHeight / 2, 0)
  tail.userData.animalPart = 'tail'
  const tailTip = box(group, 0.13, 0.13, 0.2, spec.tailTip || spec.tail, -bodyLength / 2 - 0.02, bodyY + tailHeight, 0.06)
  tailTip.userData.animalPart = 'tail'
  return group
}

export function createCat() {
  const cat = quadruped({
    body: 0x9aa1a8, leg: 0x9aa1a8, head: 0x9aa1a8, hoof: 0x4f565c,
    stripes: 0x4f565c, chest: 0xf0f3f5, snout: 0xe9eef2,
    snoutWidth: 0.2, snoutHeight: 0.18, snoutDepth: 0.24,
    ear: 0x9aa1a8, innerEar: 0xf0c4cf, earWidth: 0.16, earHeight: 0.34,
    tail: 0x9aa1a8, tailTip: 0xf0f3f5, tailHeight: 0.52,
    bodyLength: 1.02, bodyHeight: 0.74, bodyWidth: 0.78, legHeight: 0.22,
    headWidth: 0.76, headHeight: 0.74, headDepth: 0.78,
  })
  cat.userData.animalType = 'cat'
  return cat
}

export function createDog() {
  const dog = quadruped({
    body: 0xb5793f, leg: 0xb5793f, head: 0xb5793f, hoof: 0x2c2622,
    chest: 0xf6ecd9, snout: 0x2c2622,
    snoutWidth: 0.22, snoutHeight: 0.2, snoutDepth: 0.32,
    ear: 0x7c5230, earWidth: 0.18, earHeight: 0.25,
    tail: 0xb5793f, tailTip: 0xf6ecd9, tailHeight: 0.36,
    bodyLength: 1.2, bodyHeight: 0.74, bodyWidth: 0.8, legHeight: 0.26,
    headWidth: 0.74, headHeight: 0.7, headDepth: 0.76,
  })
  dog.userData.animalType = 'dog'
  return dog
}

export function createChicken() {
  const chicken = new THREE.Group()
  const legHeight = 0.3
  const bodyY = legHeight + 0.34
  box(chicken, 0.66, 0.6, 0.64, 0xf6f1e8, 0, bodyY, 0)
  box(chicken, 0.32, 0.32, 0.42, 0xf6f1e8, 0.4, bodyY + 0.2, 0)
  box(chicken, 0.2, 0.13, 0.18, 0xf2a23a, 0.62, bodyY + 0.16, 0)
  for (let index = 0; index < 3; index += 1) box(chicken, 0.11, 0.13 + (index === 1 ? 0.06 : 0), 0.12, 0xe23b2e, 0.3 + index * 0.1, bodyY + 0.44, 0)
  box(chicken, 0.1, 0.16, 0.1, 0xe23b2e, 0.54, bodyY + 0.02, 0)
  for (const zSign of [-1, 1]) {
    const wing = box(chicken, 0.1, 0.4, 0.34, 0xeee8de, 0, bodyY, zSign * 0.32)
    wing.userData.animalPart = 'wing'
    wing.userData.wingSide = zSign
    const leg = box(chicken, 0.08, legHeight, 0.08, 0xf2a23a, 0.06, legHeight / 2, zSign * 0.14)
    leg.userData.animalPart = 'leg'
    leg.userData.stepPhase = zSign > 0 ? 0 : Math.PI
    box(chicken, 0.16, 0.06, 0.16, 0xf2a23a, 0.1, 0.03, zSign * 0.14)
    box(chicken, 0.07, 0.1, 0.03, 0x241f1c, 0.55, bodyY + 0.2, zSign * 0.12)
  }
  box(chicken, 0.3, 0.3, 0.1, 0xeae3d6, -0.34, bodyY + 0.2, 0)
  chicken.userData.animalType = 'chicken'
  return chicken
}
