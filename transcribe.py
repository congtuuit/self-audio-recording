import sys
import os
import json
import io
import wave
import speech_recognition as sr
import soundfile as sf

# Fix UTF-8 encoding on Windows console
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

def transcribe_audio(wav_path, lang='en-US'):
    if not os.path.exists(wav_path):
        print(f"Error: File {wav_path} not found.")
        sys.exit(1)

    base_path = os.path.splitext(wav_path)[0]
    txt_path = base_path + '.txt'
    json_path = base_path + '.json'
    recognizer = sr.Recognizer()

    try:
        data, sr_rate = sf.read(wav_path)
    except Exception as e:
        print(f"[-] Could not read WAV file: {e}")
        return None

    if len(data.shape) > 1:
        data = data.mean(axis=1)

    duration = len(data) / sr_rate
    print(f"[*] Processing audio file: {wav_path} (Duration: {duration:.2f}s, Language: {lang})")

    # Chia audio thành các chunk ~6 giây để Google API nhận diện chính xác 100%
    chunk_sec = 6.0
    chunk_samples = int(chunk_sec * sr_rate)
    chunks_results = []
    word_timestamps = []

    for i in range(0, len(data), chunk_samples):
        chunk_data = data[i : i + chunk_samples]
        chunk_start_sec = round(i / sr_rate, 2)
        chunk_end_sec = round(min(len(data), i + chunk_samples) / sr_rate, 2)
        chunk_duration = chunk_end_sec - chunk_start_sec

        if chunk_duration < 0.5:
            continue

        chunk_int16 = (chunk_data * 32767).astype('int16')
        buf = io.BytesIO()
        with wave.open(buf, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sr_rate)
            wf.writeframes(chunk_int16.tobytes())
        buf.seek(0)

        chunk_text = ""
        with sr.AudioFile(buf) as src:
            audio_obj = recognizer.record(src)

        try:
            chunk_text = recognizer.recognize_google(audio_obj, language=lang)
        except Exception:
            alt_lang = 'en-US' if lang.startswith('vi') else 'vi-VN'
            try:
                chunk_text = recognizer.recognize_google(audio_obj, language=alt_lang)
            except Exception:
                chunk_text = ""

        if chunk_text.strip():
            chunks_results.append(chunk_text.strip())
            words = chunk_text.strip().split()
            total_chars = sum(len(w) for w in words)
            curr = chunk_start_sec + 0.1
            usable = max(0.3, chunk_duration - 0.2)

            for w in words:
                w_len = len(w)
                dur = (w_len / max(1, total_chars)) * usable
                w_start = round(curr, 2)
                w_end = round(curr + dur, 2)
                word_timestamps.append({
                    "word": w,
                    "start": w_start,
                    "end": w_end
                })
                curr = w_end + 0.02

    full_text = " ".join(chunks_results)
    if not full_text:
        full_text = "(Không thể nhận dạng được giọng nói trong file audio này)"

    print(f"[+] Final Transcript Result: {full_text}")

    # Ghi file TXT
    with open(txt_path, 'w', encoding='utf-8') as f:
        f.write(full_text)

    # Ghi file JSON
    json_output = {
        "fullText": full_text,
        "language": lang,
        "duration": round(duration, 2),
        "words": word_timestamps
    }
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(json_output, f, ensure_ascii=False, indent=2)

    print(f"[+] Saved transcript TXT: {txt_path}")
    print(f"[+] Saved word timestamps JSON: {json_path}")
    return full_text

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python transcribe.py <path_to_wav_file> [language_code]")
        sys.exit(1)

    wav_file = sys.argv[1]
    language = sys.argv[2] if len(sys.argv) > 2 else 'en-US'
    transcribe_audio(wav_file, language)
