export type TransactionType = "income" | "expense" | "saving";

export interface Profile {
  id: string;
  name: string | null;
  avatar_url: string | null;
  currency: string;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: TransactionType;
  color: string;
  icon: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  category_id: string | null;
  title: string;
  amount: number;
  type: TransactionType;
  date: string;
  notes: string | null;
  is_recurring: boolean;
  recurrence_interval: "daily" | "weekly" | "monthly" | "yearly" | null;
  recurrence_parent_id: string | null;
  goal_id: string | null;
  created_at: string;
  category?: Category;
}

export type RecurrenceInterval = "daily" | "weekly" | "monthly" | "yearly";

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  month: string;
  created_at: string;
  category?: Category;
  spent?: number;
}

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  color: string;
  icon: string;
  created_at: string;
}

export interface MonthlyStats {
  month: string;
  income: number;
  expenses: number;
  balance: number;
  daysOfData: number; // actual days spanned by transactions (for accurate daily rate)
}

export interface DashboardData {
  totalBalance: number;
  monthIncome: number;
  monthExpenses: number;
  monthSavings: number;
  recentTransactions: Transaction[];   // 8 most recent (any month) — for the activity list
  monthTransactions: Transaction[];    // all transactions in the viewed month — for charts/breakdown
  monthlyStats: MonthlyStats[];
  budgets: Budget[];
  goals: SavingsGoal[];
  currentMonth: string; // YYYY-MM-DD (first day of the viewed month)
}

export type CategoryWithStats = Category & {
  total: number;
  count: number;
  percentage: number;
};

export type SubscriptionStatus =
  | "active" | "canceled" | "past_due" | "trialing"
  | "incomplete" | "paused" | "unpaid";

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  provider: string;
  provider_sub_id: string | null;
  mp_subscription_id: string | null;
  mp_customer_id: string | null;
  cancel_reason: string | null;
  trial_end: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanGrant {
  id: string;
  user_id: string;
  plan_id: string;
  reason: string;
  granted_by: string;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
}

/** Resolved billing state for display in Settings / Pricing. */
export interface BillingInfo {
  /** Effective plan: result of get_my_plan() */
  plan: "free" | "pro";
  /** Where the current plan comes from */
  source: "free" | "mercado_pago" | "manual_grant" | "pix";
  subscription: Subscription | null;
  activeGrant: PlanGrant | null;
  pendingPixPayment: { mp_payment_id: string } | null;
}
