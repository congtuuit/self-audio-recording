import sys
import os
import speech_recognition as sr

def transcribe_audio(wav_path, lang='vi-VN'):
    if not os.path.exists(wav_path):
        print(f"Error: File {wav_path} not found.")
        sys.exit(1)

    txt_path = os.path.splitext(wav_path)[0] + '.txt'
    recognizer = sr.Recognizer()

    print(f"[*] Processing audio file: {wav_path} (Language: {lang})")
    
    try:
        with sr.AudioFile(wav_path) as source:
            # Adjust for ambient noise if needed
            audio_data = recognizer.record(source)

        text = ""
        # Thử nhận diện với ngôn ngữ được chọn
        try:
            text = recognizer.recognize_google(audio_data, language=lang)
        except sr.UnknownValueError:
            # Nếu tiếng Việt không ra kết quả, thử tiếng Anh (hoặc ngược lại)
            alt_lang = 'en-US' if lang.startswith('vi') else 'vi-VN'
            print(f"[*] Unknown value with {lang}, trying alternative: {alt_lang}")
            try:
                text = recognizer.recognize_google(audio_data, language=alt_lang)
            except Exception as ex_alt:
                print(f"[*] Alternative recognition failed: {ex_alt}")
                text = "(Không thể nhận dạng được giọng nói trong file audio này)"

        print(f"[+] Transcript Result: {text}")

        # Ghi kết quả vào file .txt
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write(text)

        print(f"[+] Successfully saved transcript to: {txt_path}")
        return text

    except Exception as e:
        print(f"[-] Error during transcription: {e}")
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write(f"(Lỗi tạo transcript: {str(e)})")
        return None

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python transcribe.py <path_to_wav_file> [language_code]")
        sys.exit(1)

    wav_file = sys.argv[1]
    language = sys.argv[2] if len(sys.argv) > 2 else 'vi-VN'
    transcribe_audio(wav_file, language)
