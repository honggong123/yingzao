<template>
  <div v-if="open" class="auth-backdrop" @click.self="$emit('close')">
    <div class="auth-modal">
      <div class="auth-head">
        <span class="seal small">營造</span>
        <h3>{{ mode === 'login' ? '登录' : '注册新账号' }}</h3>
      </div>
      <p class="auth-note">
        演示版账号保存在本机浏览器（密码经 SHA-256 摘要），用于记录你的拼装落成成绩；
        正式上线版将接入云端服务。
      </p>
      <label class="auth-label" for="auth-name">用户名（2–16 字符）</label>
      <input id="auth-name" v-model="name" maxlength="16" autocomplete="username" />
      <label class="auth-label" for="auth-pw">密码（至少 4 位）</label>
      <input id="auth-pw" v-model="pw" type="password" autocomplete="current-password" />
      <template v-if="mode === 'register'">
        <label class="auth-label" for="auth-pw2">确认密码</label>
        <input id="auth-pw2" v-model="pw2" type="password" autocomplete="new-password" />
      </template>
      <p v-if="msg" class="auth-msg" :class="{ err: !msgOk }">{{ msg }}</p>
      <button class="auth-submit" @keydown.enter="submit" @click="submit">
        {{ mode === 'login' ? '登 录' : '注 册 并 登 录' }}
      </button>
      <button class="auth-switch" @click="toggleMode">
        {{ mode === 'login' ? '没有账号？去注册 →' : '已有账号？去登录 →' }}
      </button>
      <button class="auth-close" @click="$emit('close')">✕</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { login, register } from '../core/auth'

const props = defineProps<{ open: boolean; initialMode?: 'login' | 'register' }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const mode = ref<'login' | 'register'>(props.initialMode ?? 'login')
const name = ref('')
const pw = ref('')
const pw2 = ref('')
const msg = ref('')
const msgOk = ref(false)

function toggleMode() {
  mode.value = mode.value === 'login' ? 'register' : 'login'
  msg.value = ''
}

async function submit() {
  const r = mode.value === 'login' ? await login(name.value, pw.value) : await register(name.value, pw.value, pw2.value)
  msg.value = r.msg
  msgOk.value = r.ok
  if (r.ok) {
    setTimeout(() => emit('close'), 650)
  }
}
</script>

<style scoped>
.auth-backdrop {
  position: absolute;
  inset: 0;
  z-index: 130;
  background: rgba(10, 8, 5, 0.72);
  backdrop-filter: blur(2px);
  display: grid;
  place-items: center;
}
.auth-modal {
  width: min(380px, calc(100vw - 2.4rem));
  background: #1d1712;
  border: 1px solid rgba(217, 164, 65, 0.5);
  border-top: 3px solid var(--amber);
  border-radius: 3px;
  padding: 1.4rem 1.5rem 1.2rem;
  position: relative;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.6);
}
.auth-head { display: flex; align-items: center; gap: 0.8rem; margin-bottom: 0.6rem; }
.seal.small {
  width: 38px; height: 38px; font-size: 0.9rem;
  border-width: 2px;
}
.auth-head h3 { font-size: 1.2rem; letter-spacing: 0.2em; }
.auth-note { color: var(--faint); font-size: 0.75rem; line-height: 1.8; margin-bottom: 0.8rem; }
.auth-label { display: block; color: var(--faint); font-size: 0.72rem; letter-spacing: 0.25em; margin: 0.7rem 0 0.3rem; }
.auth-modal input {
  width: 100%;
  font-family: var(--serif);
  background: var(--bg);
  border: 1px solid var(--line);
  color: var(--ink);
  padding: 0.65em 0.9em;
  font-size: 0.95rem;
  border-radius: 2px;
}
.auth-modal input:focus { outline: none; border-color: var(--amber); }
.auth-msg { font-size: 0.82rem; margin-top: 0.6rem; color: var(--amber); }
.auth-msg.err { color: var(--cinnabar); }
.auth-submit {
  width: 100%;
  margin-top: 1rem;
  font-family: var(--serif);
  background: var(--amber);
  border: none;
  color: #14100a;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.3em;
  padding: 0.7em 0;
  border-radius: 2px;
  cursor: pointer;
}
.auth-submit:hover { filter: brightness(1.08); }
.auth-switch {
  width: 100%;
  margin-top: 0.7rem;
  background: none;
  border: none;
  color: var(--dim);
  font-family: var(--serif);
  font-size: 0.8rem;
  letter-spacing: 0.1em;
  cursor: pointer;
}
.auth-switch:hover { color: var(--amber); }
.auth-close {
  position: absolute;
  right: 0.8rem;
  top: 0.8rem;
  background: none;
  border: none;
  color: var(--faint);
  font-size: 1rem;
  cursor: pointer;
}
.auth-close:hover { color: var(--ink); }
</style>
