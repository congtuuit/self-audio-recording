const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;
const RECORDINGS_DIR = path.join(__dirname, 'recordings');
const PUBLIC_DIR = path.join(__dirname, 'dist');

// Đảm bảo thư mục recordings tồn tại
if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

// MIME types hỗ trợ
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

// Hàm chạy Python bóc tách chữ (Transcription)
function runPythonTranscribe(baseName, lang = 'vi-VN') {
  return new Promise((resolve, reject) => {
    const wavPath = path.join(RECORDINGS_DIR, `${baseName}.wav`);
    const scriptPath = path.join(__dirname, 'transcribe.py');
    const cmd = `python "${scriptPath}" "${wavPath}" ${lang}`;

    console.log(`[*] Running auto-transcribe: ${cmd}`);
    exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[-] Python execute error: ${error.message}`);
      }
      if (stderr) {
        console.error(`[-] Python stderr: ${stderr}`);
      }
      if (stdout) {
        console.log(`[*] Python stdout: ${stdout}`);
      }

      const txtPath = path.join(RECORDINGS_DIR, `${baseName}.txt`);
      if (fs.existsSync(txtPath)) {
        const text = fs.readFileSync(txtPath, 'utf-8');
        resolve(text);
      } else {
        resolve('');
      }
    });
  });
}

const server = http.createServer((req, res) => {
  // Thêm CORS headers cho giao diện local
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // --- API ENDPOINTS ---

  // 1. GET /api/recordings - Danh sách các bản ghi đã lưu
  if (req.method === 'GET' && pathname === '/api/recordings') {
    try {
      const files = fs.readdirSync(RECORDINGS_DIR);
      const wavFiles = files.filter(f => f.endsWith('.wav'));
      
      const recordings = wavFiles.map(wavFile => {
        const baseName = path.basename(wavFile, '.wav');
        const wavPath = path.join(RECORDINGS_DIR, wavFile);
        const txtPath = path.join(RECORDINGS_DIR, `${baseName}.txt`);
        const jsonPath = path.join(RECORDINGS_DIR, `${baseName}.json`);
        
        const stats = fs.statSync(wavPath);
        let transcript = '';
        let words = [];

        if (fs.existsSync(txtPath)) {
          transcript = fs.readFileSync(txtPath, 'utf-8');
        }

        if (fs.existsSync(jsonPath)) {
          try {
            const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
            words = jsonData.words || [];
          } catch (e) {}
        }

        const isProcessing = transcript.includes('(Đang tự động xử lý transcript...)');

        return {
          id: baseName,
          filename: wavFile,
          txtFilename: `${baseName}.txt`,
          jsonFilename: `${baseName}.json`,
          size: stats.size,
          createdAt: stats.birthtime || stats.mtime,
          transcript: transcript,
          words: words,
          processing: isProcessing
        };
      });

      // Sắp xếp bản ghi mới nhất lên đầu
      recordings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, recordings }));
    } catch (err) {
      console.error('Lỗi khi lấy danh sách bản ghi:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 2. POST /api/save-recording - Lưu file WAV và Transcript (.txt)
  if (req.method === 'POST' && pathname === '/api/save-recording') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { audioBase64, transcript, customName, language } = data;

        if (!audioBase64) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Thiếu dữ liệu audioBase64' }));
          return;
        }

        // Tạo tên file duy nhất dạng REC_YYYYMMDD_HHMMSS
        const now = new Date();
        const timestamp = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
        const safeCustomName = customName ? customName.replace(/[^a-zA-Z0-9_-]/g, '_') + '_' : '';
        const baseName = `REC_${safeCustomName}${timestamp}`;

        const wavPath = path.join(RECORDINGS_DIR, `${baseName}.wav`);
        const txtPath = path.join(RECORDINGS_DIR, `${baseName}.txt`);

        // Chuyển base64 thành Buffer và ghi đĩa
        const base64Data = audioBase64.replace(/^data:audio\/\w+;base64,/, '');
        const audioBuffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(wavPath, audioBuffer);

        // Ghi file transcript ban đầu
        let finalTranscript = (transcript && transcript.trim()) ? transcript : '(Đang tự động xử lý transcript...)';
        fs.writeFileSync(txtPath, finalTranscript, 'utf-8');

        console.log(`[+] Đã lưu file WAV: ${baseName}.wav`);

        let processing = false;
        // Nếu transcript rỗng (ví dụ thu từ Âm thanh Hệ Thống), tự động chạy Python transcribe NGẦM (background)
        if (!transcript || !transcript.trim() || transcript === '(Không có văn bản transcript)') {
          console.log(`[*] Live transcript is empty. Triggering Python AI Transcribe in background for ${baseName}...`);
          processing = true;

          // Chạy ngầm hoàn toàn không await chặn luồng phản hồi HTTP
          runPythonTranscribe(baseName, language || 'en-US').then((text) => {
            if (!text || text.includes('(Đang tự động xử lý transcript...)')) {
              text = '(Không thể nhận dạng được giọng nói trong file audio này)';
            }
            fs.writeFileSync(txtPath, text, 'utf-8');
            console.log(`[+] Background transcription finished for ${baseName}`);
          }).catch((err) => {
            console.error(`[-] Background transcription failed for ${baseName}:`, err);
            fs.writeFileSync(txtPath, '(Lỗi khi tự động xử lý transcript)', 'utf-8');
          });
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          message: processing ? 'Đang xử lý bóc chữ dưới nền...' : 'Lưu bản ghi thành công!',
          recording: {
            id: baseName,
            filename: `${baseName}.wav`,
            txtFilename: `${baseName}.txt`,
            size: audioBuffer.length,
            createdAt: now,
            transcript: finalTranscript,
            processing: processing
          }
        }));
      } catch (err) {
        console.error('Lỗi khi lưu file thu âm:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 2b. POST /api/transcribe/:id - Gọi Python xử lý transcript thủ công từ file WAV
  if (req.method === 'POST' && pathname.startsWith('/api/transcribe/')) {
    const id = pathname.replace('/api/transcribe/', '');
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const data = body ? JSON.parse(body) : {};
        let lang = data.language;

        if (!lang) {
          const jsonPath = path.join(RECORDINGS_DIR, `${id}.json`);
          if (fs.existsSync(jsonPath)) {
            try {
              const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
              lang = jsonData.language;
            } catch (e) {}
          }
        }
        lang = lang || 'en-US';

        console.log(`[*] Requesting manual transcription for ${id} (lang: ${lang})...`);
        const text = await runPythonTranscribe(id, lang);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, transcript: text }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 3. DELETE /api/recordings/:id - Xóa bản ghi
  if (req.method === 'DELETE' && pathname.startsWith('/api/recordings/')) {
    const id = pathname.replace('/api/recordings/', '');
    const wavPath = path.join(RECORDINGS_DIR, `${id}.wav`);
    const txtPath = path.join(RECORDINGS_DIR, `${id}.txt`);
    const jsonPath = path.join(RECORDINGS_DIR, `${id}.json`);

    try {
      if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
      if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath);
      if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Đã xóa bản ghi' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 4. Stream file âm thanh hoặc transcript từ /recordings/
  if (req.method === 'GET' && pathname.startsWith('/recordings/')) {
    const fileName = path.basename(pathname);
    const filePath = path.join(RECORDINGS_DIR, fileName);

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const stat = fs.statSync(filePath);
      const totalSize = stat.size;

      // Xử lý HTTP Range cho trình duyệt tua mượt (chủ yếu là file âm thanh .wav)
      const range = req.headers.range;
      if (range && (ext === '.wav' || ext === '.mp3' || ext === '.webm' || ext === '.mp4')) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

        if (start >= totalSize || end >= totalSize) {
          res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
          return res.end();
        }

        const chunksize = (end - start) + 1;
        const fileStream = fs.createReadStream(filePath, { start, end });

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });

        fileStream.pipe(res);

        // Hủy stream nếu client ngắt kết nối (ví dụ khi tua nhanh liên tiếp)
        req.on('close', () => {
          fileStream.destroy();
        });
      } else {
        res.writeHead(200, {
          'Content-Length': totalSize,
          'Content-Type': contentType
        });
        fs.createReadStream(filePath).pipe(res);
      }
      return;
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('File không tồn tại');
      return;
    }
  }

  // --- SERVE STATIC FILES (PUBLIC_DIR) ---
  let reqPath = pathname === '/' ? '/index.html' : pathname;
  let filePath = path.join(PUBLIC_DIR, reqPath);

  // Tránh path traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 - Trang không tồn tại</h1>');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🎙️ Mini Audio Recorder Tool đang chạy tại:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`📁 Các bản ghi sẽ được tự động lưu vào: ${RECORDINGS_DIR}`);
  console.log(`====================================================`);
});
