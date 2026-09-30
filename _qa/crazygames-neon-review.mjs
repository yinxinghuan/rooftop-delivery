import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const base = process.env.ROOFTOP_CG_URL || 'http://127.0.0.1:4180/?playtest=1'
const output = path.join(process.cwd(), '_qa', 'ui', 'crazygames-scenes', '800x450-neon.png')
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
    selected: 6,
    audio: { muted: true, volume: 0.75 },
  }))
})
await page.goto(base, { waitUntil: 'networkidle' })
await page.waitForFunction(() => Boolean(window.__cg))
await page.evaluate(() => window.__cg.startRoute(6))
await page.waitForFunction(() => window.__cg.snapshot().ready)
await page.addStyleTag({ content: '#hud,#powerDock,#hintCard{display:none!important}' })
await page.waitForTimeout(180)
const result = await page.evaluate(() => {
  const snapshot = window.__cg.snapshot()
  const app = document.querySelector('#app').getBoundingClientRect()
  return {
    scene: snapshot.scene,
    district: snapshot.district,
    viewport: { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight },
    app: { left: app.left, top: app.top, right: app.right, bottom: app.bottom },
  }
})
if (result.scene !== 'neon') throw new Error(`expected neon, got ${result.scene}`)
if (result.district.gap !== 4 || result.district.streetWidth !== 8 || result.district.skylineCount !== 22) throw new Error(`street skeleton changed: ${JSON.stringify(result.district)}`)
if (result.viewport.scrollWidth !== 800 || result.viewport.scrollHeight !== 450) throw new Error(`viewport overflow: ${JSON.stringify(result.viewport)}`)
if (result.app.left < -0.5 || result.app.top < -0.5 || result.app.right > 800.5 || result.app.bottom > 450.5) throw new Error(`app clipped: ${JSON.stringify(result.app)}`)
await page.screenshot({ path: output })
await browser.close()
if (errors.length) throw new Error(errors.join('\n'))
console.log(JSON.stringify({ output, ...result, errors }, null, 2))
