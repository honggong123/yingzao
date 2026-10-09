# -*- coding: utf-8 -*-
"""把 PDF 中的作品名《营造》替换为《大木作》——按 span 精确重绘，保留原字体与字号。

策略：
  1. 逐 span 定位含《营造》的文本，记录 rect / font / size / color
  2. add_redact_annot 抹除该 span 区域（不动图像）
  3. 从 Windows 字体目录嵌入对应中文字体，按原位置与字号重新写回
"""
import os
import sys
import pymupdf

OLD, NEW = '《营造》', '《大木作》'


def bg_color(page, rect):
    """采样矩形区域背后像素，返回 0-1 浮点 RGB（用于覆盖旧字）"""
    scale = 3
    mat = pymupdf.Matrix(scale, scale)
    clip = pymupdf.Rect(rect.x0 - 1, rect.y0 - 1, rect.x1 + 1, rect.y1 + 1)
    pix = page.get_pixmap(matrix=mat, clip=clip)
    if pix.width == 0 or pix.height == 0:
        return (0.082, 0.067, 0.051)
    # 取四角与中心的中位数，避开文字笔画
    pts = [(0, 0), (pix.width - 1, 0), (0, pix.height - 1),
           (pix.width - 1, pix.height - 1), (pix.width // 2, pix.height // 2)]
    cols = [pix.pixel(x, y) for x, y in pts]
    r = sorted(c[0] for c in cols)[len(cols) // 2] / 255
    g = sorted(c[1] for c in cols)[len(cols) // 2] / 255
    b = sorted(c[2] for c in cols)[len(cols) // 2] / 255
    return (r, g, b)

# 需要替换的文本片段（按 span 精确匹配，替换其中出现的所有 OLD 片段）
EXTRA_PAIRS = [
    ('營造', '大木'),              # 封面印章
    ('Y I N G Z A O', 'D A M U Z U O'),   # 英文名（带空格写法）
    ('YINGZAO', 'DAMUZUO'),        # 英文名
]

# 逐字母排版的英文名：按页收集单字符 span 后整体重绘（原名 -> 新名）
LETTER_SPACED = {'YINGZAO': 'DAMUZUO'}

# PDF 内部字体名 -> Windows 字体文件
FONT_MAP = {
    'SimSun':              'C:/Windows/Fonts/simsun.ttc',
    'SimHei':              'C:/Windows/Fonts/simhei.ttf',
    'MicrosoftYaHei':      'C:/Windows/Fonts/msyh.ttc',
    'MicrosoftYaHei-Bold': 'C:/Windows/Fonts/msyhbd.ttc',
    'MicrosoftYaHeiLight': 'C:/Windows/Fonts/msyhl.ttc',
}


def to_rgb(c):
    if isinstance(c, (tuple, list)):
        return tuple(c)
    return ((c >> 16) & 0xFF) / 255, ((c >> 8) & 0xFF) / 255, (c & 0xFF) / 255


def pick_font(page, span):
    """返回 insert_text 用的 fontname；不可用时退回内置字体"""
    fname = span['font'] or ''
    path = FONT_MAP.get(fname)
    if not path:
        # 拉丁字体（Calibri / Arial 等）：先试同样式中文正文字体，再退回内置拉丁字体
        path = 'C:/Windows/Fonts/msyh.ttc' if 'Calibri' in fname or 'Arial' in fname else None
    if not path or not os.path.exists(path):
        return 'helv'          # 内置拉丁字体，足够渲染 A-Z
    name = f'F{page.number}_' + str(abs(hash(path)) % 100000)
    try:
        page.insert_font(fontname=name, fontfile=path)
        return name
    except Exception as e:
        print(f'    (嵌入 {path} 失败: {e})')
        return 'helv'


def process(path, dry=False):
    doc = pymupdf.open(path)
    pairs = [(OLD, NEW)] + EXTRA_PAIRS
    jobs = []
    letter_jobs = []       # 逐字母英文名
    for page in doc:
        # ── 逐行扫描：把"逐字母排版"的整行收集起来整体重绘 ──
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines', []):
                spans = line['spans']
                joined = ''.join(s['text'] for s in spans)          # 含空格
                compact = joined.replace(' ', '')
                for old_w, new_w in LETTER_SPACED.items():
                    if old_w in compact:
                        # 该行整体重绘：先算新文本，再按原排版风格铺开
                        new_joined = joined.replace(old_w, new_w)
                        letter_jobs.append((page, line, spans, old_w, new_w, new_joined))

        # ── 普通 span 替换（跳过已整体处理的字母行）──
        handled_lines = {id(lj[1]) for lj in letter_jobs if lj[0] is page}
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines', []):
                if id(line) in handled_lines:
                    continue
                for span in line['spans']:
                    hit = next((p for p in pairs if p[0] in span['text']), None)
                    if not hit:
                        continue
                    rects = page.search_for(span['text'])
                    if not rects:
                        print(f'  !! 未能定位: {span["text"][:30]!r}')
                        continue
                    cy = (span['bbox'][1] + span['bbox'][3]) / 2
                    best = min(rects, key=lambda r: abs((r.y0 + r.y1) / 2 - cy))
                    jobs.append((page, best, dict(span), hit))

    # 字母行重绘信息：用逐字符坐标求真实边界，擦除区按上下扩展 40% 确保彻底清除
    letter_rects = []
    for page, line, spans, old_w, new_w, new_joined in letter_jobs:
        x0 = min(s['bbox'][0] for s in spans)
        x1 = max(s['bbox'][2] for s in spans)
        y0 = min(s['bbox'][1] for s in spans)
        y1 = max(s['bbox'][3] for s in spans)
        h = y1 - y0
        r = pymupdf.Rect(x0 - 3, y0 - h * 0.4, x1 + 3, y1 + h * 0.4)
        letter_rects.append((page, r, spans, new_joined))

    total = len(jobs) + len(letter_rects)
    print(f'{path}: 命中 {total} 处（含整行重绘 {len(letter_rects)} 处）')
    if dry:
        for page, rect, span, hit in jobs:
            print(f'   p{page.number + 1} font={span["font"]:20s} size={span["size"]:5.1f} '
                  f'{span["text"][:36]!r}  [{hit[0]}->{hit[1]}]')
        for page, rect, spans, new_joined in letter_rects:
            print(f'   p{page.number + 1} [整行重绘] {new_joined!r}  '
                  f'bbox={[round(x,1) for x in rect]}  font={spans[0]["font"]}')
        doc.close()
        return

    for page, rect, span, hit in jobs:
        page.add_redact_annot(rect, fill=bg_color(page, rect))
    for page, rect, spans, new_joined in letter_rects:
        page.add_redact_annot(rect, fill=bg_color(page, rect))
    for pno in sorted({pg.number for pg, _, _, _ in jobs} |
                      {pg.number for pg, _, _, _ in letter_rects}):
        doc[pno].apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE)

    font_cache = {}

    for page, rect, span, hit in jobs:
        old_text = span['text']
        o, n = hit
        if o == OLD:
            i = old_text.index(o)
            char_w = rect.width / max(len(old_text), 1)
            x0 = rect.x0 + char_w * len(old_text[:i])
            new_text = n
        else:
            x0 = rect.x0
            new_text = old_text.replace(o, n)
        fontname = font_cache.get((page.number, span['font']))
        if fontname is None:
            fontname = pick_font(page, span)
            font_cache[(page.number, span['font'])] = fontname
        page.insert_text(
            pymupdf.Point(x0, rect.y1 - (rect.height - span['size']) * 0.22),
            new_text,
            fontname=fontname,
            fontsize=span['size'],
            color=to_rgb(span.get('color', 0)),
        )

    # 整行重绘：逐字符按原字距铺开，保持"疏排"风格
    for page, rect, spans, new_joined in letter_rects:
        span = dict(spans[0])
        size = span['size']
        fontname = font_cache.get((page.number, span['font']))
        if fontname is None:
            fontname = pick_font(page, span)
            font_cache[(page.number, span['font'])] = fontname
        chars = [c for c in new_joined if c != ' ']
        n = len(chars)
        step = rect.width / n
        base_y = rect.y1 - (rect.height - size) * 0.22
        for k, ch in enumerate(chars):
            page.insert_text(
                pymupdf.Point(rect.x0 + step * k, base_y),
                ch,
                fontname=fontname,
                fontsize=size,
                color=to_rgb(span.get('color', 0)),
            )

    doc.save(path + '.tmp', garbage=4, deflate=True)
    doc.close()
    os.replace(path + '.tmp', path)
    print(f'{path}: 已写回')


if __name__ == '__main__':
    argv = sys.argv[1:]
    dry = '--dry' in argv
    for p in [a for a in argv if not a.startswith('--')]:
        process(p, dry)
