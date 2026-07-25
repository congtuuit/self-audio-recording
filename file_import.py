# -*- coding: utf-8 -*-
import sys
import os
import json
import re
import argparse
import shutil

# Reconfigure stdout to use UTF-8 (crucial for Windows console)
sys.stdout.reconfigure(encoding='utf-8')


def parse_srt_vtt(subtitle_path):
    """
    Parses SRT or VTT files into a word array with timestamps.
    """
    if not subtitle_path or not os.path.exists(subtitle_path):
        return [], ""

    with open(subtitle_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Clean VTT header
    if content.startswith('WEBVTT'):
        content = re.sub(r'^WEBVTT[^\n]*\n', '', content)

    # Standardize endings
    content = content.replace('\r\n', '\n')

    # SRT / VTT cue regex
    # Matches: [Index] optional
    # Timestamps: 00:00:00.000 --> 00:00:00.000 or 00:00.000 --> 00:00.000
    # Text block
    pattern = re.compile(
        r'(?:^\d+\s*\n)?'  # Optional index
        r'(\d{2}:\d{2}:\d{2}[.,]\d{3}|\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3}|\d{2}:\d{2}[.,]\d{3})\s*\n' # Timestamps
        r'([\s\S]*?)(?=\n\s*\n|\Z)', # Caption text
        re.MULTILINE
    )

    cues = pattern.findall(content)
    if not cues:
        # Retry with simpler parser if regex missed
        return [], ""

    def time_to_seconds(t_str):
        t_str = t_str.replace(',', '.')
        parts = t_str.split(':')
        if len(parts) == 3:
            h, m, s = parts
            return int(h) * 3600 + int(m) * 60 + float(s)
        elif len(parts) == 2:
            m, s = parts
            return int(m) * 60 + float(s)
        return 0.0

    words = []
    full_text_parts = []

    for cue_idx, (start_str, end_str, text) in enumerate(cues):
        # Clean text
        text_clean = re.sub(r'<[^>]*>', '', text) # Strip HTML formatting tags
        text_clean = ' '.join(text_clean.strip().split())
        if not text_clean:
            continue

        full_text_parts.append(text_clean)

        start_time = time_to_seconds(start_str)
        end_time = time_to_seconds(end_str)
        duration = max(0.01, end_time - start_time)

        # Split cue into individual words and distribute duration
        words_in_cue = text_clean.split()
        word_dur = duration / len(words_in_cue)

        for w_idx, w in enumerate(words_in_cue):
            word_start = start_time + (w_idx * word_dur)
            word_end = word_start + word_dur
            words.append({
                "word": w,
                "start": round(word_start, 2),
                "end": round(word_end, 2)
            })

    full_text = " ".join(full_text_parts)
    return words, full_text


def convert_media(media_path, output_dir):
    """
    Converts input media to audio.wav (16-bit 44.1kHz mono WAV PCM).
    If it is an MP4/WebM file, also save video.mp4 (copies video stream).
    """
    os.makedirs(output_dir, exist_ok=True)
    ext = os.path.splitext(media_path)[1].lower()

    final_wav = os.path.join(output_dir, 'audio.wav')
    has_video = False

    # Extract & convert audio to mono WAV PCM using subprocess to suppress console noise
    import subprocess
    try:
        subprocess.run(
            ['ffmpeg', '-y', '-i', media_path, '-vn', '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', final_wav],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    except Exception:
        os.system(f'ffmpeg -y -i "{media_path}" -vn -ar 44100 -ac 1 -c:a pcm_s16le "{final_wav}" >NUL 2>&1')

    # If input is a video file, optionally copy it as video.mp4
    if ext in ('.mp4', '.webm', '.mkv', '.mov'):
        final_mp4 = os.path.join(output_dir, 'video.mp4')
        try:
            subprocess.run(
                ['ffmpeg', '-y', '-i', media_path, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', '-crf', '23', '-preset', 'fast', final_mp4],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
        except Exception:
            os.system(f'ffmpeg -y -i "{media_path}" -c:v libx264 -pix_fmt yuv420p -an -crf 23 -preset fast "{final_mp4}" >NUL 2>&1')
        if os.path.exists(final_mp4):
            has_video = True

    return has_video


def main():
    parser = argparse.ArgumentParser(description="Local File Shadowing Lesson Loader Helper")
    parser.add_argument("output_dir", help="Directory where files will be saved")
    parser.add_argument("media_file", help="Path to local media file (WAV/MP3/MP4/etc)")
    parser.add_argument("--subtitle", help="Path to local subtitle file (SRT/VTT)")
    parser.add_argument("--name", default="imported_file", help="Custom name for the lesson")
    parser.add_argument("--lang", default="en-US", help="Language code")
    args = parser.parse_args()

    if not os.path.exists(args.media_file):
        print(json.dumps({"success": False, "error": f"Media file not found: {args.media_file}"}))
        sys.exit(1)

    try:
        # Step 1: Convert Media (Audio + Video)
        has_video = convert_media(args.media_file, args.output_dir)

        # Step 2: Parse subtitles
        words = []
        full_text = ""
        transcript_available = False

        if args.subtitle and os.path.exists(args.subtitle):
            words, full_text = parse_srt_vtt(args.subtitle)
            if full_text:
                transcript_available = True

        if not transcript_available:
            full_text = "(Đang tự động xử lý transcript...)"

        wav_path = os.path.join(args.output_dir, 'audio.wav')
        file_size = os.path.getsize(wav_path) if os.path.exists(wav_path) else 0

        # Estimate duration
        duration = 0.0
        if os.path.exists(wav_path):
            try:
                import struct
                with open(wav_path, 'rb') as wav_f:
                    # Parse WAV header to get duration
                    wav_f.seek(22)
                    num_channels = struct.unpack('<H', wav_f.read(2))[0]
                    wav_f.seek(24)
                    sample_rate = struct.unpack('<I', wav_f.read(4))[0]
                    wav_f.seek(34)
                    bits_per_sample = struct.unpack('<H', wav_f.read(2))[0]
                    # Find data chunk
                    wav_f.seek(12) # skip to chunks
                    while True:
                        chunk_id = wav_f.read(4)
                        if not chunk_id:
                            break
                        chunk_size = struct.unpack('<I', wav_f.read(4))[0]
                        if chunk_id == b'data':
                            duration = chunk_size / (sample_rate * num_channels * (bits_per_sample / 8))
                            break
                        else:
                            wav_f.seek(chunk_size, 1)
            except Exception:
                duration = 0.0

        # Step 3: Write meta.json
        meta_json_path = os.path.join(args.output_dir, 'meta.json')
        meta_data = {
            "filename": "audio.wav",
            "duration": round(duration, 2),
            "language": args.lang,
            "fullText": full_text,
            "words": words,
            "dictionary": {},
            "createdAt": os.path.getmtime(wav_path) if os.path.exists(wav_path) else None,
            "fileType": "audio/wav",
            "fileSize": file_size,
            "source": "file_import",
            "sourceUrl": "",
            "videoTitle": args.name,
            "videoChannel": "Local Import",
            "videoThumbnail": "",
            "hasVideo": has_video
        }

        if meta_data["createdAt"]:
            import datetime
            meta_data["createdAt"] = datetime.datetime.fromtimestamp(meta_data["createdAt"]).isoformat()
        else:
            import datetime
            meta_data["createdAt"] = datetime.datetime.now().isoformat()

        with open(meta_json_path, 'w', encoding='utf-8') as f:
            json.dump(meta_data, f, indent=2, ensure_ascii=False)

        print(json.dumps({
            "success": True,
            "transcript_available": transcript_available,
            "recording": {
                "id": os.path.basename(args.output_dir.rstrip('/\\')),
                "filename": f"{os.path.basename(args.output_dir.rstrip('/\\'))}/audio.wav",
                "txtFilename": f"{os.path.basename(args.output_dir.rstrip('/\\'))}/meta.json",
                "size": file_size,
                "createdAt": meta_data["createdAt"],
                "transcript": full_text,
                "language": meta_data["language"],
                "source": "file_import",
                "videoTitle": args.name,
                "videoChannel": "Local Import",
                "videoThumbnail": "",
                "hasVideo": has_video
            }
        }, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
