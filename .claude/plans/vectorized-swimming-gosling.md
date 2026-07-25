# Kế hoạch chuyển các plans từ global sang local

## Bối cảnh (Context)
Hiện tại các tệp kế hoạch (plans) của dự án này đang được lưu ở thư mục global của Claude Code (`C:\Users\tu.vancong\.claude\plans\`). Để dễ dàng quản lý và chia sẻ các kế hoạch phát triển trực tiếp trong kho mã nguồn (repository), chúng ta cần chuyển chúng vào thư mục cục bộ của dự án (`.claude/plans/`).

## Các bước thực hiện (Proposed Changes)

1. **Tạo thư mục plans cục bộ:**
   - Tạo thư mục `d:\git\self-audio-recording\.claude\plans\` (nếu chưa tồn tại).

2. **Chuyển kế hoạch phát triển của dự án:**
   - Đọc nội dung tệp kế hoạch `C:\Users\tu.vancong\.claude\plans\agile-giggling-dragon.md` (Kế hoạch Refactor VoiceCraft Studio thành Premium AI Shadowing SaaS Studio).
   - Ghi nội dung đó vào tệp cục bộ tương ứng: `d:\git\self-audio-recording\.claude\plans\agile-giggling-dragon.md`.
   - Xóa tệp cũ ở thư mục global để tránh trùng lặp.

3. **Di chuyển kế hoạch hiện tại (tùy chọn):**
   - Sau khi hoàn thành nhiệm vụ và được phê duyệt, di chuyển hoặc sao chép chính tệp kế hoạch này (`vectorized-swimming-gosling.md`) vào thư mục `.claude/plans/` cục bộ.

## Kế hoạch Xác minh (Verification Plan)
1. Xác nhận thư mục `.claude/plans/` cục bộ được tạo thành công và chứa tệp `agile-giggling-dragon.md`.
2. Kiểm tra xem nội dung của tệp cục bộ có khớp hoàn toàn với tệp global cũ không.
3. Xác nhận tệp global cũ `agile-giggling-dragon.md` đã được xóa sạch sẽ.
