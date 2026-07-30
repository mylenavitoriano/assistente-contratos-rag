import { useRef, useState } from 'react';

import logo from '../assets/logo.png';
import type { Contract, HealthStatus } from '../types';
import styles from './Sidebar.module.css';

type SidebarProps = {
  contracts: Contract[];
  loading: boolean;
  uploading: boolean;
  health: HealthStatus | null;
  onUpload: (file: File) => void;
  onRemove: (contract: Contract) => void;
};

const statusLabel: Record<string, string> = {
  ready: 'Sistema pronto',
  loading: 'Carregando modelo de busca',
  idle: 'Iniciando',
  error: 'Falha no modelo de busca',
};

function statusDot(health: HealthStatus | null): string | undefined {
  if (!health || health.dependencies.database === 'down') return styles.dotDown;
  if (health.dependencies.embedder === 'ready') return styles.dotReady;
  if (health.dependencies.embedder === 'error') return styles.dotDown;
  return styles.dotLoading;
}

export function Sidebar({
  contracts,
  loading,
  uploading,
  health,
  onUpload,
  onRemove,
}: SidebarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFiles(files: FileList | null): void {
    const file = files?.[0];
    if (file) onUpload(file);
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <img className={styles.logo} src={logo} alt="Área Incrível" />
        <p className={styles.product}>Assistente de Contratos</p>
        <p className={styles.tagline}>Compra e venda · Rio Claro, SP</p>
      </div>

      <div className={styles.uploadArea}>
        <button
          type="button"
          className={`${styles.dropzone} ${dragging ? styles.dragging : ''}`}
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            handleFiles(event.dataTransfer.files);
          }}
        >
          <span className={styles.dropzoneTitle}>
            {uploading ? 'Indexando contrato…' : 'Adicionar contrato'}
          </span>
          <span className={styles.dropzoneHint}>
            {uploading ? 'Extraindo cláusulas e gerando índices' : 'Arraste um PDF ou clique para escolher'}
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </div>

      <div className={styles.sectionLabel}>
        <span>Contratos indexados</span>
        <span className={styles.count}>{contracts.length}</span>
      </div>

      <div className={styles.list}>
        {loading && contracts.length === 0 && (
          <p className={styles.empty}>Carregando…</p>
        )}

        {!loading && contracts.length === 0 && (
          <p className={styles.empty}>
            Nenhum contrato indexado ainda.
            <br />
            Envie um PDF para começar.
          </p>
        )}

        {contracts.map((contract) => (
          <div key={contract.id} className={styles.item}>
            <div className={styles.itemTop}>
              <span className={styles.itemTitle}>
                {contract.contractNumber ?? contract.filename}
              </span>
            </div>

            {contract.buyerName && (
              <p className={styles.itemBuyer}>{contract.buyerName}</p>
            )}

            <p className={styles.itemMeta}>
              {[contract.totalValue, contract.development]
                .filter(Boolean)
                .join(' · ') || `${contract.pageCount} páginas`}
            </p>

            <button
              type="button"
              className={styles.remove}
              aria-label={`Excluir ${contract.contractNumber ?? contract.filename}`}
              onClick={() => onRemove(contract)}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
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

      <div className={styles.footer}>
        <span className={`${styles.dot} ${statusDot(health)}`} />
        <span>
          {health
            ? (statusLabel[health.dependencies.embedder] ?? 'Sistema pronto')
            : 'Conectando…'}
        </span>
      </div>
    </aside>
  );
}
