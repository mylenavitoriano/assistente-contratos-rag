import { useCallback, useEffect, useState } from 'react';

import { fetchContracts, removeContract, uploadContract } from '../api/client';
import type { Contract } from '../types';

export function useContracts(notify: (message: string, tone: 'ok' | 'error') => void) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const reload = useCallback(async () => {
    try {
      setContracts(await fetchContracts());
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Falha ao carregar contratos.',
        'error',
      );
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const contract = await uploadContract(file);
        setContracts((current) => [contract, ...current]);
        notify(
          `${contract.contractNumber ?? contract.filename} indexado em ${contract.chunkCount} trechos.`,
          'ok',
        );
      } catch (error) {
        notify(
          error instanceof Error ? error.message : 'Falha ao enviar o contrato.',
          'error',
        );
      } finally {
        setUploading(false);
      }
    },
    [notify],
  );

  const remove = useCallback(
    async (contract: Contract) => {
      const label = contract.contractNumber ?? contract.filename;
      if (!window.confirm(`Excluir ${label} e todos os seus trechos indexados?`)) {
        return;
      }

      const previous = contracts;
      setContracts((current) => current.filter((item) => item.id !== contract.id));

      try {
        await removeContract(contract.id);
        notify(`${label} removido.`, 'ok');
      } catch (error) {
        setContracts(previous);
        notify(
          error instanceof Error ? error.message : 'Falha ao excluir o contrato.',
          'error',
        );
      }
    },
    [contracts, notify],
  );

  return { contracts, loading, uploading, upload, remove };
}
