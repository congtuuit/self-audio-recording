import { useState, useRef, useEffect, useCallback } from 'react';

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  elapsedTime: number;
  startRecording: (sourceMode: 'mic' | 'system' | 'both' | 'screen') => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => Promise<Blob | null>;
  visualizerData: Uint8Array;
  videoStream: MediaStream | null;
}

export interface UseAudioRecorderOptions {
  sampleRate?: number;
  autoGain?: boolean;
}

export function useAudioRecorder(options: UseAudioRecorderOptions = {}): UseAudioRecorderReturn {
  const { sampleRate = 44100, autoGain = true } = options;
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [visualizerData, setVisualizerData] = useState<Uint8Array>(new Uint8Array(0));
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const activeStreamsRef = useRef<MediaStream[]>([]);
  const pcmBuffersRef = useRef<Float32Array[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  const sampleRateRef = useRef<number>(44100);

  // Dọn dẹp timer & animation frame khi unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      activeStreamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()));
    };
  }, []);

  // Update visualizer frequency data
  const updateVisualizer = useCallback(() => {
    if (!analyserRef.current || !isRecording || isPaused) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);
    setVisualizerData(dataArray);

    animationFrameRef.current = requestAnimationFrame(updateVisualizer);
  }, [isRecording, isPaused]);

  useEffect(() => {
    if (isRecording && !isPaused) {
      animationFrameRef.current = requestAnimationFrame(updateVisualizer);
    } else {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
  }, [isRecording, isPaused, updateVisualizer]);

  const startRecording = async (sourceMode: 'mic' | 'system' | 'both' | 'screen') => {
    pcmBuffersRef.current = [];
    activeStreamsRef.current = [];
    setElapsedTime(0);

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = (() => {
      try {
        return new AudioContextClass({ sampleRate } as AudioContextOptions);
      } catch {
        return new AudioContextClass();
      }
    })();
    audioContextRef.current = audioCtx;
    sampleRateRef.current = audioCtx.sampleRate;

    const micAudioConstraints: MediaTrackConstraints = {
      autoGainControl: autoGain,
      noiseSuppression: true,
      echoCancellation: true
    };

    let finalAudioStream: MediaStream | null = null;

    try {
      if (sourceMode === 'mic') {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: micAudioConstraints });
        activeStreamsRef.current.push(micStream);
        finalAudioStream = micStream;
      } else if (sourceMode === 'system') {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        activeStreamsRef.current.push(displayStream);
        const systemAudioTrack = displayStream.getAudioTracks()[0];
        if (!systemAudioTrack) throw new Error('Vui lòng tích vào "Chia sẻ âm thanh hệ thống"!');
        displayStream.getVideoTracks().forEach(t => t.stop());
        finalAudioStream = new MediaStream([systemAudioTrack]);
      } else if (sourceMode === 'both') {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: micAudioConstraints });
        activeStreamsRef.current.push(micStream);
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        activeStreamsRef.current.push(displayStream);
        const systemAudioTrack = displayStream.getAudioTracks()[0];
        if (!systemAudioTrack) throw new Error('Vui lòng tích vào "Chia sẻ âm thanh hệ thống"!');
        displayStream.getVideoTracks().forEach(t => t.stop());

        const micSource = audioCtx.createMediaStreamSource(micStream);
        const systemSource = audioCtx.createMediaStreamSource(new MediaStream([systemAudioTrack]));
        const mixedDestination = audioCtx.createMediaStreamDestination();

        micSource.connect(mixedDestination);
        systemSource.connect(mixedDestination);
        finalAudioStream = mixedDestination.stream;
      } else if (sourceMode === 'screen') {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1920, height: 1080 },
          audio: true
        });
        activeStreamsRef.current.push(displayStream);
        setVideoStream(displayStream);

        const systemAudioTrack = displayStream.getAudioTracks()[0];
        if (systemAudioTrack) {
          finalAudioStream = new MediaStream([systemAudioTrack]);
        } else {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: micAudioConstraints });
          activeStreamsRef.current.push(micStream);
          finalAudioStream = micStream;
        }
      }

      if (!finalAudioStream) throw new Error('Không thu được luồng âm thanh nào.');

      const sourceNode = audioCtx.createMediaStreamSource(finalAudioStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const bufferSize = 4096;
      const scriptProcessor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
      scriptProcessorRef.current = scriptProcessor;

      scriptProcessor.onaudioprocess = (e) => {
        if (audioCtx.state === 'suspended') return;
        const inputBuffer = e.inputBuffer.getChannelData(0);
        pcmBuffersRef.current.push(new Float32Array(inputBuffer));
      };

      sourceNode.connect(analyser);
      analyser.connect(scriptProcessor);
      scriptProcessor.connect(audioCtx.destination);

      setIsRecording(true);
      setIsPaused(false);
      recordingStartTimeRef.current = Date.now();

      timerIntervalRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 100);
      }, 100);

    } catch (err) {
      activeStreamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()));
      if (audioCtx) audioCtx.close();
      setVideoStream(null);
      throw err;
    }
  };

  const pauseRecording = () => {
    if (!isRecording || isPaused) return;
    setIsPaused(true);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state === 'running') {
      audioContextRef.current.suspend();
    }
  };

  const resumeRecording = () => {
    if (!isRecording || !isPaused) return;
    setIsPaused(false);
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    timerIntervalRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 100);
    }, 100);
  };

  const stopRecording = async (): Promise<Blob | null> => {
    if (!isRecording) return null;

    setIsRecording(false);
    setIsPaused(false);
    setVideoStream(null);

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    activeStreamsRef.current.forEach(stream => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    });
    activeStreamsRef.current = [];

    if (scriptProcessorRef.current) scriptProcessorRef.current.disconnect();
    if (analyserRef.current) analyserRef.current.disconnect();
    if (audioContextRef.current) {
      await audioContextRef.current.close();
    }

    // Encode PCM Buffers sang WAV 16-bit ở Frontend
    const wavBlob = encodeWAV(pcmBuffersRef.current, sampleRateRef.current);
    return wavBlob;
  };

  // Helper encode WAV
  const encodeWAV = (buffers: Float32Array[], sampleRate: number): Blob => {
    let totalSamples = 0;
    for (let i = 0; i < buffers.length; i++) totalSamples += buffers[i].length;
    const mergedSamples = new Float32Array(totalSamples);
    let offset = 0;
    for (let i = 0; i < buffers.length; i++) {
      mergedSamples.set(buffers[i], offset);
      offset += buffers[i].length;
    }

    const buffer = new ArrayBuffer(44 + totalSamples * 2);
    const view = new DataView(buffer);

    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // file length
    view.setUint32(4, 36 + totalSamples * 2, true);
    // RIFF type
    writeString(view, 8, 'WAVE');
    // format chunk identifier
    writeString(view, 12, 'fmt ');
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (raw PCM = 1)
    view.setUint16(20, 1, true);
    // channel count (Mono = 1)
    view.setUint16(22, 1, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate
    view.setUint32(28, sampleRate * 2, true);
    // block align
    view.setUint16(32, 2, true);
    // bits per sample (16-bit)
    view.setUint16(34, 16, true);
    // data chunk identifier
    writeString(view, 36, 'data');
    // data chunk length
    view.setUint32(40, totalSamples * 2, true);

    let index = 44;
    for (let i = 0; i < mergedSamples.length; i++) {
      const s = Math.max(-1, Math.min(1, mergedSamples[i]));
      view.setInt16(index, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      index += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
  };

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  return {
    isRecording,
    isPaused,
    elapsedTime,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    visualizerData,
    videoStream
  };
}
