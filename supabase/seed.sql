-- FinTrack Seed Data (Development)
-- Run after creating a test user in Supabase Auth
-- Replace 'YOUR_USER_ID' with the actual user UUID

DO $$
DECLARE
  uid UUID := 'YOUR_USER_ID'; -- replace with your auth.users id
  cat_salario UUID;
  cat_freelance UUID;
  cat_investimentos UUID;
  cat_moradia UUID;
  cat_alimentacao UUID;
  cat_transporte UUID;
  cat_lazer UUID;
  cat_saude UUID;
  cat_educacao UUID;
  cat_vestuario UUID;
BEGIN

-- Update profile name
UPDATE public.profiles SET name = 'João Silva' WHERE id = uid;

-- Insert categories
INSERT INTO public.categories (id, user_id, name, type, color, icon) VALUES
  (uuid_generate_v4(), uid, 'Salário', 'income', '#10B981', 'briefcase') RETURNING id INTO cat_salario;

INSERT INTO public.categories (id, user_id, name, type, color, icon) VALUES
  (uuid_generate_v4(), uid, 'Freelance', 'income', '#6366F1', 'code-2') RETURNING id INTO cat_freelance;

INSERT INTO public.categories (id, user_id, name, type, color, icon) VALUES
  (uuid_generate_v4(), uid, 'Investimentos', 'income', '#F59E0B', 'trending-up') RETURNING id INTO cat_investimentos;

INSERT INTO public.categories (id, user_id, name, type, color, icon) VALUES
  (uuid_generate_v4(), uid, 'Moradia', 'expense', '#EF4444', 'home') RETURNING id INTO cat_moradia;

INSERT INTO public.categories (id, user_id, name, type, color, icon) VALUES
  (uuid_generate_v4(), uid, 'Alimentação', 'expense', '#F97316', 'utensils') RETURNING id INTO cat_alimentacao;

INSERT INTO public.categories (id, user_id, name, type, color, icon) VALUES
  (uuid_generate_v4(), uid, 'Transporte', 'expense', '#8B5CF6', 'car') RETURNING id INTO cat_transporte;

INSERT INTO public.categories (id, user_id, name, type, color, icon) VALUES
  (uuid_generate_v4(), uid, 'Lazer', 'expense', '#EC4899', 'gamepad-2') RETURNING id INTO cat_lazer;

INSERT INTO public.categories (id, user_id, name, type, color, icon) VALUES
  (uuid_generate_v4(), uid, 'Saúde', 'expense', '#14B8A6', 'heart-pulse') RETURNING id INTO cat_saude;

INSERT INTO public.categories (id, user_id, name, type, color, icon) VALUES
  (uuid_generate_v4(), uid, 'Educação', 'expense', '#3B82F6', 'book-open') RETURNING id INTO cat_educacao;

INSERT INTO public.categories (id, user_id, name, type, color, icon) VALUES
  (uuid_generate_v4(), uid, 'Vestuário', 'expense', '#A855F7', 'shirt') RETURNING id INTO cat_vestuario;

