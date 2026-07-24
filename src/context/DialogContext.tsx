import React, { createContext, useContext, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, CheckCircle2, AlertTriangle, AlertCircle, HelpCircle, X } from 'lucide-react';

interface DialogOptions {
  title?: string;
  message: string;
  type?: 'info' | 'success' | 'error' | 'warning';
}

interface PromptOptions {
  title?: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
}

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface DialogContextType {
  alert: (options: string | DialogOptions) => Promise<void>;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'alert' | 'confirm' | 'prompt'>('alert');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'info' | 'success' | 'error' | 'warning'>('info');
  const [placeholder, setPlaceholder] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [confirmLabel, setConfirmLabel] = useState('Confirm');
  const [cancelLabel, setCancelLabel] = useState('Cancel');

  // Ref to store the promise resolution
  const resolverRef = useRef<(value: any) => void>(() => {});

  const alert = (options: string | DialogOptions): Promise<void> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setMode('alert');
      if (typeof options === 'string') {
        setTitle('Notification');
        setMessage(options);
        setType('info');
      } else {
        setTitle(options.title || 'Notification');
        setMessage(options.message);
        setType(options.type || 'info');
      }
      setIsOpen(true);
    });
  };

  const confirm = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setMode('confirm');
      setTitle(options.title || 'Confirm Action');
      setMessage(options.message);
      setConfirmLabel(options.confirmLabel || 'Confirm');
      setCancelLabel(options.cancelLabel || 'Cancel');
      setType('warning');
      setIsOpen(true);
    });
  };

  const prompt = (options: PromptOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setMode('prompt');
      setTitle(options.title || 'Input Required');
      setMessage(options.message);
      setPlaceholder(options.placeholder || '');
      setInputValue(options.defaultValue || '');
      setType('info');
      setIsOpen(true);
    });
  };

  const handleClose = (value: any) => {
    setIsOpen(false);
    // Add small delay to resolve after transition completes
    setTimeout(() => {
      resolverRef.current(value);
    }, 200);
  };

  // Keyboard shortcut listener (Escape to cancel/close, Enter to confirm/submit)
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose(mode === 'confirm' ? false : null);
      } else if (e.key === 'Enter' && mode !== 'prompt') {
        e.preventDefault();
        handleClose(mode === 'confirm' ? true : null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mode]);

  const renderIcon = () => {
    switch (mode) {
      case 'confirm':
        return <HelpCircle className="w-8 h-8 text-amber-400" />;
      case 'prompt':
        return <HelpCircle className="w-8 h-8 text-accent" />;
      case 'alert':
      default:
        if (type === 'success') return <CheckCircle2 className="w-8 h-8 text-emerald-400" />;
        if (type === 'error') return <AlertCircle className="w-8 h-8 text-rose-500" />;
        if (type === 'warning') return <AlertTriangle className="w-8 h-8 text-amber-500" />;
        return <Info className="w-8 h-8 text-sky-400" />;
    }
  };

  return (
    <DialogContext.Provider value={{ alert, confirm, prompt }}>
      {children}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Overlay background */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => mode !== 'prompt' && handleClose(mode === 'confirm' ? false : null)}
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
            ></motion.div>

            {/* Dialog Container */}
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl bg-card border border-borderCustom shadow-2xl p-6 z-10 text-white"
            >
              {/* Close Button (Alert mode only) */}
              {mode === 'alert' && (
                <button
                  onClick={() => handleClose(null)}
                  className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-cardSecondary text-textMuted hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Icon & Title */}
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 mt-0.5">
                  {renderIcon()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white leading-tight">
                    {title}
                  </h3>
                  <div className="mt-2 text-sm text-textSecondary leading-relaxed whitespace-pre-wrap">
                    {message}
                  </div>
                </div>
              </div>

              {/* Prompt Input */}
              {mode === 'prompt' && (
                <div className="mb-6">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-cardSecondary border border-borderCustom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent text-white placeholder-textMuted"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleClose(inputValue);
                      } else if (e.key === 'Escape') {
                        handleClose(null);
                      }
                    }}
                  />
                </div>
              )}

              {/* Buttons Footer */}
              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-borderCustom">
                {mode === 'alert' ? (
                  <button
                    onClick={() => handleClose(null)}
                    className="px-5 py-2 text-sm font-semibold rounded-lg bg-accent hover:bg-accent/80 text-white shadow-glow transition-colors"
                  >
                    OK
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleClose(mode === 'confirm' ? false : null)}
                      className="px-4 py-2 text-sm font-semibold rounded-lg bg-cardSecondary hover:bg-cardSecondary/80 border border-borderCustom text-textSecondary hover:text-white transition-colors"
                    >
                      {mode === 'confirm' ? cancelLabel : 'Cancel'}
                    </button>
                    <button
                      onClick={() => handleClose(mode === 'confirm' ? true : inputValue)}
                      className={`px-5 py-2 text-sm font-semibold rounded-lg text-white shadow-glow transition-colors ${
                        type === 'error'
                          ? 'bg-danger hover:bg-danger/80'
                          : type === 'warning'
                          ? 'bg-amber-500 hover:bg-amber-600'
                          : 'bg-accent hover:bg-accent/80'
                      }`}
                    >
                      {mode === 'confirm' ? confirmLabel : 'OK'}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DialogContext.Provider>
  );
};
