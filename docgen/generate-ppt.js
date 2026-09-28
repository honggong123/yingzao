// 《营造》答辩 PPT 生成 —— pptxgenjs
// 主题：墨金深色（与作品 UI 一致：BG #15110D / 金 #D9A441 / 朱 #B8503A）
// 画布：LAYOUT_WIDE 13.33 × 7.5"
const pptxgen = require("pptxgenjs");
const fs = require("fs");
const { imageSize } = require("image-size");

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.author = "《营造》团队";
pres.title = "《营造》— 宋《营造法式》斗栱榫卯数字营造系统";

// ── 调色板（与作品 UI 一致） ──
const BG = "15110D";
const SURF = "1F1913";
const SURF2 = "2A221A";
const TEXT = "ECE4D4";
const MUTED = "9C8F7A";
const ACCENT = "D9A441";
const CINNABAR = "B8503A";
const LINE = "3A3129";

const W = 13.33, H = 7.5, M = 0.6;
const FONT = "微软雅黑";
const SERIF = "宋体";

// 工厂：避免 pptxgenjs 就地修改共享对象
const bu = () => ({ code: "2022", indent: 14 });
const cardShadow = () => ({ type: "outer", color: "000000", blur: 10, offset: 3, angle: 45, opacity: 0.35 });

const IMG = (n) => `images/${n}`;
function imgBox(name, x, y, w) {
  const buf = fs.readFileSync(IMG(name));
  const d = imageSize(buf);
  const h = (w * d.height) / d.width;
  return { data: "image/png;base64," + buf.toString("base64"), x, y, w, h };
}

// ── 通用组件 ──
function darkSlide() {
  const s = pres.addSlide();
  s.background = { color: BG };
  return s;
}
function pageTitle(s, zh, en) {
  s.addText(zh, { x: M, y: 0.42, w: W - 2 * M - 3, h: 0.7, margin: 0, fontSize: 30, bold: true, color: TEXT, fontFace: FONT });
  if (en) s.addText(en, { x: M, y: 1.06, w: W - 2 * M - 3, h: 0.35, margin: 0, fontSize: 12, color: MUTED, fontFace: FONT, charSpacing: 3 });
  // 页码（右下）
  s.addText(String(s._slideNum || ""), { x: W - M - 1.2, y: H - 0.62, w: 1.2, h: 0.3, margin: 0, fontSize: 11, color: LINE, align: "right", fontFace: FONT });
}
function sourceLine(s, text) {
  s.addText(text, { x: M, y: H - 0.62, w: W - 2 * M - 1.5, h: 0.3, margin: 0, fontSize: 11, color: MUTED, fontFace: FONT });
}
function card(s, x, y, w, h, fill = SURF) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: LINE, width: 1 }, rectRadius: 0.06, shadow: cardShadow() });
}

/* ═══ 1. 封面 ═══ */
{
  const s = darkSlide();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 0.09, fill: { color: ACCENT }, line: { width: 0 } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: H - 0.09, w: W, h: 0.09, fill: { color: ACCENT }, line: { width: 0 } });
  // 朱印
  s.addShape(pres.shapes.RECTANGLE, { x: M + 0.1, y: 1.35, w: 1.0, h: 1.0, fill: { color: BG }, line: { color: CINNABAR, width: 2.5 } });
  s.addText("營造", { x: M + 0.1, y: 1.35, w: 1.0, h: 1.0, margin: 0, fontSize: 26, bold: true, color: CINNABAR, align: "center", valign: "middle", fontFace: SERIF });
  s.addText("YINGZAO", { x: M + 1.35, y: 1.42, w: 6, h: 0.4, margin: 0, fontSize: 13, color: ACCENT, fontFace: FONT, charSpacing: 8 });
  s.addText("《营造》", { x: M, y: 2.25, w: 10, h: 1.3, margin: 0, fontSize: 66, bold: true, color: TEXT, fontFace: SERIF });
  s.addText("宋《营造法式》斗栱榫卯数字营造系统", { x: M, y: 3.6, w: 11, h: 0.6, margin: 0, fontSize: 24, color: ACCENT, fontFace: FONT });
  s.addText("可拆 · 可拼 · 可改 · 可造 —— 让用户亲手参与非遗，而不只是观看", { x: M, y: 4.25, w: 11, h: 0.5, margin: 0, fontSize: 16, color: MUTED, fontFace: FONT });
  s.addText("全国大学生数字媒体科技作品及创意竞赛 · AIGC 类数字创意作品创作专项赛道", { x: M, y: 5.55, w: 11, h: 0.4, margin: 0, fontSize: 14, color: TEXT, fontFace: FONT });
  s.addText("参赛团队：【团队名称】    指导教师：【指导教师姓名】    2026 年 9 月", { x: M, y: 6.05, w: 11, h: 0.4, margin: 0, fontSize: 14, color: MUTED, fontFace: FONT });
  s.addNotes("开场：一句话说清作品——把宋《营造法式》的斗栱做成可拆可拼可改可造的数字系统。停留 10 秒展示标题与副题。");
}

