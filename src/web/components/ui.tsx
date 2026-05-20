import React, { createContext, useCallback, useContext, useState } from 'react';

export const Card: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = '' }) => (
  <div className={`bg-white rounded-lg border border-slate-200 shadow-sm ${className}`}>
    {children}
  </div>
);

export const CardHeader: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = '' }) => (
  <div className={`px-5 py-3 border-b border-slate-200 flex items-center justify-between ${className}`}>
    {children}
  </div>
);

export const CardBody: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = '' }) => (
  <div className={`p-5 ${className}`}>{children}</div>
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  ...rest
}) => {
  const sizeCls = size === 'sm' ? 'px-3 py-1 text-sm' : 'px-4 py-2 text-sm';
  const variantCls = {
    primary: 'bg-violet-600 hover:bg-violet-700 text-white shadow-sm',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm',
    ghost: 'hover:bg-slate-100 text-slate-700',
  }[variant];
  return (
    <button
      {...rest}
      className={`inline-flex items-center gap-1.5 rounded-md font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${sizeCls} ${variantCls} ${className}`}
    />
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...rest }) => (
  <input
    {...rest}
    className={`w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent ${className}`}
  />
);

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className = '', ...rest }) => (
  <textarea
    {...rest}
    className={`w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent font-mono ${className}`}
  />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className = '', ...rest }) => (
  <select
    {...rest}
    className={`rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 ${className}`}
  />
);

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const color = {
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    running: 'bg-amber-100 text-amber-800',
    claimed: 'bg-amber-100 text-amber-800',
    pending: 'bg-slate-100 text-slate-700',
    cancelled: 'bg-slate-200 text-slate-700',
  }[status] ?? 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {status}
    </span>
  );
};

export const ProgressBar: React.FC<{ done: number; total: number; failed?: number }> = ({
  done,
  total,
  failed = 0,
}) => {
  if (total === 0) return <div className="h-2 bg-slate-200 rounded-full" />;
  const donePct = (done / total) * 100;
  const failPct = (failed / total) * 100;
  return (
    <div className="h-2 bg-slate-200 rounded-full overflow-hidden flex">
      <div className="bg-green-500" style={{ width: `${donePct}%` }} />
      <div className="bg-red-500" style={{ width: `${failPct}%` }} />
    </div>
  );
};

export const Spinner: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    className={`animate-spin h-4 w-4 ${className}`}
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

export const Empty: React.FC<{ title: string; hint?: string }> = ({ title, hint }) => (
  <div className="text-center py-10 text-slate-500">
    <div className="text-base font-medium">{title}</div>
    {hint ? <div className="text-sm mt-1">{hint}</div> : null}
  </div>
);

export const ErrorMessage: React.FC<{ error: string | null }> = ({ error }) =>
  error ? (
    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-2 rounded-md text-sm">
      {error}
    </div>
  ) : null;

// ── Toast system ────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info';
type ToastItem = { id: string; message: string; type: ToastType };

const ToastContext = createContext<(message: string, type: ToastType) => void>(() => {});

const TOAST_COLORS: Record<ToastType, string> = {
  success: 'bg-green-800 text-white',
  error: 'bg-red-700 text-white',
  info: 'bg-slate-800 text-white',
};

const ToastBubble: React.FC<{ toast: ToastItem; onDismiss: () => void }> = ({ toast, onDismiss }) => (
  <div
    className={`flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg text-sm animate-fade-in ${TOAST_COLORS[toast.type]}`}
    role="alert"
  >
    <span className="flex-1">{toast.message}</span>
    <button onClick={onDismiss} className="opacity-70 hover:opacity-100 text-lg leading-none shrink-0">×</button>
  </div>
);

export const ToastProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const add = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={add}>
      {children}
      <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-50 w-80 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastBubble
              toast={t}
              onDismiss={() => setToasts((s) => s.filter((x) => x.id !== t.id))}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const add = useContext(ToastContext);
  return {
    success: (msg: string) => add(msg, 'success'),
    error: (msg: string) => add(msg, 'error'),
    info: (msg: string) => add(msg, 'info'),
  };
}

// ── Confirm dialog ──────────────────────────────────────────────────────────

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600">{message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
};
