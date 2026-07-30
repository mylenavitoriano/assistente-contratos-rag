import styles from './Toasts.module.css';

export type Toast = {
  id: string;
  message: string;
  tone: 'ok' | 'error';
};

type ToastsProps = {
  toasts: Toast[];
  onDismiss: (id: string) => void;
};

export function Toasts({ toasts, onDismiss }: ToastsProps) {
  if (toasts.length === 0) return null;

  return (
    <div className={styles.stack} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={styles.toast}>
          <span className={`${styles.mark} ${styles[toast.tone]}`} />
          <span>{toast.message}</span>
          <button
            type="button"
            className={styles.close}
            aria-label="Fechar aviso"
            onClick={() => onDismiss(toast.id)}
          >
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path
                d="M1.5 1.5l11 11M12.5 1.5l-11 11"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
