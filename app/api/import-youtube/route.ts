import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { RECORDINGS_DIR, dispatchTranscription } from '../helper';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { url, mode, language, whisperKey, openaiKey, geminiKey, geminiModel, openaiModel, providerPreference, customEndpointUrl, customEndpointKey, customEndpointModel } = data;

    if (!url) {
      return NextResponse.json({ success: false, error: 'Thiếu link YouTube URL' }, { status: 400 });
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
      return NextResponse.json({ success: false, error: 'Link YouTube URL không hợp lệ' }, { status: 400 });
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
      const helperPath = path.join(process.cwd(), 'youtube_import.py');
      const cmd = `python "${helperPath}" "${dirPath}" "${url}" ${downloadVideoArg} ${langArg}`;

      console.log(`[*] Executing YouTube import background helper: ${cmd}`);
      exec(cmd, { cwd: process.cwd() }, async (error, stdout, stderr) => {
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
              geminiKey, openaiKey, whisperKey, geminiModel, openaiModel, providerPreference, customEndpointUrl, customEndpointKey, customEndpointModel
            });
          } else {
            console.log(`[+] YouTube import completed successfully for ${baseName} with captions!`);
          }
        } catch (err: any) {
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

    return NextResponse.json({
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
    }, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  } catch (err: any) {
    console.error('Lỗi khi chuẩn bị import YouTube:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
