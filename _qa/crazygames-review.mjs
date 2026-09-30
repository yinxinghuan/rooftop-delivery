import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const base = process.env.ROOFTOP_CG_URL || 'http://127.0.0.1:4180/?playtest=1'
const root = process.cwd()
const finalDir = path.join(root, '_qa', 'ui', 'crazygames-final')
const sceneDir = path.join(root, '_qa', 'ui', 'crazygames-scenes')
await fs.mkdir(finalDir, { recursive: true })
await fs.mkdir(sceneDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 800, height: 450 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
page.on('console', (message) => {
  if (message.type() === 'error' && !message.text().includes('CrazyGames')) errors.push(`console: ${message.text()}`)
})
await page.addInitScript(() => {
  localStorage.setItem('rooftop_cg_profile_v1', JSON.stringify({
    v: 1,
    unlocked: 16,
    cleared: [1,2,3,4,5,6,7,8,9,10],
    best: 640,
    routeBest: {},
    tips: 420,
    upgrades: { gloves: 1, vane: 1, jar: 1, zone: 0, spare: 0, cushion: 0, steady: 0, calm: 0 },
    tutorialSeen: true,
    hintsSeen: [],
    selected: 1,
    audio: { muted: true, volume: 0.75 },
  }))
})
await page.goto(base, { waitUntil: 'networkidle' })
await page.waitForFunction(() => Boolean(window.__cg))

async function startRoute(id) {
  await page.evaluate((routeId) => window.__cg.startRoute(routeId), id)
  await page.waitForFunction(() => window.__cg.snapshot().ready, null, { timeout: 5000 })
}

async function assertFrame(label) {
  const frame = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    app: (() => {
      const rect = document.querySelector('#app').getBoundingClientRect()
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
    })(),
  }))
  if (frame.scrollWidth !== 800 || frame.scrollHeight !== 450) throw new Error(`${label}: viewport overflow ${JSON.stringify(frame)}`)
  if (frame.app.left < -0.5 || frame.app.top < -0.5 || frame.app.right > 800.5 || frame.app.bottom > 450.5) throw new Error(`${label}: app clipped ${JSON.stringify(frame.app)}`)
  return frame
}

await startRoute(2)
await page.keyboard.down('Space')
await page.waitForTimeout(520)
await assertFrame('mid')
await page.screenshot({ path: path.join(finalDir, '800x450-mid.png') })
await page.keyboard.up('Space')

await startRoute(7)
await page.evaluate(() => window.__cg.showCrack())
await page.waitForTimeout(80)
await assertFrame('fragile')
await page.screenshot({ path: path.join(finalDir, '800x450-fragile.png') })
await page.evaluate(() => window.__cg.resolve('delivered'))
await page.evaluate(() => window.__cg.resolve('delivered'))
const fragileRule = await page.evaluate(() => window.__cg.snapshot())
if (fragileRule.misses !== 0 || fragileRule.delivered !== 2 || fragileRule.mode !== 'playing') {
  throw new Error(`Glasshouse pad landings no longer match the written goal: ${JSON.stringify(fragileRule)}`)
}

await startRoute(6)
await page.evaluate(() => window.__cg.triggerWindFlip())
await page.waitForTimeout(240)
const windFrame = await page.evaluate(() => {
  const snapshot = window.__cg.snapshot()
  const transform = document.querySelector('#windArrow').style.transform
  return { ...snapshot, arrowDirection: transform.includes('-1') ? -1 : 1 }
})
if (windFrame.windFlipPending !== null) throw new Error('wind screenshot was captured before the new wind committed')
if (Math.sign(windFrame.wind) !== windFrame.windPropDirection || Math.sign(windFrame.wind) !== windFrame.arrowDirection) {
  throw new Error(`wind screenshot directions disagree: ${JSON.stringify(windFrame)}`)
}
await assertFrame('wind-flip')
await page.screenshot({ path: path.join(finalDir, '800x450-wind-flip.png') })

await startRoute(5)
await page.keyboard.down('Space')
await page.waitForTimeout(360)
await assertFrame('garden')
await page.screenshot({ path: path.join(finalDir, '800x450-garden.png') })
await page.keyboard.up('Space')

