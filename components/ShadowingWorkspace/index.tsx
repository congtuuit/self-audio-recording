import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Volume2, Mic, X, BookOpen, Loader2 } from 'lucide-react';
import { FeedbackPanel } from './FeedbackPanel';
import { WaveformComparison } from './WaveformComparison';
import { Recording } from '../../types';
import { useDialog } from '../../context/DialogContext';

interface ShadowingWorkspaceProps {
  lesson: Recording;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  reTranscribe: (id: string, lang: string) => Promise<void>;
}

// Thuật toán so khớp từ để chấm điểm phát âm dựa trên giọng nói thực tế của người dùng
const evaluatePronunciation = (originalWords: any[], spokenText: string) => {
  const cleanSpoken = spokenText.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);

  const scoreWord = (origWord: string, idx: number) => {
    const cleanOrig = origWord.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!cleanOrig) return 95;

    if (cleanSpoken.length === 0) {
      return 35;
    }

    const windowSize = 5;
    const startSearch = Math.max(0, idx - windowSize);
    const endSearch = Math.min(cleanSpoken.length, idx + windowSize + 1);
    const searchArea = cleanSpoken.slice(startSearch, endSearch);

    if (searchArea.includes(cleanOrig)) {
      return 95;
    }

    const partialMatch = searchArea.some(spk => spk.includes(cleanOrig) || cleanOrig.includes(spk));
    if (partialMatch) {
      const lengthDelta = Math.abs(cleanOrig.length - (searchArea.find(spk => spk.includes(cleanOrig) || cleanOrig.includes(spk))?.length || cleanOrig.length));
      return lengthDelta <= 2 ? 78 : 70;
    }

    const firstLetterMatch = searchArea.some(spk => spk[0] === cleanOrig[0]);
    if (firstLetterMatch) {
      return 55;
    }

    return 42;
  };

  return originalWords.map((origW, idx) => ({
    ...origW,
    score: scoreWord(origW.word, idx)
  }));
};