/* ═══ 2. 立意 ═══ */
{
  const s = darkSlide();
  pageTitle(s, "为什么做《营造》", "WHY YINGZAO");
  s.addText("斗栱是中国木构建筑的核心智慧，但公众认知正在断层——",
    { x: M, y: 1.55, w: W - 2 * M, h: 0.5, margin: 0, fontSize: 22, color: TEXT, fontFace: FONT });
  const points = [
    ["术语艰深", "材分制、铺作、卷杀……专业门槛把大众挡在门外"],
    ["实物难近", "斗栱高悬檐下，博物馆里也只能仰观，更无法上手"],
    ["原理不可见", "「斗栱抗震」写在展板上只是一句话，看不见、摸不着"],
  ];
  points.forEach(([t, d], i) => {
    const x = M + i * ((W - 2 * M - 0.8) / 3 + 0.4);
    const w = (W - 2 * M - 0.8) / 3;
    card(s, x, 2.3, w, 1.9);
    s.addText(t, { x: x + 0.3, y: 2.5, w: w - 0.6, h: 0.5, margin: 0, fontSize: 22, bold: true, color: CINNABAR, fontFace: FONT });
    s.addText(d, { x: x + 0.3, y: 3.05, w: w - 0.6, h: 1.0, margin: 0, fontSize: 14, color: MUTED, fontFace: FONT, lineSpacing: 22 });
  });
  s.addText([
    { text: "《营造》的回答：", options: { color: ACCENT, bold: true, breakLine: false } },
    { text: "把形制规则变成算法，让每个人都能亲手把一朵斗栱拼回去。", options: { color: TEXT, breakLine: false } },
  ], { x: M, y: 4.6, w: W - 2 * M, h: 0.6, margin: 0, fontSize: 24, fontFace: FONT });
  s.addText("对非遗最好的保护不是封存，而是让每一个人都能亲手参与。",
    { x: M, y: 5.35, w: W - 2 * M, h: 0.5, margin: 0, fontSize: 16, color: MUTED, italic: true, fontFace: SERIF });
  s.addNotes("三个痛点一页带过，重点落在最后一句定位。停顿让评委读完整句话。");
}

