---
name: learning-features
description: "Các chức năng tương tác hỗ trợ học tiếng Anh tại Frontend (i18n, Shadowing, Audio-Text Sync, Focus Workspace)"
metadata: 
  node_type: memory
  type: reference
  originSessionId: de9bd2c6-cb8e-4566-861d-17c71859a3a1
  modified: 2026-07-24T14:07:05.893Z
---

# Các Tính Năng Hỗ Trợ Học Tiếng Anh Tương Tác

Giao diện VoiceCraft Studio cung cấp các công cụ tương tác mạnh mẽ giúp người dùng luyện nghe nói, shadowing và học từ vựng trực tiếp trên các bản ghi âm của mình. Các tính năng này được thiết kế tại [public/app.js](d:/git/self-audio-recording/public/app.js).

## 1. Đồng bộ Karaoke (Karaoke Word Highlighting & Sync)
- **Cơ chế:** Khi người dùng click nút "Học bài này", frontend nạp bài học vào một khu vực học tập tập trung (**Focus Learning Workspace**).
- **Render từ tương tác:** Toàn bộ văn bản transcript được tách thành từng từ, mỗi từ được bao bọc trong thẻ `<span class="interactive-word">`.
- **Highlight:** Lắng nghe sự kiện `ontimeupdate` của thẻ `<audio>` dùng chung toàn cục `#globalLearningAudio`. Khi `currentTime` nằm trong khoảng `[start, end]` của từ nào, từ đó sẽ được thêm class `.active-word` để highlight.
- **Mượt mà (No layout shift):** Loại bỏ toàn bộ `transition: all` và `transform: scale` trên từ đang phát, chỉ transition nhẹ background màu để tránh xê dịch dòng chữ gây giật màn hình khi phát tốc độ nhanh.

## 2. Các công cụ điều khiển học tập
- **Click-to-Seek:** Người dùng có thể click chuột trái vào bất kỳ từ nào trên transcript tương tác để điều hướng audio phát ngay tại mốc thời gian bắt đầu của từ đó (`audioEl.currentTime = word.start`). Server hỗ trợ HTTP 206 Range giúp việc tua mượt mà và chính xác từ lần phát thứ hai trở đi.
- **Shadowing Loop (Lặp câu):** Khi bật chế độ lặp câu, trình phát nhạc sẽ liên tục thiết lập lại `currentTime` về thời gian bắt đầu của từ đang được highlight nếu thời gian hiện tại vượt quá mốc kết thúc của từ đó.
- **Điều chỉnh tốc độ phát (Playback Speed):** Cho phép thay đổi tốc độ đọc từ `0.5x`, `1.0x` (mặc định), `1.5x` đến `2.0x` (mỗi step là `0.5`).
- **Tra từ điển nhanh (Dictionary Lookup):** Double click vào bất kỳ từ nào trên transcript tương tác sẽ gọi API Dictionary để lấy phiên âm IPA và định nghĩa ngắn.
- **Smart Auto-scroll:** Hệ thống tự động cuộn hộp transcript khi từ đang phát vượt ra ngoài tầm nhìn (viewport của box). Khi người dùng rê chuột vào hộp chữ (hovering), auto-scroll sẽ tự động tạm ngắt để tránh tranh chấp quyền cuộn chuột với người dùng.
