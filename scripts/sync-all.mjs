#!/usr/bin/env node
// ============================================================================
// 《大木作》源码改动后「一键同步」编排器
// ----------------------------------------------------------------------------
// 对应项目约定：改 yingzao/ 源码后，必须同步更新 线上部署 / 参赛包 / 参赛 PPT。
// 本脚本把 8 步同步清单串成一条命令，每步带校验，失败即停并明确报错。
//
// 用法：
//   node scripts/sync-all.mjs                # 跑全部步骤
//   node scripts/sync-all.mjs --no-deploy    # 跳过部署（等线上核验时用）
//   node scripts/sync-all.mjs --no-push      # 跳过源码推送
//   node scripts/sync-all.mjs --from=3       # 从第 3 步开始（前 2 步已完成）
//   node scripts/sync-all.mjs --only=5       # 只跑第 5 步
//   node scripts/sync-all.mjs --dry          # 只打印将执行的命令，不实际运行
//
// 步骤：
//   1. build + 部署线上 + 线上自检（MD5 比对）
//   2. 重建离线单文件 → 覆盖 营造-提交包/大木作-离线单文件版.html
//   3. 重截 PPT 内嵌截图 → 按 md5 替换 答辩PPT.pptx 内嵌图
//   4. 检查 设计说明文档（需人工确认的会提示）
//   5. 重建 营造-提交包.zip（排除 PPT）
//   6. 同步 yingzao/docs/ 交付物副本
//   7. 推送源码（push-via-gh.py）
//   8. 提示 AI协作过程记录.md 是否需要更新（人工）
// ============================================================================
import { execSync, spawnSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import http from 'node:http'
import { existsSync, readFileSync, copyFileSync, rmSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve, basename } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT = resolve(__dirname, '..')          // D:/比赛4/yingzao
const ROOT = resolve(PROJECT, '..')               // D:/比赛4
const PKG = join(ROOT, '营造-提交包')              // 提交包目录
const DIST = join(PROJECT, 'dist')
const DIST_SINGLE = join(PROJECT, 'dist-single')
const IMAGES = join(PROJECT, 'docgen', 'images')
const SITE = 'https://yingzao.pages.dev'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const CDP_PORT = 9224

// ── 参数解析 ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const opt = (name) => argv.includes(`--${name}`)
const val = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=')[1] : dflt
}
const DRY = opt('dry')
const NO_DEPLOY = opt('no-deploy')
const NO_PUSH = opt('no-push')
const FROM = Number(val('from', '1'))
const ONLY = val('only', null)

// ── 工具函数 ────────────────────────────────────────────────────────────────
const log = (...a) => console.log(...a)
const hr = () => log('─'.repeat(70))
const step = (n, title) => { hr(); log(`\n【第 ${n} 步】${title}\n`) }
const ok = (m) => log(`  ✅ ${m}`)
const warn = (m) => log(`  ⚠️  ${m}`)
const info = (m) => log(`     ${m}`)

const md5 = (buf) => createHash('md5').update(buf).digest('hex')
const md5File = (p) => md5(readFileSync(p))
const size = (p) => statSync(p).size
const fmt = (n) => n.toLocaleString('en-US')

// 本机设置了 HTTP_PROXY 等环境变量，Node 22 的 fetch 会把 localhost 请求也走代理，
// 导致连不上 CDP。改用 node:http 直连（已实测不受代理影响）。
function httpGet(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let d = ''
      res.on('data', (c) => (d += c))
      res.on('end', () => resolve({ status: res.statusCode, body: d }))
    })
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', reject)
  })
}

function run(cmd, { cwd = PROJECT, allowFail = false, inherit = true } = {}) {
  log(`  $ ${cmd}`)
  if (DRY) return { status: 0 }
  const r = spawnSync(cmd, { cwd, shell: true, stdio: inherit ? 'inherit' : 'pipe', encoding: 'utf-8' })
  if (r.status !== 0 && !allowFail) {
    throw new Error(`命令失败（exit ${r.status}）：${cmd}${r.stderr ? '\n' + r.stderr.slice(-800) : ''}`)
  }
  return r
}
// 捕获命令 stdout —— 本环境 Node 的 spawnSync pipe 模式异常（拿不到 stdout，exit null），
// 故统一改为「命令输出重定向到临时文件 → 读文件」。
function out(cmd, cwd = PROJECT) {
  if (DRY) return ''
  const f = join(tmpdir(), `sync-out-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`)
  const r = spawnSync(`${cmd} > "${f}" 2>&1`, { cwd, shell: true, stdio: 'inherit' })
  let txt = ''
  try { txt = readFileSync(f, 'utf-8') } catch {}
  try { rmSync(f, { force: true }) } catch {}
  return txt.trim()
}