/* ═══ 3. 作品全景（流程图） ═══ */
{
  const s = darkSlide();
  pageTitle(s, "作品全景 · 六大展区", "SIX MODULES");
  s.addText("围绕「认 → 拼 → 改 → 造」的递进闭环组织", { x: M, y: 1.5, w: W - 2 * M, h: 0.4, margin: 0, fontSize: 16, color: MUTED, fontFace: FONT });
  const steps = [
    ["认", "营造学堂", "点击构件读考据\n每个数字有出处"],
    ["拼", "拼装挑战", "按铺作次序拼装\n错序会晃动"],
    ["改", "参数工坊", "材分八等实时重构\n换算真实尺寸"],
    ["造", "营造之旅", "17 秒大殿落成\n日暮全景"],
  ];
  const bw = (W - 2 * M - 3 * 0.42) / 4;
  steps.forEach(([k, t, d], i) => {
    const x = M + i * (bw + 0.42);
    card(s, x, 2.2, bw, 2.5);
    s.addText(k, { x: x + 0.25, y: 2.35, w: 1.2, h: 0.8, margin: 0, fontSize: 40, bold: true, color: ACCENT, fontFace: SERIF });
    s.addText(t, { x: x + 0.25, y: 3.15, w: bw - 0.5, h: 0.45, margin: 0, fontSize: 20, bold: true, color: TEXT, fontFace: FONT });
    s.addText(d, { x: x + 0.25, y: 3.65, w: bw - 0.5, h: 0.9, margin: 0, fontSize: 13, color: MUTED, fontFace: FONT, lineSpacing: 20 });
    if (i < 3) s.addText("▸", { x: x + bw + 0.05, y: 3.2, w: 0.35, h: 0.5, margin: 0, fontSize: 22, color: ACCENT, align: "center", fontFace: FONT });
  });
  // 两个辅助展区
  ["榫卯谱 · 六种经典榫卯开合演示", "斗栱抗震 · 振动台物理对比实验"].forEach((t, i) => {
    const w2 = (W - 2 * M - 0.5) / 2;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M + i * (w2 + 0.5), y: 5.15, w: w2, h: 0.85, fill: { color: SURF2 }, line: { color: LINE, width: 1 }, rectRadius: 0.06 });
    s.addText(t, { x: M + i * (w2 + 0.5) + 0.35, y: 5.15, w: w2 - 0.7, h: 0.85, margin: 0, fontSize: 16, color: TEXT, valign: "middle", fontFace: FONT });
  });
  s.addNotes("这一页给评委建立全貌。四个主展区是递进关系，两个辅助展区（榫卯、抗震）补充深度。");
}

/* ═══ 4. 营造学堂 ═══ */
{
  const s = darkSlide();
  pageTitle(s, "营造学堂 · 让每个数字都有出处", "ACADEMY");
  const im = imgBox("02-school.png", M, 1.75, 7.4);
  s.addImage({ data: im.data, x: im.x, y: im.y, w: im.w, h: im.h });
  s.addText("▲ 四铺作柱头铺作（材分制算法实时生成）", { x: M, y: im.y + im.h + 0.08, w: 7.4, h: 0.3, margin: 0, fontSize: 11, color: MUTED, fontFace: FONT });
  const rx = M + 7.7, rw = W - M - rx;
  s.addText("考据化交互", { x: rx, y: 1.85, w: rw, h: 0.45, margin: 0, fontSize: 22, bold: true, color: ACCENT, fontFace: FONT });
  s.addText([
    { text: "点击任意构件，读它的形制尺寸与文献出处——", options: { breakLine: true } },
    { text: "界面里出现的每一个数字，都能回答「出处是哪一卷」。", options: { breakLine: true } },
  ], { x: rx, y: 2.35, w: rw, h: 1.1, margin: 0, fontSize: 15, color: TEXT, fontFace: FONT, lineSpacing: 26 });
  const data = [
    ["材广 × 厚", "15 × 10 分"],
    ["足材（材 + 栔）", "21 分"],
    ["每跳出跳", "30 分"],
    ["栌斗", "32 × 32 × 20 分"],
  ];
  data.forEach(([k, v], i) => {
    s.addText(k, { x: rx, y: 3.6 + i * 0.52, w: 1.9, h: 0.45, margin: 0, fontSize: 13, color: MUTED, fontFace: FONT });
    s.addText(v, { x: rx + 1.9, y: 3.6 + i * 0.52, w: rw - 1.9, h: 0.45, margin: 0, fontSize: 15, bold: true, color: ACCENT, fontFace: FONT });
  });
  sourceLine(s, "Source: 《营造法式》卷四·大木作制度（造枓之制 / 造栱之制），对照 ctext.org 与钦定四库全书本核验");
  s.addNotes("现场必演：点一处构件展示考据卡。回答追问时强调——考据过程纠正过两处初期误引（散斗/齐心斗高度），纠错痕迹留在 AIGC 记录里。");
}

