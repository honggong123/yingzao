// 榫卯谱 —— 六种经典榫卯的参数化模型与开合动画
// 统一模型：分件 { geometry 烘焙在"合体位"，sep 拆解位移向量, phase 相位区间 }，
// 全局 t∈[0,1]（0=拆解, 1=合体），分件位置 = 合体位 + sep×(1-局部t)。
// 几何全部由截面轮廓沿轴拉伸（无 CSG）；尺寸为教学示意比例，界面已如实标注出处。
import * as THREE from 'three'
import { makeWoodMaterial } from '../core/wood'

export interface JointPiece {
  mesh: THREE.Mesh
  /** 拆解位移向量（合体位为几何烘焙位） */
  sep: THREE.Vector3
  /** 动画相位区间 [t0, t1] */
  phase: [number, number]
}

type Builder = (mat: THREE.Material) => Omit<JointModel, 'dispose'>

function meshFrom(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat)
  m.castShadow = m.receiveShadow = true
  return m
}

/** 截面轮廓 (z,y) 沿 x 拉伸 [x0,x1]（燕尾/走马/楔钉等沿 x 的分件） */
function prismX(pts: [number, number][], x0: number, x1: number, mat: THREE.Material): THREE.Mesh {
  const sh = new THREE.Shape()
  pts.forEach(([z, y], i) => (i === 0 ? sh.moveTo(z, y) : sh.lineTo(z, y)))
  sh.closePath()
  const geo = new THREE.ExtrudeGeometry(sh, { depth: x1 - x0, bevelEnabled: false, curveSegments: 3 })
  geo.rotateY(Math.PI / 2) // shape-z → world-x
  geo.translate(x0, 0, 0)
  return meshFrom(geo, mat)
}

/** 截面轮廓 (x,y) 沿 z 拉伸 [z0,z1]（格肩榫横枋等） */
function prismZ(pts: [number, number][], z0: number, z1: number, mat: THREE.Material): THREE.Mesh {
  const sh = new THREE.Shape()
  pts.forEach(([x, y], i) => (i === 0 ? sh.moveTo(x, y) : sh.lineTo(x, y)))
  sh.closePath()
  const geo = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0, bevelEnabled: false, curveSegments: 3 })
  geo.translate(0, 0, z0)
  return meshFrom(geo, mat)
}

/** 截面轮廓 (x,z) 沿 y 拉伸 [y0,y1]（竖材/俯视带槽分件） */
function prismY(pts: [number, number][], y0: number, y1: number, mat: THREE.Material): THREE.Mesh {
  const sh = new THREE.Shape()
  pts.forEach(([x, z], i) => (i === 0 ? sh.moveTo(x, z) : sh.lineTo(x, z)))
  sh.closePath()
  const geo = new THREE.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: false, curveSegments: 3 })
  geo.rotateX(-Math.PI / 2) // shape-y → world -z；shape-z(深度) → world y
  geo.translate(0, y0, 0)
  return meshFrom(geo, mat)
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  m.position.set(x, y, z)
  m.castShadow = m.receiveShadow = true
  return m
}

