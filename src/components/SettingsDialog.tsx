import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard, Volume2, Key, Sliders } from 'lucide-react';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose }) => {
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
                <h3 className="text-lg font-bold">Workspace Settings</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-cardSecondary text-textMuted hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body Tabs / Sections */}
            <div className="space-y-6 max-h-[400px] overflow-y-auto pr-1">
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
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-cardSecondary border border-borderCustom">
                    <span className="text-textSecondary text-[13px]">Start / Pause</span>
                    <kbd className="px-2 py-0.5 rounded bg-background border border-borderCustom text-xs font-mono text-accent">Space</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-cardSecondary border border-borderCustom">
                    <span className="text-textSecondary text-[13px]">Analyze AI</span>
                    <kbd className="px-2 py-0.5 rounded bg-background border border-borderCustom text-xs font-mono text-accent">Ctrl + Enter</kbd>
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
                    <select className="w-full bg-cardSecondary border border-borderCustom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent text-white">
                      <option value="44100">44.1 kHz (CD Quality)</option>
                      <option value="48000">48.0 kHz (Studio Quality)</option>
                      <option value="22050">22.05 kHz (Low bandwidth)</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between p-1">
                    <span className="text-sm text-textSecondary">Auto-gain control (Microphone)</span>
                    <input type="checkbox" defaultChecked className="w-4 h-4 accent-accent cursor-pointer" />
                  </div>
                </div>
              </div>

              {/* API Configuration */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-textMuted uppercase tracking-wider flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" /> AI Model Keys
                </h4>
                <div className="space-y-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-textSecondary">OpenAI Whisper Cloud Key (Optional)</label>
                    <input
                      type="password"
                      placeholder="sk-................................"
                      className="w-full bg-cardSecondary border border-borderCustom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent text-white placeholder-textMuted"
                    />
                    <p className="text-[10px] text-textMuted">If provided, uses OpenAI Cloud Whisper instead of Google Free API for higher quality.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-borderCustom">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-cardSecondary hover:bg-cardSecondary/80 border border-borderCustom text-textSecondary hover:text-white transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  alert("Settings saved!");
                  onClose();
                }}
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
