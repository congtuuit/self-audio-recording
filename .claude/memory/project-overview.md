---
name: project-overview
description: "Tổng quan về kiến trúc dự án VoiceCraft Studio - Thu âm, quay màn hình và học tiếng Anh tương tác"
metadata: 
  node_type: memory
  type: project
  originSessionId: de9bd2c6-cb8e-4566-861d-17c71859a3a1
  modified: 2026-07-24T14:07:04.844Z
---

# VoiceCraft Studio (Self Audio Recording)

Một ứng dụng cá nhân nhẹ giúp ghi âm trực tiếp trên trình duyệt, quay màn hình, tự động bóc văn bản (Speech-to-Text) và hỗ trợ học tiếng Anh tương tác.

## 🛠️ Công nghệ sử dụng
- **Frontend**: HTML5, Vanilla CSS, JS Native (Web Audio API, Web Speech API, MediaStream).
- **Backend**: Node.js sử dụng package `http` nguyên bản (không dùng Express) chạy tại port 3000.
- **AI/STT Engine**: Python 3 dùng `speech_recognition` (Google API) và `soundfile` phục vụ việc nhận diện giọng nói và chia nhỏ file âm thanh để tăng độ chính xác.

## 📁 Cấu trúc file chính
- [[project-overview]]: Bản thiết kế tổng quan kiến trúc.
- [server.js](d:/git/self-audio-recording/server.js): Quản lý lưu trữ âm thanh, phục vụ static frontend và kết nối chạy ngầm Python transcription.
- [transcribe.py](d:/git/self-audio-recording/transcribe.py): Xử lý bóc tách âm thanh thành văn bản và phân rã mốc thời gian từ (Word-level timestamps). Chi tiết tại [[python-transcription-engine]].
- [public/app.js](d:/git/self-audio-recording/public/app.js): Core Frontend điều khiển ghi âm, trộn nguồn âm thanh (Mic + System), và UI Karaoke Player phục vụ học tập. Chi tiết tại [[learning-features]].
- [public/index.html](d:/git/self-audio-recording/public/index.html) & [public/style.css](d:/git/self-audio-recording/public/style.css): Giao diện Glassmorphism Dark Mode.
- [public/i18n.js](d:/git/self-audio-recording/public/i18n.js): Hệ thống dịch giao diện đa ngôn ngữ (Anh/Việt).
- `recordings/`: Thư mục lưu trữ cục bộ các tệp `.wav`, `.txt` (transcript thô) và `.json` (metadata + timestamps từ).

## 🔌 API Endpoints
1. `GET /api/recordings`: Trả về danh sách tất cả các bản ghi có sẵn, bao gồm text transcript, metadata từ, và trạng thái `processing` của tiến trình chạy ngầm.
2. `POST /api/save-recording`: Lưu tệp audio (gửi dạng base64 từ client) xuống đĩa cứng dưới định dạng WAV PCM. Endpoint này hoạt động **bất đồng bộ (non-blocking)**: lập tức trả phản hồi nhanh và kích hoạt tiến trình Python chạy ngầm dưới nền.
3. `POST /api/transcribe/:id`: Trigger thủ công bộ xử lý Python để bóc lại chữ với ngôn ngữ lựa chọn mới.
4. `DELETE /api/recordings/:id`: Xóa tệp WAV, TXT và JSON tương ứng của bản ghi.
5. `GET /recordings/:filename`: Trình phát hoặc tải về trực tiếp tệp từ thư mục lưu trữ. Hỗ trợ đầy đủ **HTTP Range Requests (status 206)** và tự động dọn dẹp stream khi bị ngắt kết nối đột ngột, giúp trình duyệt seek audio mượt mà 100%.
