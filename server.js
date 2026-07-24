const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const RECORDINGS_DIR = path.join(__dirname, 'recordings');
const PUBLIC_DIR = path.join(__dirname, 'public');

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
        
        const stats = fs.statSync(wavPath);
        let transcript = '';
        
        if (fs.existsSync(txtPath)) {
          transcript = fs.readFileSync(txtPath, 'utf-8');
        }

        return {
          id: baseName,
          filename: wavFile,
          txtFilename: `${baseName}.txt`,
          size: stats.size,
          createdAt: stats.birthtime || stats.mtime,
          transcript: transcript
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
        const { audioBase64, transcript, customName } = data;

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

        // Ghi file transcript văn bản
        fs.writeFileSync(txtPath, transcript || '(Không có văn bản transcript)', 'utf-8');

        console.log(`[+] Đã lưu thành công: ${baseName}.wav & ${baseName}.txt`);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          message: 'Lưu bản ghi thành công!',
          recording: {
            id: baseName,
            filename: `${baseName}.wav`,
            txtFilename: `${baseName}.txt`,
            size: audioBuffer.length,
            createdAt: now,
            transcript: transcript || ''
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

  // 3. DELETE /api/recordings/:id - Xóa bản ghi
  if (req.method === 'DELETE' && pathname.startsWith('/api/recordings/')) {
    const id = pathname.replace('/api/recordings/', '');
    const wavPath = path.join(RECORDINGS_DIR, `${id}.wav`);
    const txtPath = path.join(RECORDINGS_DIR, `${id}.txt`);

    try {
      if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
      if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath);

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
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
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
