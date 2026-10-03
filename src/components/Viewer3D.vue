<template>
  <div ref="host" class="viewer">
    <canvas ref="canvas"></canvas>
    <div ref="labelLayer" class="labels"></div>
    <div v-if="module === 'palace'" class="palace-caption">{{ palaceCaption }}</div>
    <div v-if="module === 'palace'" class="palace-controls">
      <button v-if="tourPaused && !tourEnded" class="pc-btn primary" @click="resumeTour">▶ 继续播放</button>
      <button v-if="!tourPaused && !tourEnded" class="pc-btn" @click="pauseTour">⏸ 暂停</button>
      <button class="pc-btn" @click="replayPalace">↺ 重播</button>
    </div>
    <div v-if="module === 'quake'" class="quake-scope-wrap">
      <div class="qs-legend">
        <span><i class="lg g"></i>地面位移</span>
        <span><i class="lg r"></i>屋面位移</span>
        <span class="qs-title">示波器 · 6s 窗口</span>
      </div>
      <canvas ref="scopeCanvas" class="quake-scope"></canvas>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as THREE from 'three'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import gsap from 'gsap'
import { createStage, type Stage } from '../core/scene'
import { buildPuzuo, type PuzuoModel, type PuzuoParams, DEFAULT_PARAMS } from '../bofa/puzuo'
import { buildJoint, type JointModel } from '../bofa/joints'
import { buildPalace, type PalaceModel } from '../bofa/palace'
import { createQuakeRig, type QuakeRig, type QuakeOptions } from '../bofa/quake'
import { WIKI } from '../bofa/kaogu'
import { CAI_GRADES } from '../core/units'
import { woodSound } from '../core/audio'

export type StudioModule = 'school' | 'game' | 'workshop' | 'joints' | 'palace' | 'quake'

interface SeqItem {
  key: string
  name: string
  wikiKey: string
}

const props = defineProps<{
  module: StudioModule
  params?: PuzuoParams
  explode?: number
  highlight?: number | null
  grade?: number
  gameStep?: number
  jointId?: string
  jointT?: number
  quakeOpts?: QuakeOptions
}>()

const emit = defineEmits<{
  (e: 'select', key: string | null): void
  (e: 'sequence', seq: SeqItem[]): void
  (e: 'jointInfo', info: { name: string; desc: string; source: string }): void
  (e: 'quakeStats', stats: { ratio: number; peakG: number; peakR: number }): void
}>()

const host = ref<HTMLDivElement>()
const canvas = ref<HTMLCanvasElement>()
const labelLayer = ref<HTMLDivElement>()

let stage: Stage | null = null
let puzuo: PuzuoModel | null = null
let joint: JointModel | null = null
let palace: PalaceModel | null = null
let palaceTL: gsap.core.Timeline | null = null
let quake: QuakeRig | null = null
const scopeCanvas = ref<HTMLCanvasElement>()
let lastStatsAt = 0
const palaceCaption = ref('营造之旅 —— 一座殿宇的诞生')
const tourPaused = ref(false)
const tourEnded = ref(false)
let lightOrig: {
  keyColor: string; keyIntensity: number; keyPos: THREE.Vector3
  frontI: number; hemiI: number; bgColor: string
} | null = null
let contentGroup: THREE.Group | null = null
let labelRenderer: CSS2DRenderer | null = null
let raycaster: THREE.Raycaster
let pointer: THREE.Vector2
let highlightMat: THREE.MeshStandardMaterial
let selectMat: THREE.MeshStandardMaterial
let ghostMat: THREE.MeshStandardMaterial
let selectedKey: string | null = null
let firstBuild = true
let desiredPos: THREE.Vector3 | null = null
let desiredTarget: THREE.Vector3 | null = null
const labelEls: { obj: CSS2DObject; el: HTMLDivElement }[] = []

const PART_NAMES: Record<string, string> = {
  puaipai: '普拍枋', ludou: '栌斗', huagong: '华栱', nidao: '泥道栱',
  jiaohudou: '交互斗', sandou: '散斗', qixindou: '齐心斗', guazi: '瓜子栱',
  man: '慢栱', zhutoufang: '柱头枋', linggong: '令栱', shuatou: '耍头', liaoyan: '橑檐槫'
}

