// 几何审计：输出每个构件的精确包围盒，检查层间是否悬空
import * as THREE from 'three'
import { buildPuzuo, type PuzuoParams } from '../src/bofa/puzuo'

function audit(name: string, params: PuzuoParams) {
  const m = buildPuzuo(params)
  m.group.updateMatrixWorld(true)
  const rows: { key: string; yMin: number; yMax: number; zMin: number; zMax: number }[] = []
  for (const p of m.parts) {
    const box = new THREE.Box3().setFromObject(p.mesh)
    rows.push({ key: p.key, yMin: box.min.y, yMax: box.max.y, zMin: box.min.z, zMax: box.max.z })
  }
  rows.sort((a, b) => a.yMin - b.yMin)
  console.log(`\n===== ${name} (height=${m.height.toFixed(1)}) =====`)
  for (const r of rows) {
    console.log(
      r.key.padEnd(18),
      `y[${r.yMin.toFixed(1).padStart(6)}, ${r.yMax.toFixed(1).padStart(6)}]`,
      `z[${r.zMin.toFixed(1).padStart(6)}, ${r.zMax.toFixed(1).padStart(6)}]`
    )
  }
  // 悬空检测：每个构件的底面，是否与某个更低的构件顶面接触（容差 2.5 分）
  console.log('--- 悬空检测（底面与所有更低构件顶面的最小间距 > 2.5 分）---')
  for (const r of rows) {
    let best = Infinity
    let bestKey = ''
    for (const q of rows) {
      if (q === r) continue
      if (q.yMax > r.yMin + 0.5) continue // 不在其下方
      // z / x 向需有重叠才可能支撑
      const zOverlap = Math.min(r.zMax, q.zMax) - Math.max(r.zMin, q.zMin)
      if (zOverlap <= 1) continue
      const gap = r.yMin - q.yMax
      if (gap < best) { best = gap; bestKey = q.key }
    }
    if (best > 2.5) {
      console.log(`悬空: ${r.key.padEnd(18)} 底 y=${r.yMin.toFixed(1)} 下方最近 ${bestKey} 顶=${(r.yMin - best).toFixed(1)} 间隙=${best.toFixed(1)}`)
    }
  }
  m.dispose()
}

audit('六铺作单栱计心（游戏默认六）', { tiao: 3, zhongGong: false, jiXin: true, shuaTou: true, ang: false })
audit('六铺作单栱昂制', { tiao: 3, zhongGong: false, jiXin: true, shuaTou: true, ang: true })
audit('七铺作重栱计心', { tiao: 4, zhongGong: true, jiXin: true, shuaTou: true, ang: false })
