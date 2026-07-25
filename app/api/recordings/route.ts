import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { RECORDINGS_DIR } from '../helper';

export async function GET() {
  try {
    const items = fs.readdirSync(RECORDINGS_DIR);
    const recordings: any[] = [];

    for (const item of items) {
      const dirPath = path.join(RECORDINGS_DIR, item);
      const stats = fs.statSync(dirPath);

      if (stats.isDirectory() && item.startsWith('REC_')) {
        const wavPath = path.join(dirPath, 'audio.wav');
        const metaPath = path.join(dirPath, 'meta.json');

        const hasWav = fs.existsSync(wavPath);
        const hasMeta = fs.existsSync(metaPath);

        if (hasWav || hasMeta) {
          const wavStats = hasWav ? fs.statSync(wavPath) : null;
          const metaStats = hasMeta ? fs.statSync(metaPath) : null;
          let transcript = '';
          let words = [];
          let dictionary = {};
          let duration = 0;
          let language = 'en-US';
          let createdAt: Date | string = wavStats ? (wavStats.birthtime || wavStats.mtime) : (metaStats ? (metaStats.birthtime || metaStats.mtime) : new Date());
          let aiScore = undefined;
          let source = 'recording';
          let sourceUrl = '';
          let videoTitle = '';
          let videoChannel = '';
          let videoThumbnail = '';
          let hasVideo = false;
          let sentenceAnalysis = { sentences: [] };

          if (hasMeta) {
            try {
              const metaData = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
              transcript = metaData.fullText || '';
              words = metaData.words || [];
              duration = metaData.duration || 0;
              language = metaData.language || 'en-US';
              if (metaData.createdAt) createdAt = new Date(metaData.createdAt);
              aiScore = metaData.aiScore;
              dictionary = metaData.dictionary || {};
              sentenceAnalysis = metaData.sentenceAnalysis || { sentences: [] };

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
            size: wavStats ? wavStats.size : 0,
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
            hasVideo: hasVideo,
            duration: duration,
            sentenceAnalysis: sentenceAnalysis
          });
        }
      }
    }

    // Sắp xếp bản ghi mới nhất lên đầu
    recordings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ success: true, recordings }, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  } catch (err: any) {
    console.error('Lỗi khi lấy danh sách bản ghi:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
