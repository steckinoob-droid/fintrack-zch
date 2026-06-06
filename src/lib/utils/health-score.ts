import type { DashboardData } from "@/lib/types";

export interface HealthScore {
  total: number;              // 0–100
  grade: "A" | "B" | "C" | "D" | "F";
  label: string;
  labelEn: string;
  color: string;              // Tailwind color token
  components: ScoreComponent[];
  tips: string[];             // up to 3 actionable tips (PT)
  tipsEn: string[];
  hasData: boolean;           // false when income is too low to calculate
}

export interface ScoreComponent {
  key: string;
  labelPt: string;
  labelEn: string;
  score: number;              // 0–max
  max: number;
  pct: number;                // 0–100 for the bar
  status: "great" | "good" | "warn" | "bad";
}

// ── Helpers ────────────────────────────────────────────────────────────────

function clamp(n: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, n));
}

function lerp(t: number, ...stops: [at: number, pts: number][]) {
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, va] = stops[i];
    const [b, vb] = stops[i + 1];
    if (t <= b) {
      const p = (t - a) / (b - a);
      return va + p * (vb - va);
    }
  }
  return stops[stops.length - 1][1];
}

// ── Component calculators ──────────────────────────────────────────────────

/**
 * SAVINGS RATE — 35 pts
 * Measures how much of income is kept (income - expenses) / income.
 * Savings transfers to goals count as saving, not spending.
 */
function calcSavingsRate(income: number, expenses: number, savings: number): ScoreComponent {
  const MAX = 35;
  if (income <= 0) {
    return { key: "savings", labelPt: "Taxa de poupança", labelEn: "Savings rate",
             score: 0, max: MAX, pct: 0, status: "bad" };
  }
  const saved = income - expenses - savings;           // liquid left over
  const rate  = clamp(saved / income, -1, 1);          // -100% to +100%

  // Score table: rate → points
  const pts = Math.round(clamp(
    rate <= 0     ? 0 :
    rate <= 0.05  ? lerp(rate,  [0, 0],    [0.05, 6]) :
    rate <= 0.15  ? lerp(rate,  [0.05, 6], [0.15, 18]) :
    rate <= 0.25  ? lerp(rate,  [0.15, 18],[0.25, 27]) :
                    lerp(rate,  [0.25, 27],[0.40, 35]),
    0, MAX
  ));

  return {
    key: "savings",
    labelPt: "Taxa de poupança",
    labelEn: "Savings rate",
    score: pts,
    max: MAX,
    pct: Math.round((pts / MAX) * 100),
    status: pts >= 25 ? "great" : pts >= 15 ? "good" : pts >= 7 ? "warn" : "bad",
  };
}

/**
 * BUDGET DISCIPLINE — 25 pts
 * How well the user stays within their set budgets.
 * No budgets → 12 pts (neutral, not penalized for not using the feature).
 */
function calcBudgetDiscipline(budgets: DashboardData["budgets"]): ScoreComponent {
  const MAX = 25;
  if (!budgets.length) {
    return { key: "budget", labelPt: "Orçamentos", labelEn: "Budget discipline",
             score: 12, max: MAX, pct: 48, status: "warn" };
  }

  const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent    = budgets.reduce((s, b) => s + (b.spent ?? 0), 0);
  if (totalBudgeted <= 0) {
    return { key: "budget", labelPt: "Orçamentos", labelEn: "Budget discipline",
             score: 12, max: MAX, pct: 48, status: "warn" };
  }

  const ratio = totalSpent / totalBudgeted;
  const pts = Math.round(clamp(
    ratio <= 0.5  ? 25 :
    ratio <= 0.8  ? lerp(ratio,  [0.5, 25],  [0.8, 20]) :
    ratio <= 0.95 ? lerp(ratio,  [0.8, 20],  [0.95, 14]) :
    ratio <= 1.0  ? lerp(ratio,  [0.95, 14], [1.0, 8]) :
    ratio <= 1.15 ? lerp(ratio,  [1.0, 8],   [1.15, 2]) :
                    0,
    0, MAX
  ));

  return {
    key: "budget",
    labelPt: "Orçamentos",
    labelEn: "Budget discipline",
    score: pts,
    max: MAX,
    pct: Math.round((pts / MAX) * 100),
    status: pts >= 20 ? "great" : pts >= 14 ? "good" : pts >= 8 ? "warn" : "bad",
  };
}

