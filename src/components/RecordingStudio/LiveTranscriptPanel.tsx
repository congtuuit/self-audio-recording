import React, { useRef, useEffect } from 'react';
import { FileText, Copy, Trash2 } from 'lucide-react';

interface LiveTranscriptPanelProps {
  isRecording: boolean;
  transcriptText: string;
  onClear: () => void;
  onCopy: () => void;
}

export const LiveTranscriptPanel: React.FC<LiveTranscriptPanelProps> = ({
  isRecording,
  transcriptText,
  onClear,
  onCopy
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Tự động cuộn xuống khi có từ mới
  useEffect(() => {
    if (panelRef.current) {
      panelRef.current.scrollTop = panelRef.current.scrollHeight;
    }
  }, [transcriptText]);

  return (
    <div className="flex flex-col gap-3 p-5 rounded-2xl bg-card border border-borderCustom">
      {/* Header Panel */}
      <div className="flex items-center justify-between pb-3 border-b border-borderCustom">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold text-textSecondary">Live Transcript (Real-time)</h3>
        </div>

        {transcriptText && (
          <div className="flex items-center gap-2">
            <button
              onClick={onCopy}
              className="p-1.5 rounded-lg hover:bg-cardSecondary text-textMuted hover:text-white transition-colors"
              title="Copy transcript"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={onClear}
              className="p-1.5 rounded-lg hover:bg-cardSecondary text-textMuted hover:text-danger transition-colors"
              title="Clear text"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Transcript Scrolling Box */}
      <div
        ref={panelRef}
        className="w-full min-h-[100px] max-h-[140px] overflow-y-auto text-sm leading-relaxed text-textSecondary font-medium select-text pr-1"
      >
        {transcriptText ? (
          <p className="whitespace-pre-wrap">
            {transcriptText}
            {isRecording && (
              <span className="inline-block w-1.5 h-4 bg-accent ml-1 animate-pulse"></span>
            )}
          </p>
        ) : (
          <p className="text-xs text-textMuted italic">
            Chữ thu âm trực tiếp sẽ tự động xuất hiện tại đây khi bạn bắt đầu nói...
          </p>
        )}
      </div>
    </div>
  );
};
