import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Volume2, Mic, Info, X } from 'lucide-react';
import { FeedbackPanel } from './FeedbackPanel';
import { WaveformComparison } from './WaveformComparison';
import { Recording } from '../../types';

interface ShadowingWorkspaceProps {
  lesson: Recording;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  reTranscribe: (id: string, lang: string) => Promise<void>;
}

export const ShadowingWorkspace: React.FC<ShadowingWorkspaceProps> = ({
  lesson,
  onClose,
  reTranscribe
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [isLoopActive, setIsLoopActive] = useState(false);
  const [isUserHovering, setIsUserHovering] = useState(false);

  // User Shadowing State
  const [isUserRecording, setIsUserRecording] = useState(false);
  const [userAttempted, setUserAttempted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  // Load lesson audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.src = `/recordings/${lesson.filename}`;
    audio.load();
    setCurrentTime(0);
    setUserAttempted(false);
    setIsUserRecording(false);

    audio.playbackRate = speed;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      syncKaraokeHighlight(audio.currentTime);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [lesson, speed]);

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
    }
  };

  // Double click tra từ điển
  const handleWordDblClick = async (word: string) => {
    const cleanWord = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
    if (!cleanWord) return;
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const entry = data[0];
        const phonetic = entry.phonetic || (entry.phonetics.find((p: { text?: string }) => p.text) || {}).text || '';
        const meaning = (entry.meanings[0] && entry.meanings[0].definitions[0]) ? entry.meanings[0].definitions[0].definition : '';
        alert(`📖 Từ điển [${cleanWord}] ${phonetic}:\n${meaning}`);
      } else {
        alert(`📖 Không tìm thấy định nghĩa cho: "${cleanWord}"`);
      }
    } catch (err) {
      alert(`Lỗi tra từ điển cho "${cleanWord}"`);
    }
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

    // Shadowing Loop (lặp câu)
    if (isLoopActive && audioRef.current) {
      if (time >= activeWord.end - 0.05) {
        audioRef.current.currentTime = activeWord.start;
      }
    }
  };

  // Start recording shadowing của user
  const handleStartUserRecording = () => {
    setIsUserRecording(true);
    setUserAttempted(false);
  };

  // Stop recording shadowing và chấm điểm
  const handleStopUserRecording = () => {
    setIsUserRecording(false);
    setUserAttempted(true);
    alert('🎉 Chúc mừng! AI đã chấm điểm bài Shadowing của bạn!');
  };

  const handleCopyText = () => {
    const fullText = sortedWords.map(w => w.word).join(' ');
    navigator.clipboard.writeText(fullText);
    alert('Đã copy toàn bộ văn bản bài học!');
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
            Bài học: <span className="text-accent font-semibold">{lesson.filename.replace('.wav', '')}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="px-3.5 py-1.5 rounded-lg bg-cardSecondary hover:bg-cardSecondary/80 border border-borderCustom text-sm font-semibold text-danger flex items-center gap-1.5 transition-colors"
        >
          <X className="w-4 h-4" /> Đóng Workspace
        </button>
      </div>

      {/* Global Learning Player Section */}
      <div className="p-5 rounded-2xl bg-card border border-borderCustom flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* HTML5 Audio Player */}
        <div className="flex-1 max-w-lg">
          <audio ref={audioRef} controls className="w-full h-10 select-none"></audio>
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
            onClick={() => setIsLoopActive(!isLoopActive)}
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
            onClick={() => {
              if (confirm('Bạn có muốn chạy lại AI bóc chữ cho bài học này không?')) {
                reTranscribe(lesson.id, 'en-US');
              }
            }}
            className="px-3 py-2 rounded-lg bg-cardSecondary hover:bg-cardSecondary/80 border border-borderCustom text-xs font-semibold text-textSecondary hover:text-white transition-colors"
          >
            🤖 AI Transcribe
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
      <div className="p-5 rounded-2xl bg-card border border-borderCustom space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-borderCustom/60">
          <span className="text-xs font-bold text-textMuted uppercase tracking-wider">Karaoke Sync Subtitle</span>
          <span className="text-[10px] text-textMuted flex items-center gap-1">
            <Info className="w-3 h-3 text-accent" /> Double click từ để dịch IPA
          </span>
        </div>

        {/* Words Container with auto scroll */}
        <div
          ref={transcriptRef}
          onMouseEnter={() => setIsUserHovering(true)}
          onMouseLeave={() => setIsUserHovering(false)}
          className="min-h-[140px] max-h-[220px] overflow-y-auto leading-relaxed text-lg py-2 select-none pr-1"
        >
          <div className="flex flex-wrap gap-x-1.5 gap-y-2">
            {sortedWords.map((w, idx) => {
              const isActive = currentTime >= w.start && currentTime <= w.end;
              return (
                <span
                  key={idx}
                  data-start={w.start}
                  onClick={() => handleWordClick(w.start)}
                  onDoubleClick={() => handleWordDblClick(w.word)}
                  className={`interactive-word ${
                    isActive ? 'active-word' : 'text-textSecondary/80'
                  }`}
                >
                  {w.word}
                </span>
              );
            })}
          </div>
        </div>
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
              onClick={() => setUserAttempted(false)}
              className="px-3 py-2 rounded-lg bg-cardSecondary hover:bg-cardSecondary/80 border border-borderCustom text-xs font-semibold text-textSecondary hover:text-white transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Retry
            </button>
          )}
        </div>
      </div>

      {/* Intonation & Waveform Pitch Comparison */}
      <WaveformComparison shadowingAttempted={userAttempted} />

      {/* Pronunciation evaluation AI Feedback */}
      <FeedbackPanel words={sortedWords} shadowingAttempted={userAttempted} />
    </div>
  );
};

// SVG Square icon inline helper
const SquareIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
  </svg>
);
