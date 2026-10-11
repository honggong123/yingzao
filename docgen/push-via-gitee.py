# 通过 git 直推把本地源码同步到 Gitee（与 GitHub 保持一致的镜像）
# ----------------------------------------------------------------------------
# 用途：铁律①「改源码后推送 Gitee」。
# 说明：Gitee OpenAPI v5 未提供 git/refs 端点，无法用 Git Data API 移动分支；
#       实测 `git push` 到 Gitee 传输正常，故改用 git 直推（更简单、更可靠）。
#       本地仓库为唯一真源，Gitee 侧按镜像处理 → 默认 --force 覆盖远端。
#
# 凭据来源（优先级）：
#   1) 环境变量  GITEE_TOKEN / GITEE_REPO / GITEE_BRANCH
#   2) 同目录配置文件 docgen/.gitee.env（每行 KEY=VALUE，# 注释；已 gitignore）
# 生成令牌：https://gitee.com/profile/personal_access_tokens（勾 projects 权限）
#
# 用法：
#   python docgen/push-via-gitee.py            # 强制推送（镜像同步）
#   python docgen/push-via-gitee.py --no-force # 普通推送（远端有新提交时会被拒）
#   python docgen/push-via-gitee.py --check    # 仅校验凭据与仓库可达性
#   python docgen/push-via-gitee.py --dry      # 只打印将执行的命令
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(HERE)
ENV_FILE = os.path.join(HERE, ".gitee.env")

FORCE = "--no-force" not in sys.argv
CHECK_ONLY = "--check" in sys.argv
DRY = "--dry" in sys.argv


def load_env_file(path):
    cfg = {}
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                cfg[k.strip()] = v.strip().strip('"').strip("'")
    return cfg


_cfg = load_env_file(ENV_FILE)
TOKEN = os.environ.get("GITEE_TOKEN") or _cfg.get("GITEE_TOKEN", "")
REPO = os.environ.get("GITEE_REPO") or _cfg.get("GITEE_REPO", "")
BRANCH = os.environ.get("GITEE_BRANCH") or _cfg.get("GITEE_BRANCH", "master")

if not REPO or "/" not in REPO:
    sys.exit("[SKIP] 未配置 GITEE_REPO（格式 owner/repo）—— 见 docgen/.gitee.env 或环境变量")
if not TOKEN:
    sys.exit("[SKIP] 未配置 GITEE_TOKEN —— https://gitee.com/profile/personal_access_tokens")

USER, NAME = REPO.split("/", 1)
URL = f"https://{USER}:{TOKEN}@gitee.com/{REPO}.git"
SAFE_URL = f"https://{USER}:***@gitee.com/{REPO}.git"  # 打印用（脱敏）

print(f"目标仓库: gitee.com/{REPO}  分支: {BRANCH}  模式: {'force' if FORCE else 'normal'}")


def git(args, **kw):
    cmd = ["git", *args]
    shown = [a.replace(TOKEN, "***") for a in cmd]
    print("  $ " + " ".join(shown))
    if DRY:
        return subprocess.CompletedProcess(cmd, 0, "", "")
    return subprocess.run(cmd, cwd=PROJECT, text=True, encoding="utf-8", capture_output=True, **kw)


# ── 校验 ────────────────────────────────────────────────────────────────────
if CHECK_ONLY:
    r = git(["ls-remote", "--heads", URL, BRANCH])
    if r.returncode == 0:
        print("凭据与仓库可达 ✓")
        if r.stdout.strip():
            print("  远端分支:", r.stdout.strip())
        else:
            print("  远端分支为空（首次推送将创建）")
        sys.exit(0)
    print("校验失败：", (r.stderr or r.stdout).strip()[:300])
    sys.exit(1)

# ── 推送 ────────────────────────────────────────────────────────────────────
args = ["push"]
if FORCE:
    args.append("--force")
args += [URL, f"HEAD:{BRANCH}"]

r = git(args)
out = (r.stdout or "") + (r.stderr or "")
print(out.replace(TOKEN, "***").strip())

if r.returncode == 0:
    head = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=PROJECT,
                          capture_output=True, text=True).stdout.strip()
    print(f"完成 ✓ commit {head} 已推送至 gitee.com/{REPO} ({BRANCH})")
else:
    print(f"推送失败（exit {r.returncode}）")
    sys.exit(1)
