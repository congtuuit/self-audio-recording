import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Square, Radio, HelpCircle } from 'lucide-react';

interface RecorderControlsProps {
  isRecording: boolean;
  isPaused: boolean;
  elapsedTime: number;
  onStartRecording: (sourceMode: 'mic' | 'system' | 'both' | 'screen') => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onStopRecording: () => void;
  isSaving: boolean;
}

export const RecorderControls: React.FC<RecorderControlsProps> = ({
  isRecording,
  isPaused,
  elapsedTime,
  onStartRecording,
  onPauseRecording,
  onResumeRecording,
  onStopRecording,
  isSaving
}) => {
  const isSystemAudioSupported = typeof navigator.mediaDevices?.getDisplayMedia === 'function';
  const [sourceMode, setSourceMode] = useState<'mic' | 'system' | 'both' | 'screen'>(
    isSystemAudioSupported ? 'system' : 'mic'
  );
  const showSupportWarning = (sourceMode === 'system' || sourceMode === 'both' || sourceMode === 'screen') && !isSystemAudioSupported;

  // Format time sang 00:00:00
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  return (
    <div className="flex flex-col items-center gap-6 p-6 rounded-2xl bg-card border border-borderCustom">
      {/* Settings Options Row */}
      <div className="w-full flex items-center justify-between gap-4 pb-4 border-b border-borderCustom">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-accent" />
          <span className="text-sm font-semibold text-textSecondary">Ghi âm & Quay hình</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-textMuted">Source Mode:</label>
          <select
            value={sourceMode}
            onChange={(e) => setSourceMode(e.target.value as 'mic' | 'system' | 'both' | 'screen')}
            disabled={isRecording}
            className="bg-cardSecondary border border-borderCustom rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-accent disabled:opacity-40 cursor-pointer"
          >
            <option value="mic">🎙️ Microphone Only</option>
            <option value="system">🔊 System Audio Only</option>
            <option value="both">🎙️+🔊 Mixed Mic & System</option>
            <option value="screen">📹 HD Screen & Audio</option>
          </select>
        </div>
      </div>

      {showSupportWarning && (
        <div className="w-full text-center text-xs text-amber-500 font-semibold bg-amber-500/10 border border-amber-500/20 py-2 px-4 rounded-xl">
          ⚠️ Trình duyệt của bạn không hỗ trợ ghi âm hệ thống. Vui lòng chuyển sang "Microphone Only".
        </div>
      )}

      {/* Large Monospace Timer */}
      <div className="flex flex-col items-center gap-1">
        <motion.div
          animate={isRecording && !isPaused ? { scale: [1, 1.02, 1] } : {}}
          transition={{ duration: 1.5, repeat: Infinity }}
          className={`text-5xl md:text-6xl font-mono font-bold tracking-wider ${
            isRecording && !isPaused ? 'text-danger drop-shadow-dangerGlow' : 'text-white'
          }`}
        >
          {formatTime(elapsedTime)}
        </motion.div>
        <span className="text-xs text-textMuted uppercase tracking-widest font-semibold">
          {isRecording ? (isPaused ? 'Recording Paused' : 'Recording Voice...') : 'Ready to record'}
        </span>
      </div>

      {/* Circular Record Control Buttons */}
      <div className="flex items-center gap-6">
        {/* Pause / Resume Button */}
        {isRecording && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={isPaused ? onResumeRecording : onPauseRecording}
            className="flex items-center justify-center p-3 rounded-full bg-cardSecondary border border-borderCustom text-textSecondary hover:text-white transition-colors"
          >
            {isPaused ? <Play className="w-5 h-5 fill-white text-white" /> : <Pause className="w-5 h-5 text-amber-500 fill-amber-500" />}
          </motion.button>
        )}

        {/* Large Main Record Button */}
        {!isRecording ? (
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onStartRecording(sourceMode)}
            className="w-16 h-16 rounded-full bg-gradient-to-tr from-danger to-rose-500 flex items-center justify-center text-white shadow-dangerGlow relative group"
          >
            <span className="w-6 h-6 rounded-full bg-white opacity-85 group-hover:scale-110 transition-transform"></span>
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.95 }}
            onClick={onStopRecording}
            disabled={isSaving}
            className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-black hover:bg-white/90 disabled:opacity-40 transition-colors shadow-2xl"
          >
            <Square className="w-6 h-6 fill-black text-black" />
          </motion.button>
        )}

        {/* Help Placeholder Button */}
        {isRecording && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center justify-center p-3 rounded-full bg-cardSecondary border border-borderCustom text-textMuted cursor-help"
            title="Shortcuts: Space to Pause, Ctrl+S to Stop"
          >
            <HelpCircle className="w-5 h-5" />
          </motion.button>
        )}
      </div>

      {isSaving && (
        <div className="text-xs text-amber-400 font-semibold animate-pulse">
          Saving audio data and initializing transcription...
        </div>
      )}
    </div>
  );
};
