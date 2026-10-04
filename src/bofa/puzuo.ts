// 铺作生成器 —— 《营造法式》铺作次序的程序化实现
// 支撑参数：跳数 1–5、单栱/重栱造、计心/偷心、下昂/耍头。
// 层高模型（杪栱体系）：
//   华栱足材 21；构件入斗口坐于欹顶（栌斗 20-8=12，小斗 10-4=6）；
//   斗坐于构件顶面。由此逐层推出：
//     单栱计心层距 48 = 21(华栱) + 6 + 15(瓜子栱) + 6
//     重栱计心层距 69 = 48 + 6 + 15(慢栱) + 6
//     偷心层距   27 = 21 + 6
import * as THREE from 'three'
import { createDou, makeDouMaterials } from './dou'
import { createGong, makeGongMaterials, toZAxis } from './gong'

export interface PuzuoParams {
  tiao: number
  zhongGong: boolean
  jiXin: boolean
  shuaTou: boolean
  ang: boolean
}

export const DEFAULT_PARAMS: PuzuoParams = {
  tiao: 1, zhongGong: false, jiXin: true, shuaTou: true, ang: false
}

export function puzuoHeight(p: PuzuoParams): number {
  const stride = p.jiXin ? (p.zhongGong ? 69 : 48) : 27
  return 12 + (p.tiao - 1) * stride + (p.ang ? 83 : 69)
}

export function puzuoDepth(p: PuzuoParams): number {
  return p.tiao * 30 + 24
}

export interface PartInstance {
  key: string
  mesh: THREE.Mesh
  layer: number
  order: number
  base: THREE.Vector3
  explodeZ: number
  label: string | null
}

export interface PuzuoModel {
  group: THREE.Group
  parts: PartInstance[]
  sequence: PartInstance[]
  height: number
  dispose: () => void
}

const TYPE_RANK: Record<string, number> = {
  puaipai: 0, ludou: 1, huagong: 2, xia: 2, jiaohudou: 3,
  nidao: 4, guazi: 4, man: 5, sandou: 6, qixindou: 6,
  zhutoufang: 7, linggong: 8, shuatou: 9, liaoyan: 10, ang: 6
}

