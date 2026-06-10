-- FinTrack Migration 011: seed default categories on user signup
--
-- Adds a DB-level trigger that inserts 12 default categories whenever a new
-- user row is created in auth.users.  This runs server-side with SECURITY
-- DEFINER (bypasses RLS) and is immune to client-side JWT/cookie timing
-- issues that caused the previous client-only seed to fail silently.
--
-- The client-side seedDefaultCategories() in use-dashboard.ts is kept as a
-- fallback for users created before this migration was applied (it checks
-- count > 0 so it won't create duplicates).
--
-- Follows the same pattern as handle_new_user() (profile) and
-- handle_new_user_subscription() (billing).
-- Triggers fire alphabetically: ..._categories fires between ..._created
-- and ..._subscription.

CREATE OR REPLACE FUNCTION public.handle_new_user_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.categories (user_id, name, type, color, icon)
  VALUES
    -- Receitas
    (NEW.id, 'Salário',       'income',  '#10B981', 'briefcase'  ),
    (NEW.id, 'Freelance',     'income',  '#6366F1', 'code-2'     ),
    (NEW.id, 'Investimentos', 'income',  '#F59E0B', 'trending-up'),
    -- Despesas
    (NEW.id, 'Moradia',       'expense', '#EF4444', 'home'       ),
    (NEW.id, 'Alimentação',   'expense', '#F97316', 'utensils'   ),
    (NEW.id, 'Transporte',    'expense', '#8B5CF6', 'car'        ),
    (NEW.id, 'Saúde',         'expense', '#14B8A6', 'heart-pulse'),
    (NEW.id, 'Beleza',        'expense', '#F472B6', 'sparkles'   ),
    (NEW.id, 'Lazer',         'expense', '#EC4899', 'gamepad-2'  ),
    (NEW.id, 'Educação',      'expense', '#3B82F6', 'book-open'  ),
    (NEW.id, 'Vestuário',     'expense', '#A855F7', 'shirt'      ),
    (NEW.id, 'Assinaturas',   'expense', '#06B6D4', 'repeat'     );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_categories ON auth.users;
CREATE TRIGGER on_auth_user_created_categories
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_categories();
