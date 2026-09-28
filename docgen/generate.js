// 《营造》设计说明文档生成 —— docx-js
// 封面：R2 Double-Rule Frame + IG-1 Ink Gold（匹配作品"墨金"视觉）
// 结构：封面（无页码）→ 前置（摘要+目录，罗马页码）→ 正文（阿拉伯页码从 1 起）
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  SectionType, TableOfContents, TableLayoutType,
} = require("docx");
const fs = require("fs");
const { imageSize: sizeOf } = require("image-size");

// ── 调色板：IG-1 Ink Gold（墨金）──
const P = {
  bg: "1A1A1A", accent: "C9A84C",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  body: "000000",
  table: { headerBg: "EFEAE0", headerText: "1A1A1A", accentLine: "C9A84C", innerLine: "DDD6C8" },
};

const NB = { style: BorderStyle.NONE, size: 0, color: "auto" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ── 封面标题布局助手（design-system 强制） ──
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..."，。、；：！？", ..."的与和及之在于为", ..."-_—–·/", ..." \t"]);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) {
      breakAt = charsPerLine;
      const prevChar = remaining[breakAt - 1], nextChar = remaining[breakAt];
      if (prevChar && nextChar && !breakAfter.has(prevChar) && !breakAfter.has(nextChar) &&
          /[\u4e00-\u9fff]/.test(prevChar) && /[\u4e00-\u9fff]/.test(nextChar)) breakAt -= 1;
    }
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += last;
  }
  return lines;
}

function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 20;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt;
  let lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    lines = splitTitleLines(title, charsPerLine(minPt));
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

// ── 封面 R2：Double-Rule Frame（居中，墨底金线） ──
function buildCoverR2(config) {
  const padL = 1400, padR = 1400;
  const { titlePt, titleLines } = calcTitleLayout(config.title, 11906 - padL - padR, 40, 24);
  const titleSize = titlePt * 2;
  const thickBorder = { style: BorderStyle.SINGLE, size: 18, color: P.accent, space: 20 };
  const children = [];

  children.push(new Paragraph({
    indent: { left: padL - 400, right: padR - 400 }, spacing: { before: 1200, after: 200 },
    border: { top: thickBorder }, children: [],
  }));
  children.push(new Paragraph({ spacing: { before: 1800 } }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 500 },
    children: [new TextRun({ text: config.englishLabel.split("").join("  "),
      size: 18, color: P.accent, font: { ascii: "Calibri" }, characterSpacing: 40 })],
  }));
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: i < titleLines.length - 1 ? 80 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true,
        color: P.cover.titleColor, font: { eastAsia: "SimHei", ascii: "Arial" } })],
    }));
  }
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 400, line: Math.ceil(15 * 23), lineRule: "atLeast" },
    children: [new TextRun({ text: config.subtitle, size: 24, color: P.cover.subtitleColor,
      font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
  }));
  children.push(new Paragraph({ spacing: { before: 1200 } }));
  for (const line of config.metaLines) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100, line: Math.ceil(18 * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: line, size: 36, color: P.cover.metaColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: 2000 } }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    indent: { left: padL - 400, right: padR - 400 }, spacing: { before: 200 },
    border: { bottom: thickBorder },
    children: [new TextRun({ text: config.footerRight, size: 18, color: P.cover.footerColor, font: { ascii: "Arial" } })],
  }));

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders,
        children,
      })],
    })],
  })];
}

