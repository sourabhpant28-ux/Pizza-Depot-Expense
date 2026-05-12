'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { CATEGORIES, MONTHS } from '@/lib/types'
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Loader2,
  X,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────

const VALID_CLUSTER_CODES = ['BRAM', 'GTA', 'WIND', 'WNPG', 'SKWN', 'CALG', 'WILL']

const VALID_ALLOCATION_TYPES = [
  'ALL',
  'CLUSTER',
  'MULTI_CLUSTER',
  'STORE',
  'MULTI_STORE',
] as const

type AllocationType = (typeof VALID_ALLOCATION_TYPES)[number]

// ─── Types ────────────────────────────────────────────────────

type StoreRecord = {
  id: string
  name: string
  store_code: string | null
  cluster_code: string | null
  active: boolean
}

type ValidatedRow = {
  rowIndex: number
  title: string
  category: string
  vendor: string
  amount: string
  month: string
  year: string
  allocation_type: string
  allocation_target: string
  notes: string
  status: 'ready' | 'error'
  errors: string[]
}

type ImportResult = {
  imported: number
  skipped: number
}

// ─── Validation helper (pure, outside component) ─────────────

function validateRow(
  r: Record<string, unknown>,
  index: number,
  storeCodeSet: Set<string>
): ValidatedRow {
  const str = (key: string) => String(r[key] ?? '').trim()

  const title             = str('title')
  const category          = str('category')
  const vendor            = str('vendor')
  const amount            = str('amount')
  const month             = str('month')
  const year              = str('year')
  const allocation_type   = str('allocation_type').toUpperCase()
  const allocation_target = str('allocation_target')
  const notes             = str('notes')

  const errors: string[] = []

  // Required fields
  if (!title)           errors.push('Title is required')
  if (!category)        errors.push('Category is required')
  if (!amount)          errors.push('Amount is required')
  if (!month)           errors.push('Month is required')
  if (!year)            errors.push('Year is required')
  if (!allocation_type) errors.push('Allocation type is required')

  // Amount
  if (amount) {
    const n = parseFloat(amount)
    if (isNaN(n) || n <= 0) errors.push('Amount must be a positive number')
  }

  // Month 1-12
  if (month) {
    const m = parseInt(month)
    if (isNaN(m) || m < 1 || m > 12) errors.push('Month must be 1–12')
  }

  // Year
  if (year) {
    const y = parseInt(year)
    if (isNaN(y) || y < 2000 || y > 2100) errors.push('Year must be a valid 4-digit year')
  }

  // Category must be in the known list
  if (category && !(CATEGORIES as readonly string[]).includes(category)) {
    errors.push(`Invalid category "${category}"`)
  }

  // Allocation type
  if (allocation_type && !VALID_ALLOCATION_TYPES.includes(allocation_type as AllocationType)) {
    errors.push(`Allocation type must be: ${VALID_ALLOCATION_TYPES.join(', ')}`)
  }

  // Target required for non-ALL types
  if (allocation_type && allocation_type !== 'ALL' && !allocation_target) {
    errors.push('Allocation target is required for this type')
  }

  // Cluster code validation
  if (allocation_type === 'CLUSTER' && allocation_target) {
    if (!VALID_CLUSTER_CODES.includes(allocation_target.toUpperCase())) {
      errors.push(
        `Invalid cluster "${allocation_target}". Must be: ${VALID_CLUSTER_CODES.join(', ')}`
      )
    }
  }
  if (allocation_type === 'MULTI_CLUSTER' && allocation_target) {
    const codes = allocation_target.split(',').map((c) => c.trim().toUpperCase())
    const bad   = codes.filter((c) => !VALID_CLUSTER_CODES.includes(c))
    if (bad.length) errors.push(`Unknown cluster codes: ${bad.join(', ')}`)
  }

  // Store code validation
  if (allocation_type === 'STORE' && allocation_target) {
    if (!storeCodeSet.has(allocation_target.toUpperCase())) {
      errors.push(`Store code "${allocation_target}" not found in database`)
    }
  }
  if (allocation_type === 'MULTI_STORE' && allocation_target) {
    const codes = allocation_target.split(',').map((c) => c.trim().toUpperCase())
    const bad   = codes.filter((c) => !storeCodeSet.has(c))
    if (bad.length) errors.push(`Store codes not found: ${bad.join(', ')}`)
  }

  return {
    rowIndex: index + 2, // +2: 1-indexed + skip header row
    title,
    category,
    vendor,
    amount,
    month,
    year,
    allocation_type,
    allocation_target,
    notes,
    status: errors.length === 0 ? 'ready' : 'error',
    errors,
  }
}

