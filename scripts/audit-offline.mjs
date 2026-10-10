// 离线单文件体检：断网模拟 + 外部依赖扫描
import http from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const PORT = 9230
const FILE = process.argv[2]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const g = (u, t = 5000) => new Promise((res, rej) => { const r = http.get(u, { timeout: t }, (x) => { let d = ''; x.on('data', (c) => (d += c)); x.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }); r.on('timeout', () => r.destroy(new Error('t'))); r.on('error', rej) })

// 静态扫描外部依赖
const html = readFileSync(FILE, 'utf-8')
const externals = [...html.matchAll(/(?:src|href)\s*=\s*["'](https?:\/\/[^"']+|\/\/[^"']+)["']/gi)].map((m) => m[1])
const fonts = [...html.matchAll(/@import\s+url\(["']?([^"')]+)/g)].map((m) => m[1])
const fetchUrls = [...html.matchAll(/https?:\/\/[a-z0-9.\-]+\.[a-z]{2,}[^\s"'`)]*/gi)].map((m) => m[0])
console.log('═══ 离线单文件外部依赖扫描 ═══')
console.log('  标签引用外部 URL:', externals.length ? externals : '✅ 无')
console.log('  CSS @import:', fonts.length ? fonts : '✅ 无')
const uniq = [...new Set(fetchUrls)].filter((u) => !/w3\.org|schema|xmlns/.test(u))
console.log('  正文出现的 http(s) 链接:', uniq.length ? uniq.slice(0, 15) : '✅ 无')
console.log('  文件大小:', (readFileSync(FILE).length / 1024 / 1024).toFixed(2), 'MB')

const fc = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'].find((p) => p && existsSync(p))
const child = spawn(fc, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'dmo-'))}`, '--no-first-run', '--disable-gpu', 'about:blank'], { detached: true, stdio: 'ignore' })
child.unref()
async function main() {
  let list = []; for (let i = 0; i < 80; i++) { try { list = await g(`http://127.0.0.1:${PORT}/json/list`); if (list.some((t) => t.type === 'page')) break } catch {} await sleep(250) }
  const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl)
  let id = 0; const p = new Map(); const failed = []; const errs = []
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && p.has(m.id)) { const { resolve, reject } = p.get(m.id); p.delete(m.id); m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result) }
    else if (m.method === 'Network.loadingFailed') failed.push(m.params.errorText + ' ' + (m.params.blockedReason || ''))
    else if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || '').split('\n')[0])
  })
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j) })
  const send = (me, pa = {}) => new Promise((resolve, reject) => { const mid = ++id; p.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method: me, params: pa })) })
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
  // 模拟完全离线：阻断所有非 file:// 请求
  await send('Network.setBlockedURLs', { urls: ['http://*', 'https://*'] })
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false })
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('yingzao-session-v1','木作学徒');localStorage.setItem('yingzao-tutorial-v2-done','1');}catch(e){}` })
  const url = 'file:///' + FILE.replace(/\\/g, '/')
  await send('Page.navigate', { url })
  let ok = false
  for (let i = 0; i < 80; i++) { const s = await ev(`(()=>{const c=document.querySelector('canvas');return !!c&&!document.querySelector('.splash')&&!document.querySelector('.gate')})()`); if (s) { ok = true; break } await sleep(400) }
  await sleep(1000)
  const st = await ev(`(()=>{const c=document.querySelector('canvas');const de=document.documentElement;return {canvas:!!c, w:Math.round(c?.getBoundingClientRect().width||0), title:document.title, txt:(document.body.innerText||'').length}})()`)
  console.log('\n═══ 断网运行测试（阻断所有 http/https）═══')
  console.log('  加载成功:', ok ? '✅' : '❌', '| 画布:', st.canvas ? st.w + 'px' : '❌ 无', '| 文本:', st.txt, '字')
  console.log('  标题:', st.title)
  console.log('  被阻断的请求数:', failed.length, failed.length ? '→ ' + [...new Set(failed)].slice(0, 5).join('; ') : '(说明无外部依赖 ✅)')
  console.log('  JS 异常:', errs.length ? '❌ ' + [...new Set(errs)].slice(0, 3).join('; ') : '✅ 无')
}
main().then(() => process.exit(0)).catch((e) => { console.error('失败:', e.message); process.exit(1) })
