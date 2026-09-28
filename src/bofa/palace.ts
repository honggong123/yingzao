// 营造之旅 —— 程序化庑殿大殿
// 自下而上：台基 → 柱网（柱+柱础）→ 阑额 + 普拍枋 → 柱头/补间铺作阵 → 举折屋顶 → 正脊鸱吻。
// 全部尺寸以"分"计，与铺作生成器同坐标系；举折曲线按"举高=跨三分之一、自上而下渐缓"的法则。
import * as THREE from 'three'
import { buildPuzuo, type PuzuoParams } from './puzuo'
import { makeWoodMaterial } from '../core/wood'

export interface PalaceCaptions {
  steps: { at: number; text: string }[]
  duration: number
}

export interface PalaceModel {
  group: THREE.Group
  captions: PalaceCaptions
  dispose: () => void
}

const FEN = 1

/** 瓦垄纹理（程序化） */
function makeTileMaterial(): THREE.MeshStandardMaterial {
  const S = 256
  const cv = document.createElement('canvas')
  cv.width = S
  cv.height = S
  const g = cv.getContext('2d')!
  g.fillStyle = '#33383f'
  g.fillRect(0, 0, S, S)
  // 筒瓦垄
  for (let x = 0; x < S; x += 22) {
    g.fillStyle = 'rgba(255,255,255,0.07)'
    g.fillRect(x + 2, 0, 7, S)
    g.fillStyle = 'rgba(0,0,0,0.4)'
    g.fillRect(x + 16, 0, 4, S)
  }
  // 层间横缝
  for (let y = 0; y < S; y += 42) {
    g.fillStyle = 'rgba(0,0,0,0.28)'
    g.fillRect(0, y, S, 3)
  }
  const tex = new THREE.CanvasTexture(cv)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshStandardMaterial({
    map: tex,
    bumpMap: tex,
    bumpScale: 1.6,
    roughness: 0.92,
    metalness: 0.02,
    side: THREE.DoubleSide
  })
}

