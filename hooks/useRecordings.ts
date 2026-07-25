import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Recording } from '../types';

export interface UseRecordingsReturn {
  recordings: Recording[];
  isLoading: boolean;
  error: string | null;
  loadRecordings: () => Promise<void>;
  saveRecording: (wavBlob: Blob, transcript: string, customName: string, lang: string) => Promise<Recording>;
  deleteRecording: (id: string) => Promise<void>;
  reTranscribe: (id: string, lang: string) => Promise<void>;
  toggleFavorite: (id: string) => void;
  importYouTube: (url: string, mode: 'audio' | 'video', lang?: string) => Promise<Recording>;
  importFile: (mediaFile: File, subtitleFile?: File, lang?: string) => Promise<Recording>;
}

export function useRecordings(): UseRecordingsReturn {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch & Poll Recordings using useQuery
  const { data: recordings = [], isLoading, error: queryError } = useQuery<Recording[]>({
    queryKey: ['recordings'],
    queryFn: async () => {
      const response = await fetch('/api/recordings');
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Lỗi khi tải danh sách ghi âm');
      }

      const favorites = JSON.parse(localStorage.getItem('voicecraft_favorites') || '[]');
      return (data.recordings || []).map((rec: Recording) => ({
        ...rec,
        isFavorite: favorites.includes(rec.id),
        aiScore: rec.processing ? undefined : rec.aiScore
      }));
    },
    // Dynamically poll every 3 seconds if any recording is processing
    refetchInterval: (query) => {
      const hasProcessing = query.state.data?.some(r => r.processing);
      return hasProcessing ? 3000 : false;
    }
  });

  // Sync query error with state
  useEffect(() => {
    if (queryError) {
      setError((queryError as Error).message);
    } else {
      setError(null);
    }
  }, [queryError]);

  // Expose loadRecordings using refetchQueries
  const loadRecordings = useCallback(async () => {
    await queryClient.refetchQueries({ queryKey: ['recordings'] });
  }, [queryClient]);

  // Lưu bản ghi mới
  const saveRecording = async (wavBlob: Blob, transcript: string, customName: string, lang: string): Promise<Recording> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(wavBlob);

      reader.onloadend = async () => {
        try {
          let whisperKey = '';
          let openaiKey = '';
          let geminiKey = '';
          let geminiModel = 'gemini-2.0-flash';
          let openaiModel = 'gpt-4o-mini';
          let providerPreference = 'auto';
          try {
            const stored = localStorage.getItem('voicecraft_settings');
            if (stored) {
              const parsed = JSON.parse(stored);
              whisperKey = parsed.whisperKey || parsed.openaiKey || '';
              openaiKey = parsed.openaiKey || parsed.whisperKey || '';
              geminiKey = parsed.geminiKey || '';
              geminiModel = parsed.geminiModel || 'gemini-2.0-flash';
              openaiModel = parsed.openaiModel || 'gpt-4o-mini';
              providerPreference = parsed.providerPreference || 'auto';
            }
          } catch (e) {}

          const base64Audio = reader.result as string;
          const payload = {
            audioBase64: base64Audio,
            transcript,
            customName,
            language: lang,
            whisperKey,
            openaiKey,
            geminiKey,
            geminiModel,
            openaiModel,
            providerPreference
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
        await loadRecordings();
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
      let openaiKey = '';
      let geminiKey = '';
      let geminiModel = 'gemini-2.0-flash';
      let openaiModel = 'gpt-4o-mini';
      let providerPreference = 'auto';
      try {
        const stored = localStorage.getItem('voicecraft_settings');
        if (stored) {
          const parsed = JSON.parse(stored);
          whisperKey = parsed.whisperKey || parsed.openaiKey || '';
          openaiKey = parsed.openaiKey || parsed.whisperKey || '';
          geminiKey = parsed.geminiKey || '';
          geminiModel = parsed.geminiModel || 'gemini-2.0-flash';
          openaiModel = parsed.openaiModel || 'gpt-4o-mini';
          providerPreference = parsed.providerPreference || 'auto';
        }
      } catch (e) {}

      const response = await fetch(`/api/transcribe/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang, whisperKey, openaiKey, geminiKey, geminiModel, openaiModel, providerPreference })
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

    queryClient.setQueryData<Recording[]>(['recordings'], (old) => {
      if (!old) return [];
      return old.map(rec => {
        if (rec.id === id) {
          return { ...rec, isFavorite: !rec.isFavorite };
        }
        return rec;
      });
    });
  };

  // Import từ YouTube
  const importYouTube = async (url: string, mode: 'audio' | 'video', lang?: string): Promise<Recording> => {
    let whisperKey = '';
    let openaiKey = '';
    let geminiKey = '';
    let geminiModel = 'gemini-2.0-flash';
    let openaiModel = 'gpt-4o-mini';
    let providerPreference = 'auto';
    try {
      const stored = localStorage.getItem('voicecraft_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        whisperKey = parsed.whisperKey || parsed.openaiKey || '';
        openaiKey = parsed.openaiKey || parsed.whisperKey || '';
        geminiKey = parsed.geminiKey || '';
        geminiModel = parsed.geminiModel || 'gemini-2.0-flash';
        openaiModel = parsed.openaiModel || 'gpt-4o-mini';
        providerPreference = parsed.providerPreference || 'auto';
      }
    } catch (e) {}

    const payload = {
      url,
      mode,
      language: lang || 'en',
      whisperKey,
      openaiKey,
      geminiKey,
      geminiModel,
      openaiModel,
      providerPreference
    };

    const response = await fetch('/api/import-youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (data.success) {
      await loadRecordings();
      return data.recording;
    } else {
      throw new Error(data.error || 'Lỗi khi nhập bài học từ YouTube');
    }
  };

  // Import từ tệp âm thanh/video cục bộ
  const importFile = async (mediaFile: File, subtitleFile?: File, lang?: string): Promise<Recording> => {
    const mediaBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(mediaFile);
    });

    let subtitleText = '';
    if (subtitleFile) {
      subtitleText = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsText(subtitleFile);
      });
    }

    let whisperKey = '';
    let openaiKey = '';
    let geminiKey = '';
    let geminiModel = 'gemini-2.0-flash';
    let openaiModel = 'gpt-4o-mini';
    let providerPreference = 'auto';
    try {
      const stored = localStorage.getItem('voicecraft_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        whisperKey = parsed.whisperKey || parsed.openaiKey || '';
        openaiKey = parsed.openaiKey || parsed.whisperKey || '';
        geminiKey = parsed.geminiKey || '';
        geminiModel = parsed.geminiModel || 'gemini-2.0-flash';
        openaiModel = parsed.openaiModel || 'gpt-4o-mini';
        providerPreference = parsed.providerPreference || 'auto';
      }
    } catch (e) {}

    const payload = {
      mediaBase64,
      mediaName: mediaFile.name,
      subtitleText,
      language: lang || 'en-US',
      whisperKey,
      openaiKey,
      geminiKey,
      geminiModel,
      openaiModel,
      providerPreference
    };

    const response = await fetch('/api/import-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (data.success) {
      await loadRecordings();
      return data.recording;
    } else {
      throw new Error(data.error || 'Lỗi khi nhập tệp cục bộ');
    }
  };

  return {
    recordings,
    isLoading,
    error,
    loadRecordings,
    saveRecording,
    deleteRecording,
    reTranscribe,
    toggleFavorite,
    importYouTube,
    importFile
  };
}
