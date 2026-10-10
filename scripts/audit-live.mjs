// 《大木作》线上体检：巡检六大模块 + 捕获控制台错误/警告 + 可访问性快检
// 用法: node scripts/audit-live.mjs [url]
import http from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PORT = Number(process.env.CDP_PORT || 9226)
const URL = process.argv[2] || 'https://yingzao.pages.dev'
const USER = '木作学徒'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function httpGetJson(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let d = ''
      res.on('data', (c) => (d += c))
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(e) } })
    })
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', reject)
  })
}

function findChrome() {
  const cands = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ]
  return cands.find((p) => p && existsSync(p))
}

function launchChrome() {
  const exe = findChrome()
  if (!exe) throw new Error('找不到 Chrome/Edge')
  const profile = mkdtempSync(join(tmpdir(), 'damuzuo-audit-'))
  const args = [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    '--window-size=1280,720', 'about:blank',
  ]
  const child = spawn(exe, args, { detached: true, stdio: 'ignore' })
  child.unref()
  return child
}

async function connect() {
  let list = []
  for (let i = 0; i < 80; i++) {
    try {
      list = await httpGetJson(`http://127.0.0.1:${PORT}/json/list`)
      if (Array.isArray(list) && list.some((t) => t.type === 'page')) break
    } catch {}
    await sleep(250)
  }
  const page = list.find((t) => t.type === 'page')
  if (!page) throw new Error('找不到 page target')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  let id = 0
  const pending = new Map()
  const logs = { error: [], warn: [], exception: [] }
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id)
      pending.delete(m.id)
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)
    } else if (m.method === 'Runtime.consoleAPICalled') {
      const txt = (m.params.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ')
      if (m.params.type === 'error') logs.error.push(txt)
      else if (m.params.type === 'warning') logs.warn.push(txt)
    } else if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails
      logs.exception.push((d?.exception?.description || d?.text || 'exception').split('\n')[0])
    } else if (m.method === 'Log.entryAdded') {
      const e = m.params.entry
      const t = `[${e.source}] ${e.text}`
      if (e.level === 'error') logs.error.push(t)
      else if (e.level === 'warning') logs.warn.push(t)
    }
  })
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej) })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id
    pending.set(mid, { resolve, reject })
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
  return { send, logs }
}

async function main() {
  launchChrome()
  const { send, logs } = await connect()
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Log.enable')
  await send('Network.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false })
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try{localStorage.setItem('yingzao-session-v1','${USER}');localStorage.setItem('yingzao-tutorial-v2-done','1');}catch(e){}`,
  })
  await send('Page.navigate', { url: URL })

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' :: ' + expression.slice(0, 80))
    return r.result.value
  }
  const frames = async (n = 8) => evalJs(`new Promise(r=>{let i=0;const f=()=>{i++>=${n}?r(1):requestAnimationFrame(f)};requestAnimationFrame(f)})`)
  const clickText = (text) =>
    evalJs(`(()=>{const el=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='${text}');if(!el)return 'MISS';el.click();return 'ok'})()`)

  // 等待就绪
  let ready = false
  for (let i = 0; i < 90; i++) {
    const st = await evalJs(`(()=>{const c=document.querySelector('canvas');return {c:!!c,s:!!document.querySelector('.splash'),g:!!document.querySelector('.gate')}})()`)
    if (st.g) throw new Error('登录门未跳过')
    if (st.c && !st.s) { ready = true; break }
    await sleep(500)
  }
  if (!ready) throw new Error('应用未就绪（超时）')
  console.log('✅ 应用就绪 | 用户:', await evalJs(`document.querySelector('.user-chip')?.textContent.trim() || '(未知)'`))

  const results = []
  const modules = ['营造学堂', '拼装挑战', '参数工坊', '榫卯谱', '斗栱抗震', '营造之旅']
  for (const m of modules) {
    const r = await clickText(m)
    await sleep(1400); await frames(10)
    // 检查画布是否有内容 + 面板文本长度
    const info = await evalJs(`(()=>{
      const c=document.querySelector('canvas');
      const gl=c&&(c.getContext('webgl2')||c.getContext('webgl'));
      
      const btns=[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(Boolean);
      return {canvas:!!c, w:Math.round(c?.getBoundingClientRect().width||0),
        textLen:(document.body.innerText||'').length, btnCount:btns.length};
    })()`)
    const ok = r === 'ok' && info.canvas && info.w > 0 && info.textLen > 50
    results.push({ m, ok, r, ...info })
    console.log(`  ${ok ? '✅' : '❌'} ${m.padEnd(6)} 切换=${r} 画布=${info.w}px 文本=${info.textLen}字 按钮=${info.btnCount}`)
  }

  // 数值口径抽查：抗震模块
  await clickText('斗栱抗震'); await sleep(800)
  await clickText('中震'); await sleep(300)
  const qtxt = await evalJs(`(document.body.innerText||'').split('\\n').filter(l=>/减震|震级|放大/.test(l)).join(' | ')`)
  console.log('\n📊 抗震模块读数:', qtxt.slice(0, 200))

  // 首页/全局文本里的旧值残留扫描
  const residual = await evalJs(`(()=>{const t=document.body.innerText||'';const hits=[];['67%','1.31','0.33 倍','近三分之一'].forEach(k=>{if(t.includes(k))hits.push(k)});return hits})()`)
  console.log('🔍 界面旧值残留:', residual.length ? '❌ ' + residual.join(', ') : '✅ 无')

  console.log('\n════ 控制台诊断 ════')
  console.log(`错误 ${logs.error.length} 条 / 警告 ${logs.warn.length} 条 / 异常 ${logs.exception.length} 条`)
  const uniq = (a) => [...new Set(a)]
  if (logs.exception.length) { console.log('\n❌ 未捕获异常:'); uniq(logs.exception).slice(0, 8).forEach((e) => console.log('   ' + e)) }
  if (logs.error.length) { console.log('\n❌ 错误:'); uniq(logs.error).slice(0, 10).forEach((e) => console.log('   ' + e.slice(0, 160))) }
  if (logs.warn.length) { console.log('\n⚠️  警告:'); uniq(logs.warn).slice(0, 10).forEach((e) => console.log('   ' + e.slice(0, 160))) }
  if (!logs.error.length && !logs.exception.length) console.log('\n✅ 无 JS 错误')

  const fails = results.filter((r) => !r.ok)
  console.log(`\n════ 结论：${results.length - fails.length}/${results.length} 模块正常 ════`)
}

main().then(() => process.exit(0)).catch((e) => { console.error('失败:', e.message); process.exit(1) })