/**
 * EXPENSE CONTROL — 25 pts
 * Ratio of expenses to income (lower = better).
 */
function calcExpenseControl(income: number, expenses: number): ScoreComponent {
  const MAX = 25;
  if (income <= 0) {
    return { key: "expense", labelPt: "Controle de gastos", labelEn: "Expense control",
             score: 0, max: MAX, pct: 0, status: "bad" };
  }

  const ratio = clamp(expenses / income, 0, 2);
  const pts = Math.round(clamp(
    ratio <= 0.50 ? 25 :
    ratio <= 0.65 ? lerp(ratio, [0.50, 25], [0.65, 20]) :
    ratio <= 0.80 ? lerp(ratio, [0.65, 20], [0.80, 14]) :
    ratio <= 0.90 ? lerp(ratio, [0.80, 14], [0.90, 8]) :
    ratio <= 1.00 ? lerp(ratio, [0.90, 8],  [1.00, 2]) :
                    0,
    0, MAX
  ));

  return {
    key: "expense",
    labelPt: "Controle de gastos",
    labelEn: "Expense control",
    score: pts,
    max: MAX,
    pct: Math.round((pts / MAX) * 100),
    status: pts >= 20 ? "great" : pts >= 14 ? "good" : pts >= 8 ? "warn" : "bad",
  };
}

/**
 * GOALS PROGRESS — 15 pts
 * Average completion % of active savings goals.
 * No goals → 7 pts (neutral).
 */
function calcGoalsProgress(goals: DashboardData["goals"]): ScoreComponent {
  const MAX = 15;
  const active = goals.filter(g => g.target_amount > 0);
  if (!active.length) {
    return { key: "goals", labelPt: "Metas de poupança", labelEn: "Savings goals",
             score: 7, max: MAX, pct: 47, status: "warn" };
  }

  const avgPct = active.reduce((s, g) =>
    s + Math.min(1, g.current_amount / g.target_amount), 0) / active.length;

  const pts = Math.round(clamp(
    avgPct < 0.1  ? 2 :
    avgPct < 0.25 ? lerp(avgPct, [0.1, 2],  [0.25, 6]) :
    avgPct < 0.5  ? lerp(avgPct, [0.25, 6], [0.5, 10]) :
    avgPct < 0.75 ? lerp(avgPct, [0.5, 10], [0.75, 13]) :
                    lerp(avgPct, [0.75, 13], [1.0, 15]),
    0, MAX
  ));

  return {
    key: "goals",
    labelPt: "Metas de poupança",
    labelEn: "Savings goals",
    score: pts,
    max: MAX,
    pct: Math.round((pts / MAX) * 100),
    status: pts >= 12 ? "great" : pts >= 8 ? "good" : pts >= 4 ? "warn" : "bad",
  };
}

// ── Grade & label ──────────────────────────────────────────────────────────

function toGrade(score: number): HealthScore["grade"] {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  if (score >= 30) return "D";
  return "F";
}

const GRADE_META: Record<HealthScore["grade"], { label: string; labelEn: string; color: string }> = {
  A: { label: "Excelente",       labelEn: "Excellent",    color: "emerald" },
  B: { label: "Bom",             labelEn: "Good",         color: "green"   },
  C: { label: "Regular",         labelEn: "Fair",         color: "amber"   },
  D: { label: "Atenção",         labelEn: "Poor",         color: "orange"  },
  F: { label: "Crítico",         labelEn: "Critical",     color: "red"     },
};

// ── Tips generator ─────────────────────────────────────────────────────────

