let audioCtx = null

const getCtx = () => {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  return audioCtx
}

export const resumeAudio = () => {
  try {
    const ctx = getCtx()
    if (ctx.state === 'suspended') ctx.resume()
  } catch { /* audio is optional */ }
}

function tone(freq, duration, options = {}) {
  try {
    const ctx = getCtx()
    const now = ctx.currentTime + (options.delay || 0)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = options.type || 'sine'
    osc.frequency.setValueAtTime(freq, now)
    if (options.freqEnd) osc.frequency.exponentialRampToValueAtTime(options.freqEnd, now + duration)
    gain.gain.setValueAtTime(options.gain ?? 0.06, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + duration)
  } catch { /* audio must never stop gameplay */ }
}

export const playStart = () => {
  tone(392, 0.09, { gain: 0.08 })
  tone(523, 0.09, { delay: 0.16, gain: 0.08 })
}
export const playAim = () => tone(240, 0.07, { type: 'triangle', freqEnd: 320, gain: 0.035 })
export const playThrow = () => {
  tone(180, 0.18, { type: 'sawtooth', freqEnd: 92, gain: 0.055 })
  tone(520, 0.06, { gain: 0.025 })
}
export const playBounce = (index = 0) => tone(190 - index * 28, 0.065, { type: 'triangle', gain: 0.045 * Math.pow(0.55, index) })
export const playDelivered = () => [440, 554, 659].forEach((f, i) => tone(f, 0.08, { delay: i * 0.075, gain: 0.055 }))
export const playBullseye = () => {
  ;[523, 659, 784, 1047].forEach((f, i) => tone(f, 0.09, { delay: i * 0.075, gain: 0.075 }))
  tone(132, 0.12, { type: 'triangle', freqEnd: 88, gain: 0.05 })
}
export const playMiss = () => tone(170, 0.3, { type: 'square', freqEnd: 72, gain: 0.045 })
export const playCombo = (combo) => tone(Math.min(940, 660 + combo * 70), 0.07, { gain: 0.045, delay: 0.2 })
export const playComplete = () => [392, 523, 659, 784].forEach((f, i) => tone(f, 0.18, { delay: i * 0.09, gain: 0.065 }))
export const playUnlock = () => [659, 784, 988].forEach((f, i) => tone(f, 0.14, { delay: i * 0.11, gain: 0.055 }))
export const playAnimalHit = (type) => {
  const sounds = {
    cat: [720, 980, 0.11, 'triangle'],
    dog: [210, 150, 0.14, 'square'],
    chicken: [880, 1240, 0.09, 'square'],
  }
  const [start, end, duration, wave] = sounds[type] || sounds.cat
  tone(start, duration, { type: wave, freqEnd: end, gain: 0.045 })
  tone(95, 0.08, { type: 'triangle', freqEnd: 72, gain: 0.035 })
}
export const playFail = () => tone(220, 0.48, { type: 'triangle', freqEnd: 110, gain: 0.065 })
export const playClick = () => tone(600, 0.04, { freqEnd: 400, gain: 0.035 })
