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

// Hàm tự động di chuyển các bản ghi cũ sang cấu trúc thư mục mới khi khởi động server
function migrateOldRecordings() {
  try {
    if (!fs.existsSync(RECORDINGS_DIR)) return;

    const items = fs.readdirSync(RECORDINGS_DIR);
    // Chỉ lấy các tệp .wav nằm trực tiếp dưới thư mục recordings/
    const wavFiles = items.filter(f => {
      const p = path.join(RECORDINGS_DIR, f);
      return f.endsWith('.wav') && fs.statSync(p).isFile();
    });

    if (wavFiles.length === 0) return;

    console.log(`[*] Phát hiện ${wavFiles.length} bản ghi cũ cần di chuyển cấu trúc...`);

    for (const wavFile of wavFiles) {
      const baseName = path.basename(wavFile, '.wav');
      const oldWavPath = path.join(RECORDINGS_DIR, wavFile);
      const oldTxtPath = path.join(RECORDINGS_DIR, `${baseName}.txt`);
      const oldJsonPath = path.join(RECORDINGS_DIR, `${baseName}.json`);

      const newDirPath = path.join(RECORDINGS_DIR, baseName);
      fs.mkdirSync(newDirPath, { recursive: true });

      const newWavPath = path.join(newDirPath, 'audio.wav');
      const newMetaPath = path.join(newDirPath, 'meta.json');

      // Di chuyển tệp WAV
      fs.renameSync(oldWavPath, newWavPath);

      // Đọc thông tin từ các tệp cũ
      let transcript = '';
      let words = [];
      let duration = 0;
      let language = 'en-US';
      const stats = fs.statSync(newWavPath);

      if (fs.existsSync(oldTxtPath)) {
        transcript = fs.readFileSync(oldTxtPath, 'utf-8');
        fs.unlinkSync(oldTxtPath);
      }

      if (fs.existsSync(oldJsonPath)) {
        try {
          const jsonData = JSON.parse(fs.readFileSync(oldJsonPath, 'utf-8'));
          words = jsonData.words || [];
          duration = jsonData.duration || 0;
          language = jsonData.language || 'en-US';
        } catch (e) {}
        fs.unlinkSync(oldJsonPath);
      }

      const metaOutput = {
        filename: 'audio.wav',
        duration: Number(duration),
        language: language,
        fullText: transcript || '(Đang tự động xử lý transcript...)',
        words: words,
        createdAt: stats.birthtime || stats.mtime || new Date().toISOString(),
        fileType: 'audio/wav',
        fileSize: stats.size
      };

      fs.writeFileSync(newMetaPath, JSON.stringify(metaOutput, null, 2), 'utf-8');
      console.log(`[+] Đã chuyển đổi thành công bản ghi: ${baseName}`);
    }
  } catch (err) {
    console.error('[-] Lỗi khi di chuyển cấu trúc bản ghi cũ:', err);
  }
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
    const folderPath = path.join(RECORDINGS_DIR, baseName);
    const wavPath = path.join(folderPath, 'audio.wav');
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

      // Python sinh ra file audio.txt và audio.json
      const pyTxtPath = path.join(folderPath, 'audio.txt');
      const pyJsonPath = path.join(folderPath, 'audio.json');
      const metaPath = path.join(folderPath, 'meta.json');

      let text = '';
      let words = [];
      let duration = 0;

      if (fs.existsSync(pyTxtPath)) {
        text = fs.readFileSync(pyTxtPath, 'utf-8');
      }

      if (fs.existsSync(pyJsonPath)) {
        try {
          const pyJsonData = JSON.parse(fs.readFileSync(pyJsonPath, 'utf-8'));
          words = pyJsonData.words || [];
          duration = pyJsonData.duration || 0;
        } catch (e) {
          console.error('Lỗi khi đọc file JSON sinh từ python:', e);
        }
      }

      // Tổng hợp vào file meta.json duy nhất
      try {
        const stats = fs.statSync(wavPath);
        const metaOutput = {
          filename: 'audio.wav',
          duration: Number(duration),
          language: lang,
          fullText: text || '(Không thể nhận dạng được giọng nói trong file audio này)',
          words: words,
          createdAt: stats.birthtime || stats.mtime || new Date().toISOString(),
          fileType: 'audio/wav',
          fileSize: stats.size
        };
        fs.writeFileSync(metaPath, JSON.stringify(metaOutput, null, 2), 'utf-8');
        console.log(`[+] Đã tạo file meta.json cho ${baseName}`);

        // Xóa tệp tạm
        if (fs.existsSync(pyTxtPath)) fs.unlinkSync(pyTxtPath);
        if (fs.existsSync(pyJsonPath)) fs.unlinkSync(pyJsonPath);
      } catch (metaErr) {
        console.error('Lỗi tổng hợp meta.json sau khi chạy python:', metaErr);
      }

      resolve(text);
    });
  });
}

