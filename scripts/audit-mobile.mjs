// 手机端溢出精确定位
import http from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const PORT = 9228
const URL = process.argv[2] || 'https://yingzao.pages.dev'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const httpGetJson = (url, t = 5000) => new Promise((res, rej) => { const r = http.get(url, { timeout: t }, (x) => { let d = ''; x.on('data', (c) => (d += c)); x.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }); r.on('timeout', () => r.destroy(new Error('t'))); r.on('error', rej) })
const fc = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'].find((p) => p && existsSync(p))
const profile = mkdtempSync(join(tmpdir(), 'dmp-'))
const child = spawn(fc, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', 'about:blank'], { detached: true, stdio: 'ignore' })
child.unref()
async function main() {
  let list = []; for (let i = 0; i < 80; i++) { try { list = await httpGetJson(`http://127.0.0.1:${PORT}/json/list`); if (list.some((t) => t.type === 'page')) break } catch {} await sleep(250) }
  const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl)
  let id = 0; const p = new Map()
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && p.has(m.id)) { const { resolve, reject } = p.get(m.id); p.delete(m.id); m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result) } })
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j) })
  const send = (me, pa = {}) => new Promise((resolve, reject) => { const mid = ++id; p.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method: me, params: pa })) })
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value
  await send('Page.enable'); await send('Runtime.enable')
  for (const W of [390, 360, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: 844, deviceScaleFactor: 1, mobile: true })
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('yingzao-session-v1','木作学徒');localStorage.setItem('yingzao-tutorial-v2-done','1');}catch(e){}` })
    await send('Page.navigate', { url: URL })
    for (let i = 0; i < 60; i++) { if (await ev(`(()=>{const c=document.querySelector('canvas');return !!c&&!document.querySelector('.splash')})()`)) break; await sleep(400) }
    await sleep(800)
    const r = await ev(`(()=>{
      const de=document.documentElement; const cw=de.clientWidth;
      const rows=[];
      [...document.querySelectorAll('header, header *, .module, .side, .dashboard, .console, .info-card')].forEach(e=>{
        const r=e.getBoundingClientRect();
        if(r.width>0&&(r.right>cw+1)) rows.push({cls:(e.className||e.tagName).toString().slice(0,40), right:Math.round(r.right), w:Math.round(r.width), vis:!!e.offsetParent});
      });
      const hdr=document.querySelector('header');
      const hr=hdr?.getBoundingClientRect();
      const hcs=hdr?getComputedStyle(hdr):null;
      return {cw, scrollW:de.scrollWidth, hdr:{w:Math.round(hr?.width||0), overflow:hcs?.overflowX, display:hcs?.display, flexWrap:hcs?.flexWrap, gap:hcs?.gap, pad:hcs?.padding},
        overflowing:rows.slice(0,10)};
    })()`)
    console.log(`\n=== 视口 ${W}px ===`)
    console.log(`  文档宽 ${r.scrollW} / viewport ${r.cw} | 横向溢出: ${r.scrollW > r.cw + 1 ? '❌ ' + (r.scrollW - r.cw) + 'px' : '✅'}`)
    console.log(`  header: 宽=${r.hdr.w} overflowX=${r.hdr.overflow} display=${r.hdr.display} wrap=${r.hdr.flexWrap} gap=${r.hdr.gap} padding=${r.hdr.pad}`)
    if (r.overflowing.length) { console.log('  溢出元素:'); r.overflowing.forEach((o) => console.log(`    ${o.vis ? '' : '(隐藏)'} ${o.cls.padEnd(40)} right=${o.right} w=${o.w}`)) }
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error('失败:', e.message); process.exit(1) })