function nameOf(key: string): string {
  if (/-dou-[ns]$/.test(key) || key.startsWith('sandou')) return '散斗'
  if (/-dou-c$/.test(key) || key.startsWith('qixindou')) return '齐心斗'
  const base = key.split('-')[0]
  return PART_NAMES[base] ?? key
}

function wikiKeyOf(key: string): string {
  if (/-dou-[ns]$/.test(key) || key.startsWith('sandou')) return 'sandou'
  if (/-dou-c$/.test(key) || key.startsWith('qixindou')) return 'qixindou'
  const base = key.split('-')[0]
  if (base === 'jiaohudou') return 'jiaohidou'
  return WIKI[base] ? base : base
}

// ── 取景（包围盒自适应 + 渲染循环插值） ──
function frameModel(animate = true) {
  if (!stage || !contentGroup) return
  const box = new THREE.Box3().setFromObject(contentGroup)
  if (box.isEmpty()) return
  const center = box.getCenter(new THREE.Vector3())
  const halfH = (box.max.y - box.min.y) / 2
  const halfW = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2
  const vFit = halfH / Math.tan((stage.camera.fov * Math.PI) / 360)
  const hFov = 2 * Math.atan(Math.tan((stage.camera.fov * Math.PI) / 360) * stage.camera.aspect)
  const hFit = halfW / Math.tan(hFov / 2)
  const fitDist = Math.max(vFit, hFit) * 1.25
  if (!isFinite(fitDist) || !isFinite(center.x) || !isFinite(center.y) || !isFinite(center.z)) return
  let dir: THREE.Vector3
  if (firstBuild || !animate) {
    dir = new THREE.Vector3(0.5, 0.4, 0.77).normalize()
  } else {
    dir = stage.camera.position.clone().sub(stage.controls.target).normalize()
  }
  const pos = center.clone().add(dir.multiplyScalar(fitDist))
  if (animate) {
    desiredPos = pos
    desiredTarget = center
  } else {
    stage.camera.position.copy(pos)
    stage.controls.target.copy(center)
    desiredPos = null
    desiredTarget = null
  }
}

function stopFraming() {
  desiredPos = null
  desiredTarget = null
}

// ── 材质状态 ──
function applyPartMaterials() {
  if (!puzuo) return
  const isGame = props.module === 'game'
  let placedKeys: Set<string> | null = null
  if (isGame) {
    placedKeys = new Set(puzuo.sequence.slice(0, props.gameStep ?? 0).map((p) => p.key))
  }
  for (const p of puzuo.parts) {
    const orig = p.mesh.userData.origMat as THREE.Material
    if (isGame) {
      // 拼装中：已落位的显示本体，其余为鬼影
      p.mesh.material = placedKeys!.has(p.key) ? orig : ghostMat
    } else if (selectedKey && p.key === selectedKey) {
      p.mesh.material = selectMat
    } else if (props.highlight != null && Math.abs(p.layer - props.highlight) < 0.25) {
      p.mesh.material = highlightMat
    } else {
      p.mesh.material = orig
    }
  }
}

function applyExplode() {
  if (!puzuo) return
  const t = props.module === 'game' ? 0 : props.explode ?? 0
  for (const p of puzuo.parts) {
    p.mesh.position.set(p.base.x, p.base.y + p.layer * 30 * t, p.base.z + p.explodeZ * t)
  }
}

function clearLabels() {
  for (const { obj, el } of labelEls) {
    obj.parent?.remove(obj)
    el.remove()
  }
  labelEls.length = 0
}

let lastPlacedKey: string | null = null

function disposeContent() {
  clearLabels()
  if (palaceTL) {
    palaceTL.kill()
    palaceTL = null
  }
  if (palace) {
    palace.dispose()
    palace = null
  }
  restoreLights()
  if (contentGroup) {
    stage!.scene.remove(contentGroup) // 整个内容包装组移出场景，防止堆叠
    contentGroup = null
  }
  if (puzuo) {
    puzuo.dispose()
    puzuo = null
  }
  if (joint) {
    joint.dispose()
    joint = null
  }
  if (quake) {
    quake.dispose()
    quake = null
  }
  selectedKey = null
  lastPlacedKey = null
}

// ── 营造之旅：镜头游走 + 章节字幕 + 日暮灯光 ──
function restoreLights() {
  if (!stage || !lightOrig) return
  const L = stage.lights
  L.key.color.set(lightOrig.keyColor)
  L.key.intensity = lightOrig.keyIntensity
  L.key.position.copy(lightOrig.keyPos)
  L.front.intensity = lightOrig.frontI
  L.hemi.intensity = lightOrig.hemiI
  stage.env.bg.set(lightOrig.bgColor)
  stage.env.fog.color.set(lightOrig.bgColor)
  lightOrig = null
}