// ── 正文组件 ──
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: "1A1A1A", font: { eastAsia: "SimHei", ascii: "Times New Roman" } })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 140, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, color: "1A1A1A", font: { eastAsia: "SimHei", ascii: "Times New Roman" } })],
  });
}
function body(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 480 },
    spacing: { line: 312, after: opts.after ?? 60 },
    children: [new TextRun({ text, size: 24, color: "000000", font: { eastAsia: "SimSun", ascii: "Times New Roman" } })],
  });
}
function bodyBold(prefix, rest) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 480 },
    spacing: { line: 312, after: 60 },
    children: [
      new TextRun({ text: prefix, bold: true, size: 24, color: "000000", font: { eastAsia: "SimSun", ascii: "Times New Roman" } }),
      new TextRun({ text: rest, size: 24, color: "000000", font: { eastAsia: "SimSun", ascii: "Times New Roman" } }),
    ],
  });
}
function caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 240, line: 312 },
    children: [new TextRun({ text, size: 21, color: "595959", font: { eastAsia: "SimSun", ascii: "Times New Roman" } })],
  });
}
function image(path, displayWidth = 540) {
  const buf = fs.readFileSync(path);
  const dim = sizeOf(buf);
  const displayHeight = Math.round(displayWidth * dim.height / dim.width);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120 },
    children: [new ImageRun({ data: buf, transformation: { width: displayWidth, height: displayHeight }, type: "png" })],
  });
}
function tableTitle(text) {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 200, after: 100, line: 312 },
    children: [new TextRun({ text, bold: true, size: 21, color: "1A1A1A", font: { eastAsia: "SimHei", ascii: "Times New Roman" } })],
  });
}
function dataTable(headers, rows, widths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 8, color: P.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: P.table.accentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: P.table.innerLine },
      insideVertical: NB,
    },
    rows: [
      new TableRow({
        tableHeader: true, cantSplit: true,
        children: headers.map((text, i) => new TableCell({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, size: 21, color: P.table.headerText, font: { eastAsia: "SimHei" } })] })],
          shading: { type: ShadingType.CLEAR, fill: P.table.headerBg },
          margins: { top: 70, bottom: 70, left: 120, right: 120 },
          width: { size: widths[i], type: WidthType.PERCENTAGE },
        })),
      }),
      ...rows.map((row) => new TableRow({
        cantSplit: true,
        children: row.map((text, i) => new TableCell({
          children: [new Paragraph({ alignment: i === 0 ? AlignmentType.CENTER : AlignmentType.LEFT, children: [new TextRun({ text: String(text), size: 21, color: "000000", font: { eastAsia: "SimSun" } })] })],
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          width: { size: widths[i], type: WidthType.PERCENTAGE },
        })),
      })),
    ],
  });
}

const pageFooter = () => new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, font: { ascii: "Times New Roman" } })],
  })],
});
const pageHeader = () => new Header({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "C9A84C", space: 4 } },
    children: [new TextRun({ text: "《营造》设计说明文档", size: 16, color: "8A8378", font: { eastAsia: "SimSun" } })],
  })],
});

// ══ 正文内容 ══
const IMG = (n) => `images/${n}`;

