// 程序化木纹材质 —— 不依赖任何外部贴图素材。
// 思路：Canvas 上先铺基色，再沿纹理方向绘制随机游走的深浅纤维线，
// 叠加少量宽色带（早材/晚材），同一张图兼作 bumpMap 提供细部起伏。
import * as THREE from 'three'

export interface WoodOptions {
  /** 基色调，默认山木暖褐 */
  base?: string
  /** 纤维方向（'y' 竖纹 | 'x' 横纹），构件生成后按长轴设置 repeat */
  grain?: 'x' | 'y'
  /** 明度扰动 -1..1，同场景构件间做微妙差异 */
  tone?: number
  /** 纹理重复次数 */
  repeat?: [number, number]
}

function shiftTone(hex: string, t: number): string {
  const c = new THREE.Color(hex)
  if (t > 0) c.lerp(new THREE.Color('#caa06a'), t)
  else c.lerp(new THREE.Color('#6d4c33'), -t)
  return `#${c.getHexString()}`
}

let cached: HTMLCanvasElement | null = null

function paintWood(base: string): HTMLCanvasElement {
  if (cached) return cached
  const S = 512
  const cv = document.createElement('canvas')
  cv.width = S
  cv.height = S
  const g = cv.getContext('2d')!

  g.fillStyle = base
  g.fillRect(0, 0, S, S)

  // 宽色带：早材/晚材生长轮
  let x = 0
  while (x < S) {
    const w = 18 + Math.random() * 46
    const a = 0.05 + Math.random() * 0.07
    g.fillStyle = Math.random() > 0.5 ? `rgba(84,56,34,${a})` : `rgba(226,190,140,${a * 0.8})`
    g.fillRect(x, 0, w, S)
    x += w
  }

  // 纤维线：随机游走竖线
  for (let i = 0; i < 240; i++) {
    const sx = Math.random() * S
    const dark = Math.random() > 0.4
    g.strokeStyle = dark
      ? `rgba(70,46,26,${0.05 + Math.random() * 0.09})`
      : `rgba(233,200,152,${0.05 + Math.random() * 0.07})`
    g.lineWidth = 0.6 + Math.random() * 1.6
    g.beginPath()
    let px = sx
    g.moveTo(px, -10)
    for (let py = 0; py <= S; py += 16) {
      px += (Math.random() - 0.5) * 3.2
      g.lineTo(px, py)
    }
    g.stroke()
  }

  // 细密噪点
  const img = g.getImageData(0, 0, S, S)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 14
    d[i] += n
    d[i + 1] += n
    d[i + 2] += n * 0.8
  }
  g.putImageData(img, 0, 0)
  cached = cv
  return cv
}

export function makeWoodMaterial(opts: WoodOptions = {}): THREE.MeshStandardMaterial {
  const base = shiftTone(opts.base ?? '#a97e52', opts.tone ?? 0)
  const tex = new THREE.CanvasTexture(paintWood(base))
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  const [rx, ry] = opts.repeat ?? [1, 1]
  tex.repeat.set(rx, ry)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4

  const bump = tex.clone()
  bump.needsUpdate = true

  return new THREE.MeshStandardMaterial({
    map: tex,
    bumpMap: bump,
    bumpScale: 0.6,
    roughness: 0.78,
    metalness: 0.02,
    color: '#ffffff'
  })
}
