// 本地演示版鉴权 —— 账号与成绩保存在本机浏览器。
// 正式上线版应替换为云端服务（LeanCloud / Supabase 等），本模块接口保持不变。
import { ref } from 'vue'

const USERS_KEY = 'yingzao-users-v1'
const SESSION_KEY = 'yingzao-session-v1'

interface User {
  name: string
  hash: string
  createdAt: string
}

function loadUsers(): User[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]')
  } catch {
    return []
  }
}

function saveUsers(users: User[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function readSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

/** SHA-256 摘要（演示用途：本地明文不可见，但并非服务端级安全） */
async function hash(pw: string): Promise<string> {
  const data = new TextEncoder().encode('yingzao::' + pw)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** 当前登录用户（响应式） */
export const currentUser = ref<string | null>(readSession())

export interface AuthResult {
  ok: boolean
  msg: string
}

export async function register(name: string, pw: string, pw2: string): Promise<AuthResult> {
  const n = name.trim()
  if (n.length < 2 || n.length > 16) return { ok: false, msg: '用户名需 2–16 个字符' }
  if (pw.length < 4) return { ok: false, msg: '密码至少 4 位' }
  if (pw !== pw2) return { ok: false, msg: '两次输入的密码不一致' }
  const users = loadUsers()
  if (users.some((u) => u.name === n)) return { ok: false, msg: '用户名已存在' }
  users.push({ name: n, hash: await hash(pw), createdAt: new Date().toISOString().slice(0, 10) })
  saveUsers(users)
  currentUser.value = n
  localStorage.setItem(SESSION_KEY, n)
  return { ok: true, msg: '注册成功，已自动登录' }
}

export async function login(name: string, pw: string): Promise<AuthResult> {
  const n = name.trim()
  const users = loadUsers()
  const u = users.find((x) => x.name === n)
  if (!u) return { ok: false, msg: '用户不存在，请先注册' }
  if (u.hash !== (await hash(pw))) return { ok: false, msg: '密码不正确' }
  currentUser.value = n
  localStorage.setItem(SESSION_KEY, n)
  return { ok: true, msg: '欢迎回来，' + n }
}

export function logout() {
  currentUser.value = null
  localStorage.removeItem(SESSION_KEY)
}

// ── 拼装成绩存档（按用户） ──

export interface BuildRecord {
  levelKey: string
  levelName: string
  time: number
  wrong: number
  rating: string
  at: string
}

function recKey(u: string) {
  return `yingzao-records-${u}`
}

export function saveRecord(user: string, rec: BuildRecord) {
  const list: BuildRecord[] = JSON.parse(localStorage.getItem(recKey(user)) || '[]')
  list.unshift(rec)
  localStorage.setItem(recKey(user), JSON.stringify(list.slice(0, 30)))
}

export function loadRecords(user: string): BuildRecord[] {
  try {
    return JSON.parse(localStorage.getItem(recKey(user)) || '[]')
  } catch {
    return []
  }
}

/** 某关卡的个人最佳（用时最短） */
export function bestFor(user: string, levelKey: string): BuildRecord | null {
  const list = loadRecords(user).filter((r) => r.levelKey === levelKey)
  if (!list.length) return null
  return list.reduce((a, b) => (b.time < a.time ? b : a))
}
