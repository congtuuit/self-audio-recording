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
  `Quét thư mục d:/git/self-audio-recording/recordings để tìm các tệp có đuôi .wav nhưng không có tệp .txt hoặc .json tương ứng (hoặc tệp .txt rỗng). Trả về danh sách tên file dạng JSON array string, ví dụ: ["REC_1.wav", "REC_2.wav"]. Chỉ trả về danh sách, không giải thích gì thêm.`
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
  log(`Phát hiện ${missingFiles.length} tệp âm thanh thiếu transcript: ${missingFiles.join(', ')}`);

  phase('Transcribe AI');
  // Chạy bóc tách song song cho từng file bị thiếu
  await pipeline(
    missingFiles,
    async (file) => {
      log(`Đang xử lý transcribe cho tệp: ${file}`);
      const baseName = file.replace('.wav', '');

      // Gọi audio-expert agent chạy python transcribe.py
      const result = await agent(
        `Thực thi lệnh Python để bóc văn bản cho bản ghi âm này:
        Lệnh: python transcribe.py "recordings/${file}" en-US
        Đảm bảo file được xử lý thành công.`,
        { agentType: 'audio-expert', label: `transcribe:${baseName}` }
      );

      log(`Hoàn thành xử lý cho ${file}. Kết quả: ${result}`);
      return { file, success: true };
    }
  );

  log('Đã hoàn thành phân tích transcript cho toàn bộ các bản ghi âm bị thiếu!');
}
return { missingFilesCount: missingFiles.length };
