# Phase 04: AI Coach Panel
Status: ⬜ Pending
Dependencies: Phase 03

## Objective
Cấu trúc lại cột bên phải thành "AI Coach Panel" cố định, tương tự như sidebar của Cursor IDE hoặc ChatGPT.

## Requirements
### Functional
- [ ] Hiển thị thông tin dịch, ngữ pháp, phát âm tĩnh tuỳ thuộc vào câu đang chọn (`currentSentence`).
- [ ] Giao diện phân chia Tabs (Grammar, Vocab, Tips) hoặc Flow từ trên xuống dưới dễ đọc.
- [ ] Chatbot form ở cuối panel để chat linh hoạt.
- [ ] Panel có khả năng sticky và scroll độc lập với màn hình bên trái.

## Implementation Steps
1. [ ] Trích xuất / chỉnh sửa khối UI AI Coach bên phải trong `ShadowingWorkspace/index.tsx`.
2. [ ] Style lại bằng các block cảnh báo (Warning/Info boxes) để dễ phân biệt các loại thông tin (Ngữ pháp = Xanh lam, Phát âm = Tím).
3. [ ] Hoàn thiện luồng chat tự do với AI (`handleSendAiQuery`).

## Files to Modify
- `components/ShadowingWorkspace/index.tsx` - Re-style Right column.
- `components/ShadowingWorkspace/FeedbackPanel.tsx` (Nếu cần tách component).

---
Next Phase: Verification & Testing
