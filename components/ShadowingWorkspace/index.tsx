'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCcw, Volume2, Mic, X, BookOpen, Loader2, Play, Pause,
  Repeat, ArrowRight, Sparkles, Plus, Check, Copy, HelpCircle,
  VolumeX, ChevronLeft, ChevronRight, Bookmark, Landmark, BrainCircuit, RefreshCw
} from 'lucide-react';
import { FeedbackPanel } from './FeedbackPanel';
import { WaveformComparison } from './WaveformComparison';
import { Recording } from '../../types';
import { useDialog } from '../../context/DialogContext';
import { useI18n } from '../../context/I18nContext';
import { useQueryClient } from '@tanstack/react-query';

interface ShadowingWorkspaceProps {
  lesson: Recording;
  onClose: () => void;
  reTranscribe: (id: string, lang: string) => Promise<void>;
}

interface Sentence {
  id: number;
  text: string;
  words: any[];
  start: number;
  end: number;
}

// Group words into sentences based on punctuation and timestamp gaps
const segmentSentences = (words: any[]): Sentence[] => {
  const result: Sentence[] = [];
  let currentWords: any[] = [];
  let id = 1;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    currentWords.push(w);

    const isEndPunctuation = /[.?!]$/.test(w.word.trim());
    const nextWord = words[i + 1];
    const isTimeGap = nextWord ? (nextWord.start - w.end > 1.2) : false;

    if (isEndPunctuation || isTimeGap || i === words.length - 1) {
      const sentenceText = currentWords.map(cw => cw.word).join(' ');
      result.push({
        id,
        text: sentenceText,
        words: [...currentWords],
        start: currentWords[0].start,
        end: currentWords[currentWords.length - 1].end
      });
      id++;
      currentWords = [];
    }
  }
  return result;
};

// Local speech recognition evaluation
const evaluatePronunciation = (originalWords: any[], spokenText: string) => {
  const cleanSpoken = spokenText.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);

  const scoreWord = (origWord: string, idx: number) => {
    const cleanOrig = origWord.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!cleanOrig) return 95;

    if (cleanSpoken.length === 0) return 35;

    const windowSize = 5;
    const startSearch = Math.max(0, idx - windowSize);
    const endSearch = Math.min(cleanSpoken.length, idx + windowSize + 1);
    const searchArea = cleanSpoken.slice(startSearch, endSearch);

    if (searchArea.includes(cleanOrig)) return 95;

    const partialMatch = searchArea.some(spk => spk.includes(cleanOrig) || cleanOrig.includes(spk));
    if (partialMatch) {
      const lengthDelta = Math.abs(cleanOrig.length - (searchArea.find(spk => spk.includes(cleanOrig) || cleanOrig.includes(spk))?.length || cleanOrig.length));
      return lengthDelta <= 2 ? 78 : 70;
    }

    return searchArea.some(spk => spk[0] === cleanOrig[0]) ? 55 : 42;
  };

  return originalWords.map((origW, idx) => ({
    ...origW,
    score: scoreWord(origW.word, idx)
  }));
};

