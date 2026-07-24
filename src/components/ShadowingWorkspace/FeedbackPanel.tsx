import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';
import { WordTimestamp } from '../../types';

interface FeedbackPanelProps {
  words: (WordTimestamp & { score?: number })[];
  shadowingAttempted: boolean;
}

export const FeedbackPanel: React.FC<FeedbackPanelProps> = ({
  words,
  shadowingAttempted
}) => {
  // Điểm phát âm thực tế được truyền từ Workspace
  const evaluatedWords = React.useMemo(() => {
    if (!shadowingAttempted) return words;

    return words.map((w) => ({
      ...w,
      score: w.score !== undefined ? w.score : 90
    }));
  }, [words, shadowingAttempted]);

  const correctCount = evaluatedWords.filter(w => !w.score || w.score >= 80).length;
  const accuracy = shadowingAttempted
    ? Math.round((correctCount / evaluatedWords.length) * 100)
    : 0;

  // Giả lập phiên âm IPA cho một vài từ tiếng Anh phổ biến
  const getIPA = (word: string) => {
    const clean = word.toLowerCase().replace(/[^a-z]/g, '');
    const ipaMap: Record<string, string> = {
      there: 'ðer',
      project: 'ˈprɑːdʒekt',
      goal: 'ɡoʊl',
      important: 'ɪmˈpɔːrtnt',
      excuse: 'ɪkˈskjuːs',
      change: 'tʃeɪndʒ',
      right: 'raɪt',
      now: 'naʊ',
      always: 'ˈɔːlweɪz',
      learn: 'lɜːrn',
      english: 'ˈɪŋɡlɪʃ',
      time: 'taɪm',
      about: 'əˈbaʊt'
    };
    return ipaMap[clean] ? `/${ipaMap[clean]}/` : '';
  };

  return (
    <div className="p-5 rounded-2xl bg-card border border-borderCustom space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between pb-3 border-b border-borderCustom">
        <h3 className="text-sm font-semibold text-textSecondary flex items-center gap-2">
          🗣️ Pronunciation Feedback
        </h3>
        {shadowingAttempted && (
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${
            accuracy >= 80 ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
          }`}>
            {accuracy >= 80 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            Accuracy: {accuracy}%
          </span>
        )}
      </div>

      {/* Evaluated Words Grid */}
      <div className="flex flex-wrap gap-x-2 gap-y-3 font-semibold text-base py-2">
        {evaluatedWords.map((w, idx) => {
          const score = w.score;
          let colorClass = 'text-white';
          let borderClass = 'border-transparent';

          if (shadowingAttempted && score) {
            if (score >= 80) {
              colorClass = 'text-success bg-success/5 hover:bg-success/10';
              borderClass = 'border-success/20';
            } else if (score >= 60) {
              colorClass = 'text-amber-400 bg-amber-400/5 hover:bg-amber-400/10';
              borderClass = 'border-amber-400/20';
            } else {
              colorClass = 'text-danger bg-danger/5 hover:bg-danger/10';
              borderClass = 'border-danger/20';
            }
          }

          return (
            <div key={idx} className="relative group flex flex-col items-center">
              <motion.span
                layout
                className={`px-2 py-1 rounded-lg border text-sm md:text-base font-medium select-none cursor-pointer transition-colors ${colorClass} ${borderClass}`}
              >
                {w.word}
              </motion.span>

              {/* Tooltip hiển thị IPA & Điểm chi tiết */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-max hidden group-hover:flex flex-col items-center bg-cardSecondary border border-borderCustom rounded-lg p-2 text-[10px] text-textSecondary z-20 shadow-xl">
                {getIPA(w.word) && (
                  <span className="font-mono text-accent font-bold mb-0.5">{getIPA(w.word)}</span>
                )}
                <span>Mốc: {w.start}s - {w.end}s</span>
                {shadowingAttempted && score && (
                  <span className={`font-bold mt-0.5 ${
                    score >= 80 ? 'text-success' : 'text-danger'
                  }`}>Điểm phát âm: {score}/100</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!shadowingAttempted && (
        <p className="text-xs text-textMuted italic flex items-center gap-1.5 justify-center py-2">
          <HelpCircle className="w-4 h-4 text-accent" />
          Hãy bấm Record ghi âm nói nhại theo audio gốc để nhận chấm điểm phát âm AI.
        </p>
      )}
    </div>
  );
};
