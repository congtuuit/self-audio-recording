import React from 'react';
import { motion as motionFramer } from 'framer-motion';
import { Play, Star, Trash2, Download, Award, Calendar, Layers } from 'lucide-react';
import { Recording } from '../../types';

interface LessonCardProps {
  recording: Recording;
  onOpen: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  isActive: boolean;
}

export const LessonCard: React.FC<LessonCardProps> = ({
  recording,
  onOpen,
  onDelete,
  onToggleFavorite,
  isActive
}) => {
  const dateStr = new Date(recording.createdAt).toLocaleDateString('vi-VN', {
    day: 'numeric',
    month: 'short',
    year: '2-digit'
  });

  // Quy đổi kích thước file
  const sizeKB = (recording.size / 1024).toFixed(1);

  // Kiểm tra xem bản ghi có mới tạo gần đây không (trong vòng 2 tiếng)
  const isRecent = Date.now() - new Date(recording.createdAt).getTime() < 2 * 3600 * 1000;

  // Tính toán thông tin điểm số để vẽ vòng tròn nhỏ
  const score = recording.aiScore?.pronunciation || null;
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = score ? circumference - (score / 100) * circumference : circumference;

  return (
    <motionFramer.div
      layout
      whileHover={{ y: -3, scale: 1.01 }}
      className={`p-4 rounded-xl flex flex-col justify-between gap-3 relative overflow-hidden group cursor-pointer transition-colors border ${
        isActive
          ? 'bg-cardSecondary border-accent/40 shadow-glow'
          : 'bg-card/50 border-borderCustom hover:bg-cardSecondary/40'
      }`}
      onClick={onOpen}
    >
      {/* Left indicator bar */}
      <div className={`absolute top-0 left-0 w-1 h-full ${
        recording.processing
          ? 'bg-amber-500 animate-pulse'
          : (isActive ? 'bg-accent' : 'bg-borderCustom group-hover:bg-accent/40')
      }`}></div>

      {/* Top row: Title, Date, Fav */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span className="text-sm font-semibold tracking-tight text-white truncate block max-w-[170px]" title={recording.filename}>
              {recording.id}
            </span>
            {isRecent && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/20 text-accent font-bold uppercase tracking-wider">
                New
              </span>
            )}
            {recording.processing && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-500 font-bold uppercase tracking-wider animate-pulse">
                AI Processing
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-textMuted font-medium">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {dateStr}</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> {sizeKB} KB</span>
          </div>
        </div>

        {/* Top actions: Favorite star */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={`p-1.5 rounded-lg border border-borderCustom hover:bg-cardSecondary transition-colors ${
            recording.isFavorite ? 'text-amber-400 bg-amber-400/5' : 'text-textMuted hover:text-white'
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${recording.isFavorite ? 'fill-amber-400' : ''}`} />
        </button>
      </div>

      {/* Mid row: Transcript preview */}
      <div className="text-[12px] text-textSecondary line-clamp-2 italic pr-2 font-medium">
        {recording.processing
          ? '⏳ AI đang bóc văn bản & tính timestamps dưới nền...'
          : (recording.transcript || 'Không có văn bản transcript.')}
      </div>

      {/* Static Waveform preview on the bottom card */}
      {!recording.processing && (
        <div className="flex items-end justify-between h-4 gap-0.5 px-1 opacity-25 group-hover:opacity-40 transition-opacity">
          {Array.from({ length: 24 }).map((_, i) => {
            const h = Math.abs(Math.sin(i * 0.4)) * 14 + 2;
            return (
              <div
                key={i}
                className="flex-1 bg-accent rounded-t-sm"
                style={{ height: `${h}px` }}
              ></div>
            );
          })}
        </div>
      )}

      {/* Bottom row: Score & actions */}
      <div className="flex items-center justify-between border-t border-borderCustom/60 pt-3 mt-1">
        {/* Quick Score indicator */}
        {!recording.processing && score ? (
          <div className="flex items-center gap-2">
            <div className="relative w-8 h-8">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="16" cy="16" r={radius} className="stroke-cardSecondary fill-none" strokeWidth="2.5" />
                <circle
                  cx="16"
                  cy="16"
                  r={radius}
                  className="stroke-success fill-none"
                  strokeWidth="2.5"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-success">
                {score}
              </div>
            </div>
            <span className="text-[11px] font-bold text-textSecondary">Shadowing Score</span>
          </div>
        ) : (
          <div className="text-[11px] text-textMuted italic flex items-center gap-1">
            <Award className="w-3.5 h-3.5" /> Ready to Shadow
          </div>
        )}

        {/* Lower actions */}
        <div className="flex items-center gap-1.5">
          <a
            href={`/recordings/${recording.filename}`}
            download={`${recording.id}.wav`}
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-md hover:bg-cardSecondary text-textMuted hover:text-white transition-colors"
            title="Tải tệp WAV"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 rounded-md hover:bg-cardSecondary text-textMuted hover:text-danger transition-colors"
            title="Xóa tệp"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {!recording.processing && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              className="p-1.5 rounded-md bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 transition-colors ml-1"
              title="Mở luyện Shadowing"
            >
              <Play className="w-3.5 h-3.5 fill-accent" />
            </button>
          )}
        </div>
      </div>
    </motionFramer.div>
  );
};