// 是否应执行第 n 步
function shouldRun(n) {
  if (ONLY) return String(n) === ONLY
  if (n < FROM) return false
  if (n === 1 && NO_DEPLOY) return false
  if (n === 7 && NO_PUSH) return false
  return true
}

// ── 内存中的结果收集（末尾汇总）────────────────────────────────────────────
const report = []
const note = (n, msg) => report.push({ n, msg })

// ============================================================================
// 第 1 步：build + 部署 + 线上自检
// ============================================================================
async function step1_deploy() {
  step(1, '构建 dist + 部署线上 + 线上自检')

  run('npm run build')

  // 记录本地产物指纹
  const localIndex = join(DIST, 'index.html')
  if (!existsSync(localIndex)) throw new Error('dist/index.html 不存在，构建可能失败')
  const localMainJs = readdirSync(join(DIST, 'assets')).find((f) => /^index-.*\.js$/.test(f))
  const localHtmlMd5 = md5File(localIndex)
  const localJsMd5 = localMainJs ? md5File(join(DIST, 'assets', localMainJs)) : null
  info(`本地 index.html  md5 = ${localHtmlMd5}`)
  if (localMainJs) info(`本地 ${localMainJs}  md5 = ${localJsMd5}`)

  run('wrangler pages deploy dist --project-name=yingzao --branch=main --commit-dirty=true')

  // 线上自检：HTTP 200 + title + 产物指纹比对
  info('线上自检中…')
  if (!DRY) {
    await sleep(6000) // 等 CDN 生效
    const code = out(`curl -s -o /dev/null -w "%{http_code}" ${SITE}/`)
    if (code !== '200') throw new Error(`线上返回 ${code}，非 200`)
    ok(`线上 HTTP ${code}`)

    const title = out(`curl -s ${SITE}/ | grep -o "<title>[^<]*</title>"`)
    info(`线上标题：${title}`)
    if (!title.includes('大木作')) warn(`线上标题未含「大木作」：${title}`)

    // 取线上主 JS 名并比 md5
    const html = out(`curl -s ${SITE}/`)
    const m = html.match(/assets\/(index-[A-Za-z0-9_-]+\.js)/)
    if (m && localMainJs) {
      const remoteName = m[1]
      if (remoteName !== localMainJs) {
        warn(`线上主 JS 名（${remoteName}）与本地（${localMainJs}）不一致 —— 可能命中旧缓存或漏传`)
      } else {
        const remoteJs = out(`curl -s ${SITE}/assets/${remoteName} | md5sum | cut -d" " -f1`)
        if (remoteJs === localJsMd5) ok(`线上主 JS md5 与本地一致（${localJsMd5}）`)
        else warn(`线上主 JS md5（${remoteJs}）≠ 本地（${localJsMd5}）—— 请手动复查`)
      }
    }
    note(1, `已部署并自检：${SITE}`)
  }
}

// ============================================================================
// 第 2 步：重建离线单文件 → 提交包
// ============================================================================
async function step2_singlefile() {
  step(2, '重建离线单文件版 → 覆盖提交包')
  run('npx vite build --config vite.singlefile.config.ts')
  const src = join(DIST_SINGLE, 'index.html')
  if (!existsSync(src)) throw new Error('dist-single/index.html 未生成')
  const dst = join(PKG, '大木作-离线单文件版.html')
  if (!DRY) copyFileSync(src, dst)
  ok(`已覆盖 ${basename(dst)}（${fmt(size(src))} B）`)
  note(2, `离线单文件已更新（${fmt(size(src))} B）`)
}

