# -*- coding: utf-8 -*-
"""PDF 作品名替换（内容流级，字形替换）——最可靠的方案。

原理：
  PowerPoint 导出的中文用 Identity-H 子集字体，内容流里是 <CID> 十六进制。
  该字体的 ToUnicode CMap 给出 CID ↔ Unicode 的对应关系，
  因此可以：查 ToUnicode → 找到旧字/新字的 CID → 在 TJ 数组里逐字替换。
  因为是「同字体同编码」替换，字形、字号、位置、字距全部保持不变，不会有排版问题。
"""
import os
import re
import sys
import pymupdf

# 文本替换对（逐字替换，避免整段重排）
REPLACE_MAP = {
    '营': '大',      # 营造 → 大木作
    '造': '木',
    '營': '大',      # 印章：營造 → 大木
}
# 需要整体追加/处理的整体替换（英文名走 ASCII 分支）
WHOLE_WORDS = {
    'YINGZAO': 'DAMUZUO',
}
# 《》保持不动，其余按字替换：
#   《营造》  → 《大木作》  需在"营造"后再补一个"作"
EXTRA_AFTER = {
    '《营造》': '作',        # 替换完《大木→ 后补"作"构成《大木作》
}

BT_BLOCK = re.compile(r'BT(.*?)ET', re.S)
TJ_ARRAY = re.compile(r'\[(.*?)\]\s*TJ', re.S)
TJ_SIMPLE = re.compile(r'<([0-9A-Fa-f]+)>\s*Tj|(\([^)]*\))\s*Tj', re.S)
CID = re.compile(r'<([0-9A-Fa-f]+)>')
ASCII_CHAR = re.compile(r'\(((?:\\.|[^)\\])*)\)')


def build_tables(doc):
    """按页构建 {(pno, resname): {unicode_char: cid_hex}}"""
    tables = {}
    for pno in range(len(doc)):
        for entry in doc.get_page_fonts(pno, full=True):
            xref, resname = entry[0], entry[4]
            kind, val = doc.xref_get_key(xref, 'ToUnicode')
            if kind != 'xref':
                continue
            raw = doc.xref_stream(int(val.split()[0]))
            if not raw:
                continue
            txt = raw.decode('latin-1', errors='ignore')
            tbl = parse_to_unicode(txt)
            if tbl:
                tables[(pno, resname)] = tbl
    return tables


def block_font(blk):
    m = re.search(r'/(\w+)\s+[\d.]+\s+Tf', blk)
    return m.group(1) if m else None


def decode_items(body):
    """把 TJ 数组还原成 [(类型, 值)] —— 类型 'c' 字符 / 'n' 数字 / 's' 字符串"""
    items = []
    pos = 0
    token = re.compile(r'\((?:\\.|[^)\\])*\)|<[0-9A-Fa-f]*>|-?\d+\.?\d*')
    for m in token.finditer(body):
        tk = m.group(0)
        if tk.startswith('('):
            items.append(('c', tk[1:-1]))
        elif tk.startswith('<'):
            items.append(('c', tk[1:-1]))
        else:
            items.append(('n', tk))
    return items


def encode_items(items, cid_of, ascii_mode):
    out = []
    for kind, val in items:
        if kind == 'n':
            out.append(val)
        else:
            if ascii_mode:
                out.append('(' + val + ')')
            else:
                out.append('<' + val.upper() + '>')
    return '[' + ' '.join(out) + '] TJ'


