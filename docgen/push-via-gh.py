# 通过 gh CLI（自带网络栈与凭据）+ GitHub Git Data API 上传仓库
# 流程：种子（如空仓库）→ blobs → tree → commit → 更新 ref；带重试
import base64
import json
import os
import subprocess
import tempfile
import time

REPO = "honggong123/yingzao"
BRANCH = "main"

TMP = tempfile.gettempdir()


def api(path, payload=None, method=None, tries=6):
    """调用 gh api，payload 写临时文件（支持大 JSON），带重试"""
    url = f"repos/{REPO}/{path}"
    cmd = ["gh", "api", url, "--method", method or ("POST" if payload else "GET")]
    tmp_path = None
    if payload is not None:
        tmp_path = os.path.join(TMP, f"gh-payload-{abs(hash(path + str(time.time())))}.json")
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
        cmd += ["--input", tmp_path]
    last_err = None
    for attempt in range(tries):
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=120, encoding="utf-8")
            if r.returncode == 0:
                if tmp_path and os.path.exists(tmp_path):
                    os.remove(tmp_path)
                return json.loads(r.stdout) if r.stdout.strip() else {}
            last_err = (r.stderr or r.stdout or "unknown").strip()[:200]
            if "404" in last_err and attempt >= 2:
                break  # 连续真实 404
            print(f"    retry {attempt + 1}: {last_err[:80]}")
        except subprocess.TimeoutExpired:
            last_err = "timeout"
            print(f"    retry {attempt + 1}: timeout")
        time.sleep(2 * (attempt + 1))
    if tmp_path and os.path.exists(tmp_path):
        os.remove(tmp_path)
    raise RuntimeError(f"gh api {url} 失败: {last_err}")


def head_ref():
    try:
        return api(f"git/refs/heads/{BRANCH}")
    except RuntimeError as e:
        if "404" in str(e):
            return None
        raise


def gh_token():
    return subprocess.run(["gh", "auth", "token"], capture_output=True, text=True, check=True).stdout.strip()


# 1) 空仓库种子提交
ref = head_ref()
if ref is None:
    print("空仓库：种入 README 初始提交…")
    with open("README.md", "rb") as f:
        readme_b64 = base64.b64encode(f.read()).decode()
    api("contents/README.md", {"message": "init: 种子提交", "content": readme_b64}, "PUT", tries=8)
    ref = head_ref()
    print(f"种子提交完成: {ref['object']['sha'][:8]}")

head_sha = ref["object"]["sha"]
base_tree = api(f"git/commits/{head_sha}")["tree"]["sha"]

# 2) 文件清单
files = subprocess.run(
    ["git", "-c", "core.quotepath=false", "ls-files"],
    capture_output=True, text=True, check=True, encoding="utf-8"
).stdout.splitlines()
files = [f.strip() for f in files if f.strip()]
print(f"待上传文件: {len(files)} 个")

# 3) 上传 blobs（大文件写临时 JSON 再 --input）
tree_items = []
for i, path in enumerate(files, 1):
    with open(path, "rb") as f:
        content = base64.b64encode(f.read()).decode()
    payload = {"content": content, "encoding": "base64"}
    payload_file = os.path.join(TMP, f"gh-blob-{i}.json")
    with open(payload_file, "w") as f:
        json.dump(payload, f)
    cmd = ["gh", "api", f"repos/{REPO}/git/blobs", "--method", "POST", "--input", payload_file]
    for attempt in range(6):
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        if r.returncode == 0:
            blob = json.loads(r.stdout)
            break
        print(f"    blob retry {attempt + 1}: {(r.stderr or '').strip()[:80]}")
        time.sleep(2 * (attempt + 1))
    else:
        raise RuntimeError(f"blob {path} 上传失败")
    os.remove(payload_file)
    mode = "100755" if path.endswith(".bat") else "100644"
    tree_items.append({"path": path, "mode": mode, "type": "blob", "sha": blob["sha"]})
    print(f"  [{i}/{len(files)}] {path} -> {blob['sha'][:8]}")

# 4) tree → commit → 更新 ref
tree_payload = {"base_tree": base_tree, "tree": tree_items}
tree_file = os.path.join(TMP, "gh-tree.json")
with open(tree_file, "w", encoding="utf-8") as f:
    json.dump(tree_payload, f, ensure_ascii=False)
tree = api("git/trees", method="POST") if False else None
# tree 载荷较大，同样走 --input
for attempt in range(6):
    r = subprocess.run(["gh", "api", f"repos/{REPO}/git/trees", "--method", "POST", "--input", tree_file],
                       capture_output=True, text=True, timeout=180)
    if r.returncode == 0:
        tree = json.loads(r.stdout)
        break
    print(f"    tree retry {attempt + 1}: {(r.stderr or '').strip()[:80]}")
    time.sleep(2 * (attempt + 1))
else:
    raise RuntimeError("tree 创建失败")

commit_payload = {
    "message": "《营造》v0.8 —— 拼装次序严格依《营造法式》：杪昂组合依图样定名（七铺作双杪双昂/八铺作双杪三昂）、昂尾坐前跳头斗口层层咬合、昂层偷心、次序面板附卷四原文",
    "tree": tree["sha"],
    "parents": [head_sha],
}
commit_file = os.path.join(TMP, "gh-commit.json")
with open(commit_file, "w", encoding="utf-8") as f:
    json.dump(commit_payload, f, ensure_ascii=False)
for attempt in range(6):
    r = subprocess.run(["gh", "api", f"repos/{REPO}/git/commits", "--method", "POST", "--input", commit_file],
                       capture_output=True, text=True, timeout=180)
    if r.returncode == 0:
        commit = json.loads(r.stdout)
        break
    time.sleep(2 * (attempt + 1))
else:
    raise RuntimeError("commit 创建失败")

ref_payload = {"sha": commit["sha"], "force": False}
ref_file = os.path.join(TMP, "gh-ref.json")
with open(ref_file, "w", encoding="utf-8") as f:
    json.dump(ref_payload, f)
for attempt in range(6):
    r = subprocess.run(["gh", "api", f"repos/{REPO}/git/refs/heads/{BRANCH}", "--method", "PATCH", "--input", ref_file],
                       capture_output=True, text=True, timeout=180)
    if r.returncode == 0:
        print(f"完成 ✓ commit {commit['sha'][:8]} 已上传至 github.com/{REPO} ({BRANCH})")
        break
    print(f"    ref retry {attempt + 1}")
    time.sleep(2 * (attempt + 1))
else:
    raise RuntimeError("ref 更新失败")

for f in (tree_file, commit_file, ref_file):
    if os.path.exists(f):
        os.remove(f)
