'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { PlusCircle, X, Filter, Pencil, Check } from 'lucide-react'

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
  { code: 'BRAM', name: 'Brampton'      },
  { code: 'GTA',  name: 'GTA'           },
  { code: 'WIND', name: 'Windsor'       },
  { code: 'WNPG', name: 'Winnipeg'      },
  { code: 'SKWN', name: 'Saskatchewan'  },
  { code: 'CALG', name: 'Calgary'       },
  { code: 'WILL', name: 'William Lake'  },
]

// Maps province → default cluster (for Ontario we don't auto-fill — too many clusters)
const PROVINCE_CLUSTER: Record<string, { name: string; code: string }> = {
  Manitoba:     { name: 'Winnipeg',     code: 'WNPG' },
  Saskatchewan: { name: 'Saskatchewan', code: 'SKWN' },
  Alberta:      { name: 'Calgary',      code: 'CALG' },
}

// ─── Helpers ─────────────────────────────────────────────────

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

const editInputClass =
  'w-full border border-amber-200 bg-white rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent'

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

function EditLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-amber-700 mb-1">{children}</label>
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

  // ── Add-form fields (f* prefix) ───────────────────────────
  const [fName,        setFName]        = useState('')
  const [fStoreCode,   setFStoreCode]   = useState('')
  const [fCity,        setFCity]        = useState('')
  const [fProvince,    setFProvince]    = useState('')
  const [fClusterName, setFClusterName] = useState('')
  const [fClusterCode, setFClusterCode] = useState('')
  const [fLocation,    setFLocation]    = useState('')

  // ── Inline-edit state (e* prefix) ────────────────────────
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [editSaving,  setEditSaving]  = useState(false)
  const [editError,   setEditError]   = useState<string | null>(null)
  const [eName,        setEName]        = useState('')
  const [eStoreCode,   setEStoreCode]   = useState('')
  const [eCity,        setECity]        = useState('')
  const [eProvince,    setEProvince]    = useState('')
  const [eClusterName, setEClusterName] = useState('')
  const [eClusterCode, setEClusterCode] = useState('')
  const [eLocation,    setELocation]    = useState('')

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

  // ── Add-form helpers ──────────────────────────────────────
  const resetAddForm = () => {
    setFName('')
    setFStoreCode('')
    setFCity('')
    setFProvince('')
    setFClusterName('')
    setFClusterCode('')
    setFLocation('')
    setError(null)
  }

  const handleAddCancel = () => {
    resetAddForm()
    setShowForm(false)
  }

  const handleAddCityChange = (val: string) => {
    setFCity(val)
    setFLocation(val && fProvince ? `${val}, ${fProvince}` : val)
  }
  const handleAddProvinceChange = (val: string) => {
    setFProvince(val)
    setFLocation(fCity && val ? `${fCity}, ${val}` : val)
    if (!fClusterCode && PROVINCE_CLUSTER[val]) {
      setFClusterName(PROVINCE_CLUSTER[val].name)
      setFClusterCode(PROVINCE_CLUSTER[val].code)
    }
  }
  const handleAddClusterChange = (code: string) => {
    const match = CLUSTERS.find((c) => c.code === code)
    setFClusterCode(code)
    setFClusterName(match?.name ?? '')
  }

  // ── Add-form save ─────────────────────────────────────────
  const handleAddSave = async (e: React.FormEvent) => {
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
      resetAddForm()
      setShowForm(false)
      await fetchStores()
    }

    setSaving(false)
  }

  // ── Inline-edit helpers ───────────────────────────────────

  /** Open the inline edit form for a row, closing any previously open one. */
  const handleEditOpen = (store: StoreRow) => {
    // Toggle off if already editing this row
    if (editingId === store.id) {
      setEditingId(null)
      setEditError(null)
      return
    }
    setEditingId(store.id)
    setEditError(null)
    setEName(store.name)
    setEStoreCode(store.store_code ?? '')
    setECity(store.city ?? '')
    setEProvince(store.province ?? '')
    setEClusterName(store.cluster_name ?? '')
    setEClusterCode(store.cluster_code ?? '')
    setELocation(store.location ?? '')
  }

  const handleEditCancel = () => {
    setEditingId(null)
    setEditError(null)
  }

  const handleEditCityChange = (val: string) => {
    setECity(val)
    setELocation(val && eProvince ? `${val}, ${eProvince}` : val)
  }
  const handleEditProvinceChange = (val: string) => {
    setEProvince(val)
    setELocation(eCity && val ? `${eCity}, ${val}` : val)
  }
  const handleEditClusterChange = (code: string) => {
    const match = CLUSTERS.find((c) => c.code === code)
    setEClusterCode(code)
    setEClusterName(match?.name ?? '')
  }

  /** Save inline edit to Supabase. */
  const handleEditSave = async (storeId: string) => {
    if (!eName.trim()) {
      setEditError('Store name is required.')
      return
    }

    setEditSaving(true)
    setEditError(null)

    const { error } = await supabase
      .from('stores')
      .update({
        name:         eName.trim(),
        store_code:   eStoreCode.trim()   || null,
        city:         eCity.trim()        || null,
        province:     eProvince           || null,
        cluster_name: eClusterName.trim() || null,
        cluster_code: eClusterCode.trim() || null,
        location:     eLocation.trim()    || null,
      })
      .eq('id', storeId)

    if (error) {
      setEditError(error.message)
    } else {
      setEditingId(null)
      await fetchStores()
    }

    setEditSaving(false)
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
          onClick={() => { resetAddForm(); setShowForm((v) => !v) }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <PlusCircle size={16} />
          Add Store
        </button>
      </div>

      {/* Global error banner */}
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
            <button onClick={handleAddCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleAddSave} className="space-y-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="City">
                <input
                  type="text"
                  value={fCity}
                  onChange={(e) => handleAddCityChange(e.target.value)}
                  placeholder="e.g. Brampton"
                  className={inputClass}
                />
              </Field>
              <Field label="Province">
                <select
                  value={fProvince}
                  onChange={(e) => handleAddProvinceChange(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Select Province —</option>
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Cluster">
                <select
                  value={fClusterCode}
                  onChange={(e) => handleAddClusterChange(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Select Cluster —</option>
                  {CLUSTERS.map((c) => (
                    <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </Field>
              <Field label="Cluster Code">
                <input
                  type="text"
                  value={fClusterCode}
                  readOnly
                  placeholder="Auto-filled from Cluster"
                  className={`${inputClass} bg-gray-50 text-gray-500 cursor-default`}
                />
              </Field>
            </div>

            <Field label="Location (address)">
              <input
                type="text"
                value={fLocation}
                onChange={(e) => setFLocation(e.target.value)}
                placeholder="Auto-filled from City + Province"
                className={inputClass}
              />
            </Field>

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
                onClick={handleAddCancel}
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

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Cluster</label>
          <select
            value={filterCluster}
            onChange={(e) => setFilterCluster(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]"
          >
            <option value="">All Clusters</option>
            {CLUSTERS.map((c) => (
              <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
            ))}
          </select>
        </div>

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
                <th className="px-5 py-3 text-right font-medium">Actions</th>
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
                filtered.map((store) => {
                  const isEditing = editingId === store.id
                  return (
                    <>
                      {/* ── Data row ──────────────────────── */}
                      <tr
                        key={store.id}
                        className={`transition-colors ${isEditing ? 'bg-amber-50' : 'hover:bg-gray-50'}`}
                      >
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
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            {/* Edit button */}
                            <button
                              onClick={() => handleEditOpen(store)}
                              className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                                isEditing
                                  ? 'bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200'
                                  : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                              }`}
                            >
                              <Pencil size={11} />
                              {isEditing ? 'Editing…' : 'Edit'}
                            </button>

                            {/* Activate / Deactivate button */}
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
                                ? '…'
                                : store.active
                                ? 'Deactivate'
                                : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* ── Inline edit row ───────────────── */}
                      {isEditing && (
                        <tr key={`edit-${store.id}`}>
                          <td
                            colSpan={7}
                            className="px-6 py-5 bg-amber-50 border-t border-amber-100"
                          >
                            {/* Edit form */}
                            <div className="max-w-4xl">
                              <div className="flex items-center gap-2 mb-4">
                                <Pencil size={13} className="text-amber-600" />
                                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                                  Editing: {store.name}
                                </span>
                              </div>

                              {editError && (
                                <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">
                                  {editError}
                                </div>
                              )}

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">

                                {/* Store Name */}
                                <div className="lg:col-span-2">
                                  <EditLabel>Store Name *</EditLabel>
                                  <input
                                    type="text"
                                    value={eName}
                                    onChange={(e) => setEName(e.target.value)}
                                    placeholder="Store name"
                                    className={editInputClass}
                                  />
                                </div>

                                {/* Store Code */}
                                <div>
                                  <EditLabel>Store Code</EditLabel>
                                  <input
                                    type="text"
                                    value={eStoreCode}
                                    onChange={(e) => setEStoreCode(e.target.value.toUpperCase())}
                                    placeholder="e.g. SPDL01"
                                    className={`${editInputClass} font-mono`}
                                  />
                                </div>

                                {/* City */}
                                <div>
                                  <EditLabel>City</EditLabel>
                                  <input
                                    type="text"
                                    value={eCity}
                                    onChange={(e) => handleEditCityChange(e.target.value)}
                                    placeholder="City"
                                    className={editInputClass}
                                  />
                                </div>

                                {/* Province */}
                                <div>
                                  <EditLabel>Province</EditLabel>
                                  <select
                                    value={eProvince}
                                    onChange={(e) => handleEditProvinceChange(e.target.value)}
                                    className={editInputClass}
                                  >
                                    <option value="">— Select —</option>
                                    {PROVINCES.map((p) => (
                                      <option key={p} value={p}>{p}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* Cluster (single select → fills both name + code) */}
                                <div>
                                  <EditLabel>Cluster</EditLabel>
                                  <select
                                    value={eClusterCode}
                                    onChange={(e) => handleEditClusterChange(e.target.value)}
                                    className={editInputClass}
                                  >
                                    <option value="">— Select —</option>
                                    {CLUSTERS.map((c) => (
                                      <option key={c.code} value={c.code}>
                                        {c.name} ({c.code})
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* Cluster Code (read-only, auto-filled) */}
                                <div>
                                  <EditLabel>Cluster Code</EditLabel>
                                  <input
                                    type="text"
                                    value={eClusterCode}
                                    readOnly
                                    placeholder="Auto-filled"
                                    className={`${editInputClass} bg-amber-50/80 text-amber-700 font-mono cursor-default`}
                                  />
                                </div>

                                {/* Location */}
                                <div className="sm:col-span-2 lg:col-span-2">
                                  <EditLabel>Location (address)</EditLabel>
                                  <input
                                    type="text"
                                    value={eLocation}
                                    onChange={(e) => setELocation(e.target.value)}
                                    placeholder="Auto-filled from City + Province"
                                    className={editInputClass}
                                  />
                                </div>

                              </div>

                              {/* Action buttons */}
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEditSave(store.id)}
                                  disabled={editSaving || !eName.trim()}
                                  className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                                >
                                  <Check size={13} />
                                  {editSaving ? 'Saving…' : 'Save Changes'}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleEditCancel}
                                  disabled={editSaving}
                                  className="inline-flex items-center gap-1.5 bg-white hover:bg-gray-100 border border-gray-300 text-gray-600 text-xs font-medium px-4 py-2 rounded-lg transition-colors"
                                >
                                  <X size={13} />
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
