# -*- coding: utf-8 -*-
r"""
提交包 docx 完善（2026-10-09）

改动：
  1. 封面 参赛团队：【团队名称】 → 参赛团队：《大木作》团队
  2. 封面 指导教师：【指导教师姓名】 → 指导教师：段欣妤、陈超
  3. 封面 新增一行「学校：南昌航空大学科技学院」（克隆 para 9 结构）
  4. 封面 完成日期：2026 年 9 月 → 2026 年 10 月
  5. 删除目录末尾的内部说明段（注：本目录由域代码生成…）
  6. 1.3 赛道适配 → 1.3 方向适配（目录 + 正文）
  7. 放大至 1.3 倍 → 放大至 1.31 倍
  8. 数字营造所 → 数字营造馆
  9. 《AI 协作过程记录》 → 《AI协作过程记录》（与文件名一致）

铁律（血的教训）：
  - 文本标签正则必须 <w:t(?:\s[^>]*)?>，不可 <w:t[^>]*>（会误匹配 <w:tab/>）
  - 逐 <w:t> 节点独立替换，禁止「聚合整段→写回首节点」（会污染 TOC 页码）
"""
import os
import re
import shutil
import zipfile

DOCX = r'D:/比赛4/营造-提交包/设计说明文档.docx'

OPEN_RE = r'<w:t(?:\s[^>]*)?>'
TEXT_RE = re.compile(r'(' + OPEN_RE + r')(.*?)(</w:t>)', re.S)

# 封面段落 9 的原始 XML（作为克隆模板与插入锚点）
P9_ANCHOR = ('<w:p><w:pPr><w:spacing w:after="100" w:line="414" w:lineRule="atLeast"/>'
             '<w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" '
             'w:eastAsia="Microsoft YaHei"/><w:color w:val="90989F"/><w:sz w:val="36"/>'
             '<w:szCs w:val="36"/></w:rPr><w:t xml:space="preserve">指导教师：【指导教师姓名】</w:t></w:r></w:p>')

P_SCHOOL = ('<w:p><w:pPr><w:spacing w:after="100" w:line="414" w:lineRule="atLeast"/>'
            '<w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" '
            'w:eastAsia="Microsoft YaHei"/><w:color w:val="90989F"/><w:sz w:val="36"/>'
            '<w:szCs w:val="36"/></w:rPr><w:t xml:space="preserve">学校：南昌航空大学科技学院</w:t></w:r></w:p>')

REPLACEMENTS = [
    ('参赛团队：【团队名称】', '参赛团队：《大木作》团队'),
    ('指导教师：【指导教师姓名】', '指导教师：段欣妤、陈超'),
    ('完成日期：2026 年 9 月', '完成日期：2026 年 10 月'),
    ('1.3 赛道适配', '1.3 方向适配'),
    ('放大至 1.3 倍', '放大至 1.31 倍'),
    ('数字营造所', '数字营造馆'),
    ('《AI 协作过程记录》', '《AI协作过程记录》'),
]


def patch(xml):
    hits = []

    # --- 先做段落插入（用原始锚点，此时尚未替换文本）---
    if P9_ANCHOR in xml:
        xml = xml.replace(P9_ANCHOR, P9_ANCHOR + P_SCHOOL, 1)
        hits.append(('(新增)', '封面插入「学校：南昌航空大学科技学院」'))
    else:
        raise SystemExit('!! 未找到 para9 锚点，插入学校行失败')

    # --- 删除目录末尾内部说明段 ---
    note_re = re.compile(r'<w:p(?:\s[^>]*)?>(?:(?!</w:p>).)*?注：本目录由域代码生成.*?</w:p>', re.S)
    new_xml, n = note_re.subn('', xml)
    if n != 1:
        raise SystemExit(f'!! 目录说明段删除异常，命中 {n} 次')
    xml = new_xml
    hits.append(('(删除)', '目录末尾内部说明段'))

    # --- 逐文本节点替换 ---
    def do_text(m):
        body = m.group(2)
        new = body
        for old, rep in REPLACEMENTS:
            if old in new:
                new = new.replace(old, rep)
                hits.append((old, rep))
        return m.group(1) + new + m.group(3)

    xml = TEXT_RE.sub(do_text, xml)
    return xml, hits


def main():
    zin = zipfile.ZipFile(DOCX, 'r')
    items = zin.infolist()
    data = {}
    for it in items:
        data[it.filename] = zin.read(it.filename)
    zin.close()

    xml = data['word/document.xml'].decode('utf-8')
    new_xml, hits = patch(xml)
    data['word/document.xml'] = new_xml.encode('utf-8')

    tmp = DOCX + '.tmp'
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as z:
        for it in items:
            z.writestr(it, data[it.filename])
    os.replace(tmp, DOCX)

    print('=== docx 改动 ===')
    for a, b in hits:
        print(f'  {a}  ->  {b}')
    print(f'\n共 {len(hits)} 处')


if __name__ == '__main__':
    main()
