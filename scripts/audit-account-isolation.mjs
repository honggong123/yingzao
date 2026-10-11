// 账号隔离体检：验证「退出 → 换账号登录」后，上一账号的展区状态不残留
// 用法: node scripts/audit-account-isolation.mjs [url]
//
// 回归对象：2026-10-11 修复的 bug —— logoutUser() 只清 session、未复位各展区状态，
// 导致 A 账号在「营造学堂」调好的跳数/造栱制度/昂制会留给 B 账号。
import http from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PORT = Number(process.env.CDP_PORT || 9232)
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
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'dmi-'))}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=1280,720', 'about:blank',
], { detached: true, stdio: 'ignore' })
child.unref()

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

  // 等登录门出现
  const waitGate = async () => { for (let i = 0; i < 80; i++) { if (await ev(`!!document.querySelector('.gate')`)) return true; await sleep(250) } return false }
  // 等应用就绪
  const waitApp = async () => { for (let i = 0; i < 100; i++) { if (await ev(`(()=>{const c=document.querySelector('canvas');return !!c&&!document.querySelector('.gate')})()`)) return true; await sleep(300) } return false }

  const setInput = (sel, v) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return 0;e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`)
  const clickByText = (t) => ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(t)});if(!b)return 0;b.click();return 1})()`)

  async function loginAs(name) {
    // 切到「注册」标签（按钮文案含空格，用去空格比较）
    await ev(`(()=>{const t=[...document.querySelectorAll('.gate-tab')].find(b=>b.textContent.replace(/\\s/g,'')==='注册');if(t)t.click();return 1})()`)
    await sleep(250)
    await setInput('#gate-name', name)
    await setInput('#gate-pw', 'pw123456')
    await setInput('#gate-pw2', 'pw123456')
    await sleep(120)
    await ev(`(()=>{const b=document.querySelector('.gate-submit');if(b)b.click();return 1})()`)
    return waitApp()
  }

  // 读「营造学堂」控制台状态
  const schoolState = () => ev(`(()=>{
    const c=document.querySelector('.console'); if(!c) return null
    const secs=[...c.querySelectorAll('.sec')]
    const pick=(kw)=>secs.find(s=>s.textContent.includes(kw))
    const active=(s)=>s?[...s.querySelectorAll('.seg-btn')].find(b=>b.classList.contains('active'))?.textContent.trim()??null:null
    return {
      tiao: active(pick('跳数')),
      zhidu: active(pick('造栱制度')),
      jixin: [...c.querySelectorAll('.seg-btn')].filter(b=>b.classList.contains('active')).map(b=>b.textContent.trim()),
      ang: !!pick('昂制')?.querySelector('.switch.on'),
      allLabels: !!pick('全部标注')?.querySelector('.switch.on')
    }
  })()`)

  // 在学堂改状态：跳数选「六」、造栱制度切「重栱造」、昂制打开、全部标注打开
  const changeSchool = () => ev(`(()=>{
    const c=document.querySelector('.console'); if(!c) return 0
    const secs=[...c.querySelectorAll('.sec')]
    const pick=(kw)=>secs.find(s=>s.textContent.includes(kw))
    const btn=(kw,txt)=>[...(pick(kw)?.querySelectorAll('.seg-btn')||[])].find(b=>b.textContent.trim()===txt)
    btn('跳数','六')?.click()
    btn('造栱制度','重栱造')?.click()
    pick('昂制')?.querySelector('.switch')?.click()
    pick('全部标注')?.querySelector('.switch')?.click()
    return 1
  })()`)

  const results = []
  console.log('═══ 账号隔离体检（退出后状态是否残留）═══')
  console.log(`  URL: ${URL}`)

  // ── 账号 A ──
  if (!(await waitGate())) throw new Error('登录门未出现')
  const okA = await loginAs('甲匠人')
  if (!okA) throw new Error('账号 A 登录失败')
  await sleep(600)

  // A 首次登录应弹出新手教程
  const tutAOpen = await ev(`!!document.querySelector('.tg2-root')`)
  console.log(`\n  ${tutAOpen ? '✅' : '❌'} A 首次登录弹出新手教程`)
  results.push({ name: 'A 首次弹出教程', ok: tutAOpen })
  if (tutAOpen) {
    await ev(`(()=>{const b=document.querySelector('.tg2-root .tg2-skip');if(b)b.click();return 1})()`)
    await sleep(400)
  }
  const markA = await ev(`(()=>{try{return localStorage.getItem('yingzao-tutorial-v2-done-甲匠人')}catch(e){return null}})()`)
  console.log(`  ${markA === '1' ? '✅' : '❌'} A 关闭教程后写入其专属标记（${markA}）`)
  results.push({ name: 'A 教程标记已写入', ok: markA === '1' })

  const def = await schoolState()
  console.log('\n  [A] 初始（默认）:', JSON.stringify(def))
  await changeSchool()
  await sleep(500)
  const afterA = await schoolState()
  console.log('  [A] 改动后    :', JSON.stringify(afterA))
  const changed = JSON.stringify(def) !== JSON.stringify(afterA)
  console.log(`  ${changed ? '✅' : '❌'} A 账号状态已改变（用于验证隔离）`)
  results.push({ name: 'A 账号改动生效', ok: changed })

  // ── 退出 ──
  await clickByText('退出')
  await sleep(800)
  const backToGate = await ev(`!!document.querySelector('.gate')`)
  console.log(`\n  ${backToGate ? '✅' : '❌'} 退出后回到登录门`)
  results.push({ name: '退出回到登录门', ok: backToGate })

  // ── 账号 B ──
  const okB = await loginAs('乙匠人')
  if (!okB) throw new Error('账号 B 登录失败')
  await sleep(800)
  const stateB = await schoolState()
  console.log('  [B] 登录后    :', JSON.stringify(stateB))
  const clean = JSON.stringify(stateB) === JSON.stringify(def)
  console.log(`  ${clean ? '✅' : '❌'} B 账号看到的是默认状态（无残留）`)
  results.push({ name: 'B 账号无残留', ok: clean })

  // ── 教程标记是否按用户隔离 ──
  const tutBOpen = await ev(`!!document.querySelector('.tg2-root')`)
  console.log(`\n  ${tutBOpen ? '✅' : '❌'} B 账号重新看到新手教程（未被 A 的标记抑制）`)
  results.push({ name: 'B 重新弹出教程', ok: tutBOpen })
  const tut = await ev(`(()=>{try{return {
    global: localStorage.getItem('yingzao-tutorial-v2-done'),
    A: localStorage.getItem('yingzao-tutorial-v2-done-甲匠人'),
    B: localStorage.getItem('yingzao-tutorial-v2-done-乙匠人')
  }}catch(e){return {err:String(e)}}})()`)
  console.log('  [教程标记]', JSON.stringify(tut))
  const tutIsolated = !tut.B
  console.log(`  ${tutIsolated ? '✅' : '❌'} B 账号的教程标记独立（未被 A 污染）`)
  results.push({ name: '教程标记按用户隔离', ok: tutIsolated })

  const fails = results.filter((r) => !r.ok)
  console.log(`\n════ 结论：${results.length - fails.length}/${results.length} 项通过 ════`)
  if (fails.length) { fails.forEach((f) => console.log('  ❌ ' + f.name)); process.exitCode = 1 }
}

main().then(() => process.exit(process.exitCode || 0)).catch((e) => { console.error('失败:', e.message); process.exit(1) })
