import sys
import os
import json
import io
import wave
import speech_recognition as sr
import soundfile as sf
import socket

# Set default network timeout to 15 seconds to prevent hanging on Google Speech API throttling
socket.setdefaulttimeout(15)

# Fix UTF-8 encoding on Windows console
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

def normalize_language_code(lang):
    if not lang:
        return 'en'
    return str(lang).strip().replace('_', '-').split('-')[0].lower() or 'en'


def transcribe_with_whisperx(wav_path, lang='en-US'):
    import whisperx
    device = "cpu"
    batch_size = 16
    compute_type = "int8"
    normalized_lang = normalize_language_code(lang)

    print(f"[*] Using WhisperX Forced Alignment Engine for {wav_path}...")
    model = whisperx.load_model("tiny", device, compute_type=compute_type)
    audio = whisperx.load_audio(wav_path)
    result = model.transcribe(audio, batch_size=batch_size, language=normalized_lang)

    # Forced Alignment
    model_a, metadata = whisperx.load_align_model(language_code=normalized_lang, device=device)
    result = whisperx.align(result["segments"], model_a, metadata, audio, device, return_char_alignments=False)

    word_timestamps = []
    full_text_parts = []

    for segment in result.get("segments", []):
        full_text_parts.append(segment.get("text", "").strip())
        for w in segment.get("words", []):
            if "start" in w and "end" in w:
                word_timestamps.append({
                    "word": w["word"],
                    "start": round(w["start"], 2),
                    "end": round(w["end"], 2)
                })

    full_text = " ".join(full_text_parts)
    return full_text, word_timestamps

def transcribe_with_faster_whisper(wav_path, lang='en-US'):
    from faster_whisper import WhisperModel
    normalized_lang = normalize_language_code(lang)
    print(f"[*] Using faster-whisper Engine for {wav_path}...")
    model = WhisperModel("base", device="cpu", compute_type="int8")
    segments, info = model.transcribe(wav_path, word_timestamps=True, language=normalized_lang)

    word_timestamps = []
    full_text_parts = []

    for segment in segments:
        full_text_parts.append(segment.text.strip())
        if segment.words:
            for w in segment.words:
                word_timestamps.append({
                    "word": w.word,
                    "start": round(w.start, 2),
                    "end": round(w.end, 2)
                })

    full_text = " ".join(full_text_parts)
    return full_text, word_timestamps

def trim_silence_ffmpeg(wav_path):
    import subprocess
    temp_wav = os.path.splitext(wav_path)[0] + "_trimmed_temp.wav"
    cmd = [
        "ffmpeg", "-y", "-i", wav_path,
        "-af", "silenceremove=start_periods=1:start_duration=0.1:start_threshold=-45dB:stop_periods=1:stop_duration=0.1:stop_threshold=-45dB,loudnorm=I=-16:TP=-1.5:LRA=11",
        temp_wav
    ]
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=15)
        if res.returncode == 0 and os.path.exists(temp_wav) and os.path.getsize(temp_wav) > 1000:
            os.replace(temp_wav, wav_path)
            print(f"[+] Trimmed leading/trailing silence & normalized audio with FFmpeg: {wav_path}")
    except Exception as e:
        if os.path.exists(temp_wav):
            try: os.remove(temp_wav)
            except: pass

def transcribe_audio(wav_path, lang='en-US'):
    if not os.path.exists(wav_path):
        print(f"Error: File {wav_path} not found.")
        sys.exit(1)

    # 0. Chuẩn hóa & cắt bỏ khoảng im lặng bằng FFmpeg trước khi chạy bóc chữ
    trim_silence_ffmpeg(wav_path)

    base_path = os.path.splitext(wav_path)[0]
    txt_path = base_path + '.txt'
    json_path = base_path + '.json'

    try:
        data, sr_rate = sf.read(wav_path)
        duration = len(data) / sr_rate
    except Exception as e:
        print(f"[-] Could not read WAV file: {e}")
        return None

    full_text = ""
    word_timestamps = []

    # 1. Thử WhisperX trước (Cho độ chính xác mốc thời gian cao nhất)
    try:
        full_text, word_timestamps = transcribe_with_whisperx(wav_path, lang)
        print("[+] Successfully transcribed with WhisperX Engine")
    except Exception as e1:
        # 2. Thử faster-whisper (Chạy siêu tốc offline)
        try:
            full_text, word_timestamps = transcribe_with_faster_whisper(wav_path, lang)
            print("[+] Successfully transcribed with faster-whisper Engine")
        except Exception as e2:
            # 3. Fallback dùng SpeechRecognition (Mặc định)
            print("[*] Fallback to standard SpeechRecognition Engine...")
            recognizer = sr.Recognizer()
            if len(data.shape) > 1:
                data = data.mean(axis=1)

            chunk_sec = 6.0
            chunk_samples = int(chunk_sec * sr_rate)
            chunks_results = []

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