function generateTips(
  components: ScoreComponent[],
  income: number, expenses: number,
  budgets: DashboardData["budgets"],
  goals: DashboardData["goals"],
): { pt: string; en: string }[] {
  const tips: { pt: string; en: string }[] = [];
  const savComp  = components.find(c => c.key === "savings")!;
  const budComp  = components.find(c => c.key === "budget")!;
  const expComp  = components.find(c => c.key === "expense")!;
  const goalComp = components.find(c => c.key === "goals")!;

  // Savings tips
  if (savComp.status === "bad" || savComp.status === "warn") {
    const rate = income > 0 ? Math.round(((income - expenses) / income) * 100) : 0;
    if (rate <= 0) {
      tips.push({
        pt: "Você está gastando mais do que ganha. Corte gastos variáveis imediatamente.",
        en: "You're spending more than you earn. Cut variable expenses immediately.",
      });
    } else {
      tips.push({
        pt: `Sua taxa de poupança é ${rate}%. Meta: chegar a 20% guardando R$ ${Math.round((income * 0.2 - (income - expenses)) / 1) } a mais por mês.`,
        en: `Your savings rate is ${rate}%. Goal: reach 20% by saving R$ ${Math.round((income * 0.2 - (income - expenses)))} more per month.`,
      });
    }
  }

  // Budget tips
  if (budComp.status === "bad" || budComp.status === "warn") {
    const overBudgets = budgets.filter(b => (b.spent ?? 0) > b.amount);
    if (!budgets.length) {
      tips.push({
        pt: "Crie orçamentos por categoria para controlar onde o dinheiro vai.",
        en: "Create category budgets to control where your money goes.",
      });
    } else if (overBudgets.length) {
      tips.push({
        pt: `${overBudgets.length} orçamento(s) estourado(s): ${overBudgets.map(b => b.category?.name).join(", ")}. Reduza esses gastos no próximo mês.`,
        en: `${overBudgets.length} budget(s) exceeded: ${overBudgets.map(b => b.category?.name).join(", ")}. Reduce those next month.`,
      });
    }
  }

  // Expense tips
  if (expComp.status === "bad" || expComp.status === "warn") {
    const ratio = income > 0 ? Math.round((expenses / income) * 100) : 0;
    if (ratio > 90) {
      tips.push({
        pt: `Seus gastos consomem ${ratio}% da renda. Identifique e corte as 3 maiores despesas variáveis.`,
        en: `Your expenses consume ${ratio}% of income. Identify and cut your top 3 variable expenses.`,
      });
    }
  }

  // Goals tips
  if (goalComp.status === "bad" || goalComp.status === "warn") {
    if (!goals.length) {
      tips.push({
        pt: "Defina pelo menos uma meta de poupança para dar direção às suas finanças.",
        en: "Set at least one savings goal to give direction to your finances.",
      });
    } else {
      const avgPct = Math.round(
        goals.reduce((s, g) => s + Math.min(100, (g.current_amount / g.target_amount) * 100), 0)
        / goals.length
      );
      tips.push({
        pt: `Suas metas estão em média ${avgPct}% concluídas. Faça depósitos mensais automáticos.`,
        en: `Your goals are ${avgPct}% complete on average. Set up automatic monthly deposits.`,
      });
    }
  }

  // All good tip
  if (!tips.length) {
    tips.push({
      pt: "Continue assim! Considere aumentar sua meta de poupança para 30%+ da renda.",
      en: "Keep it up! Consider increasing your savings target to 30%+ of income.",
    });
  }

  return tips.slice(0, 3);
}

// ── Main export ────────────────────────────────────────────────────────────

export function calculateHealthScore(data: DashboardData): HealthScore {
  const { monthIncome, monthExpenses, monthSavings, budgets, goals } = data;

  // Insufficient data guard
  if (monthIncome < 50) {
    return {
      total: 0, grade: "F",
      label: "Sem dados", labelEn: "No data",
      color: "muted",
      components: [], tips: ["Adicione suas receitas do mês para calcular o score."],
      tipsEn: ["Add your monthly income to calculate the score."],
      hasData: false,
    };
  }

  const components = [
    calcSavingsRate(monthIncome, monthExpenses, monthSavings),
    calcBudgetDiscipline(budgets),
    calcExpenseControl(monthIncome, monthExpenses),
    calcGoalsProgress(goals),
  ];

  const total = clamp(components.reduce((s, c) => s + c.score, 0));
  const grade = toGrade(total);
  const { label, labelEn, color } = GRADE_META[grade];

  const rawTips = generateTips(components, monthIncome, monthExpenses, budgets, goals);

  return {
    total,
    grade,
    label,
    labelEn,
    color,
    components,
    tips:   rawTips.map(t => t.pt),
    tipsEn: rawTips.map(t => t.en),
    hasData: true,
  };
}
