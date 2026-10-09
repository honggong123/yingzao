<template>
  <div v-if="open" class="tg2-root">
    <!-- 聚光框：暗化四周，只亮目标区域 -->
    <div v-if="rect" class="tg2-spot" :style="spotStyle"></div>

    <!-- 引导卡 -->
    <div v-if="showCard" class="tg2-card" :style="cardStyle">
      <div v-if="arrowDir" class="tg2-arrow" :class="'tg2-arrow-' + arrowDir" :style="arrowStyle"></div>
      <div class="tg2-head">
        <span class="tg2-step">{{ stepIdx + 1 }} / {{ steps.length }}</span>
        <span class="tg2-title">{{ step.title }}</span>
      </div>
      <p class="tg2-text">{{ step.text }}</p>
      <div class="tg2-foot">
        <button class="tg2-skip" @click="close">跳过教程</button>
        <div class="tg2-nav">
          <button v-if="stepIdx > 0" class="tg2-btn" @click="stepIdx--">上一步</button>
          <button v-if="stepIdx < steps.length - 1" class="tg2-btn primary" @click="stepIdx++">下一步</button>
          <button v-else class="tg2-btn primary" @click="close">开始营造</button>
        </div>
      </div>
      <div class="tg2-dots">
        <i v-for="(s, i) in steps" :key="i" :class="{ on: i === stepIdx }"></i>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

interface Step {
  title: string
  text: string
  /** 目标元素选择器；null = 居中卡 */
  sel: string | null
  /** 卡片相对目标的方位 */
  place: 'center' | 'bottom' | 'top' | 'left' | 'right'
  /** 全屏目标（画布）时把聚光缩到中央区域 */
  shrink?: number
}

const steps: Step[] = [
  {
    title: '欢迎来到《大木作》',
    text: '这是一座可以拆、可以拼、可以改的宋式斗栱营造系统。下面用六步教你操作——每一步都有箭头指明位置。',
    sel: null,
    place: 'center'
  },
  {
    title: '环视与缩放（试一试）',
    text: '箭头指的这块画面就是展厅：按住鼠标拖拽＝旋转视角，滚轮＝缩放。现在就可以按住画面拖一下试试。',
    sel: '.viewer canvas',
    place: 'bottom',
    shrink: 0.55
  },
  {
    title: '构件考据（点这里）',
    text: '左下角这张卡片是「构件考据卡」。点击画面里带金色描边的构件名称（比如「栌斗」），卡片就会换成它的尺寸和《营造法式》出处——界面里的每个数字都有文献可查。',
    sel: '.info-card',
    place: 'right'
  },
  {
    title: '营造控制台（右上方）',
    text: '箭头指的这块是控制台：换「跳数」（四铺作到八铺作）、切「单栱造/重栱造」、拖「拆解」滑杆——中间的铺作会实时重构，拖到 100% 能看它一层层解体。',
    sel: '.console',
    place: 'left'
  },
  {
    title: '五大展区（顶部切换）',
    text: '箭头指的这排是展区入口：学堂读形制 → 拼装挑战亲手拼（记得开新手教学）→ 参数工坊看模数化 → 榫卯谱开合榫卯 → 营造之旅看大殿落成。',
    sel: '.modules',
    place: 'bottom'
  },
  {
    title: '开始营造',
    text: '建议路线：回「学堂」细看一朵斗栱，然后去「拼装挑战」开着新手教学拼出你的第一朵。右上角「？新手教程」随时回来看本引导。',
    sel: null,
    place: 'center'
  }
]

const stepIdx = ref(0)
const step = computed(() => steps[stepIdx.value])
const rect = ref<{ top: number; left: number; width: number; height: number } | null>(null)
const cardPos = ref<{ top: number; left: number } | null>(null)
const arrowDir = ref<'' | 'down' | 'up' | 'left' | 'right'>('')
const arrowOffset = ref(0)
const CARD_W = Math.min(400, window.innerWidth - 32)
const CARD_H = 252

function measure() {
  const s = steps[stepIdx.value]
  if (!props.open) return
  if (!s.sel) {
    rect.value = null
    cardPos.value = {
      top: Math.max(12, (window.innerHeight - CARD_H) / 2),
      left: (window.innerWidth - CARD_W) / 2
    }
    arrowDir.value = ''
    return
  }
  const el = document.querySelector(s.sel)
  if (!el) {
    rect.value = null
    return
  }
  let r = el.getBoundingClientRect()
  if (s.shrink) {
    const dw = (r.width * (1 - s.shrink)) / 2
    const dh = (r.height * (1 - s.shrink)) / 2
    r = { top: r.top + dh, left: r.left + dw, width: r.width * s.shrink, height: r.height * s.shrink, right: 0, bottom: 0 } as DOMRect
  }
  rect.value = { top: r.top - 8, left: r.left - 8, width: r.width + 16, height: r.height + 16 }

  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  let top = 0
  let left = 0
  let dir: 'down' | 'up' | 'left' | 'right' = 'down'
  let ax = 0
  let ay = 0
  if (s.place === 'bottom') {
    top = r.bottom + 22
    left = Math.min(Math.max(cx - CARD_W / 2, 12), window.innerWidth - CARD_W - 12)
    dir = 'up'
    ax = Math.min(Math.max(cx - left - 11, 16), CARD_W - 38)
  } else if (s.place === 'top') {
    top = r.top - CARD_H - 22
    left = Math.min(Math.max(cx - CARD_W / 2, 12), window.innerWidth - CARD_W - 12)
    dir = 'down'
    ax = Math.min(Math.max(cx - left - 11, 16), CARD_W - 38)
  } else if (s.place === 'left') {
    left = r.left - CARD_W - 22
    top = Math.min(Math.max(cy - CARD_H / 2, 12), window.innerHeight - CARD_H - 12)
    dir = 'right'
    ay = Math.min(Math.max(cy - top - 11, 16), CARD_H - 38)
  } else {
    left = r.right + 22
    top = Math.min(Math.max(cy - CARD_H / 2, 12), window.innerHeight - CARD_H - 12)
    dir = 'left'
    ay = Math.min(Math.max(cy - top - 11, 16), CARD_H - 38)
  }
  top = Math.min(Math.max(top, 12), window.innerHeight - CARD_H - 12)
  left = Math.min(Math.max(left, 12), window.innerWidth - CARD_W - 12)
  cardPos.value = { top, left }
  arrowDir.value = dir
  arrowOffset.value = dir === 'up' || dir === 'down' ? ax : ay
}

