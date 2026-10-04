# 用 Contents API 逐文件上传 dist 到 gh-pages 分支
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


def gh(path, method="GET", payload=None, tries=4):
    url = f"repos/{REPO}/{path}"
    cmd = ["gh", "api", url, "--method", method]
    inp = None
    if payload is not None:
        inp = os.path.join(TMP, f"ghd-{abs(hash(path + method + str(time.time()))) % 99999}.json")
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
        print(f"  retry {i + 1}: {err[:80]}")
        time.sleep(2 * (i + 1))
    if inp and os.path.exists(inp):
        os.remove(inp)
    raise RuntimeError(f"gh api {path} 失败")


# 1) 清理旧的 gh-pages ref（指向了无效 commit）
print("清理旧 gh-pages ref…")
try:
    gh("git/refs/heads/gh-pages", "DELETE")
    print("  已删除")
except RuntimeError as e:
    if "404" in str(e):
        print("  本就不存在")
    else:
        print(f"  删除结果: {e}")

# 2) 逐文件上传到 gh-pages 分支（Contents API PUT 自动处理分支创建）
count = 0
for root, dirs, fnames in os.walk(DIST):
    dirs[:] = [d for d in dirs if not d.startswith(".")]
    for fn in sorted(fnames):
        fp = os.path.join(root, fn)
        rel = os.path.relpath(fp, DIST).replace("\\", "/")
        with open(fp, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        payload = {
            "message": f"deploy: {rel}",
            "content": b64,
            "branch": BRANCH,
        }
        try:
            gh(f"contents/{rel}", "PUT", payload)
            count += 1
            print(f"  ✓ {rel}")
        except RuntimeError as e:
            print(f"  ✗ {rel}: {e}")

print(f"\n共上传 {count} 个文件")
print(f"链接: https://honggong123.github.io/yingzao/")
