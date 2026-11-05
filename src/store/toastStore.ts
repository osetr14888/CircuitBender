import { create } from 'zustand';

export type ToastKind = 'success' | 'info' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  pushToast: (message: string, kind?: ToastKind) => void;
  dismissToast: (id: number) => void;
}

const TOAST_DURATION_MS: Record<ToastKind, number> = {
  success: 4000,
  info: 5000,
  error: 8000,
};

let nextToastId = 0;

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  pushToast: (message, kind = 'info') => {
    if (get().toasts.some((toast) => toast.message === message)) {
      return;
    }
    nextToastId += 1;
    const id = nextToastId;
    set((state) => ({ toasts: [...state.toasts, { id, kind, message }] }));
    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
    }, TOAST_DURATION_MS[kind]);
  },
  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));
