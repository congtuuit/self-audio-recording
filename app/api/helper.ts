import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { logger } from './logger';
import { readSettings } from './config';

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

    logger.info(`[*] Running auto-transcribe: ${cmd}`);
    exec(cmd, { cwd: process.cwd() }, (error, stdout, stderr) => {
      if (error) {
        logger.error(`[-] Python execute error: ${error.message}`);
      }
      if (stderr) {
        logger.error(`[-] Python stderr: ${stderr}`);
      }
      if (stdout) {
        logger.info(`[*] Python stdout: ${stdout}`);
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
          logger.error('Lỗi khi đọc file JSON sinh từ python:', e);
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
        logger.info(`[+] Đã tạo file meta.json cho ${baseName}`);

        // Xóa tệp tạm
        if (fs.existsSync(pyTxtPath)) fs.unlinkSync(pyTxtPath);
        if (fs.existsSync(pyJsonPath)) fs.unlinkSync(pyJsonPath);
      } catch (metaErr) {
        logger.error('Lỗi tổng hợp meta.json sau khi chạy python:', metaErr);
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
  logger.info(`[*] Running Google Gemini (${targetModel}) Transcribe & Dictionary for ${baseName}...`);
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
    logger.error('[-] Error parsing Gemini JSON response:', parseErr);
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
  logger.info(`[+] Gemini 2.0 Flash finished successfully for ${baseName}`);
  return parsed.fullText;
}

// Hàm sinh từ điển Anh-Việt theo ngữ cảnh bằng ChatGPT (model tùy chọn)
export async function generateDictionaryWithChatGPT(fullText: string, openaiKey: string, modelName: string = 'gpt-4o-mini', customUrl?: string): Promise<any> {
  if (!fullText) return {};
  const targetModel = modelName || 'gpt-4o-mini';
  const endpoint = customUrl ? `${customUrl.replace(/\/$/, '')}/chat/completions` : 'https://api.openai.com/v1/chat/completions';
  const headers: any = { 'Content-Type': 'application/json' };
  if (openaiKey) headers['Authorization'] = `Bearer ${openaiKey}`;

  try {
    logger.info(`[*] Generating EN-VI dictionary via OpenAI (${targetModel})...`);
    const prompt = `Bạn là trợ lý từ điển Anh - Việt. Dựa trên đoạn transcript sau: "${fullText}", hãy chọn lọc các từ vựng tiếng Anh quan trọng và xuất ra JSON duy nhất theo schema:
{
  "từ_viết_thường": {
    "phonetic": "/phiên_âm_IPA/",
    "viMeaning": "nghĩa tiếng Việt ngắn gọn",
    "explanation": "giải thích ngữ nghĩa ngắn trong câu"
  }
}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
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
    let content = resData.choices?.[0]?.message?.content || '{}';
    
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
    content = content.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    content = content.replace(/^data:\s*/gm, '');
    
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      content = content.substring(firstBrace, lastBrace + 1);
    }
    
    content = content.trim();

    return JSON.parse(content);
  } catch (err: any) {
    logger.error('[-] Error generating EN-VI dictionary with ChatGPT:', err.message);
    return {};
  }
}

export async function generateSentenceAnalysisWithAI(
  textOrSentences: string | string[],
  apiKey: string,
  modelName: string = 'gpt-4o-mini',
  customUrl?: string,
  provider: string = 'auto'
): Promise<any> {
  if (!textOrSentences || (Array.isArray(textOrSentences) && textOrSentences.length === 0)) return {};
  const targetModel = modelName || (provider === 'gemini' ? 'gemini-2.0-flash' : 'gpt-4o-mini');
  const isGemini = provider === 'gemini';
  
  const endpoint = isGemini 
    ? `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`
    : (customUrl ? `${customUrl.replace(/\/$/, '')}/chat/completions` : 'https://api.openai.com/v1/chat/completions');
  
  const headers: any = { 'Content-Type': 'application/json' };
  if (!isGemini && apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  try {
    logger.info(`[*] Generating sentence analysis via AI (${targetModel})...`);

    let prompt = '';
    if (Array.isArray(textOrSentences)) {
      // Batch sentences prompt
      prompt = `Bạn là một chuyên gia ngôn ngữ tiếng Anh. Hãy dịch nghĩa và phân tích các câu tiếng Anh sau đây sang tiếng Việt.

Danh sách các câu cần dịch và phân tích:
${textOrSentences.map((s, i) => `${i + 1}. "${s}"`).join('\n')}

Yêu cầu:
1. Phân tích từng câu trong danh sách và xuất ra JSON duy nhất theo schema sau.
2. Trường "english" trong kết quả trả về phải giữ nguyên câu gốc từ danh sách (hoặc viết thường).
LƯU Ý: Phải là định dạng JSON hợp lệ.
Schema:
{
  "sentences": [
    {
      "english": "câu tiếng anh gốc",
      "translation": "Bản dịch nghĩa tiếng Việt tự nhiên",
      "grammar": "Phân tích cấu trúc ngữ pháp chính hoặc điểm đáng chú ý trong câu (1-2 câu)",
      "linkings": ["Quy tắc nối âm 1 (vd: want you -> /wɑːn-tʃuː/)", "Quy tắc nối âm 2"],
      "shadowing": "Mẹo nhấn nhá, ngắt nghỉ, lên xuống giọng cho câu này"
    }
  ]
}`;
    } else {
      // Original full-text prompt
      prompt = `Bạn là một chuyên gia ngôn ngữ tiếng Anh. Hãy phân tích từng câu trong đoạn transcript sau đây.
Transcript: "${textOrSentences}"

Yêu cầu:
1. Tách đoạn văn thành các câu riêng biệt (dựa trên dấu chấm, dấu hỏi).
2. Phân tích và xuất ra JSON duy nhất theo schema sau.
LƯU Ý: Phải là định dạng JSON hợp lệ.
Schema:
{
  "sentences": [
    {
      "english": "câu tiếng anh gốc (viết thường, giữ nguyên nguyên văn)",
      "translation": "Bản dịch nghĩa tiếng Việt tự nhiên",
      "grammar": "Phân tích cấu trúc ngữ pháp chính hoặc điểm đáng chú ý trong câu (1-2 câu)",
      "linkings": ["Quy tắc nối âm 1 (vd: want you -> /wɑːn-tʃuː/)", "Quy tắc nối âm 2"],
      "shadowing": "Mẹo nhấn nhá, ngắt nghỉ, lên xuống giọng cho câu này"
    }
  ]
}`;
    }

    let reqBody;
    if (isGemini) {
      reqBody = {
        contents: [
          {
            parts: [{ text: 'You return ONLY valid JSON matching the requested schema. Ensure the keys are the exact lowercase English sentences from the transcript.\n\n' + prompt }]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      };
    } else {
      reqBody = {
        model: targetModel,
        messages: [
          { role: 'system', content: 'You return ONLY valid JSON matching the requested schema. Ensure the keys are the exact lowercase English sentences from the transcript.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        stream: false
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(reqBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error('[-] API Error:', errText);
      return {};
    }
    const resData = await response.json();
    let content = '{}';
    
    if (isGemini) {
      content = resData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    } else {
      content = resData.choices?.[0]?.message?.content || '{}';
    }
    
    // 1. Remove Chain-of-Thought tags like <think> or <thinking>
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
    content = content.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    
    // 2. Remove SSE artifacts if any
    content = content.replace(/^data:\s*/gm, '');
    
    // 3. Extract the JSON block between the first { and last }
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      content = content.substring(firstBrace, lastBrace + 1);
    }
    
    content = content.trim();

    return JSON.parse(content);
  } catch (err: any) {
    logger.error('[-] Error generating sentence analysis:', err.message);
    return {};
  }
}

// Hàm bóc chữ sử dụng OpenAI Whisper Cloud API + ChatGPT cho từ điển
export async function transcribeWithOpenAI(baseName: string, lang: string = 'en-US', whisperKey: string, openaiModel: string = 'gpt-4o-mini', customUrl?: string): Promise<string> {
  const folderPath = path.join(RECORDINGS_DIR, baseName);
  const wavPath = path.join(folderPath, 'audio.wav');
  const metaPath = path.join(folderPath, 'meta.json');

  if (!fs.existsSync(wavPath)) {
    throw new Error(`File audio không tồn tại: ${wavPath}`);
  }

  logger.info(`[*] Running OpenAI Whisper Cloud Transcribe for ${baseName} (lang: ${lang})...`);
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

  const endpoint = customUrl ? `${customUrl.replace(/\/$/, '')}/audio/transcriptions` : 'https://api.openai.com/v1/audio/transcriptions';
  const headers: any = {};
  if (whisperKey) headers['Authorization'] = `Bearer ${whisperKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
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
  const dictionary = await generateDictionaryWithChatGPT(text, whisperKey, openaiModel, customUrl);

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

  logger.info(`[+] OpenAI Whisper + GPT-4o-mini finished successfully for ${baseName}`);
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

    logger.info(`[*] Preprocessing audio with FFmpeg (trim silence & normalize volume) for ${baseName}...`);
    // Lệnh FFmpeg: cắt khoảng im lặng ở đầu (-45dB) và cuối (-45dB) + chuẩn hóa âm lượng EBU R128 (-16 LUFS)
    const ffmpegCmd = `ffmpeg -y -i "${wavPath}" -af "silenceremove=start_periods=1:start_duration=0.1:start_threshold=-45dB:stop_periods=1:stop_duration=0.1:stop_threshold=-45dB,loudnorm=I=-16:TP=-1.5:LRA=11" "${tempWavPath}"`;

    exec(ffmpegCmd, (error) => {
      if (error) {
        logger.warn(`[-] FFmpeg preprocessing warning (skipping): ${error.message}`);
        if (fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath);
        resolve(false);
        return;
      }

      if (fs.existsSync(tempWavPath) && fs.statSync(tempWavPath).size > 1000) {
        fs.unlinkSync(wavPath);
        fs.renameSync(tempWavPath, wavPath);
        logger.info(`[+] FFmpeg audio normalization & silence trimming completed for ${baseName}`);
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

  let { geminiKey, openaiKey, whisperKey, geminiModel, openaiModel, providerPreference = 'auto', customEndpointUrl, customEndpointKey, customEndpointModel } = options;

  // Fallback to local settings file
  const fileSettings = readSettings();
  if (fileSettings) {
    providerPreference = providerPreference && providerPreference !== 'auto' ? providerPreference : (fileSettings.ai.providerPreference || 'auto');
    geminiKey = geminiKey || fileSettings.ai.gemini.apiKey;
    geminiModel = geminiModel || fileSettings.ai.gemini.model;
    openaiKey = openaiKey || fileSettings.ai.openai.apiKey;
    whisperKey = whisperKey || fileSettings.ai.openai.whisperKey;
    openaiModel = openaiModel || fileSettings.ai.openai.model;
    customEndpointUrl = customEndpointUrl || fileSettings.ai.custom.endpointUrl;
    customEndpointKey = customEndpointKey || fileSettings.ai.custom.apiKey;
    customEndpointModel = customEndpointModel || fileSettings.ai.custom.model;
  }

  const effectiveOpenAIKey = openaiKey || whisperKey;

  logger.info(`[*] AI Dispatcher processing ${baseName} (pref: ${providerPreference}, geminiModel: ${geminiModel || 'default'}, openaiModel: ${openaiModel || 'default'})...`);

  if (providerPreference === 'gemini' && geminiKey) {
    return await transcribeWithGemini(baseName, lang, geminiKey, geminiModel);
  }

  if (providerPreference === 'openai' && effectiveOpenAIKey) {
    return await transcribeWithOpenAI(baseName, lang, effectiveOpenAIKey, openaiModel);
  }

  if (providerPreference === 'local') {
    return await runPythonTranscribe(baseName, lang);
  }

  if (providerPreference === 'custom' && customEndpointUrl) {
    try {
      logger.info(`[*] Trying Custom Endpoint STT for ${baseName}...`);
      return await transcribeWithOpenAI(baseName, lang, customEndpointKey, customEndpointModel, customEndpointUrl);
    } catch (err: any) {
      logger.warn(`[-] Custom STT failed, using Local STT + Custom LLM Dictionary...`);
      // Fallback: Local STT -> Custom LLM
      try {
        const fullText = await runPythonTranscribe(baseName, lang);
        if (fullText) {
          const dict = await generateDictionaryWithChatGPT(fullText, customEndpointKey, customEndpointModel, customEndpointUrl);
          const metaPath = path.join(RECORDINGS_DIR, baseName, 'meta.json');
          if (fs.existsSync(metaPath)) {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            meta.dictionary = dict;
            fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
          }
        }
        return fullText;
      } catch (localErr: any) {
        throw err;
      }
    }
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