const bodyChildren = [
  h1("一、作品概述"),
  h2("1.1 创意背景与立意"),
  body("斗栱与榫卯是中国木构建筑的核心智慧：斗栱以层层出挑承托深远的屋檐，榫卯以不用一钉一铆的咬合连接构件。宋《营造法式》（公元 1103 年刊行）以「材分制」建立了古代世界罕见的标准化模数设计体系——「凡构屋之制，皆以材为祖」。然而今天，这套体系对公众而言正变得越来越陌生：术语艰深、实物难以近距离观察、结构原理更无从体验。"),
  body("《营造》的立意，是把这套体系从「看」变成「做」：将《营造法式》的形制规则转化为可交互的数字生成算法，让用户亲手拆解一朵斗栱、按宋人的工序把它拼回去、改一个参数看整朵铺作重构，最终在虚拟营造之旅中见证一座庑殿大殿拔地而起。我们相信，对非物质文化遗产最好的保护不是封存，而是让每一个人都能亲手参与。"),
  h2("1.2 作品定位与目标用户"),
  body("作品定位为面向大众与文化爱好者的交互式数字文化产品，兼顾科普教育与文化传播双重价值。核心目标用户包括：文化爱好者与古建摄影人群、建筑与历史专业的学生教师，以及在展馆场景中的现场观众。全流程零门槛：无需任何专业知识即可上手，进阶内容（材分制、铺作次序）则供深度用户探究。"),
  h2("1.3 赛道适配"),
  body("本作品报名 AIGC 类数字创意作品创作专项赛道。作品从形制考据、参数化生成算法到全部程序化资产（木纹、瓦垄、音效）均由 AI 深度参与完成，人机分工与创作过程全程留痕（见第五章），符合该赛道「清晰展示 AI 工具与技术使用过程」「说明 AI 参与创作比例」的评审要求。"),

  h1("二、作品结构与功能设计"),
  body("作品为单页 WebGL 交互系统，由六大展区构成，围绕「认——拼——改——造」的递进关系组织：先认识构件（学堂），再亲手拼装（拼装），继而理解参数化本质（工坊），拓展至榫卯体系（榫卯谱），最终见证一座大殿的诞生（营造之旅）。"),
  h2("2.1 营造学堂——构件认知"),
  body("学堂呈现一朵由材分制算法实时生成的柱头铺作（四铺作至八铺作可切换），用户可逐层拆解爆炸视图，点击任意构件查看名称、形制尺寸与《营造法式》文献出处。构件名称标注悬浮于三维空间，随视角自然遮挡。"),
  image(IMG("02-school.png")),
  caption("图 1  营造学堂：铺作全参数化重构（六铺作重栱造）"),
  h2("2.2 拼装挑战——游戏化拼装"),
  body("整朵铺作按《营造法式》铺作次序拆散为构件盘，用户按真实营造工序从候选中选出下一件：选对则构件飞回原位并伴随程序化合成的木质「咔哒」声；选错则晃动并计入错误。完成后按用时与错误数评定甲、乙、丙三等。登录用户的成绩自动存档，可反复挑战更复杂的关卡。"),
  h2("2.3 参数工坊——模数化的可视化"),
  body("材分制是《营造法式》的核心：「材分八等，度屋之大小，因而用之。」工坊提供材等滑杆（一至八等）与出跳数选择，同一朵铺作在八等材下呈现八种体量，并实时换算真实尺寸（按宋尺一尺约 31.2 厘米）——直观揭示八百年前的参数化设计思想。"),
  image(IMG("04-workshop.png")),
  caption("图 2  参数工坊：一等材下的六铺作重栱（通高换算 410 厘米）"),
  h2("2.4 榫卯谱——不用一钉一铆"),
  body("榫卯谱收录燕尾榫、格肩榫、抱肩榫、粽角榫、走马销、楔钉榫六种经典连接方式，每种均以参数化模型呈现，用户拖动开合滑杆即可观察榫头的咬合与锁定过程——楔钉榫更还原了「先合体、再上销」的两步工序。"),
  image(IMG("05-baojian.png")),
  caption("图 3  榫卯谱：抱肩榫（柱与梁枋的弧口相抱）"),
  h2("2.5 营造之旅——程序化大殿"),
  body("营造之旅是作品的终章：镜头自台基起，经立柱架梁、成排铺作，至举折屋顶与日暮全景，17 秒走完一座庑殿大殿的营造次序。殿上 18 朵铺作、屋架与瓦垄全部由算法实时生成，用户可随时暂停并自由环视。"),
  image(IMG("07-palace-eave.png")),
  caption("图 4  营造之旅：檐下成排铺作层层出跳"),
  image(IMG("08-palace-dusk.png")),
  caption("图 5  营造之旅：日暮全景（庑殿顶与举折曲线）"),
  h2("2.6 斗栱抗震——结构科学互动演示"),
  body("斗栱在古建筑中不仅是装饰，更是关键的抗震耗能节点。抗震展区将这一原理变为可操作的物理演示：一座置于振动台上的柱架模型，用户调节地震振幅与频率，并切换「斗栱连接 / 刚性连接」两种屋面连接方式。程序内置单自由度结构响应模型逐帧积分：斗栱连接下屋面位移衰减至地面的三分之一，刚性连接则放大至 1.3 倍——示波器双轨迹实时记录两条位移曲线，减震率大字读数一目了然。"),
  image(IMG("06-quake.png")),
  caption("图 6  斗栱抗震：振动台演示与位移示波器"),
  h2("2.7 系统支撑功能"),
  body("系统内置登录注册体系（演示版本地鉴权，密码经 SHA-256 摘要存储），登录后拼装落成成绩自动存档；六步聚光式新手教程（箭头指向真实界面元素）保障零门槛上手；全部界面适配移动端触控。"),

  h1("三、形制考据与数据基准"),
  body("作品界面中出现的每一个形制数字均可溯源至《营造法式》（卷四·大木作制度一）原文，考据过程对照中国哲学书电子化计划（ctext.org）与钦定四库全书本逐条核验。这一原则贯穿全部展区，也是作品区别于一般古建可视化作品的核心严谨性。"),
  h2("3.1 材分制与八等材"),
  body("《营造法式》规定：「凡构屋之制，皆以材为祖。材有八等，度屋之大小，因而用之。」材广十五分、厚十分，栔广六分厚四分，足材二十一分；华栱每跳出跳三十。作品参数工坊据此实现八等材的实时换算。"),
  tableTitle("表 1  材分八等（《营造法式》卷四）"),
  dataTable(
    ["等级", "材广（寸）", "材厚（寸）", "适用范围"],
    [
      ["一等", "9.0", "6.0", "殿身 9–11 间"],
      ["二等", "8.25", "5.5", "殿身 5–7 间"],
      ["三等", "7.5", "5.0", "殿身 3–5 间、堂 7 间"],
      ["四等", "7.2", "4.8", "殿身 3 间、厅堂 5 间"],
      ["五等", "6.6", "4.4", "殿身 3 间、厅堂 3 间"],
      ["六等", "6.0", "4.0", "亭榭、小殿"],
      ["七等", "5.25", "3.5", "小殿、亭榭"],
      ["八等", "4.5", "3.0", "亭榭、藻井"],
    ],
    [15, 25, 25, 35]
  ),
  h2("3.2 斗与栱的形制尺寸"),
  tableTitle("表 2  主要构件形制（单位：分；摘自卷四「造枓之制」「造栱之制」）"),
  dataTable(
    ["构件", "形制尺寸", "卷杀"],
    [
      ["栌斗", "长 32 × 广 32 × 高 20（耳 8 · 平 4 · 欹 8），开口广 10 深 8", "—"],
      ["交互斗", "长 18 × 广 16 × 高 10", "—"],
      ["齐心斗", "长 16 × 广 16 × 高 10", "—"],
      ["散斗", "长 16 × 广 14 × 高 10", "—"],
      ["华栱", "足材高 21，两卷头者长 72", "每头四瓣，每瓣长四分"],
      ["泥道栱", "单材高 15，长 63", "每头四瓣，每瓣长四分"],
      ["瓜子栱", "单材高 15，长 62", "每头四瓣，每瓣长四分"],
      ["令栱", "单材高 15，长 72", "每头五瓣，每瓣长四分"],
      ["慢栱", "单材高 15，长 92", "每头四瓣，每瓣长三分"],
    ],
    [18, 50, 32]
  ),
  body("铺作次序同样依原文实现：构件入斗口坐于欹顶（栌斗深八分、小斗耳高四分），由此推出单栱计心造每层高四十八分（足材二十一、斗口六、瓜子栱十五、斗口六）、重栱造六十九分、偷心造二十七分——这一层高模型是铺作生成器的核心。"),

  h1("四、技术方案"),
  h2("4.1 总体架构"),
  body("作品采用 Vue 3 + Vite + TypeScript 构建，渲染层基于 Three.js（WebGL 2.0），镜头与时间轴编排使用 GSAP，音频全部由 Web Audio API 程序化合成。工程实施严格的模块分层：形制数据层（kaogu，全部参数标注文献出处）、构件生成层（dou/gong/joints，纯函数式几何生成）、铺作装配层（puzuo，铺作次序算法）、场景层（scene/palace/quake）与界面层（Vue 组件）各司其职。"),
  h2("4.2 铺作生成算法"),
  body("铺作生成器是作品的技术核心：输入材等、跳数（一至五跳）、单栱/重栱造、计心/偷心造等参数，输出完整的构件清单与空间位姿。构件几何全部由「截面轮廓沿轴拉伸」生成——斗为带开口槽的 U 形轮廓，栱为含卷杀阶梯的侧向轮廓，昂与蚂蚱头耍头各有专属轮廓——不依赖任何外部模型文件。层高模型由构件入斗口的坐落规则（坐于欹顶）自动推导：单栱计心造每层四十八分、重栱造六十九分、偷心造二十七分。"),
  h2("4.3 抗震演示的物理模型"),
  body("抗震展区将铺作层简化为一个水平剪切层，屋面为单自由度质量块，其运动满足受迫振动方程：x″ = ωn²(xg − x) + 2ζωn(xg′ − x′)，其中 xg 为地面位移，ωn 为结构自振频率，ζ 为等效阻尼比。斗栱连接取低自振频率（0.7Hz）与高阻尼（0.35，模拟榫卯摩擦滑移耗能），刚性连接取高自振频率（4.0Hz）与低阻尼（0.05）。逐帧采用半隐式欧拉法积分。实测对比（振幅 16 分、频率 2Hz）：斗栱连接下屋面峰值位移衰减至地面的 0.33 倍，刚性连接则放大至 1.31 倍。该模型为教学示意，不替代真实结构分析。"),
  tableTitle("表 3  抗震演示实测数据（振幅 16 分、频率 2Hz、采样 5 秒）"),
  dataTable(
    ["屋面连接方式", "地面峰值位移（分）", "屋面峰值位移（分）", "响应比"],
    [
      ["斗栱连接", "15.1", "5.0", "0.33（减震 67%）"],
      ["刚性连接", "15.1", "19.8", "1.31（放大）"],
    ],
    [25, 25, 28, 22]
  ),
  h2("4.4 程序化资产"),
  body("作品不使用任何外部素材：木纹以 Canvas 程序化绘制（生长轮色带、随机游走纤维线、细密噪点，兼作凹凸贴图）；瓦垄纹理、序章纸纹同理；全部音效（拼装咔哒、错序闷响、完成拨弦）由 Web Audio 合成——噪声脉冲经带通滤波模拟木质撞击，五声音阶拨弦用于落成音。"),
  h2("4.5 性能工程"),
  body("构建产物按依赖拆分：three.js 与界面主包分离，主包（含登录门）仅 42.75KB（gzip 19.66KB），三维库在登录后按需异步加载；纹理全部运行时生成，首屏无任何图片请求。移动端自动降档像素比与阴影精度，触控操作由 OrbitControls 原生支持。"),
  tableTitle("表 4  构建分包数据（vite build）"),
  dataTable(
    ["分包", "体积（KB）", "gzip 后（KB）", "加载时机"],
    [
      ["index（主包+登录门）", "42.75", "19.66", "立即"],
      ["vue", "67.28", "26.76", "立即"],
      ["gsap", "70.44", "27.81", "立即"],
      ["Viewer3D（作品组件）", "38.15", "12.60", "登录后"],
      ["three", "498.72", "127.52", "登录后"],
    ],
    [34, 22, 22, 22]
  ),

  h1("五、AIGC 参与说明"),
  h2("5.1 人机分工"),
  body("本作品为 AI 深度参与的创作实践。人类创作者负责选题立意、赛道决策、形制审校、团队事务与最终把关；AI 负责代码实现、参数化算法构建、文档起草与测试验证。全部创作过程（技术决策、考据来源、版本演进、问题修复）以《AIGC 创作过程记录》文档全程留痕，作为本赛道「AI 参与过程说明」的支撑材料。"),
  h2("5.2 AI 使用的边界"),
  body("形制数据由 AI 检索《营造法式》原文（中国哲学书电子化计划、钦定四库全书本）并核验，界面中每个数字均标注卷次出处，由人类创作者复核；物理演示参数为教学示意并在界面明示；作品不生成任何虚构的历史数据。我们相信，AI 与人的协作本身就是作品立意「古人的参数化智慧遇见今天的参数化工具」的最好注脚。"),

  h1("六、社会价值与传播"),
  body("《营造》尝试回应三个现实问题：其一，非遗技艺的传承断层——通过游戏化拼装降低认知门槛，让年轻一代「愿意碰」；其二，古建科普的抽象困境——抗震演示把结构原理变为可操作的直观体验；其三，文化自信的表达——作品证明传统形制体系本身即是一套精密的参数化设计系统，可与当代数字技术直接对话。作品为纯 Web 实现，扫码即玩，适合在博物馆、校园与文化活动中部署传播。"),

  h1("七、结语"),
  body("李诫在《营造法式》序中写道：「以材为祖，材有八等。」八百年前的匠人用一套模数体系编织起整座殿宇；今天的我们用同样的思想驱动算法，让每一朵斗栱在屏幕上重新生长。《营造》的旅程没有终点——未来我们将继续扩充昂制铺作、转角铺作与更多地域案例，让这座数字营造所，收藏得起中国木构的全部想象。"),
];

