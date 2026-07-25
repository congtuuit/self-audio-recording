# Phase 01: Dual-Column Layout & Video Restructure
Status: ⬜ Pending
Dependencies: None

## Objective
Thiết lập lại cấu trúc xương sống của màn hình ShadowingWorkspace. Áp dụng chuẩn Dual-Column (65% trái - 35% phải) và giới hạn video ở kích thước vừa phải để Transcript nổi bật ở trung tâm.

## Requirements
### Functional
- [ ] Màn hình chia làm 2 cột rõ ràng trên Desktop (grid-cols-[1.5fr_1fr] hoặc flex).
- [ ] Video component được ghim ở kích thước `max-h-[220px]-280px` để không chiếm dụng diện tích, có shadow nổi bật.
- [ ] Vùng Transcript (`transcriptContainerRef`) được tối ưu cuộn mượt mà bên dưới Video.

### Non-Functional
- [ ] Responsive: Trên mobile vẫn giữ luồng dọc (Video -> Transcript -> AI Coach).

## Implementation Steps
1. [ ] Chỉnh sửa `ShadowingWorkspace/index.tsx`. Tìm thẻ `grid lg:grid-cols-[1.5fr_1fr]` và đảm bảo nó bao bọc chính xác.
2. [ ] Sửa thẻ `video` và wrapper của nó: thay đổi CSS classes `max-h-[260px]` thành max 240px, thêm shadow và bo góc tinh tế.
3. [ ] Kiểm tra lại hành vi Auto-scroll khi UI layout thay đổi.

## Files to Modify
- `components/ShadowingWorkspace/index.tsx` - Re-structure HTML/Tailwind classes.

---
Next Phase: Phase 02 (Sentence Cards Toolbar)
