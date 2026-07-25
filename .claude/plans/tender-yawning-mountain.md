# Context
The draft YouTube feature is a good product idea, but it cannot ship as a separate lesson format. The app already has a single lesson runtime: `server.js` stores lessons in `recordings/REC_*/audio.wav` + `meta.json`, `/api/recordings` reads that shape, and `ShadowingWorkspace` consumes the resulting `Recording` directly for transcript playback, word/segment looping, and AI retraining.

The implementation goal is to make a YouTube URL turn into a normal lesson that the existing library and shadowing workspace can open without special-casing the rest of the app.

# Recommended approach
## 1) Make YouTube import produce the same lesson contract the app already understands
- Keep `Recording` as the runtime contract.
- Persist imported lessons under `recordings/REC_YT_<videoId>_<timestamp>/` with the same `audio.wav` and `meta.json` layout the app already reads.
- Store YouTube-specific fields as optional metadata only; do not introduce a second lesson schema or a separate playback path.
- Reuse the current `processing` convention so the Header and Library UI can show progress while the import job is running.

## 2) Add a backend import pipeline that normalizes YouTube data into existing metadata
- Add a new endpoint in `server.js`, e.g. `POST /api/import-youtube`, that accepts a YouTube URL plus the same provider/settings payload shape already used for transcription fallbacks.
- Validate `youtube.com` / `youtu.be` up front and reject anything else before any work starts.
- Resolve video metadata first: `videoId`, `title`, `channel`, `duration`, `language`, `thumbnail`, and the source URL.
- Capture captions in this order:
  1. manual English captions
  2. auto-generated English captions
  3. STT fallback from downloaded audio if the configured speech-to-text path is available
- If captions exist, keep them verbatim. Preserve original wording, punctuation, line breaks, and timestamps.
- If captions do not exist and STT fallback is unavailable, fail cleanly and do not invent a transcript.
- For compatibility with the current app, map caption segments into the existing `words` array as segment-level tokens when needed, while preserving the raw segment list in optional metadata if we want to keep the YouTube import faithfully represented.
- Write `meta.json` using the same fields the app already consumes: `fullText`, `words`, `language`, `createdAt`, `dictionary`, `aiScore`, plus optional YouTube metadata such as `source`, `sourceUrl`, `videoId`, `title`, `channel`, and `thumbnail`.

## 3) Keep the backend thin by reusing the existing helper pattern
- Prefer a dedicated helper script for the import worker rather than embedding YouTube extraction logic directly into the HTTP handler.
- The helper should be responsible for the long-running parts: metadata resolution, caption extraction, and optional audio acquisition/STT normalization.
- `server.js` should orchestrate the job, write the initial placeholder metadata, and then hand off to the helper in the same way it already launches transcription work.
- If the helper needs to update a lesson as it progresses, keep using the same folder and `meta.json` update pattern so `/api/recordings` polling keeps working.

## 4) Surface the import entrypoint in the existing library UI
- Add an “Import from YouTube” action in `src/components/LibrarySidebar/index.tsx` so the feature lives where lessons are discovered and opened.
- Use `useDialog()` prompt/confirm/alert for URL entry, validation errors, and completion messaging instead of introducing a new modal system.
- Wire the action through `AppLayout` and `useRecordings` so the import call sits beside save/delete/retranscribe logic and reuses the existing refresh/poll flow.
- When the import completes, reload the recordings list and open the new lesson through the same `activeLesson` path used for local recordings.

## 5) Extend the data model only where the UI needs to display import provenance
- Update `src/types.ts` with optional fields for YouTube provenance, such as `source`, `sourceUrl`, `videoId`, `title`, `channel`, `thumbnail`, and a flag that indicates whether the transcript came from captions or STT.
- Pass those optional fields through `/api/recordings` so imported lessons can be labeled in the library without affecting existing recordings.
- If helpful, show a small source badge in `LessonCard` for imported lessons; otherwise keep the library UI unchanged.
- Keep `ShadowingWorkspace` reading a normal `Recording` so playback, speed control, loop word, and AI transcribe continue to work unchanged.

# Critical files
- `server.js` — add the import endpoint, job orchestration, and normalized metadata writing.
- `src/hooks/useRecordings.ts` — add the client-side import action and reuse the existing reload/polling flow.
- `src/components/LibrarySidebar/index.tsx` — place the YouTube import button or empty-state CTA.
- `src/components/AppLayout.tsx` — pass the import action through and keep the active lesson in sync after refresh.
- `src/components/LibrarySidebar/LessonCard.tsx` — optionally display YouTube provenance if the new metadata is present.
- `src/types.ts` — add optional import/source fields only.
- `src/context/DialogContext.tsx` — reuse the existing prompt/confirm/alert dialogs for the import UX.
- `src/components/ShadowingWorkspace/index.tsx` — verify imported lessons open with the same playback and AI actions as local lessons.
- `transcribe.py` or a new helper script such as `youtube_import.py` — reuse the current Python background-worker pattern if the import path needs STT normalization.

# Verification
1. Run `npm run build`.
2. Import a known YouTube URL and verify a new `recordings/REC_YT_*/` folder is created with `audio.wav` and `meta.json`.
3. Confirm the imported lesson appears in the library, opens in `ShadowingWorkspace`, and keeps speed control, loop word, and AI transcribe working.
4. Verify captions preserve the original transcript and timestamps when captions exist, and that the fallback path refuses to invent a transcript when neither captions nor STT are available.
5. Confirm the Header/library processing indicators reflect the import job while it is still running.