// ── 1. 燕尾榫（银锭榫）：雄头端宽根窄，越拉越紧 ──
const yanWei: Builder = (mat) => {
  const pieces: JointPiece[] = []
  // A 材（x<0）：体 + 燕尾雄头（0..14，z 根 ±6.5 → 口 ±9）
  pieces.push({
    mesh: box(46, 26, 26, -37, 0, 0, mat),
    sep: new THREE.Vector3(-58, 0, 0), phase: [0, 0.7]
  })
  pieces.push({
    mesh: prismX([[-6.5, -13], [6.5, -13], [6.5, 13], [9, 13], [-9, 13]], 0, 14, mat),
    sep: new THREE.Vector3(-58, 0, 0), phase: [0, 0.7]
  })
  // B 材（x>0）：上下板 + 两侧壁围出雌口（z ±9，y ±13，x 0..14）
  pieces.push({ mesh: box(46, 13, 26, 37, 19.5, 0, mat), sep: new THREE.Vector3(58, 0, 0), phase: [0, 0.7] })
  pieces.push({ mesh: box(46, 13, 26, 37, -19.5, 0, mat), sep: new THREE.Vector3(58, 0, 0), phase: [0, 0.7] })
  pieces.push({
    mesh: prismX([[9, -13], [13, -13], [13, 13], [9, 13]], 14, 60, mat),
    sep: new THREE.Vector3(58, 0, 0), phase: [0, 0.7]
  })
  pieces.push({
    mesh: prismX([[-13, -13], [-9, -13], [-9, 13], [-13, 13]], 14, 60, mat),
    sep: new THREE.Vector3(58, 0, 0), phase: [0, 0.7]
  })
  return {
    name: '燕尾榫',
    desc: '头大颈小、形如银锭：合体后越拉越咬得紧，专抗拉力。两材平接的经典答案。',
    source: '明清家具通行做法（教学示意比例）',
    group: new THREE.Group(),
    pieces
  }
}

// ── 2. 格肩榫：横竖材 45° 斜肩直角相交 ──
const geJian: Builder = (mat) => {
  const pieces: JointPiece[] = []
  // 左右两段横枋（沿 z 向厚度 16），端头 45° 斜肩让出中口
  const halfPts = (sx: 1 | -1): [number, number][] =>
    sx === 1
      ? [[14, 0], [64, 0], [64, 28], [14, 28], [14, 20], [26, 8], [26, 0]]
      : [[-14, 0], [-64, 0], [-64, 28], [-14, 28], [-14, 20], [-26, 8], [-26, 0]]
  pieces.push({ mesh: prismY(halfPts(1), 0, 16, mat), sep: new THREE.Vector3(64, 0, 0), phase: [0, 0.7] })
  pieces.push({ mesh: prismY(halfPts(-1), 0, 16, mat), sep: new THREE.Vector3(-64, 0, 0), phase: [0, 0.7] })
  // 竖柱：下端榫头（x ±5，y -8..0）+ 45° 抱肩，沿 y 落下
  pieces.push({
    mesh: prismZ([[-11, -30], [11, -30], [11, -8], [5, -8], [5, 0], [-5, 0], [-5, -8], [-11, -8]], -8, 8, mat),
    sep: new THREE.Vector3(0, 78, 0), phase: [0.3, 1]
  })
  return {
    name: '格肩榫',
    desc: '横竖材直角相交，四十五度斜肩把交口断面藏起来——桌椅框架的骨架全靠它。',
    source: '明清家具通行做法（教学示意比例）',
    group: new THREE.Group(),
    pieces
  }
}

// ── 3. 抱肩榫：两枋弧口相抱，圆材落下 ──
const baoJian: Builder = (mat) => {
  const pieces: JointPiece[] = []
  // 俯视轮廓：内端带 r13 半圆凹口，两段合拢成圆孔
  const halfPts = (sx: 1 | -1): [number, number][] => {
    const pts: [number, number][] = []
    pts.push([sx * 70, -8])
    pts.push([sx * 13, -8])
    for (let a = -Math.PI / 2; a <= Math.PI / 2 + 0.001; a += Math.PI / 10) {
      pts.push([sx * 13 * Math.cos(a), 13 * Math.sin(a)])
    }
    pts.push([sx * 70, 8])
    return pts
  }
  pieces.push({ mesh: prismY(halfPts(1), 0, 15, mat), sep: new THREE.Vector3(72, 0, 0), phase: [0, 0.7] })
  pieces.push({ mesh: prismY(halfPts(-1), 0, 15, mat), sep: new THREE.Vector3(-72, 0, 0), phase: [0, 0.7] })
  const post = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 76, 28), mat)
  post.castShadow = post.receiveShadow = true
  pieces.push({ mesh: post, sep: new THREE.Vector3(0, 80, 0), phase: [0.3, 1] })
  return {
    name: '抱肩榫',
    desc: '两枋端头做出弧形凹口，把圆柱"抱"在怀中——柱与梁枋的相会，不用一枚钉子。',
    source: '明清家具通行做法（教学示意比例）',
    group: new THREE.Group(),
    pieces
  }
}