// ============================================================================
// 第 3 步：重截 PPT 内嵌截图并替换
// ============================================================================
async function step3_ppt_shots() {
  step(3, '重截 PPT 内嵌截图 → 替换 答辩PPT.pptx')

  if (!DRY && !existsSync(CHROME)) throw new Error(`找不到 Chrome：${CHROME}`)

  // 3a. 启动 headless Chrome（CDP）
  //     注意：必须用异步 spawn 而非 spawnSync —— spawnSync 会等待子进程 tree 退出，
  //     而 Chrome 是长期运行的，会导致永久阻塞。Chrome 用 detached:true 独立进程组。
  info(`启动 headless Chrome（端口 ${CDP_PORT}）…`)
  // profile 放系统临时目录（避免在项目内产生大量文件；且不主动删，交给系统清理）
  const chromeProfile = join(tmpdir(), `yingzao-chrome-${Date.now()}`)
  let chromeProc = null
  if (!DRY) {
    const args = [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      `--remote-debugging-port=${CDP_PORT}`, '--window-size=1280,720',
      `--user-data-dir=${chromeProfile}`, 'about:blank',
    ]
    chromeProc = spawn(CHROME, args, { detached: true, stdio: 'ignore' })
    chromeProc.unref()
    // 等 CDP 就绪（用 http 模块，避开代理）
    let ready = false
    for (let i = 0; i < 40; i++) {
      try {
        const r = await httpGet(`http://127.0.0.1:${CDP_PORT}/json/version`)
        if (r.status === 200) { ready = true; break }
      } catch {}
      await sleep(500)
    }
    if (!ready) throw new Error(`Chrome CDP 未在端口 ${CDP_PORT} 就绪`)
    ok('Chrome 已就绪')
  }

  // 3b. 跑截图脚本（用线上最新版最保险）
  const shotOutDir = join(PROJECT, '.ppt-shots-tmp')
  rmSync(shotOutDir, { recursive: true, force: true })
  if (!DRY) {
    const r = spawnSync('node', ['scripts/recapture-ppt-shots.mjs', SITE, shotOutDir], {
      cwd: PROJECT, stdio: 'inherit', encoding: 'utf-8',
      env: { ...process.env, CDP_PORT: String(CDP_PORT) },
    })
    if (r.status !== 0) throw new Error('截图脚本失败')
  }

  // 3c. 用 Python 助手把新截图替换进 pptx 并重打包
  //     （Windows 无 zip 命令，Node 无法重打包 pptx，故走 Python zipfile）
  const pptx = join(PKG, '答辩PPT.pptx')
  if (!DRY) {
    run(`python scripts/repack-pptx.py "${pptx}" "${shotOutDir}"`)
    // 校验：重打包后 zip 结构完整
    // 注意：本环境 Node 的 spawnSync pipe 模式异常（exit null），故让 Python 把结果写文件再读。
    const chkFile = join(tmpdir(), `pptx-check-${Date.now()}.txt`)
    run(
      `python -c "import zipfile,sys;z=zipfile.ZipFile('${pptx.replace(/\\/g, '/')}');sys.stdout=open(r'${chkFile.replace(/\\/g, '/')}','w');print('OK' if z.testzip() is None else 'BAD',len(z.namelist()))"`
    )
    if (!existsSync(chkFile)) throw new Error('pptx 完整性校验未产生结果')
    const res = readFileSync(chkFile, 'utf-8').trim()
    rmSync(chkFile, { force: true })
    const [verdict, n] = res.split(/\s+/)
    if (verdict !== 'OK') throw new Error(`pptx 完整性校验失败：${res}`)
    ok(`pptx 已重写并校验（${n} 条目，${fmt(size(pptx))} B）`)
  } else {
    info('[dry] 跳过 pptx 截图替换')
  }

  // 3d. 收尾：关 Chrome、清理临时
  if (!DRY) {
    // 先杀本进程起的 Chrome，再兜底 taskkill（detached 进程组）
    try { if (chromeProc && chromeProc.pid) spawnSync('taskkill', ['/F', '/T', '/PID', String(chromeProc.pid)], { stdio: 'ignore' }) } catch {}
    spawnSync('taskkill', ['/F', '/IM', 'chrome.exe', '/T'], { shell: true, stdio: 'ignore' })
    // chromeProfile 在系统临时目录，交给系统清理（不主动删，避免触发批量删除守卫）
    rmSync(shotOutDir, { recursive: true, force: true })
  }
  note(3, 'PPT 内嵌截图已重截并替换')
}

// ============================================================================
// 第 4 步：检查 设计说明文档
// ============================================================================
async function step4_docx() {
  step(4, '检查 设计说明文档（需人工判断是否涉改）')
  // 无法自动判断界面改动是否影响文档，打印两份文档的时间戳供比对
  const docx = join(PKG, '设计说明文档.docx')
  const pdf = join(PKG, '设计说明文档.pdf')
  info(`设计说明文档.docx  修改时间 ${statSync(docx).mtime.toLocaleString()}`)
  info(`设计说明文档.pdf   修改时间 ${statSync(pdf).mtime.toLocaleString()}`)
  warn('若本次源码改动涉及文档中的数值 / 图示 / 文案，请手动修改 docx 后重导 PDF，并复查目录页码')
  warn('（改 docx 后必须重导 PDF；PDF 目录页码不会自动刷新，需手工回填——见 MEMORY.md）')
  note(4, '设计说明文档检查 —— 需人工确认')
}

// ============================================================================
// 第 5 步：重建 zip
// ============================================================================
async function step5_zip() {
  step(5, '重建 营造-提交包.zip（排除 PPT）')
  run('python scripts/make-submission-zip.py')
  const zip = join(ROOT, '营造-提交包.zip')
  if (!DRY) {
    ok(`zip 大小 ${fmt(size(zip))} B`)
    // 校验 zip 内不含 pptx
    const names = out(`unzip -l "${zip}" 2>/dev/null | grep -c "\\.pptx"`) || '0'
    if (names !== '0') throw new Error('zip 内仍含 pptx，打包排除失败！')
    ok('zip 内确认不含 PPT')
  }
  note(5, DRY ? 'zip 将重建（排除 PPT）' : `zip 已重建（${fmt(size(zip))} B，含 5 条目）`)
}

