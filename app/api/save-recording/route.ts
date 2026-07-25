import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { RECORDINGS_DIR, dispatchTranscription } from '../helper';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { audioBase64, transcript, customName, language, whisperKey, openaiKey, geminiKey, geminiModel, openaiModel, providerPreference, customEndpointUrl, customEndpointKey, customEndpointModel } = data;

    if (!audioBase64) {
      return NextResponse.json({ success: false, error: 'Thiếu dữ liệu audioBase64' }, { status: 400 });
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
    // Tự động chạy bóc chữ ngầm qua AI Dispatcher nếu transcript rỗng
    if (!transcript || !transcript.trim() || transcript === '(Không có văn bản transcript)') {
      console.log(`[*] Live transcript is empty. Triggering AI transcription for ${baseName}...`);
      processing = true;

      // Chạy ngầm hoàn toàn không await chặn luồng phản hồi HTTP
      const runTranscribeTask = async () => {
        try {
          const text = await dispatchTranscription(baseName, language || 'en-US', {
            geminiKey, openaiKey, whisperKey, geminiModel, openaiModel, providerPreference, customEndpointUrl, customEndpointKey, customEndpointModel
          });
          if (!text || text.includes('(Đang tự động xử lý transcript...)')) {
            if (fs.existsSync(metaPath)) {
              try {
                const metaContent = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                metaContent.fullText = '(Không thể nhận dạng được giọng nói trong file audio này)';
                fs.writeFileSync(metaPath, JSON.stringify(metaContent, null, 2), 'utf-8');
              } catch (e) {}
            }
          }
        } catch (err: any) {
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

    return NextResponse.json({
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
    }, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  } catch (err: any) {
    console.error('Lỗi khi lưu file thu âm:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
