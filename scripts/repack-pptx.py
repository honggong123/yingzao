# -*- coding: utf-8 -*-
# 用新版应用截图替换 答辩PPT.pptx 内嵌图并重打包
#
# 背景：Windows 上没有 `zip` 命令（只有 unzip），Node 无法直接重打包 pptx，
#       故用 Python zipfile 完成。调用方式：
#   python scripts/repack-pptx.py <pptx路径> <截图目录>
#
# 映射：ppt/media/image-N-M.png ← 截图文件名（按 2026-10-10 核实的对应关系）
import os
import sys
import zipfile
import tempfile
import shutil

# pptx 内嵌 media ↔ 应用截图 的对应关系（md5 已核实）
MEDIA_MAP = {
    "image-4-1.png": "02-school.png",
    "image-5-1.png": "03-school-6p.png",
    "image-6-1.png": "04-workshop.png",
    "image-7-1.png": "05-baojian.png",
    "image-8-1.png": "06-quake.png",
    "image-9-1.png": "07-palace-eave.png",
    "image-9-2.png": "08-palace-dusk.png",
}


def main():
    if len(sys.argv) < 3:
        print("用法: python repack-pptx.py <pptx路径> <截图目录>")
        sys.exit(2)
    pptx = sys.argv[1]
    shots_dir = sys.argv[2]
    if not os.path.exists(pptx):
        print("找不到 pptx:", pptx)
        sys.exit(1)
    if not os.path.isdir(shots_dir):
        print("找不到截图目录:", shots_dir)
        sys.exit(1)

    # 1) 读原 pptx 所有条目
    with zipfile.ZipFile(pptx, "r") as z:
        names = z.namelist()
        blobs = {n: z.read(n) for n in names}
        infos = {n: z.getinfo(n) for n in names}

    # 2) 替换 media
    replaced = []
    for media_name, shot_name in MEDIA_MAP.items():
        zip_path = "ppt/media/" + media_name
        shot_path = os.path.join(shots_dir, shot_name)
        if zip_path not in blobs:
            print("  ⚠️  pptx 内无", zip_path, "，跳过")
            continue
        if not os.path.exists(shot_path):
            print("  ⚠️  截图缺失", shot_name, "，跳过")
            continue
        with open(shot_path, "rb") as f:
            new_bytes = f.read()
        old_size = len(blobs[zip_path])
        blobs[zip_path] = new_bytes
        replaced.append(media_name)
        print(f"  替换 {media_name} ← {shot_name}  ({old_size:,} → {len(new_bytes):,} B)")

    if not replaced:
        print("❌ 没有任何内嵌图被替换")
        sys.exit(1)

    # 3) 重打包：[Content_Types].xml 必须第一个且不压缩（OOXML 规范）
    tmp_out = pptx + ".repack.tmp"
    CT = "[Content_Types].xml"
    order = [CT] + [n for n in names if n != CT]
    with zipfile.ZipFile(tmp_out, "w", zipfile.ZIP_DEFLATED) as z:
        for n in order:
            zi = infos[n]
            # 保留原压缩类型；[Content_Types].xml 强制 STORED
            compress = zipfile.ZIP_STORED if n == CT else zi.compress_type
            newinfo = zipfile.ZipInfo(n, date_time=zi.date_time)
            newinfo.compress_type = compress
            newinfo.external_attr = zi.external_attr
            newinfo.internal_attr = zi.internal_attr
            newinfo.create_system = zi.create_system
            z.writestr(newinfo, blobs[n])

    # 4) 覆盖写回（可能被预览面板占用，直接 bytes 覆盖可成功）
    with open(tmp_out, "rb") as f:
        data = f.read()
    with open(pptx, "wb") as f:
        f.write(data)
    os.remove(tmp_out)

    print(f"✅ 重打包完成：替换 {len(replaced)} 张，{os.path.getsize(pptx):,} B")


if __name__ == "__main__":
    main()
