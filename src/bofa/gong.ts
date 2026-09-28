// 栱的生成器 —— 《营造法式》"造栱之制"
// 造型路线：栱为侧向轮廓（含端部卷杀阶梯）沿材厚方向拉伸。
// 卷杀瓣数与每瓣长度取自原文（卷四·造栱之制）：
//   华栱两卷头者每头四瓣每瓣长四分；泥道栱/瓜子栱四瓣四分；
//   令栱五瓣四分；慢栱四瓣三分。瓣的收深原文未定量，取瓣长×0.28（重构近似，见 aigc-log）。
import * as THREE from 'three'
import { FEN_CAI_G, FEN_ZUCAI, GONG_LEN, JUANSHA } from '../core/units'
import { makeWoodMaterial } from '../core/wood'

export type GongType = 'huagong' | 'nidao' | 'guazi' | 'ling' | 'man' | 'shuatou'

export interface GongSpec {
  /** 栱长（分） */
  len: number
  /** 断面高（分）：华栱/耍头足材 21，横栱单材 15 */
  h: number
  /** 厚（分）恒为 10 */
  thick: number
  /** 端部卷杀：'both' 两头 | 'head' 仅头端（尾入柱枋） | 'none' */
  juansha: 'both' | 'head' | 'none'
  /** 卷杀瓣数 */
  banes: number
  /** 每瓣长（分） */
  banLen: number
  /** 卷杀总收深（重构近似） */
  tipDrop: number
  /** 蚂蚱头头部造型（耍头专用） */
  headStyle?: 'juansha' | 'mazha'
}

const zoneOf = (b: number, l: number) => b * l

export const GONG_SPECS: Record<GongType, GongSpec> = {
  huagong: {
    len: 72, h: FEN_ZUCAI, thick: 10, juansha: 'both',
    banes: JUANSHA.hua.banes, banLen: JUANSHA.hua.banLen,
    tipDrop: zoneOf(JUANSHA.hua.banes, JUANSHA.hua.banLen) * 0.28
  },
  nidao: {
    len: GONG_LEN.nidao, h: FEN_CAI_G, thick: 10, juansha: 'both',
    banes: JUANSHA.heng.banes, banLen: JUANSHA.heng.banLen,
    tipDrop: zoneOf(JUANSHA.heng.banes, JUANSHA.heng.banLen) * 0.28
  },
  guazi: {
    len: GONG_LEN.guazi, h: FEN_CAI_G, thick: 10, juansha: 'both',
    banes: JUANSHA.heng.banes, banLen: JUANSHA.heng.banLen,
    tipDrop: zoneOf(JUANSHA.heng.banes, JUANSHA.heng.banLen) * 0.28
  },
  ling: {
    len: GONG_LEN.ling, h: FEN_CAI_G, thick: 10, juansha: 'both',
    banes: JUANSHA.ling.banes, banLen: JUANSHA.ling.banLen,
    tipDrop: zoneOf(JUANSHA.ling.banes, JUANSHA.ling.banLen) * 0.28
  },
  man: {
    len: GONG_LEN.man, h: FEN_CAI_G, thick: 10, juansha: 'both',
    banes: JUANSHA.man.banes, banLen: JUANSHA.man.banLen,
    tipDrop: zoneOf(JUANSHA.man.banes, JUANSHA.man.banLen) * 0.28
  },
  shuatou: {
    len: 56, h: FEN_ZUCAI, thick: 10, juansha: 'none',
    banes: 0, banLen: 0, tipDrop: 0, headStyle: 'mazha'
  }
}

/** 端部卷杀的顶部阶梯点：从端面起向 dir 方向逐瓣升高至满高 */
function juanshaPoints(
  from: number, dir: 1 | -1, zone: number, banes: number, tipDrop: number, h: number
): [number, number][] {
  const pts: [number, number][] = []
  const stepW = zone / banes
  pts.push([from, h - tipDrop])
  for (let i = 1; i <= banes; i++) {
    pts.push([from + dir * stepW * i, h - tipDrop + (tipDrop * i) / banes])
  }
  return pts
}

export function createGong(
  type: GongType,
  material: THREE.Material,
  opts: { len?: number; juansha?: 'both' | 'head' | 'none' } = {}
): THREE.Mesh {
  const s = { ...GONG_SPECS[type] }
  if (opts.len) s.len = opts.len
  if (opts.juansha) s.juansha = opts.juansha
  const L = s.len
  const hl = L / 2
  const zone = zoneOf(s.banes, s.banLen)

  const sh = new THREE.Shape()
  if (s.headStyle === 'mazha') {
    // 蚂蚱头：头部斜面下折两次，收为平头
    sh.moveTo(-hl, 0)
    sh.lineTo(-hl, s.h)
    sh.lineTo(hl - 16, s.h)
    sh.lineTo(hl - 7, s.h - 7)
    sh.lineTo(hl, s.h - 9)
    sh.lineTo(hl, 0)
    sh.closePath()
  } else {
    sh.moveTo(-hl, 0)
    if (s.juansha === 'both') {
      for (const [x, y] of juanshaPoints(-hl, 1, zone, s.banes, s.tipDrop, s.h)) sh.lineTo(x, y)
    } else {
      sh.lineTo(-hl, s.h) // 尾端平直（入柱/枋）
    }
    if (s.juansha === 'head' || s.juansha === 'both') {
      const from = hl
      const pts = juanshaPoints(from, -1, zone, s.banes, s.tipDrop, s.h)
      for (let i = pts.length - 1; i >= 0; i--) sh.lineTo(pts[i][0], pts[i][1])
    } else {
      sh.lineTo(hl, s.h)
    }
    sh.lineTo(hl, 0)
    sh.closePath()
  }

  const geo = new THREE.ExtrudeGeometry(sh, {
    depth: s.thick,
    bevelEnabled: true,
    bevelThickness: 0.35,
    bevelSize: 0.35,
    bevelSegments: 2,
    curveSegments: 2
  })
  // x=长向居中, y=高向居中, z=厚向居中
  geo.translate(0, -s.h / 2, -s.thick / 2)
  geo.computeVertexNormals()

  const mesh = new THREE.Mesh(geo, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  // 轮廓在 XY 平面（x=长向, y=高向），拉伸沿 z=厚向 —— 横栱默认沿墙向
  return mesh
}

/** 把沿 x 的栱转为沿 z（华栱/耍头垂直于墙面出跳），卷杀/蚂蚱头朝 +z（室外） */
export function toZAxis(mesh: THREE.Mesh): THREE.Mesh {
  mesh.rotation.y = -Math.PI / 2
  return mesh
}

export function makeGongMaterials(): Record<string, THREE.Material> {
  return {
    hua: makeWoodMaterial({ tone: 0.06 }),
    heng: makeWoodMaterial({ tone: -0.02 })
  }
}
