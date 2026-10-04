# 通过 gh CLI 将 dist 部署到 GitHub Pages（gh-pages 分支）
import base64
import json
import os
import subprocess
import tempfile
import time

REPO = "honggong123/yingzao"
DIST = "D:/比赛4/yingzao/dist"
TMP = tempfile.gettempdir()


def gh_api(path, payload=None, method="GET", tries=5):
    url = f"repos/{REPO}/{path}"
    input_file = None
    cmd = ["gh", "api", url, "--method", method]
    if payload is not None:
        input_file = os.path.join(TMP, f"gh-deploy-{abs(hash(path + str(time.time())))}.json")
        with open(input_file, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
        cmd += ["--input", input_file]
    for attempt in range(tries):
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120, encoding="utf-8")
        if r.returncode == 0:
            if input_file and os.path.exists(input_file):
                os.remove(input_file)
            return json.loads(r.stdout) if r.stdout.strip() else {}
        err = (r.stderr or r.stdout or "").strip()[:120]
        if "404" in err and attempt >= 2:
            break
        print(f"  retry {attempt + 1}: {err[:80]}")
        time.sleep(2 * (attempt + 1))
    if input_file and os.path.exists(input_file):
        os.remove(input_file)
    raise RuntimeError(f"gh api {url} 失败: {err}")


# 1) 收集 dist 文件并上传 blobs
tree_items = []
count = 0
for root, dirs, fnames in os.walk(DIST):
    dirs[:] = [d for d in dirs if not d.startswith(".")]
    for fn in fnames:
        fp = os.path.join(root, fn)
        rel = os.path.relpath(fp, DIST).replace("\\", "/")
        with open(fp, "rb") as f:
            content = base64.b64encode(f.read()).decode()
        payload_file = os.path.join(TMP, f"gh-blob-{count}.json")
        with open(payload_file, "w") as f:
            json.dump({"content": content, "encoding": "base64"}, f)
        r = subprocess.run(
            ["gh", "api", f"repos/{REPO}/git/blobs", "--method", "POST", "--input", payload_file],
            capture_output=True, text=True, timeout=120, encoding="utf-8"
        )
        os.remove(payload_file)
        if r.returncode != 0:
            print(f"  blob 失败: {rel}")
            continue
        blob = json.loads(r.stdout)
        tree_items.append({"path": rel, "mode": "100644", "type": "blob", "sha": blob["sha"]})
        count += 1
        print(f"  blob {count}: {rel}")

print(f"共上传 {count} 个 blob")

# 2) 建 tree
tree_file = os.path.join(TMP, "gh-tree.json")
with open(tree_file, "w", encoding="utf-8") as f:
    json.dump({"tree": tree_items}, f, ensure_ascii=False)
tree = gh_api("git/trees", method="POST") if False else None
# 用 --input 方式
r = subprocess.run(
    ["gh", "api", f"repos/{REPO}/git/trees", "--method", "POST", "--input", tree_file],
    capture_output=True, text=True, timeout=120, encoding="utf-8"
)
if r.returncode != 0:
    raise RuntimeError(f"tree 失败: {r.stderr[:200]}")
tree = json.loads(r.stdout)
print(f"tree: {tree['sha'][:8]}")

# 3) 建 commit
commit_payload = {"message": "deploy: 营造演示站点", "tree": tree["sha"]}
commit_file = os.path.join(TMP, "gh-commit.json")
with open(commit_file, "w", encoding="utf-8") as f:
    json.dump(commit_payload, f)
r = subprocess.run(
    ["gh", "api", f"repos/{REPO}/git/commits", "--method", "POST", "--input", commit_file],
    capture_output=True, text=True, timeout=120, encoding="utf-8"
)
if r.returncode != 0:
    raise RuntimeError(f"commit 失败: {r.stderr[:200]}")
commit = json.loads(r.stdout)
print(f"commit: {commit['sha'][:8]}")

# 4) 建/更新 gh-pages ref
ref_payload = {"sha": commit["sha"], "force": True}
ref_file = os.path.join(TMP, "gh-ref.json")
with open(ref_file, "w", encoding="utf-8") as f:
    json.dump(ref_payload, f)
try:
    r = subprocess.run(
        ["gh", "api", f"repos/{REPO}/git/refs/heads/gh-pages", "--method", "PATCH", "--input", ref_file],
        capture_output=True, text=True, timeout=120, encoding="utf-8"
    )
    if r.returncode != 0:
        raise RuntimeError("patch failed")
    print("gh-pages ref 更新 ✓")
except RuntimeError:
    r = subprocess.run(
        ["gh", "api", f"repos/{REPO}/git/refs", "--method", "POST", "--input", ref_file],
        capture_output=True, text=True, timeout=120, encoding="utf-8"
    )
    if r.returncode != 0:
        raise RuntimeError(f"ref 创建失败: {r.stderr[:200]}")
    print("gh-pages ref 创建 ✓")

print(f"\n部署完成！")
print(f"GitHub Pages 链接: https://honggong123.github.io/yingzao/")
print(f"（Pages 源已设为 gh-pages 分支，GitHub 正在构建，约 1 分钟后生效）")