function setupPalaceTour() {
  const L = stage!.lights
  lightOrig = {
    keyColor: '#' + L.key.color.getHexString(),
    keyIntensity: L.key.intensity,
    keyPos: L.key.position.clone(),
    frontI: L.front.intensity,
    hemiI: L.hemi.intensity,
    bgColor: '#' + stage!.env.bg.getHexString()
  }
  tourPaused.value = false
  tourEnded.value = false
  const cam = stage!.camera
  const tgt = stage!.controls.target
  stopFraming()
  const tl = gsap.timeline()
  for (const s of palace!.captions.steps) {
    tl.call(() => (palaceCaption.value = s.text), undefined, s.at)
  }
  const seg = (at: number, dur: number, cp: [number, number, number], tp: [number, number, number]) => {
    tl.to(cam.position, { x: cp[0], y: cp[1], z: cp[2], duration: dur, ease: 'power2.inOut' }, at)
    tl.to(tgt, { x: tp[0], y: tp[1], z: tp[2], duration: dur, ease: 'power2.inOut' }, at)
  }
  seg(0, 3.2, [430, 30, 430], [0, 10, 0])
  seg(3.2, 3.2, [330, 130, 400], [0, 110, 0])
  seg(6.4, 3.4, [250, 240, 330], [0, 265, 30])
  seg(9.8, 3.2, [470, 400, 330], [0, 340, 0])
  seg(13, 4, [620, 260, 620], [0, 170, 0])
  // 日暮灯光
  tl.to(L.key.color, { r: 1, g: 0.56, b: 0.29, duration: 3.4 }, 13)
  tl.to(L.key.position, { x: -420, y: 90, z: 180, duration: 4 }, 13)
  tl.to(L.key, { intensity: 1.7, duration: 3 }, 13)
  tl.to(L.front, { intensity: 0.25, duration: 3 }, 13)
  tl.to(L.hemi, { intensity: 0.4, duration: 3 }, 13)
  tl.to(stage!.env.bg, { r: 0.075, g: 0.05, b: 0.045, duration: 4 }, 13)
  tl.to(stage!.env.fog.color, { r: 0.075, g: 0.05, b: 0.045, duration: 4 }, 13)
  tl.eventCallback('onComplete', () => {
    tourEnded.value = true
    tourPaused.value = false
  })
  palaceTL = tl
}

function pauseTour() {
  if (!palaceTL || tourEnded.value) return
  palaceTL.pause()
  tourPaused.value = true
}

function resumeTour() {
  if (!palaceTL || tourEnded.value) return
  palaceTL.play()
  tourPaused.value = false
}

function replayPalace() {
  restoreLights()
  tourPaused.value = false
  tourEnded.value = false
  palaceCaption.value = palace!.captions.steps[0].text
  palaceTL?.restart()
}

