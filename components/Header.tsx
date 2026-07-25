import React from 'react';
import { Mic, Cpu, HardDrive, Settings, Globe, Sparkles, Languages } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

interface HeaderProps {
  isRecording: boolean;
  isProcessing: boolean;
  onOpenSettings: () => void;
  lang: string;
  setLang: (lang: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  isRecording,
  isProcessing,
  onOpenSettings,
  lang,
  setLang
}) => {
  const { t, language, setLanguage } = useI18n();

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-card/40 border-b border-borderCustom backdrop-blur-md rounded-2xl">
      {/* Brand Logo & Name */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center p-2.5 rounded-xl bg-gradient-to-tr from-accent to-pink-500 text-white shadow-glow">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
            {t('header.title')} <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent font-semibold">STUDIO</span>
          </h1>
          <p className="text-xs text-textMuted">{t('header.appSlogan')}</p>
        </div>
      </div>

      {/* Header Info Badges */}
      <div className="flex items-center gap-4">
        {/* Storage usage */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cardSecondary/50 border border-borderCustom text-xs">
          <HardDrive className="w-3.5 h-3.5 text-textMuted" />
          <span className="text-textSecondary">Storage:</span>
          <span className="text-textSecondary font-semibold">12.4 MB / 500 MB</span>
          <div className="w-16 h-1.5 bg-cardSecondary rounded-full overflow-hidden border border-borderCustom">
            <div className="h-full bg-accent" style={{ width: '2.5%' }}></div>
          </div>
        </div>

        {/* AI Status */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
          isProcessing
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            : 'bg-cardSecondary/50 border-borderCustom text-textSecondary'
        }`}>
          <Cpu className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : 'text-textMuted'}`} />
          <span>AI Engine:</span>
          <span className="font-semibold">{isProcessing ? 'Analyzing...' : 'Ready'}</span>
        </div>

        {/* Mic Status */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
          isRecording
            ? 'bg-danger/10 border-danger/30 text-danger glow-red'
            : 'bg-cardSecondary/50 border-borderCustom text-textSecondary'
        }`}>
          <Mic className={`w-3.5 h-3.5 ${isRecording ? 'pulse-dot-red text-danger' : 'text-textMuted'}`} />
          <span>Microphone:</span>
          <span className="font-semibold">{isRecording ? 'Recording' : 'Connected'}</span>
        </div>

        {/* Language Select */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cardSecondary/50 border border-borderCustom text-xs">
          <Globe className="w-3.5 h-3.5 text-textMuted" />
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="bg-transparent border-none text-textSecondary font-semibold focus:outline-none cursor-pointer"
          >
            <option value="en-US" className="bg-card text-white">🇺🇸 English (en-US)</option>
            <option value="vi-VN" className="bg-card text-white">🇻🇳 Tiếng Việt (vi-VN)</option>
          </select>
        </div>

        {/* UI Language Toggle */}
        <div className="flex items-center gap-1 px-1 py-1 rounded-lg bg-cardSecondary/50 border border-borderCustom text-[10px] font-bold uppercase">
          <button
            onClick={() => setLanguage('vi')}
            className={`px-2 py-1 rounded ${language === 'vi' ? 'bg-accent text-white' : 'text-textMuted hover:text-white'}`}
          >
            VI
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={`px-2 py-1 rounded ${language === 'en' ? 'bg-accent text-white' : 'text-textMuted hover:text-white'}`}
          >
            EN
          </button>
        </div>

        {/* User avatar & settings */}
        <div className="flex items-center gap-2 pl-2 border-l border-borderCustom">
          <button
            onClick={onOpenSettings}
            className="p-2 text-textSecondary hover:text-white rounded-lg hover:bg-cardSecondary transition-colors"
            title={t('header.settings')}
          >
            <Settings className="w-4 h-4" />
          </button>

          <div className="relative group cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent to-purple-600 flex items-center justify-center text-xs font-bold text-white border border-borderCustom">
              TV
            </div>
            <div className="absolute top-1 right-0 w-2.5 h-2.5 bg-success rounded-full border-2 border-card"></div>
          </div>
        </div>
      </div>
    </header>
  );
};