def process(path, dry=False):
    doc = pymupdf.open(path)
    # 收集全文 ToUnicode CMap（每个子集字体一张）
    tables = build_tables(doc)
    total_glyphs = sum(len(t) for t in tables.values())
    print(f'{path}: {len(tables)} 个字体子集 / {total_glyphs} 字形')

    # 页级索引：char -> [(字体资源名, cid)]，用于跨字体借字
    def page_char_index(pno):
        idx = {}
        for (pn, fname), tbl in tables.items():
            if pn != pno:
                continue
            for ch, cid in tbl.items():
                idx.setdefault(ch, []).append((fname, cid))
        return idx

    total = 0
    for page in doc:
        content = page.read_contents().decode('latin-1')
        new_content = content
        for m in list(BT_BLOCK.finditer(content)):
            blk = m.group(0)
            fnt = fname_of_block(blk)
            cid_of = tables.get((page.number, fnt), {})
            rev = {v.upper(): k for k, v in cid_of.items()}
            if not cid_of:
                continue
            arr = TJ_ARRAY.search(blk)
            simple = None if arr else TJ_SIMPLE.search(blk)
            if not arr and not simple:
                continue

            if arr:
                body = arr.group(1)
                ascii_mode = not ('<' in body and not ASCII_CHAR.search(body))
                items = decode_items(body)
                target_span = (arr.start(), arr.end())
            else:
                if simple.group(1):        # <hex> Tj
                    ascii_mode = False
                    items = [('c', h) for h in split_hex(simple.group(1))]
                    body = '<' + simple.group(1) + '>'
                else:                       # (str) Tj
                    ascii_mode = True
                    items = [('c', simple.group(2)[1:-1])]
                    body = simple.group(2)
                target_span = (simple.start(), simple.end())

            if ascii_mode:
                text = ''.join(v for k, v in items if k == 'c')
                if not any(w in text.replace(' ', '') for w in WHOLE_WORDS):
                    continue
                new_text = text
                for w, nw in WHOLE_WORDS.items():
                    new_text = new_text.replace(w, nw)
                chars = [c for c in new_text if c != ' ']
                out = []
                for i, ch in enumerate(chars):
                    out.append('(' + ch + ')')
                    if i < len(chars) - 1:
                        out.append('-246')
                new_body = '[' + ' '.join(out) + '] TJ'
            else:
                hexes = [v for k, v in items if k == 'c']
                text = ''.join(rev.get(h.upper().zfill(4), '\uFFFD') for h in hexes)
                if not any(ch in REPLACE_MAP for ch in text) and \
                   not any(w in text for w in EXTRA_AFTER):
                    continue
                idx = page_char_index(page.number)
                new_hexes = []
                font_used = fnt          # 目标字形所在字体（可能需跨字体借用）
                for h in hexes:
                    ch = rev.get(h.upper().zfill(4), '')
                    tgt = REPLACE_MAP.get(ch, ch)
                    if tgt in cid_of:
                        new_hexes.append((fnt, cid_of[tgt]))
                    elif idx.get(tgt):
                        alt_f, alt_cid = idx[tgt][0]
                        new_hexes.append((alt_f, alt_cid))
                    else:
                        new_hexes.append((fnt, h))
                    if ch == '造' and any(k.endswith('營造》') or k.endswith('营造》')
                                          for k in EXTRA_AFTER):
                        if '作' in cid_of:
                            new_hexes.append((fnt, cid_of['作']))
                        elif idx.get('作'):
                            new_hexes.append(idx['作'][0])
                # 若发生跨字体，整个块统一切到目标字体（避免同一块混排两套 CID）
                fonts_used = {f for f, _ in new_hexes}
                if len(fonts_used) > 1:
                    # 选覆盖最多字符的字体，其余字符尽量在该字体里找
                    from collections import Counter
                    pick = Counter(f for f, _ in new_hexes).most_common(1)[0][0]
                    fixed = []
                    for (f, cid), h in zip(new_hexes, hexes * 2):
                        if f == pick:
                            fixed.append(cid)
                        else:
                            # 在 pick 字体里找同字形的字符
                            f_ch = rev.get(h.upper().zfill(4), '')
                            tgt = REPLACE_MAP.get(f_ch, f_ch)
                            fixed.append(tables.get((page.number, pick), {}).get(tgt, cid))
                    new_hexes = [(pick, c) for c in fixed]
                    font_used = pick
                else:
                    font_used = next(iter(fonts_used)) if fonts_used else fnt

                out = []
                it = iter([c for _, c in new_hexes])
                for kind, val in items:
                    if kind == 'n':
                        out.append(val)
                    else:
                        out.append('<' + next(it) + '>')
                # 若字体变化，替换该块的 Tf 资源名
                nb_blk = blk
                if font_used != fnt:
                    nb_blk = re.sub(r'/' + re.escape(fnt) + r'(\s+[\d.]+\s+Tf)',
                                    '/' + font_used + r'\1', blk, count=1)
                new_body = ('[' + ' '.join(out) + '] TJ') if arr else \
                           ('<' + ''.join([c for _, c in new_hexes]) + '> Tj')
                blk = nb_blk

            if arr:
                nb = blk[:arr.start()] + new_body + blk[arr.end():]
            else:
                nb = blk[:simple.start()] + new_body + blk[simple.end():]
            if nb != blk:
                new_content = new_content.replace(blk, nb, 1)
                total += 1
        if not dry and new_content != content:
            page.clean_contents()
            xref = page.get_contents()[0]
            doc.update_stream(xref, new_content.encode('latin-1'))

    print(f'{path}: {"预演命中" if dry else "改写"} {total} 处')
    if not dry and total:
        doc.save(path + '.tmp', garbage=4, deflate=True)
        doc.close()
        os.replace(path + '.tmp', path)
        print(f'{path}: 已写回')
    else:
        doc.close()


def parse_to_unicode(txt):
    """解析 ToUnicode CMap：分节处理 beginbfchar / beginbfrange"""
    tbl = {}
    # ── beginbfchar ... endbfchar：<CID> <UNI> ──
    for sec in re.findall(r'beginbfchar(.*?)endbfchar', txt, re.S):
        for cid, uni in re.findall(r'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>', sec):
            try:
                ch = chr(int(uni, 16))
            except ValueError:
                continue
            tbl.setdefault(ch, cid.upper().zfill(4))
    # ── beginbfrange ... endbfrange：<LO> <HI> <UNI> 或 <LO> <HI> [<U>...] ──
    for sec in re.findall(r'beginbfrange(.*?)endbfrange', txt, re.S):
        for m in re.finditer(
                r'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<[0-9A-Fa-f]+>|\[[^\]]*\])', sec):
            lo_i, hi_i = int(m.group(1), 16), int(m.group(2), 16)
            if hi_i < lo_i or hi_i - lo_i > 65535:
                continue
            rest = m.group(3)
            if rest.startswith('['):
                unis = re.findall(r'<([0-9A-Fa-f]+)>', rest)
                for k, u in enumerate(unis):
                    try:
                        ch = chr(int(u, 16))
                    except ValueError:
                        continue
                    tbl.setdefault(ch, f'{lo_i + k:04X}')
            else:
                base = int(rest[1:-1], 16)
                for k in range(hi_i - lo_i + 1):
                    try:
                        ch = chr(base + k)
                    except ValueError:
                        continue
                    tbl.setdefault(ch, f'{lo_i + k:04X}')
    return tbl


def fname_of_block(blk):
    """取出 BT 块里 /Fx 资源名"""
    m = re.search(r'/(\w+)\s+[\d.]+\s+Tf', blk)
    return m.group(1) if m else None


def split_hex(h):
    """把连写的十六进制串按 4 位一组切开（Identity-H CID）"""
    h = h.strip()
    if len(h) % 4:
        return [h]
    return [h[i:i + 4] for i in range(0, len(h), 4)]


if __name__ == '__main__':
    argv = sys.argv[1:]
    dry = '--dry' in argv
    for p in [a for a in argv if not a.startswith('--')]:
        process(p, dry)
