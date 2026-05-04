'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Store, MONTHS } from '@/lib/types'
import { Download, Filter } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────

type RawAllocation = {
  id: string
  allocated_amount: number
  stores: {
    id: string
    name: string
    location: string | null
  } | null
  expenses: {
    id: string
    title: string
    category: string | null
    vendor: string | null
    month: number
    year: number
    total_amount: number
  } | null
}

type ReportRow = {
  storeName: string
  expenseTitle: string
  category: string
  vendor: string
  period: string
  month: number
  year: number
  storeId: string
  totalAmount: number
  allocatedAmount: number
}

// ─── Helpers ────────────────────────────────────────────────

const currentYear = new Date().getFullYear()
const YEARS       = Array.from({ length: 5 }, (_, i) => currentYear - i)

const fmt = (n: number) =>
  `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`

const shortMonth = (m: number) => MONTHS[m - 1]?.slice(0, 3) ?? ''

const slugify = (str: string) =>
  str.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

function buildFilename(
  storeName: string | null,
  month: number | null,
  year: number
): string {
  const storePart  = storeName ? slugify(storeName) : 'all-stores'
  const monthPart  = month ? `-${MONTHS[month - 1].toLowerCase()}` : ''
  return `report-${storePart}-${year}${monthPart}.csv`
}

function buildCSV(rows: ReportRow[]): string {
  const headers = [
    'Store Name',
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

// ─── Page ────────────────────────────────────────────────────

export default function ReportsPage() {
  const [allRows, setAllRows]   = useState<ReportRow[]>([])
  const [stores, setStores]     = useState<Store[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  // Filters
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all')
  const [selectedMonth, setSelectedMonth]     = useState<number | 'all'>('all')
  const [selectedYear, setSelectedYear]       = useState<number>(currentYear)

  // ── Fetch ────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true)
    setError(null)

    const [allocRes, storeRes] = await Promise.all([
      supabase
        .from('expense_allocations')
        .select(`
          id,
          allocated_amount,
          stores ( id, name, location ),
          expenses ( id, title, category, vendor, month, year, total_amount )
        `)
        .order('id'),
      supabase.from('stores').select('*').order('name'),
    ])

    if (allocRes.error) { setError(allocRes.error.message); setLoading(false); return }
    if (storeRes.error) { setError(storeRes.error.message); setLoading(false); return }

    setStores(storeRes.data ?? [])

    const rows: ReportRow[] = (allocRes.data as unknown as RawAllocation[])
      .filter((a) => a.stores && a.expenses)
      .map((a) => ({
        storeName:       a.stores!.name,
        storeId:         a.stores!.id,
        expenseTitle:    a.expenses!.title,
        category:        a.expenses!.category ?? '—',
        vendor:          a.expenses!.vendor   ?? '—',
        period:          `${shortMonth(a.expenses!.month)} ${a.expenses!.year}`,
        month:           a.expenses!.month,
        year:            a.expenses!.year,
        totalAmount:     Number(a.expenses!.total_amount),
        allocatedAmount: Number(a.allocated_amount),
      }))

    setAllRows(rows)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  // ── Filtered rows (memoised) ─────────────────────────────
  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      if (selectedStoreId !== 'all' && r.storeId !== selectedStoreId) return false
      if (selectedMonth   !== 'all' && r.month   !== selectedMonth)   return false
      if (r.year !== selectedYear)                                      return false
      return true
    })
  }, [allRows, selectedStoreId, selectedMonth, selectedYear])

  const totalAllocated = useMemo(
    () => filteredRows.reduce((sum, r) => sum + r.allocatedAmount, 0),
    [filteredRows]
  )

  const previewRows = filteredRows.slice(0, 10)

  // ── Derived filename ─────────────────────────────────────
  const csvFilename = useMemo(() => {
    const store = stores.find((s) => s.id === selectedStoreId)
    return buildFilename(
      store?.name ?? null,
      selectedMonth === 'all' ? null : selectedMonth,
      selectedYear
    )
  }, [selectedStoreId, selectedMonth, selectedYear, stores])

  // ── Download ─────────────────────────────────────────────
  const handleDownload = () => {
    if (filteredRows.length === 0) return
    downloadCSV(buildCSV(filteredRows), csvFilename)
  }

  // ─── Render ──────────────────────────────────────────────
  return (
    <div className="p-8">

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

        </div>
      </div>

      {/* ── Summary + Download ────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total Rows</p>
            <p className="text-2xl font-bold text-gray-900">{filteredRows.length.toLocaleString()}</p>
          </div>
          <div className="w-px h-10 bg-gray-200" />
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total Allocated</p>
            <p className="text-2xl font-bold text-gray-900">{fmt(totalAllocated)}</p>
          </div>
        </div>

        <button
          onClick={handleDownload}
          disabled={filteredRows.length === 0 || loading}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Download size={16} />
          Download CSV
        </button>
      </div>

      {/* Filename preview */}
      {filteredRows.length > 0 && (
        <p className="text-xs text-gray-400 mb-4">
          File will be saved as: <span className="font-mono text-gray-600">{csvFilename}</span>
        </p>
      )}

      {/* ── Preview table ──────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">Preview</h3>
          <span className="text-xs text-gray-400">
            {filteredRows.length > 10
              ? `Showing 10 of ${filteredRows.length} rows`
              : `${filteredRows.length} row${filteredRows.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-6 py-3 text-left font-medium">Store Name</th>
                <th className="px-6 py-3 text-left font-medium">Expense Title</th>
                <th className="px-6 py-3 text-left font-medium">Category</th>
                <th className="px-6 py-3 text-left font-medium">Vendor</th>
                <th className="px-6 py-3 text-left font-medium">Period</th>
                <th className="px-6 py-3 text-right font-medium">Total Amount</th>
                <th className="px-6 py-3 text-right font-medium">Allocated Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    Loading data…
                  </td>
                </tr>
              ) : previewRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    No data found for the selected filters.
                  </td>
                </tr>
              ) : (
                previewRows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{row.storeName}</td>
                    <td className="px-6 py-4 text-gray-700">{row.expenseTitle}</td>
                    <td className="px-6 py-4 text-gray-500">{row.category}</td>
                    <td className="px-6 py-4 text-gray-500">{row.vendor}</td>
                    <td className="px-6 py-4 text-gray-500">{row.period}</td>
                    <td className="px-6 py-4 text-right text-gray-700">{fmt(row.totalAmount)}</td>
                    <td className="px-6 py-4 text-right font-semibold text-gray-900">
                      {fmt(row.allocatedAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredRows.length > 10 && (
          <div className="px-6 py-3 border-t border-gray-100 text-xs text-gray-400 text-center">
            Download the CSV to see all {filteredRows.length} rows
          </div>
        )}
      </div>

    </div>
  )
}
