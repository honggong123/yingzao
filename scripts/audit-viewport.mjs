// 《大木作》多视口 + 登录流程 + 可访问性体检
import http from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PORT = Number(process.env.CDP_PORT || 9227)
const URL = process.argv[2] || 'https://yingzao.pages.dev'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function httpGetJson(url, t = 5000) {
  return new Promise((res, rej) => {
    const r = http.get(url, { timeout: t }, (x) => { let d = ''; x.on('data', (c) => (d += c)); x.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) })
    r.on('timeout', () => r.destroy(new Error('timeout'))); r.on('error', rej)
  })
}
function findChrome() {
  const c = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe']
  return c.find((p) => p && existsSync(p))
}
const profile = mkdtempSync(join(tmpdir(), 'damuzuo-vp-'))
const child = spawn(findChrome(), ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', 'about:blank'], { detached: true, stdio: 'ignore' })
child.unref()

async function connect() {
  let list = []
  for (let i = 0; i < 80; i++) { try { list = await httpGetJson(`http://127.0.0.1:${PORT}/json/list`); if (list.some((t) => t.type === 'page')) break } catch {} await sleep(250) }
  const page = list.find((t) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  let id = 0; const pending = new Map()
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result) } })
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j) })
  const send = (method, params = {}) => new Promise((resolve, reject) => { const mid = ++id; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params })) })
  return { send }
}

