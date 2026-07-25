import React from 'react';
import { motion } from 'framer-motion';
import { Award, Zap, BookOpen, PenTool } from 'lucide-react';
import { AIScore } from '../../types';

interface QuickAIAnalysisProps {
  score: AIScore;
}

export const QuickAIAnalysis: React.FC<QuickAIAnalysisProps> = ({ score }) => {
  const metrics = [
    {
      label: 'Pronunciation',
      value: score.pronunciation,
      icon: Award,
      color: 'stroke-accent text-accent',
      bgColor: 'bg-accent/10 border-accent/20'
    },
    {
      label: 'Fluency',
      value: score.fluency,
      icon: Zap,
      color: 'stroke-success text-success',
      bgColor: 'bg-success/10 border-success/20'
    },
    {
      label: 'Vocabulary',
      value: score.vocabulary,
      icon: BookOpen,
      color: 'stroke-blue-400 text-blue-400',
      bgColor: 'bg-blue-400/10 border-blue-400/20'
    },
    {
      label: 'Grammar',
      value: score.grammar,
      icon: PenTool,
      color: 'stroke-pink-500 text-pink-500',
      bgColor: 'bg-pink-500/10 border-pink-500/20'
    }
  ];

  // Tính toán stroke offset cho SVG circle
  const radius = 24;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="p-5 rounded-2xl bg-card border border-borderCustom space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between pb-3 border-b border-borderCustom">
        <h3 className="text-sm font-semibold text-textSecondary flex items-center gap-2">
          ✨ Quick AI Analysis
        </h3>
        <span className="text-[11px] text-textMuted uppercase font-semibold tracking-wider bg-cardSecondary px-2 py-0.5 rounded border border-borderCustom">
          Speaking Speed: {score.speed} WPM
        </span>
      </div>

      {/* Grid Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((metric, idx) => {
          const strokeDashoffset = circumference - (metric.value / 100) * circumference;

          return (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border flex items-center justify-between ${metric.bgColor}`}
            >
              <div className="flex flex-col gap-1">
                <span className="text-xs text-textMuted font-semibold">{metric.label}</span>
                <span className="text-xl font-bold tracking-tight text-white">{metric.value}%</span>
              </div>

              {/* Circular progress SVG */}
              <div className="relative w-14 h-14">
                <svg className="w-full h-full transform -rotate-90">
                  {/* Track circle */}
                  <circle
                    cx="28"
                    cy="28"
                    r={radius}
                    className="stroke-cardSecondary fill-none"
                    strokeWidth="3.5"
                  />
                  {/* Progress circle */}
                  <motion.circle
                    cx="28"
                    cy="28"
                    r={radius}
                    className={`fill-none ${metric.color}`}
                    strokeWidth="3.5"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <metric.icon className={`w-4 h-4 ${metric.color.split(' ')[1]}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
