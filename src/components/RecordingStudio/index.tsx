import React, { useState, useEffect } from 'react';
import { RecorderControls } from './RecorderControls';
import { WaveformVisualizer } from './WaveformVisualizer';
import { LiveTranscriptPanel } from './LiveTranscriptPanel';
import { QuickAIAnalysis } from './QuickAIAnalysis';
import { Recording, AIScore } from '../../types';
import { useDialog } from '../../context/DialogContext';

interface RecordingStudioProps {
  isRecording: boolean;
  isPaused: boolean;
  elapsedTime: number;
  visualizerData: Uint8Array;
  onStartRecording: (sourceMode: 'mic' | 'system' | 'both' | 'screen') => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onStopRecording: () => void;
  isSaving: boolean;
  recordings: Recording[];
}

export const RecordingStudio: React.FC<RecordingStudioProps> = ({
  isRecording,
  isPaused,
  elapsedTime,
  visualizerData,
  onStartRecording,
  onPauseRecording,
  onResumeRecording,
  onStopRecording,
  isSaving,
  recordings
}) => {
  const { alert: showAlert } = useDialog();
  const [liveSpeechText, setLiveSpeechText] = useState('');
  const [latestAnalysis, setLatestAnalysis] = useState<AIScore | null>(null);

  // Web Speech Recognition kết nối trực tiếp trong component ghi âm
  useEffect(() => {
    if (!isRecording || isPaused) return;

    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let finalStr = '';
      let interimStr = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalStr += event.results[i][0].transcript + ' ';
        } else {
          interimStr += event.results[i][0].transcript;
        }
      }
      setLiveSpeechText(finalStr + interimStr);
    };

    recognition.start();

    return () => {
      recognition.stop();
    };
  }, [isRecording, isPaused]);

  // Cập nhật điểm AI giả lập khi lưu bản ghi thành công
  useEffect(() => {
    if (recordings.length > 0 && !isRecording) {
      const latest = recordings[0];
      if (latest && !latest.processing && latest.aiScore) {
        setLatestAnalysis(latest.aiScore);
      }
    }
  }, [recordings, isRecording]);

  const handleClearTranscript = () => {
    setLiveSpeechText('');
  };

  const handleCopyTranscript = () => {
    navigator.clipboard.writeText(liveSpeechText);
    showAlert({
      title: 'Clipboard',
      message: 'Đã copy live transcript!',
      type: 'success'
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Title section */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white">Recording Studio</h2>
        <p className="text-xs text-textMuted mt-1">Ghi âm micro, hệ thống, quay màn hình và bóc chữ real-time với AI</p>
      </div>

      {/* Main Recording Panel */}
      <RecorderControls
        isRecording={isRecording}
        isPaused={isPaused}
        elapsedTime={elapsedTime}
        onStartRecording={onStartRecording}
        onPauseRecording={onPauseRecording}
        onResumeRecording={onResumeRecording}
        onStopRecording={onStopRecording}
        isSaving={isSaving}
      />

      {/* Waveform Visualizer */}
      <WaveformVisualizer
        isRecording={isRecording}
        isPaused={isPaused}
        visualizerData={visualizerData}
      />

      {/* Live Transcript streaming */}
      <LiveTranscriptPanel
        isRecording={isRecording}
        transcriptText={liveSpeechText}
        onClear={handleClearTranscript}
        onCopy={handleCopyTranscript}
      />

      {/* AI Score Analysis Panel */}
      {latestAnalysis && !isRecording && (
        <QuickAIAnalysis score={latestAnalysis} />
      )}
    </div>
  );
};
