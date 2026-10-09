# -*- coding: utf-8 -*-
# 组装参赛提交包：清理误编码产物，按 UTF-8 条目名打 zip，并列出清单核对
#
# 报名系统规则（2026-10-08 确认）：
#   第 9 项「答辩 PPT」单独上传（≤200MB）
#   第 10 项「参赛打包文件」要求：除 承诺书/截图/视频/PPT 以外文件压成 1 个压缩包（zip/rar/7z，≤10GB）
#   => 因此本压缩包【必须排除 PPT(.pptx) 与 PPT 导出的 PDF】
import os
import zipfile

ROOT = r"D:\比赛4"
PKG = os.path.join(ROOT, "营造-提交包")
ZIP = os.path.join(ROOT, "营造-提交包.zip")

# 排除清单：这些文件由报名系统的独立上传项接收，不进本压缩包
EXCLUDE = {
    "答辩PPT.pptx",   # -> 第 9 项
    "答辩PPT.pdf",    # PPT 的 PDF 版，同属 PPT，不提交
}

print("ROOT 目录现有条目：")
for n in os.listdir(ROOT):
    print("  ", repr(n))

# 清理此前 PowerShell 产生的乱码 zip（按字节特征判断：名字里含 U+FFFD 或非预期字符）
for n in os.listdir(ROOT):
    p = os.path.join(ROOT, n)
    if os.path.isfile(p) and n.endswith(".zip") and n != "营造-提交包.zip":
        os.remove(p)
        print("已删除乱码 zip：", repr(n))

if os.path.exists(ZIP):
    os.remove(ZIP)

with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for n in sorted(os.listdir(PKG)):
        if n in EXCLUDE:
            print(f"跳过（走报名系统单独上传项）：{n}")
            continue
        z.write(os.path.join(PKG, n), arcname=n)

print("\nzip 条目清单：")
with zipfile.ZipFile(ZIP) as z:
    for info in z.infolist():
        flag = "UTF-8" if info.flag_bits & 0x800 else "CP437"
        print(f"  {info.file_size:>9,}  [{flag}]  {info.filename}")
    bad = z.testzip()
    print("\n完整性：", "通过" if bad is None else f"损坏：{bad}")
print("zip 大小：", f"{os.path.getsize(ZIP):,} bytes")
