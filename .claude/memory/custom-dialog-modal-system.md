---
name: custom-dialog-modal-system
description: Hệ thống hộp thoại Modal/Dialog tùy chỉnh dạng Glassmorphic dùng thay thế cho alert/prompt của trình duyệt
metadata: 
  node_type: memory
  type: project
  originSessionId: 86b2d747-685a-4e02-a5a3-cc52f3f8cbcf
  modified: 2026-07-24T15:19:19.214Z
---

Hệ thống hộp thoại Modal/Dialog tùy chỉnh (`DialogProvider` và `useDialog`) được thiết kế nhằm đồng bộ trải nghiệm người dùng với phong cách Glassmorphic UI của VoiceCraft Studio, thay thế hoàn toàn cho các hộp thoại `alert()` và `prompt()` đồng bộ mặc định của trình duyệt.

**Kiến trúc & Sử dụng:**
- **File định nghĩa:** `src/context/DialogContext.tsx`
- **Tích hợp:** Được bọc bên ngoài `AppLayout` trong `src/main.tsx`.
- **API Promise-based:** Cho phép sử dụng `await` tuần tự tương tự các hàm mặc định của JS:
  - `const { alert, confirm, prompt } = useDialog();`
  - `await alert({ title: "Thông báo", message: "Nội dung", type: "success" | "error" | "warning" | "info" })` (hoặc chuỗi đơn giản).
  - `const hasConfirmed = await confirm({ title: "Xác nhận", message: "Bạn có chắc chắn?" })` (trả về `boolean`).
  - `const name = await prompt({ title: "Nhập liệu", message: "Nhập tên file:", placeholder: "Tên..." })` (trả về `string | null`).

**Tại sao:**
Hộp thoại gốc của trình duyệt block luồng JavaScript chính, hiển thị thô sơ và không đồng bộ với thiết kế giao diện tối của sản phẩm. Hệ thống Modal mới sử dụng `framer-motion` cho hiệu ứng mượt mà và `lucide-react` để hiển thị biểu tượng theo ngữ cảnh, đảm bảo tính thẩm mỹ cao.

**Cách áp dụng:**
Khi viết code frontend mới, KHÔNG sử dụng `alert(msg)` hay `prompt(msg)`. Luôn gọi `useDialog()` để hiển thị thông tin hoặc yêu cầu nhập liệu từ người dùng.
