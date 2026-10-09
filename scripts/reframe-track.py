# -*- coding: utf-8 -*-
"""
赛道定位调整：AIGC 专项赛道 → 「民族文化，创新表达」

做法：直接改 Office 源文件 zip 内的 XML 文本节点（零排版风险），
      再交 LibreOffice 重导出 PDF。

关键：XML 段落内文本可能被拆成多个 <a:t>/<w:t>（run 分割），
      且同一 document.xml 里 TOC 域会缓存标题文本。
      故采用「逐段落聚合 -> 精确匹配整段 -> 把新文本写回首个 run，其余 run 清空」，
      保证不重复、不残留。
"""
import re
import zipfile
import os

WORK = r'D:/比赛4/营造-提交包'

# ---------------------------------------------------------------- 替换表
# 均为 (old_substring, new_substring)，在「段落聚合文本」上做 replace

PPT_SLIDE1 = [
    ('全国大学生数字媒体科技作品及创意竞赛 · AIGC 类数字创意作品创作专项赛道',
     '全国大学生数字媒体科技作品及创意竞赛 · 民族文化，创新表达'),
]

PPT_SLIDE11 = [
    ('AIGC 参与说明 · 人机分工', '创作方法 · 团队协作'),
    ('AIGC COLLABORATION', 'METHODOLOGY'),
    ('人（不可替代）', '团队职责'),
    ('AI（深度参与）', '技术工具'),
    ('选题立意与赛道决策', '选题立意与方向决策'),
    ('形制审校与最终把关', '典籍考据与形制审校'),
    ('团队事务与现场答辩', '构件复核与现场答辩'),
    ('代码实现与算法构建', '代码工程与算法实现'),
    ('文献检索与考据核验', '文献检索与数据校核'),
    ('文档起草与数据整理', '文档起草与资料整理'),
    ('测试验证与问题定位', '测试验证与缺陷定位'),
    ('过程全程留痕：《AIGC 创作过程记录》逐日保存技术决策、考据来源、版本演进与问题修复，可现场调阅。',
     '过程全程留痕：《AIGC 创作过程记录》逐日保存技术决策、考据来源与问题修复，如实记录工具参与范围，可现场调阅。'),
]

PPT_NOTES = [
    ('纠错痕迹留在 AIGC 记录里', '纠错痕迹留在创作过程记录里'),
]

DOCX_PARAS = [
    ('参赛赛道：AIGC 类数字创意作品创作（专项赛道）',
     '参赛赛道：民族文化，创新表达'),
    ('本作品报名 AIGC 类数字创意作品创作专项赛道。作品从形制考据、参数化生成算法到全部程序化资产（木纹、瓦垄、音效）均由 AI 深度参与完成，人机分工与创作过程全程留痕（见第五章），符合该赛道「清晰展示 AI 工具与技术使用过程」「说明 AI 参与创作比例」的评审要求。',
     '本作品以「民族文化，创新表达」为创作方向：核心价值在于对《营造法式》形制体系的考据复原与数字化转译——材分制、铺作次序、昂制形制均对照卷四、卷五原文逐条核验，界面中每个数字均可溯源至文献卷次；全部构件几何由算法实时生成，木纹、瓦垄与音效均程序化合成，零外部素材。团队负责选题立意、典籍考据、形制审校与最终把关；AI 工具用于提升代码工程、文献检索与文档整理效率，参与范围与过程全程留痕（见第五章）。'),
    ('作品全程由 AI 深度参与创作，过程留痕完备，符合 AIGC 专项赛道评审要求。',
     '作品在开发中借助 AI 工具提升工程与检索效率，全部创作过程留痕完备。'),
    ('本作品为 AI 深度参与的创作实践。人类创作者负责选题立意、赛道决策、形制审校、团队事务与最终把关；AI 负责代码实现、参数化算法构建、文档起草与测试验证。全部创作过程（技术决策、考据来源、版本演进、问题修复）以《AIGC 创作过程记录》文档全程留痕，作为本赛道「AI 参与过程说明」的支撑材料。',
     '本作品由团队完成主要创作工作：选题立意、典籍考据、形制判定、价值取舍、最终把关与现场答辩均由团队成员负责。在此过程中，团队借助 AI 工具提升工程与检索效率——代码实现、参数化算法构建、文献检索、文档起草与测试验证等环节有 AI 参与，由团队逐项复核确认。全部创作过程（技术决策、考据来源、版本演进、问题修复）以《AIGC 创作过程记录》文档全程留痕，如实记录工具参与范围，可供评审调阅。'),
    ('形制数据由 AI 检索《营造法式》原文（中国哲学书电子化计划、钦定四库全书本）并核验，界面中每个数字均标注卷次出处，由人类创作者复核；物理演示参数为教学示意并在界面明示；作品不生成任何虚构的历史数据。我们相信，AI 与人的协作本身就是作品立意「古人的参数化智慧遇见今天的参数化工具」的最好注脚。',
     '形制数据检索《营造法式》原文（中国哲学书电子化计划、钦定四库全书本）并逐条核验，界面中每个数字均标注卷次出处，由团队复核确认；物理演示参数为教学示意并在界面明示；作品不生成任何虚构的历史数据。我们相信，传统的模数智慧与当代数字工具的相遇，正是作品立意「古人的参数化智慧遇见今天的参数化工具」的最好注脚。'),
    # 标题（含 TOC 缓存，需全量替换）
    ('五、AIGC 参与说明', '五、创作方法与工具说明'),
    ('5.1 人机分工', '5.1 团队分工与工具参与'),
    ('5.2 AI 使用的边界', '5.2 工具使用的边界'),
]