// Hàm bóc chữ & tạo từ điển EN-VI bằng Google Gemini API (model tùy chọn)
async function transcribeWithGemini(baseName, lang = 'en-US', geminiKey, modelName = 'gemini-2.0-flash') {
  const folderPath = path.join(RECORDINGS_DIR, baseName);
  const wavPath = path.join(folderPath, 'audio.wav');
  const metaPath = path.join(folderPath, 'meta.json');

  if (!fs.existsSync(wavPath)) {
    throw new Error(`File audio không tồn tại: ${wavPath}`);
  }

  const targetModel = modelName || 'gemini-2.0-flash';
  console.log(`[*] Running Google Gemini (${targetModel}) Transcribe & Dictionary for ${baseName}...`);
  const fileBuffer = fs.readFileSync(wavPath);
  const base64Audio = fileBuffer.toString('base64');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${geminiKey}`;

  const promptText = `Bạn là chuyên gia bóc tách âm thanh và ngôn ngữ học Anh - Việt. Hãy nghe tệp âm thanh này và xuất ra CHÍNH XÁC một tệp JSON theo schema sau (không thêm markdown hoặc bọc backticks):
{
  "fullText": "văn bản transcript đầy đủ",
  "words": [
    { "word": "từ", "start": mốc_thời_gian_bắt_đầu_bằng_giây, "end": mốc_thời_gian_kết_thúc_bằng_giây }
  ],
  "dictionary": {
    "từ_viết_thường": {
      "phonetic": "/phiên_âm_IPA/",
      "viMeaning": "nghĩa tiếng Việt ngắn gọn",
      "explanation": "giải thích ý nghĩa theo ngữ cảnh bài học"
    }
  }
}`;

  const body = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: 'audio/wav',
              data: base64Audio
            }
          },
          { text: promptText }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json'
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${errText}`);
  }

  const resultData = await response.json();
  const textOutput = resultData.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  let parsed = {};
  try {
    const cleanJson = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
    parsed = JSON.parse(cleanJson);
  } catch (parseErr) {
    console.error('[-] Error parsing Gemini JSON response:', parseErr);
    parsed = { fullText: textOutput, words: [], dictionary: {} };
  }

  const stats = fs.statSync(wavPath);
  const wordsList = parsed.words || [];
  const duration = wordsList.length > 0 ? (wordsList[wordsList.length - 1].end || 0) : 0;

  const metaOutput = {
    filename: 'audio.wav',
    duration: Number(duration),
    language: lang,
    fullText: parsed.fullText || '',
    words: wordsList,
    dictionary: parsed.dictionary || {},
    createdAt: stats.birthtime || stats.mtime || new Date().toISOString(),
    fileType: 'audio/wav',
    fileSize: stats.size,
    aiProvider: 'Google Gemini'
  };

  fs.writeFileSync(metaPath, JSON.stringify(metaOutput, null, 2), 'utf-8');
  console.log(`[+] Gemini 2.0 Flash finished successfully for ${baseName}`);
  return parsed.fullText;
}

