import { supabase } from '@/lib/supabase'
import { MONTHS } from '@/lib/types'
import { Store, TrendingUp, CalendarDays, AlertCircle } from 'lucide-react'

// Force fresh data on every request — prevents Netlify static caching
export const dynamic = 'force-dynamic'

// ─── Helpers ────────────────────────────────────────────────

const fmt = (amount: number) =>
  `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`

// ─── Reusable UI components ──────────────────────────────────

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
      <div className={`p-3 rounded-lg shrink-0 ${iconClass}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide truncate">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5 truncate">{value}</p>
      </div>
    </div>
  )
}

function Card({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-base font-semibold text-gray-800">{title}</h3>
      </div>
      <div className="px-6 py-5 flex-1">{children}</div>
    </div>
  )
}

function Bar({ pct, className }: { pct: number; className: string }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
      <div
        className={`h-2 rounded-full ${className}`}
        style={{ width: `${Math.max(pct, 2)}%` }}
      />
    </div>
  )
}

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

  // ── Fetch all data in parallel ────────────────────────────
  const [storesRes, expensesRes, allocationsRes] = await Promise.all([
    supabase
      .from('stores')
      .select('*')
      .order('name')
      .limit(1000),

    supabase
      .from('expenses')
      .select('*')
      .eq('year', currentYear)
      .limit(1000),

    supabase
      .from('expense_allocations')
      .select(`
        allocated_amount,
        store_id,
        expenses ( year ),
        stores ( id, name )
      `)
      .limit(10000),
  ])

  const storeList      = storesRes.data      ?? []
  const expenseList    = expensesRes.data     ?? []
  const allocationList = allocationsRes.data  ?? []

  // ── Stat card values ──────────────────────────────────────
  const totalStores    = storeList.length
  const activeStores   = storeList.filter((s) => s.active).length
  const ytdSpend       = expenseList.reduce((sum, e) => sum + Number(e.total_amount), 0)
  const thisMonthSpend = expenseList
    .filter((e) => e.month === currentMonth)
    .reduce((sum, e) => sum + Number(e.total_amount), 0)

  // ── Spend by Category ─────────────────────────────────────
  const categoryMap: Record<string, number> = {}
  for (const e of expenseList) {
    const cat = e.category ?? 'Uncategorised'
    categoryMap[cat] = (categoryMap[cat] ?? 0) + Number(e.total_amount)
  }
  const categoryData = Object.entries(categoryMap)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
  const maxCategory = categoryData[0]?.total ?? 1

  // ── Monthly Spend ─────────────────────────────────────────
  const monthlyMap: Record<number, number> = {}
  for (const e of expenseList) {
    monthlyMap[e.month] = (monthlyMap[e.month] ?? 0) + Number(e.total_amount)
  }
  const monthlyData = Array.from({ length: currentMonth }, (_, i) => ({
    month: i + 1,
    label: MONTHS[i],
    total: monthlyMap[i + 1] ?? 0,
  }))
  const maxMonthly = Math.max(...monthlyData.map((m) => m.total), 1)

  // ── Top 5 Stores by Allocated Spend ───────────────────────
  // Filter allocations to current year only (via joined expense year)
  const storeAllocMap: Record<string, { name: string; total: number }> = {}
  for (const alloc of allocationList) {
    const expYear = (alloc.expenses as unknown as { year: number } | null)?.year
    if (expYear !== currentYear) continue
    const store = alloc.stores as unknown as { id: string; name: string } | null
    if (!store) continue
    if (!storeAllocMap[store.id]) {
      storeAllocMap[store.id] = { name: store.name, total: 0 }
    }
    storeAllocMap[store.id].total += Number(alloc.allocated_amount)
  }
  const top5Stores = Object.values(storeAllocMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  // ── Allocation Mode Breakdown ─────────────────────────────
  const modeCount: Record<string, number> = {
    equal_all: 0,
    equal_selected: 0,
    manual: 0,
  }
  for (const e of expenseList) {
    if (e.allocation_mode in modeCount) {
      modeCount[e.allocation_mode]++
    }
  }
  const totalExpenses = expenseList.length
  const modeData = [
    { key: 'equal_all',      label: 'Equal – All',      color: 'bg-blue-500',   light: 'bg-blue-100 text-blue-700'   },
    { key: 'equal_selected', label: 'Equal – Selected', color: 'bg-purple-500', light: 'bg-purple-100 text-purple-700' },
    { key: 'manual',         label: 'Manual',           color: 'bg-amber-500',  light: 'bg-amber-100 text-amber-700'  },
  ]

  // ─── Render ──────────────────────────────────────────────
  return (
    <div className="p-6 md:p-8 space-y-6">

      {/* ── Header ────────────────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500 mt-1">Overview for {currentYear}</p>
      </div>

      {/* ── Error banners ─────────────────────────────────── */}
      {storesRes.error && (
        <ErrorBanner message={`Failed to load stores: ${storesRes.error.message}`} />
      )}
      {expensesRes.error && (
        <ErrorBanner message={`Failed to load expenses: ${expensesRes.error.message}`} />
      )}
      {allocationsRes.error && (
        <ErrorBanner message={`Failed to load allocations: ${allocationsRes.error.message}`} />
      )}

      {/* ── Stat cards ────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
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
          label="This Month"
          value={fmt(thisMonthSpend)}
          icon={CalendarDays}
          iconClass="bg-amber-100 text-amber-600"
        />
      </div>

      {/* ── Second row: Category + Monthly ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Spend by Category */}
        <Card title="Spend by Category">
          {categoryData.length === 0 ? (
            <p className="text-sm text-gray-400">No expenses recorded yet.</p>
          ) : (
            <ul className="space-y-4">
              {categoryData.map(({ name, total }) => (
                <li key={name}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 font-medium truncate pr-2">{name}</span>
                    <span className="text-gray-900 font-semibold shrink-0">{fmt(total)}</span>
                  </div>
                  <Bar pct={(total / maxCategory) * 100} className="bg-indigo-500" />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Monthly Spend */}
        <Card title="Monthly Spend">
          {monthlyData.length === 0 ? (
            <p className="text-sm text-gray-400">No expenses recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {monthlyData.map(({ month, label, total }) => {
                const isCurrent = month === currentMonth
                return (
                  <li key={month}>
                    <div className="flex items-center justify-between text-sm">
                      <span className={`font-medium truncate pr-2 ${isCurrent ? 'text-indigo-600' : 'text-gray-600'}`}>
                        {label}
                        {isCurrent && (
                          <span className="ml-1.5 text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium">
                            Current
                          </span>
                        )}
                      </span>
                      <span className={`shrink-0 font-semibold ${isCurrent ? 'text-indigo-700' : 'text-gray-900'}`}>
                        {total > 0 ? fmt(total) : '—'}
                      </span>
                    </div>
                    <Bar
                      pct={total > 0 ? (total / maxMonthly) * 100 : 0}
                      className={isCurrent ? 'bg-indigo-500' : 'bg-gray-400'}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

      </div>

      {/* ── Bottom row: Top Stores + Mode Breakdown ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top 5 Stores by Allocated Spend */}
        <Card title="Top 5 Stores by Allocated Spend">
          {top5Stores.length === 0 ? (
            <p className="text-sm text-gray-400">No allocations recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {top5Stores.map(({ name, total }, i) => (
                <li key={name} className="flex items-center gap-4">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    i === 0 ? 'bg-indigo-600 text-white' :
                    i === 1 ? 'bg-indigo-100 text-indigo-700' :
                    i === 2 ? 'bg-gray-200 text-gray-600' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm text-gray-800 font-medium truncate">{name}</span>
                  <span className="text-sm font-semibold text-gray-900 shrink-0">{fmt(total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Allocation Mode Breakdown */}
        <Card title="Allocation Mode Breakdown">
          {totalExpenses === 0 ? (
            <p className="text-sm text-gray-400">No expenses recorded yet.</p>
          ) : (
            <div className="space-y-5">
              {/* Stacked bar */}
              <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
                {modeData.map(({ key, color }) => {
                  const count = modeCount[key] ?? 0
                  const pct   = totalExpenses > 0 ? (count / totalExpenses) * 100 : 0
                  return pct > 0 ? (
                    <div
                      key={key}
                      className={`${color} transition-all`}
                      style={{ width: `${pct}%` }}
                      title={`${pct.toFixed(1)}%`}
                    />
                  ) : null
                })}
              </div>

              {/* Legend */}
              <ul className="space-y-3">
                {modeData.map(({ key, label, light }) => {
                  const count = modeCount[key] ?? 0
                  const pct   = totalExpenses > 0 ? (count / totalExpenses) * 100 : 0
                  return (
                    <li key={key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${light}`}>
                          {label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-gray-500">{count} expense{count !== 1 ? 's' : ''}</span>
                        <span className="font-semibold text-gray-900 w-12 text-right">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>

              <p className="text-xs text-gray-400 pt-1 border-t border-gray-100">
                {totalExpenses} total expense{totalExpenses !== 1 ? 's' : ''} in {currentYear}
              </p>
            </div>
          )}
        </Card>

      </div>

    </div>
  )
}