// Heuristics for the AI Coach panel based on active sentence text
const getAICoachContent = (sentenceText: string, lessonDict: any, sentenceAnalysis: Record<string, any> = {}) => {
  const text = sentenceText.trim();
  const lowerText = text.toLowerCase();
  const cleanLower = lowerText.replace(/[\n]/g, ' ').replace(/\s+/g, ' ').trim();

  let matchedAnalysis = null;
  const analysisArray = sentenceAnalysis.sentences || [];
  for (const item of analysisArray) {
    const k = (item.english || '').toLowerCase().trim();
    if (k && (cleanLower.startsWith(k.substring(0, 20)) || k.startsWith(cleanLower.substring(0, 20)))) {
      matchedAnalysis = item;
      break;
    }
  }

  let grammar = matchedAnalysis?.grammar || "Sử dụng cấu trúc câu trần thuật hoặc hội thoại cơ bản.";
  if (!matchedAnalysis) {
    if (lowerText.includes("want you to")) {
      grammar = "Cấu trúc 'want someone to do something' (muốn ai đó làm gì) nhằm nhấn mạnh yêu cầu lịch sự, trực tiếp.";
    } else if (lowerText.includes("believe that")) {
      grammar = "Mệnh đề danh từ 'believe that + clause' đóng vai trò làm tân ngữ chỉ suy nghĩ hoặc niềm tin.";
    } else if (lowerText.includes("more than")) {
      grammar = "So sánh hơn 'more than' được áp dụng để nhấn mạnh mức độ vượt trội của một hành động hay sự việc.";
    } else if (lowerText.includes("have to")) {
      grammar = "Động từ khuyết thiếu 'have to + V' chỉ nghĩa vụ mang tính khách quan (bắt buộc bởi hoàn cảnh ngoài ý muốn).";
    } else if (lowerText.includes("would like to")) {
      grammar = "Cấu trúc 'would like to + V' bày tỏ mong muốn một cách trang trọng, lịch thiệp hơn 'want'.";
    } else if (lowerText.includes("if you've")) {
      grammar = "Câu điều kiện hỗn hợp hoặc Loại 1 kết hợp thì Hiện tại hoàn thành để diễn đạt trải nghiệm cá nhân.";
    } else if (lowerText.includes("did not")) {
      grammar = "Phủ định ở thì Quá khứ đơn 'did not + V (nguyên thể)' chỉ một sự kiện đã chấm dứt hoàn toàn trong quá khứ.";
    }
  }

  const linkings: string[] = matchedAnalysis?.linkings || [];
  if (!matchedAnalysis) {
    if (lowerText.includes("find out")) linkings.push("find out -> Nối phụ âm /d/ sang nguyên âm /aʊ/ thành /faɪn-daʊt/.");
    if (lowerText.includes("want you")) linkings.push("want you -> Nối biến âm /t/ + /j/ thành âm /tʃ/ -> /wɑːn-tʃuː/.");
    if (lowerText.includes("would like")) linkings.push("would like -> Nuốt âm chặn /d/ ở 'would', chỉ chuẩn bị khẩu hình và phát âm 'like'.");
    if (lowerText.includes("of course")) linkings.push("of course -> Âm /f/ đọc nhẹ là /v/ rồi nối âm -> /əv-kɔːrs/.");
    if (lowerText.includes("have a")) linkings.push("have a -> Nối âm /v/ sang nguyên âm /ə/ thành /hæ-və/.");
    if (lowerText.includes("stress is")) linkings.push("stress is -> Nối âm xát /s/ sang nguyên âm /ɪ/ thành /stres-ɪz/.");
  }

  let shadowing = matchedAnalysis?.shadowing || "Hạ giọng ở cuối câu để tạo ngữ điệu tự nhiên. Ngắt nghỉ nhẹ trước các liên từ như and, but, because.";
  if (!matchedAnalysis) {
    if (text.endsWith("?")) {
      shadowing = "Câu hỏi Yes/No: Lên giọng ở cuối câu. Câu hỏi WH-: Hạ giọng ở cuối câu.";
    } else if (lowerText.includes("laughter") || text.includes("(")) {
      shadowing = "Lưu ý ngữ điệu kể chuyện dí dỏm: tăng tốc nhẹ ở các từ đệm và dừng khoảng 1 giây sau câu đùa.";
    }
  }

  let translation = matchedAnalysis?.translation || "Đang chuẩn bị bản dịch tiếng Việt...";
  if (!matchedAnalysis) {
    const transMap: Record<string, string> = {
      "i have a confession to make.": "Tôi có một lời thú nhận muốn gửi tới các bạn.",
      "but first, i want you to make a little confession to me.": "Nhưng trước tiên, tôi muốn các bạn cũng thú nhận với tôi một chút.",
      "in the past year, i want you to just raise your hand if you've experienced relatively little stress.": "Trong năm vừa qua, tôi muốn các bạn hãy giơ tay nếu bạn chỉ trải qua rất ít sự căng thẳng.",
      "anyone?": "Có ai không?",
      "how about a moderate amount of stress?": "Thế còn lượng áp lực vừa phải thì sao?",
      "who has experienced a lot of stress?": "Ai đã trải qua nhiều sự căng thẳng?",
      "yeah. me too. but that is not my confession.": "Vâng, tôi cũng vậy. Nhưng đó không phải lời thú nhận của tôi.",
      "my confession is this: i am a health psychologist, and my mission is to help people be happier and healthier.": "Lời thú nhận của tôi là thế này: Tôi là một nhà tâm lý học sức khỏe, và sứ mệnh của tôi là giúp mọi người sống hạnh phúc và khỏe mạnh hơn.",
      "but i fear that something i've been teaching for the last 10 years is doing more harm than good, and it has to do with stress.": "Nhưng tôi e sợ rằng những gì mình giảng dạy suốt 10 năm qua đang mang lại nhiều tác hại hơn là lợi ích, và nó có liên quan mật thiết đến sự căng thẳng."
    };
    for (const [k, v] of Object.entries(transMap)) {
      if (cleanLower.startsWith(k.substring(0, 20)) || k.startsWith(cleanLower.substring(0, 20))) {
        translation = v;
        break;
      }
    }
  }

  const vocab: any[] = [];
  const words = cleanLower.replace(/[^a-z\s]/g, '').split(/\s+/);
  const seen = new Set();

  for (const w of words) {
    if (seen.has(w) || w.length < 3) continue;
    seen.add(w);

    if (lessonDict && lessonDict[w]) {
      vocab.push({ word: w, ...lessonDict[w] });
    } else {
      const commonDict: Record<string, any> = {
        stress: { phonetic: "/stres/", viMeaning: "áp lực, căng thẳng" },
        confession: { phonetic: "/kənˈfeʃn/", viMeaning: "lời tự thú, thú nhận" },
        psychologist: { phonetic: "/saɪˈkɑːlədʒɪst/", viMeaning: "nhà tâm lý học" },
        harmful: { phonetic: "/ˈhɑːrmfl/", viMeaning: "có hại, độc hại" },
        health: { phonetic: "/helθ/", viMeaning: "sức khỏe" },
        resilience: { phonetic: "/rɪˈzɪliəns/", viMeaning: "sự kiên cường, phục hồi" },
        priority: { phonetic: "/praɪˈɔːrəti/", viMeaning: "sự ưu tiên" },
        management: { phonetic: "/ˈmænɪdʒmənt/", viMeaning: "sự quản lý, sắp xếp" },
        irony: { phonetic: "/ˈaɪrəni/", viMeaning: "sự trớ trêu, nghịch lý" }
      };
      if (commonDict[w]) {
        vocab.push({ word: w, ...commonDict[w] });
      }
    }
  }

  return { translation, grammar, linkings, shadowing, vocab };
};

const inFlightAudioFetches = new Map<string, Promise<Blob>>();

