// 铺作生成器 —— 《营造法式》铺作次序的程序化实现（M2 全参数化版）
//
// 支撑参数：跳数 1–5、单栱/重栱造、计心/偷心、耍头。
// 层高模型（杪栱体系，单位=分）：
//   华栱足材 21；构件入斗口坐于欹顶（栌斗 20-8=12，小斗 10-4=6）；
//   斗坐于构件顶面。由此逐层推出：
//     单栱计心层距 48 = 21(华栱) + 6 + 15(瓜子栱) + 6
//     重栱计心层距 69 = 48 + 6 + 15(慢栱) + 6
//     偷心层距   27 = 21 + 6
//   最上跳头：交互斗 → 令栱 → 齐心/散斗 → 橑檐槫；耍头与令栱同层十字相交。
import * as THREE from 'three'
import { createDou, makeDouMaterials } from './dou'
import { createGong, makeGongMaterials, toZAxis } from './gong'

export interface PuzuoParams {
  /** 跳数 1–5（四铺作–八铺作） */
  tiao: number
  /** 重栱造（false 为单栱造） */
  zhongGong: boolean
  /** 计心造（false 为偷心造） */
  jiXin: boolean
  /** 耍头 */
  shuaTou: boolean
  /** 昂制（下昂替代最上层杪栱） */
  ang: boolean
}

export const DEFAULT_PARAMS: PuzuoParams = {
  tiao: 1,
  zhongGong: false,
  jiXin: true,
  shuaTou: true,
  ang: false
}

/** 铺作通高（分，栌斗底至橑檐槫顶）——与 buildPuzuo 的层高模型一致 */
export function puzuoHeight(p: PuzuoParams): number {
  const stride = p.jiXin ? (p.zhongGong ? 69 : 48) : 27
  return 12 + (p.tiao - 1) * stride + 21 + 6 + 15 + 6 + 10.5 + 10.5
}

/** 总出跳深（分） */
export function puzuoDepth(p: PuzuoParams): number {
  return p.tiao * 30 + 24
}

export interface PartInstance {
  key: string
  mesh: THREE.Mesh
  /** 铺作层次（0=栌斗层，向上递增）——爆炸图与层次高亮用 */
  layer: number
  /** 装配次序（铺作次序的排序键） */
  order: number
  /** 未爆炸时的基准位 */
  base: THREE.Vector3
  /** 爆炸时沿 z 的附加位移系数（出跳构件向外） */
  explodeZ: number
  /** 标注文案（null 不挂标） */
  label: string | null
}

export interface PuzuoModel {
  group: THREE.Group
  parts: PartInstance[]
  /** 装配次序：按铺作次序排好的构件序列（拼装挑战用） */
  sequence: PartInstance[]
  /** 总高（分，含橑檐槫） */
  height: number
  dispose: () => void
}

/** 构件类型的装配优先级（同层内先大构件后小斗） */
const TYPE_RANK: Record<string, number> = {
  puaipai: 0, ludou: 1, huagong: 2, jiaohudou: 3,
  nidao: 4, guazi: 4, man: 5, sandou: 6, qixindou: 6,
  zhutoufang: 7, linggong: 8, shuatou: 9, liaoyan: 10
}

const TIAO = 30 // 每跳 30 分

