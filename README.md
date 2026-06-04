# FinTrack — Personal Finance SaaS

A portfolio-quality personal finance management application built with Next.js 15, Supabase, and shadcn/ui. Designed to showcase production-level architecture, modern UI/UX, and full-stack TypeScript skills.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v3 + custom design tokens |
| Components | shadcn/ui (Radix UI primitives) |
| Auth & Database | Supabase (PostgreSQL + RLS) |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| Fonts | Inter + Plus Jakarta Sans |

## Features

- **Auth** — Login/register with Supabase Auth, protected routes via middleware
- **Dashboard** — KPI cards, area chart, donut chart, recent transactions, budget progress, savings goals overview
- **Transactions** — Full CRUD with search, filter by type, category assignment, date
- **Categories** — Custom income/expense categories with color and icon picker
- **Budgets** — Monthly spending limits per category with visual progress bars
- **Savings Goals** — Track financial goals with deposit flow and deadline tracking
- **Reports** — 4-tab analytics: overview bar charts, expense pie charts, income sources, savings rate trend
- **Settings** — Profile management, password change, logout
- **Dark mode** — Deep navy glassmorphism design, works only in dark mode (finance SaaS aesthetic)
- **Brazilian BRL** — All currency formatted with `Intl.NumberFormat` for pt-BR locale

## Design System

- **Background:** `hsl(220 17% 7%)` — deep navy
- **Cards:** Glassmorphism with `rgba(255,255,255,0.03)` + backdrop blur
- **Primary:** `hsl(160 84% 39%)` — emerald green
- **Typography:** Plus Jakarta Sans (headings) + Inter (body)
- **Spacing:** 4/8px system throughout
- **Charts:** Custom dark-themed tooltips, emerald/red/indigo palette

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Copy `.env.local.example` to `.env.local` and fill in your project URL and anon key
3. Run the migration in the Supabase SQL editor:

```sql
-- Copy contents of supabase/migrations/001_initial.sql
```

4. (Optional) Run the seed data:
```sql
-- Copy supabase/seed.sql, replace YOUR_USER_ID with your auth.users UUID
```

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login + Register pages
│   ├── (dashboard)/     # Protected dashboard routes
│   ├── layout.tsx       # Root layout with fonts + Toaster
│   └── globals.css      # Design tokens + utility classes
├── components/
│   ├── ui/              # shadcn/ui primitives (Button, Input, Dialog, etc.)
│   ├── layout/          # Sidebar, Header, MobileNav
│   ├── shared/          # Logo, Toaster, Skeleton, EmptyState, PageHeader
│   ├── dashboard/       # Dashboard widgets and charts
│   ├── transactions/    # Transaction list + form dialog
│   ├── categories/      # Category management
│   ├── budgets/         # Budget tracking
│   ├── goals/           # Savings goals with deposit flow
│   ├── reports/         # Analytics charts
│   └── settings/        # User profile & security
├── lib/
│   ├── supabase/        # Browser + server Supabase clients
│   ├── hooks/           # useDashboard, useToast
│   ├── utils/           # currency.ts, date.ts, cn.ts
│   └── types/           # Shared TypeScript interfaces
├── middleware.ts         # Auth guard (redirect unauthenticated users)
└── supabase/
    ├── migrations/       # SQL schema with RLS policies
    └── seed.sql          # Realistic 6-month sample data
```

## Security

- Supabase Row Level Security enforced on all tables
- Every table has `user_id` foreign key to `auth.users`
- Policies ensure users can only access their own data
- Middleware guards all dashboard routes server-side

## License

MIT
