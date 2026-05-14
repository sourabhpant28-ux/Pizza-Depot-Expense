'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { MONTHS } from '@/lib/types'
import { Store, TrendingUp, CalendarDays, AlertCircle } from 'lucide-react'

// ─── Helpers ────────────────────────────────────────────────

const fmt = (amount: number) =>
  `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`

const currentYear  = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

// ─── Reusable UI components ──────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  iconClass,
  loading,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  iconClass: string
  loading?: boolean
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-4">
      <div className={`p-3 rounded-lg shrink-0 ${iconClass}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide truncate">{label}</p>
        {loading ? (
          <div className="h-8 w-24 bg-gray-100 rounded animate-pulse mt-1" />
        ) : (
          <p className="text-2xl font-bold text-gray-900 mt-0.5 truncate">{value}</p>
        )}
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

function SkeletonBar() {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 mt-1 animate-pulse" />
  )
}

// ─── Types ───────────────────────────────────────────────────

type StoreRow = { id: string; name: string; active: boolean }
type ExpenseRow = {
  id: string
  total_amount: number
  month: number
  year: number
  category: string | null
  allocation_mode: string
}
type AllocRow = {
  allocated_amount: number
  store_id: string
  expenses: { year: number } | null
  stores: { id: string; name: string } | null
}

// ─── Page ───────────────────────────────────────────────────

export default function DashboardPage() {
  const [stores,      setStores]      = useState<StoreRow[]>([])
  const [expenses,    setExpenses]    = useState<ExpenseRow[]>([])
  const [allocations, setAllocations] = useState<AllocRow[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      // Paginate allocations to bypass 1000-row cap
      const fetchAllAllocations = async (): Promise<AllocRow[]> => {
        const all: AllocRow[] = []
        const pageSize = 1000
        let from = 0
        while (true) {
          const { data, error } = await supabase
            .from('expense_allocations')
            .select(`allocated_amount, store_id, expenses ( year ), stores ( id, name )`)
            .range(from, from + pageSize - 1)
          if (error) throw new Error(error.message)
          if (!data || data.length === 0) break
          all.push(...(data as unknown as AllocRow[]))
          if (data.length < pageSize) break
          from += pageSize
        }
        return all
      }

      const [storesRes, expensesRes, allocsResult] = await Promise.allSettled([
        supabase.from('stores').select('id, name, active').order('name').limit(1000),
        supabase
          .from('expenses')
          .select('id, total_amount, month, year, category, allocation_mode')
          .eq('year', currentYear)
          .limit(1000),
        fetchAllAllocations(),
      ])

      if (cancelled) return

      if (storesRes.status === 'rejected') {
        setError(`Failed to load stores: ${storesRes.reason}`)
      } else if (storesRes.value.error) {
        setError(`Failed to load stores: ${storesRes.value.error.message}`)
      } else {
        setStores((storesRes.value.data ?? []) as StoreRow[])
      }

      if (expensesRes.status === 'rejected') {
        setError(`Failed to load expenses: ${expensesRes.reason}`)
      } else if (expensesRes.value.error) {
        setError(`Failed to load expenses: ${expensesRes.value.error.message}`)
      } else {
        setExpenses((expensesRes.value.data ?? []) as unknown as ExpenseRow[])
      }

      if (allocsResult.status === 'rejected') {
        setError(`Failed to load allocations: ${allocsResult.reason}`)
      } else {
        setAllocations(allocsResult.value)
      }

      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [])

  // ── Stat card values ──────────────────────────────────────
  const totalStores    = stores.length
  const activeStores   = stores.filter((s) => s.active).length
  const ytdSpend       = expenses.reduce((sum, e) => sum + Number(e.total_amount), 0)
  const thisMonthSpend = expenses
    .filter((e) => e.month === currentMonth)
    .reduce((sum, e) => sum + Number(e.total_amount), 0)

  // ── Spend by Category ─────────────────────────────────────
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of expenses) {
      const cat = e.category ?? 'Uncategorised'
      map[cat] = (map[cat] ?? 0) + Number(e.total_amount)
    }
    return Object.entries(map)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
  }, [expenses])
  const maxCategory = categoryData[0]?.total ?? 1

  // ── Monthly Spend ─────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const map: Record<number, number> = {}
    for (const e of expenses) {
      map[e.month] = (map[e.month] ?? 0) + Number(e.total_amount)
    }
    return Array.from({ length: currentMonth }, (_, i) => ({
      month: i + 1,
      label: MONTHS[i],
      total: map[i + 1] ?? 0,
    }))
  }, [expenses])
  const maxMonthly = Math.max(...monthlyData.map((m) => m.total), 1)

  // ── Top 5 Stores by Allocated Spend ───────────────────────
  const top5Stores = useMemo(() => {
    const storeAllocMap: Record<string, { name: string; total: number }> = {}
    for (const alloc of allocations) {
      const expYear = alloc.expenses?.year
      if (expYear !== currentYear) continue
      const store = alloc.stores
      if (!store) continue
      if (!storeAllocMap[store.id]) {
        storeAllocMap[store.id] = { name: store.name, total: 0 }
      }
      storeAllocMap[store.id].total += Number(alloc.allocated_amount)
    }
    return Object.values(storeAllocMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [allocations])

  // ── Allocation Mode Breakdown ─────────────────────────────
  const modeCount = useMemo(() => {
    const counts: Record<string, number> = {
      equal_all: 0, equal_selected: 0, manual: 0, by_cluster: 0,
    }
    for (const e of expenses) {
      if (e.allocation_mode in counts) counts[e.allocation_mode]++
    }
    return counts
  }, [expenses])
  const totalExpenses = expenses.length

  const modeData = [
    { key: 'equal_all',      label: 'Equal – All',      color: 'bg-blue-500',   light: 'bg-blue-100 text-blue-700'    },
    { key: 'equal_selected', label: 'Equal – Selected', color: 'bg-purple-500', light: 'bg-purple-100 text-purple-700' },
    { key: 'by_cluster',     label: 'By Cluster',       color: 'bg-teal-500',   light: 'bg-teal-100 text-teal-700'    },
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

      {/* ── Error banner ──────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Stat cards ────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Stores"  value={totalStores}       icon={Store}        iconClass="bg-gray-100 text-gray-600"   loading={loading} />
        <StatCard label="Active Stores" value={activeStores}      icon={Store}        iconClass="bg-green-100 text-green-600" loading={loading} />
        <StatCard label="YTD Spend"     value={fmt(ytdSpend)}     icon={TrendingUp}   iconClass="bg-indigo-100 text-indigo-600" loading={loading} />
        <StatCard label="This Month"    value={fmt(thisMonthSpend)} icon={CalendarDays} iconClass="bg-amber-100 text-amber-600"  loading={loading} />
      </div>

      {/* ── Second row: Category + Monthly ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Spend by Category */}
        <Card title="Spend by Category">
          {loading ? (
            <ul className="space-y-4">
              {[1,2,3,4].map((i) => (
                <li key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="h-4 w-28 bg-gray-100 rounded animate-pulse" />
                    <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
                  </div>
                  <SkeletonBar />
                </li>
              ))}
            </ul>
          ) : categoryData.length === 0 ? (
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
          {loading ? (
            <ul className="space-y-3">
              {[1,2,3,4,5].map((i) => (
                <li key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
                    <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
                  </div>
                  <SkeletonBar />
                </li>
              ))}
            </ul>
          ) : monthlyData.length === 0 ? (
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
          {loading ? (
            <ul className="space-y-3">
              {[1,2,3,4,5].map((i) => (
                <li key={i} className="flex items-center gap-4">
                  <div className="w-7 h-7 rounded-full bg-gray-100 animate-pulse shrink-0" />
                  <div className="flex-1 h-4 bg-gray-100 rounded animate-pulse" />
                  <div className="w-16 h-4 bg-gray-100 rounded animate-pulse shrink-0" />
                </li>
              ))}
            </ul>
          ) : top5Stores.length === 0 ? (
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
          {loading ? (
            <div className="space-y-5">
              <div className="h-4 w-full bg-gray-100 rounded-full animate-pulse" />
              <ul className="space-y-3">
                {[1,2,3].map((i) => (
                  <li key={i} className="flex items-center justify-between">
                    <div className="h-5 w-28 bg-gray-100 rounded-full animate-pulse" />
                    <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                  </li>
                ))}
              </ul>
            </div>
          ) : totalExpenses === 0 ? (
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
                  if (count === 0) return null
                  const pct = totalExpenses > 0 ? (count / totalExpenses) * 100 : 0
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
