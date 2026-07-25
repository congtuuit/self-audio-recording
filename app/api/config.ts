import fs from 'fs';
import path from 'path';
import { logger } from './logger';

const CONFIG_PATH = path.join(process.cwd(), 'config', 'settings.json');

// Cache settings in memory to avoid reading file on every request
let cachedSettings: any = null;
let lastModified: number = 0;

export interface AISettings {
  providerPreference: 'openai' | 'gemini' | 'custom';
  openai: {
    apiKey: string;
    model: string;
    whisperKey: string;
  };
  gemini: {
    apiKey: string;
    model: string;
  };
  custom: {
    endpointUrl: string;
    apiKey: string;
    model: string;
  };
}

export interface AppSettings {
  ai: AISettings;
  audio: {
    sampleRate: number;
    autoGain: boolean;
  };
  ui: {
    language: 'vi' | 'en';
  };
}

/**
 * Read settings from config/settings.json with caching
 * Returns null if file doesn't exist or is invalid
 */
export function readSettings(): AppSettings | null {
  try {
    // Check if file exists
    if (!fs.existsSync(CONFIG_PATH)) {
      logger.info('[Config] settings.json not found, using request parameters');
      return null;
    }

    // Check if file was modified since last read
    const stats = fs.statSync(CONFIG_PATH);
    const currentModified = stats.mtimeMs;

    if (cachedSettings && currentModified === lastModified) {
      return cachedSettings;
    }

    // Read and parse file
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const settings = JSON.parse(raw);

    // Update cache
    cachedSettings = settings;
    lastModified = currentModified;

    logger.info('[Config] Loaded settings from config/settings.json');
    return settings;
  } catch (error: any) {
    logger.error('[Config] Error reading settings:', error.message);
    return null;
  }
}

/**
 * Get AI provider settings with fallback to request parameters
 */
export function getAIConfig(
  requestApiKey?: string,
  requestModelName?: string,
  requestCustomUrl?: string,
  requestProvider?: string
): {
  apiKey: string;
  modelName: string;
  customUrl: string;
  provider: string;
} {
  // If request provides all settings, use them (backward compatibility)
  if (requestApiKey && requestModelName && requestProvider) {
    return {
      apiKey: requestApiKey,
      modelName: requestModelName,
      customUrl: requestCustomUrl || '',
      provider: requestProvider
    };
  }

  // Otherwise, try to read from file
  const fileSettings = readSettings();
  if (!fileSettings) {
    // Fallback to request params (even if incomplete) or defaults
    return {
      apiKey: requestApiKey || '',
      modelName: requestModelName || 'gpt-4o-mini',
      customUrl: requestCustomUrl || '',
      provider: requestProvider || 'openai'
    };
  }

  // Use file settings, with request params as override
  const provider = requestProvider || fileSettings.ai.providerPreference;
  let apiKey = requestApiKey || '';
  let modelName = requestModelName || '';
  let customUrl = requestCustomUrl || '';

  if (!requestApiKey || !requestModelName) {
    // Get settings from file based on provider
    switch (provider) {
      case 'gemini':
        apiKey = apiKey || fileSettings.ai.gemini.apiKey;
        modelName = modelName || fileSettings.ai.gemini.model;
        break;
      case 'custom':
        apiKey = apiKey || fileSettings.ai.custom.apiKey;
        modelName = modelName || fileSettings.ai.custom.model;
        customUrl = customUrl || fileSettings.ai.custom.endpointUrl;
        break;
      case 'openai':
      default:
        apiKey = apiKey || fileSettings.ai.openai.apiKey;
        modelName = modelName || fileSettings.ai.openai.model;
        break;
    }
  }

  // Apply defaults if still empty
  modelName = modelName || (provider === 'gemini' ? 'gemini-2.0-flash' : 'gpt-4o-mini');

  return { apiKey, modelName, customUrl, provider };
}

/**
 * Write settings to config/settings.json
 * Safely merges existing API keys if the new ones are masked (contain '*')
 */
export function writeSettings(settings: AppSettings): boolean {
  try {
    const configDir = path.dirname(CONFIG_PATH);

    // Create config directory if it doesn't exist
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Load existing settings to merge masked keys
    let existing: AppSettings | null = null;
    if (fs.existsSync(CONFIG_PATH)) {
      try {
        existing = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      } catch (e) {
        logger.error('[Config] Error reading existing settings for merging:', e);
      }
    }

    if (existing) {
      const mergeKey = (newKey: string, oldKey: string) => {
        if (newKey && newKey.includes('*')) {
          return oldKey || '';
        }
        return newKey;
      };

      if (settings.ai) {
        if (settings.ai.openai && existing.ai?.openai) {
          settings.ai.openai.apiKey = mergeKey(settings.ai.openai.apiKey, existing.ai.openai.apiKey);
          settings.ai.openai.whisperKey = mergeKey(settings.ai.openai.whisperKey, existing.ai.openai.whisperKey);
        }
        if (settings.ai.gemini && existing.ai?.gemini) {
          settings.ai.gemini.apiKey = mergeKey(settings.ai.gemini.apiKey, existing.ai.gemini.apiKey);
        }
        if (settings.ai.custom && existing.ai?.custom) {
          settings.ai.custom.apiKey = mergeKey(settings.ai.custom.apiKey, existing.ai.custom.apiKey);
        }
      }
    }

    // Write settings
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(settings, null, 2), 'utf-8');

    // Clear cache so next read gets fresh data
    cachedSettings = null;
    lastModified = 0;

    logger.info('[Config] Settings saved to config/settings.json');
    return true;
  } catch (error: any) {
    logger.error('[Config] Error writing settings:', error.message);
    return false;
  }
}
