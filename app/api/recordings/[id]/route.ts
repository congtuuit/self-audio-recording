import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { RECORDINGS_DIR } from '../../helper';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const dirPath = path.join(RECORDINGS_DIR, id);

  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }

    return NextResponse.json({ success: true, message: 'Đã xóa bản ghi' });
  } catch (err: any) {
    console.error(`Lỗi khi xóa bản ghi ${id}:`, err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