// ── 4. 粽角榫：三材各让一半，竖材补上最后一角 ──
const zongJiao: Builder = (mat) => {
  const pieces: JointPiece[] = []
  // 角部立方体 (18³) 的空间分配：X 件占 z 9..18，Z 件占 x -9..0，竖材占 x 9..18 · z 0..9
  // X 向材：主体 + 半厚舌（z 9..18）
  pieces.push({ mesh: box(54, 18, 18, -27, 0, 0, mat), sep: new THREE.Vector3(78, 0, 0), phase: [0, 0.8] })
  pieces.push({ mesh: box(18, 18, 9, 9, 0, 13.5, mat), sep: new THREE.Vector3(78, 0, 0), phase: [0, 0.8] })
  // Z 向材：主体 + 半厚舌（x -9..0）
  pieces.push({ mesh: box(18, 18, 54, 0, 0, -27, mat), sep: new THREE.Vector3(0, 0, 78), phase: [0, 0.8] })
  pieces.push({ mesh: box(9, 18, 18, -4.5, 0, 9, mat), sep: new THREE.Vector3(0, 0, 78), phase: [0, 0.8] })
  // 竖材：主体 + 四分之一舌（x 9..18, z 0..9），自上落下
  pieces.push({ mesh: box(18, 54, 18, 13.5, 45, 4.5, mat), sep: new THREE.Vector3(0, 98, 0), phase: [0.25, 1] })
  pieces.push({ mesh: box(9, 18, 9, 13.5, 9, 4.5, mat), sep: new THREE.Vector3(0, 98, 0), phase: [0.25, 1] })
  return {
    name: '粽角榫',
    desc: '三根材在角上各让一半，竖材补上最后一角——互让之间，三向归于一处，如粽角。',
    source: '明清家具通行做法（教学示意比例）',
    group: new THREE.Group(),
    pieces
  }
}

// ── 5. 走马销：口窄底宽的滑槽活榫，一推即锁 ──
const zouMa: Builder = (mat) => {
  const pieces: JointPiece[] = []
  // 基座：两侧壁（内壁外斜：底 ±7.5 → 口 ±4）+ 底板，槽沿 x 贯通、x+ 端开放
  pieces.push({
    mesh: prismX([[7.5, -8], [13, -8], [13, 4], [4, 4], [7.5, -8]], -50, 50, mat).clone(),
    sep: new THREE.Vector3(0, 0, 0), phase: [0, 1]
  })
  pieces.push({
    mesh: prismX([[-13, -8], [-7.5, -8], [-4, 4], [-13, 4]], -50, 50, mat),
    sep: new THREE.Vector3(0, 0, 0), phase: [0, 1]
  })
  pieces.push({ mesh: box(100, 8, 26, 0, -12, 0, mat), sep: new THREE.Vector3(0, 0, 0), phase: [0, 1] })
  // 上板（动画件）：底面带倒燕尾销头（与槽同一斜度），沿 x 滑入后无法上提
  pieces.push({
    mesh: prismX([[-7.5, -8], [7.5, -8], [4, 4], [-4, 4]], -26, 26, mat),
    sep: new THREE.Vector3(72, 0, 0), phase: [0, 1]
  })
  pieces.push({ mesh: box(52, 9, 26, 0, 8.5, 0, mat), sep: new THREE.Vector3(72, 0, 0), phase: [0, 1] })
  return {
    name: '走马销',
    desc: '可拆装的活榫：销头口窄底宽，推到底便自动锁死，抬起却纹丝不动——大构件"运输-安装"两相宜。',
    source: '明清家具通行做法（教学示意比例）',
    group: new THREE.Group(),
    pieces
  }
}

