// 斗栱抗震演示 —— 振动台 + 单自由度结构响应模型（教学示意）
// 物理模型：把铺作层简化为一个水平剪切层，屋面为单自由度质量块：
//   m·x'' = k·(xg - x) + c·(xg' - x')
//   → x'' = ωn²(xg - x) + 2ζωn(xg' - x')
// 刚性连接：高自振频率、低阻尼 → 屋面跟随甚至放大地面运动；
// 斗栱连接：低自振频率、高阻尼（榫卯摩擦滑移耗能）→ 屋面响应大幅衰减。
// 数值：逐帧半隐式欧拉积分。参数为教学示意，非真实工程数据。
import * as THREE from 'three'
import { buildPuzuo, type PuzuoParams } from './puzuo'
import { makeWoodMaterial } from '../core/wood'

export type QuakeMode = 'dougong' | 'rigid'

export interface QuakeOptions {
  /** 地面振幅（分） */
  A: number
  /** 频率（Hz） */
  freqHz: number
  mode: QuakeMode
  running: boolean
}

export interface QuakeRig {
  group: THREE.Group
  tick: (dt: number) => void
  apply: () => void
  setOptions: (o: Partial<QuakeOptions>) => void
  getOptions: () => QuakeOptions
  readonly stats: { ratio: number; peakG: number; peakR: number }
  history: { t: number; g: number; r: number }[]
  dispose: () => void
}

/** 各连接模式的结构参数（教学示意） */
const MODE_CFG: Record<QuakeMode, { wn: number; zeta: number }> = {
  rigid: { wn: 2 * Math.PI * 4.0, zeta: 0.05 },
  dougong: { wn: 2 * Math.PI * 0.7, zeta: 0.35 }
}

export function createQuakeRig(params: PuzuoParams, opts: QuakeOptions): QuakeRig {
  const group = new THREE.Group()
  const wood = makeWoodMaterial({ tone: 0.02 })
  const woodDark = makeWoodMaterial({ tone: -0.08 })
  const stone = new THREE.MeshStandardMaterial({ color: '#4e4a45', roughness: 0.95 })
  const iron = new THREE.MeshStandardMaterial({ color: '#2f3136', roughness: 0.6, metalness: 0.4 })

  const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = m.receiveShadow = true
    return m
  }

  // ── 随地面一起运动的部分：振动台 + 柱 + 阑额 + 普拍枋 ──
  const baseGroup = new THREE.Group()
  baseGroup.add(
    mk(new THREE.BoxGeometry(340, 14, 170), stone, 0, 7, 0), // 振动台
    mk(new THREE.BoxGeometry(320, 6, 150), iron, 0, 17, 0), // 导轨滑板
    mk(new THREE.CylinderGeometry(10, 12, 120, 20), wood, -70, 77, 0), // 柱
    mk(new THREE.CylinderGeometry(10, 12, 120, 20), wood, 70, 77, 0), // 柱
    mk(new THREE.BoxGeometry(176, 14, 12), woodDark, 0, 127, 0), // 阑额
    mk(new THREE.BoxGeometry(180, 10, 18), wood, 0, 139, 0) // 普拍枋
  )
  group.add(baseGroup)

  // ── 铺作（栌斗底 y=144；各层随层间剪力错动）──
  const puzuo = buildPuzuo(params, { withBase: false })
  puzuo.group.position.y = 144
  group.add(puzuo.group)
  const topLayer = params.tiao + 1
  const deform = puzuo.parts.map((p) => ({
    mesh: p.mesh,
    baseX: p.base.x,
    f: Math.min(1, p.layer / topLayer)
  }))

  // ── 屋面配重板（质量块，随结构响应运动）──
  const roofTopY = 144 + 69 + 10.5 // 槫顶
  const roof = mk(new THREE.BoxGeometry(280, 14, 150), woodDark, 0, roofTopY + 7, 0)
  group.add(roof)

  // ── 状态与选项 ──
  const cfg = MODE_CFG[opts.mode]
  let wn = cfg.wn
  let zeta = cfg.zeta
  let A = opts.A
  let freqHz = opts.freqHz
  let running = opts.running
  let t = 0
  let xg = 0, vg = 0, xr = 0, vr = 0
  let peakG = 0
  let peakR = 0
  const history: { t: number; g: number; r: number }[] = []

  function tick(dtRaw: number) {
    const dt = Math.min(dtRaw, 0.033)
    if (running) {
      t += dt
      const w = freqHz * Math.PI * 2
      xg = A * Math.sin(w * t)
      vg = A * w * Math.cos(w * t)
      const acc = wn * wn * (xg - xr) + 2 * zeta * wn * (vg - vr)
      vr += acc * dt
      xr += vr * dt
      peakG = Math.max(peakG * Math.pow(0.5, dt / 1.5), Math.abs(xg))
      peakR = Math.max(peakR * Math.pow(0.5, dt / 1.5), Math.abs(xr))
      history.push({ t, g: xg, r: xr })
      while (history.length && history[0].t < t - 6) history.shift()
    } else {
      // 停止：地面位移指数衰减，结构自然回位
      const decay = Math.pow(0.001, dt)
      xg *= decay
      vg = 0
      const acc = wn * wn * (xg - xr) + 2 * zeta * wn * (0 - vr)
      vr += acc * dt
      xr += vr * dt
      if (history.length) history.shift()
    }
  }

  function apply() {
    baseGroup.position.x = xg
    roof.position.x = xr
    for (const d of deform) {
      d.mesh.position.x = d.baseX + xg + (xr - xg) * d.f
    }
  }

  return {
    group,
    tick,
    apply,
    setOptions(o: Partial<QuakeOptions>) {
      if (o.A !== undefined) A = o.A
      if (o.freqHz !== undefined) freqHz = o.freqHz
      if (o.running !== undefined) {
        if (o.running && !running) {
          t = 0
          history.length = 0
          peakG = 0
          peakR = 0
        }
        running = o.running
      }
      if (o.mode !== undefined && o.mode !== undefined) {
        const c = MODE_CFG[o.mode]
        wn = c.wn
        zeta = c.zeta
        peakG = 0
        peakR = 0
      }
    },
    getOptions: () => ({ A, freqHz, mode: Object.keys(MODE_CFG).find((k) => MODE_CFG[k as QuakeMode].wn === wn) as QuakeMode, running }),
    stats: {
      get ratio() {
        return peakG > 0.001 ? Math.min(2, peakR / peakG) : 1
      },
      get peakG() {
        return peakG
      },
      get peakR() {
        return peakR
      }
    },
    history,
    dispose() {
      group.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
      })
      wood.dispose()
      woodDark.dispose()
      stone.dispose()
      iron.dispose()
    }
  }
}