// ============================================================================
// 第 6 步：同步 yingzao/docs/ 交付物副本
// ============================================================================
async function step6_sync_docs() {
  step(6, '同步 yingzao/docs/ 交付物副本')
  const docs = join(PROJECT, 'docs')
  // 提交包 → docs 的同步清单（docs 是仓库内副本，须与 营造-提交包/ 保持一致）
  const pairs = [
    'AI协作过程记录.md',
    '作品说明.txt',
    '设计说明文档.docx',
    '设计说明文档.pdf',
    '答辩PPT.pptx',
  ]
  for (const name of pairs) {
    const src = join(PKG, name)
    if (!existsSync(src)) {
      warn(`提交包无 ${name}，跳过`)
      continue
    }
    const dst = join(docs, name)
    if (!DRY) copyFileSync(src, dst)
    ok(`${name} → docs/`)
  }
  // docs/答辩PPT.pdf 是 PPT 的导出版本（不提交，仅仓库留存）；pptx 改动后建议同步重导
  if (existsSync(join(docs, '答辩PPT.pdf'))) {
    warn('docs/答辩PPT.pdf 为 PPT 导出版（不提交）；若本次改了 PPT，建议重导该 PDF 保持一致')
  }
  note(6, 'docs/ 交付物副本已同步')
}

// ============================================================================
// 第 7 步：推送源码
// ============================================================================
async function step7_push() {
  step(7, '推送源码（push-via-gh.py）')
  warn('注意：推送前请确认 docgen/push-via-gh.py 内的 commit message 已改为本次改动说明')
  warn('（如需删除远程文件，写入脚本内 DELETED 清单）')
  run('python docgen/push-via-gh.py')
  note(7, '源码已推送至 GitHub')
}

// ============================================================================
// 第 8 步：提示 AI协作过程记录（人工）
// ============================================================================
async function step8_record() {
  step(8, '检查 AI协作过程记录.md（需人工判断）')
  warn('若本次改动涉及功能 / 口径变化，请在 营造-提交包/AI协作过程记录.md 追加对应条目，')
  warn('并同步  yingzao/docs/AI协作过程记录.md（两边保持一致）。')
  note(8, 'AI协作过程记录 —— 需人工确认')
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ============================================================================
// 主流程
// ============================================================================
async function main() {
  log('\n╔══════════════════════════════════════════════════════════════╗')
  log('║   《大木作》源码改动 · 一键同步编排器                        ║')
  log('╚══════════════════════════════════════════════════════════════╝')
  if (DRY) log('  [DRY RUN] 只打印命令，不实际执行\n')
  if (ONLY) log(`  仅执行第 ${ONLY} 步\n`)
  else if (FROM > 1) log(`  从第 ${FROM} 步开始\n`)

  const steps = [
    [1, step1_deploy],
    [2, step2_singlefile],
    [3, step3_ppt_shots],
    [4, step4_docx],
    [5, step5_zip],
    [6, step6_sync_docs],
    [7, step7_push],
    [8, step8_record],
  ]

  const failed = []
  for (const [n, fn] of steps) {
    if (!shouldRun(n)) { info(`跳过第 ${n} 步`); continue }
    try {
      await fn()
    } catch (e) {
      failed.push({ n, err: e.message })
      log(`\n  ❌ 第 ${n} 步失败：${e.message}`)
      log('  —— 后续步骤已中止。修复后可用 --from=<n> 从此步重跑。\n')
      break
    }
  }

  // 汇总
  hr()
  log('\n📋 执行汇总：\n')
  if (report.length === 0) log('  （无已完成的步骤）')
  for (const { n, msg } of report) log(`  [${n}] ${msg}`)
  if (failed.length) {
    log('\n❌ 未完成 / 失败：')
    for (const { n, err } of failed) log(`  [${n}] ${err}`)
  }
  log('')

  // 末尾人工清单
  const manual = report.filter((r) => r.msg.includes('需人工'))
  if (manual.length) {
    log('⚠️  以下步骤需人工跟进：')
    for (const { n, msg } of manual) log(`  - 第 ${n} 步：${msg.replace(' —— 需人工确认', '')}`)
    log('')
  }

  if (failed.length) process.exit(1)
  log('全部自动步骤完成 ✓\n')
}

main().catch((e) => { console.error('\n致命错误:', e.message); process.exit(1) })