// ── 6. 楔钉榫：弧材互搭 + 楔销锁定 ──
const xieDing: Builder = (mat) => {
  const pieces: JointPiece[] = []
  // 八棱圆材，端头半搭：A 保留下半舌（x -14..0），B 保留上半舌
  const oct = (r: number): [number, number][] => {
    const pts: [number, number][] = []
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8
      pts.push([Math.cos(a) * r, Math.sin(a) * r])
    }
    return pts
  }
  // A：主体（x -52..-14 全截面）+ 半舌（x -14..0，y<0）
  pieces.push({ mesh: prismX(oct(9), -52, -14, mat), sep: new THREE.Vector3(-40, 0, 0), phase: [0, 0.6] })
  pieces.push({
    mesh: prismX([[-9, -9], [9, -9], [9, 0], [-9, 0]], -14, 0, mat),
    sep: new THREE.Vector3(-40, 0, 0), phase: [0, 0.6]
  })
  // B：主体（x 14..52）+ 半舌（x 0..14，y>0）
  pieces.push({ mesh: prismX(oct(9), 14, 52, mat), sep: new THREE.Vector3(40, 0, 0), phase: [0, 0.6] })
  pieces.push({
    mesh: prismX([[-9, 0], [9, 0], [9, 9], [-9, 9]], 0, 14, mat),
    sep: new THREE.Vector3(40, 0, 0), phase: [0, 0.6]
  })
  // 楔销：合体后从上下落，穿过咬合口
  pieces.push({ mesh: box(9, 16, 9, 0, 13, 0, mat), sep: new THREE.Vector3(0, 34, 0), phase: [0.55, 1] })
  return {
    name: '楔钉榫',
    desc: '两段弧材端头互搭成钩，再加一枚楔销锁死——圈椅弯材的对接之道。',
    source: '明清家具通行做法（教学示意比例）',
    group: new THREE.Group(),
    pieces
  }
}

const BUILDERS: Record<string, Builder> = {
  yanwei: yanWei,
  gejian: geJian,
  baojian: baoJian,
  zongjiao: zongJiao,
  zouma: zouMa,
  xieding: xieDing
}

export const JOINT_IDS = Object.keys(BUILDERS)

/** 榫卯清单（界面选择用） */
export const JOINT_LIST = [
  { id: 'yanwei', name: '燕尾榫' },
  { id: 'gejian', name: '格肩榫' },
  { id: 'baojian', name: '抱肩榫' },
  { id: 'zongjiao', name: '粽角榫' },
  { id: 'zouma', name: '走马销' },
  { id: 'xieding', name: '楔钉榫' }
]

export interface JointModel {
  name: string
  desc: string
  source: string
  group: THREE.Group
  pieces: JointPiece[]
  dispose: () => void
  setT: (t: number) => void
}

function applyT(model: JointModel, t: number) {
  for (const p of model.pieces) {
    const local = Math.min(1, Math.max(0, (t - p.phase[0]) / (p.phase[1] - p.phase[0])))
    p.mesh.position.copy(p.sep).multiplyScalar(1 - local)
  }
}

export function buildJoint(id: string, t: number): JointModel {
  const mat = makeWoodMaterial({ tone: 0.04 })
  const raw = BUILDERS[id](mat)
  const group = new THREE.Group()
  for (const p of raw.pieces) group.add(p.mesh)
  const model: JointModel = {
    name: raw.name,
    desc: raw.desc,
    source: raw.source,
    group,
    pieces: raw.pieces,
    dispose() {
      group.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
      })
      mat.dispose()
    },
    setT(nt: number) {
      applyT(model, nt)
    }
  }
  applyT(model, t)
  return model
}
