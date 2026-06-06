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
  recentTransactions: Transaction[];
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
