'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Store, MONTHS } from '@/lib/types'
import { Download, Filter, ChevronLeft, ChevronRight } from 'lucide-react'

// ─── Constants ───────────────────────────────────────────────

const currentYear = new Date().getFullYear()
const YEARS       = Array.from({ length: 5 }, (_, i) => currentYear - i)
const PAGE_SIZE   = 100

const CLUSTER_OPTIONS = [
  { code: 'BRAM', name: 'Brampton'     },
  { code: 'GTA',  name: 'GTA'          },
  { code: 'WIND', name: 'Windsor'      },
  { code: 'WNPG', name: 'Winnipeg'     },
  { code: 'SKWN', name: 'Saskatchewan' },
  { code: 'CALG', name: 'Calgary'      },
  { code: 'WILL', name: 'William Lake' },
]

// ─── Types ───────────────────────────────────────────────────

type RawAllocation = {
  allocated_amount: number
  store_id: string
  expense_id: string
  stores: {
    name: string
    store_code:   string | null
    city:         string | null
    province:     string | null
    cluster_name: string | null
    cluster_code: string | null
  } | null
  expenses: {
    title:        string
    category:     string | null
    vendor:       string | null
    month:        number
    year:         number
    total_amount: number
  } | null
}

type ReportRow = {
  storeId:        string
  storeName:      string
  storeCode:      string
  city:           string
  province:       string
  clusterName:    string
  clusterCode:    string
  expenseTitle:   string
  category:       string
  vendor:         string
  period:         string
  month:          number
  year:           number
  totalAmount:    number
  allocatedAmount: number
}

// ─── Helpers ────────────────────────────────────────────────

const fmt = (n: number) =>
  `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`

const shortMonth = (m: number) => MONTHS[m - 1]?.slice(0, 3) ?? ''

const slugify = (str: string) =>
  str.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

function buildFilename(
  storeName:   string | null,
  clusterName: string | null,
  month:       number | null,
  year:        number
): string {
  const storePart   = storeName   ? slugify(storeName)   : clusterName ? slugify(clusterName) : 'all-stores'
  const monthPart   = month       ? `-${MONTHS[month - 1].toLowerCase()}` : ''
  return `report-${storePart}-${year}${monthPart}.csv`
}

function buildCSV(rows: ReportRow[]): string {
  const headers = [
    'Store Name',
    'Store Code',
    'City',
    'Province',
    'Cluster',
    'Expense Title',
    'Category',
    'Vendor',
    'Period',
    'Total Expense Amount',
    'Allocated Amount',
  ]

  const escape = (val: string | number) => {
    const str = String(val)
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str
  }

  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        r.storeName,
        r.storeCode,
        r.city,
        r.province,
        r.clusterName,
        r.expenseTitle,
        r.category,
        r.vendor,
        r.period,
        r.totalAmount.toFixed(2),
        r.allocatedAmount.toFixed(2),
      ]
        .map(escape)
        .join(',')
    ),
  ]

  return lines.join('\n')
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Paginated fetch — bypasses the default 1000-row cap ─────

async function fetchAllAllocations(): Promise<RawAllocation[]> {
  const allData: RawAllocation[] = []
  const pageSize = 1000
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('expense_allocations')
      .select(`
        allocated_amount,
        store_id,
        expense_id,
        expenses ( title, category, vendor, month, year, total_amount ),
        stores   ( name, store_code, city, province, cluster_name, cluster_code )
      `)
      .order('expense_id', { ascending: true })
      .order('store_id',   { ascending: true })
      .range(from, from + pageSize - 1)

    if (error || !data || data.length === 0) break
    allData.push(...(data as unknown as RawAllocation[]))
    if (data.length < pageSize) break
    from += pageSize
  }

  return allData
}

// ─── Page ────────────────────────────────────────────────────

