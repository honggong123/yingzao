# -*- coding: utf-8 -*-
"""替换 Office 文档（pptx/docx）中的作品名，再用 LibreOffice 重导出 PDF。

XML 层面的字符串替换：保留全部格式、字体、版式，只改文字。
"""
import os
import re
import shutil
import subprocess
import sys
import zipfile

SOFFICE = r'C:\Program Files\LibreOffice\program\soffice.exe'
WORK = r'C:\Users\usa\AppData\Local\Temp\office_rename'

# 作品名替换（长串优先，避免部分匹配）
REPLACEMENTS = [
    ('《营造》', '《大木作》'),
    ('營造', '大木'),              # 封面印章
    ('YINGZAO', 'DAMUZUO'),        # 英文名（含逐字母写法 'Y I N G Z A O'）
]


def split_letter_spaced(text):
    """把 'Y I N G Z A O' 这类逐字母写法也替换掉"""
    return re.sub(r'Y\s*I\s*N\s*G\s*Z\s*A\s*O', 'D A M U Z U O', text)


def patch_xml(text):
    for old, new in REPLACEMENTS:
        text = text.replace(old, new)
    text = split_letter_spaced(text)
    return text


def process(src, dst=None, export_pdf=True):
    """src: 源文件；dst: 输出文件（默认覆盖 src）"""
    dst = dst or src
    if os.path.exists(WORK):
        shutil.rmtree(WORK)
    os.makedirs(WORK, exist_ok=True)

    # 1) 解压
    with zipfile.ZipFile(src) as z:
        z.extractall(WORK)

    # 2) 替换 XML 与 rels 中的文本
    changed = 0
    for root, _, files in os.walk(WORK):
        for fn in files:
            if not (fn.endswith('.xml') or fn.endswith('.rels')):
                continue
            p = os.path.join(root, fn)
            try:
                raw = open(p, encoding='utf-8').read()
            except UnicodeDecodeError:
                continue
            new = patch_xml(raw)
            if new != raw:
                open(p, 'w', encoding='utf-8').write(new)
                changed += 1
    print(f'  XML 改动 {changed} 个文件')

    # 3) 重新打包（保持原压缩方式）
    tmp_out = dst + '.patched'
    with zipfile.ZipFile(src) as zin, \
            zipfile.ZipFile(tmp_out, 'w', zipfile.ZIP_DEFLATED) as zout:
        names = zin.namelist()
        for name in names:
            path = os.path.join(WORK, name.replace('/', os.sep))
            if os.path.isfile(path):
                zout.write(path, name)
        # 补上 walk 发现但不在 namelist 里的文件（极少见）
        for root, _, files in os.walk(WORK):
            for fn in files:
                full = os.path.join(root, fn)
                rel = os.path.relpath(full, WORK).replace(os.sep, '/')
                if rel not in names:
                    zout.write(full, rel)
    os.replace(tmp_out, dst)
    print(f'  已写回 {os.path.basename(dst)}')

    # 4) 用 LibreOffice 导出 PDF
    if export_pdf:
        outdir = os.path.dirname(os.path.abspath(dst))
        subprocess.run([SOFFICE, '--headless', '--norestore',
                        '--convert-to', 'pdf', '--outdir', outdir, dst],
                       check=False, timeout=300)
        pdf = os.path.splitext(dst)[0] + '.pdf'
        print(f'  PDF: {pdf}  {"OK" if os.path.exists(pdf) else "未生成"}')


if __name__ == '__main__':
    for f in sys.argv[1:]:
        print(f'处理 {f}')
        process(f)