export function buildPalace(params: PuzuoParams): PalaceModel {
  const group = new THREE.Group()
  const disposables: (THREE.Material | THREE.BufferGeometry)[] = []
  const wood = makeWoodMaterial({ tone: 0.02 })
  const woodDark = makeWoodMaterial({ tone: -0.08 })
  const stone = new THREE.MeshStandardMaterial({ color: '#4e4a45', roughness: 0.95 })
  const tile = makeTileMaterial()
  disposables.push(wood, woodDark, stone, tile)

  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z)
    m.castShadow = m.receiveShadow = true
    group.add(m)
    return m
  }

  // ── 台基（两层）──
  box(680, 26, 380, 0, -21, 0, stone)
  box(600, 8, 320, 0, -4, 0, stone)

  // ── 柱网：面阔四间（5 柱），进深两排 ──
  const colXs = [-220, -110, 0, 110, 220]
  const rowZs = [-80, 80]
  for (const x of colXs) {
    for (const z of rowZs) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(11, 13, 210, 24), wood)
      col.position.set(x, 105, z)
      col.castShadow = col.receiveShadow = true
      group.add(col)
      const base = new THREE.Mesh(new THREE.CylinderGeometry(15, 16, 6, 24), stone)
      base.position.set(x, 3, z)
      base.castShadow = base.receiveShadow = true
      group.add(base)
    }
  }

  // ── 阑额 + 普拍枋（每排连续）──
  for (const z of rowZs) {
    box(470, 18, 12, 0, 201, z, woodDark)
    box(470, 12, 18, 0, 216, z, wood)
  }

  // ── 铺作阵：柱头铺作 ×10 + 补间铺作 ×8（明间四缝补间）──
  const withBaseFalse = { withBase: false }
  const addPuzuo = (x: number, z: number, rotate: boolean) => {
    const m = buildPuzuo(params, withBaseFalse)
    if (rotate) m.group.rotation.y = Math.PI
    m.group.position.set(x, 222, z)
    group.add(m.group)
    return m
  }
  const subModels: { dispose: () => void }[] = []
  for (const x of colXs) {
    for (const z of rowZs) {
      subModels.push(addPuzuo(x, z, z < 0))
    }
  }
  const centers = [-165, -55, 55, 165]
  for (const x of centers) {
    for (const z of rowZs) {
      subModels.push(addPuzuo(x, z, z < 0))
    }
  }

  // ── 举折屋顶（庑殿：前后坡 + 两山）──
  const eaveZ = 118
  const ridgeY = 372
  const eaveY = 299
  const rise = 73
  const K = 6
  const prof: { z: number; y: number; w: number }[] = []
  for (let k = 0; k <= K; k++) {
    const f = k / K
    prof.push({ z: eaveZ * f, y: ridgeY - rise * Math.pow(f, 1.6), w: 150 + 105 * f })
  }
  const verts: number[] = []
  const uvs: number[] = []
  const push = (x: number, y: number, z: number, u: number, v: number) => {
    verts.push(x * FEN, y * FEN, z * FEN)
    uvs.push(u, v)
  }
  // 前坡（z+）
  for (let k = 0; k < K; k++) {
    const a = prof[k], b = prof[k + 1]
    push(-a.w, a.y, a.z, 0, k / K); push(a.w, a.y, a.z, 1, k / K); push(-b.w, b.y, b.z, 0, (k + 1) / K)
    push(a.w, a.y, a.z, 1, k / K); push(b.w, b.y, b.z, 1, (k + 1) / K); push(-b.w, b.y, b.z, 0, (k + 1) / K)
  }
  // 后坡（z-）
  for (let k = 0; k < K; k++) {
    const a = prof[k], b = prof[k + 1]
    push(a.w, a.y, -a.z, 0, k / K); push(-a.w, a.y, -a.z, 1, k / K); push(a.w, b.y, -b.z, 0, (k + 1) / K)
    push(-a.w, a.y, -a.z, 1, k / K); push(-b.w, b.y, -b.z, 1, (k + 1) / K); push(b.w, b.y, -b.z, 0, (k + 1) / K)
  }
  // 两山（庑殿翼面）：脊端 → 坡缘折线 → 檐角
  for (const sx of [1, -1]) {
    for (let k = 0; k < K; k++) {
      const a = prof[k], b = prof[k + 1]
      push(sx * 150, ridgeY, 0, 0.5, 0)
      push(sx * a.w, a.y, a.z, 0, a.z === 0 ? 0 : a.z / eaveZ)
      push(sx * b.w, b.y, b.z, 1, b.z / eaveZ)
    }
  }
  const roofGeo = new THREE.BufferGeometry()
  roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  roofGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  roofGeo.computeVertexNormals()
  const roof = new THREE.Mesh(roofGeo, tile)
  roof.castShadow = roof.receiveShadow = true
  group.add(roof)

  // ── 正脊 + 鸱吻 ──
  box(300, 14, 16, 0, 376, 0, tile)
  box(16, 44, 16, -150, 396, 0, tile)
  box(16, 44, 16, 150, 396, 0, tile)

  // ── 连续檐槫（沟通各朵铺作的橑檐槫）──
  for (const z of [110, -110]) {
    const tuan = new THREE.Mesh(new THREE.CylinderGeometry(10.5, 10.5, 560, 24), wood)
    tuan.rotation.z = Math.PI / 2
    tuan.position.set(0, 291, z)
    tuan.castShadow = tuan.receiveShadow = true
    group.add(tuan)
  }

  return {
    group,
    captions: {
      duration: 17,
      steps: [
        { at: 0, text: '第一步 · 筑台基 —— 高台之上' },
        { at: 3.2, text: '第二步 · 立柱架阑额 —— 骨架立起' },
        { at: 6.4, text: '第三步 · 施铺作 —— 层层出跳，承檐而来' },
        { at: 9.8, text: '第四步 · 举折成顶 —— 如翼轻展' },
        { at: 13, text: '日暮 · 殿成 —— 不用一钉一铆' }
      ]
    },
    dispose() {
      group.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
      })
      disposables.forEach((d) => d.dispose())
      subModels.forEach((s) => s.dispose())
    }
  }
}