const spotStyle = computed(() =>
  rect.value
    ? {
        top: rect.value.top + 'px',
        left: rect.value.left + 'px',
        width: rect.value.width + 'px',
        height: rect.value.height + 'px'
      }
    : {}
)

const cardStyle = computed(() =>
  cardPos.value
    ? { top: cardPos.value.top + 'px', left: cardPos.value.left + 'px', width: CARD_W + 'px' }
    : { display: 'none' }
)

const arrowStyle = computed(() => {
  const o = arrowOffset.value + 'px'
  if (arrowDir.value === 'down') return { left: o, bottom: '-13px' }
  if (arrowDir.value === 'up') return { left: o, top: '-13px' }
  if (arrowDir.value === 'right') return { right: '-13px', top: o }
  return { left: '-13px', top: o }
})

const showCard = computed(() => rect.value || !step.value.sel)

watch(
  [stepIdx, () => props.open],
  () => {
    // 等一步渲染再测量（v-if 挂载后）
    requestAnimationFrame(() => {
      measure()
      setTimeout(measure, 120)
      setTimeout(measure, 400)
    })
  },
  { immediate: true }
)

let reTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  reTimer = setInterval(measure, 700) // 布局动画期间持续校正
  window.addEventListener('resize', measure)
})
onBeforeUnmount(() => {
  if (reTimer) clearInterval(reTimer)
  window.removeEventListener('resize', measure)
})

function close() {
  try {
    localStorage.setItem('yingzao-tutorial-v2-done', '1')
  } catch {
    /* 无痕模式忽略 */
  }
  stepIdx.value = 0
  emit('close')
}
</script>

<style scoped>
.tg2-root {
  position: fixed;
  inset: 0;
  z-index: 150;
  pointer-events: none;
}
.tg2-spot {
  position: fixed;
  border: 2px solid var(--amber);
  border-radius: 6px;
  box-shadow: 0 0 0 9999px rgba(10, 8, 5, 0.74), 0 0 26px rgba(217, 164, 65, 0.5);
  animation: tg2-pulse 1.6s ease-in-out infinite;
  transition: all 0.35s ease;
}
@keyframes tg2-pulse {
  50% { border-color: rgba(240, 194, 104, 0.9); }
}
.tg2-card {
  position: fixed;
  background: #1d1712;
  border: 1px solid rgba(217, 164, 65, 0.55);
  border-top: 3px solid var(--amber);
  border-radius: 3px;
  padding: 1.2rem 1.4rem 0.9rem;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.65);
  pointer-events: auto;
  animation: tg2-in 0.3s ease-out;
}
@keyframes tg2-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
}
.tg2-head { display: flex; align-items: baseline; gap: 0.8rem; margin-bottom: 0.5rem; }
.tg2-step { color: var(--amber); font-size: 0.75rem; letter-spacing: 0.2em; }
.tg2-title { font-size: 1.15rem; letter-spacing: 0.12em; color: var(--ink); }
.tg2-text { color: var(--dim); font-size: 0.9rem; line-height: 1.8; }
.tg2-text b { color: var(--ink); }
.tg2-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 0.8rem; }
.tg2-skip { background: none; border: none; color: var(--faint); font-family: var(--serif); font-size: 0.78rem; letter-spacing: 0.15em; cursor: pointer; }
.tg2-skip:hover { color: var(--dim); }
.tg2-nav { display: flex; gap: 0.5rem; }
.tg2-btn {
  font-family: var(--serif);
  background: transparent;
  border: 1px solid var(--amber);
  color: var(--amber);
  font-size: 0.85rem;
  letter-spacing: 0.2em;
  padding: 0.4em 1.2em;
  border-radius: 2px;
  cursor: pointer;
}
.tg2-btn.primary { background: var(--amber); color: #14100a; font-weight: 600; }
.tg2-btn:hover { filter: brightness(1.08); }
.tg2-dots { display: flex; gap: 0.4em; margin-top: 0.8rem; }
.tg2-dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--line); transition: background 0.2s; }
.tg2-dots i.on { background: var(--amber); }

/* 指向目标的箭头（CSS 三角形） */
.tg2-arrow {
  position: absolute;
  width: 0;
  height: 0;
  border: 13px solid transparent;
}
.tg2-arrow-down {
  border-top-color: var(--amber);
  border-bottom: none;
}
.tg2-arrow-up {
  border-bottom-color: var(--amber);
  border-top: none;
}
.tg2-arrow-right {
  border-left-color: var(--amber);
  border-right: none;
}
.tg2-arrow-left {
  border-right-color: var(--amber);
  border-left: none;
}
</style>
