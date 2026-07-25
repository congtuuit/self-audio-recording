# Phase 03: Sticky Bottom Controller
Status: ⬜ Pending
Dependencies: Phase 02

## Objective
Thêm thanh điều khiển media nổi (sticky) dưới đáy màn hình, luôn hiển thị trong quá trình học tập để điều khiển dễ dàng.

## Requirements
### Functional
- [ ] Controller bám đáy (`fixed bottom-0` hoặc `sticky`), thiết kế dạng floating island (như Dynamic Island / Mac dock).
- [ ] Chứa nút Phát / Tạm dừng lớn ở giữa.
- [ ] Chứa nút tốc độ (0.5x, 0.75x, 1x).
- [ ] Chứa tính năng **Auto-Pause**: Dừng ở cuối mỗi câu (Shadowing mode).
- [ ] Chứa nút Bật/Tắt Microphone thu âm trực tiếp.

## Implementation Steps
1. [ ] Tạo hoặc update `StatusBar` / Media bar dưới cùng của `ShadowingWorkspace/index.tsx`.
2. [ ] Viết UI cho Floating Controller với Glassmorphism (`backdrop-blur bg-card/80`).
3. [ ] Đảm bảo state `isAutoPauseActive` hoạt động chuẩn.

## Files to Modify
- `components/ShadowingWorkspace/index.tsx` - Add bottom floating controller.

---
Next Phase: Phase 04 (AI Coach Panel)
