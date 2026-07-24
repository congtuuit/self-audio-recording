# Phase 04: English Learning Tools (Shadowing & Playback Controls)
Status: ✅ Complete
Dependencies: Phase 03

## Objective
Bổ sung các công cụ chuyên sâu hỗ trợ học Tiếng Anh: Điều chỉnh tốc độ phát (`0.5x`, `0.75x`, `1.0x`, `1.25x`), tính năng lặp đoạn ngắn (Shadowing Loop / A-B Loop) và popup tra từ điển nhanh.

## Functional Requirements
- [ ] Bổ sung thanh chọn tốc độ phát âm thanh (`playbackRate`: 0.5x, 0.75x, 1.0x, 1.25x, 1.5x).
- [ ] Thêm nút Lặp lại từ/câu (Loop Word / Loop Sentence) giúp người học luyện nhại giọng theo phương pháp Shadowing.
- [ ] Tích hợp tính năng bấm đúp (double-click) từ bất kỳ để hiển thị Popup phiên âm IPA & nghĩa từ điển (kết nối Free Dictionary API).

## Files to Create/Modify
- `public/index.html` - [MODIFY] Bổ sung thanh điều khiển tốc độ phát & nút lặp Shadowing Loop
- `public/app.js` - [MODIFY] Viết logic chỉnh tốc độ `playbackRate`, A-B Loop & gọi Dictionary API

## Test Criteria
- [ ] Đổi tốc độ phát sang 0.75x -> Giọng đọc chậm lại rõ ràng nhưng không bị méo tiếng.
- [ ] Bật Shadowing Loop cho 1 từ -> Audio tự lặp đi lặp lại từ đó.
- [ ] Bấm đúp vào 1 từ tiếng Anh -> Hiện popup phiên âm IPA và định nghĩa.

---
Next Phase: `phase-05-screen-recorder-integration.md`
