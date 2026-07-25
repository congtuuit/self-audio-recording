import React from 'react';
import { motion } from 'framer-motion';
import { Library, Flame, Hourglass, Star, Percent } from 'lucide-react';
import { Recording } from '../../types';

interface DashboardCardsProps {
  recordings: Recording[];
}

export const DashboardCards: React.FC<DashboardCardsProps> = ({ recordings }) => {
  // Lấy lịch sử thực hành shadowing từ localStorage
  const attempts = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('voicecraft_shadow_attempts') || '[]');
    } catch (e) {
      return [];
    }
  }, [recordings]);

  const lessonsCompleted = recordings.length;
  const shadowingCount = attempts.length;

  // 1. Tính toán Practice Hours
  const totalDurationOriginal = recordings.reduce((acc, curr) => {
    if (curr.words && curr.words.length > 0) {
      return acc + curr.words[curr.words.length - 1].end;
    }
    return acc + (curr.size / (44100 * 2));
  }, 0);
  const totalDurationAttempts = attempts.reduce((acc: number, curr: any) => acc + (Number(curr.duration) || 0), 0);
  const practiceHours = ((totalDurationOriginal + totalDurationAttempts) / 3600).toFixed(2);

  // 2. Điểm trung bình phát âm thực tế
  const avgScore = attempts.length
    ? Math.round(attempts.reduce((acc: number, curr: any) => acc + (curr.score || 0), 0) / attempts.length)
    : 0;

  // 3. Tổng số từ đã luyện tập
  const originalWordsCount = recordings.reduce((acc, curr) => acc + (curr.words?.length || 0), 0);
  const shadowingWordsCount = attempts.reduce((acc: number, curr: any) => acc + (curr.wordsCount || 0), 0);
  const wordsPracticed = originalWordsCount + shadowingWordsCount;

  // 4. Tính chuỗi ngày học liên tục (Streak)
  const activeStreak = React.useMemo(() => {
    const datesSet = new Set<string>();

    recordings.forEach(r => {
      try {
        const date = new Date(r.createdAt).toISOString().split('T')[0];
        datesSet.add(date);
      } catch (e) {}
    });

    attempts.forEach((a: any) => {
      try {
        const date = new Date(a.timestamp).toISOString().split('T')[0];
        datesSet.add(date);
      } catch (e) {}
    });

    const sortedDates = Array.from(datesSet).sort().reverse();
    if (sortedDates.length === 0) return 0;

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (sortedDates[0] !== todayStr && sortedDates[0] !== yesterdayStr) {
      return 0;
    }

    let streak = 1;
    let currentDate = new Date(sortedDates[0]);

    for (let i = 1; i < sortedDates.length; i++) {
      const nextDate = new Date(sortedDates[i]);
      const diffTime = Math.abs(currentDate.getTime() - nextDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        streak++;
        currentDate = nextDate;
      } else if (diffDays > 1) {
        break;
      }
    }

    return streak;
  }, [recordings, attempts]);

  // Cấu hình các thẻ Dashboard card
  const cardsData = [
    {
      title: "Lessons Completed",
      value: lessonsCompleted,
      subtitle: "Audio lessons created",
      icon: Library,
      color: "from-blue-500 to-indigo-600",
    },
    {
      title: "Shadowing Count",
      value: `${shadowingCount} Times`,
      subtitle: `${wordsPracticed} words practiced`,
      icon: Star,
      color: "from-pink-500 to-purple-600",
    },
    {
      title: "Practice Hours",
      value: `${practiceHours}h`,
      subtitle: "Total voice practice",
      icon: Hourglass,
      color: "from-accent to-purple-600",
    },
    {
      title: "Average Score",
      value: avgScore > 0 ? `${avgScore}%` : "N/A",
      subtitle: attempts.length ? "Based on real speech" : "No shadowing yet",
      icon: Percent,
      color: "from-emerald-500 to-teal-600",
    },
    {
      title: "Daily Streak",
      value: `${activeStreak} Days`,
      subtitle: activeStreak > 0 ? "Daily target met" : "Start practicing today",
      icon: Flame,
      color: "from-orange-500 to-rose-600",
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 md:grid-cols-5 gap-4"
    >
      {cardsData.map((card, idx) => (
        <motion.div
          key={idx}
          variants={itemVariants}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="p-4 rounded-2xl bg-card border border-borderCustom flex flex-col justify-between relative overflow-hidden group cursor-pointer"
        >
          {/* Background subtle color indicator */}
          <div className={`absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b ${card.color}`}></div>

          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-semibold text-textMuted">{card.title}</span>
            <div className="p-2 rounded-lg bg-cardSecondary border border-borderCustom text-textSecondary group-hover:text-white transition-colors">
              <card.icon className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="text-2xl font-bold tracking-tight text-white mb-0.5">{card.value}</div>
            <p className="text-[11px] text-textMuted group-hover:text-textSecondary transition-colors">{card.subtitle}</p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
};