/* ═══ 5. 拼装挑战 ═══ */
{
  const s = darkSlide();
  pageTitle(s, "拼装挑战 · 把非遗变成可玩的工序", "ASSEMBLY");
  const im = imgBox("03-school-6p.png", M, 1.9, 6.6);
  s.addImage({ data: im.data, x: im.x, y: im.y, w: im.w, h: im.h });
  s.addText("▲ 六铺作重栱造 · 爆炸视图（拆解滑杆 100%）", { x: M, y: im.y + im.h + 0.08, w: 6.6, h: 0.3, margin: 0, fontSize: 11, color: MUTED, fontFace: FONT });
  const rx = M + 6.9, rw = W - M - rx;
  s.addText("玩法即知识", { x: rx, y: 1.9, w: rw, h: 0.45, margin: 0, fontSize: 22, bold: true, color: ACCENT, fontFace: FONT });
  s.addText([
    { text: "整朵铺作按《营造法式》铺作次序拆散——", options: { bullet: bu(), breakLine: true } },
    { text: "从构件盘选出下一件，选对飞回原位、木质「咔哒」声；", options: { bullet: bu(), breakLine: true } },
    { text: "选错会晃动并计入错误，落成后评定甲 / 乙 / 丙；", options: { bullet: bu(), breakLine: true } },
    { text: "登录后成绩自动存档，可挑战更复杂铺作。", options: { bullet: bu(), breakLine: true } },
  ], { x: rx, y: 2.45, w: rw, h: 2.6, margin: 0, fontSize: 15, color: TEXT, fontFace: FONT, paraSpaceAfter: 12 });
  card(s, rx, 5.3, rw, 1.15, SURF2);
  s.addText("新手教学：单卡引导 + 下一件构件的角色解释，零基础可通关。",
    { x: rx + 0.3, y: 5.3, w: rw - 0.6, h: 1.15, margin: 0, fontSize: 14, color: TEXT, valign: "middle", fontFace: FONT });
  s.addNotes("现场演示拼三件即可——开新手教学保证不卡壳。强调：这是按真实工序设计的玩法，不是点击播放。");
}

/* ═══ 6. 参数工坊 ═══ */
{
  const s = darkSlide();
  pageTitle(s, "参数工坊 · 800 年前的参数化引擎", "WORKSHOP");
  const im = imgBox("04-workshop.png", W / 2 + 0.15, 1.75, 5.9);
  s.addImage({ data: im.data, x: im.x, y: im.y, w: im.w, h: im.h });
  s.addText("▲ 一等材六铺作重栱（通高换算约 410 cm）", { x: im.x, y: im.y + im.h + 0.08, w: 5.9, h: 0.3, margin: 0, fontSize: 11, color: MUTED, fontFace: FONT });
  const lw = 5.6;
  s.addText("「凡构屋之制，皆以材为祖」", { x: M, y: 1.8, w: lw, h: 0.5, margin: 0, fontSize: 22, bold: true, color: ACCENT, fontFace: SERIF });
  s.addText("材有八等，度屋之大小，因而用之——拖动材等滑杆，同一朵铺作按材等比例缩放，并实时换算真实尺寸（宋尺一尺约 31.2 厘米）。",
    { x: M, y: 2.4, w: lw, h: 1.3, margin: 0, fontSize: 15, color: TEXT, fontFace: FONT, lineSpacing: 26 });
  // 材分八等简表
  const rows = [
    ["等", "材广×厚（寸）", "用途"],
    ["一", "9.0 × 6.0", "殿身 9–11 间"],
    ["三", "7.5 × 5.0", "殿身 3–5 间"],
    ["五", "6.6 × 4.4", "厅堂 3 间"],
    ["八", "4.5 × 3.0", "亭榭 · 藻井"],
  ];
  s.addTable(rows, {
    x: M, y: 3.95, w: lw, colW: [0.7, 2.2, 2.7],
    border: { pt: 0.5, color: LINE },
    fill: { color: SURF },
    fontFace: FONT, fontSize: 13, color: TEXT,
    align: "center", valign: "middle", rowH: 0.42,
  });
  sourceLine(s, "Source: 《营造法式》卷四·材分八等；换算按宋尺 1 尺 ≈ 31.2 cm（教学示意）");
  s.addNotes("这一页是「模拟→数字」的桥梁：证明古人的材分制就是参数化设计。现场拖滑杆从三等切到一等，视觉冲击明显。");
}

