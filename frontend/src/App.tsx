import { useCallback, useEffect, useState } from 'react';

import { fetchHealth } from './api/client';
import { Chat } from './components/Chat';
import { Sidebar } from './components/Sidebar';
import { Toasts, type Toast } from './components/Toasts';
import { useChat } from './hooks/useChat';
import { useContracts } from './hooks/useContracts';
import type { HealthStatus } from './types';
import styles from './App.module.css';

const TOAST_TIMEOUT = 6000;

export default function App() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, tone: 'ok' | 'error') => {
      const id = globalThis.crypto?.randomUUID?.() ?? String(Date.now());
      setToasts((current) => [...current, { id, message, tone }]);
      window.setTimeout(() => dismiss(id), TOAST_TIMEOUT);
    },
    [dismiss],
  );

  const { contracts, loading, uploading, upload, remove } = useContracts(notify);
  const { messages, pending, send, reset } = useChat(notify);

  useEffect(() => {
    let active = true;

    async function poll(): Promise<void> {
      try {
        const status = await fetchHealth();
        if (active) setHealth(status);
      } catch {
        if (active) setHealth(null);
      }
    }

    void poll();
    const timer = window.setInterval(() => void poll(), 15000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const modelLoading =
    health !== null && health.dependencies.embedder !== 'ready';
  const noContracts = !loading && contracts.length === 0;

  const disabledReason = modelLoading
    ? 'Carregando o modelo de busca, aguarde…'
    : noContracts
      ? 'Envie um contrato para começar a perguntar'
      : '';

  return (
    <div className={styles.shell}>
      <Sidebar
        contracts={contracts}
        loading={loading}
        uploading={uploading}
        health={health}
        onUpload={upload}
        onRemove={remove}
      />

      <div className={styles.column}>
        <header className={styles.topbar}>
          <span className={styles.title}>Consulta de contratos</span>
          <button
            type="button"
            className={styles.newChat}
            disabled={messages.length === 0 || pending}
            onClick={reset}
          >
            Nova conversa
          </button>
        </header>

        <Chat
          messages={messages}
          pending={pending}
          disabled={modelLoading || noContracts}
          disabledReason={disabledReason}
          onSend={send}
        />
      </div>

      <Toasts toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
