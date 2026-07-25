import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { RECORDINGS_DIR, dispatchTranscription } from '../../helper';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;

  try {
    const data = await req.json().catch(() => ({}));
    let lang = data.language;
    const { whisperKey, openaiKey, geminiKey, geminiModel, openaiModel, providerPreference, customEndpointUrl, customEndpointKey, customEndpointModel } = data;

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
    const text = await dispatchTranscription(id, lang, {
      geminiKey, openaiKey, whisperKey, geminiModel, openaiModel, providerPreference, customEndpointUrl, customEndpointKey, customEndpointModel
    });

    return NextResponse.json({ success: true, transcript: text }, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  } catch (err: any) {
    console.error(`Lỗi khi bóc chữ tệp ${id}:`, err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
