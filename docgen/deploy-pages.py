# 完整重新部署 dist 到 GitHub Pages（gh-pages 分支）
# 全部通过 gh api 子进程执行（该路径已验证可达）
import base64
import json
import os
import subprocess
import tempfile
import time

REPO = "honggong123/yingzao"
DIST = "D:/比赛4/yingzao/dist"
TMP = tempfile.gettempdir()
OK = "\u2713"


def gh_api(path, method="GET", payload=None, tries=4):
    url = f"repos/{REPO}/{path}"
    cmd = ["gh", "api", url, "--method", method]
    inp = None
    if payload is not None:
        inp = os.path.join(TMP, f"ghapi-{abs(hash(path + method + str(time.time())))}.json")
        with open(inp, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
        cmd += ["--input", inp]
    for i in range(tries):
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120, encoding="utf-8")
        if r.returncode == 0 and r.stdout.strip():
            if inp:
                os.remove(inp)
            return json.loads(r.stdout)
        err = (r.stderr or "").strip()[:100]
        print(f"  retry {i + 1}: {err}")
        time.sleep(2 * (i + 1))
    raise RuntimeError(f"gh api {path} 失败")


# 1) 上传 blobs
print("1. 上传 blobs…")
blobs = {}
for root, dirs, fnames in os.walk(DIST):
    for fn in fnames:
        fp = os.path.join(root, fn)
        rel = os.path.relpath(fp, DIST).replace("\\", "/")
        with open(fp, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        p_file = os.path.join(TMP, "b.json")
        with open(p_file, "w") as f:
            json.dump({"content": b64, "encoding": "base64"}, f)
        r = subprocess.run(["gh", "api", f"repos/{REPO}/git/blobs", "--method", "POST", "--input", p_file],
                           capture_output=True, text=True, timeout=120, encoding="utf-8")
        if r.returncode != 0:
            raise RuntimeError(f"blob {rel} 失败: {r.stderr[:100]}")
        blobs[rel] = json.loads(r.stdout)["sha"]
        os.remove(p_file)
        print(f"  {rel}")

# 2) 建 tree
print("2. 建 tree…")
tree_items = [{"path": rel, "mode": "100644", "type": "blob", "sha": sha} for rel, sha in blobs.items()]
tree_file = os.path.join(TMP, "tree.json")
with open(tree_file, "w", encoding="utf-8") as f:
    json.dump({"tree": tree_items}, f, ensure_ascii=False)
tree = gh_api("git/trees", method="POST")
print(f"  tree: {tree['sha'][:8]}")

# 3) 建 commit（父设为 main 的当前 head，保持历史）
main_ref = gh_api("git/refs/heads/main")
commit_payload = {
    "message": "deploy: 营造演示站点",
    "tree": tree["sha"],
    "parents": [main_ref["object"]["sha"]],
}
commit_file = os.path.join(TMP, "commit.json")
with open(commit_file, "w", encoding="utf-8") as f:
    json.dump(commit_payload, f, ensure_ascii=False)
commit = gh_api("git/commits", method="POST")
print(f"  commit: {commit['sha'][:8]}")

# 4) 建 gh-pages 分支指向该 commit
print("3. 建 gh-pages 分支…")
try:
    gh_api("git/refs", {"ref": "refs/heads/gh-pages", "sha": commit["sha"]}, "POST")
    print("  gh-pages ✓")
except RuntimeError as e:
    if "422" in str(e):
        gh_api("git/refs/heads/gh-pages", {"sha": commit["sha"]}, "PATCH")
        print("  gh-pages 更新 ✓")
    else:
        raise

# 5) 更新 Pages 源
print("4. 更新 Pages 源…")
gh_api("/pages", {"source": {"branch": "gh-pages", "path": "/"}}, "PUT")

url = f"https://honggong123.github.io/{REPO.split('/')[1]}/"
print(f"\n{OK} 部署完成！")
print(f"线上链接: {url}")
