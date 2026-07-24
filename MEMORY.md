# Học tập & Dự án Memory - VoiceCraft Studio

Danh sách thông tin ghi nhớ về dự án dùng để tra cứu nhanh khi bảo trì, phát triển hoặc tối ưu mã nguồn.

## 📚 Memory Files
- [Tổng quan dự án & Cấu trúc API](C:/Users/tu.vancong/.claude/projects/d--git-self-audio-recording/memory/project-overview.md) — Kiến trúc hệ thống, backend Node.js, Frontend Glassmorphism và các API endpoints.
- [Bộ Nhận Diện Giọng Nói Python](C:/Users/tu.vancong/.claude/projects/d--git-self-audio-recording/memory/python-transcription-engine.md) — Cách transcribe.py hoạt động, cơ chế bóc tách mốc thời gian từ tương đối.
- [Tính Năng Học Tiếng Anh Tương Tác](C:/Users/tu.vancong/.claude/projects/d--git-self-audio-recording/memory/learning-features.md) — Chi tiết về Karaoke Sync, Click-to-Seek, Shadowing Loop và Dictionary Lookup ở Client.

## 🤖 Custom Agents
- **audio-expert** (`.claude/agents/audio-expert.md`) — Xử lý và tối ưu các nghiệp vụ liên quan đến file âm thanh, Python STT, thuật toán chunking, chuyển đổi mô hình nhận dạng giọng nói.
- **learning-ui-designer** (`.claude/agents/learning-ui-designer.md`) — Thiết kế và nâng cấp giao diện frontend tương tác học tiếng Anh (Karaoke, Shadowing, CSS Glassmorphism, i18n).

## ⚡ Workflows
- **audit-recordings** (`.claude/workflows/audit-recordings.js`) — Quét thư mục `recordings/`, tìm bản ghi thiếu transcript (`.txt`/`.json`) và tự động chạy Python bóc chữ hàng loạt.
- **e2e-test-runner** (`.claude/workflows/e2e-test-runner.js`) — Khởi chạy server Node.js nền, chạy test Python tích hợp `test_full_flow.py`, sau đó tắt server và báo cáo kết quả.

## 🛠️ Recommended Skills
Các Skills hệ thống (built-in) phù hợp với dự án:
- `/run` — Khởi chạy server phát triển (`npm start`) và xác nhận ứng dụng hoạt động.
- `/test` — Chạy bộ kiểm thử Python (`python test_full_flow.py`).
- `/code-review` — Quét mã nguồn tìm lỗi logic, bảo mật và hiệu năng.
- `/check` — Xác nhận toàn bộ hệ thống build và chạy OK.
- `/init` — Tái tạo hoặc cập nhật file CLAUDE.md nếu cần.

## 📋 Project Config
- **CLAUDE.md** — Hướng dẫn phát triển, lệnh build/run/test và quy chuẩn code.
- **.claude/settings.json** — Allowlist quyền thực thi lệnh (npm start, node server.js, python test).
