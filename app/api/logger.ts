import fs from 'fs';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const CONFIG_PATH = path.join(process.cwd(), 'config', 'settings.json');

const getLogLevel = (): 'info' | 'warn' | 'error' => {
  // Check environment variable first
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  if (envLevel === 'error' || envLevel === 'warn' || envLevel === 'warning' || envLevel === 'info') {
    return envLevel === 'warning' ? 'warn' : (envLevel as any);
  }

  // Fallback to settings.json
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const settings = JSON.parse(raw);
      const level = settings.logLevel || settings.logging?.logLevel || settings.ai?.logLevel;
      if (level === 'error' || level === 'warn' || level === 'warning' || level === 'info') {
        return level === 'warning' ? 'warn' : (level as any);
      }
    }
  } catch (e) {
    // Avoid logging errors here to prevent infinite loop
  }
  return 'info'; // Default level
};

const getLogFilePath = () => {
  const date = new Date().toISOString().split('T')[0];
  return path.join(logDir, `app-${date}.log`);
};

const getErrorLogFilePath = () => {
  const date = new Date().toISOString().split('T')[0];
  return path.join(logDir, `error-${date}.log`);
};

const formatMessage = (level: string, message: string, meta: any[]) => {
  const timestamp = new Date().toISOString();
  let metaString = '';
  if (meta.length > 0) {
    try {
      metaString = ' ' + meta.map(m => typeof m === 'object' ? JSON.stringify(m) : String(m)).join(' ');
    } catch (e) {
      metaString = ' [Object]';
    }
  }
  return `[${timestamp}] [${level}] ${message}${metaString}\n`;
};

const LOG_LEVELS = {
  info: 0,
  warn: 1,
  error: 2
};

const shouldLog = (level: 'info' | 'warn' | 'error') => {
  const configLevel = getLogLevel();
  return LOG_LEVELS[level] >= LOG_LEVELS[configLevel];
};

export const logger = {
  info: (message: string, ...meta: any[]) => {
    console.log(`[INFO] ${message}`, ...meta);
    if (shouldLog('info')) {
      fs.appendFileSync(getLogFilePath(), formatMessage('INFO', message, meta), 'utf8');
    }
  },
  warn: (message: string, ...meta: any[]) => {
    console.warn(`[WARN] ${message}`, ...meta);
    if (shouldLog('warn')) {
      fs.appendFileSync(getLogFilePath(), formatMessage('WARN', message, meta), 'utf8');
    }
  },
  error: (message: string, ...meta: any[]) => {
    console.error(`[ERROR] ${message}`, ...meta);
    if (shouldLog('error')) {
      const formatted = formatMessage('ERROR', message, meta);
      fs.appendFileSync(getLogFilePath(), formatted, 'utf8');
      fs.appendFileSync(getErrorLogFilePath(), formatted, 'utf8');
    }
  }
};
