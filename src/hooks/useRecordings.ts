import { useState, useEffect, useCallback, useRef } from 'react';
import { Recording, AIScore } from '../types';

export interface UseRecordingsReturn {
  recordings: Recording[];
  isLoading: boolean;
  error: string | null;
  loadRecordings: () => Promise<void>;
  saveRecording: (wavBlob: Blob, transcript: string, customName: string, lang: string) => Promise<Recording>;
  deleteRecording: (id: string) => Promise<void>;
  reTranscribe: (id: string, lang: string) => Promise<void>;
  toggleFavorite: (id: string) => void;
}

export function useRecordings(): UseRecordingsReturn {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollIntervalRef = useRef<any>(null);

  // Load danh sách bản ghi
  const loadRecordings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/recordings');
      const data = await response.json();

      if (data.success) {
        // Trộn thêm trạng thái favorite từ localStorage
        const favorites = JSON.parse(localStorage.getItem('voicecraft_favorites') || '[]');
        const updatedRecordings = (data.recordings || []).map((rec: Recording) => {
          // Tạo giả lập điểm AI ngẫu nhiên/tương đối cho các bản ghi cũ
          // Trong ứng dụng SaaS thực tế, điểm này được sinh ra từ AI Engine.
          const fakeAIScore: AIScore = rec.aiScore || {
            pronunciation: Math.floor(Math.random() * 25) + 70, // 70-95
            fluency: Math.floor(Math.random() * 20) + 75,       // 75-95
            speed: Math.floor(Math.random() * 50) + 120,        // 120-170 wpm
            vocabulary: Math.floor(Math.random() * 20) + 70,    // 70-90
            grammar: Math.floor(Math.random() * 20) + 75        // 75-95
          };

          return {
            ...rec,
            isFavorite: favorites.includes(rec.id),
            aiScore: rec.processing ? undefined : fakeAIScore
          };
        });
        setRecordings(updatedRecordings);
      } else {
        setError(data.error || 'Lỗi khi tải danh sách ghi âm');
      }
    } catch (err) {
      setError('Không thể kết nối đến server API');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Polling check background transcription
  useEffect(() => {
    const hasProcessing = recordings.some(r => r.processing);

    if (hasProcessing) {
      if (!pollIntervalRef.current) {
        pollIntervalRef.current = setInterval(async () => {
          try {
            const res = await fetch('/api/recordings');
            const data = await res.json();
            if (data.success) {
              const stillProcessing = data.recordings.some((r: Recording) => r.processing);

              // Cập nhật lại state
              const favorites = JSON.parse(localStorage.getItem('voicecraft_favorites') || '[]');
              setRecordings((data.recordings || []).map((rec: Recording) => {
                const fakeAIScore: AIScore = rec.aiScore || {
                  pronunciation: Math.floor(Math.random() * 25) + 70,
                  fluency: Math.floor(Math.random() * 20) + 75,
                  speed: Math.floor(Math.random() * 50) + 120,
                  vocabulary: Math.floor(Math.random() * 20) + 70,
                  grammar: Math.floor(Math.random() * 20) + 75
                };
                return {
                  ...rec,
                  isFavorite: favorites.includes(rec.id),
                  aiScore: rec.processing ? undefined : fakeAIScore
                };
              }));

              if (!stillProcessing) {
                if (pollIntervalRef.current) {
                  clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                }
              }
            }
          } catch (e) {}
        }, 3000);
      }
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [recordings]);

  // Gọi lần đầu
  useEffect(() => {
    loadRecordings();
  }, [loadRecordings]);

  // Lưu bản ghi mới
  const saveRecording = async (wavBlob: Blob, transcript: string, customName: string, lang: string): Promise<Recording> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(wavBlob);

      reader.onloadend = async () => {
        try {
          let whisperKey = '';
          try {
            const stored = localStorage.getItem('voicecraft_settings');
            if (stored) {
              whisperKey = JSON.parse(stored).whisperKey || '';
            }
          } catch (e) {}

          const base64Audio = reader.result as string;
          const payload = {
            audioBase64: base64Audio,
            transcript,
            customName,
            language: lang,
            whisperKey
          };

          const response = await fetch('/api/save-recording', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await response.json();

          if (data.success) {
            await loadRecordings();
            resolve(data.recording);
          } else {
            reject(new Error(data.error || 'Lỗi khi lưu tệp âm thanh'));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (e) => reject(e);
    });
  };

  // Xóa bản ghi
  const deleteRecording = async (id: string) => {
    try {
      const response = await fetch(`/api/recordings/${id}`, {
        method: 'DELETE'
      });
      const data = await response.json();

      if (data.success) {
        setRecordings(prev => prev.filter(rec => rec.id !== id));
      } else {
        throw new Error(data.error || 'Xóa bản ghi thất bại');
      }
    } catch (err) {
      throw new Error('Không thể kết nối đến server để xóa');
    }
  };

  // Transcribe lại với ngôn ngữ khác
  const reTranscribe = async (id: string, lang: string) => {
    try {
      let whisperKey = '';
      try {
        const stored = localStorage.getItem('voicecraft_settings');
        if (stored) {
          whisperKey = JSON.parse(stored).whisperKey || '';
        }
      } catch (e) {}

      const response = await fetch(`/api/transcribe/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang, whisperKey })
      });
      const data = await response.json();

      if (data.success) {
        await loadRecordings();
      } else {
        throw new Error(data.error || 'Không thể chạy lại transcribe');
      }
    } catch (err) {
      throw new Error('Lỗi kết nối khi gửi yêu cầu bóc chữ');
    }
  };

  // Toggle favorite
  const toggleFavorite = (id: string) => {
    const favorites = JSON.parse(localStorage.getItem('voicecraft_favorites') || '[]');
    let newFavorites;
    if (favorites.includes(id)) {
      newFavorites = favorites.filter((favId: string) => favId !== id);
    } else {
      newFavorites = [...favorites, id];
    }
    localStorage.setItem('voicecraft_favorites', JSON.stringify(newFavorites));

    setRecordings(prev => prev.map(rec => {
      if (rec.id === id) {
        return { ...rec, isFavorite: !rec.isFavorite };
      }
      return rec;
    }));
  };

  return {
    recordings,
    isLoading,
    error,
    loadRecordings,
    saveRecording,
    deleteRecording,
    reTranscribe,
    toggleFavorite
  };
}
