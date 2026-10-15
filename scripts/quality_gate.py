import sys
import os
import subprocess
import time

def ensure_app_launched():
    try:
        # Check installed packages matching bilingo or radio
        res = subprocess.run(["adb", "shell", "pm", "list", "packages"], capture_output=True, text=True, timeout=10)
        candidate_packages = [line.strip().replace("package:", "") for line in res.stdout.splitlines() if "bilingo" in line or "radio" in line]
        print(f"📱 Detected candidate packages on emulator: {candidate_packages}")
        if not candidate_packages:
            candidate_packages = ["com.bilingo.radio.internal", "com.bilingo.radio", "com.livebilingo.radio"]

        for pkg in candidate_packages:
            print(f"🚀 Ensuring app launched for package: {pkg}")
            subprocess.run(["adb", "shell", "am", "start", "-n", f"{pkg}/com.bilingo.radio.MainActivity"], capture_output=True, text=True, timeout=10)
            subprocess.run(["adb", "shell", "monkey", "-p", pkg, "-c", "android.intent.category.LAUNCHER", "1"], capture_output=True, text=True, timeout=10)

        print("⏳ Waiting 12 seconds for app to initialize, load assets, and mount WebView...")
        time.sleep(12)

        # Refresh logcat
        os.makedirs("emulator_test", exist_ok=True)
        with open("emulator_test/app_logcat.log", "w", errors="ignore") as f:
            subprocess.run(["adb", "logcat", "-d"], stdout=f, timeout=10)

        # Refresh screenshot
        subprocess.run("adb exec-out screencap -p > emulator_test/app_startup_screenshot.png", shell=True, timeout=10)
        return True
    except Exception as e:
        print(f"⚠️ ensure_app_launched failed: {e}")
        return False

def check_logcat():
    log_path = "emulator_test/app_logcat.log"
    if not os.path.exists(log_path):
        print("❌ [QUALITY GATE FAILED] Logcat file not found. Cannot verify execution.")
        return False

    with open(log_path, "r", errors="ignore") as f:
        content = f.read()

    # 1. 致命崩潰與錯誤關鍵字檢查 (Hard Error Fail)
    fatal_keywords = [
        "FATAL EXCEPTION",
        "AndroidRuntime: FATAL",
        "Uncaught SyntaxError",
        "ERR_NAME_NOT_RESOLVED",
        "ERR_CONNECTION_REFUSED",
        "net::ERR_FILE_NOT_FOUND",
        "Uncaught React Component Error",
        "Critical error during mountApp",
        "glRasterCHROMIUM: RasterCHROMIUM: serialization failure",
        "glRasterCHROMIUM: Invalid font buffer"
    ]
    found_fatals = [k for k in fatal_keywords if k in content]
    if found_fatals:
        print(f"❌ [QUALITY GATE FAILED] Found fatal crash / critical error in Logcat: {found_fatals}")
        return False

    # 2. 必須具備的正面啟動標記 (必須確認 React App 與 主畫面成功載入完成)
    success_indicators = [
        "React App successfully mounted",
        "onPageReady",
        "BilingoJS",
        "Live Bilingo",
        "appassets.android.com/assets/index.html",
        "Displayed com.bilingo.radio",
        "Displayed com.bilingo.radio.internal"
    ]
    matched_indicators = [k for k in success_indicators if k in content]

    # 若初始 Logcat 無啟動標記，嘗試自動偵測安裝之 Package 並啟動
    if not matched_indicators:
        print("⚠️ Initial Logcat lacked startup markers. Attempting auto-detect and launch of installed package...")
        if ensure_app_launched():
            with open(log_path, "r", errors="ignore") as f:
                content = f.read()
            matched_indicators = [k for k in success_indicators if k in content]

    print(f"📋 Verified Logcat startup markers: {matched_indicators}")
    if not matched_indicators:
        print("❌ [QUALITY GATE FAILED] No WebView initialization or React mounting markers found in logcat!")
        return False

    return True

def check_screenshot():
    candidate_paths = [
        "emulator_test/app_startup_screenshot.png",
        "emulator_test/launch_screen.png"
    ]
    screenshot_path = None
    for p in candidate_paths:
        if os.path.exists(p):
            screenshot_path = p
            break

    if not screenshot_path:
        print("❌ [QUALITY GATE FAILED] Startup screenshot not found.")
        return False

    try:
        from PIL import Image
        img = Image.open(screenshot_path).convert("RGB")
        width, height = img.size
        
        # 裁剪掉頂部狀態列 (Status Bar: 頂部 10%) 與 底部導航列 (Navigation Bar: 底部 10%)
        # 專注檢測 App 主畫面內容區域 (Main Content Area)
        crop_box = (0, int(height * 0.12), width, int(height * 0.88))
        cropped = img.crop(crop_box)
        c_width, c_height = cropped.size
        total_pixels = c_width * c_height

        colors = cropped.getcolors(maxcolors=1000000)
        if not colors:
            print("❌ [QUALITY GATE FAILED] Unable to extract pixel colors from screenshot.")
            return False

        # 計算色彩多樣性與主色佔比
        num_colors = len(colors)
        max_single_color_count = max(count for count, _ in colors)
        dominant_color_ratio = max_single_color_count / total_pixels

        # 取得主色 RGB (確認是否為純黑或暗灰背景色)
        dominant_color = [c for count, c in colors if count == max_single_color_count][0]

        print(f"📊 主畫面色彩分析: 顏色數量={num_colors}, 主色佔比={dominant_color_ratio:.2%}, 主色RGB={dominant_color}")

        # 若主色為純黑 (0,0,0) 且佔比超過 80%，或主色佔比超過 94%，或顏色數量少於 50 種
        is_pure_black = (dominant_color[0] <= 2 and dominant_color[1] <= 2 and dominant_color[2] <= 2)
        if (is_pure_black and dominant_color_ratio > 0.80) or dominant_color_ratio > 0.94 or num_colors < 50:
            print(f"❌ [QUALITY GATE FAILED] 檢測到黑屏或無內容畫面！(純黑判定={is_pure_black}, 顏色數={num_colors}, 主色佔比={dominant_color_ratio:.2%})")
            return False

        print("✅ 主畫面視覺檢測通過：成功渲染豐富 UI 元件、按鈕與文字層次！")

    except ImportError:
        # Fallback 檔案大小檢查
        file_size = os.path.getsize(screenshot_path)
        print(f"📷 Screenshot file size: {file_size} bytes")
        if file_size < 15000:
            print("❌ [QUALITY GATE FAILED] 截圖檔案大小過小，判定為無內容畫面！")
            return False
    except Exception as e:
        print(f"❌ [QUALITY GATE FAILED] Screenshot analysis error: {e}")
        return False

    return True

if __name__ == "__main__":
    print("========================================")
    print(" 🚀 執行 BiLingo Radio 自動化品質門禁檢測 ")
    print("========================================")
    log_ok = check_logcat()
    screen_ok = check_screenshot()

    if not log_ok or not screen_ok:
        print("❌❌❌ [QUALITY GATE REJECTED] 模擬器開機測試未達標，強制判定為 FAIL！")
        sys.exit(1)

    print("🎉🎉🎉 [QUALITY GATE PASSED] App 成功開機，主畫面完整渲染並通過所有驗證！")