async function main() {
  const { send } = await connect()
  await send('Page.enable'); await send('Runtime.enable')
  const evalJs = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value }
  const frames = (n = 8) => evalJs(`new Promise(r=>{let i=0;const f=()=>{i++>=${n}?r(1):requestAnimationFrame(f)};requestAnimationFrame(f)})`)

  // ── A. 多视口布局检查 ──
  console.log('════ A. 多视口布局 ════')
  const viewports = [
    { name: '桌面 1440×900', w: 1440, h: 900, mobile: false },
    { name: '笔电 1280×720', w: 1280, h: 720, mobile: false },
    { name: '平板竖 768×1024', w: 768, h: 1024, mobile: true },
    { name: '手机 390×844', w: 390, h: 844, mobile: true },
  ]
  for (const vp of viewports) {
    await send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.mobile })
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('yingzao-session-v1','木作学徒');localStorage.setItem('yingzao-tutorial-v2-done','1');}catch(e){}` })
    await send('Page.navigate', { url: URL })
    for (let i = 0; i < 60; i++) { const s = await evalJs(`(()=>{const c=document.querySelector('canvas');return !!c&&!document.querySelector('.splash')})()`); if (s) break; await sleep(400) }
    await sleep(600); await frames(8)
    const info = await evalJs(`(()=>{
      const de=document.documentElement;
      const c=document.querySelector('canvas'); const cr=c?.getBoundingClientRect();
      const overflowX=de.scrollWidth>de.clientWidth+2;
      const overflowY=de.scrollHeight>de.clientHeight+2;
      // 找溢出元素
      let off=[]; if(overflowX){[...document.querySelectorAll('*')].forEach(e=>{const r=e.getBoundingClientRect();if(r.right>de.clientWidth+2&&r.width>4){off.push(e.className||e.tagName)}})}
      // 检查工具栏/按钮是否被裁
      const btns=[...document.querySelectorAll('button')].filter(b=>b.offsetParent);
      const clipped=btns.filter(b=>{const r=b.getBoundingClientRect();return r.right>de.clientWidth+2||r.bottom>de.clientHeight+2||r.width<10}).length;
      return {canvas:cr?Math.round(cr.width)+'x'+Math.round(cr.height):'无', scrollW:de.scrollWidth, clientW:de.clientWidth,
        overflowX, overflowY, off:[...new Set(off)].slice(0,4), btnTotal:btns.length, clipped};
    })()`)
    console.log(`  ${vp.name.padEnd(14)} 画布=${info.canvas.padEnd(10)} 横向溢出=${info.overflowX ? '❌' : '✅'} 裁切按钮=${info.clipped > 0 ? '❌ ' + info.clipped : '✅ 0'}`)
    if (info.overflowX) console.log(`      溢出元素: ${JSON.stringify(info.off)}`)
  }

  // ── B. 登录流程（新用户，无 session）──
  console.log('\n════ B. 登录流程（全新用户）════')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false })
  await evalJs(`localStorage.clear()`)
  await send('Page.navigate', { url: URL })
  await sleep(2500); await frames(8)
  const gate = await evalJs(`(()=>{
    const g=document.querySelector('.gate'); if(!g)return {exist:false};
    const inputs=[...g.querySelectorAll('input')].map(i=>({type:i.type,ph:i.placeholder,min:i.minLength,max:i.maxLength,required:i.required}));
    const btns=[...g.querySelectorAll('button')].map(b=>b.textContent.trim());
    const txt=g.innerText.slice(0,200);
    return {exist:true, inputs, btns, txt};
  })()`)
  console.log('  登录门:', gate.exist ? '存在' : '不存在')
  if (gate.exist) {
    console.log('  输入框:', JSON.stringify(gate.inputs))
    console.log('  按钮:', JSON.stringify(gate.btns))
    console.log('  文案:', gate.txt.replace(/\n/g, ' / ').slice(0, 160))
    // 试错误输入
    const badTry = await evalJs(`(()=>{
      const g=document.querySelector('.gate'); const ins=[...g.querySelectorAll('input')];
      if(ins.length<2)return 'no-inputs';
      ins[0].value='a'; ins[1].value='1';
      ins.forEach(i=>i.dispatchEvent(new Event('input',{bubbles:true})));
      const b=[...g.querySelectorAll('button')].find(x=>/登录|注册|进入/.test(x.textContent));
      if(!b)return 'no-btn';
      b.click(); return 'clicked';
    })()`)
    await sleep(1200)
    const err = await evalJs(`(()=>{const g=document.querySelector('.gate');return g?g.innerText.match(/[^\\n]{2,60}/g)?.filter(l=>/位|错误|失败|至少|无效|不符/.test(l)).join(' | ')||'(无提示)':'已进入应用'})()`)
    console.log('  错误输入反馈:', badTry, '→', err)
  }

  // ── C. 可访问性快检 ──
  console.log('\n════ C. 可访问性快检 ════')
  const a11y = await evalJs(`(()=>{
    const imgs=[...document.querySelectorAll('img')];
    const noAlt=imgs.filter(i=>!i.alt).length;
    const btns=[...document.querySelectorAll('button')];
    const iconOnly=btns.filter(b=>!b.textContent.trim()&&!b.getAttribute('aria-label')&&!b.title).length;
    const inputs=[...document.querySelectorAll('input')];
    const noLabel=inputs.filter(i=>!i.labels?.length&&!i.getAttribute('aria-label')&&!i.placeholder).length;
    // 对比度：检查主文本色
    const cs=getComputedStyle(document.body);
    return {imgTotal:imgs.length,noAlt,btnTotal:btns.length,iconOnly,inputTotal:inputs.length,noLabel,
      lang:document.documentElement.lang||'(未设)', title:document.title};
  })()`)
  console.log(`  <html lang>: ${a11y.lang === '(未设)' ? '❌ 未设置' : '✅ ' + a11y.lang}`)
  console.log(`  图片缺 alt: ${a11y.noAlt}/${a11y.imgTotal}`)
  console.log(`  纯图标按钮无 aria-label: ${a11y.iconOnly}/${a11y.btnTotal}`)
  console.log(`  输入框无标签/占位: ${a11y.noLabel}/${a11y.inputTotal}`)
}

main().then(() => process.exit(0)).catch((e) => { console.error('失败:', e.message); process.exit(1) })
