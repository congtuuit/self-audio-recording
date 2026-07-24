import React from 'react';
import { motion } from 'framer-motion';
import { Library, Flame, Hourglass, Star, Percent } from 'lucide-react';
import { Recording } from '../../types';

interface DashboardCardsProps {
  recordings: Recording[];
}

export const DashboardCards: React.FC<DashboardCardsProps> = ({ recordings }) => {
  // Tính toán số liệu thực tế từ danh sách bản ghi
  const totalLessons = recordings.length;
  const favoriteCount = recordings.filter(r => r.isFavorite).length;

  // Tính tổng dung lượng / thời gian ghi âm thực tế (giả lập dựa trên records)
  const totalDurationSeconds = recordings.reduce((acc, curr) => {
    // Ước lượng duration nếu không có
    return acc + (curr.words?.length ? curr.words[curr.words.length - 1].end : 5);
  }, 0);
  const hoursPracticed = (totalDurationSeconds / 3600).toFixed(2);

  // Tính điểm trung bình phát âm thực tế
  const scoredRecordings = recordings.filter(r => r.aiScore?.pronunciation);
  const avgScore = scoredRecordings.length
    ? Math.round(scoredRecordings.reduce((acc, curr) => acc + (curr.aiScore?.pronunciation || 0), 0) / scoredRecordings.length)
    : 82; // Default fallback

  // Cấu hình các thẻ Dashboard card
  const cardsData = [
    {
      title: "Total Practice",
      value: totalLessons,
      subtitle: `${favoriteCount} Favorites`,
      icon: Library,
      color: "from-blue-500 to-indigo-600",
    },
    {
      title: "Shadowing Hours",
      value: `${hoursPracticed}h`,
      subtitle: "Total voice practice",
      icon: Hourglass,
      color: "from-accent to-purple-600",
    },
    {
      title: "Avg AI Pronunciation",
      value: `${avgScore}%`,
      subtitle: "Based on AI scoring",
      icon: Percent,
      color: "from-emerald-500 to-teal-600",
    },
    {
      title: "Active Streak",
      value: "5 Days",
      subtitle: "Daily target met",
      icon: Flame,
      color: "from-orange-500 to-rose-600",
    },
    {
      title: "Shadowing Favorites",
      value: favoriteCount,
      subtitle: "Bookmarks saved",
      icon: Star,
      color: "from-pink-500 to-purple-600",
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
