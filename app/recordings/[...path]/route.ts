import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { RECORDINGS_DIR } from '../../api/helper';

const MIME_TYPES: Record<string, string> = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const relativePath = params.path.join('/');
  const filePath = path.resolve(RECORDINGS_DIR, relativePath);

  // Prevent Path Traversal
  if (!filePath.startsWith(RECORDINGS_DIR)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return new NextResponse('File không tồn tại', { status: 404 });
  }

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    return new NextResponse('Not a file', { status: 400 });
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const totalSize = stat.size;

  const range = req.headers.get('range');
  if (range && (ext === '.wav' || ext === '.mp3' || ext === '.webm' || ext === '.mp4')) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

    if (start >= totalSize || end >= totalSize) {
      return new NextResponse(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${totalSize}` }
      });
    }

    const chunksize = (end - start) + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });

    // Convert Node Readable stream to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => controller.enqueue(chunk));
        fileStream.on('end', () => controller.close());
        fileStream.on('error', (err) => controller.error(err));
      },
      cancel() {
        fileStream.destroy();
      }
    });

    return new NextResponse(webStream, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize.toString(),
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } else {
    const fileStream = fs.createReadStream(filePath);
    const webStream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => controller.enqueue(chunk));
        fileStream.on('end', () => controller.close());
        fileStream.on('error', (err) => controller.error(err));
      },
      cancel() {
        fileStream.destroy();
      }
    });

    return new NextResponse(webStream, {
      headers: {
        'Content-Length': totalSize.toString(),
        'Content-Type': contentType
      }
    });
  }
}
