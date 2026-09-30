import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const base = process.env.ROOFTOP_CG_BEFORE_URL || 'http://127.0.0.1:4181/'
const out = path.join(process.cwd(), '_qa', 'ui', 'crazygames-before')
await fs.mkdir(out, { recursive: true })

const browser = await chromium.launch({ headless: true })

async function capture(route, name, charge = false) {
  const page = await browser.newPage({ viewport: { width: 800, height: 450 }, deviceScaleFactor: 1 })
  await page.addInitScript(({ selected }) => {
    localStorage.setItem('rooftop_cg_profile_v1', JSON.stringify({
      v: 1,
      unlocked: 10,
      cleared: [1,2,3,4,5,6,7,8,9,10],
      best: 640,
      routeBest: {},
      tips: 420,
      upgrades: { gloves: 1, vane: 1, jar: 1, zone: 0, spare: 0, cushion: 0, steady: 0, calm: 0 },
      tutorialSeen: true,
      hintsSeen: [],
      selected,
      audio: { muted: true, volume: 0.75 },
    }))
  }, { selected: route })
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.click('#btnStart')
  await page.waitForTimeout(1000)
  if (charge) {
    await page.keyboard.down('Space')
    await page.waitForTimeout(520)
  }
  await page.screenshot({ path: path.join(out, `800x450-${name}.png`) })
  if (charge) await page.keyboard.up('Space')
  await page.close()
}

await capture(2, 'mid', true)
await capture(6, 'neon', false)
await capture(5, 'garden', true)
await browser.close()
