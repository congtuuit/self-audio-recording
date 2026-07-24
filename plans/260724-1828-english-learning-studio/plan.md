# Plan: VoiceCraft English Studio - Interactive Learning & Recording Platform
Created: 2026-07-24 18:28:00
Status: ✅ Complete

## Overview
Nâng cấp ứng dụng VoiceCraft từ một công cụ thu âm đơn thuần thành **Studio Thu âm / Quay màn hình & Học tiếng Anh tương tác**. Hỗ trợ đồng bộ từ theo thời gian thực (Karaoke Word-Sync), click vào từ để tua audio, lặp lại đoạn phát âm (Shadowing Loop), điều chỉnh tốc độ đọc, giao diện đa ngôn ngữ (Tiếng Việt & Tiếng Anh), và tùy chọn quay màn hình HD.

## Tech Stack
- **Frontend**: HTML5 + Vanilla CSS (Glassmorphism Dark Mode) + JavaScript Native (MediaRecorder, Web Audio API, i18n Engine, Audio Player Sync).
- **Backend**: Node.js Native HTTP Server (`server.js`).
- **AI / Speech Engine**: Python (`transcribe.py` + `speech_recognition` / `whisper` / `vosk` bóc tách Word-Level Timestamps).

---

## 📋 Phases Roadmap

| Phase | Name | Description | Status | Progress |
|-------|------|-------------|--------|----------|
| 01 | Multi-language UI (i18n) | Tích hợp hệ thống chuyển đổi ngôn ngữ giao diện (vi-VN & en-US) | ✅ Complete | 100% |
| 02 | Python Word-Level Timestamp Engine | Nâng cấp `transcribe.py` xuất file `REC_xxx.json` chứa mốc thời gian từng từ | ✅ Complete | 100% |
| 03 | Interactive Subtitle & Karaoke Player | Xây dựng Player highlight từ theo audio & click từ để tua lại (Click-to-Seek) | ✅ Complete | 100% |
| 04 | English Learning Tools (Shadowing & Speed) | Nâng cấp bộ công cụ học tiếng Anh: A-B Loop, Speed Control (0.5x - 1.25x), Tra từ | ✅ Complete | 100% |
| 05 | Screen Recorder Option | Bổ sung tùy chọn Quay màn hình HD (.webm/.mp4) bên cạnh thu âm (.wav) | ✅ Complete | 100% |
| 06 | E2E Integration & Verification | Kiểm thử toàn bộ luồng thu âm, bóc chữ, học tiếng Anh & tối ưu UI/UX | ✅ Complete | 100% |

---

## Quick Commands
- Bắt đầu Phase 1: `/code phase-01`
- Kiểm tra tiến độ: `/next`
- Lưu context: `/save-brain`
