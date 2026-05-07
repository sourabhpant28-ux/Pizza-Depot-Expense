'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import Sidebar from './Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-100">

      {/* ── Mobile backdrop ───────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ───────────────────────────────────────── */}
      {/* Mobile: fixed slide-in overlay | Desktop: static flex column */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300
          md:relative md:z-auto md:translate-x-0 md:flex md:flex-col md:shrink-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Mobile close button inside sidebar */}
        <button
          className="absolute top-4 right-4 text-gray-400 hover:text-white md:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <X size={20} />
        </button>

        <Sidebar />
      </div>

      {/* ── Main content area ────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Mobile top bar — hamburger + title */}
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 bg-white border-b border-gray-200 px-4 py-3 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            <Menu size={22} />
          </button>
          <span className="text-sm font-semibold text-gray-900">
            Marketing Fund Tracker
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

      </div>
    </div>
  )
}
