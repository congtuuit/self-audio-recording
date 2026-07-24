# Phase 05: Screen Recorder Option & Video Subtitle Player
Status: ✅ Complete
Dependencies: Phase 04

## Objective
Bổ sung tùy chọn Quay màn hình HD (Screen Recorder xuất file `.webm`/`.mp4`) bên cạnh tùy chọn Thu âm (.wav), tích hợp trình xem video có phụ đề tương tác.

## Functional Requirements
- [ ] Bổ sung tùy chọn chế độ quay: `🎙️ Thu âm Audio (.wav)` hoặc `📹 Quay Màn Hình (.webm)`.
- [ ] Ghi lại cả Video màn hình + Âm thanh hệ thống + Micro bằng `MediaRecorder API`.
- [ ] Cập nhật Backend Node.js nhận file video và gọi Python bóc tách audio track để sinh ra transcript.
- [ ] Trình xem lại hỗ trợ cả thẻ `<video>` có phụ đề tương tác chạy song song.

## Files to Create/Modify
- `public/index.html` - [MODIFY] Bổ sung selector chế độ Quay Màn Hình & thẻ `<video>` preview
- `public/app.js` - [MODIFY] Viết logic capture screen video stream & MediaRecorder webm
- `server.js` - [MODIFY] Hỗ trợ lưu trữ & phát lại file video `.webm` / `.mp4`

## Test Criteria
- [ ] Chọn Quay màn hình -> Bấm quay -> Xuất file `.webm` phát lại mượt mà kèm video + tiếng.
- [ ] Kiểm tra file `.txt` và `.json` transcript từ video được tạo chính xác.

---
Next Phase: Completed
