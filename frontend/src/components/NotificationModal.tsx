import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  createdAt: number;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'primary';
  icon?: 'trash' | 'alert' | 'help' | 'info';
}

export interface PromptOptions {
  title?: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  inputType?: 'text' | 'password';
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'primary';
  required?: boolean;
}

export interface AlertModalOptions {
  title?: string;
  message: string;
  buttonText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'primary';
}

// Global Event Emitter for Toasts and Modals
type EventCallback = (data: any) => void;

class NotificationBus {
  private listeners: { [event: string]: EventCallback[] } = {};

  on(event: string, cb: EventCallback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }

  off(event: string, cb: EventCallback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(l => l !== cb);
  }

  emit(event: string, data?: any) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(cb => cb(data));
  }
}

const bus = new NotificationBus();

// Public helper functions to trigger from anywhere in the app
export const toast = {
  success: (message: string, title?: string, duration = 4000) => {
    bus.emit('toast', { type: 'success', message, title, duration });
  },
  error: (message: string, title?: string, duration = 5000) => {
    bus.emit('toast', { type: 'error', message, title, duration });
  },
  warning: (message: string, title?: string, duration = 4500) => {
    bus.emit('toast', { type: 'warning', message, title, duration });
  },
  info: (message: string, title?: string, duration = 4000) => {
    bus.emit('toast', { type: 'info', message, title, duration });
  },
};

export const showConfirm = (options: ConfirmOptions): Promise<boolean> => {
  return new Promise<boolean>((resolve) => {
    bus.emit('confirm', { ...options, resolve });
  });
};

export const showPrompt = (options: PromptOptions): Promise<string | null> => {
  return new Promise<string | null>((resolve) => {
    bus.emit('prompt', { ...options, resolve });
  });
};

export const showAlert = (messageOrOptions: string | AlertModalOptions, title?: string): Promise<void> => {
  return new Promise<void>((resolve) => {
    const opts: AlertModalOptions = typeof messageOrOptions === 'string'
      ? { message: messageOrOptions, title }
      : messageOrOptions;
    bus.emit('alert-modal', { ...opts, resolve });
  });
};