export default function ReportsPage() {
  const [allRows, setAllRows] = useState<ReportRow[]>([])
  const [stores, setStores]   = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  // ── Filters ───────────────────────────────────────────────
  const [selectedStoreId, setSelectedStoreId]   = useState<string>('all')
  const [selectedMonth,   setSelectedMonth]     = useState<number | 'all'>('all')
  const [selectedYear,    setSelectedYear]      = useState<number>(currentYear)
  const [selectedCluster, setSelectedCluster]   = useState<string>('all')

  // ── Pagination ────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1)

  // ── Fetch ────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true)
    setError(null)

    const [rawAllocs, storeRes] = await Promise.all([
      fetchAllAllocations(),
      supabase.from('stores').select('*').order('name').limit(1000),
    ])

    if (storeRes.error) {
      setError(storeRes.error.message)
      setLoading(false)
      return
    }

    setStores(storeRes.data ?? [])

    const rows: ReportRow[] = rawAllocs
      .filter((a) => a.stores && a.expenses)
      .map((a) => ({
        storeId:         a.store_id,
        storeName:       a.stores!.name,
        storeCode:       a.stores!.store_code   ?? '—',
        city:            a.stores!.city         ?? '—',
        province:        a.stores!.province     ?? '—',
        clusterName:     a.stores!.cluster_name ?? '—',
        clusterCode:     a.stores!.cluster_code ?? '',
        expenseTitle:    a.expenses!.title,
        category:        a.expenses!.category   ?? '—',
        vendor:          a.expenses!.vendor     ?? '—',
        period:          `${shortMonth(a.expenses!.month)} ${a.expenses!.year}`,
        month:           a.expenses!.month,
        year:            a.expenses!.year,
        totalAmount:     Number(a.expenses!.total_amount),
        allocatedAmount: Number(a.allocated_amount),
      }))

    setAllRows(rows)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset to page 1 whenever any filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedStoreId, selectedMonth, selectedYear, selectedCluster])

  // ── Client-side filtering (all rows) ─────────────────────
  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      if (selectedStoreId !== 'all' && r.storeId   !== selectedStoreId)  return false
      if (selectedMonth   !== 'all' && r.month     !== selectedMonth)    return false
      if (r.year !== selectedYear)                                         return false
      if (selectedCluster !== 'all' && r.clusterCode !== selectedCluster) return false
      return true
    })
  }, [allRows, selectedStoreId, selectedMonth, selectedYear, selectedCluster])

  // ── Stats — computed from ALL filtered rows ───────────────
  const totalAllocated = useMemo(
    () => filteredRows.reduce((sum, r) => sum + r.allocatedAmount, 0),
    [filteredRows]
  )

  // ── Pagination calculations ───────────────────────────────
  const totalPages  = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const safePage    = Math.min(currentPage, totalPages)
  const pageStart   = (safePage - 1) * PAGE_SIZE          // 0-indexed
  const pageEnd     = Math.min(safePage * PAGE_SIZE, filteredRows.length)
  const pageRows    = filteredRows.slice(pageStart, pageEnd)

  // ── CSV filename ─────────────────────────────────────────
  const csvFilename = useMemo(() => {
    const store   = stores.find((s) => s.id === selectedStoreId)
    const cluster = CLUSTER_OPTIONS.find((c) => c.code === selectedCluster)
    return buildFilename(
      store?.name   ?? null,
      cluster?.name ?? null,
      selectedMonth === 'all' ? null : selectedMonth,
      selectedYear
    )
  }, [selectedStoreId, selectedCluster, selectedMonth, selectedYear, stores])

  // ── Download — ALL filtered rows, not just current page ──
  const handleDownload = () => {
    if (filteredRows.length === 0) return
    downloadCSV(buildCSV(filteredRows), csvFilename)
  }

  // ─── Render ──────────────────────────────────────────────
  return (
    <div className="p-6 md:p-8">

      {/* Page header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Reports</h2>
        <p className="text-sm text-gray-500 mt-1">
          Filter and export expense allocation data
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* ── Filter bar ────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-5 mb-6">
        <div className="flex flex-wrap items-end gap-4">

          <div className="flex items-center gap-2 text-gray-500 self-center">
            <Filter size={15} />
            <span className="text-sm font-medium text-gray-600">Filters</span>
          </div>

          {/* Store */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Store</label>
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[180px]"
            >
              <option value="all">All Stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Cluster */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Cluster</label>
            <select
              value={selectedCluster}
              onChange={(e) => setSelectedCluster(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[180px]"
            >
              <option value="all">All Clusters</option>
              {CLUSTER_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          {/* Month */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) =>
                setSelectedMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[140px]"
            >
              <option value="all">All Months</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[100px]"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Clear filters */}
          {(selectedStoreId !== 'all' || selectedCluster !== 'all' || selectedMonth !== 'all' || selectedYear !== currentYear) && (
            <button
              onClick={() => {
                setSelectedStoreId('all')
                setSelectedCluster('all')
                setSelectedMonth('all')
                setSelectedYear(currentYear)
              }}
              className="text-xs text-gray-500 hover:text-gray-800 underline self-end pb-2"
            >
              Clear filters
            </button>
          )}

        </div>
      </div>

      {/* ── Stats + Download ──────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total Rows</p>
            <p className="text-2xl font-bold text-gray-900">
              {loading ? '—' : filteredRows.length.toLocaleString()}
            </p>
          </div>
          <div className="w-px h-10 bg-gray-200" />
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total Allocated</p>
            <p className="text-2xl font-bold text-gray-900">
              {loading ? '—' : fmt(totalAllocated)}
            </p>
          </div>
        </div>

        <button
          onClick={handleDownload}
          disabled={filteredRows.length === 0 || loading}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Download size={16} />
          Download CSV ({filteredRows.length.toLocaleString()} rows)
        </button>
      </div>

      {/* Filename preview */}
      {filteredRows.length > 0 && (
        <p className="text-xs text-gray-400 mb-4">
          File: <span className="font-mono text-gray-600">{csvFilename}</span>
        </p>
      )}

      {/* ── Preview table ──────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">

        {/* Table header bar */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">Preview</h3>
          {!loading && filteredRows.length > 0 && (
            <span className="text-xs text-gray-400">
              Showing {(pageStart + 1).toLocaleString()}–{pageEnd.toLocaleString()} of{' '}
              {filteredRows.length.toLocaleString()} rows
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Store Name</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Code</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">City</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Province</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Cluster</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Expense Title</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Category</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Vendor</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Period</th>
                <th className="px-4 py-3 text-right font-medium whitespace-nowrap">Total Expense</th>
                <th className="px-4 py-3 text-right font-medium whitespace-nowrap">Allocated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-gray-400">
                    Loading data…
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-gray-400">
                    No data found for the selected filters.
                  </td>
                </tr>
              ) : (
                pageRows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[180px]">
                      <span className="block truncate" title={row.storeName}>{row.storeName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded whitespace-nowrap">
                        {row.storeCode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{row.city}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{row.province}</td>
                    <td className="px-4 py-3">
                      {row.clusterName !== '—' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 whitespace-nowrap">
                          {row.clusterName}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-[180px]">
                      <span className="block truncate" title={row.expenseTitle}>{row.expenseTitle}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{row.category}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{row.vendor}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{row.period}</td>
                    <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                      {fmt(row.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                      {fmt(row.allocatedAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination bar ─────────────────────────────── */}
        {!loading && filteredRows.length > PAGE_SIZE && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-4">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft size={15} />
              Previous
            </button>

            <span className="text-sm text-gray-500">
              Page <span className="font-semibold text-gray-800">{safePage}</span> of{' '}
              <span className="font-semibold text-gray-800">{totalPages}</span>
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Next
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>

    </div>
  )
}