export function buildPuzuo(
  params: PuzuoParams,
  opts: { withBase?: boolean } = {}
): PuzuoModel {
  const withBase = opts.withBase ?? true
  const { tiao, zhongGong, jiXin, shuaTou } = params
  const group = new THREE.Group()
  const parts: PartInstance[] = []
  const disposables: (THREE.Material | THREE.BufferGeometry)[] = []

  const douMats = makeDouMaterials()
  const gongMats = makeGongMaterials()
  disposables.push(douMats.a, douMats.b, douMats.c, gongMats.hua, gongMats.heng)
  const fangMat = gongMats.heng
  const gongMatOf = (k: number) => (k % 2 ? gongMats.hua : gongMats.heng)
  const douMatOf = (k: number) => (k % 2 ? douMats.a : douMats.b)

  /** 每层 advance（本层华栱底 → 下层华栱底） */
  const stride = jiXin ? (zhongGong ? 69 : 48) : 27
  const zoneHua = 4 * 4 // 华栱卷杀区 4瓣×4分

  function add(
    key: string, mesh: THREE.Mesh, pos: [number, number, number],
    layer: number, explodeZ = 0, label: string | null = null
  ) {
    mesh.position.set(...pos)
    mesh.userData.partKey = key
    group.add(mesh)
    parts.push({ key, mesh, layer, base: new THREE.Vector3(...pos), explodeZ, label })
  }

  const dou = (
    key: string, type: Parameters<typeof createDou>[0], slotAxis: 'x' | 'z',
    mat: THREE.Material, pos: [number, number, number], layer: number, label: string | null = null
  ) => add(key, createDou(type, mat, slotAxis), pos, layer, 0, label)

  // ---- 组装 ----

  // 底层：普拍枋（withBase=false 供大殿场景使用其连续普拍枋）+ 栌斗
  if (withBase) {
    const paipaiGeo = new THREE.BoxGeometry(132, 12, 26)
    const paipai = new THREE.Mesh(paipaiGeo, fangMat)
    paipai.castShadow = paipai.receiveShadow = true
    add('puaipai', paipai, [0, -6, 0], 0, 0, '普拍枋')
  }
  dou('ludou', 'ludou', 'z', douMats.a, [0, 0, 0], 0, '栌斗')

  // 逐跳
  const angMode = params.ang
  for (let k = 1; k <= tiao; k++) {
    const y = 12 + (k - 1) * stride // 本跳华栱底
    const zk = TIAO * k // 本跳跳心
    const tail = Math.max(TIAO * (k - 1) - 14, -8)
    const tip = zk + 8 + zoneHua
    const huaLen = tip - tail
    const isTop = k === tiao
    // 昂制且非最上层：本层仍用华栱；最上层替换为下昂
    const useAng = angMode && isTop

    if (useAng) {
      // ── 下昂：从内上向外下倾斜的长杆，昂尖伸出檐口 ──
      const angYTop = y + 21 + 6 // 坐于最上交互斗欹顶
      const angTipZ = zk + 38 // 昂尖超出檐口
      const angTailZ = Math.max(zk - 60, -8)
      const angDrop = (zk - angTailZ) * 0.35 // 斜率约 1:2.86
      const angYTail = angYTop + angDrop
      const angLen = Math.hypot(angTipZ - angTailZ, angDrop)
      const angAngle = Math.atan2(angDrop, angTipZ - angTailZ)

      // 昂身：旋转的扁盒
      const angGeo = new THREE.BoxGeometry(angLen, 14, 10)
      const angMesh = new THREE.Mesh(angGeo, gongMatOf(k))
      angMesh.castShadow = angMesh.receiveShadow = true
      // 昂尖：楔形收分（用小旋转盒模拟琴面斜面）
      const tipGeo = new THREE.BoxGeometry(12, 8, 10)
      const angTip = new THREE.Mesh(tipGeo, gongMatOf(k))
      angTip.castShadow = angTip.receiveShadow = true
      // 组合昂身 + 昂尖
      const angGroup = new THREE.Group()
      angGroup.add(angMesh, angTip)
      const angCX = (angTailZ + angTipZ) / 2
      const angCY = angYTail - (angTipZ - angTailZ) * 0.35 / 2
      angGroup.position.set(0, angCY, angCX)
      angGroup.rotation.x = -angAngle // 绕 x 轴倾斜（z 向外倾下）
      // 局部修正：昂身中心 y 取两端中点
      const angMidY = (angYTail + (angYTail - angDrop)) / 2
      angGroup.position.y = angMidY
      angGroup.userData.partKey = 'xia-ang'
      group.add(angGroup)
      parts.push({ key: 'xia-ang', mesh: angGroup as unknown as THREE.Mesh, layer: k + 0.5, base: new THREE.Vector3(0, angMidY, angCX), explodeZ: 30, label: '下昂' })
      // 调试访问（安全起见补齐 mesh 属性访问路径）
      // ↑ angGroup 含昂身 + 昂尖两个子 mesh

      // 令栱坐在昂背近头端（跳心处昂背上表面）
      const angBackYAtLing = angYTail - angDrop // 昂背在跳心处的高程
      const ling = createGong('ling', gongMatOf(k))
      const lingY = angBackYAtLing + 5 // 斗高 10 的一半
      add('linggong', ling, [0, lingY + 7.5, zk], k + 0.5, 0, '令栱')
      addDouOn('ling', k, lingY + 15, zk, 72, k + 0.55)

      if (shuaTou) {
        const stTail = zk - 14
        const stTip = zk + 22
        const st = createGong('shuatou', gongMatOf(k + 1), { len: stTip - stTail })
        toZAxis(st)
        add('shuatou', st, [0, lingY + 7.5 + 10.5, (stTail + stTip) / 2], k + 0.5, 22, '耍头')
      }

      // 橑檐槫：坐在昂背令栱上方
      const tuanGeo = new THREE.CylinderGeometry(10.5, 10.5, 130, 28)
      const tuanMat = gongMats.hua
      const tuan = new THREE.Mesh(tuanGeo, tuanMat)
      tuan.rotation.z = Math.PI / 2
      tuan.castShadow = tuan.receiveShadow = true
      add('liaoyan', tuan, [0, lingY + 15 + 6 + 10.5, zk], k + 1, 30, '橑檐槫')
    } else {
      // ── 杪栱体系（原逻辑不变）──
      const hua = createGong('huagong', gongMatOf(k), { len: huaLen, juansha: 'head' })
      toZAxis(hua)
      add(`huagong-${k}`, hua, [0, y + 10.5, (tail + tip) / 2], k, 22, k === 1 ? '华栱' : `华栱${k === 2 ? '二' : k === 3 ? '三' : k === 4 ? '四' : '五'}`)

      dou(`jiaohudou-${k}`, 'jiaohudou', 'x', douMatOf(k), [0, y + 21, zk], k, null)

      if (!isTop) {
        if (jiXin) {
          const gz = createGong('guazi', gongMatOf(k))
          add(`guazi-${k}`, gz, [0, y + 27 + 7.5, zk], k + 0.5, 0, k === 1 ? '瓜子栱' : null)
          addDouOn('guazi', k, y + 42, zk, 62)
          if (zhongGong) {
            const mn = createGong('man', gongMatOf(k))
            add(`man-tiao-${k}`, mn, [0, y + 48 + 7.5, zk], k + 0.5, 0, k === 1 ? '慢栱' : null)
            addDouOn('man-tiao', k, y + 63, zk, 92)
          }
        }
      } else {
        const ling = createGong('ling', gongMatOf(k))
        add('linggong', ling, [0, y + 27 + 7.5, zk], k + 0.5, 0, '令栱')
        addDouOn('ling', k, y + 42, zk, 72)

        if (shuaTou) {
          const stTail = zk - 14
          const stTip = zk + 22
          const st = createGong('shuatou', gongMatOf(k + 1), { len: stTip - stTail })
          toZAxis(st)
          add('shuatou', st, [0, y + 27 + 10.5, (stTail + stTip) / 2], k + 0.5, 22, '耍头')
        }

        const tuanGeo = new THREE.CylinderGeometry(10.5, 10.5, 130, 28)
        const tuanMat = gongMats.hua
        const tuan = new THREE.Mesh(tuanGeo, tuanMat)
        tuan.rotation.z = Math.PI / 2
        tuan.castShadow = tuan.receiveShadow = true
        add('liaoyan', tuan, [0, y + 48 + 10.5, zk], k + 1, 30, '橑檐槫')
      }
    }
  }

  /** 在横栱顶面加两端散斗 + 栱心齐心斗（斗底 = 栱顶 - 1.5，咬住卷杀端） */
  function addDouOn(prefix: string, k: number, gongTop: number, z: number, gongLen: number, layer = k + 0.5) {
    const half = gongLen / 2 - 8
    dou(`${prefix}-dou-n`, 'sandou', 'x', douMatOf(k), [-half, gongTop - 1.5, z], layer)
    dou(`${prefix}-dou-s`, 'sandou', 'x', douMatOf(k), [half, gongTop - 1.5, z], layer)
    dou(`${prefix}-dou-c`, 'qixindou', 'x', douMatOf(k), [0, gongTop, z], layer)
  }

  // 泥道栱（首层横栱，z=0，计心/偷心皆有）+ 重拱时其上慢栱 + 柱头枋
  const nidao = createGong('nidao', gongMats.heng)
  add('nidao', nidao, [0, 33 + 7.5, 0], 1, 0, '泥道栱')
  addDouOn('nidao', 1, 48, 0, 63)
  let fangBottom = 58
  if (zhongGong) {
    const mn = createGong('man', gongMats.hua)
    add('man-wall', mn, [0, 54 + 7.5, 0], 1.5, 0, null)
    addDouOn('man-wall', 1, 69, 0, 92)
    fangBottom = 75
  }
  const fangGeo = new THREE.BoxGeometry(140, 15, 10)
  const fang = new THREE.Mesh(fangGeo, fangMat)
  fang.castShadow = fang.receiveShadow = true
  add('zhutoufang', fang, [0, fangBottom + 7.5, 0], 1.5, 0, '柱头枋')

  const height = 12 + (tiao - 1) * stride + 21 + 6 + 15 + 6 + 10.5 + 10.5

  // 装配次序：层 × 类型优先级
  for (const p of parts) {
    const rank = TYPE_RANK[p.key.split('-')[0]] ?? 5
    p.order = p.layer * 100 + rank
  }
  const sequence = [...parts].sort((a, b) => a.order - b.order)

  return {
    group,
    parts,
    sequence,
    height,
    dispose() {
      group.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
      })
      disposables.forEach((d) => d.dispose())
    }
  }
}
