---
name: folder-based-recordings
description: Cấu trúc lưu trữ bản ghi âm mới dưới dạng thư mục đóng gói (audio.wav + meta.json)
metadata: 
  node_type: memory
  type: project
  originSessionId: 86b2d747-685a-4e02-a5a3-cc52f3f8cbcf
  modified: 2026-07-24T14:54:27.020Z
---

Mỗi lượt ghi âm trong ứng dụng VoiceCraft AI sẽ được lưu trữ trong một thư mục riêng biệt đặt tại `recordings/` với tên thư mục có định dạng `REC_${safeCustomName}${timestamp}`.

**Cấu trúc thư mục:**
- `recordings/`
  - `REC_xxx/`
    - `audio.wav` - Tệp tin âm thanh ghi âm chính.
    - `meta.json` - Tệp tin metadata cấu hình đầy đủ.

**Các trường trong meta.json:**
- `filename`: Tên file âm thanh (luôn là `"audio.wav"`).
- `duration`: Thời lượng của file âm thanh (giây).
- `language`: Ngôn ngữ của tệp âm thanh (ví dụ: `"en-US"`).
- `fullText`: Văn bản transcript đầy đủ (được bóc ngầm qua Whisper/Speech API).
- `words`: Mảng danh sách các từ kèm mốc thời gian bắt đầu và kết thúc (`[{ word, start, end }]`) phục vụ cho tính năng Karaoke.
- `createdAt`: Mốc thời gian tạo bản ghi dạng ISO string.
- `fileType`: Loại MIME của âm thanh (luôn là `"audio/wav"`).
- `fileSize`: Kích thước tệp âm thanh tính bằng bytes.
- `aiScore`: (Tùy chọn) Lưu điểm chấm phát âm chi tiết nếu có.

**Tại sao:**
Đóng gói các bản ghi âm thành thư mục giúp cấu trúc thư mục gọn gàng, tránh việc phân tán nhiều tệp tin lẻ (`.wav`, `.txt`, `.json`) trong thư mục gốc `recordings/`, hỗ trợ sao lưu hoặc đồng bộ dễ dàng hơn.

**Cách áp dụng:**
Khi phát triển các tính năng lưu trữ, xử lý bóc chữ hoặc xóa bản ghi âm, cần thao tác trực tiếp với thư mục con đại diện cho ID của bản ghi và cập nhật tệp `meta.json` thay vì chỉnh sửa các file đơn lẻ.