export const ShadowingWorkspace: React.FC<ShadowingWorkspaceProps> = ({
  lesson,
  onClose,
  reTranscribe
}) => {
  const { alert: showAlert, confirm: showConfirm } = useDialog();
  const { t } = useI18n();
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1.0);

  // Loops & playback options
  const [isLoopActive, setIsLoopActive] = useState(false); // Word loop
  const [loopRange, setLoopRange] = useState<{ start: number; end: number } | null>(null);
  const [isSentenceLoopActive, setIsSentenceLoopActive] = useState(false);
  const [isAutoPauseActive, setIsAutoPauseActive] = useState(false);
  const [hasAutoPaused, setHasAutoPaused] = useState<number | null>(null); // Track paused sentence ID
  const [isPlaying, setIsPlaying] = useState(false);

  // Transcribe loading
  const [isTranscribingLesson, setIsTranscribingLesson] = useState(false);
  const [transcribeFinishedFlash, setTranscribeFinishedFlash] = useState(false);

  // User Hovering State
  const [isUserHovering, setIsUserHovering] = useState(false);

  // User Shadowing State
  const [isUserRecording, setIsUserRecording] = useState(false);
  const [userAttempted, setUserAttempted] = useState(false);

  // Audio peaks
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

  // AI Coach Chat panel state
  const [aiQuery, setAiQuery] = useState('');
  const [aiChatHistory, setAiChatHistory] = useState<Record<number, { role: 'user' | 'assistant'; text: string }[]>>({});
  const [isAiResponding, setIsAiResponding] = useState(false);

  // Saved vocabulary state
  const [savedVocab, setSavedVocab] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('voicecraft_saved_vocab') || '[]');
    } catch {
      return [];
    }
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechRecognitionRef = useRef<any>(null);
  const recognitionTextRef = useRef<string>('');

  const audioRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null);
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);

  const speedRef = useRef(speed);
  // Sentence analysis state
  const [sentenceAnalysis, setSentenceAnalysis] = useState<Record<string, any>>(lesson.sentenceAnalysis || { sentences: [] });
  const [isAnalyzingSentences, setIsAnalyzingSentences] = useState(false);
  const queryClient = useQueryClient();
  const analyzingLessonIdRef = useRef<string | null>(null); // Track active request
  const analysisFetchedRef = useRef<Set<string>>(new Set());



  // Refs for high-frequency audio polling
  const isLoopActiveRef = useRef(isLoopActive);
  const loopRangeRef = useRef(loopRange);
  const isSentenceLoopActiveRef = useRef(isSentenceLoopActive);
  const isAutoPauseActiveRef = useRef(isAutoPauseActive);
  const hasAutoPausedRef = useRef(hasAutoPaused);

  useEffect(() => { isLoopActiveRef.current = isLoopActive; }, [isLoopActive]);
  useEffect(() => { loopRangeRef.current = loopRange; }, [loopRange]);
  useEffect(() => { isSentenceLoopActiveRef.current = isSentenceLoopActive; }, [isSentenceLoopActive]);
  useEffect(() => { isAutoPauseActiveRef.current = isAutoPauseActive; }, [isAutoPauseActive]);
  useEffect(() => { hasAutoPausedRef.current = hasAutoPaused; }, [hasAutoPaused]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // Decode audio peaks
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
    setIsPlaying(false);
    setHasAutoPaused(null);
    audio.playbackRate = speedRef.current;

    let active = true;
    let audioObjectUrl: string | null = null;

    const loadSource = async () => {
      try {
        const audioUrl = `/recordings/${lesson.filename}`;

        // Fetch audio file once (coalesced via inFlightAudioFetches map)
        let fetchPromise = inFlightAudioFetches.get(lesson.filename);
        if (!fetchPromise) {
          fetchPromise = fetch(audioUrl)
            .then(res => {
              if (!res.ok) throw new Error('Failed to fetch audio file');
              return res.blob();
            })
            .finally(() => {
              inFlightAudioFetches.delete(lesson.filename);
            });
          inFlightAudioFetches.set(lesson.filename, fetchPromise);
        }

        const blob = await fetchPromise;
        if (!active) return;

        // 1. Decode peaks directly using the fetched Blob (0 network requests!)
        decodeAudioAndGetPeaks(blob, true);

        // 2. Set player source
        if (lesson.hasVideo) {
          audio.src = `/recordings/${lesson.id}/video.mp4`;
        } else {
          // For audio-only lessons, use Object URL to reuse the fetched Blob
          audioObjectUrl = URL.createObjectURL(blob);
          audio.src = audioObjectUrl;
        }
        audio.load();
      } catch (err) {
        console.error('Error loading audio source:', err);
        // Fallback on error
        if (active) {
          audio.src = lesson.hasVideo
            ? `/recordings/${lesson.id}/video.mp4`
            : `/recordings/${lesson.filename}`;
          audio.load();
          decodeAudioAndGetPeaks(`/recordings/${lesson.filename}`, true);
        }
      }
    };

    loadSource();

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      active = false;
      if (audioObjectUrl) {
        URL.revokeObjectURL(audioObjectUrl);
      }
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [lesson.id]);

  useEffect(() => {
    const audio = audioRef.current;
    speedRef.current = speed;
    if (!audio) return;
    audio.playbackRate = speed;
  }, [speed]);

  const sortedWords = useMemo(() => {
    return [...(lesson.words || [])].sort((a, b) => a.start - b.start);
  }, [lesson.words]);

  const sentences = useMemo(() => {
    return segmentSentences(sortedWords);
  }, [sortedWords]);

  // Keep track of active sentence index
  const activeSentence = useMemo(() => {
    return sentences.find(s => currentTime >= s.start && currentTime <= s.end) || null;
  }, [sentences, currentTime]);

  const [lastActiveSentenceId, setLastActiveSentenceId] = useState<number | null>(null);
  useEffect(() => {
    if (activeSentence) {
      setLastActiveSentenceId(activeSentence.id);
    }
  }, [activeSentence]);

  const activeSentenceId = lastActiveSentenceId || (sentences.length > 0 ? sentences[0].id : null);
  const currentSentence = useMemo(() => {
    return sentences.find(s => s.id === activeSentenceId) || null;
  }, [sentences, activeSentenceId]);

  // Sync sentenceAnalysis state when lesson changes
  useEffect(() => {
    setSentenceAnalysis(lesson.sentenceAnalysis || { sentences: [] });
  }, [lesson.id, lesson.sentenceAnalysis]);

  // One-time full-lesson analysis on load (if not already analyzed)
  useEffect(() => {
    if (sentenceAnalysis.sentences && sentenceAnalysis.sentences.length > 0) {
      return;
    }

    if (sentences.length === 0) return;

    // Prevent duplicate active requests for the same lesson
    if (analyzingLessonIdRef.current === lesson.id) {
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;
    let pollTimeoutId: any = null;

    const triggerFullLessonAnalysis = async () => {
      analyzingLessonIdRef.current = lesson.id;
      setIsAnalyzingSentences(true);
      try {
        const stored = localStorage.getItem('voicecraft_settings');
        let apiKey = '';
        let modelName = '';
        let customUrl = '';
        let provider = 'auto';

        if (stored) {
          const parsed = JSON.parse(stored);
          provider = parsed.providerPreference || 'auto';
          customUrl = parsed.customEndpointUrl || '';
          if (provider === 'gemini') {
            apiKey = parsed.geminiKey || '';
            modelName = parsed.geminiModel || '';
          } else if (provider === 'custom') {
            apiKey = parsed.customEndpointKey || '';
            modelName = parsed.customEndpointModel || '';
          } else {
            apiKey = parsed.openaiKey || parsed.whisperKey || '';
            modelName = parsed.openaiModel || 'gpt-4o-mini';
          }
        }

        const res = await fetch('/api/analyze-lesson', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: lesson.id,
            apiKey,
            modelName,
            customUrl,
            provider,
            sentences: sentences.map(s => s.text)
          }),
          signal // Pass abort signal to fetch
        });

        const data = await res.json();

        if (data.sentenceAnalysis && !signal.aborted) {
          setSentenceAnalysis(data.sentenceAnalysis);
        }

        if (data.status === 'processing' && !signal.aborted) {
          // If still processing, poll again in 3 seconds
          pollTimeoutId = setTimeout(() => {
            triggerFullLessonAnalysis();
          }, 3000);
        } else {
          // Done, errored, or completed
          setIsAnalyzingSentences(false);
          if (data.status === 'completed') {
            // Invalidate the recordings query so the cache is updated with the completed sentenceAnalysis
            queryClient.invalidateQueries({ queryKey: ['recordings'] });
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('[Analyze] Fetch aborted.');
          return;
        }
        console.error('Error fetching full lesson analysis:', err);
        // Clear lock on failure so it can be retried
        analyzingLessonIdRef.current = null;
        setIsAnalyzingSentences(false);
      }
    };

    triggerFullLessonAnalysis();

    // Cleanup: Abort outstanding requests and clear timeouts when switching lessons or unmounting
    return () => {
      controller.abort();
      if (pollTimeoutId) {
        clearTimeout(pollTimeoutId);
      }
    };
  }, [lesson.id, sentences]);

  const currentSentenceRef = useRef(currentSentence);
  useEffect(() => { currentSentenceRef.current = currentSentence; }, [currentSentence]);

  // Derived coach content based on active sentence
  const coachData = currentSentence ? getAICoachContent(currentSentence.text, lesson.dictionary, sentenceAnalysis) : null;

  // Auto-scroll logic
  useEffect(() => {
    if (!activeSentenceId || isUserHovering) return;
    const container = transcriptContainerRef.current;
    if (!container) return;

    const activeCard = container.querySelector(`[data-sentence-id="${activeSentenceId}"]`) as HTMLElement;
    if (activeCard) {
      const containerRect = container.getBoundingClientRect();
      const cardRect = activeCard.getBoundingClientRect();

      const isAbove = cardRect.top < containerRect.top + 20;
      const isBelow = cardRect.bottom > containerRect.bottom - 20;

      if (isAbove || isBelow) {
        const scrollOffset = activeCard.offsetTop - container.offsetTop - (container.clientHeight / 3);
        container.scrollTo({ top: scrollOffset, behavior: 'smooth' });
      }
    }
  }, [activeSentenceId, isUserHovering]);

  // High-frequency polling for loops & auto-pause
  useEffect(() => {
    let animationFrameId: number;
    const checkAudioTime = () => {
      const audio = audioRef.current;
      if (audio && !audio.paused) {
        const time = audio.currentTime;

        // 1. Word loop logic (Highest Priority)
        if (isLoopActiveRef.current && loopRangeRef.current) {
          if (time >= loopRangeRef.current.end - 0.02) {
            audio.currentTime = loopRangeRef.current.start;
          }
        }
        // 2. Auto-pause logic
        else if (isAutoPauseActiveRef.current && currentSentenceRef.current && hasAutoPausedRef.current !== currentSentenceRef.current.id) {
          if (time >= currentSentenceRef.current.end - 0.02) {
            audio.pause();
            setHasAutoPaused(currentSentenceRef.current.id);
          }
        }
        // 3. Sentence loop logic
        else if (isSentenceLoopActiveRef.current && currentSentenceRef.current) {
          if (time >= currentSentenceRef.current.end - 0.02) {
            audio.currentTime = currentSentenceRef.current.start;
          }
        }
      }
      animationFrameId = requestAnimationFrame(checkAudioTime);
    };
    animationFrameId = requestAnimationFrame(checkAudioTime);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  useEffect(() => {
    // Reset auto-paused trigger if we move into a new segment range
    if (activeSentence && hasAutoPaused === activeSentence.id && currentTime < activeSentence.start) {
      setHasAutoPaused(null);
    }
  }, [currentTime, activeSentence, hasAutoPaused]);

  // Click-to-seek
  const handleWordClick = (start: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = start;
      if (audio.paused) {
        audio.play().catch(() => {});
      }

      if (isLoopActive) {
        const clickedWord = sortedWords.find(w => w.start === start);
        if (clickedWord) {
          setLoopRange({ start: clickedWord.start, end: clickedWord.end });
        }
      }
    }
  };

  // Sentence-level Play/Replay action
  const handlePlaySentence = (sentence: Sentence) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = sentence.start;
      setHasAutoPaused(null);
      if (audio.paused) {
        audio.play().catch(() => {});
      }
    }
  };

  // Hover tra từ điển & IPA
  const handleWordHover = async (e: React.MouseEvent<HTMLSpanElement>, rawWord: string) => {
    const cleanWord = rawWord.replace(/[^a-zA-Z]/g, '').toLowerCase();
    if (!cleanWord) return;

    const target = e.currentTarget;
    const container = transcriptContainerRef.current;
    if (!container) return;

    const x = target.offsetLeft + target.offsetWidth / 2;
    const y = target.offsetTop + target.offsetHeight + 6 - container.scrollTop + container.offsetTop;

    setHoveredWordInfo({ word: rawWord, cleanWord, x, y });

    if (!dictCache[cleanWord]) {
      if (lesson.dictionary && lesson.dictionary[cleanWord]) {
        const aiItem = lesson.dictionary[cleanWord];
        const meaningText = aiItem.viMeaning
          ? `🇻🇳 ${aiItem.viMeaning}${aiItem.explanation ? ` — ${aiItem.explanation}` : ''}`
          : (aiItem.explanation || 'Từ vựng thuộc bài học.');

        setDictCache(prev => ({
          ...prev,
          [cleanWord]: { phonetic: aiItem.phonetic || '', meaning: meaningText, loading: false }
        }));
        return;
      }

      setDictCache(prev => ({ ...prev, [cleanWord]: { phonetic: '', meaning: '', loading: true } }));
      try {
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const entry = data[0];
          const phonetic = entry.phonetic || (entry.phonetics?.find((p: any) => p.text) || {}).text || '';
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

  // User Voice Capture
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
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        setRecordedAudioUrl(url);

        decodeAudioAndGetPeaks(blob, false);

        const spokenText = recognitionTextRef.current.trim();
        const evaluated = evaluatePronunciation(sortedWords, spokenText);
        setEvaluatedWords(evaluated);

        const scores = evaluated.map(w => w.score || 0);
        const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        setUserDuration(Number((blob.size / (44100 * 2)).toFixed(2)));

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

        stream.getTracks().forEach(track => track.stop());
        setIsUserRecording(false);
        setUserAttempted(true);
      };

      mediaRecorder.start();
      setIsUserRecording(true);

      const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionAPI) {
        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = lesson.language || 'en-US';

        recognition.onresult = (event: any) => {
          let text = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) text += event.results[i][0].transcript + ' ';
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

  const handleStopUserRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
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

  const handleCopySentenceText = (sentence: Sentence) => {
    navigator.clipboard.writeText(sentence.text);
    showAlert({
      title: 'Clipboard',
      message: 'Đã copy văn bản câu!',
      type: 'success'
    });
  };

  // Toggle saving key vocab words
  const handleToggleSaveVocab = (word: string) => {
    const clean = word.toLowerCase().replace(/[^a-z]/g, '');
    let updated;
    if (savedVocab.includes(clean)) {
      updated = savedVocab.filter(v => v !== clean);
    } else {
      updated = [...savedVocab, clean];
    }
    setSavedVocab(updated);
    localStorage.setItem('voicecraft_saved_vocab', JSON.stringify(updated));
  };

  // Focus AI Coach Panel with a selected sentence
  const handleAskAICoach = (sentence: Sentence) => {
    setLastActiveSentenceId(sentence.id);
    const aiTextarea = document.getElementById('ai-coach-input');
    if (aiTextarea) {
      aiTextarea.focus();
    }
  };

  // Simulating AI Coach interactive answers
  const handleSendAiQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim() || !currentSentence) return;

    const userText = aiQuery;
    setAiQuery('');

    const currentHist = aiChatHistory[currentSentence.id] || [];
    const updatedWithUser = [...currentHist, { role: 'user' as const, text: userText }];
    setAiChatHistory(prev => ({ ...prev, [currentSentence.id]: updatedWithUser }));

    setIsAiResponding(true);

    // Dynamic mock response simulating ChatGPT coach
    setTimeout(() => {
      let coachResponse = `Coach AI: Về câu "${currentSentence.text}", câu hỏi "${userText}" là một thắc mắc rất hay. `;
      const cleanQuery = userText.toLowerCase();

      if (cleanQuery.includes('dịch') || cleanQuery.includes('nghĩa')) {
        coachResponse += `Cả câu này dịch nghĩa là: "${getAICoachContent(currentSentence.text, lesson.dictionary, sentenceAnalysis).translation}".`;
      } else if (cleanQuery.includes('phát âm') || cleanQuery.includes('đọc')) {
        coachResponse += `Về phát âm, câu này có các từ quan trọng cần nhấn trọng âm là: ${currentSentence.words.slice(0, 3).map(w => w.word).join(', ')}. Hãy chú ý các nối âm liaisons như: ${getAICoachContent(currentSentence.text, lesson.dictionary, sentenceAnalysis).linkings.join(' hoặc ')}.`;
      } else if (cleanQuery.includes('ngữ pháp') || cleanQuery.includes('cấu trúc')) {
        coachResponse += `Về ngữ pháp: ${getAICoachContent(currentSentence.text, lesson.dictionary, sentenceAnalysis).grammar}`;
      } else {
        coachResponse += `Trong ngữ cảnh này, bạn hãy chú ý cách ngắt nhịp (intonation) sau các từ khóa quan trọng và rèn luyện Shadowing ở tốc độ 1.0x để bắt kịp tốc độ nói tự nhiên của người bản xứ.`;
      }

      setAiChatHistory(prev => ({
        ...prev,
        [currentSentence.id]: [...updatedWithUser, { role: 'assistant' as const, text: coachResponse }]
      }));
      setIsAiResponding(false);
    }, 1200);
  };

  // AI Content for right coach panel
  const coachContent = useMemo(() => {
    if (!currentSentence) return null;
    return getAICoachContent(currentSentence.text, lesson.dictionary, sentenceAnalysis);
  }, [currentSentence, lesson.dictionary, sentenceAnalysis]);

  // Overall progress
  const progressPercent = useMemo(() => {
    if (sentences.length === 0) return 0;
    return Math.round(((currentSentence?.id || 1) / sentences.length) * 100);
  }, [sentences, currentSentence]);

  return (
    <div className="space-y-6 relative pb-32">
      {/* Workspace Header */}
      <div className="flex items-start justify-between pb-4 border-b border-borderCustom">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            🎓 {t('workspace.studioTitle')}
          </h2>
          <p className="text-xs text-textMuted mt-1">
            {t('workspace.course')}: <span className="text-accent font-semibold">{lesson.videoTitle || lesson.id}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="px-3.5 py-1.5 rounded-lg bg-cardSecondary hover:bg-cardSecondary/80 border border-borderCustom text-sm font-semibold text-danger flex items-center gap-1.5 transition-colors"
        >
          <X className="w-4 h-4" /> {t('workspace.close')}
        </button>
      </div>

      {/* Main Dual-Column Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
        {/* LEFT COLUMN: Media, Progress, and Sentence Cards */}
        <div className="space-y-6">
          {/* Progress Banner */}
          <div className="p-4 rounded-xl bg-card border border-borderCustom flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs font-bold text-textSecondary uppercase tracking-wider">
              <span>{t('workspace.learning')}: {currentSentence?.id || 1} / {sentences.length}</span>
              <span className="text-accent">{progressPercent}% {t('workspace.completed')}</span>
            </div>
            <div className="w-full h-2 bg-cardSecondary rounded-full overflow-hidden border border-borderCustom">
              <motion.div
                className="h-full bg-accent"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          {/* YouTube Video / Waveform Header (Fixed 220px-280px Height on Desktop) */}
          {lesson.hasVideo ? (
            <div className="flex justify-center p-2 rounded-2xl bg-card border border-accent/20 overflow-hidden max-h-[260px] relative shadow-lg">
              <video
                ref={audioRef as any}
                controls
                className="w-full max-w-xl rounded-xl shadow-xl bg-black aspect-video max-h-[240px]"
              />
            </div>
          ) : (
            <div className="hidden">
              <audio ref={audioRef as any} controls className="w-full h-10 select-none"></audio>
            </div>
          )}

          {/* Sentence Cards Transcript Area */}
          <div
            ref={transcriptContainerRef}
            onMouseEnter={() => setIsUserHovering(true)}
            onMouseLeave={() => {
              setIsUserHovering(false);
              handleWordLeave();
            }}
            className="space-y-4 max-h-[500px] overflow-y-auto pr-1"
          >
            {sentences.map((sentence) => {
              const isActive = activeSentenceId === sentence.id;

              return (
                <motion.div
                  key={sentence.id}
                  data-sentence-id={sentence.id}
                  layout
                  className={`group p-4 rounded-2xl border transition-all duration-200 ${
                    isActive
                      ? 'bg-accent/5 border-accent/60 shadow-[0_0_12px_rgba(108,99,255,0.1)]'
                      : 'bg-card/50 border-borderCustom hover:border-accent/25'
                  }`}
                >
                  <div className="flex justify-between items-start gap-4 mb-2">
                    {/* Timestamp Badge */}
                    <button
                      onClick={() => handlePlaySentence(sentence)}
                      className="px-2 py-0.5 rounded bg-cardSecondary border border-borderCustom text-[10px] font-mono text-accent font-semibold hover:border-accent/40"
                    >
                      {new Date(sentence.start * 1000).toISOString().substr(14, 5)}
                    </button>

                    {/* Sentence Action Toolbar */}
                    <div className="flex items-center gap-2 opacity-65 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handlePlaySentence(sentence)}
                        className="p-1 rounded hover:bg-cardSecondary text-textSecondary hover:text-white"
                        title="Replay Sentence"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setIsSentenceLoopActive(!isSentenceLoopActive);
                          setLastActiveSentenceId(sentence.id);
                        }}
                        className={`p-1 rounded hover:bg-cardSecondary ${isSentenceLoopActive && isActive ? 'text-accent' : 'text-textSecondary hover:text-white'}`}
                        title="Loop Sentence"
                      >
                        <Repeat className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleAskAICoach(sentence)}
                        className="p-1 rounded hover:bg-cardSecondary text-textSecondary hover:text-white"
                        title="Ask AI Coach"
                      >
                        <BrainCircuit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleCopySentenceText(sentence)}
                        className="p-1 rounded hover:bg-cardSecondary text-textSecondary hover:text-white"
                        title="Copy Sentence"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Karaoke Word-by-Word Container */}
                  <div className="flex flex-wrap gap-x-1 gap-y-1.5 text-base md:text-lg leading-relaxed select-none">
                    {sentence.words.map((w, idx) => {
                      const isWordActive = currentTime >= w.start && currentTime <= w.end;
                      const isWordPassed = currentTime > w.end;
                      const isSaved = savedVocab.includes(w.word.toLowerCase().replace(/[^a-z]/g, ''));

                      return (
                        <span
                          key={idx}
                          data-start={w.start}
                          onClick={() => handleWordClick(w.start)}
                          onMouseEnter={(e) => handleWordHover(e, w.word)}
                          onMouseLeave={handleWordLeave}
                          className={`interactive-word font-medium rounded px-1 cursor-pointer transition-colors ${
                            isWordActive
                              ? 'active-word text-white'
                              : isWordPassed
                              ? 'text-white/90 font-medium'
                              : 'text-textMuted/60 font-medium'
                          } ${isSaved ? 'underline decoration-accent/60 underline-offset-4' : ''}`}
                        >
                          {w.word}
                        </span>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
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
                className="absolute z-40 w-64 p-3.5 rounded-xl bg-cardSecondary/95 border border-accent/40 shadow-2xl backdrop-blur-lg text-white pointer-events-auto"
              >
                <div className="flex items-center justify-between gap-1 border-b border-borderCustom/60 pb-1.5 mb-1.5">
                  <span className="text-xs font-bold text-accent capitalize flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-accent" />
                    {hoveredWordInfo.cleanWord}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {dictCache[hoveredWordInfo.cleanWord]?.phonetic && (
                      <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                        {dictCache[hoveredWordInfo.cleanWord].phonetic}
                      </span>
                    )}
                    <button
                      onClick={() => handleToggleSaveVocab(hoveredWordInfo.cleanWord)}
                      className="p-0.5 rounded hover:bg-card border border-borderCustom text-[10px]"
                      title="Lưu từ vựng"
                    >
                      <Bookmark className={`w-3 h-3 ${savedVocab.includes(hoveredWordInfo.cleanWord) ? 'fill-accent text-accent' : 'text-textMuted'}`} />
                    </button>
                  </div>
                </div>
                {dictCache[hoveredWordInfo.cleanWord]?.loading ? (
                  <div className="text-[10px] text-textMuted flex items-center gap-1.5 py-1">
                    <span className="w-2 h-2 rounded-full bg-accent animate-ping"></span>
                    {t('workspace.loadingDict')}
                  </div>
                ) : (
                  <p className="text-[11px] text-textSecondary leading-snug">
                    {dictCache[hoveredWordInfo.cleanWord]?.meaning || t('workspace.noDefinition')}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT COLUMN: Permanent AI Coach Panel */}
        <div className="lg:sticky lg:top-6 bg-card/65 border border-borderCustom rounded-2xl p-5 space-y-5 glass-panel max-h-[calc(100vh-140px)] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-borderCustom">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" /> AI Study Coach Panel
            </h3>
            <span className="text-[9px] px-2 py-0.5 rounded bg-accent/20 text-accent font-bold uppercase tracking-wider">
              {t('workspace.realtime')}
            </span>
          </div>

          {currentSentence ? (
            <div className="space-y-4 text-xs">
              {/* Active Sentence Reference */}
              <div className="p-3 bg-cardSecondary rounded-xl border border-borderCustom/60 italic text-textSecondary font-semibold">
                "{currentSentence.text}"
              </div>

              {/* Translation section */}
              <div className="space-y-1">
                <span className="font-bold text-accent uppercase tracking-wider text-[10px]">🇻🇳 {t('workspace.translation')}:</span>
                <p className="text-white leading-relaxed font-semibold bg-accent/5 p-2 rounded-lg border border-accent/15">
                  {coachContent?.translation}
                </p>
              </div>

              {/* Grammar focus */}
              <div className="space-y-1">
                <span className="font-bold text-success uppercase tracking-wider text-[10px]">📘 {t('workspace.grammar')}:</span>
                <p className="text-textSecondary leading-relaxed bg-success/5 p-2 rounded-lg border border-success/15 font-semibold">
                  {coachContent?.grammar}
                </p>
              </div>

              {/* Pronunciation & linkings */}
              {coachContent?.linkings && coachContent.linkings.length > 0 && (
                <div className="space-y-1">
                  <span className="font-bold text-amber-500 uppercase tracking-wider text-[10px]">🗣️ {t('workspace.pronunciation')}:</span>
                  <div className="space-y-1 font-semibold bg-amber-500/5 p-2 rounded-lg border border-amber-500/15">
                    {coachContent.linkings.map((l, i) => (
                      <div key={i} className="text-textSecondary">• {l}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Shadowing focus */}
              <div className="space-y-1">
                <span className="font-bold text-sky-400 uppercase tracking-wider text-[10px]">🔁 Shadowing Tips:</span>
                <p className="text-textSecondary leading-relaxed bg-sky-400/5 p-2 rounded-lg border border-sky-400/15 font-semibold">
                  {coachContent?.shadowing}
                </p>
              </div>

              {/* Lesson Dictionary vocab items */}
              {coachContent?.vocab && coachContent.vocab.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="font-bold text-textSecondary uppercase tracking-wider text-[10px]">📚 {t('workspace.vocab')}:</span>
                  <div className="grid grid-cols-1 gap-2">
                    {coachContent.vocab.map((v, i) => (
                      <div key={i} className="flex justify-between items-start p-2 rounded-lg bg-cardSecondary border border-borderCustom/60 font-semibold">
                        <div>
                          <span className="text-accent font-bold">{v.word}</span>
                          <span className="text-[10px] text-emerald-400 ml-1.5 font-mono">{v.phonetic}</span>
                        </div>
                        <span className="text-[10px] text-textSecondary">{v.viMeaning}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Interactive Coach Q&A Box */}
              <div className="pt-3 border-t border-borderCustom/60 space-y-3">
                <span className="font-bold text-textSecondary uppercase tracking-wider text-[10px]">💬 {t('workspace.askAi')}:</span>

                {/* Simulated chat thread */}
                {aiChatHistory[currentSentence.id] && aiChatHistory[currentSentence.id].length > 0 && (
                  <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1 bg-cardSecondary/40 p-2 rounded-lg border border-borderCustom">
                    {aiChatHistory[currentSentence.id].map((chat, idx) => (
                      <div
                        key={idx}
                        className={`p-1.5 rounded text-[10px] font-semibold ${
                          chat.role === 'user'
                            ? 'bg-accent/10 border-accent/20 border text-right'
                            : 'bg-cardSecondary border border-borderCustom/60'
                        }`}
                      >
                        {chat.text}
                      </div>
                    ))}
                    {isAiResponding && (
                      <div className="text-[10px] text-textMuted animate-pulse">AI Coach đang trả lời...</div>
                    )}
                  </div>
                )}

                <form onSubmit={handleSendAiQuery} className="flex gap-2">
                  <input
                    id="ai-coach-input"
                    type="text"
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    placeholder="Hỏi AI về từ vựng, ngữ pháp, ngữ điệu..."
                    className="flex-1 bg-cardSecondary border border-borderCustom rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-textMuted focus:outline-none focus:border-accent"
                  />
                  <button
                    type="submit"
                    className="p-1.5 rounded-lg bg-accent hover:bg-accent/80 text-white flex items-center justify-center"
                    title="Send"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="text-xs text-textMuted italic text-center py-10">
              Hãy chọn hoặc phát audio để kích hoạt AI Coach.
            </div>
          )}
        </div>
      </div>

      {/* Intonation & Waveform Pitch Comparison (Only shown if shadowing attempt is made) */}
      {userAttempted && (
        <div className="space-y-6">
          <WaveformComparison
            shadowingAttempted={userAttempted}
            originalPeaks={originalPeaks}
            userPeaks={userPeaks}
            originalDuration={originalDuration}
            userDuration={userDuration}
          />
          <FeedbackPanel words={evaluatedWords} shadowingAttempted={userAttempted} />
        </div>
      )}

      {/* STICKY BOTTOM MEDIA PLAYER & CONTROLLER BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/90 border-t border-borderCustom/65 backdrop-blur-xl shadow-2xl flex justify-center">
        <div className="w-full max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4">

          {/* 1. Left controls: Shadowing mic controls */}
          <div className="flex items-center gap-3">
            {recordedAudioUrl && (
              <button
                onClick={() => {
                  const aud = new Audio(recordedAudioUrl);
                  aud.play().catch(() => {});
                }}
                className="px-3 py-1.5 rounded-lg bg-accent/25 hover:bg-accent/35 border border-accent/40 text-accent text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
              >
                🔊 Replay Voice
              </button>
            )}

            {!isUserRecording ? (
              <button
                onClick={handleStartUserRecording}
                className="px-4 py-2 rounded-lg bg-danger text-white text-xs font-bold shadow-dangerGlow flex items-center gap-1.5 hover:bg-danger/90 transition-all"
              >
                <span className="w-2 h-2 rounded-full bg-white opacity-85 animate-ping"></span> {t('workspace.shadowMic')}
              </button>
            ) : (
              <button
                onClick={handleStopUserRecording}
                className="px-4 py-2 rounded-lg bg-white text-black text-xs font-bold flex items-center gap-1.5 hover:bg-white/90 transition-all shadow-xl"
              >
                <Mic className="w-3.5 h-3.5 fill-black text-black" /> Stop & Score
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
                className="px-3 py-1.5 rounded-lg bg-cardSecondary hover:bg-cardSecondary/80 border border-borderCustom text-xs font-bold text-textSecondary hover:text-white transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Retry
              </button>
            )}
          </div>

          {/* 2. Center controls: Playback & Timeline seeking controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (currentSentence && currentSentence.id > 1) {
                  const prev = sentences.find(s => s.id === currentSentence.id - 1);
                  if (prev) handlePlaySentence(prev);
                }
              }}
              disabled={sentences.length <= 1}
              className="p-2 rounded-lg bg-cardSecondary border border-borderCustom text-textSecondary hover:text-white disabled:opacity-40"
              title="Previous Sentence"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                const audio = audioRef.current;
                if (!audio) return;
                if (audio.paused) audio.play().catch(() => {});
                else audio.pause();
              }}
              className="w-10 h-10 rounded-full bg-accent hover:bg-accent/90 text-white flex items-center justify-center shadow-glow transition-all"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
            </button>

            <button
              onClick={() => {
                if (currentSentence && currentSentence.id < sentences.length) {
                  const next = sentences.find(s => s.id === currentSentence.id + 1);
                  if (next) handlePlaySentence(next);
                }
              }}
              disabled={sentences.length <= 1}
              className="p-2 rounded-lg bg-cardSecondary border border-borderCustom text-textSecondary hover:text-white disabled:opacity-40"
              title="Next Sentence"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 3. Right controls: Playback speed, loops, auto-pause */}
          <div className="flex items-center gap-3 text-xs font-bold">
            {/* Speed Selector */}
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cardSecondary border border-borderCustom text-textSecondary">
              <Volume2 className="w-3.5 h-3.5 text-textMuted" />
              <select
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="bg-transparent border-none text-white focus:outline-none cursor-pointer"
              >
                <option value="0.5" className="bg-card text-white">0.5x 🐢</option>
                <option value="0.75" className="bg-card text-white">0.75x</option>
                <option value="1" className="bg-card text-white">1.0x ⚡</option>
                <option value="1.25" className="bg-card text-white">1.25x</option>
                <option value="1.5" className="bg-card text-white">1.5x 🏎️</option>
                <option value="2" className="bg-card text-white">2.0x 🚀</option>
              </select>
            </div>

            {/* Loop Word Toggle */}
            <button
              onClick={() => {
                const nextLoopActive = !isLoopActive;
                setIsLoopActive(nextLoopActive);
                if (nextLoopActive && audioRef.current) {
                  const time = audioRef.current.currentTime;
                  const activeWord = sortedWords.find(w => time >= w.start && time <= w.end);
                  if (activeWord) setLoopRange({ start: activeWord.start, end: activeWord.end });
                } else {
                  setLoopRange(null);
                }
              }}
              className={`px-3 py-1.5 rounded-lg border flex items-center gap-1 transition-colors ${
                isLoopActive
                  ? 'bg-accent/15 border-accent text-accent'
                  : 'bg-cardSecondary border-borderCustom text-textSecondary hover:text-white'
              }`}
              title="Lặp từ active đang phát"
            >
              🔂 Loop Word
            </button>

            {/* Loop Sentence Toggle */}
            <button
              onClick={() => setIsSentenceLoopActive(!isSentenceLoopActive)}
              className={`px-3 py-1.5 rounded-lg border flex items-center gap-1 transition-colors ${
                isSentenceLoopActive
                  ? 'bg-accent/15 border-accent text-accent'
                  : 'bg-cardSecondary border-borderCustom text-textSecondary hover:text-white'
              }`}
              title="Lặp câu active đang phát"
            >
              🔁 Loop Clause
            </button>

            {/* Auto-pause Toggle */}
            <button
              onClick={() => {
                setIsAutoPauseActive(!isAutoPauseActive);
                setHasAutoPaused(null);
              }}
              className={`px-3 py-1.5 rounded-lg border flex items-center gap-1 transition-colors ${
                isAutoPauseActive
                  ? 'bg-accent/15 border-accent text-accent'
                  : 'bg-cardSecondary border-borderCustom text-textSecondary hover:text-white'
              }`}
              title="Tự động dừng sau mỗi câu để luyện tập phát âm"
            >
              ⏯️ Auto Pause
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
