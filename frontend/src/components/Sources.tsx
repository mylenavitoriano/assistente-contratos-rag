import { useState } from 'react';

import type { Source } from '../types';
import styles from './Chat.module.css';

type SourcesProps = {
  sources: Source[];
};

function pageLabel(source: Source): string | null {
  if (!source.pageStart) return null;
  return source.pageEnd && source.pageEnd !== source.pageStart
    ? `páginas ${source.pageStart}–${source.pageEnd}`
    : `página ${source.pageStart}`;
}

export function Sources({ sources }: SourcesProps) {
  const [open, setOpen] = useState(false);

  if (sources.length === 0) return null;

  return (
    <div className={styles.sourcesBlock}>
      <button
        type="button"
        className={styles.sourcesToggle}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg
          className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden
        >
          <path
            d="M2 3.5L5 6.5L8 3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {open ? 'Ocultar fontes' : `${sources.length} fontes consultadas`}
      </button>

      {open && (
        <div className={styles.sourceList}>
          {sources.map((source) => (
            <article key={source.index} className={styles.source}>
              <div className={styles.sourceHead}>
                <span className={styles.sourceIndex}>[{source.index}]</span>
                <span className={styles.sourceTitle}>
                  {source.contractNumber ?? source.filename}
                </span>
                <span className={styles.sourceMeta}>
                  {[source.heading, pageLabel(source), source.buyerName]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
              <p className={styles.sourceExcerpt}>{source.excerpt}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
