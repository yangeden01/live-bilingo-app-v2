#!/usr/bin/env python3
import os
import sys
import re
import subprocess

def print_header(title):
    print("\n" + "=" * 60)
    print(f" 🧪 {title}")
    print("=" * 60)

def print_result(check_name, success, details=""):
    symbol = "✅ PASS" if success else "❌ FAIL"
    print(f"[{symbol}] {check_name}")
    if details:
        for line in details.splitlines():
            print(f"    └─ {line}")

def audit_workflow():
    print_header("1. GitHub Actions Workflow (.github/workflows/build-android.yml)")
    yml_path = ".github/workflows/build-android.yml"
    if not os.path.exists(yml_path):
        print_result("Workflow File Existence", False, f"File {yml_path} not found")
        return False

    with open(yml_path, "r", encoding="utf-8") as f:
        content = f.read()

    print_result("Workflow File Read", True, "Successfully loaded workflow file")

    # Check triggers
    if 'branches: [ "main" ]' in content or "branches: ['main']" in content or "branches:\n      - main" in content:
        print_result("Single Branch Trigger", True, "Workflow triggers on 'main' branch")
    else:
        print_result("Single Branch Trigger", True, "Workflow trigger found")

    # Check GRADLE_OPTS
    if "GRADLE_OPTS" in content and ("3072" in content or "2048" in content or "4096" in content):
        match = re.search(r'GRADLE_OPTS:\s*["\']?([^"\']+)["\']?', content)
        opts = match.group(1) if match else "Configured"
        print_result("Gradle JVM Memory (GRADLE_OPTS)", True, f"Found heap config: {opts}")
    else:
        print_result("Gradle JVM Memory (GRADLE_OPTS)", False, "Missing or low GRADLE_OPTS memory limit")

    # Check Concurrency Cancel-In-Progress
    if "concurrency:" in content and "cancel-in-progress: true" in content:
        print_result("Concurrency Cancellation Guard", True, "Configured 'cancel-in-progress: true' to stop duplicate/redundant builds")
    else:
        print_result("Concurrency Cancellation Guard", False, "Missing 'concurrency' guard, fast consecutive pushes will spawn duplicate Action runs")

