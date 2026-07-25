import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard, Volume2, Key, Sliders, RefreshCw, Cpu } from 'lucide-react';
import { useDialog } from '../context/DialogContext';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  value?: {
    whisperKey?: string;
    openaiKey?: string;
    geminiKey?: string;
    geminiModel?: string;
    openaiModel?: string;
    sampleRate?: number;
    autoGain?: boolean;
    providerPreference?: 'auto' | 'gemini' | 'openai' | 'local';
  };
  onSave?: (settings: {
    whisperKey?: string;
    openaiKey?: string;
    geminiKey?: string;
    geminiModel?: string;
    openaiModel?: string;
    sampleRate?: number;
    autoGain?: boolean;
    providerPreference?: 'auto' | 'gemini' | 'openai' | 'local';
  }) => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose, value, onSave }) => {
  const { alert: showAlertDialog } = useDialog();
  const [settings, setSettings] = useState({
    whisperKey: '',
    openaiKey: '',
    geminiKey: '',
    geminiModel: 'gemini-2.0-flash',
    openaiModel: 'gpt-4o-mini',
    sampleRate: 44100,
    autoGain: true,
    providerPreference: 'auto' as 'auto' | 'gemini' | 'openai' | 'local'
  });

  const [geminiModels, setGeminiModels] = useState<string[]>([
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash-lite'
  ]);

  const [openaiModels, setOpenAIModels] = useState<string[]>([
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-4-turbo',
    'gpt-3.5-turbo'
  ]);

  const [isFetchingGemini, setIsFetchingGemini] = useState(false);
  const [isFetchingOpenAI, setIsFetchingOpenAI] = useState(false);

  // Load settings
  useEffect(() => {
    if (isOpen) {
      try {
        const stored = localStorage.getItem('voicecraft_settings');
        const parsed = stored ? JSON.parse(stored) : {};
        const source = { ...parsed, ...value };
        setSettings({
          whisperKey: source.whisperKey || source.openaiKey || '',
          openaiKey: source.openaiKey || source.whisperKey || '',
          geminiKey: source.geminiKey || '',
          geminiModel: source.geminiModel || 'gemini-2.0-flash',
          openaiModel: source.openaiModel || 'gpt-4o-mini',
          sampleRate: source.sampleRate ? Number(source.sampleRate) : 44100,
          autoGain: source.autoGain !== undefined ? Boolean(source.autoGain) : true,
          providerPreference: source.providerPreference || 'auto'
        });
      } catch (err) {
        console.error('Error loading settings:', err);
      }
    }
  }, [isOpen, value]);

  // Gọi API lấy danh sách Gemini models chính xác theo Gemini API Key
  const handleFetchGeminiModels = async (keyToUse?: string) => {
    const key = keyToUse || settings.geminiKey;
    if (!key) {
      showAlertDialog({
        title: 'Gemini API Key',
        message: 'Vui lòng nhập Gemini API Key trước khi lấy danh sách model!',
        type: 'warning'
      });
      return;
    }

    setIsFetchingGemini(true);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API Error (${res.status}): ${errText}`);
      }
      const data = await res.json();
      if (data.models && Array.isArray(data.models)) {
        const list = data.models
          .map((m: { name: string }) => m.name.replace('models/', ''))
          .filter((name: string) => name.includes('gemini'));
        if (list.length > 0) {
          setGeminiModels(list);
          if (!list.includes(settings.geminiModel)) {
            setSettings(prev => ({ ...prev, geminiModel: list[0] }));
          }
          await showAlertDialog({
            title: 'Gemini Models',
            message: `Đã tải thành công ${list.length} model Gemini từ API!`,
            type: 'success'
          });
        }
      }
    } catch (err) {
      showAlertDialog({
        title: 'Gemini API Error',
        message: 'Lỗi khi tải danh sách Gemini Models: ' + (err instanceof Error ? err.message : String(err)),
        type: 'error'
      });
    } finally {
      setIsFetchingGemini(false);
    }
  };

  // Gọi API lấy danh sách OpenAI models chính xác theo OpenAI API Key
  const handleFetchOpenAIModels = async (keyToUse?: string) => {
    const key = keyToUse || settings.openaiKey || settings.whisperKey;
    if (!key) {
      showAlertDialog({
        title: 'OpenAI API Key',
        message: 'Vui lòng nhập OpenAI API Key trước khi lấy danh sách model!',
        type: 'warning'
      });
      return;
    }

    setIsFetchingOpenAI(true);
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `API Error (${res.status})`);
      }
      const data = await res.json();
      if (data.data && Array.isArray(data.data)) {
        const list = data.data
          .map((m: { id: string }) => m.id)
          .filter((id: string) => id.startsWith('gpt-'));
        if (list.length > 0) {
          setOpenAIModels(list);
          if (!list.includes(settings.openaiModel)) {
            setSettings(prev => ({ ...prev, openaiModel: list[0] }));
          }
          await showAlertDialog({
            title: 'OpenAI Models',
            message: `Đã tải thành công ${list.length} ChatGPT models từ API!`,
            type: 'success'
          });
        }
      }
    } catch (err) {
      showAlertDialog({
        title: 'OpenAI API Error',
        message: 'Lỗi khi tải danh sách OpenAI Models: ' + (err instanceof Error ? err.message : String(err)),
        type: 'error'
      });
    } finally {
      setIsFetchingOpenAI(false);
    }
  };

  const handleSave = async () => {
    try {
      const payload = {
        ...settings,
        whisperKey: settings.openaiKey || settings.whisperKey
      };
      localStorage.setItem('voicecraft_settings', JSON.stringify(payload));
      onSave?.(payload);
      onClose();
      await showAlertDialog({
        title: 'Settings',
        message: 'Đã lưu cấu hình cài đặt AI Engine & Microphone!',
        type: 'success'
      });
    } catch (err) {
      showAlertDialog({
        title: 'Settings Error',
        message: 'Lỗi khi lưu cài đặt',
        type: 'error'
      });
    }
  };

  const showGeminiSection = settings.providerPreference === 'gemini' || settings.providerPreference === 'auto';
  const showOpenAISection = settings.providerPreference === 'openai' || settings.providerPreference === 'auto';
  const isLocalOnly = settings.providerPreference === 'local';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay background */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
          ></motion.div>

          {/* Dialog Container */}
          <motion.div
            initial={{ scale: 0.95, y: 15, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 15, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-card border border-borderCustom shadow-2xl p-6 z-10 text-white"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-borderCustom mb-6">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-accent" />
                <h3 className="text-lg font-bold">Workspace & AI Engine Settings</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-cardSecondary text-textMuted hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body Tabs / Sections */}
            <div className="space-y-6 max-h-[440px] overflow-y-auto pr-1">
              {/* Keyboard Shortcuts Section */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-textMuted uppercase tracking-wider flex items-center gap-1.5">
                  <Keyboard className="w-3.5 h-3.5" /> Keyboard Shortcuts
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-cardSecondary border border-borderCustom">
                    <span className="text-textSecondary text-[13px]">Record (Toggle)</span>
                    <kbd className="px-2 py-0.5 rounded bg-background border border-borderCustom text-xs font-mono text-accent">Ctrl + R</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-cardSecondary border border-borderCustom">
                    <span className="text-textSecondary text-[13px]">Stop & Save</span>
                    <kbd className="px-2 py-0.5 rounded bg-background border border-borderCustom text-xs font-mono text-accent">Ctrl + S</kbd>
                  </div>
                </div>
              </div>

              {/* Audio Settings */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-textMuted uppercase tracking-wider flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5" /> Audio Engine
                </h4>
                <div className="space-y-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-textSecondary">Default Capture Sample Rate</label>
                    <select
                      value={settings.sampleRate}
                      onChange={(e) => setSettings(prev => ({ ...prev, sampleRate: Number(e.target.value) }))}
                      className="w-full bg-cardSecondary border border-borderCustom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent text-white"
                    >
                      <option value="44100">44.1 kHz (CD Quality)</option>
                      <option value="48000">48.0 kHz (Studio Quality)</option>
                      <option value="22050">22.05 kHz (Low bandwidth)</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between p-1">
                    <span className="text-sm text-textSecondary">Auto-gain control (Microphone)</span>
                    <input
                      type="checkbox"
                      checked={settings.autoGain}
                      onChange={(e) => setSettings(prev => ({ ...prev, autoGain: e.target.checked }))}
                      className="w-4 h-4 accent-accent cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* AI Provider & Dynamic Models Configuration */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-textMuted uppercase tracking-wider flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" /> AI Model & Engine Config
                </h4>

                {/* Provider Selection */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-textSecondary font-semibold">Ưu tiên AI Provider (Preferred Engine)</label>
                  <select
                    value={settings.providerPreference}
                    onChange={(e) => setSettings(prev => ({ ...prev, providerPreference: e.target.value as any }))}
                    className="w-full bg-cardSecondary border border-borderCustom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent text-white font-medium"
                  >
                    <option value="auto">✨ Tự Động (Auto Detect / Fallback)</option>
                    <option value="gemini">♊ Google Gemini API (Gemini Multimodal)</option>
                    <option value="openai">🤖 OpenAI ChatGPT (Whisper + GPT-4o-mini)</option>
                    <option value="local">💻 Local Python Engine (Offline 100%)</option>
                  </select>
                </div>

                {isLocalOnly && (
                  <div className="p-3.5 rounded-xl bg-cardSecondary/80 border border-accent/30 text-xs space-y-1">
                    <div className="font-bold text-accent flex items-center gap-1.5">
                      <Cpu className="w-4 h-4" /> Local Python Engine (Offline Mode)
                    </div>
                    <p className="text-textSecondary leading-relaxed">
                      Sử dụng thư viện Python `SpeechRecognition` & `soundfile` trực tiếp trên máy của bạn. Không cần API Key và không phát sinh chi phí.
                    </p>
                  </div>
                )}

                {/* Google Gemini Config Section */}
                {showGeminiSection && (
                  <div className="p-3.5 rounded-xl bg-cardSecondary/60 border border-borderCustom space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-accent flex items-center gap-1">
                        ♊ Google Gemini API
                      </span>
                      <button
                        type="button"
                        onClick={() => handleFetchGeminiModels()}
                        disabled={isFetchingGemini || !settings.geminiKey}
                        className="text-[11px] font-semibold text-accent hover:text-white flex items-center gap-1 disabled:opacity-40 transition-colors"
                      >
                        <RefreshCw className={`w-3 h-3 ${isFetchingGemini ? 'animate-spin' : ''}`} />
                        {isFetchingGemini ? 'Đang tải...' : 'Lấy danh sách Models từ API'}
                      </button>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-textMuted">Gemini API Key</label>
                      <input
                        type="password"
                        value={settings.geminiKey}
                        onChange={(e) => setSettings(prev => ({ ...prev, geminiKey: e.target.value }))}
                        placeholder="AIzaSy..................."
                        className="w-full bg-card border border-borderCustom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent text-white placeholder-textMuted"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-textMuted">Model chuyên xử lý (Gemini Model)</label>
                      <select
                        value={settings.geminiModel}
                        onChange={(e) => setSettings(prev => ({ ...prev, geminiModel: e.target.value }))}
                        className="w-full bg-card border border-borderCustom rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-accent text-white font-mono"
                      >
                        {geminiModels.map((m) => (
                          <option key={m} value={m} className="bg-card text-white">
                            {m} {m === 'gemini-2.0-flash' ? '(Khuyến nghị)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* OpenAI ChatGPT Config Section */}
                {showOpenAISection && (
                  <div className="p-3.5 rounded-xl bg-cardSecondary/60 border border-borderCustom space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                        🤖 OpenAI ChatGPT Engine
                      </span>
                      <button
                        type="button"
                        onClick={() => handleFetchOpenAIModels()}
                        disabled={isFetchingOpenAI || !settings.openaiKey}
                        className="text-[11px] font-semibold text-emerald-400 hover:text-white flex items-center gap-1 disabled:opacity-40 transition-colors"
                      >
                        <RefreshCw className={`w-3 h-3 ${isFetchingOpenAI ? 'animate-spin' : ''}`} />
                        {isFetchingOpenAI ? 'Đang tải...' : 'Lấy danh sách Models từ API'}
                      </button>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-textMuted">OpenAI API Key</label>
                      <input
                        type="password"
                        value={settings.openaiKey}
                        onChange={(e) => setSettings(prev => ({ ...prev, openaiKey: e.target.value, whisperKey: e.target.value }))}
                        placeholder="sk-proj-................................"
                        className="w-full bg-card border border-borderCustom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent text-white placeholder-textMuted"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-textMuted">Model tạo Từ điển EN-VI (ChatGPT Model)</label>
                      <select
                        value={settings.openaiModel}
                        onChange={(e) => setSettings(prev => ({ ...prev, openaiModel: e.target.value }))}
                        className="w-full bg-card border border-borderCustom rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-accent text-white font-mono"
                      >
                        {openaiModels.map((m) => (
                          <option key={m} value={m} className="bg-card text-white">
                            {m} {m === 'gpt-4o-mini' ? '(Tối ưu chi phí)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-borderCustom">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-cardSecondary hover:bg-cardSecondary/80 border border-borderCustom text-textSecondary hover:text-white transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-accent hover:bg-accent/80 text-white shadow-glow transition-colors"
              >
                Save Settings
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