// Hàm sinh từ điển Anh-Việt theo ngữ cảnh bằng ChatGPT (model tùy chọn)
async function generateDictionaryWithChatGPT(fullText, openaiKey, modelName = 'gpt-4o-mini') {
  if (!openaiKey || !fullText) return {};
  const targetModel = modelName || 'gpt-4o-mini';

  try {
    console.log(`[*] Generating EN-VI dictionary via OpenAI (${targetModel})...`);
    const prompt = `Bạn là trợ lý từ điển Anh - Việt. Dựa trên đoạn transcript sau: "${fullText}", hãy chọn lọc các từ vựng tiếng Anh quan trọng và xuất ra JSON duy nhất theo schema:
{
  "từ_viết_thường": {
    "phonetic": "/phiên_âm_IPA/",
    "viMeaning": "nghĩa tiếng Việt ngắn gọn",
    "explanation": "giải thích ngữ nghĩa ngắn trong câu"
  }
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: targetModel,
        messages: [
          { role: 'system', content: 'You return ONLY valid JSON matching the requested schema.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) return {};
    const resData = await response.json();
    const content = resData.choices?.[0]?.message?.content || '{}';
    return JSON.parse(content);
  } catch (err) {
    console.error('[-] Error generating EN-VI dictionary with ChatGPT:', err.message);
    return {};
  }
}

// Hàm bóc chữ sử dụng OpenAI Whisper Cloud API + ChatGPT cho từ điển
async function transcribeWithOpenAI(baseName, lang = 'en-US', whisperKey, openaiModel = 'gpt-4o-mini') {
  const folderPath = path.join(RECORDINGS_DIR, baseName);
  const wavPath = path.join(folderPath, 'audio.wav');
  const metaPath = path.join(folderPath, 'meta.json');

  if (!fs.existsSync(wavPath)) {
    throw new Error(`File audio không tồn tại: ${wavPath}`);
  }

  console.log(`[*] Running OpenAI Whisper Cloud Transcribe for ${baseName} (lang: ${lang})...`);
  const fileBuffer = fs.readFileSync(wavPath);
  const audioBlob = new Blob([fileBuffer], { type: 'audio/wav' });

  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.wav');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'word');

  if (lang) {
    const langCode = lang.split('-')[0];
    formData.append('language', langCode);
  }

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${whisperKey}`
    },
    body: formData
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  const text = result.text || '';
  const words = (result.words || []).map(w => ({
    word: w.word,
    start: Number(w.start),
    end: Number(w.end)
  }));

  // Tạo từ điển EN-VI bằng ChatGPT model đã chọn
  const dictionary = await generateDictionaryWithChatGPT(text, whisperKey, openaiModel);

  // Ghi trực tiếp tệp meta.json
  const stats = fs.statSync(wavPath);
  const metaOutput = {
    filename: 'audio.wav',
    duration: Number(result.duration || 0),
    language: lang,
    fullText: text,
    words: words,
    dictionary: dictionary,
    createdAt: stats.birthtime || stats.mtime || new Date().toISOString(),
    fileType: 'audio/wav',
    fileSize: stats.size,
    aiProvider: 'OpenAI ChatGPT'
  };
  fs.writeFileSync(metaPath, JSON.stringify(metaOutput, null, 2), 'utf-8');

  console.log(`[+] OpenAI Whisper + GPT-4o-mini finished successfully for ${baseName}`);
  return text;
}

