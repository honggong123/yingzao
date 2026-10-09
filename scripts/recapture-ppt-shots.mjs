// 重截《大木作》答辩 PPT 的 7 张内嵌截图（CDP 驱动，零依赖）
// 输出 1280x720 PNG 到 OUT 目录
import { writeFileSync, mkdirSync } from 'node:fs'

const PORT = 9223
const URL = process.argv[2]
const OUT = process.argv[3]
const USER = '木作学徒'

mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function connect() {
  let list = []
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      list = await r.json()
      if (list.some((t) => t.type === 'page')) break
    } catch {}
    await sleep(250)
  }
  const page = list.find((t) => t.type === 'page')
  if (!page) throw new Error('找不到 page target')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  let id = 0
  const pending = new Map()
  const errs = []
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id)
      pending.delete(m.id)
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)
    } else if (m.method === 'Runtime.exceptionThrown') {
      errs.push(m.params.exceptionDetails?.text || 'exception')
    }
  })
  await new Promise((res, rej) => {
    ws.addEventListener('open', res)
    ws.addEventListener('error', rej)
  })
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const mid = ++id
      pending.set(mid, { resolve, reject })
      ws.send(JSON.stringify({ id: mid, method, params }))
    })
  return { send, errs }
}

async function main() {
  const { send, errs } = await connect()
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
  })
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source:
      `try{` +
      `localStorage.setItem('yingzao-session-v1','${USER}');` +
      `localStorage.setItem('yingzao-tutorial-v2-done','1');` + // 抑制新手教程浮层
      `}catch(e){}`,
  })
  await send('Page.navigate', { url: URL })

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' :: ' + expression.slice(0, 80))
    return r.result.value
  }
  const frames = async (n = 6) => {
    await evalJs(`new Promise(r=>{let i=0;const f=()=>{i++>=${n}?r(1):requestAnimationFrame(f)};requestAnimationFrame(f)})`)
  }
  const clickText = (text) =>
    evalJs(`(()=>{const el=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='${text}');if(!el)return 'MISS:${text}';el.click();return 'ok'})()`)
  const setRange = (i, v) =>
    evalJs(`(()=>{const el=document.querySelectorAll('.console input[type=range]')[${i}];if(!el)return 'MISS:range${i}';el.value=${v};el.dispatchEvent(new Event('input',{bubbles:true}));return 'ok'})()`)
  const setSwitch = (label, on) =>
    evalJs(`(()=>{const secs=[...document.querySelectorAll('.console .sec.row')];const s=secs.find(e=>e.textContent.includes('${label}'));if(!s)return 'MISS:${label}';const b=s.querySelector('button.switch');const cur=b.classList.contains('on');if(cur!==${on})b.click();return 'ok'})()`)
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(`${OUT}/${name}`, Buffer.from(r.data, 'base64'))
    const px = await evalJs(`(()=>{const c=document.querySelector('canvas');const r=c.getBoundingClientRect();return Math.round(r.width)+'x'+Math.round(r.height)})()`)
    console.log(`  已截 ${name}  (画布 ${px})`)
  }
  const goto = async (label) => {
    const r = await clickText(label)
    if (r !== 'ok') throw new Error(r)
    await sleep(900)
    await frames(10)
  }

  // 等待就绪
  for (let i = 0; i < 80; i++) {
    const st = await evalJs(
      `(()=>{const c=document.querySelector('canvas');return {c:!!c,s:!!document.querySelector('.splash'),g:!!document.querySelector('.gate')}})()`
    )
    if (st.c && !st.s) break
    if (st.g) throw new Error('登录门未跳过')
    await sleep(500)
  }
  console.log('应用就绪，用户名:', await evalJs(`document.querySelector('.user-chip')?.textContent.trim()`))
  console.log()

  // ── 02 school：四铺作 · 单栱 · 计心 ──
  console.log('[02] 营造学堂 四铺作单栱计心造')
  await goto('营造学堂')
  await clickText('四铺作'); await sleep(200)
  await clickText('单栱造'); await sleep(200)
  await clickText('计心造'); await sleep(200)
  await setRange(0, 0); await sleep(1200); await frames(12)
  await shot('02-school.png')

  // ── 03 school：六铺作 · 重栱 ──
  console.log('[03] 营造学堂 六铺作重栱造')
  await clickText('六铺作'); await sleep(200)
  await clickText('重栱造'); await sleep(1500); await frames(12)
  await shot('03-school-6p.png')

  // ── 04 workshop：一等材 · 六铺作 ──
  console.log('[04] 参数工坊 一等材六铺作')
  await goto('参数工坊')
  await setRange(0, 1); await sleep(300)
  await clickText('六铺作'); await sleep(1500); await frames(12)
  await shot('04-workshop.png')

  // ── 05 joints：抱肩榫 · 开合中 ──
  console.log('[05] 榫卯谱 抱肩榫')
  await goto('榫卯谱')
  await clickText('抱肩榫'); await sleep(600)
  await setRange(0, 0.55); await sleep(900); await frames(12)
  await shot('05-baojian.png')

  // ── 06 quake：中震 16分 / 2Hz / 斗栱连接 / 运行中 ──
  console.log('[06] 斗栱抗震 中震运行中')
  await goto('斗栱抗震')
  await clickText('中震'); await sleep(200)
  await clickText('斗栱连接'); await sleep(200)
  await setRange(0, 16); await setRange(1, 2); await sleep(300)
  await clickText('▶ 开始震动'); await sleep(2600); await frames(12)
  await shot('06-quake.png')
  // 顺手记录当前显示的减震值
  const pct = await evalJs(`(document.body.innerText.match(/减震\\s*(\\d+)%/)||[])[1] || '未找到'`)
  console.log('   >> 截图时应用显示的减震值:', pct + '%')

  // ── 07 palace：檐下成排铺作 ──
  console.log('[07] 营造之旅 檐下铺作')
  await goto('营造之旅')
  await sleep(9000); await frames(12)
  await shot('07-palace-eave.png')

  // ── 08 palace：日暮全景 ──
  console.log('[08] 营造之旅 日暮全景')
  await sleep(9000); await frames(12)
  await shot('08-palace-dusk.png')

  console.log()
  console.log('异常:', errs.length ? errs.slice(-5) : '无')
}

main().catch((e) => {
  console.error('失败:', e.message)
  process.exit(1)
})
