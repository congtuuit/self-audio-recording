# Kế hoạch Refactor VoiceCraft Studio thành Premium AI Shadowing SaaS Studio

Kế hoạch này chuyển đổi hoàn toàn ứng dụng từ một trang web ghi âm Vanilla JS tĩnh thành một ứng dụng React + TypeScript + TailwindCSS + Framer Motion cao cấp, có chất lượng thiết kế tương đương các sản phẩm Apple, Linear, Raycast, và Riverside.

---

## 1. Bối cảnh (Context)
Hiện tại dự án VoiceCraft Studio đang sử dụng giao diện Vanilla JS, HTML, CSS truyền thống. Để nâng tầm sản phẩm thành một ứng dụng SaaS chuyên nghiệp dành cho luyện phát âm tiếng Anh (AI Shadowing Practice), chúng ta cần tái cấu trúc toàn bộ mã nguồn sang **React + TypeScript + TailwindCSS** và tích hợp thư viện hoạt họa **Framer Motion** cùng bộ icon **Lucide React**.

Dự án mới sẽ tập trung vào luồng học tập thông minh: Ghi âm -> Trích xuất mốc thời gian từ -> Luyện tập Shadowing câu mẫu -> Nhận phản hồi chấm điểm phát âm AI -> Thống kê tiến độ học tập.

---

## 2. Thiết lập Môi trường & Build System (React + TS + Tailwind + Vite)

### 📦 Cài đặt Dependencies mới vào `package.json`
Chúng ta cần cài đặt các gói thư viện chính:
- **Dependencies:** `react`, `react-dom`, `framer-motion`, `lucide-react`
- **DevDependencies:** `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `tailwindcss`, `postcss`, `autoprefixer`, `concurrently` (để chạy song song frontend dev server và backend node)

### ⚙️ Cấu hình Các File Môi Trường
1. **`tsconfig.json`**: Cấu hình TypeScript cho React JSX và mô-đun Vite.
2. **`vite.config.ts`**: Thiết lập plugin React và cấu hình **API Proxy** chuyển tiếp các request `/api` và `/recordings` đến backend Node.js (port 3000).
3. **`tailwind.config.js`** & **`postcss.config.js`**: Thiết lập TailwindCSS v3 với bảng màu tùy chỉnh `#0B1020` (background chính) và `#131A2A` (card background).
4. **`server.js`**: Cập nhật backend Node.js để phục vụ thư mục static build `dist/` thay vì `public/` khi chạy production.

---

## 3. Kiến trúc Components React (`src/`)

Chúng ta chia nhỏ ứng dụng thành các Component có tính tái sử dụng cao, đặt trong thư mục `src/`:

### 📁 1. Layout & Core Components
- **`src/types.ts`**: Định nghĩa kiểu dữ liệu cho Recording, WordTimestamp, AIScore, UserProgress.
- **`src/components/AppLayout.tsx`**: Layout chính chứa Header, Workspace (phân bổ 65% trái - 35% phải) và Bottom StatusBar.
- **`src/components/Header.tsx`**: Header cao cấp chứa logo, thông tin Micro, dung lượng bộ nhớ, trạng thái kết nối AI, nút Settings và Avatar người dùng.
- **`src/components/StatusBar.tsx`**: Status bar dưới cùng hiển thị thông tin CPU, RAM, Speech engine status, Whisper status và trạng thái online.

### 📁 2. Hooks xử lý nghiệp vụ
- **`src/hooks/useAudioRecorder.ts`**: Custom hook đóng gói toàn bộ Web Audio API, trộn micro + hệ thống âm thanh, lấy mẫu Float32Array PCM, tính toán sóng tần số và mã hóa WAV 16-bit.
- **`src/hooks/useRecordings.ts`**: Quản lý việc gọi API lưu trữ, xóa bản ghi, polling tự động cập nhật trạng thái transcript dưới nền.

