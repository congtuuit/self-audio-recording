import requests
import base64
import os
import json
import time
import sys

# Ensure UTF-8 stdout
sys.stdout.reconfigure(encoding='utf-8')

SERVER_URL = "http://localhost:3000"
TEST_AUDIO_SRC = "recordings/REC_20260724105621.wav"

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
            transcript_result = rec["transcript"]

            print("\n[4/4] KIEM TRA KET QUA TREN DIA CUNG:")
            wav_file = f"recordings/{rec_id}.wav"
            txt_file = f"recordings/{rec_id}.txt"

            print(f"  • File WAV: {wav_file} -> Ton tai: {os.path.exists(wav_file)}")
            print(f"  • File TXT: {txt_file} -> Ton tai: {os.path.exists(txt_file)}")

            if os.path.exists(txt_file):
                with open(txt_file, "r", encoding="utf-8") as tf:
                    saved_text = tf.read()
                print(f"\n  Noi dung file TXT luu truu:\n  \"{saved_text}\"\n")

            if transcript_result and "(Không thể" not in transcript_result and "(Đang" not in transcript_result:
                print("=" * 60)
                print("SUCCESSFUL! LUONG AM THANH HE THONG & AI TRANSCRIBE HOAT DONG HOAN HAO!")
                print("=" * 60)
            else:
                print("Warning: Transcript belum sesuai khong nhu mong doi.")
        else:
            print(f"Server Error: {res_data.get('error')}")

    except Exception as e:
        print(f"Request Error: {e}")

if __name__ == "__main__":
    test_full_system_audio_flow()
