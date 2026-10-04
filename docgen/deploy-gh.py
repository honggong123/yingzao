# 通过 gh CLI 部署 dist 到 GitHub Pages（gh-pages 分支）
# 步骤：创建 gh-pages 分支 → 逐文件 Contents API 上传 → 触发构建
import base64
import json
import os
import subprocess
import tempfile
import time

REPO = "honggong123/yingzao"
DIST = "D:/比赛4/yingzao/dist"
BRANCH = "gh-pages"
TMP = tempfile.gettempdir()


def gh_api(path, method="GET", payload=None, tries=4):
    url = f"repos/{REPO}/{path}"
    cmd = ["gh", "api", "--method", method, url]
    inp = None
    if payload is not None:
        inp = os.path.join(TMP, f"ghp-{abs(hash(path + method + str(time.time()))) % 99999}.json")
        with open(inp, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
        cmd += ["--input", inp]
    for i in range(tries):
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120, encoding="utf-8")
        if r.returncode == 0:
            if inp and os.path.exists(inp):
                os.remove(inp)
            return json.loads(r.stdout) if r.stdout.strip() else {}
        err = (r.stderr or r.stdout or "").strip()[:120]
        if i == tries - 1:
            if inp and os.path.exists(inp):
                os.remove(inp)
            raise RuntimeError(f"gh api {path} -> {err}")
        print(f"  retry {i + 1}: {err[:60]}")
        time.sleep(2 * (i + 1))


# ══ 1. 删除旧 gh-pages ref（如存在）══
print("清理旧 gh-pages…")
try:
    gh_api("git/refs/heads/gh-pages", "DELETE")
    print("  已删除")
except RuntimeError as e:
    if "404" in str(e) or "422" in str(e):
        print("  不存在，跳过")
    else:
        raise

# ══ 2. 从 main 创建 gh-pages 分支 ══
print("创建 gh-pages 分支…")
main_ref = gh_api("git/refs/heads/main")
gh_api("git/refs", "POST", {"ref": "refs/heads/gh-pages", "sha": main_ref["object"]["sha"]})
print(f"  ✓ 指向 main head: {main_ref['object']['sha'][:8]}")

# ══ 3. 逐文件上传到 gh-pages 分支 ══
print("上传构建产物…")
count = 0
for root, dirs, fnames in os.walk(DIST):
    dirs[:] = [d for d in dirs if not d.startswith(".")]
    for fn in sorted(fnames):
        fp = os.path.join(root, fn)
        rel = os.path.relpath(fp, DIST).replace("\\", "/")
        with open(fp, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()

        # 获取现有 SHA（如果文件已存在于 gh-pages）
        sha = None
        try:
            existing = gh_api(f"contents/{rel}?ref=gh-pages")
            sha = existing.get("sha")
        except RuntimeError:
            pass

        payload = {
            "message": f"deploy: {rel}",
            "content": b64,
            "branch": BRANCH,
        }
        if sha:
            payload["sha"] = sha

        result = gh_api(f"contents/{rel}", "PUT", payload)
        count += 1
        print(f"  ✓ {rel}")

# ══ 4. 更新 Pages 源为 gh-pages ══
print("更新 Pages 源…")
try:
    gh_api("/pages", "PUT", {"source": {"branch": BRANCH, "path": "/"}})
    print("  ✓")
except RuntimeError as e:
    if "404" in str(e):
        print("  Pages 源已是 gh-pages，跳过")
    else:
        print(f"  Pages 源更新: {e}")

print(f"\n✅ GitHub Pages 部署完成！")
print(f"链接: https://honggong123.github.io/yingzao/")
print(f"GitHub 正在构建，约 1 分钟后生效")