// ─── Sub-components ───────────────────────────────────────────

function SectionCard({
  step,
  title,
  children,
}: {
  step: number
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
          {step}
        </span>
        <h3 className="text-base font-semibold text-gray-800">{title}</h3>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────

export default function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [stores, setStores]           = useState<StoreRecord[]>([])
  const [storesLoaded, setStoresLoaded] = useState(false)
  const [step, setStep]               = useState<'upload' | 'preview' | 'done'>('upload')
  const [dragOver, setDragOver]       = useState(false)
  const [fileName, setFileName]       = useState('')
  const [rows, setRows]               = useState<ValidatedRow[]>([])
  const [importing, setImporting]     = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [pageError, setPageError]     = useState<string | null>(null)

  // Fetch all stores on mount for store-code validation
  useEffect(() => {
    supabase
      .from('stores')
      .select('id, name, store_code, cluster_code, active')
      .limit(1000)
      .then(({ data }) => {
        setStores(data ?? [])
        setStoresLoaded(true)
      })
  }, [])

  // ── Template download ────────────────────────────────────
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new()
    const data = [
      ['title', 'category', 'vendor', 'amount', 'month', 'year', 'allocation_type', 'allocation_target', 'notes'],
      [
        'Google Ads — May 2026', 'Digital Ads', 'Google', 5000, 5, 2026,
        'ALL', '',
        'Split equally across all active stores',
      ],
      [
        'Print Flyers — GTA', 'Print', 'Staples', 2000, 5, 2026,
        'CLUSTER', 'GTA',
        'GTA cluster stores only',
      ],
      [
        'Radio — Windsor & Winnipeg', 'Radio / TV', 'CKLW', 1500, 5, 2026,
        'MULTI_CLUSTER', 'WIND,WNPG',
        'Two clusters — comma-separate codes',
      ],
      [
        'Event — Springdale Store', 'Events', 'Venue Co.', 800, 5, 2026,
        'STORE', 'SPDL01',
        'Single store by store code',
      ],
      [
        'Social — Brampton Stores', 'Social Media', 'Meta', 3000, 5, 2026,
        'MULTI_STORE', 'SPDL01,RAYL02,WXFD03',
        'Multiple stores — comma-separate codes',
      ],
    ]

    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = [
      { wch: 32 }, { wch: 16 }, { wch: 14 }, { wch: 10 },
      { wch: 7  }, { wch: 7  }, { wch: 16 }, { wch: 26 }, { wch: 38 },
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Expenses')
    XLSX.writeFile(wb, 'expense-import-template.xlsx')
  }

  // ── Parse + validate uploaded file ───────────────────────
  const processFile = useCallback(
    (file: File) => {
      setPageError(null)
      setFileName(file.name)

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const raw    = new Uint8Array(e.target?.result as ArrayBuffer)
          const wb     = XLSX.read(raw, { type: 'array' })
          const ws     = wb.Sheets[wb.SheetNames[0]]
          const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
            defval: '',
            raw: false, // convert numbers to strings so we handle them uniformly
          })

          if (parsed.length === 0) {
            setPageError('The file appears to be empty. Please check the template.')
            return
          }

          const storeCodeSet = new Set(
            stores
              .map((s) => s.store_code?.toUpperCase())
              .filter((c): c is string => !!c)
          )

          setRows(parsed.map((r, i) => validateRow(r, i, storeCodeSet)))
          setStep('preview')
        } catch {
          setPageError('Failed to parse the file. Make sure it is a valid .xlsx or .xls file.')
        }
      }
      reader.readAsArrayBuffer(file)
    },
    [stores]
  )

  // ── Drag-and-drop handlers ───────────────────────────────
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (!file) return
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        setPageError('Only .xlsx and .xls files are accepted.')
        return
      }
      processFile(file)
    },
    [processFile]
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  // ── Import ───────────────────────────────────────────────
  const handleImport = async () => {
    const readyRows    = rows.filter((r) => r.status === 'ready')
    const skippedCount = rows.filter((r) => r.status === 'error').length

    if (readyRows.length === 0) return
    setImporting(true)
    setPageError(null)

    const activeStores = stores.filter((s) => s.active)
    let imported = 0
    let importFailed = 0

    for (const row of readyRows) {
      try {
        const total    = parseFloat(row.amount)
        const allocType = row.allocation_type as AllocationType

        // Map to Supabase allocation_mode
        const allocationMode =
          allocType === 'ALL' ? 'equal_all' : 'equal_selected'

        // Insert expense
        const { data: expenseData, error: expError } = await supabase
          .from('expenses')
          .insert({
            title:           row.title,
            category:        row.category  || null,
            vendor:          row.vendor    || null,
            total_amount:    total,
            month:           parseInt(row.month),
            year:            parseInt(row.year),
            allocation_mode: allocationMode,
            notes:           row.notes     || null,
          })
          .select()
          .single()

        if (expError || !expenseData) {
          importFailed++
          continue
        }

        const expenseId = expenseData.id

        // Determine target stores
        let targetStores: StoreRecord[] = []

        if (allocType === 'ALL') {
          targetStores = activeStores
        } else if (allocType === 'CLUSTER') {
          const code = row.allocation_target.trim().toUpperCase()
          targetStores = activeStores.filter(
            (s) => s.cluster_code?.toUpperCase() === code
          )
        } else if (allocType === 'MULTI_CLUSTER') {
          const codes = row.allocation_target
            .split(',')
            .map((c) => c.trim().toUpperCase())
          targetStores = activeStores.filter(
            (s) => s.cluster_code && codes.includes(s.cluster_code.toUpperCase())
          )
        } else if (allocType === 'STORE') {
          const code = row.allocation_target.trim().toUpperCase()
          targetStores = activeStores.filter(
            (s) => s.store_code?.toUpperCase() === code
          )
        } else if (allocType === 'MULTI_STORE') {
          const codes = row.allocation_target
            .split(',')
            .map((c) => c.trim().toUpperCase())
          targetStores = activeStores.filter(
            (s) => s.store_code && codes.includes(s.store_code.toUpperCase())
          )
        }

        if (targetStores.length === 0) {
          importFailed++
          continue
        }

        const perStore     = total / targetStores.length
        const allocations  = targetStores.map((s) => ({
          expense_id:       expenseId,
          store_id:         s.id,
          allocated_amount: perStore,
        }))

        // Insert in chunks of 50 to stay within limits
        const CHUNK = 50
        let allocOk = true
        for (let i = 0; i < allocations.length; i += CHUNK) {
          const { error: allocErr } = await supabase
            .from('expense_allocations')
            .insert(allocations.slice(i, i + CHUNK))
          if (allocErr) { allocOk = false; break }
        }

        if (allocOk) imported++
        else         importFailed++

      } catch {
        importFailed++
      }
    }

    setImportResult({ imported, skipped: skippedCount + importFailed })
    setImporting(false)
    setStep('done')
  }

  // ── Reset ────────────────────────────────────────────────
  const handleReset = () => {
    setStep('upload')
    setRows([])
    setFileName('')
    setImportResult(null)
    setPageError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Derived ──────────────────────────────────────────────
  const readyCount = rows.filter((r) => r.status === 'ready').length
  const errorCount = rows.filter((r) => r.status === 'error').length

  // ─── DONE view ───────────────────────────────────────────
  if (step === 'done' && importResult) {
    return (
      <div className="p-6 md:p-8 flex items-start justify-center min-h-[60vh]">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center max-w-md w-full mt-12">
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-green-600" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Import Complete</h2>
          <p className="text-sm text-gray-500 mb-6">Your expenses have been recorded in the system.</p>

          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-4">
              <p className="text-2xl font-bold text-green-700">{importResult.imported}</p>
              <p className="text-xs text-green-600 mt-0.5 font-medium">
                expense{importResult.imported !== 1 ? 's' : ''} imported
              </p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4">
              <p className="text-2xl font-bold text-gray-600">{importResult.skipped}</p>
              <p className="text-xs text-gray-500 mt-0.5 font-medium">
                row{importResult.skipped !== 1 ? 's' : ''} skipped
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href="/expenses"
              className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              View Expenses
              <ArrowRight size={15} />
            </Link>
            <button
              onClick={handleReset}
              className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              <RotateCcw size={14} />
              Import Another File
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── UPLOAD + PREVIEW views ──────────────────────────────
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Import Expenses</h2>
        <p className="text-sm text-gray-500 mt-1">
          Bulk-import expenses from an Excel spreadsheet
        </p>
      </div>

      {/* Global error */}
      {pageError && (
        <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span className="flex-1">{pageError}</span>
          <button onClick={() => setPageError(null)}>
            <X size={14} className="text-red-400 hover:text-red-600" />
          </button>
        </div>
      )}

      {/* ── UPLOAD STEP ──────────────────────────────────── */}
      {step === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Section 1 — Download Template */}
          <SectionCard step={1} title="Download Template">
            <p className="text-sm text-gray-500 mb-4 leading-relaxed">
              Download the Excel template with the correct column headers and
              5 example rows showing every allocation type.
            </p>

            {/* Column reference */}
            <div className="mb-5 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-200 bg-gray-100">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Required columns</p>
              </div>
              <ul className="divide-y divide-gray-100">
                {[
                  ['title',             'Expense name',          true ],
                  ['category',          'From approved list',     true ],
                  ['vendor',            'Supplier / vendor',      false],
                  ['amount',            'Total $ amount',         true ],
                  ['month',             '1 – 12',                 true ],
                  ['year',              '4-digit year',           true ],
                  ['allocation_type',   'ALL / CLUSTER / …',      true ],
                  ['allocation_target', 'Cluster or store codes', false],
                  ['notes',             'Optional notes',         false],
                ].map(([col, desc, req]) => (
                  <li key={col as string} className="flex items-center gap-2 px-3 py-1.5">
                    <span className="font-mono text-xs text-indigo-700 w-36 shrink-0">{col as string}</span>
                    <span className="text-xs text-gray-500 flex-1">{desc as string}</span>
                    {req && (
                      <span className="text-xs text-red-500 font-medium shrink-0">req</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Allocation type reference */}
            <div className="mb-5 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-200 bg-gray-100">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Allocation types</p>
              </div>
              <ul className="divide-y divide-gray-100">
                {[
                  ['ALL',           'All active stores',             '—'           ],
                  ['CLUSTER',       'One cluster code',              'e.g. GTA'    ],
                  ['MULTI_CLUSTER', 'Several clusters',              'GTA,WIND'    ],
                  ['STORE',         'One store code',                'e.g. SPDL01' ],
                  ['MULTI_STORE',   'Several store codes',           'SPDL01,RAYL02'],
                ].map(([type, desc, example]) => (
                  <li key={type as string} className="flex items-start gap-2 px-3 py-1.5">
                    <span className="font-mono text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                      {type as string}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-700">{desc as string}</p>
                      <p className="text-xs text-gray-400">{example as string}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors w-full justify-center"
            >
              <Download size={15} />
              Download Template
            </button>
          </SectionCard>

          {/* Section 2 — Upload */}
          <div className="lg:col-span-2">
            <SectionCard step={2} title="Upload Your File">
              {!storesLoaded ? (
                <div className="flex items-center justify-center gap-2 py-12 text-gray-400 text-sm">
                  <Loader2 size={16} className="animate-spin" />
                  Loading store data for validation…
                </div>
              ) : (
                <>
                  {/* Drop zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true)  }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-xl px-8 py-14 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
                      dragOver
                        ? 'border-indigo-400 bg-indigo-50'
                        : 'border-gray-300 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/40'
                    }`}
                  >
                    <div className={`p-4 rounded-full transition-colors ${
                      dragOver ? 'bg-indigo-100' : 'bg-white border border-gray-200'
                    }`}>
                      <FileSpreadsheet size={28} className={dragOver ? 'text-indigo-600' : 'text-gray-400'} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700">
                        {dragOver ? 'Drop to upload' : 'Drop your file here'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">or click to browse</p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-3 text-center">
                    Accepted: .xlsx, .xls — first sheet is used
                  </p>

                  {/* Quick-reference: valid categories */}
                  <details className="mt-5 group">
                    <summary className="text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700 select-none list-none flex items-center gap-1">
                      <span className="text-gray-400 group-open:rotate-90 transition-transform inline-block">▶</span>
                      Valid category values
                    </summary>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {CATEGORIES.map((c) => (
                        <span key={c} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                          {c}
                        </span>
                      ))}
                    </div>
                  </details>

                  {/* Quick-reference: valid cluster codes */}
                  <details className="mt-3 group">
                    <summary className="text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700 select-none list-none flex items-center gap-1">
                      <span className="text-gray-400 group-open:rotate-90 transition-transform inline-block">▶</span>
                      Valid cluster codes
                    </summary>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {VALID_CLUSTER_CODES.map((c) => (
                        <span key={c} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded font-mono">
                          {c}
                        </span>
                      ))}
                    </div>
                  </details>
                </>
              )}
            </SectionCard>
          </div>
        </div>
      )}

      {/* ── PREVIEW STEP ─────────────────────────────────── */}
      {step === 'preview' && (
        <div className="space-y-5">

          {/* Preview header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileSpreadsheet size={16} className="text-gray-500" />
                <span className="text-sm font-semibold text-gray-800">{fileName}</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-green-700 font-medium">
                  <CheckCircle2 size={14} />
                  {readyCount} ready
                </span>
                {errorCount > 0 && (
                  <span className="flex items-center gap-1.5 text-red-600 font-medium">
                    <XCircle size={14} />
                    {errorCount} {errorCount === 1 ? 'error' : 'errors'}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 border border-gray-300 hover:border-gray-400 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Upload size={13} />
              Upload different file
            </button>
          </div>

          {/* Preview table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-3 py-3 text-left font-medium w-8">#</th>
                    <th className="px-3 py-3 text-left font-medium">Title</th>
                    <th className="px-3 py-3 text-left font-medium">Category</th>
                    <th className="px-3 py-3 text-left font-medium">Vendor</th>
                    <th className="px-3 py-3 text-right font-medium">Amount</th>
                    <th className="px-3 py-3 text-center font-medium">Month</th>
                    <th className="px-3 py-3 text-center font-medium">Year</th>
                    <th className="px-3 py-3 text-left font-medium">Alloc Type</th>
                    <th className="px-3 py-3 text-left font-medium">Target</th>
                    <th className="px-3 py-3 text-left font-medium w-32">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row) => {
                    const isReady = row.status === 'ready'
                    const monthNum = parseInt(row.month)
                    const monthLabel = !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12
                      ? MONTHS[monthNum - 1].slice(0, 3)
                      : row.month
                    const amtNum = parseFloat(row.amount)

                    return (
                      <tr
                        key={row.rowIndex}
                        className={isReady ? 'hover:bg-gray-50' : 'bg-red-50/40'}
                      >
                        <td className="px-3 py-2.5 text-xs text-gray-400">{row.rowIndex}</td>

                        <td className="px-3 py-2.5 font-medium text-gray-900 max-w-[160px]">
                          <span className="block truncate" title={row.title}>
                            {row.title || <span className="text-red-400 italic">—</span>}
                          </span>
                        </td>

                        <td className="px-3 py-2.5 text-gray-600 max-w-[110px]">
                          <span className="block truncate">{row.category || '—'}</span>
                        </td>

                        <td className="px-3 py-2.5 text-gray-500 max-w-[100px]">
                          <span className="block truncate">{row.vendor || '—'}</span>
                        </td>

                        <td className="px-3 py-2.5 text-right font-semibold text-gray-900">
                          {!isNaN(amtNum) && amtNum > 0
                            ? `$${amtNum.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
                            : <span className="text-red-400">—</span>}
                        </td>

                        <td className="px-3 py-2.5 text-center text-gray-500 text-xs">
                          {monthLabel}
                        </td>

                        <td className="px-3 py-2.5 text-center text-gray-500 text-xs">
                          {row.year || '—'}
                        </td>

                        <td className="px-3 py-2.5">
                          {row.allocation_type ? (
                            <span className="font-mono text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                              {row.allocation_type}
                            </span>
                          ) : (
                            <span className="text-red-400">—</span>
                          )}
                        </td>

                        <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[130px]">
                          <span className="block truncate font-mono" title={row.allocation_target}>
                            {row.allocation_target || (
                              row.allocation_type === 'ALL'
                                ? <span className="text-gray-400 not-italic font-sans">all stores</span>
                                : '—'
                            )}
                          </span>
                        </td>

                        <td className="px-3 py-2.5">
                          {isReady ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              <CheckCircle2 size={11} />
                              Ready
                            </span>
                          ) : (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 mb-1">
                                <XCircle size={11} />
                                Error
                              </span>
                              <ul className="space-y-0.5">
                                {row.errors.map((err, i) => (
                                  <li key={i} className="text-xs text-red-600 leading-tight">
                                    · {err}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Import button row */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="text-sm text-gray-500">
              {errorCount > 0 && (
                <span className="flex items-center gap-1.5 text-amber-600">
                  <AlertTriangle size={14} />
                  {errorCount} row{errorCount !== 1 ? 's' : ''} with errors will be skipped automatically.
                </span>
              )}
            </div>

            {readyCount > 0 ? (
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
              >
                {importing ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Importing…
                  </>
                ) : (
                  <>
                    Import {readyCount} expense{readyCount !== 1 ? 's' : ''}
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            ) : (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <XCircle size={15} />
                No valid rows to import. Fix errors in your file and re-upload.
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