// ══ 组装文档 ══
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimSun" }, size: 24, color: "000000" },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 32, bold: true, color: "1A1A1A" },
        paragraph: { spacing: { before: 400, after: 200, line: 312 }, outlineLevel: 0 },
      },
      heading2: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 28, bold: true, color: "1A1A1A" },
        paragraph: { spacing: { before: 280, after: 140, line: 312 }, outlineLevel: 1 },
      },
      heading3: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 24, bold: true, color: "1A1A1A" },
        paragraph: { spacing: { before: 200, after: 100, line: 312 }, outlineLevel: 2 },
      },
    },
  },
  sections: [
    // ── Section 1：封面（无页码） ──
    {
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR2({
        englishLabel: "YINGZAO",
        title: "《营造》数字营造系统",
        subtitle: "宋《营造法式》斗栱榫卯数字营造系统 · 设计说明文档",
        metaLines: [
          "参赛赛道：AIGC 类数字创意作品创作（专项赛道）",
          "作品类别：交互设计与数字文化",
          "参赛团队：【团队名称】",
          "指导教师：【指导教师姓名】",
          "完成日期：2026 年 9 月",
        ],
        footerRight: "全国大学生数字媒体科技作品及创意竞赛 · 参赛作品",
      }),
    },
    // ── Section 2：前置（摘要 + 目录，罗马页码） ──
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
        },
      },
      footers: { default: pageFooter() },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { before: 200, after: 300 },
          children: [new TextRun({ text: "摘  要", bold: true, size: 32, font: { eastAsia: "SimHei" } })],
        }),
        body("《营造》是一款以宋《营造法式》为蓝本的斗栱榫卯数字营造系统。作品将材分制模数体系转化为参数化生成算法，构建了营造学堂、拼装挑战、参数工坊、榫卯谱、斗栱抗震与营造之旅六大展区，覆盖「认——拼——改——造」的完整体验闭环。技术上，作品基于 Vue 3 与 Three.js 实现，构件几何全部由截面轮廓拉伸生成，铺作装配遵循原文铺作次序，木纹、瓦垄与音效均程序化合成，零外部素材；抗震演示采用自研单自由度结构响应模型，实测斗栱连接下屋面位移衰减至地面的 0.33 倍。作品全程由 AI 深度参与创作，过程留痕完备，符合 AIGC 专项赛道评审要求。"),
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          indent: { firstLine: 480 },
          spacing: { line: 312, after: 60 },
          children: [
            new TextRun({ text: "关键词：营造法式；斗栱；榫卯；参数化生成；WebGL；非物质文化遗产", size: 24, color: "000000", font: { eastAsia: "SimSun", ascii: "Times New Roman" } }),
            new PageBreak(),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { before: 200, after: 300 },
          children: [new TextRun({ text: "目  录", bold: true, size: 32, font: { eastAsia: "SimHei" } })],
        }),
        new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({
            text: "注：本目录由域代码生成。如编辑文档后页码变动，请在目录上右键选择「更新域」以刷新页码。",
            italics: true, size: 18, color: "888888", font: { eastAsia: "SimSun" },
          })],
        }),
      ],
    },
    // ── Section 3：正文（阿拉伯页码从 1 起） ──
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: { default: pageHeader() },
      footers: { default: pageFooter() },
      children: bodyChildren,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("设计说明文档.docx", buf);
  console.log("OK 设计说明文档.docx", buf.length, "bytes");
});
