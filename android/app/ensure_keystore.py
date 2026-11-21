"""CI 用：把 GitHub Secrets 的上傳金鑰解碼到 repo 外的暫存目錄，並驗證可用。

安全規則（2026-11-21 修正）：
- 金鑰只寫到 $RUNNER_TEMP（repo 外），絕不寫進 repo，避免被 `git add` 帶進公開 repo。
- Secrets 缺少或無效時直接失敗，絕不自行產生新金鑰（新金鑰簽的 AAB 會被 Play 拒收）。
- 不使用任何寫死的預設密碼。
成功時把 RELEASE_KEYSTORE_PATH / RELEASE_STORE_PASSWORD / RELEASE_KEY_PASSWORD / RELEASE_KEY_ALIAS
寫入 $GITHUB_ENV，交給 app/build.gradle.kts 的 release signingConfig。
"""
import base64
import os
import re
import subprocess
import sys
import tempfile


def fail(msg: str) -> None:
    print(f"::error::{msg}")
    sys.exit(1)


def check_keystore(path: str, store_pass: str, key_pass: str, alias: str) -> bool:
    cmd = ["keytool", "-exportcert", "-alias", alias, "-keystore", path,
           "-storepass", store_pass, "-keypass", key_pass]
    try:
        return subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
    except Exception:
        return False


def find_aliases(path: str, store_pass: str) -> list:
    try:
        res = subprocess.run(["keytool", "-list", "-keystore", path, "-storepass", store_pass],
                             capture_output=True, text=True)
    except Exception:
        return []
    if res.returncode != 0:
        return []
    aliases = []
    for line in res.stdout.splitlines():
        if "," in line and "entry" in line.lower():
            aliases.append(line.split(",")[0].strip())
    return aliases


def main() -> None:
    b64 = os.environ.get("RELEASE_KEYSTORE_BASE64", "").strip()
    store_pass = os.environ.get("RELEASE_STORE_PASSWORD", "").strip()
    key_pass = os.environ.get("RELEASE_KEY_PASSWORD", "").strip() or store_pass
    alias = os.environ.get("RELEASE_KEY_ALIAS", "").strip()

    if not b64 or not store_pass:
        fail("缺少 RELEASE_KEYSTORE_BASE64 或 RELEASE_STORE_PASSWORD（GitHub Secrets），停止建置。")

    try:
        data = base64.b64decode(re.sub(r"[^A-Za-z0-9+/=]", "", b64))
    except Exception:
        fail("RELEASE_KEYSTORE_BASE64 不是有效的 Base64。")

    out_dir = os.environ.get("RUNNER_TEMP") or tempfile.gettempdir()
    ks_path = os.path.join(out_dir, "bilingo-upload.keystore")
    with open(ks_path, "wb") as f:
        f.write(data)

    # 依序嘗試：指定的 alias；key 密碼與 store 密碼相同；金鑰庫裡實際的 alias
    candidates = [(alias, key_pass), (alias, store_pass)] if alias else []
    for a in find_aliases(ks_path, store_pass):
        candidates += [(a, key_pass), (a, store_pass)]
    for a, kp in candidates:
        if a and check_keystore(ks_path, store_pass, kp, a):
            alias, key_pass = a, kp
            break
    else:
        fail("無法用 Secrets 的密碼與 alias 開啟上傳金鑰，停止建置（不會產生新金鑰）。")

    print(f"上傳金鑰驗證成功（alias: {alias}），位置在 repo 外的暫存目錄。")
    github_env = os.environ.get("GITHUB_ENV")
    if github_env:
        with open(github_env, "a") as f:
            f.write(f"RELEASE_KEYSTORE_PATH={ks_path}\n")
            f.write(f"RELEASE_STORE_PASSWORD={store_pass}\n")
            f.write(f"RELEASE_KEY_PASSWORD={key_pass}\n")
            f.write(f"RELEASE_KEY_ALIAS={alias}\n")


if __name__ == "__main__":
    main()
