import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

export const RECORDINGS_DIR = path.join(process.cwd(), 'recordings');

// Đảm bảo thư mục recordings tồn tại
if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

// Hàm chạy Python bóc tách chữ (Transcription)
export function runPythonTranscribe(baseName: string, lang: string = 'vi-VN'): Promise<string> {
  return new Promise((resolve, reject) => {
    const folderPath = path.join(RECORDINGS_DIR, baseName);
    const wavPath = path.join(folderPath, 'audio.wav');
    const scriptPath = path.join(process.cwd(), 'transcribe.py');
    const cmd = `python "${scriptPath}" "${wavPath}" ${lang}`;

    console.log(`[*] Running auto-transcribe: ${cmd}`);
    exec(cmd, { cwd: process.cwd() }, (error, stdout, stderr) => {
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
export async function transcribeWithGemini(baseName: string, lang: string = 'en-US', geminiKey: string, modelName: string = 'gemini-2.0-flash'): Promise<string> {
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

  let parsed: any = {};
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
export async function generateDictionaryWithChatGPT(fullText: string, openaiKey: string, modelName: string = 'gpt-4o-mini'): Promise<any> {
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
  } catch (err: any) {
    console.error('[-] Error generating EN-VI dictionary with ChatGPT:', err.message);
    return {};
  }
}

// Hàm bóc chữ sử dụng OpenAI Whisper Cloud API + ChatGPT cho từ điển
export async function transcribeWithOpenAI(baseName: string, lang: string = 'en-US', whisperKey: string, openaiModel: string = 'gpt-4o-mini'): Promise<string> {
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
  const words = (result.words || []).map((w: any) => ({
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
    aiProvider: 'OpenAI Whisper'
  };
  fs.writeFileSync(metaPath, JSON.stringify(metaOutput, null, 2), 'utf-8');

  console.log(`[+] OpenAI Whisper + GPT-4o-mini finished successfully for ${baseName}`);
  return text;
}

// Hàm dùng FFmpeg cắt bỏ khoảng im lặng (silence trimming) ở đầu & cuối và chuẩn hóa âm lượng (loudnorm)
export function preprocessAudioWithFFmpeg(baseName: string): Promise<boolean> {
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
export async function dispatchTranscription(baseName: string, lang: string = 'en-US', options: any = {}): Promise<string> {
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
    } catch (err: any) {
      console.error(`[-] Gemini transcribe failed, fallback to OpenAI/Python:`, err.message);
    }
  }

  if (effectiveOpenAIKey) {
    try {
      return await transcribeWithOpenAI(baseName, lang, effectiveOpenAIKey, openaiModel);
    } catch (err: any) {
      console.error(`[-] OpenAI transcribe failed, fallback to Python:`, err.message);
    }
  }

  return await runPythonTranscribe(baseName, lang);
}
