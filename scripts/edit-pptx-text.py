# -*- coding: utf-8 -*-
# pptx 文本节点级替换（安全版）
#
# 铁律（见 MEMORY.md）：
#   1. 文本标签正则用 <a:t(?:\s[^>]*)?>，不可用 <a:t[^>]*>
#   2. 逐文本节点独立替换，禁止聚合整段
#   3. [Content_Types].xml 必须首个且 STORED
#
# 用法: python edit-pptx-text.py <pptx> <映射json>
#   映射 json: {"ppt/slides/slide10.xml": {"42.75 KB": "73.40 KB", ...}}
import os
import sys
import json
import zipfile
import re
import tempfile
import shutil

T_RE = re.compile(r"<a:t(?:\s[^>]*)?>(.*?)</a:t>", re.S)


def main():
    if len(sys.argv) < 3:
        print("用法: python edit-pptx-text.py <pptx> <映射json>")
        sys.exit(2)
    pptx, mapfile = sys.argv[1], sys.argv[2]
    with open(mapfile, encoding="utf-8") as f:
        plan = json.load(f)  # {zip_path: {old: new}}
    if not os.path.exists(pptx):
        print("找不到 pptx:", pptx)
        sys.exit(1)

    with zipfile.ZipFile(pptx, "r") as z:
        names = z.namelist()
        blobs = {n: z.read(n) for n in names}
        infos = {n: z.getinfo(n) for n in names}

    total = 0
    for zip_path, mapping in plan.items():
        if zip_path not in blobs:
            print("!! 缺条目:", zip_path)
            continue
        xml = blobs[zip_path].decode("utf-8")
        hits = {k: 0 for k in mapping}

        # 逐节点替换：只在单个 <a:t> 节点内部做 old→new
        def repl(m):
            inner = m.group(1)
            out = inner
            for old, new in mapping.items():
                if old in out:
                    hits[old] += out.count(old)
                    out = out.replace(old, new)
            return m.group(0).replace(inner, out, 1)

        new_xml = T_RE.sub(repl, xml)
        # 校验：标签计数不变
        if len(T_RE.findall(xml)) != len(T_RE.findall(new_xml)):
            print("!! 标签数变化，中止:", zip_path)
            sys.exit(1)
        for k, v in hits.items():
            status = "OK" if v else "MISS"
            print(f"  [{status}] {zip_path}  {k!r} × {v}")
            if not v:
                print("       !! 未命中，请检查目标文本是否被拆分到多个节点")
            total += v
        blobs[zip_path] = new_xml.encode("utf-8")

    if not total:
        print("无任何替换，未写回")
        sys.exit(1)

    # 重打包：Content_Types.xml 首个且 STORED
    tmp = tempfile.mktemp(suffix=".pptx")
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zo:
        first = "[Content_Types].xml"
        order = [first] + [n for n in names if n != first]
        for n in order:
            zi = zipfile.ZipInfo(n, date_time=infos[n].date_time)
            zi.compress_type = zipfile.ZIP_STORED if n == first else infos[n].compress_type
            zi.external_attr = infos[n].external_attr
            zo.writestr(zi, blobs[n])

    # 覆盖（写 tmp → 读 bytes → 直接覆盖，规避占用 PermissionError）
    with open(tmp, "rb") as f:
        data = f.read()
    with open(pptx, "wb") as f:
        f.write(data)
    os.remove(tmp)
    print(f"\n完成 ✓ 共替换 {total} 处 → {pptx} ({len(data)} B)")


if __name__ == "__main__":
    main()