// Safe monkey-patch of window.alert to completely eliminate "localhost says:"
if (typeof window !== 'undefined') {
  const originalAlert = window.alert;
  window.alert = (msg: any) => {
    const text = String(msg ?? '');
    // Choose appropriate toast type based on text content
    if (text.toLowerCase().includes('lỗi') || text.toLowerCase().includes('error') || text.toLowerCase().includes('thất bại')) {
      toast.error(text, 'Thông báo lỗi');
    } else if (text.toLowerCase().includes('cảnh báo') || text.toLowerCase().includes('warning') || text.toLowerCase().includes('chú ý')) {
      toast.warning(text, 'Cảnh báo');
    } else if (text.toLowerCase().includes('thành công') || text.toLowerCase().includes('đã thêm') || text.toLowerCase().includes('đã xóa') || text.toLowerCase().includes('đã sao chép')) {
      toast.success(text, 'Thành công');
    } else {
      toast.info(text, 'Thông báo');
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST ITEM COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const ToastCard: React.FC<{
  item: ToastItem;
  onClose: (id: string) => void;
}> = ({ item, onClose }) => {
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const duration = item.duration || 4000;
  const startTimeRef = useRef<number>(Date.now());
  const remainingRef = useRef<number>(duration);

  useEffect(() => {
    if (isPaused) return;

    startTimeRef.current = Date.now();
    const interval = 30; // update frequency in ms

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const left = Math.max(0, remainingRef.current - elapsed);
      const pct = (left / duration) * 100;
      setProgress(pct);

      if (left <= 0) {
        clearInterval(timer);
        onClose(item.id);
      }
    }, interval);

    return () => {
      clearInterval(timer);
      const elapsed = Date.now() - startTimeRef.current;
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    };
  }, [isPaused, duration, item.id, onClose]);

  // Visual styles by type
  const config = {
    success: {
      border: 'border-emerald-200/90',
      bg: 'bg-white/95',
      shadow: 'shadow-emerald-500/10',
      iconBg: 'bg-emerald-50 text-emerald-600',
      progressBg: 'bg-emerald-500',
      titleColor: 'text-emerald-950',
      badge: 'Thành công',
      Icon: CheckCircle2,
    },
    error: {
      border: 'border-rose-200/90',
      bg: 'bg-white/95',
      shadow: 'shadow-rose-500/10',
      iconBg: 'bg-rose-50 text-rose-600',
      progressBg: 'bg-rose-500',
      titleColor: 'text-rose-950',
      badge: 'Lỗi phát sinh',
      Icon: AlertCircle,
    },
    warning: {
      border: 'border-amber-200/90',
      bg: 'bg-white/95',
      shadow: 'shadow-amber-500/10',
      iconBg: 'bg-amber-50 text-amber-600',
      progressBg: 'bg-amber-500',
      titleColor: 'text-amber-950',
      badge: 'Cảnh báo',
      Icon: AlertTriangle,
    },
    info: {
      border: 'border-orange-200/90',
      bg: 'bg-white/95',
      shadow: 'shadow-orange-500/10',
      iconBg: 'bg-orange-50 text-orange-600',
      progressBg: 'bg-orange-500',
      titleColor: 'text-orange-950',
      badge: 'Culina AI',
      Icon: Info,
    },
  }[item.type];

  const IconComponent = config.Icon;

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`pointer-events-auto relative w-full overflow-hidden rounded-2xl border ${config.border} ${config.bg} p-4 shadow-xl ${config.shadow} backdrop-blur-md transition-all duration-300 hover:shadow-2xl animate-in slide-in-from-top-3 sm:slide-in-from-right-4 fade-in duration-200`}
    >
      <div className="flex items-start gap-3.5">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.iconBg} shadow-sm`}>
          <IconComponent className="h-5 w-5" />
        </div>
        <div className="flex-1 pr-2 pt-0.5">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {config.badge}
            </span>
            {item.title && (
              <h5 className={`text-xs font-bold ${config.titleColor} truncate`}>
                {item.title}
              </h5>
            )}
          </div>
          <p className="text-xs font-medium text-slate-700 leading-relaxed break-words">
            {item.message}
          </p>
        </div>
        <button
          onClick={() => onClose(item.id)}
          className="shrink-0 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          aria-label="Đóng thông báo"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress countdown indicator */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100">
        <div
          className={`h-full ${config.progressBg} transition-all duration-75`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION CONTAINER COMPONENT (Toast + Confirm + Prompt + Alert)
// ─────────────────────────────────────────────────────────────────────────────
export const NotificationContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Confirm Modal state
  const [confirmData, setConfirmData] = useState<(ConfirmOptions & { resolve: (val: boolean) => void }) | null>(null);

  // Prompt Modal state
  const [promptData, setPromptData] = useState<(PromptOptions & { resolve: (val: string | null) => void }) | null>(null);
  const [promptInput, setPromptInput] = useState<string>('');
  const [promptError, setPromptError] = useState<string>('');
  const promptInputRef = useRef<HTMLInputElement>(null);

  // Alert Modal state
  const [alertData, setAlertData] = useState<(AlertModalOptions & { resolve: () => void }) | null>(null);

  useEffect(() => {
    // 1. Toast handler
    const handleToast = (payload: { type: ToastType; message: string; title?: string; duration?: number }) => {
      const newToast: ToastItem = {
        id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        duration: payload.duration || 4000,
        createdAt: Date.now(),
      };
      setToasts(prev => [newToast, ...prev].slice(0, 5)); // Keep max 5 visible toasts
    };

    // 2. Confirm handler
    const handleConfirm = (payload: ConfirmOptions & { resolve: (val: boolean) => void }) => {
      setConfirmData(payload);
    };

    // 3. Prompt handler
    const handlePrompt = (payload: PromptOptions & { resolve: (val: string | null) => void }) => {
      setPromptData(payload);
      setPromptInput(payload.defaultValue || '');
      setPromptError('');
      setTimeout(() => {
        promptInputRef.current?.focus();
        promptInputRef.current?.select();
      }, 50);
    };

    // 4. Alert modal handler
    const handleAlertModal = (payload: AlertModalOptions & { resolve: () => void }) => {
      setAlertData(payload);
    };

    bus.on('toast', handleToast);
    bus.on('confirm', handleConfirm);
    bus.on('prompt', handlePrompt);
    bus.on('alert-modal', handleAlertModal);

    return () => {
      bus.off('toast', handleToast);
      bus.off('confirm', handleConfirm);
      bus.off('prompt', handlePrompt);
      bus.off('alert-modal', handleAlertModal);
    };
  }, []);

  const handleCloseToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleConfirmAction = (confirmed: boolean) => {
    if (confirmData) {
      confirmData.resolve(confirmed);
      setConfirmData(null);
    }
  };

  const handlePromptSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!promptData) return;

    if (promptData.required && !promptInput.trim()) {
      setPromptError('Trường này không được để trống.');
      return;
    }

    promptData.resolve(promptInput);
    setPromptData(null);
    setPromptInput('');
    setPromptError('');
  };

  const handlePromptCancel = () => {
    if (promptData) {
      promptData.resolve(null);
      setPromptData(null);
      setPromptInput('');
      setPromptError('');
    }
  };

  const handleAlertDismiss = () => {
    if (alertData) {
      alertData.resolve();
      setAlertData(null);
    }
  };

  return (
    <>
      {/* ── Toast Floating Stack ────────────────────────────────────────── */}
      <div
        className="fixed top-5 right-4 sm:right-6 z-[99999] flex flex-col gap-3 max-w-sm sm:max-w-md w-full pointer-events-none"
        aria-live="polite"
      >
        {toasts.map(toastItem => (
          <ToastCard
            key={toastItem.id}
            item={toastItem}
            onClose={handleCloseToast}
          />
        ))}
      </div>

      {/* ── Confirm Dialog Modal ──────────────────────────────────────── */}
      {confirmData && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200/90 relative overflow-hidden animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Top decorative accent */}
            <div
              className={`absolute top-0 left-0 right-0 h-1.5 ${
                confirmData.variant === 'danger'
                  ? 'bg-rose-500'
                  : confirmData.variant === 'warning'
                  ? 'bg-amber-500'
                  : 'bg-orange-500'
              }`}
            />

            <div className="flex items-start gap-4 mb-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                  confirmData.variant === 'danger'
                    ? 'bg-rose-100 text-rose-600'
                    : confirmData.variant === 'warning'
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-orange-100 text-orange-600'
                }`}
              >
                {confirmData.variant === 'danger' ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : confirmData.variant === 'warning' ? (
                  <AlertCircle className="w-6 h-6" />
                ) : (
                  <HelpCircle className="w-6 h-6" />
                )}
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Xác nhận hành động
                </span>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                  {confirmData.title || 'Bạn có chắc chắn?'}
                </h3>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed mb-6 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              {confirmData.message}
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => handleConfirmAction(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs sm:text-sm hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {confirmData.cancelText || 'Hủy bỏ'}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmAction(true)}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-lg transition-all cursor-pointer ${
                  confirmData.variant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25'
                    : confirmData.variant === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/25'
                    : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-orange-500/25'
                }`}
              >
                {confirmData.confirmText || 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Prompt Dialog Modal ───────────────────────────────────────── */}
      {promptData && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <form
            onSubmit={handlePromptSubmit}
            className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200/90 relative overflow-hidden animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Top decorative accent */}
            <div
              className={`absolute top-0 left-0 right-0 h-1.5 ${
                promptData.variant === 'danger'
                  ? 'bg-rose-500'
                  : 'bg-orange-500'
              }`}
            />

            <div className="flex items-start gap-4 mb-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                  promptData.variant === 'danger'
                    ? 'bg-rose-100 text-rose-600'
                    : 'bg-orange-100 text-orange-600'
                }`}
              >
                {promptData.variant === 'danger' ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : (
                  <Sparkles className="w-6 h-6" />
                )}
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Yêu cầu nhập thông tin
                </span>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                  {promptData.title || 'Nhập dữ liệu'}
                </h3>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              {promptData.message}
            </p>

            <div className="mb-5">
              <input
                ref={promptInputRef}
                type={promptData.inputType || 'text'}
                value={promptInput}
                onChange={(e) => {
                  setPromptInput(e.target.value);
                  if (promptError) setPromptError('');
                }}
                placeholder={promptData.placeholder || 'Nhập vào đây...'}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15 transition-all bg-slate-50 focus:bg-white"
              />
              {promptError && (
                <p className="text-xs text-rose-600 font-semibold mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {promptError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handlePromptCancel}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs sm:text-sm hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {promptData.cancelText || 'Hủy bỏ'}
              </button>
              <button
                type="submit"
                className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-lg transition-all cursor-pointer ${
                  promptData.variant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25'
                    : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-orange-500/25'
                }`}
              >
                {promptData.confirmText || 'Đồng ý'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Alert Modal ──────────────────────────────────────────────── */}
      {alertData && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200/90 relative overflow-hidden animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div
              className={`absolute top-0 left-0 right-0 h-1.5 ${
                alertData.variant === 'danger'
                  ? 'bg-rose-500'
                  : alertData.variant === 'warning'
                  ? 'bg-amber-500'
                  : 'bg-orange-500'
              }`}
            />

            <div className="flex items-start gap-4 mb-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                  alertData.variant === 'danger'
                    ? 'bg-rose-100 text-rose-600'
                    : alertData.variant === 'warning'
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-orange-100 text-orange-600'
                }`}
              >
                {alertData.variant === 'danger' ? (
                  <AlertCircle className="w-6 h-6" />
                ) : alertData.variant === 'warning' ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : (
                  <Info className="w-6 h-6" />
                )}
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Thông báo hệ thống
                </span>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                  {alertData.title || 'Thông báo'}
                </h3>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed mb-6 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              {alertData.message}
            </p>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={handleAlertDismiss}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/25 transition-all cursor-pointer"
              >
                {alertData.buttonText || 'Đã hiểu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
