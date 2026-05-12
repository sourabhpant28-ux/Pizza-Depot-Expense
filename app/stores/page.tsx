'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { PlusCircle, X, Filter } from 'lucide-react'

// ─── Extended Store type (includes new columns) ──────────────

type StoreRow = {
  id: string
  name: string
  store_code: string | null
  city: string | null
  province: string | null
  cluster_name: string | null
  cluster_code: string | null
  location: string | null
  active: boolean
  created_at: string
}

// ─── Constants ───────────────────────────────────────────────

const PROVINCES = ['Ontario', 'Alberta', 'Saskatchewan', 'Manitoba']

const CLUSTERS = [
  { code: 'BRAM', label: 'Brampton (BRAM)' },
  { code: 'GTA',  label: 'GTA'             },
  { code: 'WIND', label: 'Windsor (WIND)'  },
  { code: 'WNPG', label: 'Winnipeg (WNPG)' },
  { code: 'SKWN', label: 'Saskatchewan (SKWN)' },
  { code: 'CALG', label: 'Calgary (CALG)'  },
]

// ─── Helpers ─────────────────────────────────────────────────

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

function Field({
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
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
      Inactive
    </span>
  )
}

// ─── Page ────────────────────────────────────────────────────

export default function StoresPage() {
  const [stores, setStores]         = useState<StoreRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)

  // ── Filters ───────────────────────────────────────────────
  const [filterProvince, setFilterProvince] = useState('')
  const [filterCluster, setFilterCluster]   = useState('')

  // ── Form fields ───────────────────────────────────────────
  const [fName,        setFName]        = useState('')
  const [fStoreCode,   setFStoreCode]   = useState('')
  const [fCity,        setFCity]        = useState('')
  const [fProvince,    setFProvince]    = useState('')
  const [fClusterName, setFClusterName] = useState('')
  const [fClusterCode, setFClusterCode] = useState('')
  const [fLocation,    setFLocation]    = useState('')

  // ── Fetch ─────────────────────────────────────────────────
  const fetchStores = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .order('name')
      .limit(1000)

    if (error) setError(error.message)
    else setStores(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchStores() }, [])

  // ── Client-side filtering ─────────────────────────────────
  const filtered = useMemo(() => {
    return stores.filter((s) => {
      if (filterProvince && s.province !== filterProvince) return false
      if (filterCluster  && s.cluster_code !== filterCluster) return false
      return true
    })
  }, [stores, filterProvince, filterCluster])

  // ── Form helpers ──────────────────────────────────────────
  const resetForm = () => {
    setFName('')
    setFStoreCode('')
    setFCity('')
    setFProvince('')
    setFClusterName('')
    setFClusterCode('')
    setFLocation('')
    setError(null)
  }

  const handleCancel = () => {
    resetForm()
    setShowForm(false)
  }

  // Auto-fill location when city + province change
  const handleCityChange = (val: string) => {
    setFCity(val)
    setFLocation(val && fProvince ? `${val}, ${fProvince}` : val)
  }
  const handleProvinceChange = (val: string) => {
    setFProvince(val)
    setFLocation(fCity && val ? `${fCity}, ${val}` : val)
    // Auto-fill cluster from province if not already set
    if (!fClusterCode) {
      const map: Record<string, { name: string; code: string }> = {
        Manitoba:     { name: 'Winnipeg',     code: 'WNPG' },
        Saskatchewan: { name: 'Saskatchewan', code: 'SKWN' },
        Alberta:      { name: 'Calgary',      code: 'CALG' },
      }
      if (map[val]) {
        setFClusterName(map[val].name)
        setFClusterCode(map[val].code)
      }
    }
  }

  // ── Save ──────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fName.trim()) return

    setSaving(true)
    setError(null)

    const { error } = await supabase.from('stores').insert({
      name:         fName.trim(),
      store_code:   fStoreCode.trim()   || null,
      city:         fCity.trim()        || null,
      province:     fProvince           || null,
      cluster_name: fClusterName.trim() || null,
      cluster_code: fClusterCode.trim() || null,
      location:     fLocation.trim()    || null,
      active:       true,
    })

    if (error) {
      setError(error.message)
    } else {
      resetForm()
      setShowForm(false)
      await fetchStores()
    }

    setSaving(false)
  }

  // ── Toggle active ─────────────────────────────────────────
  const handleToggleActive = async (store: StoreRow) => {
    setTogglingId(store.id)
    setError(null)

    const { error } = await supabase
      .from('stores')
      .update({ active: !store.active })
      .eq('id', store.id)

    if (error) setError(error.message)
    else await fetchStores()

    setTogglingId(null)
  }

  // ─── Render ──────────────────────────────────────────────
  return (
    <div className="p-6 md:p-8">

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Stores</h2>
          <p className="text-sm text-gray-500 mt-1">Manage your store locations</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm((v) => !v) }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <PlusCircle size={16} />
          Add Store
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* ── Add Store form ─────────────────────────────────── */}
      {showForm && (
        <div className="mb-6 bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-gray-800">New Store</h3>
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {/* Row 1: Name + Code */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Store Name" required>
                <input
                  type="text"
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  placeholder="e.g. Downtown Pizza Depot"
                  required
                  className={inputClass}
                />
              </Field>
              <Field label="Store Code">
                <input
                  type="text"
                  value={fStoreCode}
                  onChange={(e) => setFStoreCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SPDL01"
                  className={inputClass}
                />
              </Field>
            </div>

            {/* Row 2: City + Province */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="City">
                <input
                  type="text"
                  value={fCity}
                  onChange={(e) => handleCityChange(e.target.value)}
                  placeholder="e.g. Brampton"
                  className={inputClass}
                />
              </Field>
              <Field label="Province">
                <select
                  value={fProvince}
                  onChange={(e) => handleProvinceChange(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Select Province —</option>
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Row 3: Cluster Name + Cluster Code */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Cluster Name">
                <input
                  type="text"
                  value={fClusterName}
                  onChange={(e) => setFClusterName(e.target.value)}
                  placeholder="e.g. GTA"
                  className={inputClass}
                />
              </Field>
              <Field label="Cluster Code">
                <select
                  value={fClusterCode}
                  onChange={(e) => setFClusterCode(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Select Cluster —</option>
                  {CLUSTERS.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Row 4: Actions */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={saving || !fName.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
              >
                {saving ? 'Saving…' : 'Save Store'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-5 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Filter bar ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-5 py-4 mb-4 flex flex-wrap items-end gap-4">
        <div className="flex items-center gap-2 text-gray-500 self-center">
          <Filter size={14} />
          <span className="text-sm font-medium text-gray-600">Filter</span>
        </div>

        {/* Province filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Province</label>
          <select
            value={filterProvince}
            onChange={(e) => setFilterProvince(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[160px]"
          >
            <option value="">All Provinces</option>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Cluster filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Cluster</label>
          <select
            value={filterCluster}
            onChange={(e) => setFilterCluster(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]"
          >
            <option value="">All Clusters</option>
            {CLUSTERS.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Clear filters */}
        {(filterProvince || filterCluster) && (
          <button
            onClick={() => { setFilterProvince(''); setFilterCluster('') }}
            className="text-xs text-gray-500 hover:text-gray-800 underline self-end pb-2"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Stores table ──────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">All Stores</h3>
          <span className="text-xs text-gray-400">
            {filtered.length === stores.length
              ? `${stores.length} store${stores.length !== 1 ? 's' : ''}`
              : `${filtered.length} of ${stores.length} stores`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-6 py-3 text-left font-medium">Store Name</th>
                <th className="px-5 py-3 text-left font-medium">Code</th>
                <th className="px-5 py-3 text-left font-medium">City</th>
                <th className="px-5 py-3 text-left font-medium">Province</th>
                <th className="px-5 py-3 text-left font-medium">Cluster</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    Loading stores…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    {stores.length === 0
                      ? 'No stores yet. Click "Add Store" to get started.'
                      : 'No stores match the selected filters.'}
                  </td>
                </tr>
              ) : (
                filtered.map((store) => (
                  <tr key={store.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-gray-900 max-w-[220px]">
                      <span className="block truncate" title={store.name}>{store.name}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {store.store_code ? (
                        <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                          {store.store_code}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{store.city ?? '—'}</td>
                    <td className="px-5 py-3.5 text-gray-600">{store.province ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      {store.cluster_name ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {store.cluster_name}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge active={store.active} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleToggleActive(store)}
                        disabled={togglingId === store.id}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          store.active
                            ? 'border-red-200 text-red-600 hover:bg-red-50'
                            : 'border-green-200 text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {togglingId === store.id
                          ? 'Updating…'
                          : store.active
                          ? 'Deactivate'
                          : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
