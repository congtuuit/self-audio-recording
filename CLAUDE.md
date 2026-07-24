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
  - Supports OpenAI Whisper API transcription (obtaining word timestamps with `timestamp_granularities[]=word`) when `whisperKey` is provided, falling back automatically to `transcribe.py` (local Google API) on failure or when key is absent.
- **Speech to Text (Python)**:
  - `transcribe.py`: Executed as a non-blocking background child process by `server.js`.
  - Splits audio into 6-second chunks for processing via Google Speech Recognition, outputting a raw text transcript (`.txt`) and a structured json metadata file (`.json`) containing word timestamps (`{ word, start, end }`).

### Coding Guidelines
- **Backend (Node.js)**: Maintain zero external dependencies. Do not import Express or other web frameworks. Clean up accompanying `.wav`, `.txt`, and `.json` files from `recordings/` when a recording is deleted.
- **Frontend**: Match existing layout variables and styling guidelines in `tailwind.config.js`. Avoid using external CSS transitions on word highlights that could cause karaoke sync layout shifts. Workspace settings (API Key, Sample Rate, Auto Gain) are saved in `localStorage` under `voicecraft_settings`.
- **Plans & Memory**: Project plans are stored locally in [.claude/plans/](.claude/plans/) instead of global directories.
- **Python**: Reconfigure standard output streams to use UTF-8 (`sys.stdout.reconfigure(encoding='utf-8')`) when handling Windows console interactions. Ensure output JSON structures match the existing schema so client-side karaoke playback works seamlessly.

## graphify

This project has a graphify knowledge graph at .graphify/.

Rules:
- For codebase or architecture questions, when `.graphify/graph.json` exists, first run `graphify query "<question>"` (or `graphify path "<A>" "<B>"` / `graphify explain "<concept>"`); these return a scoped subgraph, usually much smaller than `GRAPH_REPORT.md` or raw grep output
- If .graphify/wiki/index.md exists, navigate it instead of reading raw files
- If .graphify/graph.json is missing but graphify-out/graph.json exists, run `graphify migrate-state --dry-run` first; if tracked legacy artifacts are reported, ask before using the recommended `git mv -f graphify-out .graphify` and commit message
- If .graphify/needs_update exists or .graphify/branch.json has stale=true, warn before relying on semantic results and run /graphify . --update when appropriate
- Before proposing or committing .graphify artifacts, run `graphify portable-check .graphify`; commit-safe graph artifacts must use repo-relative paths, and never commit .graphify/branch.json, .graphify/worktree.json, .graphify/needs_update, or .graphify/cache/. If a repo already tracks any of them, first add them to .gitignore, then propose `git rm --cached .graphify/branch.json .graphify/worktree.json .graphify/needs_update` and `git rm -r --cached .graphify/cache`; never mutate git state without asking
- Before deep graph traversal, prefer `graphify summary --graph .graphify/graph.json` for compact first-hop orientation
- For review impact on changed files, use `graphify review-delta --graph .graphify/graph.json` instead of generic traversal
- Read `.graphify/GRAPH_REPORT.md` only for broad architecture review or when `query` / `path` / `explain` do not surface enough context
- After modifying code files in this session, run `npx graphify hook-rebuild` to keep the graph current
