import requests
import base64
import os
import json
import time
import sys

# Ensure UTF-8 stdout
sys.stdout.reconfigure(encoding='utf-8')

SERVER_PORT = os.environ.get("PORT", "3000")
SERVER_URL = f"http://localhost:{SERVER_PORT}"
TEST_AUDIO_SRC = "recordings/REC_DEBUG_AUDIO_20260724143036/audio.wav"

def test_full_system_audio_flow():
    print("=" * 60)
    print("BAT DAU AUTOMATED TEST: LUONG THU AM HE THONG & AI TRANSCRIBE")
    print("=" * 60)

    if not os.path.exists(TEST_AUDIO_SRC):
        print(f"Error: File mau {TEST_AUDIO_SRC} khong ton tai!")
        return

    with open(TEST_AUDIO_SRC, "rb") as f:
        audio_bytes = f.read()

    base64_audio = "data:audio/wav;base64," + base64.b64encode(audio_bytes).decode("utf-8")
    print(f"[1/4] Da chuan bi du lieu Audio Base64 ({len(base64_audio)} ky tu)")

    payload = {
        "audioBase64": base64_audio,
        "transcript": "",  # Giai lap thu am he thong (khong co live transcript)
        "customName": "auto_test_flow",
        "language": "en-US"
    }

    print("[2/4] Gui request POST /api/save-recording toi Server...")
    start_time = time.time()
    
    try:
        response = requests.post(f"{SERVER_URL}/api/save-recording", json=payload, timeout=30)
        elapsed = time.time() - start_time
        print(f"[3/4] Nhan phan hoi tu Server sau {elapsed:.2f} giay (Status Code: {response.status_code})")

        res_data = response.json()
        print("     Response Data:")
        print(json.dumps(res_data, indent=2, ensure_ascii=False))

        if res_data.get("success"):
            rec = res_data["recording"]
            rec_id = rec["id"]

            print("\n[4/4] KIEM TRA KET QUA TREN DIA CUNG:")
            wav_file = f"recordings/{rec_id}/audio.wav"
            meta_file = f"recordings/{rec_id}/meta.json"

            print(f"  • File WAV: {wav_file} -> Ton tai: {os.path.exists(wav_file)}")
            print(f"  • File META: {meta_file} -> Ton tai: {os.path.exists(meta_file)}")

            # Đợi tối đa 15 giây cho background transcription hoàn thành (polling)
            print("  • Đang đợi xử lý bóc chữ dưới nền (polling)...")
            saved_text = ""
            for _ in range(15):
                time.sleep(1)
                if os.path.exists(meta_file):
                    try:
                        with open(meta_file, "r", encoding="utf-8") as tf:
                            meta_data = json.load(tf)
                            saved_text = meta_data.get("fullText", "").strip()
                    except Exception:
                        saved_text = ""
                    if saved_text and "(Đang" not in saved_text and "Lỗi" not in saved_text:
                        break

            print(f"\n  Noi dung file META luu truu cuoi cung:\n  \"{saved_text}\"\n")

            if saved_text and "(Đang" not in saved_text:
                print("=" * 60)
                print("SUCCESSFUL! LUONG AM THANH HE THONG & AI TRANSCRIBE HOAT DONG HOAN HAO!")
                print("=" * 60)
            else:
                print("Warning: Transcript chưa được xử lý thành công hoặc trống.")
        else:
            print(f"Server Error: {res_data.get('error')}")

    except Exception as e:
        print(f"Request Error: {e}")

if __name__ == "__main__":
    test_full_system_audio_flow()