-- Transactions — last 6 months of realistic data
INSERT INTO public.transactions (user_id, category_id, title, amount, type, date) VALUES
  -- June 2026 (current month)
  (uid, cat_salario,      'Salário Junho',          8500.00, 'income',  '2026-06-05'),
  (uid, cat_moradia,      'Aluguel',                2200.00, 'expense', '2026-06-01'),
  (uid, cat_alimentacao,  'Supermercado Pão de Açúcar', 487.30, 'expense', '2026-06-03'),
  (uid, cat_alimentacao,  'iFood – semana 1',       145.90, 'expense', '2026-06-07'),
  (uid, cat_transporte,   'Gasolina',               280.00, 'expense', '2026-06-08'),
  (uid, cat_saude,        'Farmácia',                87.50, 'expense', '2026-06-10'),
  (uid, cat_freelance,    'Projeto Web App',        2000.00, 'income',  '2026-06-12'),
  (uid, cat_lazer,        'Cinema + jantar',        210.00, 'expense', '2026-06-14'),
  (uid, cat_educacao,     'Curso TypeScript',        99.90, 'expense', '2026-06-15'),

  -- May 2026
  (uid, cat_salario,      'Salário Maio',           8500.00, 'income',  '2026-05-05'),
  (uid, cat_freelance,    'Consultoria DevOps',     3500.00, 'income',  '2026-05-18'),
  (uid, cat_investimentos,'Dividendos FII',          412.00, 'income',  '2026-05-20'),
  (uid, cat_moradia,      'Aluguel',                2200.00, 'expense', '2026-05-01'),
  (uid, cat_alimentacao,  'Supermercado',           523.80, 'expense', '2026-05-04'),
  (uid, cat_alimentacao,  'Restaurante',            198.00, 'expense', '2026-05-14'),
  (uid, cat_transporte,   'Gasolina',               310.00, 'expense', '2026-05-09'),
  (uid, cat_transporte,   'Uber',                    95.40, 'expense', '2026-05-22'),
  (uid, cat_saude,        'Plano de Saúde',         480.00, 'expense', '2026-05-05'),
  (uid, cat_lazer,        'Show Metallica',         350.00, 'expense', '2026-05-28'),
  (uid, cat_vestuario,    'Tênis Nike',             459.90, 'expense', '2026-05-16'),
  (uid, cat_educacao,     'Livros técnicos',        134.70, 'expense', '2026-05-23'),

  -- April 2026
  (uid, cat_salario,      'Salário Abril',          8500.00, 'income',  '2026-04-05'),
  (uid, cat_freelance,    'Landing Page',           1800.00, 'income',  '2026-04-22'),
  (uid, cat_moradia,      'Aluguel',                2200.00, 'expense', '2026-04-01'),
  (uid, cat_moradia,      'Internet',                119.90, 'expense', '2026-04-10'),
  (uid, cat_alimentacao,  'Supermercado',           498.60, 'expense', '2026-04-06'),
  (uid, cat_transporte,   'Gasolina',               290.00, 'expense', '2026-04-11'),
  (uid, cat_saude,        'Dentista',               400.00, 'expense', '2026-04-17'),
  (uid, cat_lazer,        'Netflix + Spotify',       55.90, 'expense', '2026-04-05'),
  (uid, cat_educacao,     'Alura – mensalidade',    119.00, 'expense', '2026-04-05'),

  -- March 2026
  (uid, cat_salario,      'Salário Março',          8500.00, 'income',  '2026-03-05'),
  (uid, cat_investimentos,'Dividendos ITSA4',        289.50, 'income',  '2026-03-15'),
  (uid, cat_moradia,      'Aluguel',                2200.00, 'expense', '2026-03-01'),
  (uid, cat_alimentacao,  'Supermercado',           612.40, 'expense', '2026-03-05'),
  (uid, cat_alimentacao,  'Açaí e lanches',         178.00, 'expense', '2026-03-20'),
  (uid, cat_transporte,   'IPVA + licenciamento',   890.00, 'expense', '2026-03-12'),
  (uid, cat_transporte,   'Gasolina',               305.00, 'expense', '2026-03-14'),
  (uid, cat_saude,        'Farmácia',                65.00, 'expense', '2026-03-18'),
  (uid, cat_lazer,        'Viagem SP',              780.00, 'expense', '2026-03-29'),

  -- February 2026
  (uid, cat_salario,      'Salário Fevereiro',      8500.00, 'income',  '2026-02-05'),
  (uid, cat_freelance,    'App Mobile',             4500.00, 'income',  '2026-02-14'),
  (uid, cat_moradia,      'Aluguel',                2200.00, 'expense', '2026-02-01'),
  (uid, cat_alimentacao,  'Supermercado',           445.20, 'expense', '2026-02-07'),
  (uid, cat_transporte,   'Gasolina',               270.00, 'expense', '2026-02-13'),
  (uid, cat_saude,        'Plano de Saúde',         480.00, 'expense', '2026-02-05'),
  (uid, cat_lazer,        'Carnaval',               650.00, 'expense', '2026-02-25'),
  (uid, cat_vestuario,    'Roupas trabalho',        320.00, 'expense', '2026-02-19'),

  -- January 2026
  (uid, cat_salario,      'Salário Janeiro',        8500.00, 'income',  '2026-01-05'),
  (uid, cat_salario,      '13° Salário (parcela)',  4250.00, 'income',  '2026-01-10'),
  (uid, cat_moradia,      'Aluguel',                2200.00, 'expense', '2026-01-01'),
  (uid, cat_alimentacao,  'Supermercado',           589.00, 'expense', '2026-01-08'),
  (uid, cat_transporte,   'Gasolina',               295.00, 'expense', '2026-01-10'),
  (uid, cat_saude,        'Plano de Saúde',         480.00, 'expense', '2026-01-05'),
  (uid, cat_lazer,        'Reveillon',              420.00, 'expense', '2026-01-02'),
  (uid, cat_educacao,     'Curso UX',               599.00, 'expense', '2026-01-20');

-- Budgets (current month)
INSERT INTO public.budgets (user_id, category_id, amount, month) VALUES
  (uid, cat_moradia,     2500.00, '2026-06-01'),
  (uid, cat_alimentacao,  800.00, '2026-06-01'),
  (uid, cat_transporte,   400.00, '2026-06-01'),
  (uid, cat_lazer,        300.00, '2026-06-01'),
  (uid, cat_saude,        250.00, '2026-06-01'),
  (uid, cat_educacao,     200.00, '2026-06-01'),
  (uid, cat_vestuario,    300.00, '2026-06-01');

-- Savings Goals
INSERT INTO public.savings_goals (user_id, name, target_amount, current_amount, deadline, color, icon) VALUES
  (uid, 'Fundo de Emergência',  30000.00, 18500.00, NULL,         '#10B981', 'shield'),
  (uid, 'Viagem para Europa',   25000.00,  8200.00, '2027-07-01', '#6366F1', 'plane'),
  (uid, 'Notebook Novo',         8000.00,  5600.00, '2026-09-01', '#F59E0B', 'laptop'),
  (uid, 'Entrada do Apartamento',80000.00, 22000.00, '2028-12-01', '#EF4444', 'building-2'),
  (uid, 'Investimento inicial',  50000.00, 31400.00, NULL,         '#8B5CF6', 'trending-up');

END $$;
