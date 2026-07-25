# -*- coding: utf-8 -*-
import sys
import os
import json
import re
import argparse
from urllib.parse import urlparse, parse_qs

# Reconfigure stdout to use UTF-8 (crucial for Windows console)
sys.stdout.reconfigure(encoding='utf-8')

# Ensure external dependencies are accessible
try:
    import yt_dlp
except ImportError:
    print(json.dumps({"success": False, "error": "yt-dlp package is not installed. Run: pip install yt-dlp"}))
    sys.exit(1)

try:
    from youtube_transcript_api import YouTubeTranscriptApi
except ImportError:
    print(json.dumps({"success": False, "error": "youtube-transcript-api package is not installed. Run: pip install youtube-transcript-api"}))
    sys.exit(1)


class MyLogger(object):
    def debug(self, msg):
        pass
    def warning(self, msg):
        pass
    def error(self, msg):
        pass


def parse_video_id(url):
    """
    Extracts video ID from a YouTube URL.
    Supports watch URLs, youtu.be short URLs, shorts URLs.
    """
    if not url:
        return None
    parsed = urlparse(url)
    hostname = parsed.hostname
    if not hostname:
        return None

    if hostname == 'youtu.be':
        return parsed.path.lstrip('/')
    elif hostname in ('www.youtube.com', 'youtube.com', 'm.youtube.com'):
        if parsed.path.startswith('/shorts/'):
            return parsed.path.split('/')[2]
        if parsed.path == '/watch':
            return parse_qs(parsed.query).get('v', [None])[0]
    return None


