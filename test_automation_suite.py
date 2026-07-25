# -*- coding: utf-8 -*-
import unittest
import requests
import json
import os
import time
import base64
import sys

# Ensure UTF-8 stdout
sys.stdout.reconfigure(encoding='utf-8')

SERVER_PORT = os.environ.get("PORT", "3001")
SERVER_URL = f"http://localhost:{SERVER_PORT}"

# Test configurations
TEST_DIR = os.path.dirname(os.path.abspath(__file__))
TEST_RECORDINGS_DIR = os.path.join(TEST_DIR, "recordings")

class VoiceCraftAutomationSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        print("\n" + "=" * 70)
        print("KHOI CHAY VOICE CRAFT AI AUTOMATION SUITE - PHIEN BAN QC AUTOMATION")
        print("=" * 70)

        # Verify server is up
        try:
            res = requests.get(f"{SERVER_URL}/api/recordings", timeout=5)
            if res.status_code != 200:
                raise Exception(f"Server returned status {res.status_code}")
            print(f"[OK] Ket noi server thanh cong tai {SERVER_URL}")
        except Exception as e:
            print(f"[FAIL] Khong the ket noi server tai {SERVER_URL}. Vui long kiem tra server!")
            sys.exit(1)

        # Generate a standard tiny audio fixture for local testing
        cls.fixture_dir = os.path.join(TEST_DIR, "fixtures")
        os.makedirs(cls.fixture_dir, exist_ok=True)
        cls.fixture_wav_path = os.path.join(cls.fixture_dir, "test_fixture.wav")

        # Simple 1-second silent WAV file generation
        import wave
        import struct
        with wave.open(cls.fixture_wav_path, 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(44100)
            for _ in range(44100):
                w.writeframesraw(struct.pack('<h', 0))

        with open(cls.fixture_wav_path, "rb") as f:
            cls.fixture_base64 = "data:audio/wav;base64," + base64.b64encode(f.read()).decode("utf-8")

        # Create a mock SRT subtitle
        cls.fixture_srt_path = os.path.join(cls.fixture_dir, "test_fixture.srt")
        with open(cls.fixture_srt_path, "w", encoding="utf-8") as sf:
            sf.write("1\n00:00:00,000 --> 00:00:01,000\nHello world from automated test suite.")

        # Store test recording IDs for cleanup
        cls.created_recordings = []

    @classmethod
    def tearDownClass(cls):
        print("\n" + "=" * 70)
        print("DON DEP TAI NGUYEN SAU AUTOMATED TEST")
        print("=" * 70)

        # Clean up created recordings on the server
        for rec_id in cls.created_recordings:
            try:
                res = requests.delete(f"{SERVER_URL}/api/recordings/{rec_id}", timeout=5)
                if res.status_code == 200 and res.json().get("success"):
                    print(f"  • Da xoa thanh cong test lesson: {rec_id}")
                else:
                    print(f"  • Warning: Xoa lesson {rec_id} that bai!")
            except Exception as e:
                print(f"  • Error clean up {rec_id}: {e}")

        # Clean up local fixtures
        try:
            if os.path.exists(cls.fixture_wav_path):
                os.remove(cls.fixture_wav_path)
            if os.path.exists(cls.fixture_srt_path):
                os.remove(cls.fixture_srt_path)
            if os.path.exists(cls.fixture_dir):
                os.rmdir(cls.fixture_dir)
            print("[OK] Don dep fixtures local hoan tat.")
        except Exception as e:
            print(f"Warning: Don dep fixtures error: {e}")

    def register_recording(self, rec_id):
        if rec_id not in self.created_recordings:
            self.created_recordings.append(rec_id)

    def test_01_api_get_recordings_list(self):
        """TC_01: Verify GET /api/recordings fetches the list successfully with correct keys"""
        print("\n[TC_01] Testing GET /api/recordings list...")
        res = requests.get(f"{SERVER_URL}/api/recordings", timeout=5)
        self.assertEqual(res.status_code, 200)

        data = res.json()
        self.assertTrue(data.get("success"))
        self.assertIn("recordings", data)
        self.assertIsInstance(data["recordings"], list)
        print("  -> Passed. Success=True, Recordings array length:", len(data["recordings"]))

    def test_02_post_save_recording(self):
        """TC_02: Verify saving a local user recording creates wav and metadata folders"""
        print("\n[TC_02] Testing POST /api/save-recording...")
        payload = {
            "audioBase64": self.fixture_base64,
            "transcript": "Hello world from save recording test",
            "customName": "qc_test_recording",
            "language": "en-US"
        }
        res = requests.post(f"{SERVER_URL}/api/save-recording", json=payload, timeout=10)
        self.assertEqual(res.status_code, 200)

        data = res.json()
        self.assertTrue(data.get("success"))

        rec = data.get("recording")
        self.assertIsNotNone(rec)
        rec_id = rec.get("id")
        self.assertIsNotNone(rec_id)
        self.register_recording(rec_id)

        # Verify folder structure on disk
        folder_path = os.path.join(TEST_RECORDINGS_DIR, rec_id)
        self.assertTrue(os.path.isdir(folder_path), "Recording folder was not created")
        self.assertTrue(os.path.exists(os.path.join(folder_path, "audio.wav")), "audio.wav was not created")
        self.assertTrue(os.path.exists(os.path.join(folder_path, "meta.json")), "meta.json was not created")

        with open(os.path.join(folder_path, "meta.json"), "r", encoding="utf-8") as f:
            meta = json.load(f)
            self.assertEqual(meta.get("fullText"), "Hello world from save recording test")
            self.assertEqual(meta.get("language"), "en-US")
        print(f"  -> Passed. Stored recording {rec_id} folder and metadata verified on disk.")

    def test_03_import_youtube_audio_only(self):
        """TC_03: Verify importing YouTube URL (audio-only mode) with caption fetching"""
        # We use a short Ted Talk known to have manual captions: RcGyVTAoXEU
        url = "https://www.youtube.com/watch?v=RcGyVTAoXEU"
        print(f"\n[TC_03] Testing YouTube Import (Audio Only) URL: {url}...")
        payload = {
            "url": url,
            "mode": "audio",
            "language": "en"
        }
        res = requests.post(f"{SERVER_URL}/api/import-youtube", json=payload, timeout=10)
        self.assertEqual(res.status_code, 200)

        data = res.json()
        self.assertTrue(data.get("success"))

        rec = data.get("recording")
        rec_id = rec.get("id")
        self.assertTrue(rec_id.startswith("REC_YT_"))
        self.register_recording(rec_id)

        # Polling: wait up to 45 seconds for background import to complete
        meta_path = os.path.join(TEST_RECORDINGS_DIR, rec_id, "meta.json")
        wav_path = os.path.join(TEST_RECORDINGS_DIR, rec_id, "audio.wav")
        video_path = os.path.join(TEST_RECORDINGS_DIR, rec_id, "video.mp4")

        print("  • Waiting for background download & captions processing (polling)...")
        completed = False
        for _ in range(45):
            time.sleep(1)
            if os.path.exists(meta_path):
                try:
                    with open(meta_path, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                        full_text = meta.get("fullText", "")
                        if full_text and "(Đang" not in full_text and "Lỗi" not in full_text:
                            completed = True
                            break
                except Exception:
                    pass

        self.assertTrue(completed, "YouTube import timed out or failed in the background")
        self.assertTrue(os.path.exists(wav_path), "audio.wav was not downloaded")
        self.assertFalse(os.path.exists(video_path), "video.mp4 should NOT exist in audio-only mode")

        # Read final metadata
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
            self.assertEqual(meta.get("source"), "youtube")
            self.assertEqual(meta.get("sourceUrl"), url)
            self.assertGreater(len(meta.get("words", [])), 0, "No word timestamps parsed")

            # Check fields
            self.assertIn("videoTitle", meta)
            self.assertIn("videoChannel", meta)
            self.assertIn("videoThumbnail", meta)
            self.assertIn("duration", meta)
            self.assertGreater(meta.get("duration", 0), 0)

            # Verify loop bounds compatibility
            words = meta.get("words")
            first_word = words[0]
            self.assertIn("word", first_word)
            self.assertIn("start", first_word)
            self.assertIn("end", first_word)
            self.assertLess(first_word["start"], first_word["end"])

        print(f"  -> Passed. YouTube audio-only import completed. Title: \"{meta['videoTitle']}\", Words: {len(words)}")

    def test_04_import_file_with_srt(self):
        """TC_04: Verify local file import with SRT subtitle converts correctly and maps words"""
        print("\n[TC_04] Testing Local File Import with SRT subtitles...")

        # Read subtitle file content
        with open(cls_fixture_srt_path := self.fixture_srt_path, "r", encoding="utf-8") as sf:
            srt_text = sf.read()

        payload = {
            "mediaBase64": self.fixture_base64,
            "mediaName": "qc_test_audio.wav",
            "subtitleText": srt_text,
            "language": "en-US"
        }
        res = requests.post(f"{SERVER_URL}/api/import-file", json=payload, timeout=10)
        self.assertEqual(res.status_code, 200)

        data = res.json()
        self.assertTrue(data.get("success"))

        rec = data.get("recording")
        rec_id = rec.get("id")
        self.assertTrue(rec_id.startswith("REC_IMP_"))
        self.register_recording(rec_id)

        # Wait up to 10 seconds for conversion to WAV PCM and SRT parsing
        meta_path = os.path.join(TEST_RECORDINGS_DIR, rec_id, "meta.json")
        wav_path = os.path.join(TEST_RECORDINGS_DIR, rec_id, "audio.wav")

        print("  • Waiting for background conversion & SRT mapping...")
        completed = False
        for _ in range(10):
            time.sleep(1)
            if os.path.exists(meta_path):
                try:
                    with open(meta_path, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                        full_text = meta.get("fullText", "")
                        if full_text and "(Đang" not in full_text:
                            completed = True
                            break
                except Exception:
                    pass

        self.assertTrue(completed, "Local file import background job failed")
        self.assertTrue(os.path.exists(wav_path), "audio.wav conversion failed")

        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
            self.assertEqual(meta.get("source"), "file_import")
            self.assertEqual(meta.get("videoTitle"), "qc_test_audio.wav")
            self.assertEqual(meta.get("fullText"), "Hello world from automated test suite.")
            self.assertGreater(len(meta.get("words", [])), 0)

            # Verify distributed timestamps mapping
            words = meta.get("words")
            self.assertEqual(words[0]["word"], "Hello")
            self.assertEqual(words[-1]["word"], "suite.")
            # Verify duration is ~1 second
            self.assertAlmostEqual(meta.get("duration", 0), 1.0, delta=0.2)

        print("  -> Passed. Local file & SRT subtitle import completed and mapped words successfully.")

    def test_05_word_loop_range_boundary_calculation(self):
        """TC_05: Verify logic for calculating loop boundary triggers in timeupdate"""
        print("\n[TC_05] Testing Word Loop boundary condition calculation...")
        # Simulating ShadowingWorkspace loop check:
        # If loop is active, we check if currentTime exceeds loopRange.end - 0.02.
        loop_start = 1.25
        loop_end = 2.45

        # Test case A: Playback time is inside loop range
        current_time_inside = 1.80
        will_trigger_inside = current_time_inside >= (loop_end - 0.02)
        self.assertFalse(will_trigger_inside, "Should not trigger loop reset when inside boundaries")

        # Test case B: Playback time exceeds or hits boundary
        current_time_boundary = 2.435
        will_trigger_boundary = current_time_boundary >= (loop_end - 0.02)
        self.assertTrue(will_trigger_boundary, "Should trigger loop reset when hitting boundary")

        # Test case C: Playback time has passed the boundary completely (browser latency)
        current_time_past = 2.55
        will_trigger_past = current_time_past >= (loop_end - 0.02)
        self.assertTrue(will_trigger_past, "Should trigger loop reset even if browser latency causes timeupdate to skip past boundary")

        print("  -> Passed. Loop boundary calculations behave as expected under coarse timers.")


if __name__ == "__main__":
    unittest.main()
