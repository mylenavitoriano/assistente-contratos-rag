export type Contract = {
  id: string;
  filename: string;
  sizeBytes: number;
  pageCount: number;
  chunkCount: number;
  contractNumber: string | null;
  buyerName: string | null;
  development: string | null;
  totalValue: string | null;
  deliveryTerm: string | null;
  signedAt: string | null;
  createdAt: string;
};

export type Source = {
  index: number;
  contractId: string;
  contractNumber: string | null;
  filename: string;
  buyerName: string | null;
  clauseNumber: number | null;
  heading: string;
  excerpt: string;
  pageStart: number | null;
  pageEnd: number | null;
};

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: Source[];
  streaming?: boolean;
};

export type HealthStatus = {
  status: string;
  dependencies: {
    database: 'up' | 'down';
    embedder: 'idle' | 'loading' | 'ready' | 'error';
  };
};
