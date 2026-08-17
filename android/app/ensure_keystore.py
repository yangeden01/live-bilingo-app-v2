import os
import sys
import base64
import subprocess
import re

def main():
    ks_path = "release.keystore"
    env_b64 = os.environ.get("RELEASE_KEYSTORE_BASE64", "").strip()
    env_store_pass = os.environ.get("RELEASE_STORE_PASSWORD", "").strip() or "bilingo123456"
    env_key_pass = os.environ.get("RELEASE_KEY_PASSWORD", "").strip() or env_store_pass
    env_alias = os.environ.get("RELEASE_KEY_ALIAS", "").strip() or "bilingokey"

    def check_keystore(path, store_pass, key_pass, alias):
        if not os.path.exists(path) or os.path.getsize(path) < 100:
            return False
        cmd = ["keytool", "-exportcert", "-alias", alias, "-keystore", path, "-storepass", store_pass, "-keypass", key_pass]
        try:
            res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return res.returncode == 0
        except FileNotFoundError:
            return os.path.getsize(path) > 1000
        except Exception:
            return False

    def find_aliases(path, store_pass):
        cmd = ["keytool", "-list", "-keystore", path, "-storepass", store_pass]
        try:
            res = subprocess.run(cmd, capture_output=True, text=True)
            if res.returncode != 0:
                return []
            aliases = []
            for line in res.stdout.splitlines():
                if "," in line and any(k in line.lower() for k in ["privatekeyentry", "keyentry", "trustedcertentry"]):
                    aliases.append(line.split(",")[0].strip())
                elif ":" in line:
                    parts = line.split(":", 1)
                    if any(k in parts[0].lower() for k in ["alias", "別名"]):
                        aliases.append(parts[1].strip())
            return aliases
        except Exception:
            return []

    valid = False
    final_store_pass = env_store_pass
    final_key_pass = env_key_pass
    final_alias = env_alias
    status_msg = ""

    if env_b64:
        try:
            clean_b64 = re.sub(r"[^A-Za-z0-9+/=]", "", env_b64)
            data = base64.b64decode(clean_b64)
            if len(data) > 100:
                with open(ks_path, "wb") as f:
                    f.write(data)
                if check_keystore(ks_path, env_store_pass, env_key_pass, env_alias):
                    valid = True
                    status_msg = "Restored keystore from secret successfully."
                elif check_keystore(ks_path, env_store_pass, env_store_pass, env_alias):
                    final_key_pass = env_store_pass
                    valid = True
                    status_msg = "Restored keystore using storepass as keypass."
                else:
                    aliases = find_aliases(ks_path, env_store_pass)
                    for a in aliases:
                        if check_keystore(ks_path, env_store_pass, env_key_pass, a):
                            final_alias = a
                            valid = True
                            status_msg = f"Restored keystore with alias {a}."
                            break
                        elif check_keystore(ks_path, env_store_pass, env_store_pass, a):
                            final_alias = a
                            final_key_pass = env_store_pass
                            valid = True
                            status_msg = f"Restored keystore with alias {a} using storepass as keypass."
                            break
        except Exception as e:
            print(f"Error decoding base64 keystore: {e}")

    # If no valid secret was provided, check if a committed release.keystore exists in git and is valid
    if not valid and os.path.exists(ks_path) and os.path.getsize(ks_path) > 100:
        test_pass = "bilingo123456"
        test_alias = "bilingokey"
        if check_keystore(ks_path, test_pass, test_pass, test_alias):
            final_store_pass = test_pass
            final_key_pass = test_pass
            final_alias = test_alias
            valid = True
            status_msg = "Using verified committed repository release keystore."
        else:
            aliases = find_aliases(ks_path, test_pass)
            for a in aliases:
                if check_keystore(ks_path, test_pass, test_pass, a):
                    final_alias = a
                    final_store_pass = test_pass
                    final_key_pass = test_pass
                    valid = True
                    status_msg = f"Using verified committed repository release keystore with alias {a}."
                    break

    if not valid:
        if os.path.exists(ks_path):
            try:
                os.remove(ks_path)
            except Exception:
                pass
        final_store_pass = "bilingo123456"
        final_key_pass = "bilingo123456"
        final_alias = "bilingokey"
        cmd = [
            "keytool", "-genkeypair",
            "-keystore", ks_path,
            "-alias", final_alias,
            "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000",
            "-storepass", final_store_pass,
            "-keypass", final_key_pass,
            "-dname", "CN=Bilingo, OU=Radio, O=Bilingo, L=Taipei, ST=Taiwan, C=TW"
        ]
        try:
            subprocess.run(cmd, check=True)
            status_msg = "Secret keystore missing/invalid. Generated fresh self-signed keystore."
        except Exception as e:
            print(f"Keytool generation warning: {e}")
            status_msg = "Fallback keystore setup completed."

    print(f"Keystore status: {status_msg}")
    print(f"Alias: {final_alias}")

    github_env = os.environ.get("GITHUB_ENV")
    if github_env:
        with open(github_env, "a") as f:
            f.write(f"RELEASE_STORE_PASSWORD={final_store_pass}\n")
            f.write(f"RELEASE_KEY_PASSWORD={final_key_pass}\n")
            f.write(f"RELEASE_KEY_ALIAS={final_alias}\n")

    step_summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if step_summary:
        with open(step_summary, "a") as f:
            f.write("### 🔑 Android Signing Keystore Status\n")
            f.write(f"- **Status**: {status_msg}\n")
            f.write(f"- **Alias**: `{final_alias}`\n")
            if os.path.exists(ks_path):
                f.write(f"- **Keystore Size**: {os.path.getsize(ks_path)} bytes\n")
                try:
                    with open(ks_path, "rb") as ksf:
                        b64_str = base64.b64encode(ksf.read()).decode("utf-8")
                    f.write("\n<details><summary>💡 點此展開並複製 Base64 設定至 GitHub Secrets (RELEASE_KEYSTORE_BASE64) 以固定簽名</summary>\n\n")
                    f.write(f"```\n{b64_str}\n```\n\n</details>\n")
                except Exception:
                    pass

if __name__ == "__main__":
    main()
