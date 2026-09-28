# 页码域后处理：为页脚 PAGE 域补格式开关（WPS 兼容），清理空 pgNumType
import re
import shutil
import sys
import zipfile

src = sys.argv[1]

with zipfile.ZipFile(src, "r") as z:
    names = z.namelist()
    files = {n: z.read(n) for n in names}

doc = files["word/document.xml"].decode("utf-8")

# 1) 按文档顺序提取各节的 footerReference r:id
sect_footer_ids = []
for sect in re.finditer(r"<w:sectPr[ >].*?</w:sectPr>", doc, re.S):
    m = re.search(r'<w:footerReference w:type="default" r:id="(rId\d+)"', sect.group(0))
    sect_footer_ids.append(m.group(1) if m else None)

print("sections footer refs:", sect_footer_ids)

# 2) rId → footer 文件名
rels = files["word/_rels/document.xml.rels"].decode("utf-8")
rid_to_target = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="([^"]+)"', rels))

# 约定：第 2 节（前置摘要/目录）= ROMAN，第 3 节（正文）= arabic
fmt_for_section = {1: "ROMAN", 2: "arabic"}
for idx, rid in enumerate(sect_footer_ids):
    if rid is None or idx not in fmt_for_section:
        continue
    target = rid_to_target.get(rid)
    if not target:
        continue
    path = "word/" + target
    xml = files[path].decode("utf-8")
    fmt = fmt_for_section[idx]
    xml2, n = re.subn(
        r"(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)",
        r"\1 PAGE \\* " + fmt + r" \\* MERGEFORMAT \2",
        xml,
    )
    if n:
        files[path] = xml2.encode("utf-8")
        print(f"patched {path} -> {fmt} ({n} fields)")

# 3) 清理封面节的空 pgNumType
doc2, n = re.subn(r"<w:pgNumType/>", "", doc)
if n:
    print(f"removed {n} empty pgNumType")
files["word/document.xml"] = doc2.encode("utf-8")

out = src
shutil.move(src, src + ".tmp")
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for n2, data in files.items():
        z.writestr(n2, data)
import os
os.remove(src + ".tmp")
print("postprocess done")
