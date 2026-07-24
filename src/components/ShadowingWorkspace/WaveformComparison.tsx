import React from 'react';
import { AreaChart, Activity, User } from 'lucide-react';

interface WaveformComparisonProps {
  shadowingAttempted: boolean;
  userVisualizerData?: Uint8Array;
}

export const WaveformComparison: React.FC<WaveformComparisonProps> = ({
  shadowingAttempted
}) => {
  // Giả lập vẽ waveform tĩnh (Original câu mẫu)
  const renderOriginalWaveform = () => {
    return (
      <div className="flex-1 p-4 rounded-xl bg-cardSecondary border border-borderCustom space-y-2 relative overflow-hidden">
        <div className="flex items-center gap-1.5 text-xs text-accent font-semibold mb-1">
          <Activity className="w-3.5 h-3.5" /> Original Intonation Model
        </div>
        <div className="flex items-end h-16 gap-0.5 opacity-60">
          {Array.from({ length: 42 }).map((_, i) => {
            // Sóng mẫu đều đặn, uốn lượn đẹp
            const h = Math.abs(Math.sin(i * 0.3) * Math.cos(i * 0.1)) * 52 + 4;
            return (
              <div
                key={i}
                className="flex-1 bg-accent rounded-t-sm"
                style={{ height: `${h}px` }}
              ></div>
            );
          })}
        </div>
      </div>
    );
  };

  // Vẽ waveform ghi âm của User Shadowing
  const renderUserWaveform = () => {
    return (
      <div className="flex-1 p-4 rounded-xl bg-cardSecondary border border-borderCustom space-y-2 relative overflow-hidden">
        <div className="flex items-center gap-1.5 text-xs text-success font-semibold mb-1">
          <User className="w-3.5 h-3.5" /> Your Shadowing Pitch
        </div>

        {shadowingAttempted ? (
          <div className="flex items-end h-16 gap-0.5 opacity-75">
            {Array.from({ length: 42 }).map((_, i) => {
              // Sóng của user: tương tự sóng mẫu nhưng có sai lệch chút
              let variance = 0.85;
              if (i === 12 || i === 28) variance = 0.4; // Lệch âm ở một số mốc
              const h = Math.abs(Math.sin(i * 0.32) * Math.cos(i * 0.08)) * 52 * variance + 4;
              return (
                <div
                  key={i}
                  className="flex-1 bg-success rounded-t-sm"
                  style={{ height: `${h}px` }}
                ></div>
              );
            })}
          </div>
        ) : (
          <div className="h-16 flex items-center justify-center border border-dashed border-borderCustom rounded-lg text-xs text-textMuted italic">
            Awaiting voice capture...
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-5 rounded-2xl bg-card border border-borderCustom space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-borderCustom">
        <h3 className="text-sm font-semibold text-textSecondary flex items-center gap-2">
          <AreaChart className="w-4 h-4 text-accent" /> Intonation & Pitch Comparison
        </h3>
        <span className="text-[10px] text-textMuted uppercase font-semibold">
          Visual Voice Mapping
        </span>
      </div>

      {/* Grid Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderOriginalWaveform()}
        {renderUserWaveform()}
      </div>
    </div>
  );
};
