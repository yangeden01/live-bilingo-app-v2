import os
import requests
import json

def fetch_prompt():
    print("=== 開始執行 Prompt 抓取任務 ===")
    
    api_key = os.environ.get("GEMINI_API_KEY")
    app_id = os.environ.get("AI_STUDIO_PROMPT_ID")
    
    if not api_key:
        print("【錯誤】找不到 GEMINI_API_KEY，請檢查 GitHub Secrets。")
        return
    if not app_id:
        print("【錯誤】找不到 AI_STUDIO_PROMPT_ID，請檢查 GitHub Secrets。")
        return

    # 正確且乾淨的 Google API 網址
    url = f"https://googleapis.com{app_id}"
    headers = {"Authorization": f"Bearer {api_key}"}

    print(f"正在嘗試連線至 Google API... (ID: {app_id})")
    
    try:
        response = requests.get(url, headers=headers)
        print(f"Google 伺服器回應狀態碼: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # 【自動路徑偵測】幫你把檔案塞進前端可以自由讀取的地方
            # 如果是 Android 專案，就塞進 Android 的 assets 資料夾；如果是網頁，就塞進最外層
            android_assets_dir = "android/app/src/main/assets"
            
            if os.path.exists(android_assets_dir):
                output_path = os.path.join(android_assets_dir, "prompt_config.json")
            else:
                output_path = "prompt_config.json"
                
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                
            print(f"【成功】最新 Prompt 配置已成功寫入：{output_path}")
        else:
            print(f"【下載失敗】錯誤代碼：{response.status_code}")
            print(f"回應內容：{response.text}")
            
    except Exception as e:
        print(f"【連線發生異常】錯誤原因: {e}")

if __name__ == "__main__":
    fetch_prompt()
