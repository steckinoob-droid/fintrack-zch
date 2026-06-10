-- FinTrack: one-time backfill — inserts default categories for every user
-- who has zero categories (created before migration 011 added the trigger).
--
-- Safe to run multiple times: the WHERE NOT EXISTS guard ensures users who
-- already have at least one category (even custom ones) are never touched.
--
-- Run this once in the Supabase SQL Editor.

INSERT INTO public.categories (user_id, name, type, color, icon)
SELECT
  u.id,
  c.name,
  c.type,
  c.color,
  c.icon
FROM auth.users u
CROSS JOIN (
  VALUES
    ('Salário',       'income',  '#10B981', 'briefcase'  ),
    ('Freelance',     'income',  '#6366F1', 'code-2'     ),
    ('Investimentos', 'income',  '#F59E0B', 'trending-up'),
    ('Moradia',       'expense', '#EF4444', 'home'       ),
    ('Alimentação',   'expense', '#F97316', 'utensils'   ),
    ('Transporte',    'expense', '#8B5CF6', 'car'        ),
    ('Saúde',         'expense', '#14B8A6', 'heart-pulse'),
    ('Beleza',        'expense', '#F472B6', 'sparkles'   ),
    ('Lazer',         'expense', '#EC4899', 'gamepad-2'  ),
    ('Educação',      'expense', '#3B82F6', 'book-open'  ),
    ('Vestuário',     'expense', '#A855F7', 'shirt'      ),
    ('Assinaturas',   'expense', '#06B6D4', 'repeat'     )
) AS c(name, type, color, icon)
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories cat WHERE cat.user_id = u.id
);
