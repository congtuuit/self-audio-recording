# Phase 01: Multi-language UI (i18n Engine)
Status: ✅ Complete
Dependencies: None

## Objective
Tích hợp bộ chuyển đổi ngôn ngữ giao diện (i18n) hỗ trợ 2 ngôn ngữ chính: 🇻🇳 Tiếng Việt (`vi-VN`) và 🇺🇸 Tiếng Anh (`en-US`), giúp người dùng chuyển đổi ngôn ngữ ứng dụng mượt mà 1-click.

## Functional Requirements
- [ ] Tạo file từ điển i18n (`public/i18n.js` hoặc object JSON chứa tất cả nhãn tiếng Việt & tiếng Anh).
- [ ] Thêm nút chuyển đổi ngôn ngữ giao diện (Language Toggle Button: 🇻🇳 VN / 🇺🇸 EN) ở góc trên Header.
- [ ] Tự động lưu lựa chọn ngôn ngữ giao diện của người dùng vào `localStorage`.
- [ ] Cập nhật tất cả nhãn UI (Tiêu đề, trạng thái, nút bấm, hướng dẫn, toast notification, thông báo lỗi).

## Files to Create/Modify
- `public/i18n.js` - [NEW] File từ điển dịch nhãn UI (Việt - Anh) & hàm `setLanguage(lang)`
- `public/index.html` - [MODIFY] Thêm атрибу t `data-i18n` vào các phần tử giao diện & nút đổi ngôn ngữ Header
- `public/app.js` - [MODIFY] Tích hợp gọi `setLanguage()` và lắng nghe sự kiện đổi ngôn ngữ UI

## Test Criteria
- [ ] Bấm nút chuyển đổi 🇻🇳 / 🇺🇸 -> Toàn bộ nhãn giao diện thay đổi ngay lập tức không cần reload trang.
- [ ] Tải lại trang (F5) -> Ngôn ngữ đã chọn được giữ nguyên.

---
Next Phase: `phase-02-python-word-timestamps.md`
