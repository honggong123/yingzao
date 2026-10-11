// 拼装关卡体检：验证「关卡件数 / 候选盘」与所选铺作一致，且不被其他展区的铺作串味
// 用法: node scripts/audit-game-level.mjs [url]
//
// 回归对象：2026-10-11 修复的 bug ——
//   App.vue 的 viewerParams watchEffect 缺 game 分支，从学堂切回拼装挑战时
//   viewerParams 仍是学堂的铺作，Viewer3D 把该 sequence 回传给玩法层，
//   导致卡片写「四铺作单栱计心造」而件数/候选盘却是「八铺作重栱偷心造」(27)。
import http from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PORT = Number(process.env.CDP_PORT || 9234)
const URL = process.argv[2] || 'https://yingzao.pages.dev'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const g = (u, t = 5000) => new Promise((res, rej) => {
  const r = http.get(u, { timeout: t }, (x) => { let d = ''; x.on('data', (c) => (d += c)); x.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) })
  r.on('timeout', () => r.destroy(new Error('t'))); r.on('error', rej)
})
const findChrome = () => [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => p && existsSync(p))

const child = spawn(findChrome(), [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'dmgl-'))}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=1280,720', 'about:blank',
], { detached: true, stdio: 'ignore' })
child.unref()

// 各形制的正确件数（由 buildPuzuo 实测：四=15 五=21 六=27）
const EXPECT = { 四: 15, 五: 21, 六: 27 }

async function main() {
  let list = []
  for (let i = 0; i < 80; i++) { try { list = await g(`http://127.0.0.1:${PORT}/json/list`); if (list.some((t) => t.type === 'page')) break } catch {} await sleep(250) }
  const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl)
  let id = 0; const p = new Map()
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { const { resolve, reject } = p.get(m.id); p.delete(m.id); m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result) } })
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j) })
  const send = (me, pa = {}) => new Promise((resolve, reject) => { const mid = ++id; p.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method: me, params: pa })) })
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value

  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: URL })

  for (let i = 0; i < 100; i++) { if (await ev(`!!document.querySelector('.gate')`)) break; await sleep(250) }
  await ev(`(()=>{const t=[...document.querySelectorAll('.gate-tab')].find(b=>b.textContent.replace(/\\s/g,'')==='注册');if(t)t.click();return 1})()`)
  await sleep(250)
  for (const [s, v] of [['#gate-name', '关卡体检员'], ['#gate-pw', 'pw123456'], ['#gate-pw2', 'pw123456']])
    await ev(`(()=>{const e=document.querySelector(${JSON.stringify(s)});e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`)
  await ev(`(()=>{document.querySelector('.gate-submit').click();return 1})()`)
  for (let i = 0; i < 100; i++) { if (await ev(`(()=>{const c=document.querySelector('canvas');return !!c&&!document.querySelector('.gate')})()`)) break; await sleep(300) }
  await sleep(800)
  await ev(`(()=>{const b=document.querySelector('.tg2-root .tg2-skip');if(b)b.click();return 1})()`)
  await sleep(400)

  const clickText = (t) => ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(t)});if(!b)return 0;b.click();return 1})()`)
  const clickIn = (kw, txt) => ev(`(()=>{const c=document.querySelector('.console');const s=[...c.querySelectorAll('.sec')].find(x=>x.textContent.includes(${JSON.stringify(kw)}));if(!s)return 0;const b=[...s.querySelectorAll('.seg-btn')].find(x=>x.textContent.trim()===${JSON.stringify(txt)});if(!b)return 0;b.click();return 1})()`)
  const seq = () => ev(`(()=>{const a=document.querySelector('.info-card');const m=a&&a.innerText.match(/第\\s*(\\d+)\\s*\\/\\s*(\\d+)\\s*件/);return m?{step:+m[1],total:+m[2]}:null})()`)
  const title = () => ev(`(()=>{const a=document.querySelector('.info-card');const h=a&&a.querySelector('h3');const al=a&&a.querySelector('.alias');return al?al.textContent.trim():null})()`)
  const tray = () => ev(`(()=>[...document.querySelectorAll('.tray-card')].map(b=>b.textContent.trim()))()`)

  const results = []
  const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`  ${ok ? '✅' : '❌'} ${name}${extra ? '  ' + extra : ''}`) }

  console.log('═══ 拼装关卡体检（关卡件数/候选盘是否与所选铺作一致）═══')
  console.log(`  URL: ${URL}`)

  // ── 1. 开四铺作 ──
  await clickText('拼装挑战'); await sleep(700)
  await clickIn('关卡', '四'); await sleep(250)
  await clickText('开始拼装'); await sleep(1400)
  let s = await seq(), t = await title(), tr = await tray()
  console.log(`\n  [1] 四铺作：${t}  第 ${s?.step}/${s?.total} 件  候选盘=${JSON.stringify(tr)}`)
  check('四铺作件数 = 15', s?.total === EXPECT['四'], `实际 ${s?.total}`)
  check('四铺作标题正确', t === '四铺作单栱计心造', `实际 ${t}`)
  check('候选盘含正确首件「普拍枋」', tr.includes('普拍枋'), `盘=${JSON.stringify(tr)}`)

  // ── 2. 去学堂改成八铺作重栱偷心造，再切回拼装挑战 ──
  await clickText('营造学堂'); await sleep(700)
  await clickIn('跳数', '八'); await sleep(200)
  await clickIn('造栱制度', '重栱造'); await sleep(200)
  await clickIn('造栱制度', '偷心造'); await sleep(400)
  const schoolTitle = await ev(`(()=>{const a=document.querySelector('.info-card');return a?.querySelector('h3')?.textContent.trim()||null})()`)
  console.log(`\n  [2] 学堂已设为：${schoolTitle}`)
  await clickText('拼装挑战'); await sleep(1400)
  s = await seq(); t = await title(); tr = await tray()
  console.log(`      切回后：${t}  第 ${s?.step}/${s?.total} 件  候选盘=${JSON.stringify(tr)}`)
  check('切回后件数仍为 15（未被学堂八铺作 27 串味）', s?.total === EXPECT['四'], `实际 ${s?.total}`)
  check('切回后标题仍为四铺作', t === '四铺作单栱计心造', `实际 ${t}`)
  check('切回后候选盘仍含「普拍枋」', tr.includes('普拍枋'), `盘=${JSON.stringify(tr)}`)

  // ── 3. 改成六铺作重启 ──
  await clickIn('关卡', '六'); await sleep(250)
  await clickText('重新开始'); await sleep(1400)
  s = await seq(); t = await title()
  console.log(`\n  [3] 六铺作：${t}  第 ${s?.step}/${s?.total} 件`)
  check('六铺作件数 = 27', s?.total === EXPECT['六'], `实际 ${s?.total}`)

  // ── 4. 再切学堂改五铺作并切回，确认还是 27 ──
  await clickText('营造学堂'); await sleep(700)
  await clickIn('跳数', '五'); await sleep(400)
  await clickText('拼装挑战'); await sleep(1400)
  s = await seq()
  console.log(`\n  [4] 学堂改五铺作后切回：第 ${s?.step}/${s?.total} 件`)
  check('切回后件数仍为 27', s?.total === EXPECT['六'], `实际 ${s?.total}`)

  const fails = results.filter((r) => !r.ok)
  console.log(`\n════ 结论：${results.length - fails.length}/${results.length} 项通过 ════`)
  if (fails.length) { fails.forEach((f) => console.log('  ❌ ' + f.name)); process.exitCode = 1 }
}

main().then(() => process.exit(process.exitCode || 0)).catch((e) => { console.error('失败:', e.message); process.exit(1) })