def fetch_video_metadata(video_id):
    """
    Uses yt-dlp to fetch video metadata without downloading it.
    """
    ydl_opts = {
        'skip_download': True,
        'quiet': True,
        'no_warnings': True,
        'logger': MyLogger(),
        'noprogress': True,
    }
    url = f"https://www.youtube.com/watch?v={video_id}"
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            return {
                "id": video_id,
                "url": url,
                "title": info.get("title", ""),
                "channel": info.get("uploader", ""),
                "thumbnail": info.get("thumbnail", f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"),
                "duration": info.get("duration", 0),
                "language": info.get("language") or "en"
            }
        except Exception as e:
            # Fallback metadata if extraction fails
            return {
                "id": video_id,
                "url": url,
                "title": f"YouTube Video {video_id}",
                "channel": "YouTube",
                "thumbnail": f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
                "duration": 0,
                "language": "en"
            }


def fetch_captions(video_id, target_lang='en'):
    """
    Retrieves captions from YouTube with fallback priorities:
    1. Manual English captions
    2. Auto-generated English captions
    3. Manual target language captions
    4. Auto-generated target language captions
    """
    try:
        api = YouTubeTranscriptApi()
        transcript_list = api.list(video_id)
    except Exception as e:
        return None, None

    # Order of priority for fetching transcript
    languages = [target_lang, 'en']
    transcript_obj = None

    for lang in languages:
        try:
            # Try manual captions first
            transcript_obj = transcript_list.find_manually_created_transcript([lang])
            break
        except Exception:
            try:
                # Fallback to auto-generated captions
                transcript_obj = transcript_list.find_generated_transcript([lang])
                break
            except Exception:
                continue

    if not transcript_obj:
        # Fallback to absolute first available if no matching target/english
        try:
            transcript_obj = next(iter(transcript_list))
        except Exception:
            return None, None

    try:
        raw_segments = transcript_obj.fetch()
        language_code = transcript_obj.language_code
        return raw_segments, language_code
    except Exception:
        return None, None


def split_segment_into_words(text, start, duration):
    """
    Splits a subtitle segment text into individual words and distributes
    timestamps evenly across those words within the segment duration.
    """
    # Clean and split into words
    words_list = text.strip().split()
    if not words_list:
        return []

    num_words = len(words_list)
    word_duration = duration / num_words

    words_data = []
    for i, w in enumerate(words_list):
        word_start = start + (i * word_duration)
        word_end = word_start + word_duration

        # Strip trailing/leading punctuation for dictionary cleanliness but keep it for display
        clean_word = re.sub(r'[^a-zA-Z0-9]', '', w)
        if not clean_word:
            clean_word = w

        words_data.append({
            "word": w,
            "start": round(word_start, 2),
            "end": round(word_end, 2)
        })
    return words_data


def download_media(video_id, output_dir, download_video=False):
    """
    Downloads YouTube media.
    If download_video is True: Downloads mp4 video to video.mp4, and audio to audio.wav.
    If download_video is False: Downloads audio only to audio.wav.
    """
    url = f"https://www.youtube.com/watch?v={video_id}"
    os.makedirs(output_dir, exist_ok=True)

    # 1. Download/convert audio to WAV (16-bit, 44.1kHz mono PCM)
    audio_path = os.path.join(output_dir, 'audio_temp')
    ydl_opts_audio = {
        'format': 'bestaudio/best',
        'outtmpl': audio_path,
        'quiet': True,
        'no_warnings': True,
        'logger': MyLogger(),
        'noprogress': True,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'wav',
            'preferredquality': '192',
        }],
    }

    with yt_dlp.YoutubeDL(ydl_opts_audio) as ydl:
        ydl.download([url])

    # Convert audio to mono 44.1kHz WAV PCM using ffmpeg if it downloaded differently
    downloaded_wav = audio_path + '.wav'
    final_wav = os.path.join(output_dir, 'audio.wav')
    if os.path.exists(downloaded_wav):
        # We enforce standard format (44.1kHz mono PCM)
        import subprocess
        try:
            subprocess.run(
                ['ffmpeg', '-y', '-i', downloaded_wav, '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', final_wav],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
        except Exception:
            # Fallback to os.system if subprocess.run fails
            os.system(f'ffmpeg -y -i "{downloaded_wav}" -ar 44100 -ac 1 -c:a pcm_s16le "{final_wav}" >NUL 2>&1')
        if os.path.exists(downloaded_wav):
            os.remove(downloaded_wav)

    # 2. Optionally download MP4 video
    if download_video:
        video_path = os.path.join(output_dir, 'video.mp4')
        ydl_opts_video = {
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'outtmpl': video_path,
            'quiet': True,
            'no_warnings': True,
            'logger': MyLogger(),
            'noprogress': True,
            'merge_output_format': 'mp4'
        }
        with yt_dlp.YoutubeDL(ydl_opts_video) as ydl:
            ydl.download([url])
        # Sometimes merged output saves as video.mp4.mp4, fix it
        if os.path.exists(video_path + '.mp4'):
            if os.path.exists(video_path):
                os.remove(video_path)
            os.rename(video_path + '.mp4', video_path)


def main():
    parser = argparse.ArgumentParser(description="YouTube Shadowing Lesson Loader Helper")
    parser.add_argument("output_dir", help="Directory where files will be saved")
    parser.add_argument("url", help="YouTube video URL")
    parser.add_argument("--video", action="store_true", help="Download video in addition to audio")
    parser.add_argument("--lang", default="en", help="Target language code for captions")
    args = parser.parse_args()

    video_id = parse_video_id(args.url)
    if not video_id:
        print(json.dumps({"success": False, "error": "Invalid YouTube URL"}))
        sys.exit(1)

    try:
        # Step 1: Fetch Video Metadata
        meta = fetch_video_metadata(video_id)

        # Step 2: Fetch Captions
        raw_segments, language_code = fetch_captions(video_id, args.lang)

        words = []
        full_text = ""
        transcript_available = False

        if raw_segments:
            transcript_available = True
            # Build fullText and split words with timestamps
            text_parts = []
            for segment in raw_segments:
                # v1.x returns FetchedTranscriptSnippet dataclass objects
                start = getattr(segment, 'start', 0.0)
                duration = getattr(segment, 'duration', 0.0)
                text = getattr(segment, 'text', '')
                text_parts.append(text)

                segment_words = split_segment_into_words(text, start, duration)
                words.extend(segment_words)

            full_text = " ".join(text_parts)
        else:
            # No captions found, fullText is initial placeholder for background STT fallback
            full_text = "(Đang tự động xử lý transcript...)"

        # Step 3: Download Media (WAV audio + optional MP4 video)
        download_media(video_id, args.output_dir, args.video)

        # Calculate file size
        wav_path = os.path.join(args.output_dir, 'audio.wav')
        file_size = os.path.getsize(wav_path) if os.path.exists(wav_path) else 0

        # Step 4: Write meta.json
        meta_json_path = os.path.join(args.output_dir, 'meta.json')
        meta_data = {
            "filename": "audio.wav",
            "duration": meta["duration"],
            "language": language_code or args.lang,
            "fullText": full_text,
            "words": words,
            "dictionary": {},
            "createdAt": os.path.getmtime(wav_path) if os.path.exists(wav_path) else None,
            "fileType": "audio/wav",
            "fileSize": file_size,
            "source": "youtube",
            "sourceUrl": args.url,
            "videoTitle": meta["title"],
            "videoChannel": meta["channel"],
            "videoThumbnail": meta["thumbnail"],
            "hasVideo": args.video and os.path.exists(os.path.join(args.output_dir, 'video.mp4'))
        }

        # Handle datetime serialization
        if meta_data["createdAt"]:
            import datetime
            meta_data["createdAt"] = datetime.datetime.fromtimestamp(meta_data["createdAt"]).isoformat()
        else:
            import time
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
                "source": "youtube",
                "sourceUrl": args.url,
                "videoTitle": meta["title"],
                "videoChannel": meta["channel"],
                "videoThumbnail": meta["thumbnail"],
                "hasVideo": meta_data["hasVideo"]
            }
        }, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