/* ═══ 7. 榫卯谱 ═══ */
{
  const s = darkSlide();
  pageTitle(s, "榫卯谱 · 不用一钉一铆", "JOINERY");
  const im = imgBox("05-baojian.png", M, 1.9, 6.2);
  s.addImage({ data: im.data, x: im.x, y: im.y, w: im.w, h: im.h });
  s.addText("▲ 抱肩榫：两枋弧口相抱，圆柱落入（开合演示中）", { x: M, y: im.y + im.h + 0.08, w: 6.2, h: 0.3, margin: 0, fontSize: 11, color: MUTED, fontFace: FONT });
  const rx = M + 6.5, rw = W - M - rx;
  s.addText("六种经典榫卯", { x: rx, y: 1.9, w: rw, h: 0.45, margin: 0, fontSize: 22, bold: true, color: ACCENT, fontFace: FONT });
  const joints = [
    ["燕尾榫", "头大颈小，越拉越紧"],
    ["格肩榫", "45° 斜肩藏住交口"],
    ["抱肩榫", "弧口相抱圆材"],
    ["粽角榫", "三材各让一半，交于一点"],
    ["走马销", "推到底自动锁死的活榫"],
    ["楔钉榫", "弧材互搭 + 楔销锁定"],
  ];
  joints.forEach(([n, d], i) => {
    const y = 2.5 + i * 0.62;
    s.addText(n, { x: rx, y, w: 1.5, h: 0.5, margin: 0, fontSize: 15, bold: true, color: TEXT, fontFace: FONT });
    s.addText(d, { x: rx + 1.5, y, w: rw - 1.5, h: 0.5, margin: 0, fontSize: 13, color: MUTED, fontFace: FONT });
  });
  s.addNotes("榫卯谱时间不够可略讲，一句话带过：六种榫卯的参数化模型，可开合观察咬合。楔钉榫是两步工序（先合体再上销）。");
}

/* ═══ 8. 斗栱抗震（重点页） ═══ */
{
  const s = darkSlide();
  pageTitle(s, "斗栱抗震 · 让结构原理可被亲手验证", "SEISMIC DEMO");
  const im = imgBox("06-quake.png", W / 2 - 0.05, 1.7, 6.1);
  s.addImage({ data: im.data, x: im.x, y: im.y, w: im.w, h: im.h });
  s.addText("▲ 振动台 + 位移示波器（实测中震 16 分 / 2Hz）", { x: im.x, y: im.y + im.h + 0.08, w: 6.1, h: 0.3, margin: 0, fontSize: 11, color: MUTED, fontFace: FONT });
  const lx = M, lw = W / 2 - 0.75;
  s.addText("同一场地震，两种连接：", { x: lx, y: 1.75, w: lw, h: 0.4, margin: 0, fontSize: 17, color: TEXT, fontFace: FONT });
  // 大数字对比
  s.addText("0.33×", { x: lx, y: 2.2, w: lw, h: 0.95, margin: 0, fontSize: 54, bold: true, color: ACCENT, fontFace: FONT });
  s.addText("斗栱连接 · 屋面响应衰减至地面 1/3（减震 68%）", { x: lx, y: 3.12, w: lw, h: 0.4, margin: 0, fontSize: 14, color: MUTED, fontFace: FONT });
  s.addText("1.31×", { x: lx, y: 3.62, w: lw, h: 0.95, margin: 0, fontSize: 54, bold: true, color: CINNABAR, fontFace: FONT });
  s.addText("刚性连接 · 屋面响应被放大（接近共振）", { x: lx, y: 4.54, w: lw, h: 0.4, margin: 0, fontSize: 14, color: MUTED, fontFace: FONT });
  card(s, lx, 5.15, lw, 1.35, SURF2);
  s.addText("物理模型：单自由度受迫振动逐帧积分；斗栱取低自振频率 + 高阻尼（榫卯摩擦耗能），刚性取高频率 + 低阻尼。教学示意模拟，非工程仿真。",
    { x: lx + 0.3, y: 5.15, w: lw - 0.6, h: 1.35, margin: 0, fontSize: 12, color: MUTED, valign: "middle", fontFace: FONT, lineSpacing: 18 });
  sourceLine(s, "数据来源：作品内置模型实测（振幅 16 分、频率 2Hz、采样 5 秒）；呼应案例：应县木塔、晋祠圣母殿");
  s.addNotes("全场最强记忆点。建议流程：先切「刚性连接」开大震让屋面狂甩，再切「斗栱连接」——示波器亮线明显收敛，减震 68% 大字读数。停两秒让评委看清。");
}