def patch_paras(xml, repl, para_tag, text_tag):
    """逐段落处理，但**逐文本节点**做子串替换。

    关键教训：TOC 段落形如 [标题]<w:t>标题</w:t>...[tab]...[PAGEREF]<w:t>9</w:t>
    若按「聚合段落文本再写回首节点」处理，会把页码并进标题、并清空页码节点。
    故改为：对每个 <w:t> 节点独立做 (old -> new) 子串替换，结构零扰动。

    text_tag 的正则必须精确：<w:t> 或 <w:t 属性>；不能是 <w:t[^>]*>（会误匹配 <w:tab/>）。
    """
    open_re = r'<' + text_tag + r'(?:\s[^>]*)?>'
    para_re = re.compile(r'<' + para_tag + r'(?:\s[^>]*)?>.*?</' + para_tag + r'>', re.S)
    text_re = re.compile(r'(' + open_re + r')(.*?)(</' + text_tag + r'>)', re.S)
    # 判定段落是否需要处理：用全段聚合文本做快速预筛
    probe_re = re.compile(open_re + r'(.*?)</' + text_tag + r'>', re.S)

    hits = []

    def do_para(m):
        para = m.group(0)
        joined = ''.join(probe_re.findall(para))
        if not any(old in joined for old, _ in repl):
            return para

        def do_text(mm):
            body = mm.group(2)
            newbody = body
            for old, rep in repl:
                if old in newbody:
                    newbody = newbody.replace(old, rep)
                    hits.append((old, rep))
            return mm.group(1) + newbody + mm.group(3)

        return text_re.sub(do_text, para)

    out = para_re.sub(do_para, xml)
    return out, hits


def process_office(src, dst, repl_sets):
    tmp = dst + '.tmp'
    zin = zipfile.ZipFile(src, 'r')
    zout = zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED)
    all_hits = []
    for item in zin.infolist():
        data = zin.read(item.filename)
        for pat, (repl, ptag, ttag) in repl_sets.items():
            if re.match(pat, item.filename):
                try:
                    xml = data.decode('utf-8')
                except UnicodeDecodeError:
                    break
                new_xml, hits = patch_paras(xml, repl, ptag, ttag)
                if hits:
                    data = new_xml.encode('utf-8')
                    all_hits.append((item.filename, hits))
                break
        zout.writestr(item, data)
    zin.close()
    zout.close()
    os.replace(tmp, dst)
    return all_hits


if __name__ == '__main__':
    ppt = os.path.join(WORK, '答辩PPT.pptx')
    ppt_sets = {
        r'ppt/slides/slide1\.xml$': (PPT_SLIDE1, 'a:p', 'a:t'),
        r'ppt/slides/slide11\.xml$': (PPT_SLIDE11, 'a:p', 'a:t'),
        r'ppt/notesSlides/notesSlide4\.xml$': (PPT_NOTES, 'a:p', 'a:t'),
    }
    print('=== PPT 改动 ===')
    for name, h in process_office(ppt, ppt, ppt_sets):
        print(' ', name)
        for a, b in h:
            print(f'    - {a[:50]}')
            print(f'    + {b[:50]}')

    docx = os.path.join(WORK, '设计说明文档.docx')
    docx_sets = {
        r'word/document\.xml$': (DOCX_PARAS, 'w:p', 'w:t'),
    }
    print()
    print('=== DOCX 改动 ===')
    for name, h in process_office(docx, docx, docx_sets):
        print(' ', name)
        for a, b in h:
            print(f'    - {a[:50]}')
            print(f'    + {b[:50]}')
