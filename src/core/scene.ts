// 渲染管线：renderer / scene / camera / 灯光 / 阴影 / 自适应
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export interface Stage {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  /** 灯光与环境引用（营造之旅的日暮动画用） */
  lights: {
    key: THREE.DirectionalLight
    front: THREE.DirectionalLight
    fill: THREE.DirectionalLight
    hemi: THREE.HemisphereLight
  }
  env: { bg: THREE.Color; fog: THREE.Fog }
  /** 每帧回调（引擎内部已 render） */
  onTick: (fn: (dt: number, t: number) => void) => void
  dispose: () => void
}

export function createStage(canvas: HTMLCanvasElement): Stage {
  const isMobile = window.matchMedia('(max-width: 860px)').matches
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#15110d')
  scene.fog = new THREE.Fog('#15110d', 900, 2200)

  const camera = new THREE.PerspectiveCamera(34, 1, 1, 5000)
  camera.position.set(105, 88, 185)

  const controls = new OrbitControls(camera, canvas)
  controls.target.set(0, 36, 8)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.maxPolarAngle = Math.PI * 0.52
  controls.minDistance = 80
  controls.maxDistance = 900

  // 灯光：暖主光（投影）+ 正面补光 + 冷侧光 + 环境
  const hemi = new THREE.HemisphereLight('#cfd8e8', '#2a1c12', 0.75)
  scene.add(hemi)

  const key = new THREE.DirectionalLight('#ffe7c4', 2.4)
  key.position.set(150, 280, 260)
  key.castShadow = true
  key.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048)
  key.shadow.camera.left = -320
  key.shadow.camera.right = 320
  key.shadow.camera.top = 320
  key.shadow.camera.bottom = -220
  key.shadow.camera.far = 1400
  key.shadow.bias = -0.0004
  scene.add(key)

  // 正面补光：照亮出跳方向的外跳构件（避免顶部一片黑）
  const front = new THREE.DirectionalLight('#ffdfb0', 0.85)
  front.position.set(-60, 60, 400)
  scene.add(front)

  const fill = new THREE.DirectionalLight('#9db4d8', 0.55)
  fill.position.set(-220, 110, -160)
  scene.add(fill)

  // 地面：只接收阴影的暗色地面
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(1200, 48),
    new THREE.ShadowMaterial({ opacity: 0.32 })
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -13.5
  ground.receiveShadow = true
  scene.add(ground)

  const ticks = new Set<(dt: number, t: number) => void>()
  const clock = new THREE.Clock()
  let alive = true

  function loop() {
    if (!alive) return
    requestAnimationFrame(loop)
    const dt = clock.getDelta()
    const t = clock.elapsedTime
    ticks.forEach((fn) => fn(dt, t))
    controls.update()
    renderer.render(scene, camera)
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', resize)
  resize()
  loop()

  return {
    renderer,
    scene,
    camera,
    controls,
    lights: { key, front, fill, hemi },
    env: { bg: scene.background as THREE.Color, fog: scene.fog as THREE.Fog },
    onTick: (fn) => ticks.add(fn),
    dispose() {
      alive = false
      window.removeEventListener('resize', resize)
      renderer.dispose()
    }
  }
}