/* ═══ 9. 营造之旅 ═══ */
{
  const s = darkSlide();
  pageTitle(s, "营造之旅 · 17 秒，一座大殿的诞生", "THE JOURNEY");
  const im = imgBox("07-palace-eave.png", M, 1.7, 6.0);
  s.addImage({ data: im.data, x: im.x, y: im.y, w: im.w, h: im.h });
  s.addText("▲ 檐下成排铺作层层出跳", { x: M, y: im.y + im.h + 0.04, w: 6.0, h: 0.28, margin: 0, fontSize: 11, color: MUTED, fontFace: FONT });
  const im2 = imgBox("08-palace-dusk.png", M, 5.42, 2.7);
  s.addImage({ data: im2.data, x: im2.x, y: im2.y, w: im2.w, h: im2.h });
  const rx = M + 7.5, rw = W - M - rx;
  s.addText("程序化大殿", { x: rx, y: 1.85, w: rw, h: 0.45, margin: 0, fontSize: 22, bold: true, color: ACCENT, fontFace: FONT });
  s.addText([
    { text: "筑台基 → 立柱架阑额 → 施铺作 → 举折成顶 → 日暮", options: { bullet: bu(), breakLine: true } },
    { text: "殿上 18 朵铺作、屋架、瓦垄全部算法生成", options: { bullet: bu(), breakLine: true } },
    { text: "屋顶按「举高 = 跨 1/3、自上而下渐缓」的举折法则生成", options: { bullet: bu(), breakLine: true } },
    { text: "点击画面即可暂停游走、自由环视", options: { bullet: bu(), breakLine: true } },
  ], { x: rx, y: 2.45, w: rw, h: 2.6, margin: 0, fontSize: 14, color: TEXT, fontFace: FONT, paraSpaceAfter: 12 });
  card(s, rx, 5.35, rw, 1.1, SURF2);
  s.addText("日暮灯光随轴线推移：主光转橙红西沉，天幕与雾色渐变——终章收在「不用一钉一铆」。",
    { x: rx + 0.3, y: 5.35, w: rw - 0.6, h: 1.1, margin: 0, fontSize: 13, color: TEXT, valign: "middle", fontFace: FONT });
  s.addNotes("终章留 17 秒不干预，让镜头走完。收尾字幕「不用一钉一铆」出现时停顿，再切回总结。");
}

