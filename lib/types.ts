// ============================================================
// Types
// ============================================================

export type Store = {
  id: string
  name: string
  location: string | null
  active: boolean
  created_at: string
}

export type Expense = {
  id: string
  title: string
  category: string | null
  vendor: string | null
  total_amount: number
  month: number
  year: number
  allocation_mode: 'equal_all' | 'equal_selected' | 'manual'
  notes: string | null
  created_at: string
}

export type ExpenseAllocation = {
  id: string
  expense_id: string
  store_id: string
  allocated_amount: number
  store?: Store
}

// ============================================================
// Constants
// ============================================================

export const CATEGORIES = [
  'Digital Ads',
  'Print',
  'Events',
  'Social Media',
  'Outdoor',
  'Radio / TV',
  'Email Marketing',
  'Other',
] as const

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const