export const ShadowingWorkspace: React.FC<ShadowingWorkspaceProps> = ({
  lesson,
  onClose,
  reTranscribe
}) => {
  const { alert: showAlert, confirm: showConfirm } = useDialog();
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [isLoopActive, setIsLoopActive] = useState(false);
  const [loopRange, setLoopRange] = useState<{ start: number; end: number } | null>(null);
  const [isTranscribingLesson, setIsTranscribingLesson] = useState(false);
  const [transcribeFinishedFlash, setTranscribeFinishedFlash] = useState(false);
  const [isUserHovering, setIsUserHovering] = useState(false);
  const speedRef = useRef(speed);

  // User Shadowing State
  const [isUserRecording, setIsUserRecording] = useState(false);
  const [userAttempted, setUserAttempted] = useState(false);

  const [originalPeaks, setOriginalPeaks] = useState<number[]>([]);
  const [userPeaks, setUserPeaks] = useState<number[]>([]);
  const [originalDuration, setOriginalDuration] = useState<number>(0);
  const [userDuration, setUserDuration] = useState<number>(0);

  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [evaluatedWords, setEvaluatedWords] = useState<any[]>([]);

  // Hover Dictionary & IPA state
  const [hoveredWordInfo, setHoveredWordInfo] = useState<{
    word: string;
    cleanWord: string;
    x: number;
    y: number;
  } | null>(null);
  const [dictCache, setDictCache] = useState<Record<string, { phonetic: string; meaning: string; loading: boolean }>>({});

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechRecognitionRef = useRef<any>(null);
  const recognitionTextRef = useRef<string>('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // Hàm trích xuất biên độ thực tế của file âm thanh (để vẽ waveform)
  const decodeAudioAndGetPeaks = async (audioUrlOrBlob: string | Blob, isOriginal: boolean) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();

      let arrayBuffer: ArrayBuffer;
      if (audioUrlOrBlob instanceof Blob) {
        arrayBuffer = await audioUrlOrBlob.arrayBuffer();
      } else {
        const response = await fetch(audioUrlOrBlob);
        const blob = await response.blob();
        arrayBuffer = await blob.arrayBuffer();
      }

      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const duration = audioBuffer.duration;

      if (isOriginal) {
        setOriginalDuration(duration);
      } else {
        setUserDuration(duration);
      }

      const rawData = audioBuffer.getChannelData(0);
      const samples = 42;
      const blockSize = Math.floor(rawData.length / samples);
      const peaks = [];

      for (let i = 0; i < samples; i++) {
        let max = 0;
        const start = i * blockSize;
        for (let j = 0; j < blockSize; j++) {
          const val = Math.abs(rawData[start + j]);
          if (val > max) max = val;
        }
        peaks.push(max);
      }

      const maxPeak = Math.max(...peaks) || 1;
      const normalizedPeaks = peaks.map(p => p / maxPeak);

      if (isOriginal) {
        setOriginalPeaks(normalizedPeaks);
      } else {
        setUserPeaks(normalizedPeaks);
      }

      await audioCtx.close();
    } catch (err) {
      console.error('Error decoding audio data for waveform:', err);
    }
  };

  // Load lesson audio & original waveform
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.src = lesson.hasVideo
      ? `/recordings/${lesson.id}/video.mp4`
      : `/recordings/${lesson.filename}`;
    audio.load();
    setCurrentTime(0);
    setUserAttempted(false);
    setIsUserRecording(false);
    setRecordedAudioUrl(null);
    setOriginalPeaks([]);
    setUserPeaks([]);
    setOriginalDuration(0);
    setUserDuration(0);
    setEvaluatedWords([]);
    setIsTranscribingLesson(false);
    setTranscribeFinishedFlash(false);
    audio.playbackRate = speedRef.current;

    // Tải thông tin biên độ sóng âm gốc
    decodeAudioAndGetPeaks(`/recordings/${lesson.filename}`, true);

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      syncKaraokeHighlight(audio.currentTime);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [lesson.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = speed;
  }, [speed]);

  // Sắp xếp các từ theo mốc thời gian tăng dần
  const sortedWords = React.useMemo(() => {
    return [...(lesson.words || [])].sort((a, b) => a.start - b.start);
  }, [lesson.words]);

  // Click-to-seek
  const handleWordClick = (start: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = start;
      if (audio.paused) {
        audio.play().catch(() => {});
      }

      // Nếu đang bật chế độ Loop Word, cập nhật khoảng loop cho từ được click
      if (isLoopActive) {
        const clickedWord = sortedWords.find(w => w.start === start);
        if (clickedWord) {
          setLoopRange({ start: clickedWord.start, end: clickedWord.end });
        }
      }
    }
  };

  // Hover tra từ điển & IPA
  const handleWordHover = async (e: React.MouseEvent<HTMLSpanElement>, rawWord: string) => {
    const cleanWord = rawWord.replace(/[^a-zA-Z]/g, '').toLowerCase();
    if (!cleanWord) return;

    const target = e.currentTarget;
    const container = transcriptRef.current;
    if (!container) return;

    const x = target.offsetLeft + target.offsetWidth / 2;
    const y = target.offsetTop + target.offsetHeight + 6 - container.scrollTop + container.offsetTop;

    setHoveredWordInfo({
      word: rawWord,
      cleanWord,
      x,
      y
    });

    if (!dictCache[cleanWord]) {
      // Ưu tiên đọc từ điển Anh - Việt được AI tiền xử lý theo bài học
      if (lesson.dictionary && lesson.dictionary[cleanWord]) {
        const aiItem = lesson.dictionary[cleanWord];
        const meaningText = aiItem.viMeaning
          ? `🇻🇳 ${aiItem.viMeaning}${aiItem.explanation ? ` — ${aiItem.explanation}` : ''}`
          : (aiItem.explanation || 'Từ vựng thuộc bài học.');

        setDictCache(prev => ({
          ...prev,
          [cleanWord]: {
            phonetic: aiItem.phonetic || '',
            meaning: meaningText,
            loading: false
          }
        }));
        return;
      }

      setDictCache(prev => ({ ...prev, [cleanWord]: { phonetic: '', meaning: '', loading: true } }));
      try {
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const entry = data[0];
          const phonetic = entry.phonetic || (entry.phonetics?.find((p: { text?: string }) => p.text) || {}).text || '';
          const meaning = (entry.meanings?.[0]?.definitions?.[0]?.definition) || 'Không có định nghĩa mẫu.';
          setDictCache(prev => ({
            ...prev,
            [cleanWord]: { phonetic, meaning, loading: false }
          }));
        } else {
          setDictCache(prev => ({
            ...prev,
            [cleanWord]: { phonetic: '', meaning: 'Không tìm thấy định nghĩa', loading: false }
          }));
        }
      } catch {
        setDictCache(prev => ({
          ...prev,
          [cleanWord]: { phonetic: '', meaning: 'Lỗi tra từ điển', loading: false }
        }));
      }
    }
  };

  const handleWordLeave = () => {
    setHoveredWordInfo(null);
  };

  // Karaoke Word highlight sync
  const syncKaraokeHighlight = (time: number) => {
    const activeWord = sortedWords.find(w => time >= w.start && time <= w.end);
    if (!activeWord || isUserHovering) return;

    // Tìm thẻ HTML tương ứng với từ active
    const container = transcriptRef.current;
    if (!container) return;

    const spanEl = container.querySelector(`[data-start="${activeWord.start}"]`) as HTMLElement;
    if (spanEl) {
      // Smart Auto-scroll: chỉ cuộn hộp transcript khi từ active đi ra ngoài viewport
      const containerRect = container.getBoundingClientRect();
      const spanRect = spanEl.getBoundingClientRect();

      const isAbove = spanRect.top < containerRect.top;
      const isBelow = spanRect.bottom > containerRect.bottom;

      if (isAbove || isBelow) {
        const scrollOffset = spanEl.offsetTop - container.offsetTop - (container.clientHeight / 3);
        container.scrollTo({ top: scrollOffset, behavior: 'auto' });
      }
    }

    // Shadowing Loop (lặp từ được chọn)
    if (isLoopActive && loopRange && audioRef.current) {
      if (time >= loopRange.end - 0.02) {
        audioRef.current.currentTime = loopRange.start;
      }
    }
  };

  // Bắt đầu ghi âm và nhận diện giọng nói thực tế của người dùng
  const handleStartUserRecording = async () => {
    audioChunksRef.current = [];
    setRecordedAudioUrl(null);
    setUserPeaks([]);
    setUserDuration(0);
    setUserAttempted(false);
    recognitionTextRef.current = '';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        setRecordedAudioUrl(url);

        // Phân tích biên độ & thời lượng của người dùng
        decodeAudioAndGetPeaks(blob, false);

        // Đánh giá phát âm
        const spokenText = recognitionTextRef.current.trim();
        const evaluated = evaluatePronunciation(sortedWords, spokenText);
        setEvaluatedWords(evaluated);

        // Tính điểm trung bình phát âm của lượt này
        const scores = evaluated.map(w => w.score || 0);
        const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

        // Ước tính thời lượng từ âm thanh người dùng
        setUserDuration(Number((blob.size / (44100 * 2)).toFixed(2)));

        // Lưu thông tin thực hành vào localStorage
        try {
          const attempt = {
            id: `${lesson.id}_${Date.now()}`,
            lessonId: lesson.id,
            filename: lesson.filename,
            timestamp: new Date().toISOString(),
            score: avgScore,
            duration: Number((blob.size / (44100 * 2)).toFixed(2)),
            wordsCount: sortedWords.length
          };
          const existing = JSON.parse(localStorage.getItem('voicecraft_shadow_attempts') || '[]');
          localStorage.setItem('voicecraft_shadow_attempts', JSON.stringify([...existing, attempt]));
        } catch (e) {
          console.error('Error saving shadowing attempt:', e);
        }

        // Tắt các luồng micro để giải phóng thiết bị
        stream.getTracks().forEach(track => track.stop());

        setIsUserRecording(false);
        setUserAttempted(true);
      };

      mediaRecorder.start();
      setIsUserRecording(true);

      // Khởi chạy Web Speech Recognition song song
      const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionAPI) {
        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = lesson.language || 'en-US';

        recognition.onresult = (event: any) => {
          let text = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              text += event.results[i][0].transcript + ' ';
            }
          }
          recognitionTextRef.current += text;
        };

        recognition.start();
        speechRecognitionRef.current = recognition;
      }
    } catch (err) {
      showAlert({
        title: 'Lỗi thiết bị',
        message: 'Không thể kết nối Microphone: ' + (err instanceof Error ? err.message : String(err)),
        type: 'error'
      });
    }
  };

  // Dừng ghi âm và nhận kết quả chấm điểm
  const handleStopUserRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
    }
  };

  const handleTranscribeLesson = async () => {
    if (isTranscribingLesson) return;

    const hasConfirmed = await showConfirm({
      title: 'Chạy lại AI bóc chữ',
      message: 'Bạn có muốn chạy lại AI bóc chữ cho bài học này không?',
      confirmLabel: 'Chạy lại',
      cancelLabel: 'Hủy'
    });

    if (!hasConfirmed) return;

    setIsTranscribingLesson(true);
    setTranscribeFinishedFlash(false);

    try {
      await reTranscribe(lesson.id, lesson.language || 'en-US');
      setTranscribeFinishedFlash(true);
      showAlert({
        title: 'AI transcript hoàn tất',
        message: 'Transcript bài học đã được cập nhật xong.',
        type: 'success'
      });
      window.setTimeout(() => setTranscribeFinishedFlash(false), 1800);
    } catch (err) {
      showAlert({
        title: 'AI transcript thất bại',
        message: err instanceof Error ? err.message : String(err),
        type: 'error'
      });
    } finally {
      setIsTranscribingLesson(false);
    }
  };

  const handleCopyText = () => {
    const fullText = sortedWords.map(w => w.word).join(' ');
    navigator.clipboard.writeText(fullText);
    showAlert({
      title: 'Clipboard',
      message: 'Đã copy toàn bộ văn bản bài học!',
      type: 'success'
    });
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="flex items-start justify-between pb-4 border-b border-borderCustom">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            🎓 Shadowing Workstation
          </h2>
          <p className="text-xs text-textMuted mt-1">
            Bài học: <span className="text-accent font-semibold">{lesson.id}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="px-3.5 py-1.5 rounded-lg bg-cardSecondary hover:bg-cardSecondary/80 border border-borderCustom text-sm font-semibold text-danger flex items-center gap-1.5 transition-colors"
        >
          <X className="w-4 h-4" /> Đóng Workspace
        </button>
      </div>

      {/* Video Container (Optional when lesson has video) */}
      {lesson.hasVideo && (
        <div className="flex justify-center p-3 rounded-2xl bg-card border border-borderCustom overflow-hidden">
          <video
            ref={audioRef as any}
            controls
            className="w-full max-w-2xl rounded-xl shadow-2xl bg-black aspect-video max-h-[360px]"
          />
        </div>
      )}

      {/* Global Learning Player Section */}
      <div className="p-5 rounded-2xl bg-card border border-borderCustom flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* HTML5 Audio/Video Player */}
        <div className="flex-1 max-w-lg">
          {!lesson.hasVideo ? (
            <audio ref={audioRef} controls className="w-full h-10 select-none"></audio>
          ) : (
            <div className="text-xs text-textMuted italic flex items-center gap-1.5 py-2">
              🎥 Đang chạy ở chế độ Video (điều khiển phát phía trên)
            </div>
          )}
        </div>

        {/* Action Options controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Speed Select */}
          <div className="flex items-center gap-1.5 text-xs text-textSecondary bg-cardSecondary border border-borderCustom px-3 py-2 rounded-lg font-semibold">
            <Volume2 className="w-3.5 h-3.5 text-textMuted" /> Tốc độ:
            <select
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="bg-transparent border-none text-white focus:outline-none cursor-pointer"
            >
              <option value="0.5" className="bg-card text-white">0.5x 🐢</option>
              <option value="1.0" className="bg-card text-white">1.0x ⚡</option>
              <option value="1.5" className="bg-card text-white">1.5x 🏎️</option>
              <option value="2.0" className="bg-card text-white">2.0x 🚀</option>
            </select>
          </div>

          {/* Shadowing Loop toggle */}
          <button
            onClick={() => {
              const nextLoopActive = !isLoopActive;
              setIsLoopActive(nextLoopActive);
              if (nextLoopActive && audioRef.current) {
                const time = audioRef.current.currentTime;
                const activeWord = sortedWords.find(w => time >= w.start && time <= w.end);
                if (activeWord) {
                  setLoopRange({ start: activeWord.start, end: activeWord.end });
                } else if (sortedWords.length > 0) {
                  setLoopRange({ start: sortedWords[0].start, end: sortedWords[0].end });
                }
              } else {
                setLoopRange(null);
              }
            }}
            className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              isLoopActive
                ? 'bg-danger/10 border-danger/30 text-danger glow-red'
                : 'bg-cardSecondary border-borderCustom text-textSecondary hover:text-white'
            }`}
          >
            🔂 Loop Word
          </button>

          {/* AI Transcribe trigger */}
          <button
            onClick={handleTranscribeLesson}
            disabled={isTranscribingLesson}
            className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 ${
              isTranscribingLesson
                ? 'bg-cardSecondary/70 border-borderCustom text-textMuted cursor-wait'
                : transcribeFinishedFlash
                ? 'bg-success/10 border-success/30 text-success shadow-[0_0_0_1px_rgba(34,197,94,0.18)]'
                : 'bg-cardSecondary hover:bg-cardSecondary/80 border-borderCustom text-textSecondary hover:text-white'
            }`}
          >
            {isTranscribingLesson ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Đang xử lý...
              </>
            ) : transcribeFinishedFlash ? (
              <>✅ AI Transcript Xong</>
            ) : (
              <>🤖 AI Transcribe</>
            )}
          </button>

          {/* Copy button */}
          <button
            onClick={handleCopyText}
            className="px-3 py-2 rounded-lg bg-cardSecondary hover:bg-cardSecondary/80 border border-borderCustom text-xs font-semibold text-textSecondary hover:text-white transition-colors"
          >
            📋 Copy Text
          </button>
        </div>
      </div>

      {/* Interactive Subtitles Karaoke Panel */}
      <div className="p-5 rounded-2xl bg-card border border-borderCustom space-y-3 relative">
        <div className="flex items-center justify-between pb-3 border-b border-borderCustom/60">
          <span className="text-xs font-bold text-textMuted uppercase tracking-wider">Karaoke Sync Subtitle</span>
          <span className="text-[10px] text-textMuted flex items-center gap-1">
            <BookOpen className="w-3 h-3 text-accent" /> Rê chuột (Hover) vào từ để xem IPA & Định nghĩa
          </span>
        </div>

        {/* Words Container with auto scroll */}
        <div
          ref={transcriptRef}
          onMouseEnter={() => setIsUserHovering(true)}
          onMouseLeave={() => {
            setIsUserHovering(false);
            handleWordLeave();
          }}
          className="min-h-[140px] max-h-[220px] overflow-y-auto leading-relaxed text-lg py-2 select-none pr-1 relative"
        >
          <div className="flex flex-wrap gap-x-1.5 gap-y-2">
            {sortedWords.map((w, idx) => {
              const isActive = currentTime >= w.start && currentTime <= w.end;
              const isPassed = currentTime > w.end;
              return (
                <span
                  key={idx}
                  data-start={w.start}
                  onClick={() => handleWordClick(w.start)}
                  onMouseEnter={(e) => handleWordHover(e, w.word)}
                  onMouseLeave={handleWordLeave}
                  className={`interactive-word ${
                    isActive
                      ? 'active-word'
                      : isPassed
                      ? 'text-white/95'
                      : 'text-textMuted/65'
                  }`}
                >
                  {w.word}
                </span>
              );
            })}
          </div>
        </div>

        {/* Floating Glassmorphic Tooltip on Word Hover */}
        <AnimatePresence>
          {hoveredWordInfo && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              style={{
                left: `${Math.max(10, Math.min(hoveredWordInfo.x - 120, 320))}px`,
                top: `${hoveredWordInfo.y}px`
              }}
              className="absolute z-40 w-60 p-3 rounded-xl bg-cardSecondary/95 border border-accent/40 shadow-2xl backdrop-blur-lg text-white pointer-events-none"
            >
              <div className="flex items-center justify-between gap-1 border-b border-borderCustom/60 pb-1.5 mb-1.5">
                <span className="text-xs font-bold text-accent capitalize flex items-center gap-1">
                  <BookOpen className="w-3 h-3 text-accent" />
                  {hoveredWordInfo.cleanWord}
                </span>
                {dictCache[hoveredWordInfo.cleanWord]?.phonetic ? (
                  <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                    {dictCache[hoveredWordInfo.cleanWord].phonetic}
                  </span>
                ) : null}
              </div>
              {dictCache[hoveredWordInfo.cleanWord]?.loading ? (
                <div className="text-[10px] text-textMuted flex items-center gap-1.5 py-1">
                  <span className="w-2 h-2 rounded-full bg-accent animate-ping"></span>
                  Đang tra IPA & từ điển...
                </div>
              ) : (
                <p className="text-[11px] text-textSecondary leading-snug line-clamp-3">
                  {dictCache[hoveredWordInfo.cleanWord]?.meaning || 'Không tìm thấy định nghĩa'}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* User Voice Capture Studio for Shadowing */}
      <div className="p-5 rounded-2xl bg-card border border-borderCustom flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
            <Mic className="w-4 h-4 text-accent" /> Practice Shadowing Now
          </h4>
          <p className="text-xs text-textMuted mt-0.5">Nhấn để ghi âm giọng nói của bạn luyện tập theo giọng bản xứ</p>
        </div>

        <div className="flex items-center gap-3">
          {recordedAudioUrl && (
            <button
              onClick={() => {
                const aud = new Audio(recordedAudioUrl);
                aud.play().catch(() => {});
              }}
              className="px-4 py-2 rounded-lg bg-accent/25 hover:bg-accent/35 border border-accent/40 text-accent text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
            >
              🔊 Replay My Voice
            </button>
          )}

          {!isUserRecording ? (
            <button
              onClick={handleStartUserRecording}
              className="px-4 py-2 rounded-lg bg-danger text-white text-xs font-semibold shadow-dangerGlow flex items-center gap-1.5 hover:bg-danger/90 transition-all"
            >
              <span className="w-2 h-2 rounded-full bg-white opacity-85 animate-ping"></span> Record Shadowing
            </button>
          ) : (
            <button
              onClick={handleStopUserRecording}
              className="px-4 py-2 rounded-lg bg-white text-black text-xs font-semibold flex items-center gap-1.5 hover:bg-white/90 transition-all shadow-xl"
            >
              <SquareIcon className="w-3.5 h-3.5 fill-black text-black" /> Stop & Score
            </button>
          )}

          {userAttempted && (
            <button
              onClick={() => {
                setUserAttempted(false);
                setRecordedAudioUrl(null);
                setUserPeaks([]);
                setUserDuration(0);
                setEvaluatedWords([]);
              }}
              className="px-3 py-2 rounded-lg bg-cardSecondary hover:bg-cardSecondary/80 border border-borderCustom text-xs font-semibold text-textSecondary hover:text-white transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Retry
            </button>
          )}
        </div>
      </div>

      {/* Intonation & Waveform Pitch Comparison */}
      <WaveformComparison
        shadowingAttempted={userAttempted}
        originalPeaks={originalPeaks}
        userPeaks={userPeaks}
        originalDuration={originalDuration}
        userDuration={userDuration}
      />

      {/* Pronunciation evaluation AI Feedback */}
      <FeedbackPanel words={userAttempted ? evaluatedWords : sortedWords} shadowingAttempted={userAttempted} />
    </div>
  );
};

// SVG Square icon inline helper
const SquareIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
  </svg>
);
