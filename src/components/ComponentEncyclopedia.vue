<template>
  <Teleport to="body">
    <Transition name="enc">
      <div v-if="open" class="enc-backdrop" @click.self="$emit('close')">
        <div class="enc-panel">
          <div class="enc-head">
            <span class="enc-kicker">构件图鉴</span>
            <h3 class="enc-title">斗栱构件百科</h3>
            <button class="enc-close" @click="$emit('close')">✕</button>
          </div>
          <div class="enc-body">
            <!-- 左：构件列表 -->
            <nav class="enc-list">
              <button
                v-for="(w, i) in entries"
                :key="w.name"
                class="enc-item"
                :class="{ on: selIdx === i }"
                @click="selIdx = i"
              >
                <span class="enc-num">{{ String(i + 1).padStart(2, '0') }}</span>
                <span class="enc-name">{{ w.name }}</span>
                <span v-if="w.alias" class="enc-alias">{{ w.alias }}</span>
              </button>
            </nav>
            <!-- 右：详情 -->
            <div v-if="sel" class="enc-detail">
              <div class="ed-head">
                <h4 class="ed-name">{{ sel.name }}</h4>
                <span v-if="sel.alias" class="ed-alias">又作 {{ sel.alias }}</span>
              </div>
              <p class="ed-dims">{{ sel.dims }}</p>
              <div class="ed-sec">
                <span class="ed-label">作用</span>
                <p class="ed-text">{{ sel.role }}</p>
              </div>
              <div class="ed-sec">
                <span class="ed-label">来历</span>
                <p class="ed-text">{{ sel.origin }}</p>
              </div>
              <div v-if="sel.quote" class="ed-quote">
                <span class="ed-quote-label">《营造法式》原文</span>
                <p class="ed-quote-text">{{ sel.quote }}</p>
              </div>
              <div class="ed-src">
                <span class="ed-src-tag">出处</span>
                <span>{{ sel.source }}</span>
              </div>
              <p class="ed-hook">“{{ sel.hook }}”</p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { WIKI, WIKI_ORDER, type PartWiki } from '../data/wiki'

const props = defineProps<{ open: boolean; initialKey?: string }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const selIdx = ref(0)
const entries = computed<PartWiki[]>(() =>
  WIKI_ORDER.map((k) => WIKI[k]).filter(Boolean)
)

const sel = computed(() => entries.value[selIdx.value] ?? null)

watch(
  () => props.open,
  (v) => { if (v) selIdx.value = 0 }
)
watch(
  () => props.initialKey,
  (k) => {
    if (!k) return
    const idx = entries.value.findIndex((e) => e.name === k)
    if (idx >= 0) selIdx.value = idx
  }
)

function close() { emit('close') }
</script>

<style scoped>
.enc-backdrop {
  position: fixed;
  inset: 0;
  z-index: 140;
  background: rgba(10, 8, 5, 0.78);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
}
.enc-panel {
  width: min(880px, calc(100vw - 2.4rem));
  max-height: calc(100vh - 3rem);
  background: #1d1712;
  border: 1px solid rgba(217, 164, 65, 0.45);
  border-top: 3px solid var(--amber);
  border-radius: 3px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.enc-head {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 1rem 1.4rem 0.6rem;
  border-bottom: 1px solid var(--line);
}
.enc-kicker { color: var(--amber); font-size: 0.72rem; letter-spacing: 0.3em; }
.enc-title { font-size: 1.2rem; letter-spacing: 0.15em; color: var(--ink); }
.enc-close {
  margin-left: auto;
  background: none; border: none; color: var(--faint);
  font-size: 1.1rem; cursor: pointer; padding: 0.2em;
}
.enc-close:hover { color: var(--ink); }

.enc-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}
.enc-list {
  width: 170px;
  flex-shrink: 0;
  border-right: 1px solid var(--line);
  overflow-y: auto;
  padding: 0.4rem 0;
}
.enc-item {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  width: 100%;
  background: none;
  border: none;
  border-left: 2px solid transparent;
  color: var(--dim);
  font-family: var(--serif);
  font-size: 0.82rem;
  letter-spacing: 0.1em;
  padding: 0.45em 0.8em;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}
.enc-item:hover { color: var(--ink); }
.enc-item.on {
  color: var(--amber);
  border-left-color: var(--amber);
  background: rgba(217, 164, 65, 0.06);
}
.enc-num { font-size: 0.65rem; color: var(--faint); min-width: 1.4em; }
.enc-name { font-weight: bold; }
.enc-alias { font-size: 0.7rem; color: var(--faint); margin-left: auto; }

.enc-detail {
  flex: 1;
  padding: 1.2rem 1.4rem;
  overflow-y: auto;
}
.ed-head { display: flex; align-items: baseline; gap: 0.7rem; margin-bottom: 0.4rem; }
.ed-name { font-size: 1.4rem; color: var(--ink); letter-spacing: 0.12em; }
.ed-alias { color: var(--faint); font-size: 0.78rem; }
.ed-dims { color: var(--amber); font-size: 0.82rem; margin-bottom: 0.7rem; }
.ed-sec { margin-bottom: 0.7rem; }
.ed-label {
  display: inline-block;
  color: var(--faint);
  font-size: 0.7rem;
  letter-spacing: 0.3em;
  margin-bottom: 0.25rem;
  border-bottom: 1px solid var(--line);
  padding-bottom: 0.1em;
}
.ed-text { color: var(--dim); font-size: 0.88rem; line-height: 1.8; }
.ed-quote {
  background: rgba(217, 164, 65, 0.06);
  border-left: 2px solid var(--amber);
  padding: 0.7rem 1rem;
  margin: 0.8rem 0;
  border-radius: 0 2px 2px 0;
}
.ed-quote-label {
  display: block;
  color: var(--faint);
  font-size: 0.68rem;
  letter-spacing: 0.25em;
  margin-bottom: 0.3rem;
}
.ed-quote-text {
  color: var(--amber);
  font-size: 0.85rem;
  line-height: 1.7;
  font-family: var(--serif);
  font-style: italic;
}
.ed-src {
  display: flex;
  gap: 0.7em;
  align-items: baseline;
  margin-top: 0.7rem;
  color: var(--faint);
  font-size: 0.75rem;
}
.ed-src-tag {
  border: 1px solid var(--line);
  padding: 0.05em 0.5em;
  border-radius: 2px;
  flex-shrink: 0;
}
.ed-hook { color: var(--amber); font-size: 0.9rem; margin-top: 0.6rem; }

.enc-enter-active, .enc-leave-active { transition: opacity 0.25s; }
.enc-enter-from, .enc-leave-to { opacity: 0; }

@media (max-width: 640px) {
  .enc-body { flex-direction: column; }
  .enc-list {
    width: 100%;
    display: flex;
    overflow-x: auto;
    border-right: none;
    border-bottom: 1px solid var(--line);
    padding: 0 0.5rem;
  }
  .enc-item { white-space: nowrap; border-left: none; border-bottom: 2px solid transparent; }
  .enc-item.on { border-bottom-color: var(--amber); }
  .enc-detail { padding: 0.8rem 1rem; }
}
</style>
