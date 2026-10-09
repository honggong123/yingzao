# -*- coding: utf-8 -*-
"""
docx 目录页码回填（第二遍法）

LibreOffice 导出 PDF 时不刷新 TOC 域，故手工把目录各条目的缓存页码
改成与渲染结果一致的值。

目录条目结构：
  ...<w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>9</w:t></w:r>...
                                          ^^^^^^^^^^^^^^^^^^^^^^^^ 这一处是缓存页码

做法：按条目标题文本查表，替换 separate 之后那个 <w:t> 的数字。
"""
import os
import re
import zipfile

DOCX = r'D:/比赛4/营造-提交包/设计说明文档.docx'

# 标题 -> 正确页码（据渲染 PDF 实测）
PAGE_MAP = {
    '一、作品概述': 1,
    '1.1 创意背景与立意': 1,
    '1.2 作品定位与目标用户': 1,
    '1.3 方向适配': 1,
    '二、作品结构与功能设计': 2,
    '2.1 营造学堂——构件认知': 2,
    '2.2 拼装挑战——游戏化拼装': 2,
    '2.3 参数工坊——模数化的可视化': 3,
    '2.4 榫卯谱——不用一钉一铆': 3,
    '2.5 营造之旅——程序化大殿': 4,
    '2.6 斗栱抗震——结构科学互动演示': 5,
    '2.7 系统支撑功能': 6,
    '三、形制考据与数据基准': 6,
    '3.1 材分制与八等材': 6,
    '3.2 斗与栱的形制尺寸': 7,
    '四、技术方案': 7,
    '4.1 总体架构': 7,
    '4.2 铺作生成算法': 8,
    '4.3 抗震演示的物理模型': 8,
    '4.4 程序化资产': 8,
    '4.5 性能工程': 9,
    '五、创作方法与工具说明': 9,
    '5.1 团队分工与工具参与': 9,
    '5.2 工具使用的边界': 9,
    '六、社会价值与传播': 10,
    '七、结语': 10,
}

PARA_RE = re.compile(r'<w:p(?:\s[^>]*)?>.*?</w:p>', re.S)
TEXT_OPEN = r'<w:t(?:\s[^>]*)?>'
FIRST_TEXT_RE = re.compile(TEXT_OPEN + r'(.*?)</w:t>', re.S)
# separate 之后紧跟的页码节点
PAGENUM_RE = re.compile(
    r'(<w:fldChar w:fldCharType="separate"/></w:r><w:r>(?:<w:rPr>.*?</w:rPr>)?'
    + TEXT_OPEN + r')(\d+)(</w:t>)', re.S)


def patch(xml):
    changes = []

    def do_para(m):
        para = m.group(0)
        if 'PAGEREF' not in para:
            return para
        mt = FIRST_TEXT_RE.search(para)
        if not mt:
            return para
        title = mt.group(1).strip()
        if title not in PAGE_MAP:
            changes.append((title, '!! 未在映射表中', None))
            return para
        want = PAGE_MAP[title]

        def do_num(mm):
            old = mm.group(2)
            if old != str(want):
                changes.append((title, old, want))
            return mm.group(1) + str(want) + mm.group(3)

        return PAGENUM_RE.sub(do_num, para)

    return PARA_RE.sub(do_para, xml), changes


def main():
    zin = zipfile.ZipFile(DOCX, 'r')
    items = zin.infolist()
    data = {it.filename: zin.read(it.filename) for it in items}
    zin.close()

    xml = data['word/document.xml'].decode('utf-8')
    new_xml, changes = patch(xml)
    data['word/document.xml'] = new_xml.encode('utf-8')

    tmp = DOCX + '.tmp'
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as z:
        for it in items:
            z.writestr(it, data[it.filename])
    os.replace(tmp, DOCX)

    print('=== 目录页码修正 ===')
    n = 0
    for title, old, want in changes:
        if want is None:
            print(f'  {title}  {old}')
        else:
            print(f'  {title:<30} {old} -> {want}')
            n += 1
    print(f'\n共修正 {n} 处')


if __name__ == '__main__':
    main()