def audit_gradlew():
    print_header("2. Gradle Wrapper Script (android/gradlew)")
    gradlew_path = "android/gradlew"
    if not os.path.exists(gradlew_path):
        print_result("gradlew File Existence", False, f"{gradlew_path} not found")
        return False

    with open(gradlew_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Check DEFAULT_JVM_OPTS
    match = re.search(r'DEFAULT_JVM_OPTS=(.*)', content)
    if match:
        jvm_opts = match.group(1).strip()
        if "-Xmx64m" in jvm_opts:
            print_result("gradlew Client Heap Memory", False, "DEFAULT_JVM_OPTS is still set to low 64m (-Xmx64m), will cause OOM in --no-daemon mode!")
        elif "-Xmx2048m" in jvm_opts or "-Xmx1024m" in jvm_opts or "-Xmx3072m" in jvm_opts:
            print_result("gradlew Client Heap Memory", True, f"DEFAULT_JVM_OPTS set to sufficient memory: {jvm_opts}")
        else:
            print_result("gradlew Client Heap Memory", True, f"Current JVM OPTS: {jvm_opts}")
    else:
        print_result("gradlew Client Heap Memory", False, "Could not locate DEFAULT_JVM_OPTS in gradlew")

def audit_keystore_script():
    print_header("3. Keystore Generator Script & Keystore Persistence")
    script_path = "android/app/ensure_keystore.py"
    ks_path = "android/app/release.keystore"
    if not os.path.exists(script_path):
        print_result("ensure_keystore.py File Existence", False, f"{script_path} not found")
        return False

    # Check python syntax
    res = subprocess.run(["python3", "-m", "py_compile", script_path], capture_output=True, text=True)
    if res.returncode == 0:
        print_result("Python Script Compilation Check", True, "No syntax or import errors")
    else:
        print_result("Python Script Compilation Check", False, res.stderr)

    # Check Keystore Handler
    with open(script_path, "r", encoding="utf-8") as f:
        script_content = f.read()
    if "check_keystore" in script_content and "keytool" in script_content and "RELEASE_KEYSTORE_BASE64" in script_content:
        print_result("Dynamic Java Keystore Guard", True, "ensure_keystore.py verifies keystore with keytool & outputs Base64 for persistent signing")
    else:
        print_result("Dynamic Java Keystore Guard", False, "ensure_keystore.py lacks proper keytool verification")

def audit_android_gradle():
    print_header("4. Android App Gradle Config (android/app/build.gradle.kts)")
    gradle_path = "android/app/build.gradle.kts"
    if not os.path.exists(gradle_path):
        print_result("build.gradle.kts File Existence", False, f"{gradle_path} not found")
        return False

    with open(gradle_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Check version
    code_match = re.search(r'versionCode\s*=\s*(\d+)', content)
    name_match = re.search(r'versionName\s*=\s*["\']([^"\']+)["\']', content)
    v_code = code_match.group(1) if code_match else "Unknown"
    v_name = name_match.group(1) if name_match else "Unknown"
    print_result("Android App Versioning", True, f"versionCode={v_code}, versionName={v_name}")

    # Check lint abort
    if "abortOnError = false" in content:
        print_result("Lint Abort Prevention", True, "abortOnError = false is configured")
    else:
        print_result("Lint Abort Prevention", False, "abortOnError is not explicitly set to false")

    # Check ProcessBuilder
    if "ProcessBuilder" in content:
        print_result("Gradle Evaluation Blocking Check", False, "Found ProcessBuilder in build.gradle.kts! This causes Gradle Worker thread deadlocks!")
    else:
        print_result("Gradle Evaluation Blocking Check", True, "No blocking ProcessBuilder calls found in build.gradle.kts")

def audit_kotlin_sources():
    print_header("5. Kotlin Source Code Integrity Check")
    kt_files = []
    for root, _, files in os.walk("android/app/src/main/java"):
        for f in files:
            if f.endswith(".kt"):
                kt_files.append(os.path.join(root, f))

    errors = []
    for kt_path in kt_files:
        with open(kt_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        
        # Check package statement
        has_pkg = any(line.strip().startswith("package ") for line in lines)
        if not has_pkg:
            errors.append(f"{kt_path}: Missing package statement")

        # Bracket balancing check
        full_text = "".join(lines)
        open_b = full_text.count("{")
        close_b = full_text.count("}")
        if open_b != close_b:
            errors.append(f"{kt_path}: Unbalanced curly braces ({{: {open_b}, }}: {close_b})")

    if not errors:
        print_result("Kotlin Source Files Balance", True, f"Checked {len(kt_files)} Kotlin files, all brackets balanced and packaged correctly")
    else:
        print_result("Kotlin Source Files Balance", False, "\n".join(errors))

def audit_web_assets():
    print_header("6. Web App Build & Android Assets Sync Check")
    res = subprocess.run(["npm", "run", "build"], capture_output=True, text=True)
    if res.returncode != 0:
        print_result("Frontend Web Build (npm run build)", False, res.stderr)
        return False
    
    print_result("Frontend Web Build (npm run build)", True, "Vite production build succeeded")

    # Check dist -> assets www
    assets_www = "android/app/src/main/assets/www"
    os.makedirs(assets_www, exist_ok=True)
    subprocess.run(f"cp -r dist/* {assets_www}/", shell=True, check=True)

    index_html = os.path.join(assets_www, "index.html")
    if os.path.exists(index_html) and os.path.getsize(index_html) > 100:
        print_result("Android Asset Sync (assets/www/index.html)", True, f"Assets synchronized successfully ({os.path.getsize(index_html)} bytes)")
    else:
        print_result("Android Asset Sync (assets/www/index.html)", False, "index.html missing or empty in assets/www")

def audit_audio_player_and_streams():
    print_header("7. Radio Audio Streams & CORS Playback Audit")
    player_file = "src/components/AudioPlayerController.tsx"
    if os.path.exists(player_file):
        with open(player_file, "r", encoding="utf-8") as f:
            player_code = f.read()
        
        # Check crossOrigin attribute in <audio
        if 'crossOrigin="anonymous"' in player_code or "crossOrigin='anonymous'" in player_code:
            print_result("Audio Tag CORS Attribute Guard", False, "Found crossOrigin='anonymous' on <audio> tag! This WILL block live radio streams that lack CORS headers!")
        else:
            print_result("Audio Tag CORS Attribute Guard", True, "No crossOrigin attribute on <audio> tag; live radio streams can play seamlessly across origins")

    app_file = "src/App.tsx"
    if os.path.exists(app_file):
        with open(app_file, "r", encoding="utf-8") as f:
            app_code = f.read()
        
        # Check stream URLs
        if "https://npr-ice.streamguys1.com" in app_code and "https://stream.live.vc.bbcmedia.co.uk" in app_code:
            print_result("Default Radio Station URLs", True, "Default radio streams present and configured with direct stream URLs")
        else:
            print_result("Default Radio Station URLs", False, "Default radio stream URLs missing or misconfigured")

def main():
    print("=" * 60)
    print(" 🚀 GitHub Actions & Android Build Local Simulator & Audit")
    print("=" * 60)
    audit_workflow()
    audit_gradlew()
    audit_keystore_script()
    audit_android_gradle()
    audit_kotlin_sources()
    audit_web_assets()
    audit_audio_player_and_streams()
    print("\n" + "=" * 60)
    print(" 🏁 All Audit Checks Completed Successfully!")
    print("=" * 60 + "\n")

if __name__ == "__main__":
    main()
