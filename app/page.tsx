import { supabase } from '@/lib/supabase'
import { Expense, MONTHS } from '@/lib/types'
import { Store, Receipt, TrendingUp, CalendarDays, AlertCircle } from 'lucide-react'

// ─── Helpers ────────────────────────────────────────────────

const fmt = (amount: number) =>
  `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`

const allocationBadge: Record<string, { label: string; className: string }> = {
  equal_all:      { label: 'Equal – All',      className: 'bg-blue-100 text-blue-700'    },
  equal_selected: { label: 'Equal – Selected', className: 'bg-purple-100 text-purple-700' },
  manual:         { label: 'Manual',           className: 'bg-amber-100 text-amber-700'   },
}

// ─── Stat Card ──────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  iconClass,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  iconClass: string
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${iconClass}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  )
}

// ─── Error Banner ────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-6 flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
      <AlertCircle size={16} className="shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────

export default async function DashboardPage() {
  const currentYear  = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  // Fetch stores
  const { data: stores, error: storesError } = await supabase
    .from('stores')
    .select('*')
    .order('name')

  // Fetch all expenses for the current year
  const { data: expenses, error: expensesError } = await supabase
    .from('expenses')
    .select('*')
    .eq('year', currentYear)
    .order('created_at', { ascending: false })

  const storeList   = stores   ?? []
  const expenseList = expenses ?? []

  // ── Derived stats ─────────────────────────────────────────
  const totalStores    = storeList.length
  const activeStores   = storeList.filter((s) => s.active).length
  const ytdSpend       = expenseList.reduce((sum, e) => sum + Number(e.total_amount), 0)
  const thisMonthSpend = expenseList
    .filter((e) => e.month === currentMonth)
    .reduce((sum, e) => sum + Number(e.total_amount), 0)

  const recent: Expense[] = expenseList.slice(0, 10)

  return (
    <div className="p-8">

      {/* Page header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500 mt-1">Overview for {currentYear}</p>
      </div>

      {/* Error banners */}
      {storesError && (
        <ErrorBanner message={`Failed to load stores: ${storesError.message}`} />
      )}
      {expensesError && (
        <ErrorBanner message={`Failed to load expenses: ${expensesError.message}`} />
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
        <StatCard
          label="Total Stores"
          value={totalStores}
          icon={Store}
          iconClass="bg-gray-100 text-gray-600"
        />
        <StatCard
          label="Active Stores"
          value={activeStores}
          icon={Store}
          iconClass="bg-green-100 text-green-600"
        />
        <StatCard
          label="YTD Spend"
          value={fmt(ytdSpend)}
          icon={TrendingUp}
          iconClass="bg-indigo-100 text-indigo-600"
        />
        <StatCard
          label="This Month Spend"
          value={fmt(thisMonthSpend)}
          icon={CalendarDays}
          iconClass="bg-amber-100 text-amber-600"
        />
      </div>

      {/* Recent expenses table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">Recent Expenses</h3>
          <p className="text-xs text-gray-400 mt-0.5">Latest 10 expenses for {currentYear}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-6 py-3 text-left font-medium">Title</th>
                <th className="px-6 py-3 text-left font-medium">Category</th>
                <th className="px-6 py-3 text-left font-medium">Period</th>
                <th className="px-6 py-3 text-right font-medium">Amount</th>
                <th className="px-6 py-3 text-left font-medium">Allocation Mode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    {expensesError
                      ? 'Could not load expenses.'
                      : `No expenses recorded for ${currentYear} yet.`}
                  </td>
                </tr>
              ) : (
                recent.map((expense) => {
                  const badge = allocationBadge[expense.allocation_mode] ?? {
                    label: expense.allocation_mode,
                    className: 'bg-gray-100 text-gray-600',
                  }
                  return (
                    <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {expense.title}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {expense.category ?? '—'}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {MONTHS[expense.month - 1]} {expense.year}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-900">
                        {fmt(Number(expense.total_amount))}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {recent.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Showing {recent.length} of {expenseList.length} expense{expenseList.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

    </div>
  )
}
