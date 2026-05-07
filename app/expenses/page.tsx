'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Expense, Store, CATEGORIES, MONTHS } from '@/lib/types'
import { PlusCircle, X, Search, Pencil } from 'lucide-react'

// ─── Constants ───────────────────────────────────────────────

const currentYear  = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1
const YEARS        = Array.from({ length: 5 }, (_, i) => currentYear - i)

type AllocationMode = 'equal_all' | 'equal_selected' | 'manual'

// ─── Helpers ────────────────────────────────────────────────

const fmt = (n: number) =>
  `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`

const allocationBadge: Record<AllocationMode, { label: string; className: string }> = {
  equal_all:      { label: 'Equal – All',      className: 'bg-blue-100 text-blue-700'    },
  equal_selected: { label: 'Equal – Selected', className: 'bg-purple-100 text-purple-700' },
  manual:         { label: 'Manual',           className: 'bg-amber-100 text-amber-700'   },
}

// ─── Sub-components ─────────────────────────────────────────

function AllocationBadge({ mode }: { mode: AllocationMode }) {
  const { label, className } = allocationBadge[mode]
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

function FormField({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

// ─── Store Selector ──────────────────────────────────────────

function StoreSelector({
  stores,
  selectedIds,
  onToggle,
  onSelectAll,
  onClear,
  manualAmounts,
  onManualChange,
  isManual,
}: {
  stores: Store[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onSelectAll: () => void
  onClear: () => void
  manualAmounts?: Record<string, string>
  onManualChange?: (id: string, val: string) => void
  isManual: boolean
}) {
  const [search, setSearch] = useState('')
  const filtered = stores.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.location ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
        <Search size={14} className="text-gray-400 shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search stores…"
          className="flex-1 text-sm bg-transparent outline-none placeholder-gray-400"
        />
        <button type="button" onClick={onSelectAll} className="text-xs text-indigo-600 hover:underline shrink-0">All</button>
        <span className="text-gray-300 text-xs">|</span>
        <button type="button" onClick={onClear} className="text-xs text-gray-500 hover:underline shrink-0">Clear</button>
      </div>
      <ul className="max-h-52 overflow-y-auto divide-y divide-gray-50">
        {filtered.length === 0 ? (
          <li className="px-4 py-3 text-xs text-gray-400 text-center">No stores found</li>
        ) : (
          filtered.map((store) => {
            const checked = selectedIds.has(store.id)
            return (
              <li key={store.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                <input
                  type="checkbox"
                  id={`store-${store.id}`}
                  checked={checked}
                  onChange={() => onToggle(store.id)}
                  className="accent-indigo-600"
                />
                <label htmlFor={`store-${store.id}`} className="flex-1 text-sm text-gray-800 cursor-pointer select-none">
                  {store.name}
                  {store.location && (
                    <span className="text-gray-400 text-xs ml-1.5">— {store.location}</span>
                  )}
                </label>
                {isManual && checked && (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={manualAmounts?.[store.id] ?? ''}
                    onChange={(e) => onManualChange?.(store.id, e.target.value)}
                    placeholder="0.00"
                    className="w-24 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                )}
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────

export default function ExpensesPage() {
  const [expenses, setExpenses]         = useState<Expense[]>([])
  const [activeStores, setActiveStores] = useState<Store[]>([])
  const [loading, setLoading]           = useState(true)
  const [showForm, setShowForm]         = useState(false)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState<string | null>(null)

  // ── Editing ──────────────────────────────────────────────
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)

  // ── Form fields ──────────────────────────────────────────
  const [title, setTitle]                   = useState('')
  const [category, setCategory]             = useState('')
  const [vendor, setVendor]                 = useState('')
  const [month, setMonth]                   = useState(currentMonth)
  const [year, setYear]                     = useState(currentYear)
  const [totalAmount, setTotalAmount]       = useState('')
  const [notes, setNotes]                   = useState('')
  const [allocationMode, setAllocationMode] = useState<AllocationMode>('equal_all')

  // ── Allocation state ─────────────────────────────────────
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set())
  const [manualAmounts, setManualAmounts] = useState<Record<string, string>>({})

  // ── Derived values ───────────────────────────────────────
  const total         = parseFloat(totalAmount) || 0
  const selectedCount = selectedIds.size
  const perStore      = selectedCount > 0 ? total / selectedCount : 0

  const manualSum = useMemo(
    () =>
      Object.entries(manualAmounts)
        .filter(([id]) => selectedIds.has(id))
        .reduce((sum, [, val]) => sum + (parseFloat(val) || 0), 0),
    [manualAmounts, selectedIds]
  )
  const manualBalanced = Math.abs(manualSum - total) < 0.01

  // ── Fetch ────────────────────────────────────────────────
  const fetchExpenses = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setExpenses(data ?? [])
    setLoading(false)
  }

  const fetchActiveStores = async () => {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('active', true)
      .order('name')
    if (error) setError(`Failed to load stores: ${error.message}`)
    else setActiveStores(data ?? [])
  }

  useEffect(() => {
    fetchExpenses()
    fetchActiveStores()
  }, [])

  // ── Form helpers ─────────────────────────────────────────
  const resetForm = () => {
    setEditingExpense(null)
    setTitle('')
    setCategory('')
    setVendor('')
    setMonth(currentMonth)
    setYear(currentYear)
    setTotalAmount('')
    setNotes('')
    setAllocationMode('equal_all')
    setSelectedIds(new Set())
    setManualAmounts({})
    setError(null)
  }

  const handleClose = () => {
    resetForm()
    setShowForm(false)
  }

  // ── Open Edit ─────────────────────────────────────────────
  const handleEdit = async (expense: Expense) => {
    setError(null)
    setEditingExpense(expense)
    setTitle(expense.title)
    setCategory(expense.category ?? '')
    setVendor(expense.vendor ?? '')
    setMonth(expense.month)
    setYear(expense.year)
    setTotalAmount(String(expense.total_amount))
    setNotes(expense.notes ?? '')
    setAllocationMode(expense.allocation_mode as AllocationMode)
    setSelectedIds(new Set())
    setManualAmounts({})

    // Pre-load existing allocations for equal_selected and manual modes
    if (expense.allocation_mode === 'equal_selected' || expense.allocation_mode === 'manual') {
      const { data: allocs } = await supabase
        .from('expense_allocations')
        .select('store_id, allocated_amount')
        .eq('expense_id', expense.id)

      if (allocs && allocs.length > 0) {
        setSelectedIds(new Set(allocs.map((a) => a.store_id)))
        if (expense.allocation_mode === 'manual') {
          const amounts: Record<string, string> = {}
          allocs.forEach((a) => {
            amounts[a.store_id] = String(a.allocated_amount)
          })
          setManualAmounts(amounts)
        }
      }
    }

    setShowForm(true)
  }

  const toggleStore = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => setSelectedIds(new Set(activeStores.map((s) => s.id)))
  const clearAll  = () => setSelectedIds(new Set())

  const handleManualChange = (id: string, val: string) => {
    setManualAmounts((prev) => ({ ...prev, [id]: val }))
  }

  // ── Save (create or update) ───────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Capture editingExpense immediately — reading state inside async
    // functions after await calls can return stale values in React
    const currentEditingExpense = editingExpense

    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    if (total <= 0) {
      setError('Total amount must be greater than 0.')
      return
    }
    if (allocationMode !== 'equal_all' && selectedIds.size === 0) {
      setError('Please select at least one store.')
      return
    }
    if (allocationMode === 'manual' && !manualBalanced) {
      setError(`Manual amounts sum to ${fmt(manualSum)} but total is ${fmt(total)}. They must match.`)
      return
    }

    setSaving(true)

    const expensePayload = {
      title:           title.trim(),
      category:        category || null,
      vendor:          vendor.trim() || null,
      total_amount:    total,
      month,
      year,
      allocation_mode: allocationMode,
      notes:           notes.trim() || null,
    }

    let expenseId: string

    if (currentEditingExpense) {
      // ── UPDATE existing expense ────────────────────────
      const { error: updateError } = await supabase
        .from('expenses')
        .update(expensePayload)
        .eq('id', currentEditingExpense.id)

      if (updateError) {
        setError(updateError.message)
        setSaving(false)
        return
      }

      // Delete old allocations
      const { error: deleteError } = await supabase
        .from('expense_allocations')
        .delete()
        .eq('expense_id', currentEditingExpense.id)

      if (deleteError) {
        setError(deleteError.message)
        setSaving(false)
        return
      }

      expenseId = currentEditingExpense.id
    } else {
      // ── INSERT new expense ─────────────────────────────
      const { data: expenseData, error: insertError } = await supabase
        .from('expenses')
        .insert(expensePayload)
        .select()
        .single()

      if (insertError || !expenseData) {
        setError(insertError?.message ?? 'Failed to save expense.')
        setSaving(false)
        return
      }

      expenseId = expenseData.id
    }

    // ── Build & insert allocations ─────────────────────────
    let allocations: { expense_id: string; store_id: string; allocated_amount: number }[] = []

    if (allocationMode === 'equal_all') {
      const perStoreAmt = activeStores.length > 0 ? total / activeStores.length : 0
      allocations = activeStores.map((s) => ({
        expense_id:       expenseId,
        store_id:         s.id,
        allocated_amount: perStoreAmt,
      }))
    } else if (allocationMode === 'equal_selected') {
      const selected    = activeStores.filter((s) => selectedIds.has(s.id))
      const perStoreAmt = selected.length > 0 ? total / selected.length : 0
      allocations = selected.map((s) => ({
        expense_id:       expenseId,
        store_id:         s.id,
        allocated_amount: perStoreAmt,
      }))
    } else {
      allocations = Array.from(selectedIds).map((id) => ({
        expense_id:       expenseId,
        store_id:         id,
        allocated_amount: parseFloat(manualAmounts[id] ?? '0') || 0,
      }))
    }

    if (allocations.length > 0) {
      const { error: allocError } = await supabase
        .from('expense_allocations')
        .insert(allocations)

      if (allocError) {
        setError(allocError.message)
        setSaving(false)
        return
      }
    }

    handleClose()
    await fetchExpenses()
    setSaving(false)
  }

  // ─── Render ──────────────────────────────────────────────

  const isEditing = editingExpense !== null

  return (
    <div className="p-8">

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Expenses</h2>
          <p className="text-sm text-gray-500 mt-1">Log and manage marketing expenses</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <PlusCircle size={16} />
          Log Expense
        </button>
      </div>

      {/* Expenses table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">All Expenses</h3>
          <span className="text-xs text-gray-400">{expenses.length} record{expenses.length !== 1 ? 's' : ''}</span>
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
                <th className="px-6 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">Loading expenses…</td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    No expenses yet. Click &quot;Log Expense&quot; to get started.
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{expense.title}</td>
                    <td className="px-6 py-4 text-gray-500">{expense.category ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-500">
                      {MONTHS[expense.month - 1]} {expense.year}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-gray-900">
                      {fmt(Number(expense.total_amount))}
                    </td>
                    <td className="px-6 py-4">
                      <AllocationBadge mode={expense.allocation_mode as AllocationMode} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleEdit(expense)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Pencil size={12} />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Slide-in form panel ───────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div className="flex-1 bg-black/30" onClick={handleClose} />

          {/* Panel */}
          <div className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl flex flex-col">

            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {isEditing ? 'Edit Expense' : 'Log Expense'}
                </h3>
                {isEditing && (
                  <p className="text-xs text-gray-400 mt-0.5">{editingExpense.title}</p>
                )}
              </div>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="flex flex-col gap-5 px-6 py-6 flex-1">

              {/* Title */}
              <FormField label="Title" required>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Google Ads — April"
                  required
                  className={inputClass}
                />
              </FormField>

              {/* Category + Vendor */}
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Category">
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                    <option value="">— Select —</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Vendor">
                  <input
                    type="text"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    placeholder="e.g. Google"
                    className={inputClass}
                  />
                </FormField>
              </div>

              {/* Month + Year */}
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Month" required>
                  <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={inputClass}>
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Year" required>
                  <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={inputClass}>
                    {YEARS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </FormField>
              </div>

              {/* Total Amount */}
              <FormField label="Total Amount ($)" required>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className={inputClass}
                />
              </FormField>

              {/* Notes */}
              <FormField label="Notes">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes…"
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
              </FormField>

              {/* Allocation Mode */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">
                  Allocation Mode <span className="text-red-500">*</span>
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: 'equal_all',      label: 'Equal — All Stores' },
                      { value: 'equal_selected', label: 'Equal — Selected'   },
                      { value: 'manual',         label: 'Manual Per Store'   },
                    ] as const
                  ).map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setAllocationMode(value)
                        setSelectedIds(new Set())
                        setManualAmounts({})
                      }}
                      className={`px-3 py-2.5 rounded-lg border text-xs font-medium text-center transition-colors ${
                        allocationMode === value
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-white border-gray-300 text-gray-600 hover:border-indigo-400 hover:text-indigo-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Equal All preview */}
              {allocationMode === 'equal_all' && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-700">
                  {activeStores.length === 0 ? (
                    'No active stores found.'
                  ) : total > 0 ? (
                    <>
                      <span className="font-semibold">{fmt(total / activeStores.length)}</span>
                      {' per store × '}
                      <span className="font-semibold">{activeStores.length}</span>
                      {' active store'}{activeStores.length !== 1 ? 's' : ''}
                    </>
                  ) : (
                    `Will be split equally across ${activeStores.length} active store${activeStores.length !== 1 ? 's' : ''}.`
                  )}
                </div>
              )}

              {/* Equal Selected */}
              {allocationMode === 'equal_selected' && (
                <div className="flex flex-col gap-3">
                  <StoreSelector
                    stores={activeStores}
                    selectedIds={selectedIds}
                    onToggle={toggleStore}
                    onSelectAll={selectAll}
                    onClear={clearAll}
                    isManual={false}
                  />
                  {selectedCount > 0 && total > 0 && (
                    <div className="bg-purple-50 border border-purple-100 rounded-lg px-4 py-3 text-sm text-purple-700">
                      <span className="font-semibold">{fmt(perStore)}</span>
                      {' per store × '}
                      <span className="font-semibold">{selectedCount}</span>
                      {' store'}{selectedCount !== 1 ? 's' : ''}{' selected'}
                    </div>
                  )}
                </div>
              )}

              {/* Manual */}
              {allocationMode === 'manual' && (
                <div className="flex flex-col gap-3">
                  <StoreSelector
                    stores={activeStores}
                    selectedIds={selectedIds}
                    onToggle={toggleStore}
                    onSelectAll={selectAll}
                    onClear={clearAll}
                    isManual={true}
                    manualAmounts={manualAmounts}
                    onManualChange={handleManualChange}
                  />
                  {selectedCount > 0 && (
                    <div
                      className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium border ${
                        total > 0 && manualBalanced
                          ? 'bg-green-50 border-green-200 text-green-700'
                          : 'bg-red-50 border-red-200 text-red-700'
                      }`}
                    >
                      <span>Running Total</span>
                      <span>
                        {fmt(manualSum)}
                        {total > 0 && (
                          <span className="font-normal text-xs ml-1.5 opacity-75">of {fmt(total)}</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Form actions */}
              <div className="flex items-center gap-3 pt-2 pb-2 sticky bottom-0 bg-white border-t border-gray-100 -mx-6 px-6 mt-auto">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                >
                  {saving ? 'Saving…' : isEditing ? 'Update Expense' : 'Save Expense'}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  )
}
