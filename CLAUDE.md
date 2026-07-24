# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚀 Useful Commands

### Development & Build
- Run parallel development servers (Vite + Node.js API server): `npm run dev`
- Run Node.js API server only: `npm start` or `npm run dev-server`
- Build frontend for production: `npm run build`
- Preview production build: `npm run preview`

### Testing & Python Tools
- Install Python speech dependencies: `pip install SpeechRecognition soundfile`
- Run E2E integration flow test: `python test_full_flow.py`
- Run speech-to-text transcription manually: `python transcribe.py recordings/FILENAME.wav <language_code>`
  - Supported language codes: `en-US` (English, default), `vi-VN` (Vietnamese)

## 🛠️ Code Architecture & Guidelines

### High-Level Architecture
- **Frontend (Vite + React + TS + TailwindCSS)**:
  - Entry point is compiled from `src/`. Static production assets are outputted to `dist/`.
  - `src/hooks/useAudioRecorder.ts`: Captures microphone/system audio using Web Audio API and encodes it directly in the browser to 16-bit 44.1kHz Mono WAV PCM.
  - `src/hooks/useRecordings.ts`: Coordinates API calls (`/api/recordings`, `/api/save-recording`, `/api/transcribe`) and polls backend for ongoing background transcription status.
  - `src/components/ShadowingWorkspace/`: Interactive shadowing workstation featuring word-by-word karaoke synchronization, word loop (shadowing A-B), IPA dictionary lookups, waveform comparison charts, and speech assessment feedback.
- **Backend (Node.js)**:
  - `server.js`: Zero-dependency backend using native `http` module. Serves static production assets from `dist/` and audio streams from `recordings/`.
  - Supports HTTP 206 Range Requests (`Accept-Ranges: bytes`) for audio seeking. Sends no-cache headers for range requests and calls `fileStream.destroy()` on connection close (`req.on('close')`) to prevent socket leaks.
- **Speech to Text (Python)**:
  - `transcribe.py`: Executed as a non-blocking background child process by `server.js`.
  - Splits audio into 6-second chunks for processing via Google Speech Recognition, outputting a raw text transcript (`.txt`) and a structured json metadata file (`.json`) containing word timestamps (`{ word, start, end }`).

### Coding Guidelines
- **Backend (Node.js)**: Maintain zero external dependencies. Do not import Express or other web frameworks. Clean up accompanying `.wav`, `.txt`, and `.json` files from `recordings/` when a recording is deleted.
- **Frontend**: Match existing layout variables and styling guidelines in `tailwind.config.js`. Avoid using external CSS transitions on word highlights that could cause karaoke sync layout shifts.
- **Python**: Reconfigure standard output streams to use UTF-8 (`sys.stdout.reconfigure(encoding='utf-8')`) when handling Windows console interactions. Ensure output JSON structures match the existing schema so client-side karaoke playback works seamlessly.