// Hàm dùng FFmpeg cắt bỏ khoảng im lặng (silence trimming) ở đầu & cuối và chuẩn hóa âm lượng (loudnorm)
function preprocessAudioWithFFmpeg(baseName) {
  return new Promise((resolve) => {
    const folderPath = path.join(RECORDINGS_DIR, baseName);
    const wavPath = path.join(folderPath, 'audio.wav');
    const tempWavPath = path.join(folderPath, 'trimmed_temp.wav');

    if (!fs.existsSync(wavPath)) {
      resolve(false);
      return;
    }

    console.log(`[*] Preprocessing audio with FFmpeg (trim silence & normalize volume) for ${baseName}...`);
    // Lệnh FFmpeg: cắt khoảng im lặng ở đầu (-45dB) và cuối (-45dB) + chuẩn hóa âm lượng EBU R128 (-16 LUFS)
    const ffmpegCmd = `ffmpeg -y -i "${wavPath}" -af "silenceremove=start_periods=1:start_duration=0.1:start_threshold=-45dB:stop_periods=1:stop_duration=0.1:stop_threshold=-45dB,loudnorm=I=-16:TP=-1.5:LRA=11" "${tempWavPath}"`;

    exec(ffmpegCmd, (error) => {
      if (error) {
        console.warn(`[-] FFmpeg preprocessing warning (skipping): ${error.message}`);
        if (fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath);
        resolve(false);
        return;
      }

      if (fs.existsSync(tempWavPath) && fs.statSync(tempWavPath).size > 1000) {
        fs.unlinkSync(wavPath);
        fs.renameSync(tempWavPath, wavPath);
        console.log(`[+] FFmpeg audio normalization & silence trimming completed for ${baseName}`);
        resolve(true);
      } else {
        if (fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath);
        resolve(false);
      }
    });
  });
}