/* ═══ 10. 技术架构 ═══ */
{
  const s = darkSlide();
  pageTitle(s, "技术方案 · 从形制数据到可交互场景", "TECHNICAL");
  const layers = [
    ["形制数据层", "材分八等 / 构件尺寸 / 铺作次序 —— 每项标注文献卷次", ACCENT],
    ["构件生成层", "斗（U 形截面）/ 栱（卷杀轮廓）/ 榫卯（分件装配）—— 零外部模型", ACCENT],
    ["装配与场景层", "铺作参数化生成 / 大殿程序化 / 抗震单自由度物理模型", ACCENT],
    ["交互与资产层", "Vue 3 + Three.js + GSAP + Web Audio；木纹瓦垄音效全程序化", ACCENT],
  ];
  layers.forEach(([t, d], i) => {
    const y = 1.7 + i * 1.02;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y, w: 7.3, h: 0.86, fill: { color: SURF }, line: { color: LINE, width: 1 }, rectRadius: 0.06 });
    s.addText(t, { x: M + 0.3, y, w: 1.9, h: 0.86, margin: 0, fontSize: 16, bold: true, color: ACCENT, valign: "middle", fontFace: FONT });
    s.addText(d, { x: M + 2.25, y, w: 4.9, h: 0.86, margin: 0, fontSize: 13, color: TEXT, valign: "middle", fontFace: FONT });
  });
  const rx = M + 7.7, rw = W - M - rx;
  s.addText("性能分包", { x: rx, y: 1.7, w: rw, h: 0.45, margin: 0, fontSize: 20, bold: true, color: TEXT, fontFace: FONT });
  const rows = [
    ["分包", "体积", "时机"],
    ["主包 + 登录门", "42.75 KB", "立即"],
    ["three.js", "498.72 KB", "登录后"],
    ["Viewer3D", "38.15 KB", "登录后"],
  ];
  s.addTable(rows, {
    x: rx, y: 2.3, w: rw, colW: [rw * 0.42, rw * 0.32, rw * 0.26],
    border: { pt: 0.5, color: LINE }, fill: { color: SURF },
    fontFace: FONT, fontSize: 12, color: TEXT, align: "center", valign: "middle", rowH: 0.42,
  });
  s.addText("gzip 后主包仅 19.66 KB；首屏零图片请求（纹理全部运行时生成）；移动端自动降档。",
    { x: rx, y: 4.05, w: rw, h: 1.1, margin: 0, fontSize: 13, color: MUTED, fontFace: FONT, lineSpacing: 22 });
  sourceLine(s, "数据来源：vite build 产物实测（2026-09）");
  s.addNotes("技术页控制在一分钟内。重点两句：①构件几何全部代码生成、零外部素材；②主包 42KB，登录后按需加载三维库。");
}

/* ═══ 11. AIGC + 收尾 ═══ */
{
  const s = darkSlide();
  pageTitle(s, "AIGC 参与说明 · 人机分工", "AIGC COLLABORATION");
  const cols = [
    ["人（不可替代）", ["选题立意与赛道决策", "形制审校与最终把关", "团队事务与现场答辩", "价值判断与表达取舍"], CINNABAR],
    ["AI（深度参与）", ["代码实现与算法构建", "文献检索与考据核验", "文档起草与数据整理", "测试验证与问题定位"], ACCENT],
  ];
  cols.forEach(([t, items, color], i) => {
    const x = M + i * ((W - 2 * M - 0.6) / 2 + 0.6);
    const w = (W - 2 * M - 0.6) / 2;
    card(s, x, 1.7, w, 2.75);
    s.addText(t, { x: x + 0.35, y: 1.9, w: w - 0.7, h: 0.5, margin: 0, fontSize: 20, bold: true, color, fontFace: FONT });
    items.forEach((it, j) => {
      s.addText(it, { x: x + 0.35, y: 2.55 + j * 0.45, w: w - 0.7, h: 0.45, margin: 0, fontSize: 15, color: TEXT, fontFace: FONT, bullet: bu() });
    });
  });
  card(s, M, 4.75, W - 2 * M, 1.05, SURF2);
  s.addText("过程全程留痕：《AIGC 创作过程记录》逐日保存技术决策、考据来源、版本演进与问题修复——可现场调阅。",
    { x: M + 0.4, y: 4.75, w: W - 2 * M - 0.8, h: 1.05, margin: 0, fontSize: 14, color: TEXT, valign: "middle", fontFace: FONT });
  s.addText([
    { text: "「以材为祖。」", options: { color: ACCENT, breakLine: true } },
    { text: "八百年前的匠人用一套模数编织整座殿宇，今天的我们用同样的思想驱动算法。", options: { color: TEXT, breakLine: true } },
  ], { x: M, y: 6.0, w: W - 2 * M, h: 0.75, margin: 0, fontSize: 17, fontFace: SERIF });
  s.addNotes("收尾：人机分工如实说明，强调过程留痕可核验。最后一句金句放慢语速，作为全场结束。");
}

pres.writeFile({ fileName: "答辩PPT.pptx" }).then(() => console.log("OK 答辩PPT.pptx"));
