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

export interface Recording {
  id: string;
  filename: string;
  txtFilename: string;
  jsonFilename: string;
  size: number;
  createdAt: string;
  transcript: string;
  words: WordTimestamp[];
  processing?: boolean;
  isFavorite?: boolean;
  aiScore?: AIScore;
}

export interface UserProgress {
  totalLessons: number;
  hoursPracticed: number;
  wordsSpoken: number;
  avgScore: number;
  streak: number;
  weeklyGoalProgress: number; // 0 đến 100
}
