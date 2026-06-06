import type { DashboardData } from "@/lib/types";

export interface TipItem {
  text: string;
  href?: string;
}

export interface HealthScore {
  total: number;              // 0–100
  grade: "A" | "B" | "C" | "D" | "F";
  label: string;
  labelEn: string;
  color: string;              // Tailwind color token
  components: ScoreComponent[];
  tips: TipItem[];            // up to 3 actionable tips (PT)
  tipsEn: TipItem[];
  hasData: boolean;           // false when income is too low to calculate
}

export interface ScoreComponent {
  key: string;
  labelPt: string;
  labelEn: string;
  score: number;              // 0–max (internal)
  max: number;
  pct: number;                // 0–100 for the bar
  status: "great" | "good" | "warn" | "bad";
  contextPt: string;          // human-readable current value shown in UI
  contextEn: string;
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
 * How much of income is kept after all spending (including goal deposits,
 * which are legitimate savings). Formula: (income - expenses) / income.
 *
 * NOTE: goal deposits (monthSavings) are NOT subtracted here — depositing
 * to a goal IS saving, and should be rewarded, not penalized.
 */
function calcSavingsRate(income: number, expenses: number): ScoreComponent {
  const MAX = 35;
  const ratePct = income > 0 ? Math.round(((income - expenses) / income) * 100) : 0;

  if (income <= 0) {
    return {
      key: "savings", labelPt: "Taxa de poupança", labelEn: "Savings rate",
      score: 0, max: MAX, pct: 0, status: "bad",
      contextPt: "Sem renda registrada", contextEn: "No income recorded",
    };
  }

  const rate = clamp((income - expenses) / income, -1, 1);
  const pts  = Math.round(clamp(
    rate <= 0     ? 0 :
    rate <= 0.05  ? lerp(rate, [0, 0],     [0.05, 6]) :
    rate <= 0.15  ? lerp(rate, [0.05, 6],  [0.15, 18]) :
    rate <= 0.25  ? lerp(rate, [0.15, 18], [0.25, 27]) :
                    lerp(rate, [0.25, 27],  [0.40, 35]),
    0, MAX
  ));

  const contextPt = ratePct <= 0
    ? `Gastos ${Math.abs(ratePct)}% acima da renda`
    : `${ratePct}% da renda economizado`;
  const contextEn = ratePct <= 0
    ? `Spending ${Math.abs(ratePct)}% above income`
    : `${ratePct}% of income unspent`;

  return {
    key: "savings", labelPt: "Taxa de poupança", labelEn: "Savings rate",
    score: pts, max: MAX, pct: Math.round((pts / MAX) * 100),
    status: pts >= 25 ? "great" : pts >= 15 ? "good" : pts >= 7 ? "warn" : "bad",
    contextPt, contextEn,
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
    return {
      key: "budget", labelPt: "Orçamentos", labelEn: "Budgets",
      score: 12, max: MAX, pct: 48, status: "warn",
      contextPt: "Nenhum orçamento definido", contextEn: "No budgets set",
    };
  }

  const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent    = budgets.reduce((s, b) => s + (b.spent ?? 0), 0);
  if (totalBudgeted <= 0) {
    return {
      key: "budget", labelPt: "Orçamentos", labelEn: "Budgets",
      score: 12, max: MAX, pct: 48, status: "warn",
      contextPt: "Nenhum orçamento definido", contextEn: "No budgets set",
    };
  }

  const ratio   = totalSpent / totalBudgeted;
  const usedPct = Math.round(ratio * 100);
  const pts = Math.round(clamp(
    ratio <= 0.5  ? 25 :
    ratio <= 0.8  ? lerp(ratio, [0.5, 25],  [0.8, 20]) :
    ratio <= 0.95 ? lerp(ratio, [0.8, 20],  [0.95, 14]) :
    ratio <= 1.0  ? lerp(ratio, [0.95, 14], [1.0, 8]) :
    ratio <= 1.15 ? lerp(ratio, [1.0, 8],   [1.15, 2]) :
                    0,
    0, MAX
  ));

  const overBudget = budgets.filter(b => (b.spent ?? 0) > b.amount).length;
  const contextPt = overBudget > 0
    ? `${overBudget} orçamento(s) estourado(s)`
    : `${usedPct}% do orçamento usado`;
  const contextEn = overBudget > 0
    ? `${overBudget} budget(s) exceeded`
    : `${usedPct}% of budget used`;

  return {
    key: "budget", labelPt: "Orçamentos", labelEn: "Budgets",
    score: pts, max: MAX, pct: Math.round((pts / MAX) * 100),
    status: pts >= 20 ? "great" : pts >= 14 ? "good" : pts >= 8 ? "warn" : "bad",
    contextPt, contextEn,
  };
}

/**
 * EXPENSE CONTROL — 25 pts
 * Ratio of expenses to income (lower = better).
 */
function calcExpenseControl(income: number, expenses: number): ScoreComponent {
  const MAX = 25;
  if (income <= 0) {
    return {
      key: "expense", labelPt: "Gastos vs. renda", labelEn: "Spending ratio",
      score: 0, max: MAX, pct: 0, status: "bad",
      contextPt: "Sem renda registrada", contextEn: "No income recorded",
    };
  }

  const ratio    = clamp(expenses / income, 0, 2);
  const spentPct = Math.round(ratio * 100);
  const pts = Math.round(clamp(
    ratio <= 0.50 ? 25 :
    ratio <= 0.65 ? lerp(ratio, [0.50, 25], [0.65, 20]) :
    ratio <= 0.80 ? lerp(ratio, [0.65, 20], [0.80, 14]) :
    ratio <= 0.90 ? lerp(ratio, [0.80, 14], [0.90, 8]) :
    ratio <= 1.00 ? lerp(ratio, [0.90, 8],  [1.00, 2]) :
                    0,
    0, MAX
  ));

  const contextPt = `${spentPct}% da renda em gastos`;
  const contextEn = `${spentPct}% of income spent`;

  return {
    key: "expense", labelPt: "Gastos vs. renda", labelEn: "Spending ratio",
    score: pts, max: MAX, pct: Math.round((pts / MAX) * 100),
    status: pts >= 20 ? "great" : pts >= 14 ? "good" : pts >= 8 ? "warn" : "bad",
    contextPt, contextEn,
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
    return {
      key: "goals", labelPt: "Progresso das metas", labelEn: "Goal progress",
      score: 7, max: MAX, pct: 47, status: "warn",
      contextPt: "Nenhuma meta definida", contextEn: "No goals set",
    };
  }

  const avgPct = active.reduce((s, g) =>
    s + Math.min(1, g.current_amount / g.target_amount), 0) / active.length;
  const avgPctRounded = Math.round(avgPct * 100);

  const pts = Math.round(clamp(
    avgPct < 0.1  ? 2 :
    avgPct < 0.25 ? lerp(avgPct, [0.1, 2],   [0.25, 6]) :
    avgPct < 0.5  ? lerp(avgPct, [0.25, 6],  [0.5, 10]) :
    avgPct < 0.75 ? lerp(avgPct, [0.5, 10],  [0.75, 13]) :
                    lerp(avgPct, [0.75, 13],  [1.0, 15]),
    0, MAX
  ));

  const contextPt = `${avgPctRounded}% concluído em média`;
  const contextEn = `${avgPctRounded}% complete on average`;

  return {
    key: "goals", labelPt: "Progresso das metas", labelEn: "Goal progress",
    score: pts, max: MAX, pct: Math.round((pts / MAX) * 100),
    status: pts >= 12 ? "great" : pts >= 8 ? "good" : pts >= 4 ? "warn" : "bad",
    contextPt, contextEn,
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
): { pt: string; en: string; href?: string }[] {
  const tips: { pt: string; en: string; href?: string }[] = [];
  const savComp  = components.find(c => c.key === "savings")!;
  const budComp  = components.find(c => c.key === "budget")!;
  const expComp  = components.find(c => c.key === "expense")!;
  const goalComp = components.find(c => c.key === "goals")!;

  // ── Savings tip ───────────────────────────────────────────────────────────
  // Uses the same formula as calcSavingsRate: (income - expenses) / income.
  // Only surfaces an action item when the user genuinely needs to save more.
  if (savComp.status === "bad" || savComp.status === "warn") {
    const saved  = income - expenses;
    const rate   = income > 0 ? Math.round((saved / income) * 100) : 0;
    const target = Math.round(income * 0.20);  // 20% goal
    const gap    = target - saved;              // positive = need to save more

    if (rate <= 0) {
      tips.push({
        pt: "Você está gastando mais do que ganha. Reduza as despesas variáveis urgentemente.",
        en: "You're spending more than you earn. Cut variable expenses immediately.",
      });
    } else if (gap > 0) {
      // Rate is positive but below 20% target
      tips.push({
        pt: `Você poupa ${rate}% da renda. Para chegar a 20%, reserve mais R$ ${gap}/mês.`,
        en: `You save ${rate}% of income. To reach 20%, set aside R$ ${gap} more per month.`,
      });
    }
    // gap <= 0 means user already saves ≥ 20% — savComp.status would be "good"/"great",
    // so this branch only runs when there's a genuine gap.
  }

  // ── Budget tip ────────────────────────────────────────────────────────────
  if (budComp.status === "bad" || budComp.status === "warn") {
    const overBudgets = budgets.filter(b => (b.spent ?? 0) > b.amount);
    if (!budgets.length) {
      tips.push({
        pt: "Crie orçamentos por categoria para saber exatamente para onde o dinheiro vai.",
        en: "Create category budgets to track exactly where your money goes.",
        href: "/budgets",
      });
    } else if (overBudgets.length) {
      const names = overBudgets.slice(0, 2).map(b => b.category?.name ?? "—").join(", ");
      const extra = overBudgets.length > 2 ? ` e mais ${overBudgets.length - 2}` : "";
      tips.push({
        pt: `Orçamento estourado em: ${names}${extra}. Ajuste os limites ou reduza esses gastos.`,
        en: `Budget exceeded in: ${names}${extra}. Adjust the limits or reduce those expenses.`,
        href: "/budgets",
      });
    }
  }

  // ── Expense tip ───────────────────────────────────────────────────────────
  if (expComp.status === "bad" || expComp.status === "warn") {
    const ratio = income > 0 ? Math.round((expenses / income) * 100) : 0;
    if (ratio > 85) {
      tips.push({
        pt: `Seus gastos consomem ${ratio}% da renda. Liste as 3 maiores despesas e veja onde cortar.`,
        en: `Your expenses use ${ratio}% of income. List your top 3 costs and find where to cut.`,
        href: "/transactions",
      });
    }
  }

  // ── Goals tip ─────────────────────────────────────────────────────────────
  if (goalComp.status === "bad" || goalComp.status === "warn") {
    if (!goals.length) {
      tips.push({
        pt: "Crie pelo menos uma meta financeira para dar direção aos seus esforços.",
        en: "Create at least one financial goal to give direction to your efforts.",
        href: "/goals",
      });
    } else {
      const active = goals.filter(g => g.target_amount > 0);
      const avgPct = active.length
        ? Math.round(active.reduce((s, g) => s + Math.min(100, (g.current_amount / g.target_amount) * 100), 0) / active.length)
        : 0;
      tips.push({
        pt: `Suas metas estão ${avgPct}% concluídas. Um depósito fixo mensal acelera o progresso.`,
        en: `Your goals are ${avgPct}% complete. A fixed monthly deposit speeds up progress.`,
        href: "/goals",
      });
    }
  }

  // ── All-good tip ──────────────────────────────────────────────────────────
  if (!tips.length) {
    const rate = income > 0 ? Math.round(((income - expenses) / income) * 100) : 0;
    if (rate >= 30) {
      tips.push({
        pt: `Excelente! Você poupa ${rate}% da renda. Considere investir o excedente.`,
        en: `Excellent! You save ${rate}% of income. Consider investing the surplus.`,
      });
    } else {
      tips.push({
        pt: "Ótimo trabalho! Continue monitorando e tente aumentar a poupança gradualmente.",
        en: "Great work! Keep monitoring and try to gradually increase your savings.",
      });
    }
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
      components: [],
      tips:   [{ text: "Adicione suas receitas do mês para calcular o score.", href: "/transactions" }],
      tipsEn: [{ text: "Add your monthly income to calculate the score.", href: "/transactions" }],
      hasData: false,
    };
  }

  const components = [
    calcSavingsRate(monthIncome, monthExpenses),   // goal deposits count as savings
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
    tips:   rawTips.map(t => ({ text: t.pt, href: t.href })),
    tipsEn: rawTips.map(t => ({ text: t.en, href: t.href })),
    hasData: true,
  };
}
