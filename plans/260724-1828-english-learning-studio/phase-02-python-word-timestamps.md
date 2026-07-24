# Phase 02: Python Word-Level Timestamp Engine
Status: ✅ Complete
Dependencies: Phase 01

## Objective
Nâng cấp engine Python `transcribe.py` để bóc tách mốc thời gian chi tiết của từng từ (Word-level timestamps: `word`, `start_time`, `end_time`) và xuất file JSON song song với file TXT.

## Functional Requirements
- [ ] Nâng cấp `transcribe.py` xuất ra dữ liệu mốc thời gian chi tiết từng từ dưới dạng JSON.
- [ ] Lưu file `recordings/REC_xxx.json` cùng tên với file `REC_xxx.wav` và `REC_xxx.txt`.
- [ ] Cập nhật API `GET /api/recordings` và `POST /api/transcribe/:id` trên `server.js` để gửi kèm mảng timestamp JSON về Web UI.

## Files to Create/Modify
- `transcribe.py` - [MODIFY] Bổ sung logic bóc tách word timestamps và ghi file `REC_xxx.json`
- `server.js` - [MODIFY] Trả về dữ liệu `wordTimestamps` trong API recordings & transcribe

## Test Criteria
- [ ] Thu âm 1 file audio mẫu -> Kiểm tra file `recordings/REC_xxx.json` chứa danh sách mảng các từ kèm `start` và `end`.
- [ ] Gọi API `GET /api/recordings` -> Nhận được mảng `wordTimestamps`.

---
Next Phase: `phase-03-interactive-player-ui.md`
