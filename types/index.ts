export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  score?: number; // Điểm phát âm của từ (0-100), dùng cho Shadowing Feedback
}

export interface AIScore {
  pronunciation: number;
  fluency: number;
  speed: number; // words per minute
  vocabulary: number;
  grammar: number;
}

export interface DictionaryItem {
  phonetic?: string;
  viMeaning?: string;
  explanation?: string;
  example?: string;
}

export interface SentenceAnalysis {
  translation: string;
  grammar: string;
  linkings: string[];
  shadowing: string;
}

export interface Recording {
  id: string;
  filename: string;
  txtFilename: string;
  jsonFilename: string;
  size: number;
  createdAt: string;
  transcript: string;
  words: WordTimestamp[];
  language?: string;
  dictionary?: Record<string, DictionaryItem>;
  processing?: boolean;
  isFavorite?: boolean;
  aiScore?: AIScore;
  source?: 'recording' | 'youtube' | 'file_import';
  sourceUrl?: string;
  videoTitle?: string;
  videoChannel?: string;
  videoThumbnail?: string;
  hasVideo?: boolean;
  duration?: number;
  sentenceAnalysis?: Record<string, SentenceAnalysis>;
}

export interface VoicecraftSettings {
  uiLanguage?: 'vi' | 'en';
  whisperKey?: string;
  openaiKey?: string;
  geminiKey?: string;
  geminiModel?: string;
  openaiModel?: string;
  customEndpointUrl?: string;
  customEndpointKey?: string;
  customEndpointModel?: string;
  sampleRate?: number;
  autoGain?: boolean;
  providerPreference?: 'auto' | 'gemini' | 'openai' | 'local' | 'custom';
}

export interface UserProgress {
  totalLessons: number;
  hoursPracticed: number;
  wordsSpoken: number;
  avgScore: number;
  streak: number;
  weeklyGoalProgress: number; // 0 đến 100
}
