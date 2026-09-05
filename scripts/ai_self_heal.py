#!/usr/bin/env python3
import os
import sys
import json
import urllib.request
import urllib.error
import subprocess

def run_cmd(cmd):
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.stdout.strip(), result.returncode

def main():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("\n=======================================================")
        print("⚠️ 警告：GEMINI_API_KEY 未在 GitHub Secrets 中設定！")
        print("請前往 GitHub Repository -> Settings -> Secrets and variables -> Actions")
        print("新增 Secret: GEMINI_API_KEY 並貼上您的 API Key，自癒功能即可自動運作。")
        print("=======================================================\n")
        sys.exit(0)

    # Check commit history to prevent infinite self-heal loops (limit to 20 consecutive auto-fixes)
    stdout, _ = run_cmd("git log -n 30 --oneline")
    recent_commits = stdout.splitlines()
    auto_fix_count = sum(1 for c in recent_commits[:20] if "[AI-SELF-HEAL]" in c)
    
    if auto_fix_count >= 20:
        print("🛑 Maximum consecutive AI self-healing attempts (20) reached. Stopping to prevent loops.")
        sys.exit(1)

    print(f"🤖 Initiating Gemini AI Self-Healing System (Attempt {auto_fix_count + 1}/20)...")

    # Collect failure diagnostic info
    logcat_path = "emulator_test/app_logcat.log"
    logcat_content = ""
    if os.path.exists(logcat_path):
        with open(logcat_path, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
            error_lines = [l for l in lines if any(k in l for k in ["Error", "Exception", "SyntaxError", "FATAL", "chromium", "FAILED"])]
            logcat_content = "=== LOGCAT ERRORS ===\n" + "".join(lines[-150:]) + "\n\nKey Errors:\n" + "".join(error_lines[-50:])

    build_log_path = "build_error.log"
    if os.path.exists(build_log_path):
        with open(build_log_path, "r", encoding="utf-8", errors="ignore") as f:
            logcat_content += "\n=== BUILD ERROR LOG ===\n" + f.read()[-4000:]

    if not logcat_content:
        logcat_content = "No specific logcat or build_error.log found. Please check recent code changes."

    # Inspect critical project files for context
    context_files = [
        "scripts/postbuild.js",
        "package.json",
        "vite.config.ts",
        "src/App.tsx",
        "src/main.tsx",
        "index.html",
        "android/app/build.gradle.kts",
        "android/app/src/main/java/com/bilingo/radio/ui/screens/MainScreen.kt",
        "android/app/src/main/java/com/bilingo/radio/MainActivity.kt",
        "android/app/src/main/java/com/bilingo/radio/stt/RadioStreamSttManager.kt",
        "android/app/src/main/java/com/bilingo/radio/translation/GeminiTranslationRepository.kt"
    ]
    code_context = {}
    for fp in context_files:
        if os.path.exists(fp):
            with open(fp, "r", encoding="utf-8", errors="ignore") as f:
                code_context[fp] = f.read()

    prompt = f"""You are an expert Android & Web CI/CD debugging AI.
An automated Android build or test failed on GitHub Actions.

=== ERROR DIAGNOSTICS ===
{logcat_content[:8000]}

=== PROJECT CONTEXT FILES ===
{json.dumps(code_context, indent=2)}

YOUR TASK:
1. Analyze the root cause of the crash or failure.
2. Provide exact code fixes for any files that need modification.

RESPOND ONLY IN VALID JSON WITH THIS EXACT SCHEMA:
{{
  "explanation": "Short summary of root cause and fix",
  "files_to_modify": [
    {{
      "filepath": "scripts/postbuild.js",
      "content": "Full corrected content for this file..."
    }}
  ]
}}
Do NOT wrap the JSON in markdown formatting if possible, or supply pure JSON.
"""

    models_to_try = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-2.0-flash-exp"
    ]
    response_json = None
    last_err = None

    for m in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
                response_json = json.loads(raw_text)
                print(f"✅ Successfully queried Gemini model: {m}")
                break
        except Exception as e:
            last_err = e
            print(f"⚠️ Model {m} failed: {e}. Trying next...")

    if not response_json:
        print(f"❌ Failed to call Gemini API across all models: {last_err}")
        sys.exit(1)

    explanation = response_json.get("explanation", "AI provided a fix.")
    files_to_modify = response_json.get("files_to_modify", [])

    print(f"💡 Gemini Diagnosis: {explanation}")

    if not files_to_modify:
        print("ℹ️ Gemini found no file changes required.")
        sys.exit(0)

    # Apply fixes
    for item in files_to_modify:
        fp = item["filepath"]
        content = item["content"]
        print(f"🛠️ Applying AI fix to: {fp}")
        if os.path.dirname(fp):
            os.makedirs(os.path.dirname(fp), exist_ok=True)
        with open(fp, "w", encoding="utf-8") as f:
            f.write(content)

    # Commit and push
    run_cmd('git config user.name "Gemini Self-Heal Bot"')
    run_cmd('git config user.email "bot@bilingo.app"')
    run_cmd('git add .')
    commit_msg = f"[AI-SELF-HEAL] {explanation[:70]}"
    _, code = run_cmd(f'git commit -m "{commit_msg}"')
    if code == 0:
        print("🚀 Pushing AI fix commit to GitHub...")
        push_out, push_code = run_cmd("git push origin main")
        if push_code == 0:
            print("✅ Fix pushed successfully!")
            repo = os.environ.get("GITHUB_REPOSITORY")
            token = os.environ.get("GITHUB_TOKEN")
            if repo and token:
                print("🔄 Triggering new GitHub Actions build via workflow_dispatch...")
                dispatch_url = f"https://api.github.com/repos/{repo}/actions/workflows/build-android.yml/dispatches"
                req_dispatch = urllib.request.Request(
                    dispatch_url,
                    data=json.dumps({"ref": "main"}).encode("utf-8"),
                    headers={
                        "Accept": "application/vnd.github+json",
                        "Authorization": f"Bearer {token}",
                        "X-GitHub-Api-Version": "2022-11-28"
                    }
                )
                try:
                    with urllib.request.urlopen(req_dispatch) as resp_d:
                        print("🎉 New CI Build triggered successfully!")
                except Exception as ed:
                    print(f"⚠️ Dispatch trigger note: {ed}")
        else:
            print(f"⚠️ Push failed: {push_out}")
    else:
        print("ℹ️ No git changes to commit.")

if __name__ == "__main__":
    main()
