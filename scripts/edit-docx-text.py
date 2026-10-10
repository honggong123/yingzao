# -*- coding: utf-8 -*-
# docx 文本节点级替换（安全版）
#
# 铁律（见 MEMORY.md）：
#   1. 文本标签正则用 <w:t(?:\s[^>]*)?>，不可用 <w:t[^>]*>（会误匹配 <w:tab/>、<w:tbl>）
#   2. 逐文本节点独立替换，禁止聚合整段（会污染 TOC 页码）
#   3. 替换后校验标签计数与原始基准一致
#
# 用法: python edit-docx-text.py <docx> <映射json>
#   映射 json: {"word/document.xml": {"42.75": "73.40", ...}}
#   可选 :scope —— 限定替换区间（起止字符串），防止同名数值在别处被误改
import os
import sys
import json
import zipfile
import re
import tempfile

T_RE = re.compile(r"<w:t(?:\s[^>]*)?>(.*?)</w:t>", re.S)


def main():
    if len(sys.argv) < 3:
        print("用法: python edit-docx-text.py <docx> <映射json>")
        sys.exit(2)
    docx, mapfile = sys.argv[1], sys.argv[2]
    with open(mapfile, encoding="utf-8") as f:
        plan = json.load(f)
    if not os.path.exists(docx):
        print("找不到 docx:", docx)
        sys.exit(1)

    with zipfile.ZipFile(docx, "r") as z:
        names = z.namelist()
        blobs = {n: z.read(n) for n in names}
        infos = {n: z.getinfo(n) for n in names}

    total = 0
    for zip_path, cfg in plan.items():
        mapping = cfg.get("map", cfg) if isinstance(cfg, dict) else cfg
        scope = cfg.get("scope") if isinstance(cfg, dict) else None
        if zip_path not in blobs:
            print("!! 缺条目:", zip_path)
            continue
        xml = blobs[zip_path].decode("utf-8")
        base_tags = len(T_RE.findall(xml))
        hits = {k: 0 for k in mapping}

        # 若给定 scope，只在 scope 区间内替换
        if scope:
            a, b = scope
            ia, ib = xml.find(a), xml.find(b)
            if ia < 0 or ib < 0 or ib <= ia:
                print(f"!! scope 定位失败: {scope}")
                sys.exit(1)
            head, mid, tail = xml[:ia], xml[ia:ib], xml[ib:]
            mid = T_RE.sub(lambda m: _sub(m, mapping, hits), mid)
            new_xml = head + mid + tail
        else:
            new_xml = T_RE.sub(lambda m: _sub(m, mapping, hits), xml)

        if len(T_RE.findall(new_xml)) != base_tags:
            print("!! 标签数变化，中止:", zip_path)
            sys.exit(1)
        for k, v in hits.items():
            print(f"  [{'OK' if v else 'MISS'}] {k!r} × {v}")
        if any(v == 0 for v in hits.values()):
            print("  !! 有未命中项，请检查 scope 或文本是否被拆分")
        total += sum(hits.values())
        blobs[zip_path] = new_xml.encode("utf-8")

    if not total:
        print("无任何替换，未写回")
        sys.exit(1)

    tmp = tempfile.mktemp(suffix=".docx")
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zo:
        first = "[Content_Types].xml"
        for n in [first] + [x for x in names if x != first]:
            zi = zipfile.ZipInfo(n, date_time=infos[n].date_time)
            zi.compress_type = zipfile.ZIP_STORED if n == first else infos[n].compress_type
            zi.external_attr = infos[n].external_attr
            zo.writestr(zi, blobs[n])
    with open(tmp, "rb") as f:
        data = f.read()
    with open(docx, "wb") as f:
        f.write(data)
    os.remove(tmp)
    print(f"\n完成 ✓ 共替换 {total} 处 → {docx} ({len(data)} B)")


def _sub(m, mapping, hits):
    inner = m.group(1)
    out = inner
    for old, new in mapping.items():
        if old in out:
            hits[old] += out.count(old)
            out = out.replace(old, new)
    return m.group(0).replace(inner, out, 1)


if __name__ == "__main__":
    main()
