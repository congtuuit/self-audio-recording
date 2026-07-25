import React from 'react';
import { AreaChart, Activity, User } from 'lucide-react';

interface WaveformComparisonProps {
  shadowingAttempted: boolean;
  originalPeaks?: number[];
  userPeaks?: number[];
  originalDuration?: number;
  userDuration?: number;
}

export const WaveformComparison: React.FC<WaveformComparisonProps> = ({
  shadowingAttempted,
  originalPeaks,
  userPeaks,
  originalDuration = 0,
  userDuration = 0
}) => {
  // Vẽ waveform của file gốc
  const renderOriginalWaveform = () => {
    return (
      <div className="flex-1 p-4 rounded-xl bg-cardSecondary border border-borderCustom space-y-2 relative overflow-hidden">
        <div className="flex items-center gap-1.5 text-xs text-accent font-semibold mb-1">
          <Activity className="w-3.5 h-3.5" /> Original Intonation Model
        </div>
        <div className="flex items-end h-16 gap-0.5 opacity-60">
          {originalPeaks && originalPeaks.length > 0 ? (
            originalPeaks.map((peak, i) => {
              const h = peak * 52 + 4;
              return (
                <div
                  key={i}
                  className="flex-1 bg-accent rounded-t-sm"
                  style={{ height: `${h}px` }}
                ></div>
              );
            })
          ) : (
            Array.from({ length: 42 }).map((_, i) => {
              const h = Math.abs(Math.sin(i * 0.3) * Math.cos(i * 0.1)) * 52 + 4;
              return (
                <div
                  key={i}
                  className="flex-1 bg-accent rounded-t-sm"
                  style={{ height: `${h}px` }}
                ></div>
              );
            })
          )}
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
            {userPeaks && userPeaks.length > 0 ? (
              userPeaks.map((peak, i) => {
                const h = peak * 52 + 4;
                return (
                  <div
                    key={i}
                    className="flex-1 bg-success rounded-t-sm"
                    style={{ height: `${h}px` }}
                  ></div>
                );
              })
            ) : (
              Array.from({ length: 42 }).map((_, i) => {
                let variance = 0.85;
                if (i === 12 || i === 28) variance = 0.4;
                const h = Math.abs(Math.sin(i * 0.32) * Math.cos(i * 0.08)) * 52 * variance + 4;
                return (
                  <div
                    key={i}
                    className="flex-1 bg-success rounded-t-sm"
                    style={{ height: `${h}px` }}
                  ></div>
                );
              })
            )}
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
          <AreaChart className="w-4 h-4 text-accent" /> Intonation & Waveform Pitch Comparison
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

      {/* Thời lượng & Sai lệch thời gian */}
      {shadowingAttempted && originalDuration > 0 && userDuration > 0 && (
        <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-cardSecondary border border-borderCustom text-center text-xs font-semibold">
          <div>
            <span className="text-textMuted block text-[10px] uppercase mb-0.5">Original Time</span>
            <span className="text-white font-mono">{originalDuration.toFixed(2)}s</span>
          </div>
          <div>
            <span className="text-textMuted block text-[10px] uppercase mb-0.5">Your Time</span>
            <span className="text-white font-mono">{userDuration.toFixed(2)}s</span>
          </div>
          <div>
            <span className="text-textMuted block text-[10px] uppercase mb-0.5">Difference</span>
            <span className={`font-mono ${Math.abs(userDuration - originalDuration) <= 1 ? 'text-success' : 'text-danger'}`}>
              {(userDuration - originalDuration) >= 0 ? '+' : ''}{(userDuration - originalDuration).toFixed(2)}s
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
