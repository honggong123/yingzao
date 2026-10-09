// 木声合成器 + 环境音氛围 —— 全部由 Web Audio 程序化合成，零音频素材。
// 拼装"咔哒"、错序闷响、完成拨弦（五声音阶）、环境古琴泛音（Karplus-Strong）。
import { ref } from 'vue'

let ctx: AudioContext | null = null
let master: GainNode | null = null

/** 音效开关（响应式，头部按钮绑定；偏好持久化） */
const stored = (() => {
  try {
    return localStorage.getItem('yingzao-sound') !== 'off'
  } catch {
    return true
  }
})()
export const soundEnabled = ref(stored)

function applyGain() {
  if (master) master.gain.value = soundEnabled.value ? 0.8 : 0
}

export function setSoundEnabled(v: boolean) {
  soundEnabled.value = v
  try {
    localStorage.setItem('yingzao-sound', v ? 'on' : 'off')
  } catch {
    /* 无痕模式忽略 */
  }
  applyGain()
}

// ── 环境音氛围：Karplus-Strong 古琴泛音，五声音阶随机漫步 ──
let ambientTimer: ReturnType<typeof setTimeout> | null = null
let ambientBus: GainNode | null = null
export const ambientOn = ref(false)

/** 生成一根弦的 KS 采样（-frequency f, 3 秒衰减） */
function ksBuffer(f: number): AudioBuffer {
  const sr = ctx!.sampleRate
  const len = Math.floor(sr * 3.5)
  const buf = ctx!.createBuffer(1, len, sr)
  const d = buf.getChannelData(0)
  const N = Math.max(2, Math.round(sr / f))
  const delay = new Float32Array(N)
  for (let i = 0; i < N; i++) delay[i] = Math.random() * 2 - 1
  let idx = 0
  for (let i = 0; i < len; i++) {
    const out = delay[idx]
    d[i] = out
    const next = (idx + 1) % N
    delay[idx] = 0.998 * 0.5 * (delay[idx] + delay[next])
    idx = next
  }
  return buf
}

const ksCache = new Map<number, AudioBuffer>()
function getKs(f: number): AudioBuffer {
  if (!ksCache.has(f)) ksCache.set(f, ksBuffer(f))
  return ksCache.get(f)!
}

/** 单音拨弦（带声像） */
function ksPluck(freq: number, when: number, vol: number, pan = 0) {
  const c = ensure()
  const src = c.createBufferSource()
  src.buffer = getKs(freq)
  const p = c.createStereoPanner()
  p.pan.value = pan
  const g = c.createGain()
  g.gain.value = vol
  src.connect(p).connect(g).connect(ambientBus ?? master!)
  src.start(when)
}

const GUQIN_PENT = [65.41, 73.42, 82.41, 98.0, 110.0, 130.81, 146.83, 164.81, 196.0, 220.0]

function ambientPhrase() {
  const c = ensure()
  const t = c.currentTime + 0.1
  const count = Math.random() > 0.6 ? 2 : 1
  for (let i = 0; i < count; i++) {
    const f = GUQIN_PENT[Math.floor(Math.random() * GUQIN_PENT.length)]
    ksPluck(f, t + i * (0.8 + Math.random() * 1.2), 0.06 + Math.random() * 0.06, (Math.random() - 0.5) * 1.2)
  }
}

function scheduleAmbient() {
  if (!ambientOn.value) return
  ambientPhrase()
  ambientTimer = setTimeout(scheduleAmbient, 4500 + Math.random() * 5500)
}

export function startAmbient() {
  if (ambientOn.value) return
  ensure()
  if (!ambientBus) {
    ambientBus = ctx!.createGain()
    ambientBus.gain.value = 0.6
    ambientBus.connect(master!)
  }
  ambientOn.value = true
  scheduleAmbient()
}

export function stopAmbient() {
  ambientOn.value = false
  if (ambientTimer) { clearTimeout(ambientTimer); ambientTimer = null }
}

function ensure(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    master = ctx.createGain()
    master.gain.value = soundEnabled.value ? 0.8 : 0
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function noiseBuffer(c: AudioContext, seconds = 0.3): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  return buf
}

/** 短噪声爆点 + 带通，模拟木质撞击 */
function knock(freq: number, vol: number, decay: number) {
  const c = ensure()
  const t = c.currentTime
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, decay + 0.05)
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = freq
  bp.Q.value = 2.2
  const g = c.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
  src.connect(bp).connect(g).connect(master!)
  src.start(t)
  src.stop(t + decay + 0.05)
}

/** 低频闷响（错序） */
function thud() {
  const c = ensure()
  const t = c.currentTime
  const o = c.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(130, t)
  o.frequency.exponentialRampToValueAtTime(70, t + 0.18)
  const g = c.createGain()
  g.gain.setValueAtTime(0.5, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
  o.connect(g).connect(master!)
  o.start(t)
  o.stop(t + 0.25)
  knock(320, 0.25, 0.1)
}

/** 拨弦音色（五声音阶，用于完成音） */
function pluck(freq: number, when: number, vol = 0.3) {
  const c = ensure()
  const t = c.currentTime + when
  const o = c.createOscillator()
  o.type = 'triangle'
  o.frequency.value = freq
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1)
  const o2 = c.createOscillator()
  o2.type = 'sine'
  o2.frequency.value = freq * 2.01 // 泛音
  const g2 = c.createGain()
  g2.gain.setValueAtTime(0.0001, t)
  g2.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.01)
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
  o.connect(g).connect(master!)
  o2.connect(g2).connect(master!)
  o.start(t); o.stop(t + 1.2)
  o2.start(t); o2.stop(t + 0.6)
}

export const woodSound = {
  /** 构件落位"咔哒" */
  click() {
    knock(1900, 0.5, 0.06)
    knock(700, 0.35, 0.09)
  },
  /** 错序闷响 */
  wrong() {
    thud()
  },
  /** 整朵完成：宫三连 + 上扬五声 */
  complete() {
    const pent = [523.25, 587.33, 659.25, 783.99, 880]
    pluck(pent[0], 0, 0.3)
    pluck(pent[2], 0.12, 0.28)
    pluck(pent[4], 0.24, 0.26)
    pluck(pent[3] * 2, 0.42, 0.2)
  },
  /** 轻点 UI */
  tick() {
    knock(2400, 0.2, 0.04)
  }
}
