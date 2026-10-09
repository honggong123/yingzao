# -*- coding: utf-8 -*-
r"""
提交包 PPT 完善（2026-10-09）

  slide1  2026 年 9 月            -> 2026 年 10 月
  slide8  减震 68%                -> 减震 67%   （1 - 0.33 = 0.67，与「衰减至 1/3」自洽）
  slide11 《AI 协作过程记录》      -> 《AI协作过程记录》（与文件名一致）

铁律：文本标签正则用 <a:t(?:\s[^>]*)?>，逐 <a:t> 节点独立替换。
"""
import os
import re
import zipfile

PPTX = r'D:/比赛4/营造-提交包/答辩PPT.pptx'

SETS = {
    r'ppt/slides/slide1\.xml$': [('2026 年 9 月', '2026 年 10 月')],
    r'ppt/slides/slide8\.xml$': [('减震 68%', '减震 67%')],
    r'ppt/slides/slide11\.xml$': [('《AI 协作过程记录》', '《AI协作过程记录》')],
}

TEXT_RE = re.compile(r'(<a:t(?:\s[^>]*)?>)(.*?)(</a:t>)', re.S)


def main():
    zin = zipfile.ZipFile(PPTX, 'r')
    items = zin.infolist()
    data = {it.filename: zin.read(it.filename) for it in items}
    zin.close()

    all_hits = []
    for name, repl in SETS.items():
        for fn in data:
            if not re.match(name, fn):
                continue
            xml = data[fn].decode('utf-8')
            hits = []

            def do_text(m):
                body = m.group(2)
                new = body
                for old, rep in repl:
                    if old in new:
                        new = new.replace(old, rep)
                        hits.append((old, rep))
                return m.group(1) + new + m.group(3)

            xml = TEXT_RE.sub(do_text, xml)
            if hits:
                data[fn] = xml.encode('utf-8')
                all_hits.append((fn, hits))
            else:
                all_hits.append((fn, '!! 未命中'))

    tmp = PPTX + '.tmp'
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as z:
        for it in items:
            z.writestr(it, data[it.filename])
    os.replace(tmp, PPTX)

    print('=== PPT 改动 ===')
    for fn, h in all_hits:
        print(f'  {fn}')
        if isinstance(h, str):
            print(f'    {h}')
        else:
            for a, b in h:
                print(f'    {a}  ->  {b}')


if __name__ == '__main__':
    main()
