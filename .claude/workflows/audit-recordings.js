export const meta = {
  name: 'audit-recordings',
  description: 'Quét và tự động bóc văn bản (transcribe) cho các bản ghi âm bị thiếu transcript hoặc metadata',
  phases: [
    { title: 'Quét thư mục', detail: 'Quét recordings/ tìm file WAV thiếu file phụ' },
    { title: 'Transcribe AI', detail: 'Sử dụng script Python bóc tách chữ hàng loạt' }
  ]
};

// Hàm đọc danh sách file thông qua agent
phase('Quét thư mục');
const scanResultText = await agent(
  `Quét các thư mục con bắt đầu bằng REC_ trong thư mục d:/git/self-audio-recording/recordings. Tìm các thư mục có tệp audio.wav nhưng thiếu tệp meta.json (hoặc tệp meta.json bị rỗng). Trả về danh sách tên các thư mục con đó dạng JSON array string, ví dụ: ["REC_1", "REC_2"]. Chỉ trả về danh sách, không giải thích gì thêm.`
);

let missingFiles = [];
try {
  // Parsing danh sách
  const cleanedText = scanResultText.replace(/```json|```/g, '').trim();
  missingFiles = JSON.parse(cleanedText);
} catch (e) {
  log('Không tìm thấy tệp nào bị thiếu hoặc định dạng trả về không đúng: ' + scanResultText);
}

if (missingFiles.length === 0) {
  log('Tất cả các tệp ghi âm đều đã có transcript đầy đủ!');
} else {
  log(`Phát hiện ${missingFiles.length} thư mục ghi âm thiếu transcript: ${missingFiles.join(', ')}`);

  phase('Transcribe AI');
  // Chạy bóc tách song song cho từng file bị thiếu
  await pipeline(
    missingFiles,
    async (folderName) => {
      log(`Đang xử lý transcribe cho thư mục: ${folderName}`);
      const baseName = folderName;

      // Gọi audio-expert agent chạy python transcribe.py
      const result = await agent(
        `Thực thi lệnh Python để bóc văn bản cho bản ghi âm này:
        Lệnh: python transcribe.py "recordings/${baseName}/audio.wav" en-US
        Đảm bảo file được xử lý thành công.`,
        { agentType: 'audio-expert', label: `transcribe:${baseName}` }
      );

      log(`Hoàn thành xử lý cho ${folderName}. Kết quả: ${result}`);
      return { folderName, success: true };
    }
  );

  log('Đã hoàn thành phân tích transcript cho toàn bộ các bản ghi âm bị thiếu!');
}
return { missingFilesCount: missingFiles.length };