// ── 抗震示波器：地面 vs 屋面位移双轨迹 ──
function drawScope() {
  const cv = scopeCanvas.value
  if (!cv || !quake) return
  const ctx = cv.getContext('2d')
  if (!ctx) return
  const w = (cv.width = cv.clientWidth * 2)
  const h = (cv.height = cv.clientHeight * 2)
  ctx.clearRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(231,226,214,0.1)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, h / 2)
  ctx.lineTo(w, h / 2)
  ctx.stroke()
  const hist = quake.history
  if (hist.length < 2) return
  const span = 6
  const tEnd = hist[hist.length - 1].t
  const tStart = tEnd - span
  const scale = (h / 2 - 12) / Math.max(quake.stats.peakG, quake.stats.peakR, quake.getOptions().A * 0.6, 6)
  const plot = (key: 'g' | 'r', color: string, width: number) => {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    let started = false
    for (const p of hist) {
      if (p.t < tStart) continue
      const x = ((p.t - tStart) / span) * w
      const y = h / 2 - p[key] * scale
      if (!started) {
        ctx.moveTo(x, y)
        started = true
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.stroke()
  }
  plot('g', 'rgba(217,164,65,0.5)', 3)
  plot('r', '#f0c268', 4)
}

// 抗震选项变化 → 推给模拟器
watch(
  () => props.quakeOpts,
  (o) => {
    if (o && quake) quake.setOptions(o)
  },
  { deep: true }
)

function rebuild() {
  if (!stage) return
  disposeContent()

  const params = props.params ?? DEFAULT_PARAMS
  const content = new THREE.Group()
  content.userData.isContent = true
  contentGroup = content

  if (props.module === 'quake') {
    quake = createQuakeRig(params, props.quakeOpts ?? { A: 16, freqHz: 2, mode: 'dougong', running: false })
    content.add(quake.group)
    stage.scene.add(content)
    frameModel(firstBuild ? false : true)
    firstBuild = false
    return
  }

  if (props.module === 'joints') {
    joint = buildJoint(props.jointId ?? 'yanwei', props.jointT ?? 1)
    content.add(joint.group)
    stage.scene.add(content)
    emit('jointInfo', { name: joint.name, desc: joint.desc, source: joint.source })
    frameModel(firstBuild ? false : true)
    firstBuild = false
    return
  }

  if (props.module === 'palace') {
    palace = buildPalace(params)
    content.add(palace.group)
    stage.scene.add(content)
    setupPalaceTour()
    firstBuild = false
    return
  }

  puzuo = buildPuzuo(params)
  for (const p of puzuo.parts) p.mesh.userData.origMat = p.mesh.material
  content.add(puzuo.group)

  if (props.module === 'workshop') {
    const g = props.grade ?? 3
    const factor = CAI_GRADES[g - 1].hou / CAI_GRADES[3].hou
    puzuo.group.scale.setScalar(factor)
  }

  if (props.module === 'game') {
    // 装配次序写给玩法层
    emit(
      'sequence',
      puzuo.sequence.map((p) => ({ key: p.key, name: nameOf(p.key), wikiKey: wikiKeyOf(p.key) }))
    )
    // 次序写入 order 的百分位便于落位判定
    applyPartMaterials()
  }

  stage.scene.add(content)

  // 标注（拼装模块只标鬼影，保持轻）
  if (props.module !== 'game') {
    let li = 0
    for (const p of puzuo.parts) {
      if (!p.label) continue
      const el = document.createElement('div')
      el.className = 'part-label'
      el.textContent = p.label
      el.addEventListener('click', () => {
        selectedKey = p.key
        applyPartMaterials()
        emit('select', p.key)
      })
      const obj = new CSS2DObject(el)
      const box = new THREE.Box3().setFromObject(p.mesh)
      const stagger = (li++ % 3) * 7
      obj.position.set(0, box.max.y - p.mesh.position.y + 3 + stagger, 0)
      obj.center.set(0.5, 0)
      p.mesh.add(obj)
      labelEls.push({ obj, el })
    }
  }

  applyExplode()
  applyPartMaterials()
  frameModel(firstBuild ? false : true)
  firstBuild = false
}

function pick(ev: PointerEvent) {
  if (!stage) return
  stopFraming()
  if (props.module === 'palace') {
    pauseTour() // 用户接管镜头，游走暂停（可随时"继续播放"）
    return
  }
  if (!puzuo || props.module === 'game' || props.module === 'joints') return
  const r = canvas.value!.getBoundingClientRect()
  pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
  raycaster.setFromCamera(pointer, stage.camera)
  const hits = raycaster.intersectObjects(puzuo.group.children, true)
  for (const h of hits) {
    let o: THREE.Object3D | null = h.object
    while (o && !o.userData.partKey) o = o.parent
    if (o) {
      selectedKey = o.userData.partKey as string
      applyPartMaterials()
      emit('select', selectedKey)
      return
    }
  }
  selectedKey = null
  applyPartMaterials()
  emit('select', null)
}

onMounted(() => {
  stage = createStage(canvas.value!)
  raycaster = new THREE.Raycaster()
  pointer = new THREE.Vector2()
  canvas.value!.addEventListener('pointerdown', pick)

  highlightMat = new THREE.MeshStandardMaterial({
    color: '#8a6a2f', emissive: '#d9a441', emissiveIntensity: 0.55, roughness: 0.6
  })
  selectMat = new THREE.MeshStandardMaterial({
    color: '#a4762a', emissive: '#e8b454', emissiveIntensity: 0.8, roughness: 0.5
  })
  ghostMat = new THREE.MeshStandardMaterial({
    color: '#d9a441', transparent: true, opacity: 0.13, depthWrite: false, roughness: 0.9
  })

  labelRenderer = new CSS2DRenderer()
  labelRenderer.setSize(host.value!.clientWidth, host.value!.clientHeight)
  labelRenderer.domElement.style.position = 'absolute'
  labelRenderer.domElement.style.top = '0'
  labelRenderer.domElement.style.pointerEvents = 'none'
  labelLayer.value!.appendChild(labelRenderer.domElement)
  stage.onTick((dt) => {
    if (labelRenderer) labelRenderer.render(stage!.scene, stage!.camera)
    if (props.module === 'quake' && quake) {
      quake.tick(dt)
      quake.apply()
      drawScope()
      const now = performance.now()
      if (now - lastStatsAt > 350) {
        lastStatsAt = now
        emit('quakeStats', { ratio: quake.stats.ratio, peakG: quake.stats.peakG, peakR: quake.stats.peakR })
      }
    }
    if (desiredPos && desiredTarget) {
      if (!isFinite(desiredPos.x + desiredPos.y + desiredPos.z + desiredTarget.x + desiredTarget.y + desiredTarget.z)) {
        stopFraming()
      } else {
        stage.camera.position.lerp(desiredPos, 0.055)
        stage.controls.target.lerp(desiredTarget, 0.075)
        if (stage.camera.position.distanceTo(desiredPos) < 0.6) {
          stage.camera.position.copy(desiredPos)
          stage.controls.target.copy(desiredTarget)
          stopFraming()
        }
      }
    }
  })

  rebuild()

  const final = stage.camera.position.clone()
  stage.camera.position.set(final.x * 1.9, final.y * 1.7, final.z * 1.9)
  desiredPos = final
  desiredTarget = stage.controls.target.clone()

  // 调试钩子：仅开发模式存在，生产构建不含（用于自动化测试与后台页签验证）
  if (import.meta.env.DEV) {
    ;(window as unknown as Record<string, unknown>).__yingzaoDebug = () => ({
    module: props.module,
    cam: stage!.camera.position.toArray().map((v) => Math.round(v)),
    target: stage!.controls.target.toArray().map((v) => Math.round(v)),
    snap: () => {
      if (desiredPos && desiredTarget) {
        stage!.camera.position.copy(desiredPos)
        stage!.controls.target.copy(desiredTarget)
        stopFraming()
      }
      stage!.renderer.render(stage!.scene, stage!.camera) // 后台页签强制出一帧
      return { cam: stage!.camera.position.toArray().map((v) => Math.round(v)), target: stage!.controls.target.toArray().map((v) => Math.round(v)) }
    },
    setTime: (t: number) => {
      // 后台页签验证：直接推进营造之旅时间轴（并暂停自动播放）
      if (palaceTL) {
        palaceTL.pause()
        palaceTL.time(t)
      }
      return t
    },
    quakeStep: (frames: number) => {
      // 后台页签验证：手动推进抗震物理（RAF 不可用时）
      if (!quake) return null
      for (let i = 0; i < frames; i++) {
        quake.tick(1 / 60)
      }
      quake.apply()
      stage!.renderer.render(stage!.scene, stage!.camera)
      return { ratio: Number(quake.stats.ratio.toFixed(3)), peakG: Number(quake.stats.peakG.toFixed(1)), peakR: Number(quake.stats.peakR.toFixed(1)), mode: quake.getOptions().mode }
    },
    walk: () => {
      const bad: string[] = []
      const noMat: string[] = []
      let total = 0
      const walk = (o: THREE.Object3D, path: string) => {
        total++
        for (let i = 0; i < o.children.length; i++) {
          const c = o.children[i]
          if (!c || (c as THREE.Object3D).visible === undefined) {
            bad.push(`${path}.children[${i}] = ${String(c)}`)
            continue
          }
          const m = c as THREE.Mesh
          if (m.isMesh && !m.material) noMat.push(`${path}/${c.type}${i}`)
          walk(c, `${path}/${c.type}${i}`)
        }
      }
      walk(stage!.scene, 'scene')
      return { total, bad, noMat, sceneChildren: stage!.scene.children.map((c) => `${c.type}:${c.name || ''}`) }
    }
    })
  }
})

// 落位飞入动画（游戏）
watch(
  () => props.gameStep,
  (n, old) => {
    if (props.module !== 'game' || !puzuo) return
    applyPartMaterials()
    const ni = n ?? 0
    const oi = old ?? 0
    if (ni > oi) {
      const placed = puzuo.sequence.slice(oi, ni)
      for (const p of placed) {
        const base = p.base.clone()
        gsap.fromTo(
          p.mesh.position,
          { x: base.x, y: base.y + 14, z: base.z + 150 },
          { x: base.x, y: base.y, z: base.z, duration: 0.5, ease: 'power2.in' }
        )
      }
      lastPlacedKey = placed[placed.length - 1]?.key ?? null
      setTimeout(() => woodSound.click(), 480)
    }
  }
)

watch(() => props.jointT, (t) => joint?.setT(t ?? 1))
watch(() => props.jointId, rebuild)
watch(() => props.params, rebuild, { deep: true })
watch(() => props.module, rebuild)
watch(() => props.grade, () => {
  if (props.module === 'workshop') rebuild()
})
watch(() => props.explode, applyExplode)
watch(() => props.highlight, applyPartMaterials)

onBeforeUnmount(() => {
  clearLabels()
  highlightMat?.dispose()
  selectMat?.dispose()
  ghostMat?.dispose()
  stage?.dispose()
  disposeContent()
})
</script>

<style scoped>
.viewer {
  position: absolute;
  inset: 0;
}
canvas {
  width: 100%;
  height: 100%;
  display: block;
}
.labels {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.palace-caption {
  position: absolute;
  left: 50%;
  bottom: 14%;
  transform: translateX(-50%);
  font-family: var(--serif);
  color: #efe6d3;
  font-size: 1.25rem;
  letter-spacing: 0.3em;
  white-space: nowrap;
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.8);
  pointer-events: none;
  border-bottom: 1px solid rgba(217, 164, 65, 0.4);
  padding: 0 1.2em 0.4em;
}
.palace-controls {
  position: absolute;
  left: 50%;
  bottom: 4.5%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.7rem;
  z-index: 20;
}
.quake-scope-wrap {
  position: absolute;
  left: 50%;
  bottom: 1.2rem;
  transform: translateX(-50%);
  width: min(560px, calc(100vw - 2.4rem));
  background: rgba(26, 20, 14, 0.88);
  border: 1px solid var(--line);
  border-radius: 3px;
  padding: 0.5rem 0.8rem 0.6rem;
  backdrop-filter: blur(6px);
  z-index: 20;
}
.qs-legend {
  display: flex;
  gap: 1.1em;
  color: var(--dim);
  font-size: 0.72rem;
  letter-spacing: 0.15em;
  margin-bottom: 0.35rem;
  align-items: center;
}
.qs-legend .lg {
  display: inline-block;
  width: 14px;
  height: 3px;
  border-radius: 2px;
  margin-right: 0.4em;
  vertical-align: middle;
}
.qs-legend .lg.g { background: rgba(217, 164, 65, 0.5); }
.qs-legend .lg.r { background: var(--amber); }
.qs-title { margin-left: auto; color: var(--faint); font-size: 0.65rem; }
.quake-scope { width: 100%; height: 84px; display: block; }
.pc-btn {
  font-family: var(--serif);
  background: rgba(26, 20, 14, 0.88);
  border: 1px solid rgba(217, 164, 65, 0.55);
  color: var(--amber);
  font-size: 1rem;
  letter-spacing: 0.22em;
  padding: 0.6em 1.7em;
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
}
.pc-btn.primary {
  background: var(--amber);
  color: #14100a;
  font-weight: 600;
}
.pc-btn.primary {
  background: var(--amber);
  color: #14100a;
  font-weight: 600;
}
.pc-btn:hover {
  border-color: var(--amber);
  filter: brightness(1.1);
}
</style>

<style>
/* CSS2D 标注（非 scoped） */
.part-label {
  pointer-events: auto;
  cursor: pointer;
  font-family: var(--serif);
  font-size: 13px;
  letter-spacing: 0.2em;
  color: #efe6d3;
  background: rgba(21, 16, 11, 0.72);
  border: 1px solid rgba(217, 164, 65, 0.35);
  border-radius: 2px;
  padding: 2px 10px 2px 12px;
  white-space: nowrap;
  transition: border-color 0.2s, color 0.2s;
  user-select: none;
}
.part-label:hover {
  border-color: rgba(217, 164, 65, 0.9);
  color: #f5d9a4;
}
</style>