const routeForScene = { depot: 1, laundry: 2, garden: 5, neon: 6, glasshouse: 7, beacon: 8 }
const scenes = []
const streetOnlyStyle = await page.addStyleTag({ content: '#hud,#powerDock,#hintCard{display:none!important}' })
for (const [scene, route] of Object.entries(routeForScene)) {
  await startRoute(route)
  await page.waitForTimeout(120)
  const snapshot = await page.evaluate(() => window.__cg.snapshot())
  if (snapshot.scene !== scene) throw new Error(`route ${route} expected ${scene}, got ${snapshot.scene}`)
  await page.screenshot({ path: path.join(sceneDir, `800x450-${scene}.png`) })
  scenes.push({ scene, route, target: snapshot.target, district: snapshot.district })
}
await streetOnlyStyle.evaluate((node) => node.remove())
if (new Set(scenes.map(({ district }) => district.palette)).size !== 6) throw new Error('district palettes are not unique')
if (new Set(scenes.map(({ district }) => district.architecture)).size !== 6) throw new Error('district architecture families are not unique')
for (const { scene, district } of scenes) {
  if (district.gap !== 4 || district.streetWidth !== 8 || district.skylineCount !== 22) {
    throw new Error(`${scene}: fa376ab street skeleton changed: ${JSON.stringify(district)}`)
  }
}

await startRoute(6)
const beforeFlip = await page.evaluate(() => window.__cg.snapshot().wind)
await page.evaluate(() => window.__cg.triggerWindFlip())
const duringFlip = await page.evaluate(() => window.__cg.snapshot())
if (duringFlip.windFlipPending === null) throw new Error('wind visual did not lead the physics reversal')
await page.waitForTimeout(240)
const afterFlip = await page.evaluate(() => window.__cg.snapshot())
if (Math.sign(afterFlip.wind) === Math.sign(beforeFlip) && Math.abs(beforeFlip) > 0.05) throw new Error('wind did not reverse')
await page.evaluate(() => window.__cg.triggerWindFlip())
await page.waitForTimeout(220)
const afterSecondAttempt = await page.evaluate(() => window.__cg.snapshot())
if (afterSecondAttempt.wind !== afterFlip.wind) throw new Error('wind reversed more than once in one parcel')

const windDirectionChecks = [{
  route: 6,
  wind: windFrame.wind,
  hud: windFrame.arrowDirection,
  flag: windFrame.windPropDirection,
}]
for (const route of [9, 10]) {
  await startRoute(route)
  await page.evaluate(() => window.__cg.triggerWindFlip())
  await page.waitForTimeout(240)
  const check = await page.evaluate(() => {
    const snapshot = window.__cg.snapshot()
    const transform = document.querySelector('#windArrow').style.transform
    return {
      route: snapshot.routeId,
      wind: snapshot.wind,
      pending: snapshot.windFlipPending,
      hud: transform.includes('-1') ? -1 : 1,
      flag: snapshot.windPropDirection,
    }
  })
  if (check.pending !== null || Math.sign(check.wind) !== check.hud || Math.sign(check.wind) !== check.flag) {
    throw new Error(`route ${route} wind directions disagree: ${JSON.stringify(check)}`)
  }
  windDirectionChecks.push(check)
}

await startRoute(8)
const route8 = await page.evaluate(() => window.__cg.snapshot())
if (!route8.target.secondary) throw new Error('route 8 secondary pad missing')
await startRoute(10)
const route10 = await page.evaluate(() => window.__cg.snapshot())
if (!route10.target.secondary) throw new Error('route 10 secondary pad missing')

const report = { viewport: '800x450', errors, scenes, fragileRule: { misses: fragileRule.misses, delivered: fragileRule.delivered }, windFlip: { beforeFlip, duringFlip: duringFlip.windFlipPending, afterFlip: afterFlip.wind, directionChecks: windDirectionChecks }, dualTargets: { route8: route8.target, route10: route10.target } }
await fs.writeFile(path.join(root, '_qa', 'crazygames-review.json'), `${JSON.stringify(report, null, 2)}\n`)
await browser.close()
if (errors.length) throw new Error(errors.join('\n'))
console.log(JSON.stringify(report, null, 2))
