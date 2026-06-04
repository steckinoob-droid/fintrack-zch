-- Adiciona suporte a transações recorrentes
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_recurring       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recurrence_interval TEXT CHECK (recurrence_interval IN ('daily','weekly','monthly','yearly')),
  ADD COLUMN IF NOT EXISTS recurrence_parent_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL;

-- Índice para buscar filhos de uma transação recorrente
CREATE INDEX IF NOT EXISTS idx_transactions_parent ON public.transactions(recurrence_parent_id);
