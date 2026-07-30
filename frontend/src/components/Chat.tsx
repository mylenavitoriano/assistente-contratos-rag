import { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';

import type { Contract, Message } from '../types';
import { Sources } from './Sources';
import styles from './Chat.module.css';

type ChatProps = {
  contracts: Contract[];
  messages: Message[];
  pending: boolean;
  disabled: boolean;
  disabledReason: string;
  onSend: (question: string) => void;
};

function buildSuggestions(contracts: Contract[]): string[] {
  const withBuyer = contracts.find((contract) => contract.buyerName);
  const withNumber = contracts.find((contract) => contract.contractNumber);
  const withDevelopment = contracts.find((contract) => contract.development);

  return [
    withBuyer
      ? `Qual a multa por distrato do contrato de ${withBuyer.buyerName}?`
      : 'Qual a multa por distrato prevista nos contratos?',
    withDevelopment
      ? `Como funciona o reajuste pelo INCC no empreendimento ${withDevelopment.development}?`
      : 'Como funciona o reajuste pelo INCC?',
    withNumber
      ? `Qual a garantia de impermeabilização do contrato ${withNumber.contractNumber}?`
      : 'Qual o prazo de garantia de impermeabilização?',
  ];
}

export function Chat({
  contracts,
  messages,
  pending,
  disabled,
  disabledReason,
  onSend,
}: ChatProps) {
  const [draft, setDraft] = useState('');
  const suggestions = buildSuggestions(contracts);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 168)}px`;
  }, [draft]);

  function submit(question: string): void {
    const trimmed = question.trim();
    if (trimmed.length < 3 || pending || disabled) return;
    onSend(trimmed);
    setDraft('');
  }

  const empty = messages.length === 0;

  return (
    <section className={styles.panel}>
      <div className={styles.thread} ref={threadRef}>
        {empty ? (
          <div className={styles.welcome}>
            <h1 className={styles.welcomeTitle}>Pergunte sobre os contratos</h1>
            <p className={styles.welcomeText}>
              Respostas baseadas apenas no texto dos contratos indexados, sempre
              com o trecho de origem à vista.
            </p>
            <div className={styles.suggestions}>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className={styles.suggestion}
                  disabled={disabled || pending}
                  onClick={() => submit(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.threadInner}>
            {messages.map((message) =>
              message.role === 'user' ? (
                <div key={message.id} className={styles.userRow}>
                  <div className={styles.userBubble}>{message.content}</div>
                </div>
              ) : (
                <div key={message.id} className={styles.turn}>
                  <div className={styles.assistant}>
                    {message.content ? (
                      <>
                        <Markdown>{message.content}</Markdown>
                        {message.streaming && <span className={styles.caret} />}
                      </>
                    ) : (
                      <span className={styles.thinking}>
                        <span className={styles.spinner} />
                        Consultando os contratos…
                      </span>
                    )}
                  </div>
                  {!message.streaming && <Sources sources={message.sources} />}
                </div>
              ),
            )}
          </div>
        )}
      </div>

      <div className={styles.composerWrap}>
        <div className={styles.composer}>
          <textarea
            ref={inputRef}
            className={styles.input}
            rows={1}
            value={draft}
            disabled={disabled}
            placeholder={
              disabled
                ? disabledReason
                : 'Pergunte sobre prazos, multas, garantias, reajuste…'
            }
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit(draft);
              }
            }}
          />
          <button
            type="button"
            className={styles.send}
            aria-label="Enviar pergunta"
            disabled={draft.trim().length < 3 || pending || disabled}
            onClick={() => submit(draft)}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M8 13V3M8 3L3.5 7.5M8 3l4.5 4.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <p className={styles.hint}>
          As respostas citam o contrato e a cláusula de origem. Confira sempre o
          trecho antes de decidir.
        </p>
      </div>
    </section>
  );
}