const TIAO = 30

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

  const stride = jiXin ? (zhongGong ? 69 : 48) : 27
  const zoneHua = 4 * 4

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

  function addDouOn(prefix: string, k: number, gongTop: number, z: number, gongLen: number, layer = k + 0.5) {
    const half = gongLen / 2 - 8
    dou(`${prefix}-dou-n`, 'sandou', 'x', douMatOf(k), [-half, gongTop - 1.5, z], layer)
    dou(`${prefix}-dou-s`, 'sandou', 'x', douMatOf(k), [half, gongTop - 1.5, z], layer)
    dou(`${prefix}-dou-c`, 'qixindou', 'x', douMatOf(k), [0, gongTop, z], layer)
  }

  // ── 底层：普拍枋 + 栌斗 ──
  if (withBase) {
    const paipaiGeo = new THREE.BoxGeometry(96, 12, 22)
    const paipai = new THREE.Mesh(paipaiGeo, fangMat)
    paipai.castShadow = paipai.receiveShadow = true
    add('puaipai', paipai, [0, -6, 0], 0, 0, '普拍枋')
  }
  dou('ludou', 'ludou', 'z', douMats.a, [0, 0, 0], 0, '栌斗')

  // ── 逐跳 ──
  for (let k = 1; k <= tiao; k++) {
    const y = 12 + (k - 1) * stride
    const zk = TIAO * k
    const tail = Math.max(TIAO * (k - 1) - 14, -8)
    const tip = zk + 8 + zoneHua
    const huaLen = tip - tail
    const isTop = k === tiao
    const useAng = params.ang && isTop

    // 跳头交互斗（昂制时下昂由其斗口斜穿而出）
    dou(`jiaohudou-${k}`, 'jiaohudou', 'x', douMatOf(k), [0, y + 21, zk], k, null)

    if (useAng) {
      // ── 下昂：昂尾在内上、昂尖在外下，批竹昂尖一体成型 ──
      // 昂底过跳心处坐于交互斗斗口（欹顶），昂广15分厚10分，斜率约1:3.3
      const slope = 0.3
      const bottomRef = y + 21 + 6
      const angTipZ = zk + 44
      const angTailZ = Math.max(zk - 58, -10)
      const ycRef = bottomRef + 7.5
      const ycTip = ycRef - (angTipZ - zk) * slope
      const ycTail = ycRef + (zk - angTailZ) * slope
      const L = Math.hypot(angTipZ - angTailZ, ycTail - ycTip)
      const angle = Math.atan2(ycTail - ycTip, angTipZ - angTailZ)

      // 侧视轮廓：平直昂背 + 批竹斜面收至薄尖，沿昂长拉伸成体
      const tipLen = 26
      const s = new THREE.Shape()
      s.moveTo(-L / 2, -7.5)
      s.lineTo(-L / 2, 7.5)
      s.lineTo(L / 2 - tipLen, 7.5)
      s.lineTo(L / 2 - 1.5, -6)
      s.lineTo(-L / 2, -7.5)
      const angGeo = new THREE.ExtrudeGeometry(s, { depth: 10, bevelEnabled: false })
      angGeo.translate(0, 0, -5)
      const angMesh = new THREE.Mesh(angGeo, gongMatOf(k))
      angMesh.rotation.y = -Math.PI / 2 // 昂长对齐 z、厚10落在 x
      angMesh.castShadow = angMesh.receiveShadow = true
      const angGroup = new THREE.Group()
      angGroup.add(angMesh)
      angGroup.position.set(0, (ycTail + ycTip) / 2, (angTailZ + angTipZ) / 2)
      angGroup.rotation.x = -angle // 头低尾高
      angGroup.userData.partKey = 'xia-ang'
      angMesh.userData.partKey = 'xia-ang'
      group.add(angGroup)
      parts.push({
        key: 'xia-ang', mesh: angGroup as unknown as THREE.Mesh, layer: k + 0.5,
        base: angGroup.position.clone(), explodeZ: 30, label: '下昂', order: 0
      })

      // 跳头诸件依次坐于昂背：交互斗 → 令栱 →（耍头）→ 橑檐槫
      const backAtZk = bottomRef + 15 // 昂背过跳心处（昂广15）
      dou(`ang-dou-${k}`, 'jiaohudou', 'x', douMatOf(k), [0, backAtZk, zk], k + 0.5, null)
      const ling = createGong('ling', gongMatOf(k))
      add('linggong', ling, [0, backAtZk + 6 + 7.5, zk], k + 0.5, 0, '令栱')
      addDouOn('ling', k, backAtZk + 21, zk, 72, k + 0.55)
      if (shuaTou) {
        const stTail = zk - 14
        const stTip = zk + 22
        const st = createGong('shuatou', gongMatOf(k + 1), { len: stTip - stTail })
        toZAxis(st)
        add('shuatou', st, [0, backAtZk + 6 + 10.5, (stTail + stTip) / 2], k + 0.5, 22, '耍头')
      }
      const tuanGeo = new THREE.CylinderGeometry(7, 7, 80, 24)
      const tuan = new THREE.Mesh(tuanGeo, gongMats.hua)
      tuan.rotation.z = Math.PI / 2
      tuan.castShadow = tuan.receiveShadow = true
      add('liaoyan', tuan, [0, backAtZk + 21 + 10.5, zk], k + 1, 30, '橑檐槫')
    } else {
      // 华栱 k
      const hua = createGong('huagong', gongMatOf(k), { len: huaLen, juansha: 'head' })
      toZAxis(hua)
      add(`huagong-${k}`, hua, [0, y + 10.5, (tail + tip) / 2], k, 22,
        k === 1 ? '华栱' : `华栱${k === 2 ? '二' : k === 3 ? '三' : k === 4 ? '四' : '五'}`)

      if (!isTop) {
        if (jiXin) {
          // 瓜子栱
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
        // 最上跳头：令栱 + 耍头 + 橑檐槫
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

        const tuanGeo = new THREE.CylinderGeometry(7, 7, 80, 24)
        const tuan = new THREE.Mesh(tuanGeo, gongMats.hua)
        tuan.rotation.z = Math.PI / 2
        tuan.castShadow = tuan.receiveShadow = true
        add('liaoyan', tuan, [0, y + 48 + 10.5, zk], k + 1, 30, '橑檐槫')
      }
    }
  }

  // 泥道栱 + 柱头枋
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
  const fangGeo = new THREE.BoxGeometry(72, 15, 10)
  const fang = new THREE.Mesh(fangGeo, fangMat)
  fang.castShadow = fang.receiveShadow = true
  add('zhutoufang', fang, [0, fangBottom + 7.5, 0], 1.5, 0, '柱头枋')

  const height = 12 + (tiao - 1) * stride + (params.ang ? 83 : 69)

  for (const p of parts) {
    const rank = TYPE_RANK[p.key.split('-')[0]] ?? 5
    p.order = p.layer * 100 + rank
  }
  const sequence = [...parts].sort((a, b) => a.order - b.order)

  return {
    group, parts, sequence, height,
    dispose() {
      group.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
      })
      disposables.forEach((d) => d.dispose())
    }
  }
}
