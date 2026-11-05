import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useToastStore } from '../store/toastStore';
import type { ToastKind } from '../store/toastStore';

const TOAST_ICONS: Record<ToastKind, LucideIcon> = {
  success: CheckCircle2,
  info: Info,
  error: AlertTriangle,
};

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);
  const dismissToast = useToastStore((state) => state.dismissToast);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-stack" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = TOAST_ICONS[toast.kind];
        return (
          <div
            key={toast.id}
            className={`toast toast-${toast.kind}`}
            role={toast.kind === 'error' ? 'alert' : 'status'}
          >
            <Icon className="toast-icon" size={18} aria-hidden="true" />
            <span className="toast-message">{toast.message}</span>
            <button
              type="button"
              className="toast-dismiss"
              aria-label="Dismiss notification"
              onClick={() => dismissToast(toast.id)}
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
