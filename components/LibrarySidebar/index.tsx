import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, SlidersHorizontal, BookOpen, Star, RefreshCw, Link2, Upload } from 'lucide-react';
import { LessonCard } from './LessonCard';
import { Recording } from '../../types';
import { useDialog } from '../../context/DialogContext';

interface LibrarySidebarProps {
  recordings: Recording[];
  isLoading: boolean;
  onOpenLesson: (rec: Recording) => void;
  onDelete: (id: string) => Promise<void>;
  onToggleFavorite: (id: string) => void;
  activeLessonId?: string;
  importYouTube: (url: string, mode: 'audio' | 'video', lang?: string) => Promise<Recording>;
  importFile: (mediaFile: File, subtitleFile?: File, lang?: string) => Promise<Recording>;
  lang?: string;
}

export const LibrarySidebar: React.FC<LibrarySidebarProps> = ({
  recordings,
  isLoading,
  onOpenLesson,
  onDelete,
  onToggleFavorite,
  activeLessonId,
  importYouTube,
  importFile,
  lang
}) => {
  const { alert: showAlert, confirm: showConfirm, prompt: showPrompt } = useDialog();
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'favorites'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'score'>('newest');

  // Xử lý tìm kiếm, lọc và sắp xếp
  const processedRecordings = useMemo(() => {
    let result = [...recordings];

    // Lọc theo search term
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(r =>
        r.filename.toLowerCase().includes(term) ||
        r.transcript.toLowerCase().includes(term)
      );
    }

    // Lọc theo favorite
    if (filterMode === 'favorites') {
      result = result.filter(r => r.isFavorite);
    }

    // Sắp xếp
    if (sortBy === 'newest') {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === 'score') {
      result.sort((a, b) => {
        const scoreA = a.aiScore?.pronunciation || 0;
        const scoreB = b.aiScore?.pronunciation || 0;
        return scoreB - scoreA;
      });
    }

    return result;
  }, [recordings, search, filterMode, sortBy]);

  const handleDelete = async (id: string) => {
    const hasConfirmed = await showConfirm({
      title: 'Xóa bản ghi',
      message: 'Bạn có chắc muốn xóa bản ghi này cùng toàn bộ thư mục và tệp cấu hình đi kèm không?',
      confirmLabel: 'Xóa',
      cancelLabel: 'Hủy'
    });

    if (hasConfirmed) {
      try {
        await onDelete(id);
      } catch (err: unknown) {
        showAlert({
          title: 'Lỗi khi xóa',
          message: err instanceof Error ? err.message : String(err),
          type: 'error'
        });
      }
    }
  };

  const handleYouTubeImportClick = async () => {
    const url = await showPrompt({
      title: 'Nhập từ YouTube',
      message: 'Nhập đường dẫn video YouTube hoặc YouTube Shorts:',
      placeholder: 'https://www.youtube.com/watch?v=...'
    });

    if (url === null) return;

    if (!url.trim()) {
      showAlert({
        title: 'Lỗi link YouTube',
        message: 'Vui lòng nhập đường dẫn URL hợp lệ.',
        type: 'error'
      });
      return;
    }

    const hasVideo = await showConfirm({
      title: 'Tải Video hay Chỉ Audio?',
      message: 'Bạn muốn tải cả Video (xem hình ảnh trong workspace) hay chỉ tải Audio (nhẹ hơn)?',
      confirmLabel: 'Tải cả Video',
      cancelLabel: 'Chỉ Audio'
    });

    const mode = hasVideo ? 'video' : 'audio';

    try {
      await importYouTube(url.trim(), mode, lang);
      showAlert({
        title: 'Bắt đầu import',
        message: 'Đang tải media và phụ đề từ YouTube dưới nền. Trạng thái sẽ cập nhật tự động trong danh sách thư viện.',
        type: 'success'
      });
    } catch (err: any) {
      showAlert({
        title: 'Lỗi import YouTube',
        message: err.message || String(err),
        type: 'error'
      });
    }
  };

  const handleFileImportClick = () => {
    const mediaInput = document.createElement('input');
    mediaInput.type = 'file';
    mediaInput.accept = 'audio/*,video/*';
    mediaInput.onchange = async () => {
      const mediaFile = mediaInput.files?.[0];
      if (!mediaFile) return;

      const hasSubtitle = await showConfirm({
        title: 'Đính kèm phụ đề?',
        message: 'Bạn có tệp phụ đề (.srt hoặc .vtt) để hát karaoke cho tệp này không?',
        confirmLabel: 'Có phụ đề',
        cancelLabel: 'Không (AI tự động bóc)'
      });

      if (hasSubtitle) {
        const subInput = document.createElement('input');
        subInput.type = 'file';
        subInput.accept = '.srt,.vtt';
        subInput.onchange = async () => {
          const subtitleFile = subInput.files?.[0];
          await proceedWithFileImport(mediaFile, subtitleFile);
        };
        subInput.click();
      } else {
        await proceedWithFileImport(mediaFile);
      }
    };
    mediaInput.click();
  };

  const proceedWithFileImport = async (mediaFile: File, subtitleFile?: File) => {
    try {
      await importFile(mediaFile, subtitleFile, lang);
      showAlert({
        title: 'Bắt đầu import file',
        message: 'Đang xử lý tệp media và nạp phụ đề dưới nền. Trạng thái sẽ cập nhật tự động.',
        type: 'success'
      });
    } catch (err: any) {
      showAlert({
        title: 'Lỗi import file',
        message: err.message || String(err),
        type: 'error'
      });
    }
  };

  return (
    <div className="flex flex-col gap-4 p-5 rounded-2xl bg-card border border-borderCustom max-h-[640px]">
      {/* Header Library */}
      <div className="flex items-center justify-between pb-3 border-b border-borderCustom">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold text-textSecondary">Learning Library</h3>
        </div>
        <span className="text-xs text-textMuted bg-cardSecondary border border-borderCustom px-2 py-0.5 rounded font-mono font-bold">
          {recordings.length} Lessons
        </span>
      </div>

      {/* Import actions */}
      <div className="flex gap-2">
        <button
          onClick={handleYouTubeImportClick}
          className="flex-1 py-2 px-3 rounded-xl bg-cardSecondary hover:bg-cardSecondary/80 border border-borderCustom text-[11px] font-bold text-textSecondary hover:text-white flex items-center justify-center gap-1.5 transition-colors"
        >
          <Link2 className="w-3.5 h-3.5 text-red-500" />
          YouTube Link
        </button>
        <button
          onClick={handleFileImportClick}
          className="flex-1 py-2 px-3 rounded-xl bg-cardSecondary hover:bg-cardSecondary/80 border border-borderCustom text-[11px] font-bold text-textSecondary hover:text-white flex items-center justify-center gap-1.5 transition-colors"
        >
          <Upload className="w-3.5 h-3.5 text-accent" />
          Import File
        </button>
      </div>

      {/* Filter and Search controls */}
      <div className="space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute top-2.5 left-3 w-4 h-4 text-textMuted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm bài học..."
            className="w-full bg-cardSecondary border border-borderCustom rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-accent text-white placeholder-textMuted"
          />
        </div>

        {/* Action filter controls */}
        <div className="flex items-center justify-between text-xs font-semibold gap-2">
          <div className="flex bg-cardSecondary border border-borderCustom rounded-lg p-0.5">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 rounded-md transition-colors ${
                filterMode === 'all' ? 'bg-accent text-white shadow-glow' : 'text-textMuted hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterMode('favorites')}
              className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${
                filterMode === 'favorites' ? 'bg-accent text-white shadow-glow' : 'text-textMuted hover:text-white'
              }`}
            >
              <Star className="w-3 h-3 fill-current" /> Favs
            </button>
          </div>

          <div className="flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3 text-textMuted" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'score')}
              className="bg-transparent border-none text-textSecondary focus:outline-none cursor-pointer"
            >
              <option value="newest" className="bg-card text-white">Newest First</option>
              <option value="score" className="bg-card text-white">Top Scored</option>
            </select>
          </div>
        </div>
      </div>

      {/* Scrollable list card list */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-[220px]">
        {isLoading && recordings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-textMuted text-xs font-semibold">
            <RefreshCw className="w-5 h-5 animate-spin text-accent" />
            <span>Loading recordings library...</span>
          </div>
        ) : processedRecordings.length > 0 ? (
          <motion.div layout className="space-y-3">
            <AnimatePresence>
              {processedRecordings.map((rec) => (
                <LessonCard
                  key={rec.id}
                  recording={rec}
                  onOpen={() => onOpenLesson(rec)}
                  onDelete={() => handleDelete(rec.id)}
                  onToggleFavorite={() => onToggleFavorite(rec.id)}
                  isActive={activeLessonId === rec.id}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-borderCustom rounded-2xl text-center gap-3">
            <div className="p-3 bg-cardSecondary rounded-2xl border border-borderCustom">
              <Star className="w-6 h-6 text-textMuted" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-textSecondary">No lessons found</h4>
              <p className="text-xs text-textMuted max-w-[200px] mx-auto mt-1 leading-relaxed">
                {search ? 'Không tìm thấy kết quả phù hợp với từ khóa.' : 'Hãy bắt đầu ghi âm để tạo bài học shadowing đầu tiên!'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
