# Phase 02: Sentence Cards Toolbar
Status: ⬜ Pending
Dependencies: Phase 01

## Objective
Biến các thẻ câu tĩnh hiện tại thành các thành phần tương tác mạnh mẽ. Bổ sung Toolbar cho từng thẻ câu với các chức năng thiết yếu.

## Requirements
### Functional
- [ ] Khi di chuột (hover) hoặc khi câu đang active, hiển thị rõ ràng Toolbar bên phải/dưới.
- [ ] Nút `Play/Replay`: Phát ngay lập tức câu hiện tại.
- [ ] Nút `Loop`: Kích hoạt vòng lặp liên tục cho câu (Sentence Loop).
- [ ] Nút `Ask AI`: Tự động bắn nội dung câu này vào khung chat AI Coach.
- [ ] Nút `Save Vocab` / `Bookmark`: Lưu nhanh câu để ôn tập.

## Implementation Steps
1. [ ] Thêm các icon tương ứng từ `lucide-react` vào `ShadowingWorkspace/index.tsx`.
2. [ ] Trong vòng lặp `sentences.map`, bổ sung cụm `div` chứa các button hành động.
3. [ ] Liên kết các hàm xử lý (`handlePlaySentence`, `handleAskAICoach`, `handleToggleSaveVocab`).

## Files to Modify
- `components/ShadowingWorkspace/index.tsx` - Update Sentence card render logic.

---
Next Phase: Phase 03 (Sticky Bottom Controller)
