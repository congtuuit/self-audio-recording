import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { RECORDINGS_DIR, dispatchTranscription } from '../helper';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { mediaBase64, mediaName, subtitleText, language, whisperKey, openaiKey, geminiKey, geminiModel, openaiModel, providerPreference } = data;

    if (!mediaBase64 || !mediaName) {
      return NextResponse.json({ success: false, error: 'Thiếu file media hoặc tên tệp' }, { status: 400 });
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
      const helperPath = path.join(process.cwd(), 'file_import.py');
      const cmd = `python "${helperPath}" "${dirPath}" "${tempMediaPath}" ${subArg} --name "${mediaName.replace(/"/g, '\\"')}" --lang "${language || 'en-US'}"`;

      console.log(`[*] Executing file import background helper: ${cmd}`);
      exec(cmd, { cwd: process.cwd() }, async (error, stdout, stderr) => {
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

          // Nếu không có phụ đề được cung cấp, dùng STT fallback
          if (!result.transcript_available) {
            console.log(`[*] Subtitle file not provided. Running STT for ${baseName}...`);
            await dispatchTranscription(baseName, language || 'en-US', {
              geminiKey, openaiKey, whisperKey, geminiModel, openaiModel, providerPreference
            });
          } else {
            console.log(`[+] File import completed successfully for ${baseName} with subtitles!`);
          }
        } catch (err: any) {
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

    return NextResponse.json({
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
    }, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  } catch (err: any) {
    console.error('Lỗi khi chuẩn bị import tệp:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
