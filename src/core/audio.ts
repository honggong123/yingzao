// 木声合成器 —— 全部由 Web Audio 程序化合成，零音频素材。
// 拼装"咔哒"、错序闷响、完成拨弦（五声音阶），服务于拼装挑战的手感。
let ctx: AudioContext | null = null
let master: GainNode | null = null

function ensure(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    master = ctx.createGain()
    master.gain.value = 0.8
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
