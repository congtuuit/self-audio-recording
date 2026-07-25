---
name: python-transcription-engine
description: Chi tiết về script transcribe.py và cách ước tính word timestamps
metadata: 
  node_type: memory
  type: reference
  originSessionId: de9bd2c6-cb8e-4566-861d-17c71859a3a1
  modified: 2026-07-24T15:19:25.706Z
---

# Bộ Nhận Diện Giọng Nói Python (transcribe.py)

Bộ xử lý giọng nói nằm ở file [transcribe.py](d:/git/self-audio-recording/transcribe.py), được trigger tự động khi backend Node.js nhận được yêu cầu lưu âm thanh không có live transcript hoặc trigger thủ công từ nút "AI Transcribe" trên giao diện.

## ⚙️ Cơ chế hoạt động
1. **Đọc tệp âm thanh:**
   Sử dụng thư viện `soundfile` để đọc file WAV. Nếu âm thanh là Stereo (nhiều kênh), nó tự động trộn thành Mono bằng cách lấy trung bình cộng các kênh: `data = data.mean(axis=1)`.
2. **Chia nhỏ Chunk (Chunking):**
   Vì Google Speech Recognition API miễn phí hoạt động kém/giới hạn thời lượng đối với tệp dài, script chia âm thanh thành các đoạn nhỏ khoảng **6.0 giây**.
3. **Phát hiện và Nhận dạng:**
   Chuyển đổi từng đoạn 6s sang định dạng Int16 PCM, đóng gói vào `BytesIO` dưới dạng tệp WAV tạm thời và gửi tới Google Speech API thông qua thư viện `speech_recognition`.
   - Ngôn ngữ mặc định được truyền từ Node.js (ví dụ `en-US` hoặc `vi-VN`).
   - Nếu nhận dạng ngôn ngữ chính thất bại, script sẽ tự động thử lại với ngôn ngữ thay thế (Alternate Language - đảo ngược giữa tiếng Anh và tiếng Việt).
   - Thiết lập giới hạn thời gian mạng thông qua `socket.setdefaulttimeout(15)` tại đầu script. Điều này giúp ngăn chặn tiến trình Python bị treo vô hạn khi xảy ra nghẽn mạng hoặc bị chặn bởi nhà mạng/tường lửa kết nối tới máy chủ Google.
   - **Chú ý quan trọng:** Hàm `recognizer.recognize_google(...)` của thư viện `SpeechRecognition` không hỗ trợ đối số `timeout`. Do đó, không được truyền tham số `timeout=10` vào hàm này để tránh lỗi `TypeError` làm sập luồng xử lý.
4. **Ước tính Word-Level Timestamps (Mốc thời gian từng từ):**
   Vì Google Web Speech API miễn phí không trả về mốc thời gian cho từng từ (word timestamps), script tự ước tính một cách tương đối:
   - Lấy tổng thời lượng của chunk khả dụng.
   - Đếm số lượng ký tự của các từ trong đoạn text kết quả.
   - Phân chia thời gian hiển thị của mỗi từ dựa trên tỷ lệ độ dài ký tự của từ đó trên tổng số ký tự.
   - Công thức: `dur = (w_len / max(1, total_chars)) * usable_duration`.
   - Kết quả xuất ra file `.json` dưới dạng mảng các object `{ word, start, end }`.

## 📁 Kết quả đầu ra
Với mỗi file `REC_xyz.wav`, bộ mã hóa sẽ tạo ra:
- `REC_xyz.txt`: Chứa toàn bộ văn bản thô dạng chuỗi phẳng.
- `REC_xyz.json`: Chứa dữ liệu có cấu trúc:
  ```json
  {
    "fullText": "văn bản đầy đủ",
    "language": "en-US",
    "duration": 12.34,
    "words": [
      { "word": "hello", "start": 0.1, "end": 0.5 },
      ...
    ]
  }
  ```

[[project-overview]]
