<template>
  <div class="gate">
    <div class="gate-glow"></div>
    <div class="gate-panel">
      <span class="gate-seal">大木</span>
      <h1 class="gate-title">大木作 · 数字营造系统</h1>
      <p class="gate-sub">宋《营造法式》斗栱榫卯 —— 可拆 · 可拼 · 可改 · 可造</p>

      <div class="gate-seg">
        <button class="gate-tab" :class="{ on: mode === 'login' }" @click="mode = 'login'">登 录</button>
        <button class="gate-tab" :class="{ on: mode === 'register' }" @click="mode = 'register'">注 册</button>
      </div>

      <label class="gate-label" for="gate-name">用户名（2–16 字符）</label>
      <input id="gate-name" v-model="name" maxlength="16" autocomplete="username" @keydown.enter="submit" />
      <label class="gate-label" for="gate-pw">密码（至少 4 位）</label>
      <input id="gate-pw" v-model="pw" type="password" autocomplete="current-password" @keydown.enter="submit" />
      <template v-if="mode === 'register'">
        <label class="gate-label" for="gate-pw2">确认密码</label>
        <input id="gate-pw2" v-model="pw2" type="password" autocomplete="new-password" @keydown.enter="submit" />
      </template>

      <button class="gate-submit" @click="submit">
        {{ mode === 'login' ? '进入大木作' : '注册并进入' }}
      </button>
      <p v-if="msg" class="gate-msg" :class="{ err: !msgOk }">{{ msg }}</p>
      <p class="gate-note">
        演示版鉴权：账号保存在本机浏览器（密码经 SHA-256 摘要），登录后可保存拼装落成成绩；正式版将接入云端服务。
      </p>
    </div>
    <p class="gate-foot">全国大学生数字媒体科技作品及创意竞赛 · 参赛作品《大木作》</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { login, register } from '../core/auth'

const mode = ref<'login' | 'register'>('login')
const name = ref('')
const pw = ref('')
const pw2 = ref('')
const msg = ref('')
const msgOk = ref(false)

async function submit() {
  const r = mode.value === 'login' ? await login(name.value, pw.value) : await register(name.value, pw.value, pw2.value)
  msg.value = r.msg
  msgOk.value = r.ok
  // 登录/注册成功后，App 根据 currentUser 的变化自动放行
}
</script>

<style scoped>
.gate {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.4rem;
  background:
    radial-gradient(ellipse 70% 55% at 50% 8%, rgba(217, 164, 65, 0.09), transparent),
    var(--bg);
  overflow: hidden;
}
.gate-glow {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E");
  pointer-events: none;
}
.gate-panel {
  width: min(400px, calc(100vw - 2.4rem));
  background: rgba(26, 20, 14, 0.92);
  border: 1px solid rgba(217, 164, 65, 0.4);
  border-top: 3px solid var(--amber);
  border-radius: 3px;
  padding: 1.8rem 2rem 1.4rem;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
  text-align: center;
}
.gate-seal {
  display: inline-grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border: 2px solid var(--cinnabar);
  color: var(--cinnabar);
  font-weight: 700;
  font-size: 1.15rem;
  letter-spacing: 0.1em;
  border-radius: 3px;
  margin-bottom: 0.9rem;
}
.gate-title { font-size: 1.5rem; letter-spacing: 0.3em; color: var(--ink); }
.gate-sub { color: var(--faint); font-size: 0.75rem; letter-spacing: 0.22em; margin-top: 0.4rem; }

.gate-seg { display: flex; gap: 0.4rem; margin: 1.3rem 0 0.9rem; }
.gate-tab {
  flex: 1;
  font-family: var(--serif);
  background: transparent;
  border: 1px solid var(--line);
  color: var(--dim);
  font-size: 0.92rem;
  letter-spacing: 0.3em;
  padding: 0.5em 0;
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.2s;
}
.gate-tab.on { border-color: var(--amber); color: var(--amber); background: rgba(217, 164, 65, 0.1); }

.gate-label { display: block; text-align: left; color: var(--faint); font-size: 0.72rem; letter-spacing: 0.25em; margin: 0.8rem 0 0.3rem; }
.gate-panel input {
  width: 100%;
  font-family: var(--serif);
  background: var(--bg);
  border: 1px solid var(--line);
  color: var(--ink);
  padding: 0.65em 0.9em;
  font-size: 0.95rem;
  border-radius: 2px;
}
.gate-panel input:focus { outline: none; border-color: var(--amber); }
.gate-submit {
  width: 100%;
  margin-top: 1.2rem;
  font-family: var(--serif);
  background: var(--amber);
  border: none;
  color: #14100a;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.35em;
  padding: 0.75em 0;
  border-radius: 2px;
  cursor: pointer;
}
.gate-submit:hover { filter: brightness(1.08); }
.gate-msg { margin-top: 0.7rem; font-size: 0.85rem; color: var(--amber); }
.gate-msg.err { color: var(--cinnabar); }
.gate-note {
  margin-top: 1rem;
  padding-top: 0.8rem;
  border-top: 1px dashed var(--line);
  color: var(--faint);
  font-size: 0.72rem;
  line-height: 1.9;
}
.gate-foot { color: var(--faint); font-size: 0.7rem; letter-spacing: 0.2em; }
</style>
