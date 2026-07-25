import React, { useState, useEffect } from 'react';
import { Header } from './Header';
import { StatusBar } from './StatusBar';
import { DashboardCards } from './Dashboard/DashboardCards';
import { RecordingStudio } from './RecordingStudio';
import { LibrarySidebar } from './LibrarySidebar';
import { ShadowingWorkspace } from './ShadowingWorkspace';
import { SettingsDialog } from './SettingsDialog';
import { useRecordings } from '../hooks/useRecordings';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { Recording, VoicecraftSettings } from '../types';
import { useDialog } from '../context/DialogContext';

export const AppLayout: React.FC = () => {
  const { alert: showAlert, prompt: showPrompt } = useDialog();
  const {
    recordings,
    isLoading,
    saveRecording,
    deleteRecording,
    reTranscribe,
    toggleFavorite,
    importYouTube,
    importFile
  } = useRecordings();

  const [activeLesson, setActiveLesson] = useState<Recording | null>(null);
  const [lang, setLang] = useState('en-US');
  const [settings, setSettings] = useState<VoicecraftSettings>(() => {
    try {
      const stored = localStorage.getItem('voicecraft_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          whisperKey: parsed.whisperKey || parsed.openaiKey || '',
          openaiKey: parsed.openaiKey || parsed.whisperKey || '',
          geminiKey: parsed.geminiKey || '',
          geminiModel: parsed.geminiModel || 'gemini-2.0-flash',
          openaiModel: parsed.openaiModel || 'gpt-4o-mini',
          sampleRate: parsed.sampleRate ? Number(parsed.sampleRate) : 44100,
          autoGain: parsed.autoGain !== undefined ? Boolean(parsed.autoGain) : true,
          providerPreference: parsed.providerPreference || 'auto'
        };
      }
    } catch (err) {}
    return {
      sampleRate: 44100,
      autoGain: true,
      providerPreference: 'auto'
    };
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const {
    isRecording,
    isPaused,
    elapsedTime,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    visualizerData
  } = useAudioRecorder({
    sampleRate: settings.sampleRate,
    autoGain: settings.autoGain
  });


  // Auto poll status updates
  const isProcessingAny = recordings.some(r => r.processing);

  useEffect(() => {
    if (!activeLesson) return;

    const updatedLesson = recordings.find(rec => rec.id === activeLesson.id);
    if (!updatedLesson) {
      setActiveLesson(null);
      return;
    }

    // Chỉ cập nhật activeLesson khi thực sự có thay đổi về nội dung bóc chữ hoặc trạng thái
    const hasChanged =
      updatedLesson.processing !== activeLesson.processing ||
      updatedLesson.transcript !== activeLesson.transcript ||
      updatedLesson.words?.length !== activeLesson.words?.length ||
      JSON.stringify(updatedLesson.aiScore) !== JSON.stringify(activeLesson.aiScore);

    if (hasChanged) {
      setActiveLesson(updatedLesson);
    }
  }, [recordings, activeLesson]);

  // Keyboard accessibility shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + R: Record toggle
      if (e.ctrlKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        if (!isRecording) {
          handleStartRecording('mic');
        }
      }

      // Ctrl + S: Stop recording & save
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (isRecording) {
          handleStopRecording();
        }
      }

      // Space: Play/Pause/Resume
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault();
        if (isRecording) {
          if (isPaused) resumeRecording();
          else pauseRecording();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecording, isPaused]);

  const handleStartRecording = async (sourceMode: 'mic' | 'system' | 'both' | 'screen') => {
    try {
      await startRecording(sourceMode);
    } catch (err: unknown) {
      showAlert({
        title: 'Lỗi ghi âm',
        message: err instanceof Error ? err.message : String(err),
        type: 'error'
      });
    }
  };

  const handleStopRecording = async () => {
    setIsSaving(true);
    try {
      const wavBlob = await stopRecording();
      if (wavBlob) {
        // Hỏi tên custom bằng Prompt Modal thân thiện
        const customName = await showPrompt({
          title: 'Lưu bản ghi',
          message: 'Nhập tên cho bản ghi âm này (hoặc để trống để tự động đặt tên):',
          placeholder: 'Ví dụ: Shadowing Lesson 1'
        });

        // Nếu click Cancel (trả về null), không lưu bản ghi
        if (customName !== null) {
          await saveRecording(wavBlob, "", customName, lang);
        }
      }
    } catch (err: unknown) {
      showAlert({
        title: 'Lỗi khi lưu bản ghi',
        message: err instanceof Error ? err.message : String(err),
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenLesson = (rec: Recording) => {
    setActiveLesson(rec);
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto min-h-screen flex flex-col justify-between py-6 px-4 md:px-8 gap-6 selection:bg-accent selection:text-white">
      {/* Header Panel */}
      <Header
        isRecording={isRecording}
        isProcessing={isProcessingAny || isSaving}
        onOpenSettings={() => setIsSettingsOpen(true)}
        lang={lang}
        setLang={setLang}
      />

      {/* Dashboard Top Area */}
      <DashboardCards recordings={recordings} />

      {/* Workspace Panel */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.85fr_1fr] gap-6 items-start">
        {/* Left Column - Recording Studio / Focus Workspace */}
        <div className="space-y-6">
          {activeLesson ? (
            <ShadowingWorkspace
              lesson={activeLesson}
              onClose={() => setActiveLesson(null)}
              reTranscribe={reTranscribe}
            />
          ) : (
            <RecordingStudio
              isRecording={isRecording}
              isPaused={isPaused}
              elapsedTime={elapsedTime}
              visualizerData={visualizerData}
              lang={lang}
              onStartRecording={handleStartRecording}
              onPauseRecording={pauseRecording}
              onResumeRecording={resumeRecording}
              onStopRecording={handleStopRecording}
              isSaving={isSaving}
              recordings={recordings}
            />
          )}
        </div>

        {/* Right Column - Learning Library */}
        <div className="lg:sticky lg:top-24">
          <LibrarySidebar
            recordings={recordings}
            isLoading={isLoading}
            onOpenLesson={handleOpenLesson}
            onDelete={deleteRecording}
            onToggleFavorite={toggleFavorite}
            activeLessonId={activeLesson?.id}
            importYouTube={importYouTube}
            importFile={importFile}
            lang={lang}
          />
        </div>
      </div>

      {/* Bottom Status Bar */}
      <StatusBar />

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        value={settings}
        onSave={setSettings}
      />
    </div>
  );
};
