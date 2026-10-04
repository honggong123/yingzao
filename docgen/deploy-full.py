# Git Data API 完整部署：blob → tree → commit → force-update gh-pages ref
import base64
import json
import os
import subprocess
import tempfile
import time

REPO = "honggong123/yingzao"
DIST = "D:/比赛4/yingzao/dist"
TMP = tempfile.gettempdir()


def gh(method, path, payload=None, tries=5):
    url = f"repos/{REPO}/{path}"
    cmd = ["gh", "api", "--method", method, url]
    inp = None
    if payload is not None:
        inp = os.path.join(TMP, f"gh-{abs(hash(path + method + str(time.time()))) % 99999}.json")
        with open(inp, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
        cmd += ["--input", inp]
    for i in range(tries):
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120, encoding="utf-8")
        if r.returncode == 0:
            if inp and os.path.exists(inp):
                os.remove(inp)
            return json.loads(r.stdout) if r.stdout.strip() else {}
        err = (r.stderr or r.stdout or "").strip()[:100]
        if i == tries - 1:
            if inp and os.path.exists(inp):
                os.remove(inp)
            raise RuntimeError(f"gh api {path} -> {err}")
        print(f"  retry {i + 1}: {err[:60]}")
        time.sleep(2 * (i + 1))


# 1) 上传 blobs
print("1. 上传 blobs…")
blobs = {}
for root, dirs, fnames in os.walk(DIST):
    for fn in fnames:
        fp = os.path.join(root, fn)
        rel = os.path.relpath(fp, DIST).replace("\\", "/")
        with open(fp, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        p_file = os.path.join(TMP, "blob.json")
        with open(p_file, "w") as f:
            json.dump({"content": b64, "encoding": "base64"}, f)
        r = subprocess.run(["gh", "api", "--method", "POST", f"repos/{REPO}/git/blobs", "--input", p_file],
                           capture_output=True, text=True, timeout=120, encoding="utf-8")
        os.remove(p_file)
        if r.returncode != 0:
            raise RuntimeError(f"blob {rel} 失败: {r.stderr[:100]}")
        blobs[rel] = json.loads(r.stdout)["sha"]
        print(f"  ✓ {rel}")

# 2) 建 tree（仅包含 dist 文件）
print("2. 建 tree…")
tree_items = [{"path": rel, "mode": "100644", "type": "blob", "sha": sha} for rel, sha in blobs.items()]
tree_file = os.path.join(TMP, "tree.json")
with open(tree_file, "w", encoding="utf-8") as f:
    json.dump({"tree": tree_items}, f, ensure_ascii=False)
tree = gh("POST", "git/trees", json.load(open(tree_file)))
print(f"  tree: {tree['sha'][:8]}")

# 3) 建 commit（无 parent = 孤儿提交，干净起步）
print("3. 建 commit…")
commit = gh("POST", "git/commits", {
    "message": "deploy: 营造演示站点（构建产物）",
    "tree": tree["sha"],
})
print(f"  commit: {commit['sha'][:8]}")

# 4) 强制更新 gh-pages ref
print("4. 更新 gh-pages ref…")
gh("PATCH", "git/refs/heads/gh-pages", {"sha": commit["sha"], "force": True})
print(f"  ✓ gh-pages → {commit['sha'][:8]}")

# 5. 设置 Pages 源为 gh-pages
print("5. 设置 Pages 源…")
gh("PUT", "/pages", {"source": {"branch": "gh-pages", "path": "/"}})
print("  ✓ Pages 源 → gh-pages")

url = "https://honggong123.github.io/yingzao/"
print(f"\n{'=' * 50}")
print(f"部署完成！")
print(f"线上链接: {url}")
print(f"GitHub 正在构建，约 1 分钟后生效")