### 📁 3. Recording Studio (65% Trái)
- **`src/components/RecordingStudio/index.tsx`**: Wrapper chứa bộ ghi âm.
- **`src/components/RecordingStudio/RecorderControls.tsx`**: Timer lớn MONOSPACE có hiệu ứng neon pulse khi ghi âm, nút Record tròn lớn bóng bẩy, các nút Pause/Stop. Dropdown chọn nguồn thu (Mic, System, Both, Screen).
- **`src/components/RecordingStudio/WaveformVisualizer.tsx`**: Canvas vẽ sóng âm 3D/gradient động theo thời gian thực dựa trên `analyserNode` của Web Audio API.
- **`src/components/RecordingStudio/LiveTranscriptPanel.tsx`**: Khu vực hiển thị live transcript bóc chữ trực tiếp, có hiệu ứng typing streaming kiểu ChatGPT.
- **`src/components/RecordingStudio/QuickAIAnalysis.tsx`**: Bảng hiển thị điểm số phân tích AI nhanh sau khi thu âm xong (Pronunciation, Fluency, Vocab, Grammar) với điểm circular progress.

### 📁 4. Learning Library (35% Phải)
- **`src/components/LibrarySidebar/index.tsx`**: Danh sách bài học, có thanh tìm kiếm, bộ lọc ngôn ngữ, bộ sắp xếp ngày/điểm.
- **`src/components/LibrarySidebar/LessonCard.tsx`**: Thẻ bài học hiện đại có: Badge trạng thái, Waveform preview nhỏ dưới đáy card, Progress ring thể hiện điểm shadowing, nút Open Shadowing, Favorite, Delete, Download.

### 📁 5. Dedicated Shadowing Workspace (Chế độ học tập chuyên sâu)
- **`src/components/ShadowingWorkspace/index.tsx`**: Focus Workspace xuất hiện toàn màn hình hoặc chiếm lĩnh vùng chính khi học viên click "Học bài này".
- **`src/components/ShadowingWorkspace/FeedbackPanel.tsx`**: Chấm điểm phát âm chi tiết từng từ (Levenshtein Distance matching từ Web Speech API hoặc giả lập AI). Từ đọc đúng highlight màu xanh, từ đọc sai/thiếu màu đỏ, hiển thị IPA và gợi ý sửa âm.
- **`src/components/ShadowingWorkspace/WaveformComparison.tsx`**: Vẽ hai biểu đồ sóng âm song song: Sóng âm câu mẫu gốc (Original Waveform) và sóng âm ghi âm của người dùng (User Shadowing Waveform) để trực quan hóa việc so sánh intonation (ngữ điệu).

### 📁 6. Dashboard & Settings
- **`src/components/Dashboard/DashboardCards.tsx`**: Lưới 5 chỉ số thống kê cao cấp (Total Lessons, Hours Practiced, Words Spoken, Avg Score, Streak) giúp tăng tính SaaS.
- **`src/components/SettingsDialog.tsx`**: Cửa sổ cấu hình phím tắt, đổi ngôn ngữ, thiết lập Whisper API key.

---

## 4. Thiết kế Chi tiết Màu sắc & Giao diện (CSS)

Sử dụng cấu trúc màu sắc SaaS tối giản và sang trọng:
- Background: `#0B1020`
- Card: `#131A2A`
- Secondary Card: `#181F32`
- Accent (Màu chủ đạo): `#6C63FF`
- Success: `#34D399`
- Danger: `#FF5D73`
- Text Primary: `#FFFFFF`
- Text Secondary: `#B8C0D0`
- Text Muted: `#7E8798`
- Bo góc: `16px` đến `24px` cho toàn bộ layout và cards.

---

## 5. Kịch bản Kiểm thử & Xác nhận (Verification)
1. Thực thi build Vite: `npm run build` để kiểm tra lỗi cú pháp TypeScript và JSX.
2. Khởi chạy dev server: `npm run dev` để chạy song song Vite (port 5173) và Node API (port 3000) thông qua API Proxy.
3. Kiểm tra tính năng:
   - Thử ghi âm Mic và System Audio xem visualizer vẽ sóng có mượt không.
   - Thử bấm nút "Học bài này" xem Focus Shadowing Workspace có hiển thị đẹp mắt và đầy đủ hai luồng Waveform không.
   - Thử click vào từ Karaoke xem audio player có nhảy chính xác và highlight mượt mà không bị giật layout không.
   - Thử double-click để tra từ điển IPA.
   - Nhấn các phím tắt `Space` (Start/Stop), `Ctrl+R` (Record), `Ctrl+S` (Save) để xác nhận accessibility hoạt động đúng.
