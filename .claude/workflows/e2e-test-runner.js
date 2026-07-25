export const meta = {
  name: 'e2e-test-runner',
  description: 'Khởi chạy server, thực thi kiểm thử tích hợp E2E tự động và dọn dẹp môi trường',
  phases: [
    { title: 'Start Server', detail: 'Chạy nền server Node.js' },
    { title: 'Run Python Test', detail: 'Thực thi file test_full_flow.py' },
    { title: 'Cleanup', detail: 'Dừng server và báo cáo kết quả' }
  ]
};

// Khởi chạy server nền
phase('Start Server');
log('Đang khởi chạy Node.js server ở chế độ nền trên PORT 3000...');
// Gọi agent chạy nền npm start
const serverTaskText = await agent(
  `Khởi chạy lệnh 'node server.js' ở chế độ nền (run in background). Trả về ID của tác vụ chạy nền này để chúng ta có thể tắt nó sau khi test xong. Chỉ trả về ID tác vụ nền.`
);
log(`Server khởi chạy thành công. Task ID ghi nhận: ${serverTaskText.trim()}`);

// Chờ 2 giây cho server khởi động hoàn tất
log('Chờ server sẵn sàng...');
const serverTaskId = serverTaskText.trim();

phase('Run Python Test');
log('Bắt đầu thực thi script test_full_flow.py...');
const testResult = await agent(
  `Chạy script kiểm thử tích hợp: 'python test_full_flow.py'. Ghi lại toàn bộ output terminal và xác nhận xem kết quả có báo SUCCESSFUL! hay thất bại.`,
  { label: 'E2E Testing' }
);

log('Kết quả kiểm thử:\n' + testResult);

phase('Cleanup');
log('Đang tiến hành dọn dẹp: Tắt server chạy nền...');
if (serverTaskId) {
  await agent(
    `Hãy dừng (Stop) tác vụ chạy nền có ID là "${serverTaskId}" để giải phóng PORT 3000.`
  );
  log('Đã dừng tác vụ server.');
} else {
  log('Cảnh báo: Không tìm thấy Task ID của server để dừng.');
}

return {
  testOutput: testResult,
  success: testResult.includes('SUCCESSFUL!')
};
