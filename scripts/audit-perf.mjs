// 性能与首屏体检：FPS 采样 + 加载时间
import http from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const PORT = 9231
const URL = process.argv[2] || 'http://127.0.0.1:4173/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const g = (u, t = 5000) => new Promise((res, rej) => { const r = http.get(u, { timeout: t }, (x) => { let d = ''; x.on('data', (c) => (d += c)); x.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }); r.on('timeout', () => r.destroy(new Error('t'))); r.on('error', rej) })
const fc = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'].find((p) => p && existsSync(p))
const child = spawn(fc, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'dmp3-'))}`, '--no-first-run', '--disable-gpu', 'about:blank'], { detached: true, stdio: 'ignore' })
child.unref()
async function main() {
  let list = []; for (let i = 0; i < 80; i++) { try { list = await g(`http://127.0.0.1:${PORT}/json/list`); if (list.some((t) => t.type === 'page')) break } catch {} await sleep(250) }
  const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl)
  let id = 0; const p = new Map()
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { const { resolve, reject } = p.get(m.id); p.delete(m.id); m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result) } })
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j) })
  const send = (me, pa = {}) => new Promise((resolve, reject) => { const mid = ++id; p.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method: me, params: pa })) })
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false })
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('yingzao-session-v1','木作学徒');localStorage.setItem('yingzao-tutorial-v2-done','1');}catch(e){}` })
  const t0 = Date.now()
  await send('Page.navigate', { url: URL })
  let ready = 0
  for (let i = 0; i < 100; i++) { if (await ev(`(()=>{const c=document.querySelector('canvas');return !!c&&!document.querySelector('.splash')})()`)) { ready = Date.now() - t0; break } await sleep(200) }
  console.log('首屏就绪耗时:', ready, 'ms')
  // 各模块 FPS 采样
  const clickText = (t) => ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='${t}');if(b){b.click();return 1}return 0})()`)
  const mods = [['营造学堂', 'school'], ['拼装挑战', 'game'], ['参数工坊', 'workshop'], ['榫卯谱', 'joints'], ['斗栱抗震', 'quake'], ['营造之旅', 'palace']]
  console.log('\n模块 FPS（headless 无 GPU，仅供参考相对值）:')
  for (const [label, key] of mods) {
    await clickText(label); await sleep(1500)
    const fps = await ev(`new Promise(r=>{let n=0;const t0=performance.now();const f=()=>{n++;const dt=performance.now()-t0;if(dt>=2000){r((n/dt*1000).toFixed(1))}else requestAnimationFrame(f)};requestAnimationFrame(f)})`)
    const mem = await ev(`(()=>{const c=document.querySelector('canvas');const gl=c&&c.getContext('webgl2');return gl?{tri:'-',prog:'-'}:{}})()`)
    console.log(`  ${label.padEnd(6)} ${fps} fps`)
  }
  await clickText('斗栱抗震'); await sleep(800)
  await clickText('▶ 开始震动'); await sleep(2500)
  const qfps = await ev(`new Promise(r=>{let n=0;const t0=performance.now();const f=()=>{n++;const dt=performance.now()-t0;if(dt>=2000){r((n/dt*1000).toFixed(1))}else requestAnimationFrame(f)};requestAnimationFrame(f)})`)
  console.log(`  ${'抗震运行中'.padEnd(6)} ${qfps} fps`)
  const memInfo = await ev(`(()=>{const m=performance.memory;return m?Math.round(m.usedJSHeapSize/1048576)+'MB / '+Math.round(m.jsHeapSizeLimit/1048576)+'MB':'N/A'})()`)
  console.log('\nJS 堆内存:', memInfo)
}
main().then(() => process.exit(0)).catch((e) => { console.error('失败:', e.message); process.exit(1) })
