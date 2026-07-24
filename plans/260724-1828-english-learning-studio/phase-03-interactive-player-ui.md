# Phase 03: Interactive Subtitle & Karaoke Player (Word Sync & Click-to-Seek)
Status: ✅ Complete
Dependencies: Phase 02

## Objective
Xây dựng trình nghe âm thanh tương tác (Interactive Audio Player) trên giao diện Web: Tự động tô sáng (highlight) từ đang đọc theo audio và cho phép bấm vào từ bất kỳ để tua phát lại đúng từ đó.

## Functional Requirements
- [ ] Render transcript dưới dạng các thẻ span từng từ `<span data-start="x" data-end="y" class="word">word</span>`.
- [ ] Lắng nghe sự kiện `timeupdate` của `<audio>`: Tự động highlight từ tương ứng với `currentTime` (Karaoke Sync) và cuộn trang tới từ đó.
- [ ] Lắng nghe sự kiện click trên từng từ: Khi user bấm vào từ bất kỳ, gán `audio.currentTime = word.start` và tự động phát audio từ điểm đó (Click-to-Seek).

## Files to Create/Modify
- `public/index.html` - [MODIFY] Nâng cấp giao diện Transcript Box hỗ trợ chế độ đọc tương tác
- `public/style.css` - [MODIFY] Thêm style CSS cho từ đang đọc (`.word-highlight`, `.word-active`, animation cuộn mượt)
- `public/app.js` - [MODIFY] Viết hàm `renderInteractiveTranscript()` và xử lý sync `timeupdate` & click seek

## Test Criteria
- [ ] Bật nghe audio -> Chữ chạy tô sáng đổi màu chính xác theo giọng đọc.
- [ ] Bấm vào một từ bất kỳ ở giữa câu -> Audio tua ngay lập tức tới đúng phát âm của từ đó.

---
Next Phase: `phase-04-learning-features.md`
