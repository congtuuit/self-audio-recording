import { NextResponse } from 'next/server';
import { readSettings, writeSettings, AppSettings } from '../config';
import { logger } from '../logger';

/**
 * GET /api/settings
 * Returns current settings from config/settings.json
 */
export async function GET() {
  try {
    const settings = readSettings();

    if (!settings) {
      return NextResponse.json({
        success: false,
        error: 'Settings file not found. Create config/settings.json from config/settings.example.json'
      }, { status: 404 });
    }

    // Mask API keys for security (only show first/last 4 chars)
    const maskedSettings = {
      ...settings,
      ai: {
        ...settings.ai,
        openai: {
          ...settings.ai.openai,
          apiKey: maskApiKey(settings.ai.openai.apiKey),
          whisperKey: maskApiKey(settings.ai.openai.whisperKey)
        },
        gemini: {
          ...settings.ai.gemini,
          apiKey: maskApiKey(settings.ai.gemini.apiKey)
        },
        custom: {
          ...settings.ai.custom,
          apiKey: maskApiKey(settings.ai.custom.apiKey)
        }
      }
    };

    return NextResponse.json({
      success: true,
      settings: maskedSettings
    });
  } catch (error: any) {
    logger.error('[API] Error reading settings:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * POST /api/settings
 * Updates settings in config/settings.json
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { settings } = body;

    if (!settings) {
      return NextResponse.json({
        success: false,
        error: 'Missing settings in request body'
      }, { status: 400 });
    }

    // Validate settings structure
    if (!settings.ai || !settings.audio || !settings.ui) {
      return NextResponse.json({
        success: false,
        error: 'Invalid settings structure. Must include ai, audio, and ui sections.'
      }, { status: 400 });
    }

    const success = writeSettings(settings as AppSettings);

    if (!success) {
      return NextResponse.json({
        success: false,
        error: 'Failed to write settings file'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully'
    });
  } catch (error: any) {
    logger.error('[API] Error updating settings:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Helper to mask API key for security
 * Shows first 4 and last 4 characters, masks the rest
 */
function maskApiKey(key: string): string {
  if (!key || key.length < 12) {
    return key ? '****' : '';
  }

  const first4 = key.substring(0, 4);
  const last4 = key.substring(key.length - 4);
  const masked = '*'.repeat(Math.min(key.length - 8, 20));

  return `${first4}${masked}${last4}`;
}
