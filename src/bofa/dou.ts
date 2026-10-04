// 斗的生成器 —— 《营造法式》"造斗之制"
// 斗者，铺作传递之枢：下承栱枋，上开口（槽）以纳构件。
// 造型路线：以侧向 U 形轮廓（斗耳-平-欹）沿槽向拉伸，
// 欹部微外斜（收分），青段倒角受光——不使用 CSG。
import * as THREE from 'three'
import { makeWoodMaterial } from '../core/wood'

export type DouType = 'ludou' | 'jiaohudou' | 'sandou' | 'qixindou'

export interface DouSpec {
  /** 斗广（沿横栱方向） */
  w: number
  /** 斗深（沿出跳方向） */
  d: number
  /** 总高 */
  h: number
  /** 耳高（槽深） */
  ear: number
  /** 开槽宽（所承构件厚） */
  slot: number
}

// 尺寸以"分"计（构建期按《营造法式》原文再核验，暂用通行引值）
const DOU_SPECS: Record<DouType, DouSpec> = {
  ludou: { w: 32, d: 32, h: 20, ear: 8, slot: 10 },
  jiaohudou: { w: 18, d: 16, h: 10, ear: 4, slot: 10 },
  sandou: { w: 16, d: 14, h: 10, ear: 4, slot: 10 },
  qixindou: { w: 16, d: 16, h: 10, ear: 4, slot: 10 }
}

/**
 * 生成一只斗。
 * @param slotAxis 槽的走向：'z' 承顺墙栱（华栱从槽中穿过），'x' 承横栱/枋
 */
export function createDou(
  type: DouType,
  material: THREE.Material,
  slotAxis: 'x' | 'z' = 'z'
): THREE.Mesh {
  const s = DOU_SPECS[type]
  const hw = s.w / 2
  const hd = s.d / 2
  const hs = s.slot / 2
  const ear = s.ear
  const qiTop = s.h - ear // 欹顶 = 平底

  // 侧向轮廓（x=斗广向, y=高向），槽沿拉伸方向贯通
  const sh = new THREE.Shape()
  sh.moveTo(-hw, 0)
  sh.lineTo(-hw + 1.4, qiTop) // 欹部外斜（收分）
  sh.lineTo(-hw, qiTop)
  sh.lineTo(-hw, s.h - 1.2) // 斗耳
  sh.lineTo(-hs, s.h)
  sh.lineTo(-hs, qiTop)
  sh.lineTo(hs, qiTop)
  sh.lineTo(hs, s.h)
  sh.lineTo(hw, s.h - 1.2)
  sh.lineTo(hw, qiTop)
  sh.lineTo(hw - 1.4, qiTop)
  sh.lineTo(hw, 0)
  sh.closePath()

  const geo = new THREE.ExtrudeGeometry(sh, {
    depth: s.d,
    bevelEnabled: true,
    bevelThickness: 0.5,
    bevelSize: 0.5,
    bevelSegments: 2,
    curveSegments: 2
  })
  geo.translate(0, 0, -s.d / 2)
  geo.computeVertexNormals()

  const mesh = new THREE.Mesh(geo, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  if (slotAxis === 'x') mesh.rotation.y = Math.PI / 2 // 槽沿 x 走
  return mesh
}

/** 共享材质（同类构件统一材质减少纹理显存） */
export function makeDouMaterials(): Record<'a' | 'b' | 'c', THREE.Material> {
  return {
    a: makeWoodMaterial({ tone: 0.05 }),
    b: makeWoodMaterial({ tone: -0.04 }),
    c: makeWoodMaterial({ tone: 0.12 })
  }
}