// Bộ điều phối AI Transcribe Dispatcher
async function dispatchTranscription(baseName, lang = 'en-US', options = {}) {
  // 1. Tự động dùng FFmpeg làm sạch & cắt khoảng im lặng đầu/cuối trước khi gửi AI bóc chữ
  await preprocessAudioWithFFmpeg(baseName);

  const { geminiKey, openaiKey, whisperKey, geminiModel, openaiModel, providerPreference = 'auto' } = options;
  const effectiveOpenAIKey = openaiKey || whisperKey;

  console.log(`[*] AI Dispatcher processing ${baseName} (pref: ${providerPreference}, geminiModel: ${geminiModel || 'default'}, openaiModel: ${openaiModel || 'default'})...`);

  if (providerPreference === 'gemini' && geminiKey) {
    return await transcribeWithGemini(baseName, lang, geminiKey, geminiModel);
  }

  if (providerPreference === 'openai' && effectiveOpenAIKey) {
    return await transcribeWithOpenAI(baseName, lang, effectiveOpenAIKey, openaiModel);
  }

  if (providerPreference === 'local') {
    return await runPythonTranscribe(baseName, lang);
  }

  // Chế độ Auto Detect: Ưu tiên Gemini -> OpenAI -> Local Fallback
  if (geminiKey) {
    try {
      return await transcribeWithGemini(baseName, lang, geminiKey, geminiModel);
    } catch (err) {
      console.error(`[-] Gemini transcribe failed, fallback to OpenAI/Python:`, err.message);
    }
  }

  if (effectiveOpenAIKey) {
    try {
      return await transcribeWithOpenAI(baseName, lang, effectiveOpenAIKey, openaiModel);
    } catch (err) {
      console.error(`[-] OpenAI transcribe failed, fallback to Python:`, err.message);
    }
  }

  return await runPythonTranscribe(baseName, lang);
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
      const items = fs.readdirSync(RECORDINGS_DIR);
      const recordings = [];

      for (const item of items) {
        const dirPath = path.join(RECORDINGS_DIR, item);
        const stats = fs.statSync(dirPath);

        if (stats.isDirectory() && item.startsWith('REC_')) {
          const wavPath = path.join(dirPath, 'audio.wav');
          const metaPath = path.join(dirPath, 'meta.json');

          if (fs.existsSync(wavPath)) {
            const wavStats = fs.statSync(wavPath);
            let transcript = '';
            let words = [];
            let dictionary = {};
            let duration = 0;
            let language = 'en-US';
            let createdAt = wavStats.birthtime || wavStats.mtime;
            let aiScore = undefined;
            let source = 'recording';
            let sourceUrl = '';
            let videoTitle = '';
            let videoChannel = '';
            let videoThumbnail = '';
            let hasVideo = false;

            if (fs.existsSync(metaPath)) {
              try {
                const metaData = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                transcript = metaData.fullText || '';
                words = metaData.words || [];
                duration = metaData.duration || 0;
                language = metaData.language || 'en-US';
                if (metaData.createdAt) createdAt = new Date(metaData.createdAt);
                aiScore = metaData.aiScore;
                dictionary = metaData.dictionary || {};

                source = metaData.source || 'recording';
                sourceUrl = metaData.sourceUrl || '';
                videoTitle = metaData.videoTitle || '';
                videoChannel = metaData.videoChannel || '';
                videoThumbnail = metaData.videoThumbnail || '';
                hasVideo = !!metaData.hasVideo;
              } catch (e) {
                console.error(`Lỗi đọc file meta.json của ${item}:`, e);
              }
            }

            const isProcessing = transcript.includes('(Đang tự động xử lý transcript...)');

            recordings.push({
              id: item,
              filename: `${item}/audio.wav`, // Trả về đường dẫn tương đối dạng thư mục/tệp
              txtFilename: `${item}/meta.json`,
              size: wavStats.size,
              createdAt: createdAt,
              transcript: transcript,
              words: words,
              language: language,
              dictionary: dictionary,
              processing: isProcessing,
              aiScore: aiScore,
              source: source,
              sourceUrl: sourceUrl,
              videoTitle: videoTitle,
              videoChannel: videoChannel,
              videoThumbnail: videoThumbnail,
              hasVideo: hasVideo
            });
          }
        }
      }

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
        const { audioBase64, transcript, customName, language, whisperKey, openaiKey, geminiKey, providerPreference } = data;

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

        const dirPath = path.join(RECORDINGS_DIR, baseName);
        fs.mkdirSync(dirPath, { recursive: true });

        const wavPath = path.join(dirPath, 'audio.wav');
        const metaPath = path.join(dirPath, 'meta.json');

        // Chuyển base64 thành Buffer và ghi đĩa
        const base64Data = audioBase64.replace(/^data:audio\/\w+;base64,/, '');
        const audioBuffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(wavPath, audioBuffer);

        // Tạo file meta.json ban đầu
        let finalTranscript = (transcript && transcript.trim()) ? transcript : '(Đang tự động xử lý transcript...)';
        const initialMeta = {
          filename: 'audio.wav',
          duration: 0,
          language: language || 'en-US',
          fullText: finalTranscript,
          words: [],
          dictionary: {},
          createdAt: now.toISOString(),
          fileType: 'audio/wav',
          fileSize: audioBuffer.length
        };
        fs.writeFileSync(metaPath, JSON.stringify(initialMeta, null, 2), 'utf-8');

        console.log(`[+] Đã lưu file WAV vào thư mục: ${baseName}/audio.wav`);

        let processing = false;
        // Tự động chạy bóc chữ ngầm qua AI Dispatcher nếu transcript rỗng hoặc yêu cầu xử lý AI
        if (!transcript || !transcript.trim() || transcript === '(Không có văn bản transcript)') {
          console.log(`[*] Live transcript is empty. Triggering AI transcription for ${baseName}...`);
          processing = true;

          // Chạy ngầm hoàn toàn không await chặn luồng phản hồi HTTP
          const runTranscribeTask = async () => {
            try {
              const text = await dispatchTranscription(baseName, language || 'en-US', { geminiKey, openaiKey, whisperKey, geminiModel, openaiModel, providerPreference });
              if (!text || text.includes('(Đang tự động xử lý transcript...)')) {
                if (fs.existsSync(metaPath)) {
                  try {
                    const metaContent = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                    metaContent.fullText = '(Không thể nhận dạng được giọng nói trong file audio này)';
                    fs.writeFileSync(metaPath, JSON.stringify(metaContent, null, 2), 'utf-8');
                  } catch (e) {}
                }
              }
            } catch (err) {
              console.error(`[-] Background AI transcription failed for ${baseName}:`, err);
              if (fs.existsSync(metaPath)) {
                try {
                  const metaContent = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                  metaContent.fullText = '(Lỗi khi tự động xử lý transcript)';
                  fs.writeFileSync(metaPath, JSON.stringify(metaContent, null, 2), 'utf-8');
                } catch (e) {}
              }
            }
          };

          runTranscribeTask();
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          message: processing ? 'Đang xử lý bóc chữ dưới nền...' : 'Lưu bản ghi thành công!',
          recording: {
            id: baseName,
            filename: `${baseName}/audio.wav`,
            txtFilename: `${baseName}/meta.json`,
            size: audioBuffer.length,
            createdAt: now,
            transcript: finalTranscript,
            language: language || 'en-US',
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

  // 2c. POST /api/import-youtube - Nhập bài học từ link YouTube
  if (req.method === 'POST' && pathname === '/api/import-youtube') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { url, mode, language, whisperKey, openaiKey, geminiKey, geminiModel, openaiModel, providerPreference } = data;

        if (!url) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Thiếu link YouTube URL' }));
          return;
        }

        // Trích xuất videoId
        let videoId = '';
        if (url.includes('youtu.be/')) {
          videoId = url.split('youtu.be/')[1]?.split(/[?#]/)[0];
        } else if (url.includes('v=')) {
          videoId = url.split('v=')[1]?.split(/[&#]/)[0];
        } else if (url.includes('/shorts/')) {
          videoId = url.split('/shorts/')[1]?.split(/[?#]/)[0];
        }

        if (!videoId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Link YouTube URL không hợp lệ' }));
          return;
        }

        const now = new Date();
        const timestamp = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
        const baseName = `REC_YT_${videoId}_${timestamp}`;
        const dirPath = path.join(RECORDINGS_DIR, baseName);
        fs.mkdirSync(dirPath, { recursive: true });

        const metaPath = path.join(dirPath, 'meta.json');

        // Tạo meta.json tạm thời ban đầu
        const initialMeta = {
          filename: 'audio.wav',
          duration: 0,
          language: language || 'en',
          fullText: '(Đang tự động xử lý transcript...)',
          words: [],
          dictionary: {},
          createdAt: now.toISOString(),
          fileType: 'audio/wav',
          fileSize: 0,
          source: 'youtube',
          sourceUrl: url,
          videoTitle: 'Đang tải từ YouTube...',
          videoChannel: '',
          videoThumbnail: ''
        };
        fs.writeFileSync(metaPath, JSON.stringify(initialMeta, null, 2), 'utf-8');

        // Chạy bất đồng bộ
        const runImportTask = async () => {
          const downloadVideoArg = mode === 'video' ? '--video' : '';
          const langArg = language ? `--lang "${language}"` : '--lang en';
          const helperPath = path.join(__dirname, 'youtube_import.py');
          const cmd = `python "${helperPath}" "${dirPath}" "${url}" ${downloadVideoArg} ${langArg}`;

          console.log(`[*] Executing YouTube import background helper: ${cmd}`);
          exec(cmd, { cwd: __dirname }, async (error, stdout, stderr) => {
            if (error) {
              console.error(`[-] YouTube import helper error: ${error.message}`);
              if (fs.existsSync(metaPath)) {
                try {
                  const metaContent = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                  metaContent.fullText = `(Lỗi khi tải từ YouTube: ${error.message.replace(/"/g, "'")})`;
                  fs.writeFileSync(metaPath, JSON.stringify(metaContent, null, 2), 'utf-8');
                } catch (e) {}
              }
              return;
            }

            try {
              const result = JSON.parse(stdout.trim());
              if (!result.success) {
                throw new Error(result.error || 'Helper reported failure');
              }

              // Nếu không tìm thấy captions, dùng STT fallback
              if (!result.transcript_available) {
                console.log(`[*] YouTube subtitles not found. Running STT fallback for ${baseName}...`);
                await dispatchTranscription(baseName, language || 'en-US', {
                  geminiKey, openaiKey, whisperKey, geminiModel, openaiModel, providerPreference
                });
              } else {
                console.log(`[+] YouTube import completed successfully for ${baseName} with captions!`);
              }
            } catch (err) {
              console.error(`[-] Parsing YouTube import result failed:`, err);
              if (fs.existsSync(metaPath)) {
                try {
                  const metaContent = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                  metaContent.fullText = `(Lỗi bóc phụ đề: ${err.message})`;
                  fs.writeFileSync(metaPath, JSON.stringify(metaContent, null, 2), 'utf-8');
                } catch (e) {}
              }
            }
          });
        };

        runImportTask();

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          message: 'Đang tải media và phụ đề từ YouTube...',
          recording: {
            id: baseName,
            filename: `${baseName}/audio.wav`,
            txtFilename: `${baseName}/meta.json`,
            size: 0,
            createdAt: now,
            transcript: '(Đang tự động xử lý transcript...)',
            language: language || 'en',
            processing: true,
            source: 'youtube',
            sourceUrl: url,
            videoTitle: 'Đang tải từ YouTube...'
          }
        }));
      } catch (err) {
        console.error('Lỗi khi chuẩn bị import YouTube:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 2d. POST /api/import-file - Nhập bài học từ tệp cục bộ
  if (req.method === 'POST' && pathname === '/api/import-file') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { mediaBase64, mediaName, subtitleText, language, whisperKey, openaiKey, geminiKey, geminiModel, openaiModel, providerPreference } = data;

        if (!mediaBase64 || !mediaName) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Thiếu file media hoặc tên tệp' }));
          return;
        }

        const now = new Date();
        const timestamp = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
        const baseName = `REC_IMP_${mediaName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${timestamp}`;
        const dirPath = path.join(RECORDINGS_DIR, baseName);
        fs.mkdirSync(dirPath, { recursive: true });

        const metaPath = path.join(dirPath, 'meta.json');

        // Ghi tệp media tạm thời
        const tempMediaExt = path.extname(mediaName);
        const tempMediaPath = path.join(dirPath, `temp_media${tempMediaExt}`);
        const mediaBuffer = Buffer.from(mediaBase64.replace(/^data:audio\/\w+;base64,/, '').replace(/^data:video\/\w+;base64,/, ''), 'base64');
        fs.writeFileSync(tempMediaPath, mediaBuffer);

        // Ghi tệp subtitle tạm thời nếu có
        let tempSubPath = '';
        if (subtitleText) {
          tempSubPath = path.join(dirPath, `temp_subtitle.srt`);
          fs.writeFileSync(tempSubPath, subtitleText, 'utf-8');
        }

        // Tạo meta.json tạm thời ban đầu
        const initialMeta = {
          filename: 'audio.wav',
          duration: 0,
          language: language || 'en-US',
          fullText: '(Đang tự động xử lý transcript...)',
          words: [],
          dictionary: {},
          createdAt: now.toISOString(),
          fileType: 'audio/wav',
          fileSize: 0,
          source: 'file_import',
          videoTitle: mediaName,
          videoChannel: 'Local Import',
          videoThumbnail: ''
        };
        fs.writeFileSync(metaPath, JSON.stringify(initialMeta, null, 2), 'utf-8');

        // Chạy bất đồng bộ
        const runImportTask = async () => {
          const subArg = tempSubPath ? `--subtitle "${tempSubPath}"` : '';
          const helperPath = path.join(__dirname, 'file_import.py');
          const cmd = `python "${helperPath}" "${dirPath}" "${tempMediaPath}" ${subArg} --name "${mediaName.replace(/"/g, '\\"')}" --lang "${language || 'en-US'}"`;

          console.log(`[*] Executing file import background helper: ${cmd}`);
          exec(cmd, { cwd: __dirname }, async (error, stdout, stderr) => {
            // Dọn dẹp tệp tạm
            if (fs.existsSync(tempMediaPath)) fs.unlinkSync(tempMediaPath);
            if (tempSubPath && fs.existsSync(tempSubPath)) fs.unlinkSync(tempSubPath);

            if (error) {
              console.error(`[-] File import helper error: ${error.message}`);
              if (fs.existsSync(metaPath)) {
                try {
                  const metaContent = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                  metaContent.fullText = `(Lỗi khi nhập file: ${error.message.replace(/"/g, "'")})`;
                  fs.writeFileSync(metaPath, JSON.stringify(metaContent, null, 2), 'utf-8');
                } catch (e) {}
              }
              return;
            }

            try {
              const result = JSON.parse(stdout.trim());
              if (!result.success) {
                throw new Error(result.error || 'Helper reported failure');
              }

              // Nếu không có phụ đề được cung cấp, tiến hành tự động bóc chữ thông qua AI Dispatcher
              if (!result.transcript_available) {
                console.log(`[*] Subtitle file not provided. Running STT for ${baseName}...`);
                await dispatchTranscription(baseName, language || 'en-US', {
                  geminiKey, openaiKey, whisperKey, geminiModel, openaiModel, providerPreference
                });
              } else {
                console.log(`[+] File import completed successfully for ${baseName} with subtitles!`);
              }
            } catch (err) {
              console.error(`[-] Parsing file import result failed:`, err);
              if (fs.existsSync(metaPath)) {
                try {
                  const metaContent = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                  metaContent.fullText = `(Lỗi bóc phụ đề: ${err.message})`;
                  fs.writeFileSync(metaPath, JSON.stringify(metaContent, null, 2), 'utf-8');
                } catch (e) {}
              }
            }
          });
        };

        runImportTask();

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          message: 'Đang xử lý tệp media nhập vào...',
          recording: {
            id: baseName,
            filename: `${baseName}/audio.wav`,
            txtFilename: `${baseName}/meta.json`,
            size: mediaBuffer.length,
            createdAt: now,
            transcript: '(Đang tự động xử lý transcript...)',
            language: language || 'en-US',
            processing: true,
            source: 'file_import',
            videoTitle: mediaName
          }
        }));
      } catch (err) {
        console.error('Lỗi khi chuẩn bị import tệp:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 2b. POST /api/transcribe/:id - Gọi xử lý transcript thủ công từ file WAV
  if (req.method === 'POST' && pathname.startsWith('/api/transcribe/')) {
    const id = pathname.replace('/api/transcribe/', '');
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const data = body ? JSON.parse(body) : {};
        let lang = data.language;
        const { whisperKey, openaiKey, geminiKey, geminiModel, openaiModel, providerPreference } = data;

        if (!lang) {
          const folderPath = path.join(RECORDINGS_DIR, id);
          const metaPath = path.join(folderPath, 'meta.json');
          if (fs.existsSync(metaPath)) {
            try {
              const metaData = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
              lang = metaData.language;
            } catch (e) {}
          }
        }
        lang = lang || 'en-US';

        console.log(`[*] Requesting AI manual transcription for ${id} (lang: ${lang})...`);
        const text = await dispatchTranscription(id, lang, { geminiKey, openaiKey, whisperKey, geminiModel, openaiModel, providerPreference });

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
    const dirPath = path.join(RECORDINGS_DIR, id);

    try {
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }

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
    const relativePath = pathname.replace('/recordings/', '');
    const filePath = path.resolve(RECORDINGS_DIR, relativePath);

    // Chống Path Traversal
    if (!filePath.startsWith(RECORDINGS_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

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

migrateOldRecordings();

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🎙️ Mini Audio Recorder Tool đang chạy tại:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`📁 Các bản ghi sẽ được tự động lưu vào: ${RECORDINGS_DIR}`);
  console.log(`====================================================`);
});
